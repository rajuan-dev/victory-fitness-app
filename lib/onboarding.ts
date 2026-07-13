import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingLanguage = 'en' | 'it' | 'de' | 'es';

export type OnboardingPersonalProfile = {
  age: string;
  gender: string;
  height: string;
  heightUnit: 'cm';
  weight: string;
  weightUnit: 'kg' | 'lb';
};

export type OnboardingAnamnese = {
  primaryGoal: string;
  activityLevel: string;
  healthConcerns: string[];
  healthNotes: string;
  daysPerWeek: string;
  timePerSession: string;
  equipmentAccess: string;
};

export type OnboardingSuggestion = {
  tier: 'SILVER' | 'GOLD' | 'PLATINUM';
  title: string;
  reason: string;
  note?: string;
};

export type OnboardingData = {
  userId: string;
  currentStep: number;
  language: OnboardingLanguage | '';
  personalProfile: OnboardingPersonalProfile;
  anamnese: OnboardingAnamnese;
  suggestion: OnboardingSuggestion | null;
  updatedAt: string | null;
};

const ONBOARDING_DATA_KEY = 'onboardingData';
const LAST_WEIGHT_PROMPT_DATE_KEY = 'lastWeightPromptDate';
const LAST_WEIGHT_PROMPT_USER_KEY = 'lastWeightPromptUserId';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEIGHT_PROMPT_INTERVAL_DAYS = 28;

const EMPTY_PERSONAL_PROFILE: OnboardingPersonalProfile = {
  age: '',
  gender: '',
  height: '',
  heightUnit: 'cm',
  weight: '',
  weightUnit: 'kg',
};

const EMPTY_ANAMNESE: OnboardingAnamnese = {
  primaryGoal: '',
  activityLevel: '',
  healthConcerns: [],
  healthNotes: '',
  daysPerWeek: '',
  timePerSession: '',
  equipmentAccess: '',
};

function canUseLocalStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeOnboardingData(raw: unknown): OnboardingData | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  return {
    userId: String(source.userId ?? '').trim(),
    currentStep: Math.max(Number(source.currentStep ?? 0) || 0, 0),
    language: (String(source.language ?? '').trim() as OnboardingLanguage | '') || '',
    personalProfile: {
      age: String((source.personalProfile as Record<string, unknown> | undefined)?.age ?? '').trim(),
      gender: String((source.personalProfile as Record<string, unknown> | undefined)?.gender ?? '').trim(),
      height: String((source.personalProfile as Record<string, unknown> | undefined)?.height ?? '').trim(),
      heightUnit: 'cm',
      weight: String((source.personalProfile as Record<string, unknown> | undefined)?.weight ?? '').trim(),
      weightUnit: String((source.personalProfile as Record<string, unknown> | undefined)?.weightUnit ?? 'kg').trim() === 'lb' ? 'lb' : 'kg',
    },
    anamnese: {
      primaryGoal: String((source.anamnese as Record<string, unknown> | undefined)?.primaryGoal ?? '').trim(),
      activityLevel: String((source.anamnese as Record<string, unknown> | undefined)?.activityLevel ?? '').trim(),
      healthConcerns: Array.isArray((source.anamnese as Record<string, unknown> | undefined)?.healthConcerns)
        ? ((source.anamnese as Record<string, unknown>).healthConcerns as unknown[]).map((item) => String(item).trim()).filter(Boolean)
        : [],
      healthNotes: String((source.anamnese as Record<string, unknown> | undefined)?.healthNotes ?? '').trim(),
      daysPerWeek: String((source.anamnese as Record<string, unknown> | undefined)?.daysPerWeek ?? '').trim(),
      timePerSession: String((source.anamnese as Record<string, unknown> | undefined)?.timePerSession ?? '').trim(),
      equipmentAccess: String((source.anamnese as Record<string, unknown> | undefined)?.equipmentAccess ?? '').trim(),
    },
    suggestion: source.suggestion && typeof source.suggestion === 'object'
      ? {
          tier: String((source.suggestion as Record<string, unknown>).tier ?? 'GOLD').trim().toUpperCase() as 'SILVER' | 'GOLD' | 'PLATINUM',
          title: String((source.suggestion as Record<string, unknown>).title ?? '').trim(),
          reason: String((source.suggestion as Record<string, unknown>).reason ?? '').trim(),
          note: String((source.suggestion as Record<string, unknown>).note ?? '').trim() || undefined,
        }
      : null,
    updatedAt: String(source.updatedAt ?? '').trim() || null,
  };
}

function buildEmptyOnboardingData(userId: string): OnboardingData {
  return {
    userId,
    currentStep: 0,
    language: '',
    personalProfile: { ...EMPTY_PERSONAL_PROFILE },
    anamnese: { ...EMPTY_ANAMNESE },
    suggestion: null,
    updatedAt: null,
  };
}

async function readStorageValue(key: string) {
  if (canUseLocalStorage()) {
    return window.localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

async function writeStorageValue(key: string, value: string) {
  if (canUseLocalStorage()) {
    window.localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function removeStorageValue(key: string) {
  if (canUseLocalStorage()) {
    window.localStorage.removeItem(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

export function getStoredOnboardingDataSnapshot() {
  if (!canUseLocalStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(ONBOARDING_DATA_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeOnboardingData(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function getOnboardingData(userId?: string) {
  const raw = await readStorageValue(ONBOARDING_DATA_KEY);
  if (!raw) {
    return userId ? buildEmptyOnboardingData(userId) : null;
  }

  try {
    const parsed = normalizeOnboardingData(JSON.parse(raw));
    if (!parsed) {
      return userId ? buildEmptyOnboardingData(userId) : null;
    }
    if (userId && parsed.userId && parsed.userId !== userId) {
      return buildEmptyOnboardingData(userId);
    }
    if (userId && !parsed.userId) {
      return { ...parsed, userId };
    }
    return parsed;
  } catch {
    return userId ? buildEmptyOnboardingData(userId) : null;
  }
}

export async function saveOnboardingData(data: OnboardingData) {
  await writeStorageValue(
    ONBOARDING_DATA_KEY,
    JSON.stringify({
      ...data,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function completeOnboarding(data: OnboardingData) {
  await saveOnboardingData(data);
  await removeStorageValue('onboardingCompleted');
  await writeStorageValue(LAST_WEIGHT_PROMPT_DATE_KEY, new Date().toISOString());
  await writeStorageValue(LAST_WEIGHT_PROMPT_USER_KEY, data.userId);
}

export async function shouldShowWeightUpdatePrompt(userId: string) {
  const data = await getOnboardingData(userId);
  if (!data?.personalProfile.weight) {
    return true;
  }

  const [lastPromptDate, promptUserId] = await Promise.all([
    readStorageValue(LAST_WEIGHT_PROMPT_DATE_KEY),
    readStorageValue(LAST_WEIGHT_PROMPT_USER_KEY),
  ]);

  if (promptUserId && promptUserId !== userId) {
    return true;
  }

  if (!lastPromptDate) {
    return true;
  }

  const lastPromptTime = Date.parse(lastPromptDate);
  if (Number.isNaN(lastPromptTime)) {
    return true;
  }

  return Date.now() - lastPromptTime >= WEIGHT_PROMPT_INTERVAL_DAYS * MS_PER_DAY;
}

export async function updateUserWeight(userId: string, weight: string) {
  const data = (await getOnboardingData(userId)) ?? buildEmptyOnboardingData(userId);
  const nextData: OnboardingData = {
    ...data,
    userId,
    personalProfile: {
      ...data.personalProfile,
      weight: weight.trim(),
    },
    updatedAt: new Date().toISOString(),
  };
  await saveOnboardingData(nextData);
  await writeStorageValue(LAST_WEIGHT_PROMPT_DATE_KEY, new Date().toISOString());
  await writeStorageValue(LAST_WEIGHT_PROMPT_USER_KEY, userId);
  return nextData;
}

export async function syncOnboardingProfileFields(userId: string, fields: Partial<OnboardingPersonalProfile>) {
  const data = (await getOnboardingData(userId)) ?? buildEmptyOnboardingData(userId);
  const nextData: OnboardingData = {
    ...data,
    userId,
    personalProfile: {
      ...data.personalProfile,
      ...fields,
    },
    updatedAt: new Date().toISOString(),
  };
  await saveOnboardingData(nextData);
  return nextData;
}

export async function markWeightPromptHandled(userId: string) {
  await writeStorageValue(LAST_WEIGHT_PROMPT_DATE_KEY, new Date().toISOString());
  await writeStorageValue(LAST_WEIGHT_PROMPT_USER_KEY, userId);
}
