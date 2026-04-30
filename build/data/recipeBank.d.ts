import type { Recipe } from '../types.js';
export declare const RECIPE_BANK: Recipe[];
export declare function getRecipes(mealType: string, cuisine?: string, tags?: string[]): Recipe[];
export declare function getRecipeById(id: string): Recipe | undefined;
export declare function getAlternatives(current: Recipe, count?: number): Recipe[];
