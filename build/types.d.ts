export type Cuisine = 'indian' | 'chinese' | 'italian';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type WorkoutType = 'gym' | 'running' | 'rest';
export type SpiceLevel = 'mild' | 'medium' | 'hot';
export interface Macros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}
export interface Recipe {
    id: string;
    name: string;
    cuisine: Cuisine;
    mealType: MealType[];
    prepTime: number;
    macros: Macros;
    spiceLevel: SpiceLevel;
    ingredients: string[];
    description: string;
    tags: string[];
    emoji: string;
    imageUrl?: string;
}
export interface DayPlan {
    date: string;
    dayOfWeek: string;
    workoutType: WorkoutType;
    calorieTarget: number;
    proteinTarget: number;
    breakfast: Recipe;
    lunch: Recipe;
    dinner: Recipe;
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
}
export interface UserProfile {
    diet: string;
    cuisinePreferences: Cuisine[];
    spiceLevel: SpiceLevel;
    fitnessGoal: string;
    workoutSchedule: Record<string, WorkoutType>;
    age: number;
    weight?: number;
    height?: number;
    dailyCalorieTargets: Record<WorkoutType, number>;
    dailyProteinTargets: Record<WorkoutType, number>;
}
export interface MealPlan {
    weekId: string;
    startDate: string;
    createdAt: string;
    updatedAt: string;
    userProfile: UserProfile;
    days: Record<string, DayPlan>;
}
export interface FetchRecipesInput {
    mealType: MealType;
    cuisine?: Cuisine;
    count?: number;
    preferHighProtein?: boolean;
    query?: string;
}
export interface ManageMealPlanInput {
    operation: 'create' | 'read' | 'update' | 'delete' | 'shuffle';
    day?: string;
    mealType?: MealType;
    recipeId?: string;
}
export interface ShowUIInput {
    theme?: 'dark' | 'light';
}
