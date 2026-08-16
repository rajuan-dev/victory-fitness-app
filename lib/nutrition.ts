import { apiRequest } from './api';
import { fetchCachedResource, getCachedResourceSnapshot, primeCachedResource } from './resourceCache';
import { NUTRITION_PLAN_LATEST_CACHE_KEY } from './cacheKeys';

export type NutritionMealEntry = {
  name: string;
  desc: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  ingredients: string[];
  instructions: string[];
};

export type NutritionDayPlan = {
  day: string;
  breakfast: NutritionMealEntry;
  lunch: NutritionMealEntry;
  dinner: NutritionMealEntry;
};

export type NutritionShoppingItem = {
  name: string;
  qty: string;
};

export type NutritionShoppingSection = {
  category: string;
  items: NutritionShoppingItem[];
};

export type NutritionPlanApiResponse = {
  plan_id?: string | null;
  summary: string;
  goal_label: string;
  days: NutritionDayPlan[];
  shopping_list: NutritionShoppingSection[];
  meal_completions?: Record<string, Record<string, boolean>>;
  profile?: Record<string, unknown> | null;
};

export type NutritionPlanJobResponse = {
  job_id: string;
  status: 'queued' | 'processing' | 'generating_monday' | 'monday_ready' | 'completed' | 'failed' | string;
  plan_id?: string | null;
  plan?: NutritionPlanApiResponse | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
};

export type MealImageAnalysisResponse = {
  analysis_id?: string | null;
  meal_name_guess: string;
  summary: string;
  estimated_calories: number;
  estimated_protein: number;
  estimated_carbs: number;
  estimated_fat: number;
  confidence: string;
  notes: string[];
  file_name?: string | null;
  created_at?: string | null;
};

const MEAL_ANALYSIS_HISTORY_CACHE_KEY = 'meal-analysis-history';

export async function startNutritionPlanJob(payload: Record<string, unknown>) {
  return apiRequest<NutritionPlanJobResponse>('/ai/nutrition/plan/jobs', {
    method: 'POST',
    body: payload,
  });
}

export async function createNutritionPlan(payload: Record<string, unknown>) {
  return apiRequest<{ plan: NutritionPlanApiResponse }>('/ai/nutrition/plan', {
    method: 'POST',
    body: payload,
  });
}

export async function getNutritionPlanJob(jobId: string) {
  return apiRequest<NutritionPlanJobResponse>(`/ai/nutrition/plan/jobs/${encodeURIComponent(jobId)}`);
}

export async function startProgressiveNutritionPlanJob(payload: Record<string, unknown>) {
  return apiRequest<NutritionPlanJobResponse>('/ai/nutrition/plan/progressive/jobs', {
    method: 'POST',
    body: payload,
  });
}

export async function getProgressiveNutritionPlanJob(jobId: string) {
  return apiRequest<NutritionPlanJobResponse>(`/ai/nutrition/plan/progressive/jobs/${encodeURIComponent(jobId)}`);
}

export async function getLatestProgressiveNutritionPlan() {
  return apiRequest<NutritionPlanApiResponse>('/ai/nutrition/plan/progressive/latest');
}

export async function updateNutritionMealCompletion(payload: {
  day: string;
  meal_key: string;
  completed: boolean;
}) {
  const updated = await apiRequest<NutritionPlanApiResponse>('/ai/nutrition/plan/latest/completions', {
    method: 'PATCH',
    body: payload,
  });
  await primeCachedResource(NUTRITION_PLAN_LATEST_CACHE_KEY, updated);
  return updated;
}

export async function updateProgressiveNutritionMealCompletion(payload: {
  day: string;
  meal_key: string;
  completed: boolean;
}) {
  return apiRequest<NutritionPlanApiResponse>('/ai/nutrition/plan/progressive/latest/completions', {
    method: 'PATCH',
    body: payload,
  });
}

export async function analyzeMealImage(payload: {
  image_base64?: string | null;
  document_base64?: string | null;
  text_content?: string | null;
  mime_type: string;
  file_name?: string | null;
}) {
  return apiRequest<MealImageAnalysisResponse>('/ai/meal-analysis', {
    method: 'POST',
    body: payload,
  });
}

export async function getMealAnalysisHistory() {
  return fetchCachedResource(MEAL_ANALYSIS_HISTORY_CACHE_KEY, async () => {
    const response = await apiRequest<{ analyses: MealImageAnalysisResponse[] }>('/ai/meal-analysis');
    return {
      analyses: Array.isArray(response.analyses) ? response.analyses : [],
    };
  });
}

export function getCachedMealAnalysisHistory() {
  return getCachedResourceSnapshot<{ analyses: MealImageAnalysisResponse[] }>(MEAL_ANALYSIS_HISTORY_CACHE_KEY);
}

export async function primeMealAnalysisHistory(history: { analyses: MealImageAnalysisResponse[] }) {
  await primeCachedResource(MEAL_ANALYSIS_HISTORY_CACHE_KEY, {
    analyses: Array.isArray(history.analyses) ? history.analyses : [],
  });
}
