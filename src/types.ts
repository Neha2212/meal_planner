export type Cuisine = 'indian' | 'chinese' | 'italian';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type WorkoutType = 'gym' | 'running' | 'rest';
export type SpiceLevel = 'mild' | 'medium' | 'hot';

export interface Macros {
  calories: number;
  protein: number;  // grams
  carbs: number;    // grams
  fat: number;      // grams
}

export interface Recipe {
  id: string;
  name: string;
  cuisine: Cuisine;
  mealType: MealType[];        // can work for multiple meal types
  prepTime: number;            // minutes
  macros: Macros;
  spiceLevel: SpiceLevel;
  ingredients: string[];
  description: string;
  tags: string[];              // e.g. ['high-protein', 'gym-day', 'quick']
  emoji: string;
  imageUrl?: string;           // Spoonacular image if fetched from API
}

export interface DayPlan {
  date: string;               // ISO date string e.g. "2025-04-28"
  dayOfWeek: string;          // "Monday"
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
  weight?: number;   // kg
  height?: number;   // cm
  dailyCalorieTargets: Record<WorkoutType, number>;
  dailyProteinTargets: Record<WorkoutType, number>;
}

export interface MealPlan {
  weekId: string;
  startDate: string;
  createdAt: string;
  updatedAt: string;
  userProfile: UserProfile;
  days: Record<string, DayPlan>;   // keyed by day name e.g. "Monday"
}

// Tool input types
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
