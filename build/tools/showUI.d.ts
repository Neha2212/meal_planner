import type { MealPlan, Recipe } from '../types.js';
export declare function generateDashboardHTML(plan: MealPlan, recipeBank?: Recipe[]): string;
export declare const showUIToolDef: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            theme: {
                type: string;
                enum: string[];
                description: string;
            };
        };
        required: never[];
    };
};
