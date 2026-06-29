import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
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
import { fetchCurrentUser, updateCurrentUserBodyMetrics } from '../../lib/api';
import { canAccessFeature, canAccessPlanRoute } from '../../lib/access';
import { useRouter } from 'expo-router';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';
import { useLanguage } from '../../lib/i18n';
import { replaceRoute } from '../../lib/navigation';
import { markWeightPromptHandled, shouldShowWeightUpdatePrompt, updateUserWeight } from '../../lib/onboarding';

export default function HomeScreen() {
  const checkingAccess = useModuleAccessGuard('/');
  const router = useRouter();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [canAccessNutrition, setCanAccessNutrition] = React.useState(true);
  const [canAccessChallenges, setCanAccessChallenges] = React.useState(true);
  const [canAccessCoachVictor, setCanAccessCoachVictor] = React.useState(true);
  const [canAccessWorkoutPlans, setCanAccessWorkoutPlans] = React.useState(true);
  const [restrictedSection, setRestrictedSection] = React.useState('');
  const [weightPromptVisible, setWeightPromptVisible] = React.useState(false);
  const [weightPromptEditing, setWeightPromptEditing] = React.useState(false);
  const [weightPromptSaving, setWeightPromptSaving] = React.useState(false);
  const [weightDraft, setWeightDraft] = React.useState('');
  const [weightPromptUserId, setWeightPromptUserId] = React.useState('');

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
          const shouldPrompt = Boolean(user.onboarding_completed) && await shouldShowWeightUpdatePrompt(user.id);
          if (!cancelled && shouldPrompt) {
            setWeightPromptUserId(user.id);
            setWeightDraft('');
            setWeightPromptEditing(false);
            setWeightPromptVisible(true);
          }
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

  const handleDismissWeightPrompt = React.useCallback(async () => {
    if (!weightPromptUserId) {
      setWeightPromptVisible(false);
      return;
    }

    await markWeightPromptHandled(weightPromptUserId);
    setWeightPromptVisible(false);
    setWeightPromptEditing(false);
    setWeightDraft('');
  }, [weightPromptUserId]);

  const handleSaveWeightPrompt = React.useCallback(async () => {
    if (!weightPromptUserId || !weightDraft.trim() || weightPromptSaving) {
      return;
    }

    setWeightPromptSaving(true);
    try {
      await Promise.allSettled([
        updateUserWeight(weightPromptUserId, weightDraft),
        updateCurrentUserBodyMetrics({ weight: weightDraft.trim() }),
      ]);
      setWeightPromptVisible(false);
      setWeightPromptEditing(false);
      setWeightDraft('');
    } finally {
      setWeightPromptSaving(false);
    }
  }, [weightDraft, weightPromptSaving, weightPromptUserId]);

  if (checkingAccess) {
    return null;
  }

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
            <Text style={styles.lockedSectionEyebrow}>{t('CHALLENGES')}</Text>
            <Text style={styles.lockedSectionTitle}>{t('This section needs a higher plan.')}</Text>
            <Text style={styles.lockedSectionText}>
              {t('Update your plan to unlock challenge access and community participation.')}
            </Text>
            <TouchableOpacity style={styles.lockedSectionBtn} onPress={() => openRestrictedSection(t('CHALLENGES'))}>
              <Text style={styles.lockedSectionBtnText}>{t('CHECK ACCESS')}</Text>
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
          replaceRoute(router, '/(tabs)');
        }}
      />
      <Modal visible={weightPromptVisible} transparent animationType="fade" onRequestClose={() => void handleDismissWeightPrompt()}>
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Update your current weight?</Text>
            <Text style={styles.promptText}>
              Would you like to update your current weight? This helps us keep your nutrition and training plans accurate.
            </Text>

            {weightPromptEditing ? (
              <TextInput
                value={weightDraft}
                onChangeText={setWeightDraft}
                placeholder="Enter your current weight"
                placeholderTextColor={Colors.placeholder}
                style={styles.promptInput}
              />
            ) : null}

            <TouchableOpacity style={styles.promptPrimaryButton} onPress={() => (weightPromptEditing ? void handleSaveWeightPrompt() : setWeightPromptEditing(true))} disabled={weightPromptSaving}>
              <Text style={styles.promptPrimaryButtonText}>{weightPromptEditing ? 'Save Weight' : 'Update Now'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.promptSecondaryButton} onPress={() => void handleDismissWeightPrompt()}>
              <Text style={styles.promptSecondaryButtonText}>Remind Me Later</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.promptGhostButton} onPress={() => void handleDismissWeightPrompt()}>
              <Text style={styles.promptGhostButtonText}>No Change</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  lockedSectionText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  promptCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  promptTitle: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },
  promptText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    marginBottom: 18,
  },
  promptInput: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    paddingHorizontal: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginBottom: 14,
    outlineStyle: 'none' as any,
  },
  promptPrimaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  promptPrimaryButtonText: {
    color: '#062724',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  promptSecondaryButton: {
    backgroundColor: Colors.accentSurface,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  promptSecondaryButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  promptGhostButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  promptGhostButtonText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
