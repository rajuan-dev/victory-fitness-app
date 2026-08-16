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
