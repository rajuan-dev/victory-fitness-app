import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import GreetingCard from '../../components/home/GreetingCard';
import FeatureCards from '../../components/home/FeatureCards';
import MoodSection from '../../components/home/MoodSection';
import WorkoutSection from '../../components/home/WorkoutSection';
import ChallengesSection from '../../components/home/ChallengesSection';
import AccountabilitySection from '../../components/home/AccountabilitySection';
import InviteFriendsCard from '../../components/home/InviteFriendsCard';
import { fetchCurrentUser } from '../../lib/api';
import { canAccessFeature, canAccessPlanRoute } from '../../lib/access';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

export default function HomeScreen() {
  useModuleAccessGuard('/');
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [canAccessNutrition, setCanAccessNutrition] = React.useState(true);
  const [canAccessChallenges, setCanAccessChallenges] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) {
          setCanAccessNutrition(canAccessPlanRoute('/mealPlan', user));
          setCanAccessChallenges(canAccessFeature('challenge', user));
        }
      } catch {
        if (!cancelled) {
          setCanAccessNutrition(false);
          setCanAccessChallenges(false);
        }
      }
    };

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setRefreshToken((current) => current + 1);
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <VictoryHeader />
        <GreetingCard />
        <FeatureCards canAccessNutrition={canAccessNutrition} />
        <MoodSection />
        <WorkoutSection />
        {canAccessChallenges ? <ChallengesSection refreshToken={refreshToken} /> : null}
        {/* <AccountabilitySection /> */}
        <InviteFriendsCard />
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
});
