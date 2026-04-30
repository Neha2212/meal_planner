import type { Recipe, FetchRecipesInput } from '../types.js';
export declare function fetchRecipes(input: FetchRecipesInput): Promise<{
    recipes: Recipe[];
    source: 'api' | 'local';
    message: string;
}>;
export declare const fetchRecipesToolDef: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            mealType: {
                type: string;
                enum: string[];
                description: string;
            };
            cuisine: {
                type: string;
                enum: string[];
                description: string;
            };
            count: {
                type: string;
                description: string;
            };
            preferHighProtein: {
                type: string;
                description: string;
            };
            query: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
