import { manageMealPlan } from './build/tools/mealPlanCRUD.js';
import { generateDashboardHTML } from './build/tools/showUI.js';
import { RECIPE_BANK } from './build/data/recipeBank.js';
import fs from 'fs';

// Step 1: create the meal plan
await manageMealPlan({ operation: 'create' });

// Step 2: read it back
const result = await manageMealPlan({ operation: 'read' });

// Step 3: generate the HTML and save it (pass recipe bank for client-side shuffle)
const html = generateDashboardHTML(result.data, RECIPE_BANK);
fs.writeFileSync('dashboard.html', html);

console.log('✅ Open dashboard.html in your browser!');
console.log('   Run: open dashboard.html');
