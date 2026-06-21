import { apiRequest } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StrengthPlanExercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  weight: string;
  type: string;
};

export type StrengthPlanDay = {
  day: string;
  title: string;
  est_time: string;
  volume: string;
  intensity: string;
  exercises: StrengthPlanExercise[];
};

export type StrengthPlanDayProgress = {
  day: string;
  started: boolean;
  completed: boolean;
  completed_exercise_ids: string[];
  started_at?: string | null;
  completed_at?: string | null;
};

export type StrengthPlanResponse = {
  plan_id?: string | null;
  summary: string;
  days: StrengthPlanDay[];
  progress: StrengthPlanDayProgress[];
  created_at?: string | null;
};

export type StrengthPlanListResponse = {
  items: StrengthPlanResponse[];
};

export type VideoPlanItem = {
  id: string;
  title: string;
  duration: string;
  category: string;
  image: string;
  tag: string;
  vimeo_id: string;
  video_url: string;
  video_source: string;
};

export type VideoPlanDay = {
  day: string;
  duration_label: string;
  workouts_count: number;
  workouts: VideoPlanItem[];
};

export type VideoPlanResponse = {
  summary: string;
  days: VideoPlanDay[];
};

let latestStrengthPlan: StrengthPlanResponse | null = null;
let latestVideoPlan: VideoPlanResponse | null = null;
const STRENGTH_PLAN_STORAGE_KEY = 'victory-strength-workout-plan';
const VIDEO_PLAN_STORAGE_KEY = 'victory-video-workout-plan';

async function persistLatestStrengthPlan(plan: StrengthPlanResponse | null) {
  latestStrengthPlan = plan;
  if (plan) {
    await AsyncStorage.setItem(STRENGTH_PLAN_STORAGE_KEY, JSON.stringify(plan));
  } else {
    await AsyncStorage.removeItem(STRENGTH_PLAN_STORAGE_KEY);
  }
}

export async function createStrengthWorkoutPlan(payload: Record<string, unknown>) {
  const plan = await apiRequest<StrengthPlanResponse>('/ai/workout-plan/strength', {
    method: 'POST',
    body: payload,
    timeoutMs: 120_000,
  });
  await persistLatestStrengthPlan(plan);
  return plan;
}

export async function fetchLatestStrengthWorkoutPlan() {
  const plan = await apiRequest<StrengthPlanResponse>('/ai/workout-plan/strength/latest');
  await persistLatestStrengthPlan(plan);
  return plan;
}

export async function fetchStrengthWorkoutPlans() {
  const response = await apiRequest<StrengthPlanListResponse>('/ai/workout-plan/strength');
  const latest = response.items[0] ?? null;
  await persistLatestStrengthPlan(latest);
  return response.items;
}

export async function deleteLatestStrengthWorkoutPlan() {
  await apiRequest<{ status: string; message: string }>('/ai/workout-plan/strength/latest', {
    method: 'DELETE',
  });
  await persistLatestStrengthPlan(null);
}

export async function deleteStrengthWorkoutPlan(planId: string) {
  await apiRequest<{ status: string; message: string }>(`/ai/workout-plan/strength/${encodeURIComponent(planId)}`, {
    method: 'DELETE',
  });
  await persistLatestStrengthPlan(null);
}

export async function updateStrengthWorkoutPlanProgress(
  planId: string,
  payload: {
    day: string;
    exercise_id?: string | null;
    started?: boolean;
    completed?: boolean;
  }
) {
  const plan = await apiRequest<StrengthPlanResponse>(`/ai/workout-plan/strength/${encodeURIComponent(planId)}/progress`, {
    method: 'PATCH',
    body: payload,
  });
  await persistLatestStrengthPlan(plan);
  return plan;
}

export async function createVideoWorkoutPlan(payload: Record<string, unknown>) {
  const plan = await apiRequest<VideoPlanResponse>('/ai/workout-plan/video', {
    method: 'POST',
    body: payload,
  });
  latestVideoPlan = plan;
  await AsyncStorage.setItem(VIDEO_PLAN_STORAGE_KEY, JSON.stringify(plan));
  return plan;
}

export function getLatestStrengthWorkoutPlan() {
  return latestStrengthPlan;
}

export function getLatestVideoWorkoutPlan() {
  return latestVideoPlan;
}

export async function loadLatestStrengthWorkoutPlan() {
  if (latestStrengthPlan) {
    return latestStrengthPlan;
  }
  const raw = await AsyncStorage.getItem(STRENGTH_PLAN_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  latestStrengthPlan = JSON.parse(raw) as StrengthPlanResponse;
  return latestStrengthPlan;
}

export async function loadLatestVideoWorkoutPlan() {
  if (latestVideoPlan) {
    return latestVideoPlan;
  }
  const raw = await AsyncStorage.getItem(VIDEO_PLAN_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  latestVideoPlan = JSON.parse(raw) as VideoPlanResponse;
  return latestVideoPlan;
}

export async function clearLatestVideoWorkoutPlan() {
  latestVideoPlan = null;
  await AsyncStorage.removeItem(VIDEO_PLAN_STORAGE_KEY);
}
