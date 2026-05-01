/**
 * Local server that serves the meal planner dashboard and provides
 * a Gemini-powered chat that uses the MCP client to call the MCP server tools.
 *
 * Architecture:
 *   Browser → POST /api/chat → server.mjs (MCP Client + Gemini)
 *                                   └── spawns build/index.js (MCP Server)
 *                                         ├── manage_meal_plan
 *                                         ├── fetch_recipes
 *                                         └── show_meal_plan_ui
 *
 * Usage:  node server.mjs
 * Opens:  http://localhost:3000
 */

import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { generateDashboardHTML } from './build/tools/showUI.js';
import { RECIPE_BANK } from './build/data/recipeBank.js';
import { manageMealPlan } from './build/tools/mealPlanCRUD.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN_FILE  = path.join(__dirname, 'data', 'meal_plan.json');
const LOG_DIR    = path.join(__dirname, 'logs');
const LOG_FILE   = path.join(LOG_DIR, 'mcp-calls.jsonl');
const PORT       = parseInt(process.env.PORT || '3000', 10);

// ── Logger ────────────────────────────────────────────────────────────────
function writeLog(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  console.error('[LOG]', line);
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    console.error('[LOG write error]', e.message);
  }
}

// ── MCP Client ────────────────────────────────────────────────────────────
let mcpClient = null;
let mcpToolDefs = [];   // raw MCP tool definitions
let geminiTools = [];   // converted for Gemini function calling

/** Convert MCP JSON Schema to Gemini-compatible format:
 *  - uppercase type strings
 *  - strip fields Gemini doesn't accept ($schema, additionalProperties)
 */
function convertSchemaTypes(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const STRIP = new Set(['$schema', 'additionalProperties']);
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (STRIP.has(k)) continue;
    if (k === 'type' && typeof v === 'string') { out[k] = v.toUpperCase(); continue; }
    if (k === 'properties' && typeof v === 'object') {
      out[k] = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, convertSchemaTypes(pv)]));
      continue;
    }
    if (k === 'items') { out[k] = convertSchemaTypes(v); continue; }
    out[k] = v;
  }
  return out;
}

async function initMCPClient() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, 'build/index.js')],
    env: { ...process.env },
  });

  mcpClient = new Client({ name: 'dashboard-chat-client', version: '1.0.0' }, { capabilities: {} });
  await mcpClient.connect(transport);

  const { tools } = await mcpClient.listTools();
  mcpToolDefs = tools;

  // Build Gemini-compatible function declarations from MCP tool schemas
  geminiTools = [{
    functionDeclarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: convertSchemaTypes(t.inputSchema),
    })),
  }];

  writeLog({ level: 'info', type: 'system', output: `MCP client connected — tools: ${tools.map(t => t.name).join(', ')}` });
  console.log(`🔌 MCP client connected — tools: ${tools.map(t => t.name).join(', ')}`);
}

/** Forward a Gemini function call to the MCP server and return the result */
async function callMCPTool(name, args) {
  writeLog({ level: 'info', type: 'mcp-tool-call', tool: name, input: args });
  const start = Date.now();
  try {
    const result = await mcpClient.callTool({ name, arguments: args });
    const text = result.content?.map(c => c.text).join('\n') ?? '';
    writeLog({ level: 'info', type: 'mcp-tool-result', tool: name, output: { chars: text.length }, durationMs: Date.now() - start });
    // Return parsed JSON if possible, otherwise raw text
    try { return JSON.parse(text); } catch { return { result: text }; }
  } catch (err) {
    writeLog({ level: 'error', type: 'mcp-tool-result', tool: name, error: err.message, durationMs: Date.now() - start });
    return { error: err.message };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────
function buildSystemPrompt(plan) {
  const p = plan.userProfile;
  const dayLines = Object.entries(plan.days)
    .map(([day, d]) =>
      `  ${day.padEnd(9)} [${d.workoutType.padEnd(7)}] ` +
      `B: ${d.breakfast.name} | L: ${d.lunch.name} | D: ${d.dinner.name}  ` +
      `→ ${d.totalCalories} kcal, ${d.totalProtein}g protein`
    ).join('\n');

  return `You are a friendly meal planning assistant embedded in the user's dashboard.
You have access to MCP tools to read/update the meal plan and fetch new recipes.

Current meal plan (Week ${plan.weekId}):
${dayLines}

User profile:
- Diet: vegetarian  |  Age: ${p.age}
- Weight: ${p.weight ?? '?'}kg  |  Height: ${p.height ?? '?'}cm
- Gym days: ${Object.entries(p.workoutSchedule).filter(([,v])=>v==='gym').map(([k])=>k).join(', ')}
- Run days: ${Object.entries(p.workoutSchedule).filter(([,v])=>v==='running').map(([k])=>k).join(', ')}
- Rest days: ${Object.entries(p.workoutSchedule).filter(([,v])=>v==='rest').map(([k])=>k).join(', ')}
- Targets → Gym: ${p.dailyCalorieTargets?.gym} kcal/${p.dailyProteinTargets?.gym}g | Run: ${p.dailyCalorieTargets?.running} kcal/${p.dailyProteinTargets?.running}g | Rest: ${p.dailyCalorieTargets?.rest} kcal/${p.dailyProteinTargets?.rest}g

Use the MCP tools when the user asks to modify the plan, fetch recipes, or show the dashboard.
For read-only questions (nutrition, ingredients, advice), answer directly from the context above.
Be concise, warm, and accurate. Respond in plain text.`;
}

// ── Express app ───────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// In-memory conversation sessions
const sessions = new Map();

// GET / — serve dashboard
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

// GET /api/plan — current plan as JSON
app.get('/api/plan', (req, res) => {
  if (!fs.existsSync(PLAN_FILE)) return res.status(404).json({ error: 'No plan' });
  res.json(JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')));
});

// POST /api/chat — Gemini chat using MCP tools
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set in .env' });
  if (!mcpClient) return res.status(500).json({ error: 'MCP client not ready yet' });
  if (!fs.existsSync(PLAN_FILE)) return res.status(404).json({ error: 'No meal plan. Refresh the page first.' });

  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'));
  const sid = sessionId || Math.random().toString(36).slice(2);
  if (!sessions.has(sid)) sessions.set(sid, []);
  const history = sessions.get(sid);

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: buildSystemPrompt(plan),
      tools: geminiTools,
    });

    const chat = model.startChat({ history: [...history] });

    writeLog({ level: 'info', type: 'llm-request', tool: 'gemini-3.1-flash-lite-preview',
      input: { message, sessionId: sid, historyLength: history.length } });
    const callStart = Date.now();

    let result = await chat.sendMessage(message);
    let planUpdated = false;

    // Function call loop — forwards each Gemini function call to the MCP server
    while (result.response.functionCalls()?.length) {
      const responses = [];
      for (const call of result.response.functionCalls()) {
        const fnResult = await callMCPTool(call.name, call.args);
        // Detect plan mutations
        if (['manage_meal_plan'].includes(call.name) && fnResult?.success) planUpdated = true;
        responses.push({ functionResponse: { name: call.name, response: fnResult } });
      }
      result = await chat.sendMessage(responses);
    }

    const reply = result.response.text();
    writeLog({ level: 'info', type: 'llm-response', tool: 'gemini-3.1-flash-lite-preview',
      output: { replyChars: reply.length, planUpdated }, durationMs: Date.now() - callStart });

    history.push({ role: 'user',  parts: [{ text: message }] });
    history.push({ role: 'model', parts: [{ text: reply }] });

    res.json({ reply, sessionId: sid, planUpdated });
  } catch (err) {
    console.error('[chat]', err.message);
    writeLog({ level: 'error', type: 'llm-response', tool: 'gemini-3.1-flash-lite-preview', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────
async function main() {
  await initMCPClient();

  app.listen(PORT, () => {
    console.log(`\n🍽️  Meal Planner  →  http://localhost:${PORT}`);
    console.log(`🔌  MCP tools     →  ${mcpToolDefs.map(t => t.name).join(', ')}`);
    console.log(`💬  Chat model    →  gemini-3.1-flash-lite-preview`);
    console.log(`📋  Logs          →  logs/mcp-calls.jsonl\n`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌  Port ${PORT} is already in use.`);
      console.error(`    Kill it or use a different port: PORT=3001 node server.mjs\n`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
