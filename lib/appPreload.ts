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
  fetchChallengeOverviewData,
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
let hasCompletedPreload = false;

export async function preloadAppData() {
  if (hasCompletedPreload) {
    return;
  }

  if (!preloadPromise) {
    preloadPromise = (async () => {
      const user = await fetchCurrentUser().catch(() => null);
      if (!user) {
        return;
      }

      const primaryPreloads: Promise<unknown>[] = [
        fetchCurrentUserBodyMetrics(),
        fetchWorkoutLibrary(),
        fetchJournalEntries(),
        fetchPrivacyPolicy(),
      ];

      if (canAccessFeature('challenge', user)) {
        primaryPreloads.push(fetchChallengeOverviewData());
      }

      if (canAccessFeature('community', user)) {
        primaryPreloads.push(fetchCommunityPostsData());
      }

      if (canAccessFeature('mealPlan', user)) {
        primaryPreloads.push(fetchLatestNutritionPlanData());
      }

      if (canAccessFeature('meal_analysis', user)) {
        primaryPreloads.push(getMealAnalysisHistory());
      }

      if (canAccessFeature('workoutplan', user)) {
        primaryPreloads.push(
          fetchLatestStrengthWorkoutPlan(),
          loadLatestVideoWorkoutPlan()
        );
      }

      await Promise.allSettled(primaryPreloads);

      const secondaryPreloads: Promise<unknown>[] = [];

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

      await Promise.allSettled(secondaryPreloads);
      hasCompletedPreload = true;
    })().finally(() => {
      preloadPromise = null;
    });
  }

  await preloadPromise;
}
