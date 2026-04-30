import { getRecipes } from '../data/recipeBank.js';
const SPOONACULAR_BASE = 'https://api.spoonacular.com/recipes';
// Map Spoonacular response → internal Recipe format
function mapSpoonacularRecipe(data, mealType) {
    const nutrition = data.nutrition?.nutrients || [];
    const get = (name) => Math.round(nutrition.find((n) => n.name === name)?.amount || 0);
    return {
        id: `spoon-${data.id}`,
        name: data.title,
        cuisine: data.cuisines?.[0]?.toLowerCase() || 'indian',
        mealType: [mealType],
        prepTime: data.readyInMinutes || 30,
        macros: {
            calories: get('Calories'),
            protein: get('Protein'),
            carbs: get('Carbohydrates'),
            fat: get('Fat'),
        },
        spiceLevel: 'medium',
        ingredients: (data.extendedIngredients || []).map((i) => i.name),
        description: data.summary
            ? data.summary.replace(/<[^>]*>/g, '').slice(0, 120) + '...'
            : data.title,
        tags: ['api-fetched'],
        emoji: '🍽️',
        imageUrl: data.image,
    };
}
async function fetchFromSpoonacular(input, apiKey) {
    const params = new URLSearchParams({
        apiKey,
        diet: 'vegetarian',
        number: String(input.count || 8),
        addRecipeNutrition: 'true',
        minProtein: input.preferHighProtein ? '20' : '10',
        maxReadyTime: '60',
        instructionsRequired: 'true',
    });
    if (input.cuisine)
        params.set('cuisine', input.cuisine);
    if (input.query)
        params.set('query', input.query);
    // meal type maps to Spoonacular's type param
    const typeMap = {
        breakfast: 'breakfast',
        lunch: 'main course',
        dinner: 'main course',
    };
    params.set('type', typeMap[input.mealType] || 'main course');
    const url = `${SPOONACULAR_BASE}/complexSearch?${params}`;
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`Spoonacular error: ${res.status}`);
    const json = await res.json();
    return (json.results || []).map((r) => mapSpoonacularRecipe(r, input.mealType));
}
// ─── Main export ──────────────────────────────────────────────────────────
export async function fetchRecipes(input) {
    const apiKey = process.env.SPOONACULAR_API_KEY;
    // Try Spoonacular first
    if (apiKey) {
        try {
            const recipes = await fetchFromSpoonacular(input, apiKey);
            if (recipes.length > 0) {
                return {
                    recipes,
                    source: 'api',
                    message: `Fetched ${recipes.length} recipes from Spoonacular API.`,
                };
            }
        }
        catch (err) {
            console.error('[fetchRecipes] Spoonacular failed, using local bank:', err);
        }
    }
    // Fallback: local recipe bank
    const localRecipes = getRecipes(input.mealType, input.cuisine, input.preferHighProtein ? ['high-protein'] : undefined);
    // Shuffle and limit
    const shuffled = localRecipes.sort(() => Math.random() - 0.5);
    const count = input.count || 8;
    const results = shuffled.slice(0, count);
    return {
        recipes: results,
        source: 'local',
        message: `Loaded ${results.length} curated vegetarian recipes from local bank.${!apiKey ? ' (Set SPOONACULAR_API_KEY in .env to use live API.)' : ''}`,
    };
}
// ─── Tool definition for MCP ─────────────────────────────────────────────
export const fetchRecipesToolDef = {
    name: 'fetch_recipes',
    description: 'Fetches vegetarian protein-rich recipes for a given meal type and cuisine. ' +
        'Uses Spoonacular API if configured, otherwise falls back to curated local recipe bank. ' +
        'Recipes are filtered for vegetarian diet, medium spice, Indian/Chinese/Italian cuisines.',
    inputSchema: {
        type: 'object',
        properties: {
            mealType: {
                type: 'string',
                enum: ['breakfast', 'lunch', 'dinner'],
                description: 'The meal type to fetch recipes for.',
            },
            cuisine: {
                type: 'string',
                enum: ['indian', 'chinese', 'italian'],
                description: 'Optional: filter by cuisine.',
            },
            count: {
                type: 'number',
                description: 'Number of recipes to return (default 8).',
            },
            preferHighProtein: {
                type: 'boolean',
                description: 'If true, prefer recipes with 20g+ protein.',
            },
            query: {
                type: 'string',
                description: 'Optional keyword search e.g. "paneer", "tofu stir fry".',
            },
        },
        required: ['mealType'],
    },
};
//# sourceMappingURL=fetchRecipes.js.map