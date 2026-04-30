import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchRecipes, fetchRecipesToolDef } from './tools/fetchRecipes.js';
import { manageMealPlan, manageMealPlanToolDef } from './tools/mealPlanCRUD.js';
import { generateDashboardHTML, showUIToolDef } from './tools/showUI.js';
import { log } from './logger.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ─── Create MCP Server ────────────────────────────────────────────────────
const server = new McpServer({
    name: 'meal-planner-mcp',
    version: '1.0.0',
    description: 'Vegetarian protein-rich weekly meal planner with gym/run schedule awareness. ' +
        'Fetches recipes, manages a local meal_plan.json, and renders a Prefab UI dashboard.',
});
// ─── Tool 1: fetch_recipes ────────────────────────────────────────────────
server.tool(fetchRecipesToolDef.name, fetchRecipesToolDef.description, {
    mealType: z.enum(['breakfast', 'lunch', 'dinner']),
    cuisine: z.enum(['indian', 'chinese', 'italian']).optional(),
    count: z.number().min(1).max(20).optional(),
    preferHighProtein: z.boolean().optional(),
    query: z.string().optional(),
}, async (input) => {
    log({ level: 'info', type: 'mcp-tool-call', tool: 'fetch_recipes', input });
    const start = Date.now();
    try {
        const result = await fetchRecipes(input);
        const output = {
            message: result.message,
            source: result.source,
            count: result.recipes.length,
            recipes: result.recipes.map(r => ({
                id: r.id,
                name: r.name,
                cuisine: r.cuisine,
                mealType: r.mealType,
                prepTime: r.prepTime,
                calories: r.macros.calories,
                protein: r.macros.protein,
                spiceLevel: r.spiceLevel,
                tags: r.tags,
                emoji: r.emoji,
            })),
        };
        log({ level: 'info', type: 'mcp-tool-result', tool: 'fetch_recipes', output: { source: result.source, count: result.recipes.length }, durationMs: Date.now() - start });
        return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] };
    }
    catch (err) {
        log({ level: 'error', type: 'mcp-tool-result', tool: 'fetch_recipes', error: err.message, durationMs: Date.now() - start });
        return { content: [{ type: 'text', text: `Error fetching recipes: ${err.message}` }], isError: true };
    }
});
// ─── Tool 2: manage_meal_plan ─────────────────────────────────────────────
server.tool(manageMealPlanToolDef.name, manageMealPlanToolDef.description, {
    operation: z.enum(['create', 'read', 'update', 'delete', 'shuffle']),
    day: z
        .enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
        .optional(),
    mealType: z.enum(['breakfast', 'lunch', 'dinner']).optional(),
    recipeId: z.string().optional(),
}, async (input) => {
    log({ level: 'info', type: 'mcp-tool-call', tool: 'manage_meal_plan', input });
    const start = Date.now();
    try {
        const result = await manageMealPlan(input);
        const summary = result.data ? summarizePlan(result.data) : undefined;
        log({ level: 'info', type: 'mcp-tool-result', tool: 'manage_meal_plan', output: { success: result.success, message: result.message }, durationMs: Date.now() - start });
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ success: result.success, message: result.message, summary }, null, 2),
                }],
        };
    }
    catch (err) {
        log({ level: 'error', type: 'mcp-tool-result', tool: 'manage_meal_plan', error: err.message, durationMs: Date.now() - start });
        return { content: [{ type: 'text', text: `Error managing meal plan: ${err.message}` }], isError: true };
    }
});
// ─── Tool 3: show_meal_plan_ui ────────────────────────────────────────────
server.tool(showUIToolDef.name, showUIToolDef.description, {
    theme: z.enum(['dark', 'light']).optional(),
}, async (_input) => {
    log({ level: 'info', type: 'mcp-tool-call', tool: 'show_meal_plan_ui', input: _input });
    const start = Date.now();
    try {
        const planPath = path.join(__dirname, '../data/meal_plan.json');
        if (!fs.existsSync(planPath)) {
            log({ level: 'warn', type: 'mcp-tool-result', tool: 'show_meal_plan_ui', error: 'No meal plan found', durationMs: Date.now() - start });
            return {
                content: [{ type: 'text', text: '❌ No meal plan found. Please run manage_meal_plan with operation="create" first.' }],
            };
        }
        const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
        const html = generateDashboardHTML(plan);
        log({ level: 'info', type: 'mcp-tool-result', tool: 'show_meal_plan_ui', output: { htmlBytes: html.length }, durationMs: Date.now() - start });
        return {
            content: [
                { type: 'text', text: '✅ Meal plan dashboard generated! The UI has been pushed to your Prefab host.' },
                { type: 'resource', resource: { uri: 'ui://meal-planner/dashboard', mimeType: 'text/html;profile=mcp-app', text: html } },
            ],
        };
    }
    catch (err) {
        log({ level: 'error', type: 'mcp-tool-result', tool: 'show_meal_plan_ui', error: err.message, durationMs: Date.now() - start });
        return { content: [{ type: 'text', text: `Error generating UI: ${err.message}` }], isError: true };
    }
});
// ─── Helpers ──────────────────────────────────────────────────────────────
function summarizePlan(data) {
    if (!data?.days)
        return data;
    const days = Object.entries(data.days).map(([name, day]) => ({
        day: name,
        workout: day.workoutType,
        breakfast: day.breakfast?.name,
        lunch: day.lunch?.name,
        dinner: day.dinner?.name,
        totalCalories: day.totalCalories,
        totalProtein: `${day.totalProtein}g`,
    }));
    return { weekId: data.weekId, days };
}
// ─── Start server ─────────────────────────────────────────────────────────
async function main() {
    log({ level: 'info', type: 'system', output: 'MCP server starting' });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log({ level: 'info', type: 'system', output: 'MCP server connected and ready' });
    console.error('🍽️  Meal Planner MCP Server running on stdio');
    console.error('   Tools: fetch_recipes | manage_meal_plan | show_meal_plan_ui');
    console.error('   Logs:  logs/mcp-calls.jsonl');
}
main().catch((err) => {
    log({ level: 'error', type: 'system', error: String(err) });
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map