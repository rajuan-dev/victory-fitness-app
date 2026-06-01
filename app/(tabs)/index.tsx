import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import GreetingCard from '../../components/home/GreetingCard';
import FeatureCards from '../../components/home/FeatureCards';
import MoodSection from '../../components/home/MoodSection';
import WorkoutSection from '../../components/home/WorkoutSection';
import ChallengesSection from '../../components/home/ChallengesSection';
import AccountabilitySection from '../../components/home/AccountabilitySection';
import InviteFriendsCard from '../../components/home/InviteFriendsCard';
import AccessRestrictionModal from '../../components/AccessRestrictionModal';
import { fetchCurrentUser } from '../../lib/api';
import { canAccessFeature, canAccessPlanRoute } from '../../lib/access';
import { useRouter } from 'expo-router';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

export default function HomeScreen() {
  useModuleAccessGuard('/');
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [canAccessNutrition, setCanAccessNutrition] = React.useState(true);
  const [canAccessChallenges, setCanAccessChallenges] = React.useState(true);
  const [canAccessCoachVictor, setCanAccessCoachVictor] = React.useState(true);
  const [canAccessWorkoutPlans, setCanAccessWorkoutPlans] = React.useState(true);
  const [restrictedSection, setRestrictedSection] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) {
          setCanAccessNutrition(canAccessPlanRoute('/mealPlan', user));
          setCanAccessChallenges(canAccessFeature('challenge', user));
          setCanAccessCoachVictor(canAccessFeature('coach_victor', user));
          setCanAccessWorkoutPlans(canAccessFeature('workoutplan', user));
        }
      } catch {
        if (!cancelled) {
          setCanAccessNutrition(false);
          setCanAccessChallenges(false);
          setCanAccessCoachVictor(false);
          setCanAccessWorkoutPlans(false);
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

  const openRestrictedSection = React.useCallback((sectionName: string) => {
    setRestrictedSection(sectionName);
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
        <FeatureCards
          canAccessCoachVictor={canAccessCoachVictor}
          canAccessNutrition={canAccessNutrition}
          onRestrictedPress={openRestrictedSection}
        />
        <MoodSection />
        <WorkoutSection canAccessWorkoutPlans={canAccessWorkoutPlans} onRestrictedPress={openRestrictedSection} />
        {canAccessChallenges ? (
          <ChallengesSection refreshToken={refreshToken} />
        ) : (
          <View style={styles.lockedSectionCard}>
            <Text style={styles.lockedSectionEyebrow}>CHALLENGES</Text>
            <Text style={styles.lockedSectionTitle}>This section needs a higher plan.</Text>
            <Text style={styles.lockedSectionText}>
              Update your plan to unlock challenge access and community participation.
            </Text>
            <TouchableOpacity style={styles.lockedSectionBtn} onPress={() => openRestrictedSection('Challenges')}>
              <Text style={styles.lockedSectionBtnText}>CHECK ACCESS</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* <AccountabilitySection /> */}
        <InviteFriendsCard />
        <View style={{ height: 20 }} />
      </ScrollView>
      <AccessRestrictionModal
        visible={Boolean(restrictedSection)}
        sectionName={restrictedSection}
        onClose={() => setRestrictedSection('')}
        onUpdatePlan={() => {
          setRestrictedSection('');
          router.push('/plan');
        }}
        onBackHome={() => {
          setRestrictedSection('');
          router.replace('/(tabs)');
        }}
      />
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
  lockedSectionCard: {
    backgroundColor: '#13132A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  lockedSectionEyebrow: {
    color: Colors.accentGold,
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },
  lockedSectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  lockedSectionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  lockedSectionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentGold,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lockedSectionBtnText: {
    color: '#1F1300',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
});
