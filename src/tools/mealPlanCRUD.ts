import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RECIPE_BANK, getRecipes, getAlternatives } from '../data/recipeBank.js';
import type { MealPlan, DayPlan, Recipe, MealType, WorkoutType, ManageMealPlanInput, UserProfile } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const PLAN_FILE = path.join(DATA_DIR, 'meal_plan.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'user_settings.json');

// ─── Load user settings from file (falls back to sensible defaults) ──────

function loadUserSettings(): Partial<UserProfile> {
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Partial<UserProfile>;
  } catch {
    return {};
  }
}

function buildProfile(): UserProfile {
  const saved = loadUserSettings();
  const weight = saved.weight ?? 70;
  const height = saved.height ?? 168;
  return {
    diet: 'vegetarian',
    cuisinePreferences: ['indian', 'chinese', 'italian'],
    spiceLevel: 'medium',
    fitnessGoal: 'protein-rich, muscle maintenance',
    age: 30,
    weight,
    height,
    workoutSchedule: saved.workoutSchedule ?? {
      Monday: 'gym',
      Tuesday: 'running',
      Wednesday: 'gym',
      Thursday: 'rest',
      Friday: 'gym',
      Saturday: 'running',
      Sunday: 'rest',
    },
    dailyCalorieTargets: saved.dailyCalorieTargets ?? {
      gym: Math.round(weight * 32),
      running: Math.round(weight * 29),
      rest: Math.round(weight * 25),
    },
    dailyProteinTargets: saved.dailyProteinTargets ?? {
      gym: Math.round(weight * 2.0),
      running: Math.round(weight * 1.7),
      rest: Math.round(weight * 1.4),
    },
  };
}

// ─── File helpers ─────────────────────────────────────────────────────────

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readPlan(): MealPlan | null {
  ensureDataDir();
  if (!fs.existsSync(PLAN_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8')) as MealPlan;
  } catch {
    return null;
  }
}

function writePlan(plan: MealPlan): void {
  ensureDataDir();
  plan.updatedAt = new Date().toISOString();
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf-8');
}

// ─── Week utilities ───────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getDateForDay(dayName: string): string {
  const today = new Date();
  const todayDay = today.getDay(); // 0 = Sunday
  const targetDay = DAYS.indexOf(dayName) + 1; // 1 = Monday
  const diff = targetDay - (todayDay === 0 ? 7 : todayDay);
  const date = new Date(today);
  date.setDate(today.getDate() + diff);
  return date.toISOString().split('T')[0];
}

// ─── Smart recipe selector ────────────────────────────────────────────────

function selectRecipe(
  mealType: MealType,
  workoutType: WorkoutType,
  usedIds: Set<string>,
  cuisinePreference?: string
): Recipe {
  // Tag preferences by workout
  const preferredTags: Record<WorkoutType, string[]> = {
    gym: ['high-protein', 'gym-day'],
    running: ['carb-boost', 'running-day', 'high-carb'],
    rest: ['rest-day', 'light'],
  };

  // Cuisine rotation weights (Indian ~60%, Italian ~25%, Chinese ~15%)
  const cuisinePool: Array<'indian' | 'chinese' | 'italian'> =
    cuisinePreference
      ? [cuisinePreference as any]
      : ['indian', 'indian', 'indian', 'italian', 'italian', 'chinese'];
  const cuisine = cuisinePool[Math.floor(Math.random() * cuisinePool.length)];

  let pool = RECIPE_BANK.filter(r => {
    const rightMeal = r.mealType.includes(mealType);
    const rightCuisine = r.cuisine === cuisine;
    const notUsed = !usedIds.has(r.id);
    return rightMeal && rightCuisine && notUsed;
  });

  // Sort by tag match
  const tags = preferredTags[workoutType];
  pool.sort((a, b) => {
    const scoreA = a.tags.filter(t => tags.includes(t)).length;
    const scoreB = b.tags.filter(t => tags.includes(t)).length;
    return scoreB - scoreA;
  });

  // Fallback: ignore cuisine constraint if pool empty
  if (pool.length === 0) {
    pool = RECIPE_BANK.filter(r => r.mealType.includes(mealType) && !usedIds.has(r.id));
  }

  // Last resort: allow repeats
  if (pool.length === 0) {
    pool = RECIPE_BANK.filter(r => r.mealType.includes(mealType));
  }

  const chosen = pool[0];
  usedIds.add(chosen.id);
  return chosen;
}

function buildDayPlan(
  dayName: string,
  workoutType: WorkoutType,
  usedIds: Set<string>
): DayPlan {
  const profile = buildProfile();

  const breakfast = selectRecipe('breakfast', workoutType, usedIds);
  const lunch = selectRecipe('lunch', workoutType, usedIds);
  const dinner = selectRecipe('dinner', workoutType, usedIds);

  const totalCalories = breakfast.macros.calories + lunch.macros.calories + dinner.macros.calories;
  const totalProtein = breakfast.macros.protein + lunch.macros.protein + dinner.macros.protein;
  const totalCarbs = breakfast.macros.carbs + lunch.macros.carbs + dinner.macros.carbs;
  const totalFat = breakfast.macros.fat + lunch.macros.fat + dinner.macros.fat;

  return {
    date: getDateForDay(dayName),
    dayOfWeek: dayName,
    workoutType,
    calorieTarget: profile.dailyCalorieTargets[workoutType],
    proteinTarget: profile.dailyProteinTargets[workoutType],
    breakfast,
    lunch,
    dinner,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
  };
}

// ─── CRUD operations ──────────────────────────────────────────────────────

export async function manageMealPlan(input: ManageMealPlanInput): Promise<{
  success: boolean;
  message: string;
  data?: MealPlan | DayPlan | Recipe;
}> {
  const { operation, day, mealType, recipeId } = input;

  switch (operation) {

    // CREATE — build a full week plan
    case 'create': {
      const usedIds = new Set<string>();
      const days: Record<string, DayPlan> = {};

      const profile = buildProfile();
      for (const dayName of DAYS) {
        const workoutType = profile.workoutSchedule[dayName] as WorkoutType;
        days[dayName] = buildDayPlan(dayName, workoutType, usedIds);
      }

      const plan: MealPlan = {
        weekId: getWeekId(),
        startDate: getDateForDay('Monday'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userProfile: profile,
        days,
      };

      writePlan(plan);
      return {
        success: true,
        message: `✅ Created meal plan for week ${plan.weekId} with 7 days × 3 meals = 21 meals. Saved to meal_plan.json.`,
        data: plan,
      };
    }

    // READ — return current plan
    case 'read': {
      const plan = readPlan();
      if (!plan) {
        return {
          success: false,
          message: 'No meal plan found. Run create first.',
        };
      }
      return {
        success: true,
        message: `📖 Loaded plan for week ${plan.weekId}. Last updated: ${plan.updatedAt}`,
        data: plan,
      };
    }

    // UPDATE — swap one specific meal
    case 'update': {
      if (!day || !mealType || !recipeId) {
        return { success: false, message: 'update requires: day, mealType, recipeId' };
      }
      const plan = readPlan();
      if (!plan) return { success: false, message: 'No plan to update. Run create first.' };

      const recipe = RECIPE_BANK.find(r => r.id === recipeId);
      if (!recipe) return { success: false, message: `Recipe ${recipeId} not found.` };

      const dayPlan = plan.days[day];
      if (!dayPlan) return { success: false, message: `Day "${day}" not in plan.` };

      const old = dayPlan[mealType];
      (dayPlan as any)[mealType] = recipe;

      // Recompute day totals
      dayPlan.totalCalories = dayPlan.breakfast.macros.calories + dayPlan.lunch.macros.calories + dayPlan.dinner.macros.calories;
      dayPlan.totalProtein = dayPlan.breakfast.macros.protein + dayPlan.lunch.macros.protein + dayPlan.dinner.macros.protein;
      dayPlan.totalCarbs = dayPlan.breakfast.macros.carbs + dayPlan.lunch.macros.carbs + dayPlan.dinner.macros.carbs;
      dayPlan.totalFat = dayPlan.breakfast.macros.fat + dayPlan.lunch.macros.fat + dayPlan.dinner.macros.fat;

      writePlan(plan);
      return {
        success: true,
        message: `✏️ Updated ${day} ${mealType}: "${old.name}" → "${recipe.name}"`,
        data: dayPlan,
      };
    }

    // DELETE — clear a specific meal, day, or entire plan
    case 'delete': {
      const plan = readPlan();
      if (!plan) return { success: false, message: 'No plan to delete.' };

      if (!day) {
        // Delete entire plan
        fs.unlinkSync(PLAN_FILE);
        return { success: true, message: '🗑️ Deleted entire meal plan.' };
      }

      if (!mealType) {
        // Delete entire day
        delete plan.days[day];
        writePlan(plan);
        return { success: true, message: `🗑️ Removed ${day} from meal plan.` };
      }

      // This shouldn't delete a single meal — replace with a random alternative
      const dayPlan = plan.days[day];
      const current = dayPlan[mealType] as Recipe;
      const alternatives = getAlternatives(current, 1);
      if (alternatives.length > 0) {
        (dayPlan as any)[mealType] = alternatives[0];
        writePlan(plan);
        return {
          success: true,
          message: `♻️ Replaced ${day} ${mealType} with "${alternatives[0].name}".`,
        };
      }
      return { success: false, message: 'No alternative found to replace with.' };
    }

    // SHUFFLE — pick a fresh alternative for a slot
    case 'shuffle': {
      if (!day || !mealType) {
        return { success: false, message: 'shuffle requires: day, mealType' };
      }
      const plan = readPlan();
      if (!plan) return { success: false, message: 'No plan found. Run create first.' };

      const dayPlan = plan.days[day];
      const current = dayPlan[mealType] as Recipe;

      // Get all other recipes for this meal type, excluding current
      const pool = RECIPE_BANK.filter(
        r => r.mealType.includes(mealType as MealType) && r.id !== current.id
      );

      if (pool.length === 0) {
        return { success: false, message: `No alternatives found for ${mealType}.` };
      }

      const newRecipe = pool[Math.floor(Math.random() * pool.length)];
      (dayPlan as any)[mealType] = newRecipe;

      // Recompute totals
      dayPlan.totalCalories = dayPlan.breakfast.macros.calories + dayPlan.lunch.macros.calories + dayPlan.dinner.macros.calories;
      dayPlan.totalProtein = dayPlan.breakfast.macros.protein + dayPlan.lunch.macros.protein + dayPlan.dinner.macros.protein;

      writePlan(plan);
      return {
        success: true,
        message: `🔀 Shuffled ${day} ${mealType}: "${current.name}" → "${newRecipe.name}"`,
        data: newRecipe,
      };
    }

    default:
      return { success: false, message: `Unknown operation: ${operation}` };
  }
}

// ─── Tool definition for MCP ─────────────────────────────────────────────

export const manageMealPlanToolDef = {
  name: 'manage_meal_plan',
  description:
    'CRUD + shuffle operations on the local meal_plan.json file. ' +
    'create: builds a full 7-day protein-rich vegetarian plan with workout-aware meals. ' +
    'read: loads current plan. ' +
    'update: swaps a specific meal by recipeId. ' +
    'delete: removes day or full plan. ' +
    'shuffle: picks a random alternative for a given meal slot.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'read', 'update', 'delete', 'shuffle'],
        description: 'The CRUD operation to perform.',
      },
      day: {
        type: 'string',
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        description: 'Day of the week (required for update/delete/shuffle).',
      },
      mealType: {
        type: 'string',
        enum: ['breakfast', 'lunch', 'dinner'],
        description: 'Meal type (required for update/shuffle).',
      },
      recipeId: {
        type: 'string',
        description: 'Recipe ID to swap in (required for update).',
      },
    },
    required: ['operation'],
  },
};
