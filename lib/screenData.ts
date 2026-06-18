import { ApiError, apiRequest } from './api';
import { fetchCachedResource } from './resourceCache';

export type JournalEntry = {
  id: string;
  user_id: string;
  mood: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type PrivacyPolicyPayload = {
  title: string;
  plain_text: string;
  updated_at: string;
};

export type ChallengeOverview = {
  active_chats: unknown[];
  active_challenges: unknown[];
  completed_challenges: unknown[];
  ready_to_start: unknown[];
};

export type CommunityPostPayload = {
  posts: unknown[];
};

export type NutritionPlanLatestPayload = Record<string, unknown> | null;

export type CoachVictorHistoryPayload = {
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }>;
};

export const JOURNAL_ENTRIES_CACHE_KEY = 'journal-entries';
export const PRIVACY_POLICY_CACHE_KEY = 'content-privacy-policy';
export const CHALLENGE_OVERVIEW_CACHE_KEY = 'challenge-overview';
export const COMMUNITY_POSTS_CACHE_KEY = 'community-posts';
export const NUTRITION_PLAN_LATEST_CACHE_KEY = 'nutrition-plan-latest';
export const COACH_VICTOR_HISTORY_CACHE_KEY = 'coach-victor-history';
export const INTEGRATIONS_CACHE_KEY = 'integrations';

export function getLongevityDashboardCacheKey(language = '') {
  return `longevity-dashboard:${language || 'default'}`;
}

export function getLongevityHealthSummaryCacheKey(language = '') {
  return `longevity-health-summary:${language || 'default'}`;
}

export function getLongevityHealthRecordsCacheKey(
  params?: { provider?: string; metric_type?: string; start_date?: string; end_date?: string },
  language = ''
) {
  return `longevity-health-records:${language || 'default'}:${JSON.stringify(params || {})}`;
}

export function getChallengeDetailCacheKey(challengeId: string) {
  return `challenge-detail:${challengeId}`;
}

export function getChallengeChatCacheKey(challengeId: string) {
  return `challenge-chat:${challengeId}`;
}

export function getChallengeProgressCacheKey(challengeId: string) {
  return `challenge-progress:${challengeId}`;
}

export async function fetchJournalEntries() {
  return fetchCachedResource(JOURNAL_ENTRIES_CACHE_KEY, async () => {
    const response = await apiRequest<{ entries: JournalEntry[] }>('/journal/entries');
    return {
      entries: Array.isArray(response.entries) ? response.entries : [],
    };
  });
}

export async function fetchPrivacyPolicy() {
  return fetchCachedResource(PRIVACY_POLICY_CACHE_KEY, async () => {
    return apiRequest<PrivacyPolicyPayload>('/content/privacy-policy');
  });
}

export async function fetchChallengeOverviewData() {
  return fetchCachedResource(CHALLENGE_OVERVIEW_CACHE_KEY, async () => {
    return apiRequest<ChallengeOverview>('/challenges/overview');
  });
}

export async function fetchCommunityPostsData() {
  return fetchCachedResource(COMMUNITY_POSTS_CACHE_KEY, async () => {
    const response = await apiRequest<CommunityPostPayload>('/community/posts');
    return {
      posts: Array.isArray(response.posts) ? response.posts : [],
    };
  });
}

export async function fetchLatestNutritionPlanData() {
  return fetchCachedResource(NUTRITION_PLAN_LATEST_CACHE_KEY, async () => {
    try {
      return await apiRequest<NutritionPlanLatestPayload>('/ai/nutrition/plan/latest');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  });
}

export async function fetchCoachVictorHistoryData() {
  return fetchCachedResource(COACH_VICTOR_HISTORY_CACHE_KEY, async () => {
    const response = await apiRequest<CoachVictorHistoryPayload>('/ai/coach-victor/history');
    return {
      messages: Array.isArray(response.messages) ? response.messages : [],
    };
  });
}

export async function fetchChallengeDetailData<T>(challengeId: string) {
  return fetchCachedResource(getChallengeDetailCacheKey(challengeId), async () => {
    return apiRequest<T>(`/challenges/${encodeURIComponent(challengeId)}`);
  });
}

export async function fetchChallengeChatData<T>(challengeId: string) {
  return fetchCachedResource(getChallengeChatCacheKey(challengeId), async () => {
    return apiRequest<T>(`/challenges/${encodeURIComponent(challengeId)}/chat`);
  });
}

export async function fetchChallengeProgressData<T>(challengeId: string) {
  return fetchCachedResource(getChallengeProgressCacheKey(challengeId), async () => {
    return apiRequest<T>(`/challenges/${encodeURIComponent(challengeId)}`);
  });
}
