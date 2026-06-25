import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Colors } from '../../constants/Colors';
import { AuthButton } from '../AuthButton';
import { AuthInput } from '../AuthInput';
import { AuthUser, updateCurrentUserBodyMetrics, updateCurrentUserProfile } from '../../lib/api';
import {
  completeOnboarding,
  getOnboardingData,
  OnboardingAnamnese,
  OnboardingData,
  OnboardingLanguage,
  OnboardingSuggestion,
  saveOnboardingData,
} from '../../lib/onboarding';
import { LanguageCode, useLanguage } from '../../lib/i18n';
import { replaceRoute } from '../../lib/navigation';

const LANGUAGE_OPTIONS: Array<{ value: OnboardingLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italian' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
];

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const PRIMARY_GOAL_OPTIONS = ['Lose weight', 'Build muscle', 'Improve endurance', 'General health and energy', 'Recovery and rehab'];
const ACTIVITY_LEVEL_OPTIONS = ['Sedentary', 'Lightly active', 'Moderately active', 'Very active'];
const HEALTH_CONCERN_OPTIONS = ['Knee', 'Back', 'Shoulder', 'Heart condition', 'None'];
const DAYS_OPTIONS = ['1-2 days', '3-4 days', '5+ days'];
const SESSION_OPTIONS = ['20 minutes', '30 minutes', '45 minutes', '60+ minutes'];
const EQUIPMENT_OPTIONS = ['No equipment', 'Home gym', 'Full gym', 'Outdoors'];
const STEP_TITLES = ['Language', 'Profile', 'Health', 'Recommendation'];

function isSupportedAppLanguage(value: OnboardingLanguage): value is LanguageCode {
  return value === 'en' || value === 'de';
}

type Props = {
  user: AuthUser;
};

type ValidationErrors = Record<string, string>;

function getSuggestedTier(anamnese: OnboardingAnamnese): OnboardingSuggestion {
  const goal = anamnese.primaryGoal;
  const activityLevel = anamnese.activityLevel;
  const needsRecoveryPlan = goal === 'Recovery and rehab' || anamnese.healthConcerns.includes('Heart condition');
  const advancedUser = goal === 'Build muscle' || goal === 'Improve endurance' || activityLevel === 'Very active';

  if (needsRecoveryPlan) {
    return {
      tier: 'GOLD',
      title: 'Victory Gold Trial',
      reason: 'A safer structured starting point is best here so you can use guided training and nutrition support without overloading your plan.',
      note: 'Recovery and rehab guidance inside the app does not replace medical advice. If pain or a medical condition is active, follow your clinician’s guidance first.',
    };
  }

  if (advancedUser) {
    return {
      tier: 'PLATINUM',
      title: 'Victory Platinum',
      reason: 'Your answers point to a more demanding training setup, so the deeper tracking and personalized planning tools will fit better.',
    };
  }

  return {
    tier: 'GOLD',
    title: 'Victory Gold Trial',
    reason: 'This is the best starting point for building consistency with nutrition and training support. If you are unsure, the 5-days paid trial with money back Guarantee (Gold Tier) lets you test the AI services first.',
  };
}

export default function PostLoginOnboardingFlow({ user }: Props) {
  const router = useRouter();
  const { setLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [data, setData] = useState<OnboardingData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const stored = await getOnboardingData(user.id);
      if (!cancelled) {
        const nextData = stored ?? {
          userId: user.id,
          currentStep: 0,
          language: '',
          personalProfile: { age: '', gender: '', height: '', weight: '' },
          anamnese: {
            primaryGoal: '',
            activityLevel: '',
            healthConcerns: [],
            healthNotes: '',
            daysPerWeek: '',
            timePerSession: '',
            equipmentAccess: '',
          },
          suggestion: null,
          updatedAt: null,
        };
        setData(nextData);
        setStep(Math.min(nextData.currentStep ?? 0, STEP_TITLES.length - 1));
        setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const suggestion = useMemo(() => (data ? getSuggestedTier(data.anamnese) : null), [data]);

  const persistDraft = async (nextData: OnboardingData, nextStep = step) => {
    const draft = { ...nextData, currentStep: nextStep };
    setData(draft);
    await saveOnboardingData(draft);
  };

  const validateCurrentStep = () => {
    if (!data) {
      return false;
    }

    const nextErrors: ValidationErrors = {};
    if (step === 0) {
      if (!data.language) {
        nextErrors.language = 'Please select your preferred language.';
      }
    }

    if (step === 1) {
      if (!data.personalProfile.age.trim()) {
        nextErrors.age = 'Age is required.';
      }
      if (!data.personalProfile.gender.trim()) {
        nextErrors.gender = 'Gender is required.';
      }
      if (!data.personalProfile.height.trim()) {
        nextErrors.height = 'Height is required.';
      }
      if (!data.personalProfile.weight.trim()) {
        nextErrors.weight = 'Weight is required.';
      }
    }

    if (step === 2) {
      if (!data.anamnese.primaryGoal) {
        nextErrors.primaryGoal = 'Please choose your primary goal.';
      }
      if (!data.anamnese.activityLevel) {
        nextErrors.activityLevel = 'Please choose your activity level.';
      }
      if (!data.anamnese.daysPerWeek) {
        nextErrors.daysPerWeek = 'Please choose your weekly commitment.';
      }
      if (!data.anamnese.timePerSession) {
        nextErrors.timePerSession = 'Please choose your session time.';
      }
      if (!data.anamnese.equipmentAccess) {
        nextErrors.equipmentAccess = 'Please choose your available environment.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = async () => {
    if (!data || saving) {
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    if (step === 0 && data.language && isSupportedAppLanguage(data.language)) {
      await setLanguage(data.language);
    }

    if (step === STEP_TITLES.length - 1) {
      setSaving(true);
      try {
        const finalData: OnboardingData = {
          ...data,
          suggestion,
          currentStep: STEP_TITLES.length - 1,
          updatedAt: new Date().toISOString(),
        };
        await completeOnboarding(finalData);
        await Promise.allSettled([
          updateCurrentUserProfile({ onboarding_completed: true }),
          updateCurrentUserBodyMetrics({
            age: finalData.personalProfile.age,
            gender: finalData.personalProfile.gender,
            height: finalData.personalProfile.height,
            weight: finalData.personalProfile.weight,
          }),
        ]);
        replaceRoute(router, '/plan');
      } finally {
        setSaving(false);
      }
      return;
    }

    const nextStep = step + 1;
    const nextData: OnboardingData = {
      ...data,
      suggestion: nextStep >= 3 ? suggestion : data.suggestion,
    };
    await persistDraft(nextData, nextStep);
    setStep(nextStep);
    setErrors({});
  };

  const handleBack = async () => {
    if (!data || step === 0 || saving) {
      return;
    }
    const nextStep = step - 1;
    await persistDraft(data, nextStep);
    setStep(nextStep);
    setErrors({});
  };

  const updateData = async (updater: (current: OnboardingData) => OnboardingData) => {
    if (!data) {
      return;
    }
    const nextData = {
      ...updater(data),
      currentStep: step,
    };
    setData(nextData);
    await saveOnboardingData(nextData);
  };

  const toggleHealthConcern = (value: string) => {
    if (!data) {
      return;
    }
    const current = data.anamnese.healthConcerns;
    let nextValues = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    if (value === 'None') {
      nextValues = current.includes('None') ? [] : ['None'];
    } else {
      nextValues = nextValues.filter((item) => item !== 'None');
    }

    void updateData((currentData) => ({
      ...currentData,
      anamnese: {
        ...currentData.anamnese,
        healthConcerns: nextValues,
      },
    }));
  };

  if (loading || !data) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>VICTORY FITNESS</Text>
        <Text style={styles.title}>Build your personalized start</Text>
        <Text style={styles.subtitle}>Complete these steps once and we will keep your plan setup on this device.</Text>

        <View style={styles.progressRow}>
          {STEP_TITLES.map((label, index) => (
            <View key={label} style={styles.progressItem}>
              <View style={[styles.progressDot, index <= step && styles.progressDotActive]}>
                <Text style={[styles.progressDotText, index <= step && styles.progressDotTextActive]}>{index + 1}</Text>
              </View>
              <Text style={[styles.progressLabel, index === step && styles.progressLabelActive]}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          {step === 0 ? (
            <View>
              <Text style={styles.stepTitle}>Preferred language</Text>
              <Text style={styles.stepText}>Choose the language you want to use inside the app.</Text>
              <View style={styles.optionGrid}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => void updateData((current) => ({ ...current, language: option.value }))}
                    style={[styles.optionCard, data.language === option.value && styles.optionCardActive]}
                  >
                    <Text style={[styles.optionLabel, data.language === option.value && styles.optionLabelActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.language ? <Text style={styles.errorText}>{errors.language}</Text> : null}
            </View>
          ) : null}

          {step === 1 ? (
            <View>
              <Text style={styles.stepTitle}>Personal profile</Text>
              <Text style={styles.stepText}>These answers set your personalized targets and can be updated later from your profile.</Text>
              <AuthInput
                placeholder="Age"
                value={data.personalProfile.age}
                onChangeText={(value) => void updateData((current) => ({ ...current, personalProfile: { ...current.personalProfile, age: value } }))}
                keyboardType="number-pad"
              />
              {errors.age ? <Text style={styles.errorText}>{errors.age}</Text> : null}
              <View style={styles.optionGrid}>
                {GENDER_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => void updateData((current) => ({ ...current, personalProfile: { ...current.personalProfile, gender: option } }))}
                    style={[styles.optionCard, data.personalProfile.gender === option && styles.optionCardActive]}
                  >
                    <Text style={[styles.optionLabel, data.personalProfile.gender === option && styles.optionLabelActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
              <AuthInput
                placeholder="Height"
                value={data.personalProfile.height}
                onChangeText={(value) => void updateData((current) => ({ ...current, personalProfile: { ...current.personalProfile, height: value } }))}
              />
              {errors.height ? <Text style={styles.errorText}>{errors.height}</Text> : null}
              <Text style={styles.helperText}>This helps us calculate your personalized nutrition and training targets - visible only to you.</Text>
              <AuthInput
                placeholder="Weight"
                value={data.personalProfile.weight}
                onChangeText={(value) => void updateData((current) => ({ ...current, personalProfile: { ...current.personalProfile, weight: value } }))}
              />
              {errors.weight ? <Text style={styles.errorText}>{errors.weight}</Text> : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Text style={styles.stepTitle}>Sport and health anamnese</Text>
              <Text style={styles.stepText}>Answer these five questions so we can shape the right plan recommendation.</Text>

              <Text style={styles.questionTitle}>1. What is your primary goal?</Text>
              <View style={styles.optionGrid}>
                {PRIMARY_GOAL_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => void updateData((current) => ({ ...current, anamnese: { ...current.anamnese, primaryGoal: option } }))}
                    style={[styles.optionCard, data.anamnese.primaryGoal === option && styles.optionCardActive]}
                  >
                    <Text style={[styles.optionLabel, data.anamnese.primaryGoal === option && styles.optionLabelActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.primaryGoal ? <Text style={styles.errorText}>{errors.primaryGoal}</Text> : null}

              <Text style={styles.questionTitle}>2. How would you describe your current activity level?</Text>
              <View style={styles.optionGrid}>
                {ACTIVITY_LEVEL_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => void updateData((current) => ({ ...current, anamnese: { ...current.anamnese, activityLevel: option } }))}
                    style={[styles.optionCard, data.anamnese.activityLevel === option && styles.optionCardActive]}
                  >
                    <Text style={[styles.optionLabel, data.anamnese.activityLevel === option && styles.optionLabelActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.activityLevel ? <Text style={styles.errorText}>{errors.activityLevel}</Text> : null}

              <Text style={styles.questionTitle}>3. Do you currently have, or have you had in the last 12 months, any injuries, pain, or medical conditions we should know about?</Text>
              <View style={styles.optionGrid}>
                {HEALTH_CONCERN_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => toggleHealthConcern(option)}
                    style={[styles.optionCard, data.anamnese.healthConcerns.includes(option) && styles.optionCardActive]}
                  >
                    <Text style={[styles.optionLabel, data.anamnese.healthConcerns.includes(option) && styles.optionLabelActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={data.anamnese.healthNotes}
                onChangeText={(value) => void updateData((current) => ({ ...current, anamnese: { ...current.anamnese, healthNotes: value } }))}
                placeholder="Add details if needed"
                placeholderTextColor={Colors.placeholder}
                multiline
                style={styles.notesInput}
              />

              <Text style={styles.questionTitle}>4. How many days per week can you realistically commit, and how much time per session?</Text>
              <View style={styles.optionGrid}>
                {DAYS_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => void updateData((current) => ({ ...current, anamnese: { ...current.anamnese, daysPerWeek: option } }))}
                    style={[styles.optionCard, data.anamnese.daysPerWeek === option && styles.optionCardActive]}
                  >
                    <Text style={[styles.optionLabel, data.anamnese.daysPerWeek === option && styles.optionLabelActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.daysPerWeek ? <Text style={styles.errorText}>{errors.daysPerWeek}</Text> : null}
              <View style={styles.optionGrid}>
                {SESSION_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => void updateData((current) => ({ ...current, anamnese: { ...current.anamnese, timePerSession: option } }))}
                    style={[styles.optionCard, data.anamnese.timePerSession === option && styles.optionCardActive]}
                  >
                    <Text style={[styles.optionLabel, data.anamnese.timePerSession === option && styles.optionLabelActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.timePerSession ? <Text style={styles.errorText}>{errors.timePerSession}</Text> : null}

              <Text style={styles.questionTitle}>5. What equipment or environment do you have access to?</Text>
              <View style={styles.optionGrid}>
                {EQUIPMENT_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => void updateData((current) => ({ ...current, anamnese: { ...current.anamnese, equipmentAccess: option } }))}
                    style={[styles.optionCard, data.anamnese.equipmentAccess === option && styles.optionCardActive]}
                  >
                    <Text style={[styles.optionLabel, data.anamnese.equipmentAccess === option && styles.optionLabelActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.equipmentAccess ? <Text style={styles.errorText}>{errors.equipmentAccess}</Text> : null}
            </View>
          ) : null}

          {step === 3 && suggestion ? (
            <View>
              <Text style={styles.stepTitle}>Suggested tier</Text>
              <Text style={styles.stepText}>Based on your answers, this is the strongest starting point for your next step inside the app.</Text>
              <View style={styles.recommendationCard}>
                <Text style={styles.recommendationEyebrow}>RECOMMENDED</Text>
                <Text style={styles.recommendationTitle}>{suggestion.title}</Text>
                <Text style={styles.recommendationReason}>{suggestion.reason}</Text>
                {suggestion.note ? <Text style={styles.recommendationNote}>{suggestion.note}</Text> : null}
              </View>
              <View style={styles.reviewCard}>
                <Text style={styles.reviewTitle}>Review answers</Text>
                <Text style={styles.reviewLine}>Language: {LANGUAGE_OPTIONS.find((option) => option.value === data.language)?.label ?? '-'}</Text>
                <Text style={styles.reviewLine}>Age: {data.personalProfile.age || '-'}</Text>
                <Text style={styles.reviewLine}>Gender: {data.personalProfile.gender || '-'}</Text>
                <Text style={styles.reviewLine}>Height: {data.personalProfile.height || '-'}</Text>
                <Text style={styles.reviewLine}>Weight: {data.personalProfile.weight || '-'}</Text>
                <Text style={styles.reviewLine}>Goal: {data.anamnese.primaryGoal || '-'}</Text>
                <Text style={styles.reviewLine}>Activity: {data.anamnese.activityLevel || '-'}</Text>
                <Text style={styles.reviewLine}>Commitment: {data.anamnese.daysPerWeek || '-'} / {data.anamnese.timePerSession || '-'}</Text>
                <Text style={styles.reviewLine}>Equipment: {data.anamnese.equipmentAccess || '-'}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <Pressable onPress={() => void handleBack()} disabled={step === 0 || saving} style={[styles.secondaryButton, step === 0 && styles.secondaryButtonDisabled]}>
            <Text style={styles.secondaryButtonText}>{step === 3 ? 'Review Answers' : 'Back'}</Text>
          </Pressable>
          <View style={styles.primaryButtonWrap}>
            <AuthButton
              title={step === 3 ? 'Continue to Subscription' : 'Next'}
              onPress={() => void handleNext()}
              disabled={saving}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  eyebrow: {
    color: Colors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 1.3,
    marginBottom: 10,
  },
  title: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    marginBottom: 10,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 22,
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  progressDotText: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  progressDotTextActive: {
    color: '#062724',
  },
  progressLabel: {
    color: Colors.textMuted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  stepTitle: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 21,
    marginBottom: 8,
  },
  stepText: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  optionCard: {
    minWidth: '47%',
    flexGrow: 1,
    backgroundColor: Colors.accentSurface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0,240,208,0.14)',
  },
  optionLabel: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  optionLabelActive: {
    color: Colors.text,
  },
  helperText: {
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  errorText: {
    color: Colors.accentDanger,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: -2,
    marginBottom: 10,
  },
  questionTitle: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 10,
  },
  notesInput: {
    minHeight: 94,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginBottom: 4,
    textAlignVertical: 'top',
    outlineStyle: 'none' as any,
  },
  recommendationCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: 'rgba(0,240,208,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,240,208,0.22)',
    marginBottom: 16,
  },
  recommendationEyebrow: {
    color: Colors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  recommendationTitle: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    marginBottom: 8,
  },
  recommendationReason: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  recommendationNote: {
    color: '#FDE68A',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  reviewCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: Colors.accentSurface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reviewTitle: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    marginBottom: 10,
  },
  reviewLine: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  secondaryButton: {
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  primaryButtonWrap: {
    flex: 1,
  },
});
