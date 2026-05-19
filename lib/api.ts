import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

declare const process: {
  env?: Record<string, string | undefined>;
};

const RAW_API_URL = process.env?.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000';

function resolveApiUrl(url: string): string {
  if (Platform.OS !== 'android') {
    return url;
  }

  if (url.includes('://127.0.0.1') || url.includes('://localhost')) {
    return url.replace('://127.0.0.1', '://10.0.2.2').replace('://localhost', '://10.0.2.2');
  }

  return url;
}

const API_URL = resolveApiUrl(RAW_API_URL);

export function resolveRemoteAssetUrl(url: string | null | undefined): string {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    return '';
  }

  if (normalizedUrl.startsWith('data:')) {
    return normalizedUrl;
  }

  if (normalizedUrl.startsWith('/')) {
    return `${API_URL}${normalizedUrl}`;
  }

  return resolveApiUrl(normalizedUrl);
}

type RequestOptions = {
  method?: string;
  body?: unknown;
};

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail || this.message;
  }
}

type AuthTokens = {
  access_token: string;
  session_token: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  is_verified: boolean;
  is_admin?: boolean;
  country?: string;
  profileImage?: string;
  points?: number;
  workouts_completed?: number;
  workouts_total?: number;
  streak_days?: number;
  rank?: string;
  next_rank?: string;
  points_to_next_rank?: number;
  rank_progress_fraction?: number;
  subscription_tier?: string;
  subscription_status?: string;
  subscription_started_at?: string | null;
  subscription_confirmed_at?: string | null;
  subscription_access?: string[];
};

export type BodyMetrics = {
  age: string;
  height: string;
  weight: string;
  gender: string;
};

export type CoachingApplicationPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  goal: string;
  obstacle: string;
  investment: string;
  commitment: string;
  injury: string;
  additional_notes?: string;
  agreement_accepted: boolean;
};

export type SupportMessagePayload = {
  subject: string;
  message: string;
};

export type LongevityOverview = {
  biological_age: string;
  chronological_age: string;
  trending_years_younger: number;
  recovery_score: number;
  hrv_ms: number;
  sleep_score: number;
};

export type LongevityQuickAction = {
  id: string;
  label: string;
  image: string;
  color: string;
};

export type LongevityWearableDevice = {
  id: string;
  name: string;
  status: string;
  active: boolean;
  image: string;
};

export type WearableProvider = 'apple-health' | 'health-connect' | 'fitbit' | 'garmin';

export type LongevityWearables = {
  devices: LongevityWearableDevice[];
  last_synced_at?: string | null;
  has_data: boolean;
  sync_message: string;
};

export type WearableOAuthConnectResponse = {
  provider: WearableProvider;
  authorization_url: string;
  state: string;
  expires_at: string;
};

export type LongevityHabit = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  done: boolean;
};

export type LongevityHabits = {
  streak_days: number;
  habits: LongevityHabit[];
};

export type LongevityHealCategory = {
  id: string;
  label: string;
  image: string;
  color: string;
};

export type LongevityMasterclass = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
};

export type LongevityCircle = {
  id: string;
  name: string;
  member_count: number;
  description: string;
};

export type LongevityDashboard = {
  overview: LongevityOverview;
  quick_actions: LongevityQuickAction[];
  wearables: LongevityWearables;
  habits: LongevityHabits;
  heal_categories: LongevityHealCategory[];
  masterclasses: LongevityMasterclass[];
  circles: LongevityCircle[];
};

const AUTH_STORAGE_KEY = 'victory-auth-tokens';
const AUTH_USER_STORAGE_KEY = 'victory-auth-user';

let authTokens: AuthTokens | null = null;
let authTokensLoaded = false;
let authTokensLoadPromise: Promise<void> | null = null;
let authUser: AuthUser | null = null;
let authUserLoaded = false;
let authUserLoadPromise: Promise<void> | null = null;
let authFailureHandler: (() => void) | null = null;
let currentUserRequestPromise: Promise<AuthUser> | null = null;
let bodyMetricsRequestPromise: Promise<BodyMetrics> | null = null;
let currentUserFetchedAt = 0;
let bodyMetricsFetchedAt = 0;
let bodyMetricsCache: BodyMetrics | null = null;

const CURRENT_USER_CACHE_TTL_MS = 30_000;
const BODY_METRICS_CACHE_TTL_MS = 30_000;

function normalizeAuthUser(user: Partial<AuthUser> & { id?: string; name?: string; email?: string; is_verified?: boolean }): AuthUser {
  return {
    id: String(user.id ?? ''),
    name: String(user.name ?? ''),
    email: String(user.email ?? ''),
    is_verified: Boolean(user.is_verified),
    is_admin: Boolean(user.is_admin),
    country: String(user.country ?? ''),
    profileImage: String(user.profileImage ?? ''),
    points: Math.max(Number(user.points ?? 0) || 0, 0),
    workouts_completed: Math.max(Number(user.workouts_completed ?? 0) || 0, 0),
    workouts_total: Math.max(Number(user.workouts_total ?? 0) || 0, 0),
    streak_days: Math.max(Number(user.streak_days ?? 0) || 0, 0),
    rank: String(user.rank ?? 'Noob'),
    next_rank: String(user.next_rank ?? 'Bronze'),
    points_to_next_rank: Math.max(Number(user.points_to_next_rank ?? 0) || 0, 0),
    rank_progress_fraction: Math.min(Math.max(Number(user.rank_progress_fraction ?? 0) || 0, 0), 1),
    subscription_tier: String(user.subscription_tier ?? 'NONE'),
    subscription_status: String(user.subscription_status ?? 'NONE'),
    subscription_started_at: user.subscription_started_at ? String(user.subscription_started_at) : null,
    subscription_confirmed_at: user.subscription_confirmed_at ? String(user.subscription_confirmed_at) : null,
    subscription_access: Array.isArray(user.subscription_access) ? user.subscription_access.map((item) => String(item)) : [],
  };
}

function normalizeBodyMetrics(metrics: Partial<BodyMetrics> | null | undefined): BodyMetrics {
  return {
    age: String(metrics?.age ?? ''),
    height: String(metrics?.height ?? ''),
    weight: String(metrics?.weight ?? ''),
    gender: String(metrics?.gender ?? ''),
  };
}

function clearDerivedUserCaches() {
  currentUserRequestPromise = null;
  bodyMetricsRequestPromise = null;
  currentUserFetchedAt = 0;
  bodyMetricsFetchedAt = 0;
  bodyMetricsCache = null;
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    if (typeof globalThis.atob !== 'function') {
      return null;
    }

    const json = globalThis.atob(padded);
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

function isJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return true;
  }

  return payload.exp * 1000 <= Date.now();
}

async function persistAuthTokens(tokens: AuthTokens | null) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return;
    }

    if (tokens) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    return;
  }

  if (tokens) {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
  } else {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

async function persistAuthUser(user: AuthUser | null) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return;
    }

    if (user) {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
    return;
  }

  if (user) {
    await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }
}

async function loadPersistedAuthTokens(): Promise<AuthTokens | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  }

  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthTokens) : null;
}

async function loadPersistedAuthUser(): Promise<AuthUser | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }

  const raw = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

async function ensureAuthTokensLoaded() {
  if (authTokensLoaded) {
    return;
  }

  if (!authTokensLoadPromise) {
    authTokensLoadPromise = loadPersistedAuthTokens()
      .then((stored) => {
        authTokens = stored;
        authTokensLoaded = true;
      })
      .finally(() => {
        authTokensLoadPromise = null;
      });
  }

  await authTokensLoadPromise;
}

async function ensureAuthUserLoaded() {
  if (authUserLoaded) {
    return;
  }

  if (!authUserLoadPromise) {
    authUserLoadPromise = loadPersistedAuthUser()
      .then((stored) => {
        authUser = stored;
        authUserLoaded = true;
      })
      .finally(() => {
        authUserLoadPromise = null;
      });
  }

  await authUserLoadPromise;
}

export async function setAuthTokens(tokens: AuthTokens & { user?: AuthUser }) {
  authTokens = tokens;
  authTokensLoaded = true;
  await persistAuthTokens(tokens);

  if (tokens.user) {
    authUser = normalizeAuthUser(tokens.user);
    authUserLoaded = true;
    currentUserFetchedAt = Date.now();
    bodyMetricsCache = null;
    bodyMetricsFetchedAt = 0;
    await persistAuthUser(tokens.user);
  }
}

export async function clearAuthTokens() {
  authTokens = null;
  authTokensLoaded = true;
  await persistAuthTokens(null);
  authUser = null;
  authUserLoaded = true;
  await persistAuthUser(null);
  clearDerivedUserCaches();
}

export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler;
}

export async function getAuthTokens() {
  await ensureAuthTokensLoaded();
  return authTokens;
}

export async function getAuthUser() {
  await ensureAuthUserLoaded();
  return authUser;
}

export async function fetchCurrentUser() {
  const now = Date.now();
  if (authUser && currentUserFetchedAt && now - currentUserFetchedAt < CURRENT_USER_CACHE_TTL_MS) {
    return authUser;
  }

  if (!currentUserRequestPromise) {
    currentUserRequestPromise = apiRequest<AuthUser & { role?: string; is_admin?: boolean; country?: string; profileImage?: string }>('/me')
      .then(async (user) => {
        authUser = normalizeAuthUser(user);
        authUserLoaded = true;
        currentUserFetchedAt = Date.now();
        await persistAuthUser(authUser);
        return authUser;
      })
      .finally(() => {
        currentUserRequestPromise = null;
      });
  }

  return currentUserRequestPromise;
}

export async function updateCurrentUserProfile(payload: {
  name?: string;
  email?: string;
  country?: string;
  profileImage?: string;
}) {
  const user = await apiRequest<AuthUser & { role?: string; is_admin?: boolean; country?: string; profileImage?: string }>(
    '/me',
    {
      method: 'PATCH',
      body: payload,
    }
  );
  authUser = normalizeAuthUser(user);
  authUserLoaded = true;
  currentUserFetchedAt = Date.now();
  await persistAuthUser(authUser);
  return user;
}

export async function updateCurrentUserSubscription(payload: {
  subscription_tier: string;
  confirm_payment?: boolean;
}) {
  const user = await apiRequest<AuthUser & { role?: string; is_admin?: boolean; country?: string; profileImage?: string }>(
    '/me/subscription',
    {
      method: 'PATCH',
      body: payload,
    }
  );
  authUser = normalizeAuthUser(user);
  authUserLoaded = true;
  currentUserFetchedAt = Date.now();
  await persistAuthUser(authUser);
  return user;
}

export async function uploadCurrentUserProfileImage(payload: {
  image_base64: string;
  mime_type: string;
  file_name?: string | null;
}) {
  const response = await apiRequest<{ image_url: string }>('/me/profile-image', {
    method: 'POST',
    body: payload,
  });
  if (authUser) {
    authUser = {
      ...authUser,
      profileImage: response.image_url,
    };
    authUserLoaded = true;
    currentUserFetchedAt = Date.now();
    await persistAuthUser(authUser);
  }
  return response;
}

export async function fetchCurrentUserBodyMetrics() {
  const now = Date.now();
  if (bodyMetricsCache && bodyMetricsFetchedAt && now - bodyMetricsFetchedAt < BODY_METRICS_CACHE_TTL_MS) {
    return bodyMetricsCache;
  }

  if (!bodyMetricsRequestPromise) {
    bodyMetricsRequestPromise = apiRequest<BodyMetrics>('/me/body-metrics')
      .then((metrics) => {
        bodyMetricsCache = normalizeBodyMetrics(metrics);
        bodyMetricsFetchedAt = Date.now();
        return bodyMetricsCache;
      })
      .finally(() => {
        bodyMetricsRequestPromise = null;
      });
  }

  return bodyMetricsRequestPromise;
}

export async function updateCurrentUserBodyMetrics(payload: Partial<BodyMetrics>) {
  const metrics = await apiRequest<BodyMetrics>('/me/body-metrics', {
    method: 'PATCH',
    body: payload,
  });
  bodyMetricsCache = normalizeBodyMetrics(metrics);
  bodyMetricsFetchedAt = Date.now();
  return bodyMetricsCache;
}

export async function submitCoachingApplication(payload: CoachingApplicationPayload) {
  return apiRequest('/applications', {
    method: 'POST',
    body: payload,
  });
}

export async function submitSupportMessage(payload: SupportMessagePayload) {
  return apiRequest('/support/messages', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchLongevityDashboard() {
  const response = await apiRequest<LongevityDashboard>('/longevity-os/dashboard');
  const overview = response?.overview && typeof response.overview === 'object' ? response.overview : {} as LongevityOverview;
  const wearables = response?.wearables && typeof response.wearables === 'object' ? response.wearables : {} as LongevityWearables;
  const habits = response?.habits && typeof response.habits === 'object' ? response.habits : {} as LongevityHabits;
  return {
    overview: {
      biological_age: String(overview.biological_age ?? 'N/A'),
      chronological_age: String(overview.chronological_age ?? 'N/A'),
      trending_years_younger: Number(overview.trending_years_younger ?? 0) || 0,
      recovery_score: Number(overview.recovery_score ?? 0) || 0,
      hrv_ms: Number(overview.hrv_ms ?? 0) || 0,
      sleep_score: Number(overview.sleep_score ?? 0) || 0,
    },
    quick_actions: Array.isArray(response?.quick_actions) ? response.quick_actions : [],
    wearables: {
      devices: Array.isArray(wearables.devices) ? wearables.devices : [],
      last_synced_at: wearables.last_synced_at ?? null,
      has_data: Boolean(wearables.has_data),
      sync_message: String(wearables.sync_message ?? ''),
    },
    habits: {
      streak_days: Number(habits.streak_days ?? 0) || 0,
      habits: Array.isArray(habits.habits) ? habits.habits : [],
    },
    heal_categories: Array.isArray(response?.heal_categories) ? response.heal_categories : [],
    masterclasses: Array.isArray(response?.masterclasses) ? response.masterclasses : [],
    circles: Array.isArray(response?.circles) ? response.circles : [],
  };
}

export async function syncLongevityWearables() {
  return apiRequest<LongevityWearables>('/longevity-os/wearables/sync', {
    method: 'POST',
  });
}

export async function connectWearableProvider(provider: Extract<WearableProvider, 'fitbit' | 'garmin'>) {
  return apiRequest<WearableOAuthConnectResponse>(`/wearables/${encodeURIComponent(provider)}/connect`);
}

export async function updateLongevityHabit(habitId: string, done: boolean) {
  return apiRequest<LongevityHabits>(`/longevity-os/habits/${encodeURIComponent(habitId)}`, {
    method: 'PATCH',
    body: { done },
  });
}

export async function generateLongevityWeeklyPlan() {
  return apiRequest<{ status: string; message: string; generated_at: string }>('/longevity-os/heal/weekly-plan', {
    method: 'POST',
  });
}

async function refreshWithSessionToken(sessionToken: string): Promise<AuthTokens | null> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ session_token: sessionToken }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as AuthResponse;
  return {
    access_token: data.access_token,
    session_token: data.session_token,
  };
}

function isInvalidSessionError(detail: string, status: number): boolean {
  const normalized = detail.toLowerCase();
  return (
    normalized.includes('invalid session token') ||
    normalized.includes('session token is invalid') ||
    normalized.includes('session expired') ||
    normalized.includes('invalid authentication') ||
    (status === 401 && normalized.includes('token'))
  );
}

async function handleInvalidSession() {
  await clearAuthTokens();
  authFailureHandler?.();
}

export async function getValidAuthTokens() {
  await ensureAuthTokensLoaded();

  if (!authTokens) {
    return null;
  }

  if (authTokens.access_token && !isJwtExpired(authTokens.access_token)) {
    return authTokens;
  }

  if (!authTokens.session_token || isJwtExpired(authTokens.session_token)) {
    await clearAuthTokens();
    authFailureHandler?.();
    return null;
  }

  const refreshed = await refreshWithSessionToken(authTokens.session_token);
  if (!refreshed) {
    await clearAuthTokens();
    authFailureHandler?.();
    return null;
  }

  await setAuthTokens(refreshed);
  return refreshed;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  retryOnUnauthorized = true
): Promise<T> {
  await ensureAuthTokensLoaded();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (authTokens?.access_token) {
    headers.Authorization = `Bearer ${authTokens.access_token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && retryOnUnauthorized && authTokens?.session_token) {
    try {
      const refreshed = await apiRequest<AuthResponse>(
        '/auth/refresh',
        {
          method: 'POST',
          body: { session_token: authTokens.session_token },
        },
        false
      );
      await setAuthTokens(refreshed);
      return apiRequest<T>(path, options, false);
    } catch (refreshError) {
      if (refreshError instanceof ApiError && isInvalidSessionError(refreshError.detail, refreshError.status)) {
        await handleInvalidSession();
      }
      throw refreshError;
    }
  }

  if (!response.ok) {
    const detail = extractErrorDetail(data) || 'Request failed';
    if (isInvalidSessionError(detail, response.status)) {
      await handleInvalidSession();
    }
    throw new ApiError(response.status, detail);
  }

  return data as T;
}

function extractErrorDetail(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') {
      return detail;
    }

    if (detail && typeof detail === 'object') {
      try {
        return JSON.stringify(detail);
      } catch {
        return '';
      }
    }
  }

  return '';
}

export type AuthResponse = {
  access_token: string;
  session_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    name: string;
    email: string;
    is_verified: boolean;
    country?: string;
    profileImage?: string;
    points?: number;
    workouts_completed?: number;
    workouts_total?: number;
    streak_days?: number;
    rank?: string;
    next_rank?: string;
    points_to_next_rank?: number;
    rank_progress_fraction?: number;
    subscription_tier?: string;
    subscription_status?: string;
    subscription_started_at?: string | null;
    subscription_confirmed_at?: string | null;
    subscription_access?: string[];
  };
};
