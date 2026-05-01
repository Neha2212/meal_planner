# 🍽️ Meal Planner MCP Server

A production-ready MCP server for a **vegetarian, protein-rich weekly meal planner** with gym/run schedule awareness and a rich Prefab UI dashboard.

---

## ✨ Features

- **3 MCP Tools** covering all assignment requirements:
  - 🌐 `fetch_recipes` — internet (Spoonacular API + curated fallback)
  - 📁 `manage_meal_plan` — full CRUD on local `meal_plan.json`
  - 🖥️ `show_meal_plan_ui` — Prefab/MCP-UI interactive dashboard

- **Workout-aware meal planning** — gym days get high-protein picks, run days get carb-rich options, rest days get lighter comfort meals
- **40+ curated vegetarian recipes** across Indian 🇮🇳, Chinese 🇨🇳, and Italian 🇮🇹 cuisines
- **Shuffle any meal** — don't like Monday's lunch? Hit 🔀 and get a fresh pick
- **Detail cards** — see full nutrition, ingredients, and tags per meal
- **Macro progress bars** — daily calorie and protein targets vs. actuals
- Works without any API key (local recipe bank as fallback)

---

## 🧑‍💻 User Profile (hardcoded, customisable in `mealPlanCRUD.ts`)

| Setting | Value |
|---|---|
| Diet | Vegetarian |
| Age | 30 |
| Cuisines | Indian (primary), Chinese, Italian |
| Spice | Medium |
| Goal | Protein-rich, muscle maintenance |
| Schedule | Mon/Wed/Fri: Gym · Tue/Sat: Run · Thu/Sun: Rest |
| Gym cal target | 2500 kcal / 140g protein |
| Run cal target | 2300 kcal / 120g protein |
| Rest cal target | 2000 kcal / 100g protein |

---

## 🚀 Setup

### 1. Install dependencies

```bash
cd meal-planner-mcp
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Optionally add your SPOONACULAR_API_KEY
# Server works fine without it using the local recipe bank
```

### 3. Build

```bash
npm run build
```

### 4. Connect to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "meal-planner": {
      "command": "node",
      "args": ["/absolute/path/to/meal-planner-mcp/build/index.js"]
    }
  }
}
```

Restart Claude Desktop. You should see the 3 tools appear.

---


## 🛠️ Tool Reference

### `fetch_recipes`
```json
{
  "mealType": "lunch",
  "cuisine": "indian",
  "count": 5,
  "preferHighProtein": true,
  "query": "paneer"
}
```

### `manage_meal_plan`
```json
{ "operation": "create" }
{ "operation": "read" }
{ "operation": "shuffle", "day": "Wednesday", "mealType": "lunch" }
{ "operation": "update", "day": "Monday", "mealType": "dinner", "recipeId": "d-ind-001" }
{ "operation": "delete", "day": "Sunday" }
{ "operation": "delete" }
```

### `show_meal_plan_ui`
```json
{ "theme": "dark" }
```

---

## 📁 Project Structure

```
meal-planner-mcp/
├── src/
│   ├── index.ts              # MCP server, tool registration
│   ├── types.ts              # All TypeScript interfaces
│   ├── data/
│   │   └── recipeBank.ts     # 40+ curated vegetarian recipes
│   └── tools/
│       ├── fetchRecipes.ts   # Spoonacular API + local fallback
│       ├── mealPlanCRUD.ts   # CRUD + shuffle on meal_plan.json
│       └── showUI.ts         # Prefab HTML dashboard generator
├── data/
│   └── meal_plan.json        # Auto-created when plan is generated
├── build/                    # Compiled JS (after npm run build)
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 🎯 Prefab / MCP-UI Integration

The `show_meal_plan_ui` tool returns an MCP resource with:
- `uri: "ui://meal-planner/dashboard"`
- `mimeType: "text/html;profile=mcp-app"`

This follows the **MCP Apps Extension (SEP-1865)** standard supported by Claude Desktop, Goose, and other MCP-UI compatible hosts.

The HTML dashboard communicates shuffle intents back to the agent via:
1. `sendPrompt()` — Claude Desktop's native bridge
2. `window.parent.postMessage` — for iframe-based hosts (Chrome extension, webapp)

---

## 📝 License

MIT — share freely with attribution.
