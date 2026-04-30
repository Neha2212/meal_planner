import type { MealPlan, DayPlan, Recipe, ManageMealPlanInput } from '../types.js';
export declare function manageMealPlan(input: ManageMealPlanInput): Promise<{
    success: boolean;
    message: string;
    data?: MealPlan | DayPlan | Recipe;
}>;
export declare const manageMealPlanToolDef: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            operation: {
                type: string;
                enum: string[];
                description: string;
            };
            day: {
                type: string;
                enum: string[];
                description: string;
            };
            mealType: {
                type: string;
                enum: string[];
                description: string;
            };
            recipeId: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
