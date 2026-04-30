/**
 * Gemini-powered shopping list generator.
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node shopping-list.mjs
 *
 * What it does:
 *   1. Reads the current meal_plan.json
 *   2. Extracts all ingredients from the week
 *   3. Calls Gemini to deduplicate, group by aisle, and add quantities
 *   4. Prints a formatted grocery list
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN_FILE  = path.join(__dirname, 'data', 'meal_plan.json');

// ── Check plan exists ─────────────────────────────────────────────────────
if (!fs.existsSync(PLAN_FILE)) {
  console.error('❌ No meal_plan.json found. Run `node preview.mjs` first.');
  process.exit(1);
}

// ── Check API key ─────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY. Set it in your .env file or export it:');
  console.error('   export GEMINI_API_KEY=your_key_here');
  console.error('   node shopping-list.mjs');
  process.exit(1);
}

// ── Collect all ingredients from plan ────────────────────────────────────
const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'));
const ingredientCounts = {};

for (const [dayName, day] of Object.entries(plan.days)) {
  for (const mealType of ['breakfast', 'lunch', 'dinner']) {
    const meal = day[mealType];
    if (!meal) continue;
    for (const ing of meal.ingredients) {
      const key = ing.toLowerCase().trim();
      ingredientCounts[key] = (ingredientCounts[key] || 0) + 1;
    }
  }
}

const ingredientList = Object.entries(ingredientCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, count]) => `${name} (used in ${count} meal${count > 1 ? 's' : ''})`)
  .join('\n');

const uniqueCount = Object.keys(ingredientCounts).length;
const dayCount    = Object.keys(plan.days).length;
console.log(`📦 Found ${uniqueCount} unique ingredients across ${dayCount} days.\n`);
console.log('🤖 Calling Gemini to generate smart shopping list...\n');

// ── Call Gemini ───────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

const prompt = `You are a helpful meal prep assistant. I have a week of vegetarian meals planned.
Here are all the raw ingredients I need (with how many meals each is used in):

${ingredientList}

Please create a well-organised grocery shopping list that:
1. Groups ingredients by supermarket aisle/category (Produce, Dairy, Grains & Bread, Legumes & Canned, Nuts & Seeds, Condiments, Spices & Dry)
2. Consolidates duplicates and similar items (e.g. "tomato" and "cherry tomatoes" → "tomatoes")
3. Suggests approximate quantities based on typical recipe servings (for 1 person, 1 week)
4. Marks items likely already in a well-stocked pantry with (pantry)
5. Adds any common items you'd recommend based on the cuisine mix (Indian, Chinese, Italian)

Format it as a clean, easy-to-read list. Use emoji category headers.`;

// ── Log request ───────────────────────────────────────────────────────────
const LOG_DIR  = new URL('./logs', import.meta.url).pathname;
const LOG_FILE = path.join(LOG_DIR, 'mcp-calls.jsonl');
function appendLog(entry) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch {}
}
const reqEntry = {
  ts: new Date().toISOString(), level: 'info', type: 'llm-request',
  tool: 'gemini-3.1-flash-lite-preview',
  input: { ingredientCount: uniqueCount, promptChars: prompt.length },
};
appendLog(reqEntry);
console.log(`[LOG] ${reqEntry.ts} llm-request → gemini-3.1-flash-lite-preview (${prompt.length} chars)`);

const callStart = Date.now();
const result = await model.generateContent(prompt);
const shoppingList = result.response.text();
const durationMs = Date.now() - callStart;

const resEntry = {
  ts: new Date().toISOString(), level: 'info', type: 'llm-response',
  tool: 'gemini-3.1-flash-lite-preview',
  output: { responseChars: shoppingList.length },
  durationMs,
};
appendLog(resEntry);
console.log(`[LOG] ${resEntry.ts} llm-response ← ${shoppingList.length} chars in ${durationMs}ms\n`);

// ── Output ────────────────────────────────────────────────────────────────
console.log('═'.repeat(60));
console.log('🛒  WEEKLY SHOPPING LIST  (AI-enhanced by Gemini)');
console.log('═'.repeat(60));
console.log(shoppingList);
console.log('═'.repeat(60));

// Also save to file
const outFile = path.join(__dirname, 'shopping-list.txt');
fs.writeFileSync(outFile, `WEEKLY SHOPPING LIST\nGenerated: ${new Date().toLocaleString()}\n\n${shoppingList}\n`);
console.log(`\n✅ Saved to shopping-list.txt`);
