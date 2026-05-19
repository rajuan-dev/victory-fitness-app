import { apiRequest } from './api';

export type WorkoutLibraryItem = {
  id: string;
  title: string;
  vimeoId: string;
  tag: string;
  thumbnail: string;
  dateAdded: string;
};

export type WorkoutLibraryCategory = {
  id: string;
  name: string;
  count: number;
  image: string;
};

export type WorkoutLibraryResponse = {
  featuredWorkout: WorkoutLibraryItem | null;
  workouts: WorkoutLibraryItem[];
  categories: WorkoutLibraryCategory[];
};

function normalizeWorkoutItem(value: unknown): WorkoutLibraryItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;
  const id = String(item.id ?? '').trim();
  const title = String(item.title ?? '').trim();
  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    vimeoId: String(item.vimeoId ?? ''),
    tag: String(item.tag ?? 'Workout'),
    thumbnail: String(item.thumbnail ?? ''),
    dateAdded: String(item.dateAdded ?? ''),
  };
}

function normalizeWorkoutCategory(value: unknown): WorkoutLibraryCategory | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const category = value as Record<string, unknown>;
  const id = String(category.id ?? '').trim();
  const name = String(category.name ?? '').trim();
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    count: Math.max(Number(category.count ?? 0) || 0, 0),
    image: String(category.image ?? ''),
  };
}

function normalizeWorkoutLibraryResponse(value: unknown): WorkoutLibraryResponse {
  const response = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const workouts = Array.isArray(response.workouts)
    ? response.workouts.map(normalizeWorkoutItem).filter((item): item is WorkoutLibraryItem => Boolean(item))
    : [];
  const categories = Array.isArray(response.categories)
    ? response.categories.map(normalizeWorkoutCategory).filter((item): item is WorkoutLibraryCategory => Boolean(item))
    : [];
  const featuredWorkout = normalizeWorkoutItem(response.featuredWorkout);

  return {
    featuredWorkout: featuredWorkout ?? workouts[0] ?? null,
    workouts,
    categories,
  };
}

export async function fetchWorkoutLibrary(query = '') {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('query', query.trim());
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await apiRequest<WorkoutLibraryResponse>(`/workouts/library${suffix}`);
  return normalizeWorkoutLibraryResponse(response);
}
