import {
  fetchCurrentUser,
  fetchCurrentUserBodyMetrics,
  fetchIntegrationConnections,
  fetchLongevityDashboard,
  fetchLongevityHealthRecords,
  fetchLongevityHealthSummary,
} from './api';
import { canAccessFeature } from './access';
import { fetchAdminChallenges } from './api';
import {
  fetchChallengeChatData,
  fetchChallengeDetailData,
  fetchChallengeOverviewData,
  fetchChallengeProgressData,
  fetchCoachVictorHistoryData,
  fetchLatestNutritionPlanData,
  fetchCommunityPostsData,
  fetchJournalEntries,
  fetchPrivacyPolicy,
} from './screenData';
import { fetchWorkoutLibrary } from './workouts';
import { fetchLatestStrengthWorkoutPlan, loadLatestVideoWorkoutPlan } from './workout-plans';
import { getMealAnalysisHistory } from './nutrition';

let preloadPromise: Promise<void> | null = null;

export async function preloadAppData() {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      const [
        userResult,
        _bodyMetricsResult,
        _strengthPlanResult,
        _videoPlanResult,
        _workoutLibraryResult,
        _journalEntriesResult,
        _privacyPolicyResult,
        _nutritionPlanResult,
        challengeOverviewResult,
      ] = await Promise.allSettled([
        fetchCurrentUser(),
        fetchCurrentUserBodyMetrics(),
        fetchLatestStrengthWorkoutPlan(),
        loadLatestVideoWorkoutPlan(),
        fetchWorkoutLibrary(),
        fetchJournalEntries(),
        fetchPrivacyPolicy(),
        fetchLatestNutritionPlanData(),
        fetchChallengeOverviewData(),
        fetchCommunityPostsData(),
        getMealAnalysisHistory(),
      ]);

      const user = userResult.status === 'fulfilled' ? userResult.value : null;
      const overview = challengeOverviewResult.status === 'fulfilled' ? challengeOverviewResult.value : null;

      const secondaryPreloads: Promise<unknown>[] = [];

      if (user) {
        if (canAccessFeature('longevity', user)) {
          secondaryPreloads.push(
            fetchLongevityDashboard(),
            fetchIntegrationConnections(),
            fetchLongevityHealthSummary(),
            fetchLongevityHealthRecords({}).catch(() => null)
          );
        }

        if (canAccessFeature('coach_victor', user)) {
          secondaryPreloads.push(fetchCoachVictorHistoryData());
        }

        if (user.is_admin) {
          secondaryPreloads.push(fetchAdminChallenges());
        }
      }

      const challengeIds = new Set<string>();
      const activeChallengeIds = new Set<string>();
      if (overview && typeof overview === 'object') {
        const typedOverview = overview as {
          active_challenges?: Array<{ challenge_id?: string }>;
          ready_to_start?: Array<{ id?: string }>;
        };
        for (const challenge of typedOverview.active_challenges || []) {
          if (challenge?.challenge_id) {
            challengeIds.add(challenge.challenge_id);
            activeChallengeIds.add(challenge.challenge_id);
          }
        }
        for (const challenge of typedOverview.ready_to_start || []) {
          if (challenge?.id) {
            challengeIds.add(challenge.id);
          }
        }
      }

      for (const challengeId of challengeIds) {
        secondaryPreloads.push(fetchChallengeDetailData(challengeId));
        if (activeChallengeIds.has(challengeId)) {
          secondaryPreloads.push(
            fetchChallengeChatData(challengeId),
            fetchChallengeProgressData(challengeId)
          );
        }
      }

      await Promise.allSettled(secondaryPreloads);
    })().finally(() => {
      preloadPromise = null;
    });
  }

  await preloadPromise;
}
