/**
 * Local server that serves the meal planner dashboard and provides
 * a Gemini-powered chat API with full meal plan context + function calling.
 *
 * Usage:  node server.mjs
 * Opens: http://localhost:3000
 */

import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { manageMealPlan } from './build/tools/mealPlanCRUD.js';
import { generateDashboardHTML } from './build/tools/showUI.js';
import { RECIPE_BANK } from './build/data/recipeBank.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN_FILE  = path.join(__dirname, 'data', 'meal_plan.json');
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.use(express.json());

// ── In-memory conversation sessions (sessionId → history array) ──────────
const sessions = new Map();

// ── Build Gemini system prompt with full plan context ─────────────────────
function buildSystemPrompt(plan) {
  const p = plan.userProfile;
  const dayLines = Object.entries(plan.days)
    .map(([day, d]) =>
      `  ${day.padEnd(9)} [${d.workoutType.padEnd(7)}] ` +
      `B: ${d.breakfast.name} | L: ${d.lunch.name} | D: ${d.dinner.name}  ` +
      `→ ${d.totalCalories} kcal, ${d.totalProtein}g protein`
    ).join('\n');

  return `You are a friendly, knowledgeable meal planning assistant embedded in the user's dashboard.

Current meal plan (Week ${plan.weekId}):
${dayLines}

User profile:
- Diet: vegetarian  |  Age: ${p.age}
- Weight: ${p.weight ?? '?'}kg  |  Height: ${p.height ?? '?'}cm
- Workout schedule: Gym ${Object.entries(p.workoutSchedule).filter(([,v])=>v==='gym').map(([k])=>k).join('/')} | Run ${Object.entries(p.workoutSchedule).filter(([,v])=>v==='running').map(([k])=>k).join('/')} | Rest ${Object.entries(p.workoutSchedule).filter(([,v])=>v==='rest').map(([k])=>k).join('/')}
- Daily targets → Gym: ${p.dailyCalorieTargets?.gym} kcal / ${p.dailyProteinTargets?.gym}g protein | Run: ${p.dailyCalorieTargets?.running} kcal / ${p.dailyProteinTargets?.running}g | Rest: ${p.dailyCalorieTargets?.rest} kcal / ${p.dailyProteinTargets?.rest}g

You can:
- Answer any nutrition questions about the plan (protein, carbs, calories per day/meal)
- Explain any recipe's ingredients, prep time, or health benefits
- Shuffle a specific meal when the user asks (use the shuffle_meal function)
- Suggest swaps or give post-workout/rest-day advice
- Compare days, flag under/over targets, highlight the best meals

Be concise, warm, and accurate. Respond in plain text (no markdown bold/italic).
When you shuffle a meal, confirm the old → new swap clearly.`;
}

// ── Gemini function declarations ──────────────────────────────────────────
const geminiTools = [{
  functionDeclarations: [
    {
      name: 'shuffle_meal',
      description: 'Replace a specific meal slot with a random alternative from the recipe bank',
      parameters: {
        type: 'OBJECT',
        properties: {
          day:      { type: 'STRING', enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
          mealType: { type: 'STRING', enum: ['breakfast','lunch','dinner'] },
        },
        required: ['day', 'mealType'],
      },
    },
    {
      name: 'get_day_detail',
      description: 'Get full nutrition breakdown for a specific day',
      parameters: {
        type: 'OBJECT',
        properties: {
          day: { type: 'STRING', description: 'e.g. Monday' },
        },
        required: ['day'],
      },
    },
  ],
}];

// ── Execute a Gemini function call ────────────────────────────────────────
async function execFn(name, args, plan) {
  if (name === 'shuffle_meal') {
    const r = await manageMealPlan({ operation: 'shuffle', day: args.day, mealType: args.mealType });
    return { success: r.success, message: r.message };
  }
  if (name === 'get_day_detail') {
    const d = plan.days[args.day];
    if (!d) return { error: `Day "${args.day}" not found` };
    return {
      day: args.day, workoutType: d.workoutType,
      breakfast: { name: d.breakfast.name, ...d.breakfast.macros },
      lunch:     { name: d.lunch.name,     ...d.lunch.macros },
      dinner:    { name: d.dinner.name,    ...d.dinner.macros },
      totals:    { calories: d.totalCalories, protein: d.totalProtein, carbs: d.totalCarbs, fat: d.totalFat },
      targets:   { calories: d.calorieTarget, protein: d.proteinTarget },
    };
  }
  return { error: `Unknown function: ${name}` };
}

// ── GET / — serve dashboard ───────────────────────────────────────────────
app.get('/', async (req, res) => {
  try {
    if (!fs.existsSync(PLAN_FILE)) await manageMealPlan({ operation: 'create' });
    const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'));
    const html = generateDashboardHTML(plan, RECIPE_BANK);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send(`<pre>Server error: ${err.message}</pre>`);
  }
});

// ── GET /api/plan — return current plan JSON (for post-shuffle refresh) ───
app.get('/api/plan', (req, res) => {
  if (!fs.existsSync(PLAN_FILE)) return res.status(404).json({ error: 'No plan' });
  res.json(JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')));
});

// ── POST /api/chat — multi-turn Gemini chat with function calling ─────────
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set in .env' });
  if (!fs.existsSync(PLAN_FILE)) return res.status(404).json({ error: 'No meal plan. Open http://localhost:3000 first.' });

  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'));

  // Get or create session history
  const sid = sessionId || Math.random().toString(36).slice(2);
  if (!sessions.has(sid)) sessions.set(sid, []);
  const history = sessions.get(sid);

  try {
    const genAI  = new GoogleGenerativeAI(key);
    const model  = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: buildSystemPrompt(plan),
      tools: geminiTools,
    });

    const chat = model.startChat({ history: [...history] });
    let result = await chat.sendMessage(message);
    let planUpdated = false;

    // Function call loop
    while (result.response.functionCalls()?.length) {
      const responses = [];
      for (const call of result.response.functionCalls()) {
        const fnResult = await execFn(call.name, call.args, plan);
        if (call.name === 'shuffle_meal' && fnResult.success) planUpdated = true;
        responses.push({ functionResponse: { name: call.name, response: fnResult } });
      }
      result = await chat.sendMessage(responses);
    }

    const reply = result.response.text();

    // Persist turn to session
    history.push({ role: 'user',  parts: [{ text: message }] });
    history.push({ role: 'model', parts: [{ text: reply }] });

    res.json({ reply, sessionId: sid, planUpdated });
  } catch (err) {
    console.error('[chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🍽️  Meal Planner  →  http://localhost:${PORT}`);
  console.log(`💬  Chat          →  Gemini-3.1-flash-lite-preview`);
  console.log(`📋  Logs          →  logs/mcp-calls.jsonl\n`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${PORT} is already in use.`);
    console.error(`    Kill whatever is on it, or run on a different port:`);
    console.error(`    PORT=3001 node server.mjs\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
