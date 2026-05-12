import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

declare const process: {
  env?: Record<string, string | undefined>;
};

const RAW_API_URL = process.env?.EXPO_PUBLIC_API_URL ?? 'https://victory-fitness-backend.vercel.app';

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
  country?: string;
  profileImage?: string;
};

export type BodyMetrics = {
  age: string;
  height: string;
  weight: string;
  gender: string;
};

const AUTH_STORAGE_KEY = 'victory-auth-tokens';
const AUTH_USER_STORAGE_KEY = 'victory-auth-user';

let authTokens: AuthTokens | null = null;
let authTokensLoaded = false;
let authTokensLoadPromise: Promise<void> | null = null;
let authUser: AuthUser | null = null;
let authUserLoaded = false;
let authUserLoadPromise: Promise<void> | null = null;

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
    authUser = tokens.user;
    authUserLoaded = true;
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
  const user = await apiRequest<AuthUser & { role?: string; is_admin?: boolean; country?: string; profileImage?: string }>('/me');
  authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    is_verified: user.is_verified,
    country: user.country,
    profileImage: user.profileImage,
  };
  authUserLoaded = true;
  await persistAuthUser(authUser);
  return user;
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
  authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    is_verified: user.is_verified,
    country: user.country,
    profileImage: user.profileImage,
  };
  authUserLoaded = true;
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
    await persistAuthUser(authUser);
  }
  return response;
}

export async function fetchCurrentUserBodyMetrics() {
  return apiRequest<BodyMetrics>('/me/body-metrics');
}

export async function updateCurrentUserBodyMetrics(payload: Partial<BodyMetrics>) {
  return apiRequest<BodyMetrics>('/me/body-metrics', {
    method: 'PATCH',
    body: payload,
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
    return null;
  }

  const refreshed = await refreshWithSessionToken(authTokens.session_token);
  if (!refreshed) {
    await clearAuthTokens();
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
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractErrorDetail(data) || 'Request failed');
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
  };
};
