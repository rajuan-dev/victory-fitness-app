import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/Colors';
import { AuthButton } from '../AuthButton';
import { AuthInput } from '../AuthInput';
import { AuthUser, fetchCurrentUserOnboarding, updateCurrentUserOnboarding, updateCurrentUserProfile } from '../../lib/api';
import {
  OnboardingAnamnese,
  OnboardingData,
  OnboardingLanguage,
  OnboardingSuggestion,
} from '../../lib/onboarding';
import { LanguageCode, useLanguage } from '../../lib/i18n';
import { replaceRoute } from '../../lib/navigation';
import { getPostAuthRoute } from '../../lib/access';

const LANGUAGE_OPTIONS: Array<{ value: OnboardingLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
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

function convertWeightToKilograms(weight: string, unit: 'kg' | 'lb') {
  const numericWeight = Number.parseFloat(weight);
  if (!Number.isFinite(numericWeight)) {
    return weight.trim();
  }

  if (unit === 'lb') {
    return (numericWeight * 0.45359237).toFixed(1);
  }

  return numericWeight.toString();
}

export default function PostLoginOnboardingFlow({ user }: Props) {
  const router = useRouter();
  const { setLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saveError, setSaveError] = useState('');
  const [data, setData] = useState<OnboardingData | null>(null);
  const [showGenderModal, setShowGenderModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const stored = await fetchCurrentUserOnboarding().catch(() => null);
      if (!cancelled) {
        const nextData: OnboardingData = stored ? {
          userId: stored.userId,
          currentStep: stored.currentStep,
          language: stored.language,
          personalProfile: stored.personalProfile,
          anamnese: stored.anamnese,
          suggestion: stored.suggestion,
          updatedAt: stored.updatedAt,
        } : {
          userId: user.id,
          currentStep: 0,
          language: '',
          personalProfile: { age: '', gender: '', height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg' },
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
    const draft: OnboardingData = { ...nextData, currentStep: nextStep };
    setData(draft);
    await updateCurrentUserOnboarding({
      currentStep: draft.currentStep,
      language: draft.language,
      personalProfile: draft.personalProfile,
      anamnese: draft.anamnese,
      suggestion: draft.suggestion,
      completed: false,
    });
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
      const age = Number(data.personalProfile.age);
      const height = Number(data.personalProfile.height);
      const weight = Number(data.personalProfile.weight);
      if (!data.personalProfile.age.trim()) {
        nextErrors.age = 'Age is required.';
      } else if (!Number.isFinite(age) || age < 13 || age > 120) {
        nextErrors.age = 'Enter an age between 13 and 120.';
      }
      if (!data.personalProfile.gender.trim()) {
        nextErrors.gender = 'Gender is required.';
      }
      if (!data.personalProfile.height.trim()) {
        nextErrors.height = 'Height is required.';
      } else if (!Number.isFinite(height) || height < 80 || height > 250) {
        nextErrors.height = 'Enter a height between 80 and 250 cm.';
      }
      if (!data.personalProfile.weight.trim()) {
        nextErrors.weight = 'Weight is required.';
      } else if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
        nextErrors.weight = 'Enter a valid weight.';
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

    setSaveError('');

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
        await updateCurrentUserOnboarding({
          currentStep: finalData.currentStep,
          language: finalData.language,
          personalProfile: {
            ...finalData.personalProfile,
            weight: convertWeightToKilograms(finalData.personalProfile.weight, finalData.personalProfile.weightUnit),
            weightUnit: 'kg',
          },
          anamnese: finalData.anamnese,
          suggestion: finalData.suggestion,
          completed: true,
        });
        const updatedUser = await updateCurrentUserProfile({ onboarding_completed: true });
        replaceRoute(router, getPostAuthRoute(updatedUser));
      } catch {
        setSaveError('Unable to save your onboarding details. Please try again.');
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
    setSaving(true);
    try {
      await persistDraft(nextData, nextStep);
      setStep(nextStep);
      setErrors({});
    } catch {
      setSaveError('Unable to save your progress. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = async () => {
    if (!data || step === 0 || saving) {
      return;
    }
    const nextStep = step - 1;
    setSaveError('');
    setSaving(true);
    try {
      await persistDraft(data, nextStep);
      setStep(nextStep);
      setErrors({});
    } catch {
      setSaveError('Unable to save your progress. Please try again.');
    } finally {
      setSaving(false);
    }
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
              
              {/* Age - Numbers only, strings CANNOT be typed! */}
              <AuthInput
                placeholder="Age"
                value={data.personalProfile.age}
                onChangeText={(value) => void updateData((current) => ({ ...current, personalProfile: { ...current.personalProfile, age: value } }))}
                allowedType="number"
                keyboardType="number-pad"
                icon="calendar-outline"
                error={errors.age}
              />

              <Text style={styles.fieldLabel}>Gender</Text>
              <Pressable style={styles.dropdownField} onPress={() => setShowGenderModal(true)}>
                <Text style={[styles.dropdownFieldText, !data.personalProfile.gender && styles.dropdownFieldPlaceholder]}>
                  {data.personalProfile.gender || 'Select gender'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
              </Pressable>
              {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}

              <Text style={styles.fieldLabel}>Height</Text>
              {/* Height - Decimals only, strings CANNOT be typed! */}
              <View style={styles.measurementField}>
                <TextInput
                  style={styles.measurementInput}
                  placeholder="How many cm"
                  placeholderTextColor={Colors.placeholder}
                  value={data.personalProfile.height}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                    void updateData((current) => ({ ...current, personalProfile: { ...current.personalProfile, height: clean } }));
                  }}
                  keyboardType="decimal-pad"
                />
                <View style={styles.measurementUnitBadge}>
                  <Text style={styles.measurementUnitText}>cm</Text>
                </View>
              </View>
              {errors.height ? <Text style={styles.errorText}>{errors.height}</Text> : null}
              <Text style={styles.helperText}>This helps us calculate your personalized nutrition and training targets - visible only to you.</Text>

              <Text style={styles.fieldLabel}>Weight</Text>
              {/* Weight - Decimals only, strings CANNOT be typed! */}
              <View style={styles.measurementField}>
                <TextInput
                  style={styles.measurementInput}
                  placeholder={data.personalProfile.weightUnit === 'lb' ? 'How many lb' : 'How many kg'}
                  placeholderTextColor={Colors.placeholder}
                  value={data.personalProfile.weight}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                    void updateData((current) => ({ ...current, personalProfile: { ...current.personalProfile, weight: clean } }));
                  }}
                  keyboardType="decimal-pad"
                />
                <View style={styles.unitSelectorRow}>
                  {(['kg', 'lb'] as const).map((unit) => (
                    <Pressable
                      key={unit}
                      onPress={() => void updateData((current) => ({ ...current, personalProfile: { ...current.personalProfile, weightUnit: unit } }))}
                      style={[styles.unitSelectorPill, data.personalProfile.weightUnit === unit && styles.unitSelectorPillActive]}
                    >
                      <Text style={[styles.unitSelectorText, data.personalProfile.weightUnit === unit && styles.unitSelectorTextActive]}>{unit.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {errors.weight ? <Text style={styles.errorText}>{errors.weight}</Text> : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Text style={styles.stepTitle}>Sport and health anamnese</Text>
              <Text style={styles.stepText}>Answer these five questions so we can shape the right plan recommendation.</Text>

              <Text style={styles.questionTitle}>1. What is your primary goal?</Text>
              <View style={styles.optionGridSingle}>
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
              <View style={styles.optionGridSingle}>
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
              <View style={styles.optionGridSingle}>
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
              {/* Health Notes - Allows both strings and numbers */}
              <TextInput
                value={data.anamnese.healthNotes}
                onChangeText={(value) => void updateData((current) => ({ ...current, anamnese: { ...current.anamnese, healthNotes: value } }))}
                placeholder="Add details if needed"
                placeholderTextColor={Colors.placeholder}
                multiline
                style={styles.notesInput}
              />

              <Text style={styles.questionTitle}>4. How many days per week can you realistically commit?</Text>
              <View style={styles.optionGridSingle}>
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

              <Text style={styles.questionTitle}>5. How much time can you commit per session?</Text>
              <View style={styles.optionGridSingle}>
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

              <Text style={styles.questionTitle}>6. What equipment or environment do you have access to?</Text>
              <View style={styles.optionGridSingle}>
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
                <Text style={styles.reviewLine}>Height: {data.personalProfile.height ? `${data.personalProfile.height} ${data.personalProfile.heightUnit}` : '-'}</Text>
                <Text style={styles.reviewLine}>Weight: {data.personalProfile.weight ? `${data.personalProfile.weight} ${data.personalProfile.weightUnit}` : '-'}</Text>
                <Text style={styles.reviewLine}>Goal: {data.anamnese.primaryGoal || '-'}</Text>
                <Text style={styles.reviewLine}>Activity: {data.anamnese.activityLevel || '-'}</Text>
                <Text style={styles.reviewLine}>Commitment: {data.anamnese.daysPerWeek || '-'} / {data.anamnese.timePerSession || '-'}</Text>
                <Text style={styles.reviewLine}>Equipment: {data.anamnese.equipmentAccess || '-'}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        <View style={styles.actionsRow}>
          <Pressable onPress={() => void handleBack()} disabled={step === 0 || saving} style={[styles.secondaryButton, step === 0 && styles.secondaryButtonDisabled]}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
          <View style={styles.primaryButtonWrap}>
            <AuthButton
              title={step === 3 ? 'Continue to Subscription' : 'Next'}
              onPress={() => void handleNext()}
              disabled={saving}
              loading={saving}
            />
          </View>
        </View>
      </ScrollView>
      <Modal visible={showGenderModal} transparent animationType="fade" onRequestClose={() => setShowGenderModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowGenderModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select gender</Text>
            {GENDER_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={styles.modalOption}
                onPress={() => {
                  setShowGenderModal(false);
                  void updateData((current) => ({ ...current, personalProfile: { ...current.personalProfile, gender: option } }));
                }}
              >
                <Text style={[styles.modalOptionText, data.personalProfile.gender === option && styles.modalOptionTextActive]}>{option}</Text>
                {data.personalProfile.gender === option ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
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
    color: Colors.primary,
  },
  card: {
    backgroundColor: 'rgba(18, 22, 34, 0.85)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
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
  fieldLabel: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 4,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  optionGridSingle: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 8,
  },
  optionCard: {
    width: '100%',
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0, 240, 208, 0.14)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
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
    marginBottom: 12,
  },
  dropdownField: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dropdownFieldText: {
    color: Colors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  dropdownFieldPlaceholder: {
    color: Colors.placeholder,
  },
  measurementField: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  measurementInput: {
    flex: 1,
    minWidth: 0,
    color: Colors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    paddingVertical: 14,
    paddingRight: 4,
    outlineStyle: 'none' as any,
  },
  measurementUnitBadge: {
    borderRadius: 10,
    backgroundColor: 'rgba(0, 240, 208, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 208, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  measurementUnitText: {
    color: Colors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 12.5,
    letterSpacing: 0.4,
  },
  unitSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  unitSelectorPill: {
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitSelectorPillActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  unitSelectorText: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_700Bold',
    fontSize: 11.5,
    letterSpacing: 0.3,
  },
  unitSelectorTextActive: {
    color: '#051614',
  },
  errorText: {
    color: '#EF4444',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: -4,
    marginBottom: 10,
  },
  saveError: {
    color: '#EF4444',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    textAlign: 'center',
  },
  questionTitle: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    marginBottom: 10,
  },
  notesInput: {
    minHeight: 94,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
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
    padding: 20,
    backgroundColor: 'rgba(0, 240, 208, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 240, 208, 0.3)',
    marginBottom: 18,
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
    padding: 18,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
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
    fontSize: 13.5,
    lineHeight: 21,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 15, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 22,
  },
  modalTitle: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginBottom: 16,
  },
  modalOption: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  modalOptionText: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  modalOptionTextActive: {
    color: Colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  secondaryButton: {
    width: 100,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(18, 22, 34, 0.8)',
    paddingHorizontal: 12,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButtonWrap: {
    flex: 1,
    height: 56,
  },
});
