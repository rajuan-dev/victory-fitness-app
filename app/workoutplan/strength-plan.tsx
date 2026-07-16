import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Share,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  deleteStrengthWorkoutPlan,
  fetchStrengthWorkoutPlans,
  loadLatestStrengthWorkoutPlan,
  StrengthPlanDayProgress,
  StrengthPlanSection,
  StrengthPlanResponse,
  updateStrengthWorkoutPlanProgress,
} from '../../lib/workout-plans';
import { apiRequest, fetchCurrentUser } from '../../lib/api';
import { goBackOrReplace } from '../../lib/navigation';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';
import { useLanguage } from '../../lib/i18n';
import { formatAppError } from '../../lib/error';

type CompletionCard = {
  imageBase64: string;
  fileUri: string;
  mimeType: 'image/png';
  fileName: string;
  shareMessage: string;
  isFullPlan: boolean;
};

async function fetchStrengthCompletionCard(planId: string, dayLabel = '', isFullPlan = false): Promise<CompletionCard> {
  const response = await apiRequest<{
    file_name: string;
    mime_type: string;
    image_base64: string;
    share_message: string;
  }>(`/ai/workout-plan/strength/${encodeURIComponent(planId)}/report?day=${encodeURIComponent(dayLabel)}&full_plan=${isFullPlan ? 'true' : 'false'}`);
  const imageBase64 = response.image_base64;
  return {
    imageBase64,
    fileUri: `data:image/png;base64,${imageBase64}`,
    mimeType: 'image/png',
    fileName: 'victory-fitness-strength-completion.png',
    shareMessage: response.share_message,
    isFullPlan,
  };
}

export default function StrengthPlanDashboard() {
  const checkingAccess = useModuleAccessGuard('/workoutplan');
  const router = useRouter();
  const { t } = useLanguage();
  const [plans, setPlans] = useState<StrengthPlanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [updatingProgressKey, setUpdatingProgressKey] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [currentUserName, setCurrentUserName] = useState('Victory Member');
  const [completionCard, setCompletionCard] = useState<CompletionCard | null>(null);
  const [cardAction, setCardAction] = useState<'download' | 'share' | 'preview' | ''>('');

  // Accordion and Day selection states
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('Day 1');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      try {
        const serverPlans = await fetchStrengthWorkoutPlans();
        if (!cancelled) {
          setPlans(serverPlans);
          if (serverPlans.length > 0) {
            const defaultPlan = serverPlans[0];
            const defaultPlanId = defaultPlan.plan_id ?? defaultPlan.summary;
            setExpandedPlanId(defaultPlanId);
            if (defaultPlan.days && defaultPlan.days.length > 0) {
              setSelectedDay(defaultPlan.days[0].day);
            }
          }
          setLoading(false);
        }
      } catch {
        const storedPlan = await loadLatestStrengthWorkoutPlan();
        if (!cancelled) {
          const plansList = storedPlan ? [storedPlan] : [];
          setPlans(plansList);
          if (plansList.length > 0) {
            const defaultPlan = plansList[0];
            const defaultPlanId = defaultPlan.plan_id ?? defaultPlan.summary;
            setExpandedPlanId(defaultPlanId);
            if (defaultPlan.days && defaultPlan.days.length > 0) {
              setSelectedDay(defaultPlan.days[0].day);
            }
          }
          setLoading(false);
        }
      }
    };

    void loadPlans();
    void fetchCurrentUser().then((user) => setCurrentUserName(user.name || 'Victory Member')).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const getDayProgress = (plan: StrengthPlanResponse, dayLabel: string): StrengthPlanDayProgress | undefined =>
    Array.isArray(plan.progress) ? plan.progress.find((entry) => entry.day === dayLabel) : undefined;

  // Active session timer effect
  useEffect(() => {
    const currentPlan = plans.find((item) => (item.plan_id ?? item.summary) === expandedPlanId);
    if (!currentPlan) return;
    
    const dayProgress = getDayProgress(currentPlan, selectedDay);
    const workoutStarted = Boolean(dayProgress?.started);
    const workoutCompleted = Boolean(dayProgress?.completed);
    
    if (!workoutStarted || workoutCompleted || !dayProgress?.started_at) {
      setElapsedTime('00:00:00');
      return;
    }

    const startMs = new Date(dayProgress.started_at).getTime();

    const updateTimer = () => {
      const nowMs = Date.now();
      const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      
      const hrs = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      
      const pad = (num: number) => String(num).padStart(2, '0');
      setElapsedTime(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expandedPlanId, selectedDay, plans]);

  if (checkingAccess) {
    return null;
  }

  const updatePlanProgressState = (nextPlan: StrengthPlanResponse) => {
    setPlans((current) =>
      current.map((item) => ((item.plan_id ?? item.summary) === (nextPlan.plan_id ?? nextPlan.summary) ? nextPlan : item))
    );
  };

  const toggleSectionExpand = (sectionKey: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  const handleCompleteWorkout = async (plan: StrengthPlanResponse, dayLabel: string) => {
    if (!plan.plan_id) {
      return;
    }

    const progressKey = `complete-${plan.plan_id}-${dayLabel}`;
    try {
      setUpdatingProgressKey(progressKey);
      const updatedPlan = await updateStrengthWorkoutPlanProgress(plan.plan_id, {
        day: dayLabel,
        completed: true,
      });
      updatePlanProgressState(updatedPlan);
      const isFullPlan = updatedPlan.days.length > 0 && updatedPlan.days.every((day) => getDayProgress(updatedPlan, day.day)?.completed);
      setCompletionCard(await fetchStrengthCompletionCard(plan.plan_id, dayLabel, isFullPlan));
    } catch (error) {
      Alert.alert(t('Error'), formatAppError(error, t('Unable to complete workout right now.')).message);
    } finally {
      setUpdatingProgressKey(null);
    }
  };

  const handleShowFullPlanBadge = async (plan: StrengthPlanResponse) => {
    if (!plan.plan_id) return;
    setCardAction('preview');
    try {
      setCompletionCard(await fetchStrengthCompletionCard(plan.plan_id, '', true));
    } catch (error) {
      Alert.alert(t('Error'), formatAppError(error, 'Unable to prepare your completion badge.').message);
    } finally {
      setCardAction('');
    }
  };

  const prepareCardFile = async (card: CompletionCard) => {
    if (Platform.OS === 'web') return card.fileUri;
    const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const fileUri = `${directory}${card.fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, card.imageBase64, { encoding: FileSystem.EncodingType.Base64 });
    return fileUri;
  };

  const handleDownloadCard = async () => {
    if (!completionCard) return;
    setCardAction('download');
    try {
      if (Platform.OS === 'web') {
        const anchor = document.createElement('a');
        anchor.href = completionCard.fileUri;
        anchor.download = completionCard.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        await Share.share({ url: await prepareCardFile(completionCard), message: completionCard.shareMessage });
      }
    } catch (error) {
      Alert.alert(t('Error'), formatAppError(error, 'Unable to export your completion card.').message);
    } finally {
      setCardAction('');
    }
  };

  const handleShareCard = async () => {
    if (!completionCard) return;
    setCardAction('share');
    try {
      if (Platform.OS === 'web' && navigator.share) {
        const blob = await (await fetch(completionCard.fileUri)).blob();
        const file = new File([blob], completionCard.fileName, { type: completionCard.mimeType });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: 'Victory Fitness Strength Card', text: completionCard.shareMessage, files: [file] });
        } else {
          await navigator.share({ title: 'Victory Fitness Strength Card', text: completionCard.shareMessage });
        }
      } else if (Platform.OS === 'web') {
        await handleDownloadCard();
      } else {
        const fileUri = await prepareCardFile(completionCard);
        const shareUrl = Platform.OS === 'android' ? await FileSystem.getContentUriAsync(fileUri) : fileUri;
        await Share.share({ title: 'Victory Fitness Strength Card', url: shareUrl, message: completionCard.shareMessage });
      }
    } catch (error) {
      Alert.alert(t('Error'), formatAppError(error, 'Unable to share your completion card.').message);
    } finally {
      setCardAction('');
    }
  };

  const handleStartWorkout = async (plan: StrengthPlanResponse, dayLabel: string) => {
    if (!plan.plan_id) {
      return;
    }

    const progressKey = `start-${plan.plan_id}-${dayLabel}`;
    try {
      setUpdatingProgressKey(progressKey);
      const updatedPlan = await updateStrengthWorkoutPlanProgress(plan.plan_id, {
        day: dayLabel,
        started: true,
      });
      updatePlanProgressState(updatedPlan);
    } catch (error) {
      Alert.alert(t('Error'), formatAppError(error, t('Unable to start workout right now.')).message);
    } finally {
      setUpdatingProgressKey(null);
    }
  };

  const handleExerciseToggle = async (
    plan: StrengthPlanResponse,
    dayLabel: string,
    exerciseId: string,
    completed: boolean
  ) => {
    if (!plan.plan_id) {
      return;
    }

    const progressKey = `exercise-${plan.plan_id}-${dayLabel}-${exerciseId}`;
    try {
      setUpdatingProgressKey(progressKey);
      const updatedPlan = await updateStrengthWorkoutPlanProgress(plan.plan_id, {
        day: dayLabel,
        exercise_id: exerciseId,
        completed,
      });
      updatePlanProgressState(updatedPlan);
    } catch (error) {
      Alert.alert(t('Error'), formatAppError(error, t('Unable to update workout progress right now.')).message);
    } finally {
      setUpdatingProgressKey(null);
    }
  };

  const handleSectionToggle = async (
    plan: StrengthPlanResponse,
    dayLabel: string,
    sectionId: string,
    completed: boolean
  ) => {
    if (!plan.plan_id) {
      return;
    }

    const progressKey = `section-${plan.plan_id}-${dayLabel}-${sectionId}`;
    try {
      setUpdatingProgressKey(progressKey);
      const updatedPlan = await updateStrengthWorkoutPlanProgress(plan.plan_id, {
        day: dayLabel,
        section_id: sectionId,
        completed,
      });
      updatePlanProgressState(updatedPlan);
    } catch (error) {
      Alert.alert(t('Error'), formatAppError(error, t('Unable to update workout section right now.')).message);
    } finally {
      setUpdatingProgressKey(null);
    }
  };

  const handleDeletePlan = (targetPlan: StrengthPlanResponse) => {
    const planId = targetPlan.plan_id ?? targetPlan.summary;
    if (!planId || deletingPlanId) {
      return;
    }

    Alert.alert(t('Remove Plan'), t('Delete your saved custom strength plan?'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingPlanId(targetPlan.plan_id ?? planId);
            if (targetPlan.plan_id) {
              await deleteStrengthWorkoutPlan(targetPlan.plan_id);
            }
            setPlans((current) => current.filter((item) => (item.plan_id ?? item.summary) !== planId));
            if (expandedPlanId === planId) {
              setExpandedPlanId(null);
            }
          } finally {
            setDeletingPlanId(null);
          }
        },
      },
    ]);
  };

  const handleToggleExpand = (plan: StrengthPlanResponse) => {
    const planId = plan.plan_id ?? plan.summary;
    if (expandedPlanId === planId) {
      setExpandedPlanId(null);
    } else {
      setExpandedPlanId(planId);
      if (plan.days && plan.days.length > 0) {
        setSelectedDay(plan.days[0].day);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={Boolean(completionCard)} transparent animationType="fade" onRequestClose={() => setCompletionCard(null)}>
        <View style={styles.cardModalOverlay}>
          <View style={styles.cardModal}>
            <Text style={styles.cardModalTitle}>{completionCard?.isFullPlan ? 'Custom strength plan completed' : 'Strength workout completed'}</Text>
            {completionCard ? <Image source={{ uri: completionCard.fileUri }} style={styles.completionCardImage} resizeMode="contain" /> : null}
            <View style={styles.cardModalActions}>
              <TouchableOpacity style={styles.cardModalButton} onPress={() => void handleDownloadCard()} disabled={cardAction !== ''}>
                {cardAction === 'download' ? <ActivityIndicator color="#000" /> : <Ionicons name="download-outline" size={18} color="#000" />}
                <Text style={styles.cardModalButtonText}>Download</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cardModalButton} onPress={() => void handleShareCard()} disabled={cardAction !== ''}>
                {cardAction === 'share' ? <ActivityIndicator color="#000" /> : <Ionicons name="share-social-outline" size={18} color="#000" />}
                <Text style={styles.cardModalButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cardModalClose} onPress={() => setCompletionCard(null)}><Text style={styles.cardModalCloseText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('CUSTOM STRENGTH PLAN'),
          headerTransparent: true,
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 2 } as any,
          headerLeft: () => (
            <TouchableOpacity onPress={() => goBackOrReplace(router, '/workoutplan')} style={{ marginLeft: 16 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.accentBlue} />
          <Text style={styles.loadingStateText}>{t('Loading your custom strength plans...')}</Text>
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>{t('No custom strength plan yet')}</Text>
          <Text style={styles.emptyStateText}>{t('Create a plan first from the wizard to see it here.')}</Text>
          <TouchableOpacity style={styles.emptyStateButton} onPress={() => router.replace('/workoutplan/strength-wizard')}>
            <Text style={styles.emptyStateButtonText}>{t('Create Plan')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>{t('YOUR CUSTOM PLANS')}</Text>
            <TouchableOpacity style={styles.generateBtn} onPress={() => router.push('/workoutplan/strength-wizard')}>
              <Text style={styles.generateBtnText}>{t('GENERATE NEW')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.planList}>
            {plans.map((plan, index) => {
              const planId = plan.plan_id ?? plan.summary;
              const isExpanded = expandedPlanId === planId;
              const dayLabels = plan.days?.map((d) => d.day) ?? [];
              const selectedPlanDay = plan.days?.find((d) => d.day === selectedDay) ?? plan.days?.[0] ?? null;
              const selectedDayProgress = selectedPlanDay ? getDayProgress(plan, selectedPlanDay.day) : undefined;
              const completedSectionIds = Array.isArray(selectedDayProgress?.completed_section_ids)
                ? selectedDayProgress.completed_section_ids
                : [];
              const completedExerciseIds = Array.isArray(selectedDayProgress?.completed_exercise_ids)
                ? selectedDayProgress.completed_exercise_ids
                : [];
              const daySections = Array.isArray(selectedPlanDay?.sections) ? selectedPlanDay.sections : [];
              const totalExercises = daySections.reduce((total, section) => total + section.exercises.length, 0);
              const completedExercises = daySections.reduce(
                (total, section) => total + section.exercises.filter((exercise) => completedExerciseIds.includes(exercise.id)).length,
                0
              );
              const completedSections = daySections.filter((section) => completedSectionIds.includes(section.id)).length;
              const totalSections = daySections.length;
              const workoutStarted = Boolean(selectedDayProgress?.started);
              const workoutCompleted = Boolean(selectedDayProgress?.completed);
              const progressSummaryLabel = totalSections > 0
                ? `${completedSections}/${totalSections} ${t('sections completed')} · ${completedExercises}/${totalExercises} ${t('exercises completed')}`
                : 0;
              const startButtonKey = selectedPlanDay ? `start-${plan.plan_id}-${selectedPlanDay.day}` : '';
              const startButtonBusy = updatingProgressKey === startButtonKey;
              const startButtonLabel = workoutCompleted
                ? t('WORKOUT COMPLETED')
                : workoutStarted
                  ? t('CONTINUE WORKOUT')
                  : t('START WORKOUT');
              const progressSummaryText = typeof progressSummaryLabel === 'string'
                ? progressSummaryLabel
                : t('Start this workout to track progress for the day.');

              return (
                <View key={planId ?? `${plan.summary}-${index}`} style={[styles.planCard, isExpanded && styles.planCardExpanded]}>
                  {/* Plan Card Header */}
                  <TouchableOpacity
                    style={styles.planHeader}
                    activeOpacity={0.7}
                    onPress={() => handleToggleExpand(plan)}
                  >
                    <View style={styles.planMain}>
                      <Text style={styles.planSummary} numberOfLines={isExpanded ? 3 : 1}>{plan.summary}</Text>
                    </View>
                    <View style={styles.planActions}>
                      <TouchableOpacity
                        style={[styles.deleteBtnIcon, deletingPlanId === plan.plan_id && styles.disabledBtn]}
                        disabled={deletingPlanId === plan.plan_id}
                        onPress={() => handleDeletePlan(plan)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#F87171" />
                      </TouchableOpacity>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="rgba(255,255,255,0.4)"
                        style={{ marginLeft: 6 }}
                      />
                    </View>
                  </TouchableOpacity>

                  {plan.days.length > 0 && plan.days.every((day) => getDayProgress(plan, day.day)?.completed) && (
                    <TouchableOpacity
                      style={styles.planBadgeButton}
                      onPress={() => void handleShowFullPlanBadge(plan)}
                      disabled={cardAction !== ''}
                    >
                      <Ionicons name="ribbon-outline" size={17} color="#001311" />
                      <Text style={styles.planBadgeButtonText}>VIEW COMPLETION BADGE</Text>
                    </TouchableOpacity>
                  )}

                  {/* Expanded Portion showing details */}
                  {isExpanded && (
                    <View style={styles.planDetails}>
                      <View style={styles.divider} />

                      {workoutStarted && !workoutCompleted ? (
                        /* Active Session Player View */
                        <View style={styles.activeSessionContainer}>
                          {/* Active Session Header */}
                          <View style={styles.activeSessionHeader}>
                            <View style={styles.activeSessionLeft}>
                              <Text style={styles.activeSessionSubtitle}>{t('ACTIVE SESSION')}</Text>
                              <Text style={styles.activeSessionTitle}>{selectedPlanDay ? selectedPlanDay.title.toUpperCase() : ''}</Text>
                            </View>
                            <View style={styles.activeSessionRight}>
                              <Text style={styles.activeSessionElapsedLabel}>{t('ELAPSED')}</Text>
                              <Text style={styles.activeSessionElapsedTimer}>{elapsedTime}</Text>
                            </View>
                          </View>

                          {/* Progress Bar */}
                          <View style={styles.activeSessionProgressBarContainer}>
                            <View 
                              style={[
                                styles.activeSessionProgressBar, 
                                { width: `${totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0}%` }
                              ]} 
                            />
                          </View>

                          {/* Collapsible Sections */}
                          {selectedPlanDay && daySections.length > 0 ? (
                            <View style={styles.exerciseList}>
                              {daySections.map((section: StrengthPlanSection) => {
                                const sectionCompleted = completedSectionIds.includes(section.id);
                                const sectionProgressKey = `section-${plan.plan_id}-${selectedPlanDay.day}-${section.id}`;
                                const sectionBusy = updatingProgressKey === sectionProgressKey;
                                const sectionExpandKey = `${planId}-${selectedPlanDay.day}-${section.id}`;
                                const sectionExpanded = expandedSections[sectionExpandKey] ?? true;
                                const sectionCompletedCount = section.exercises.filter((exercise) => completedExerciseIds.includes(exercise.id)).length;
                                return (
                                  <View key={section.id} style={[styles.activeSectionCard, sectionCompleted && styles.activeSectionCardCompleted]}>
                                    <TouchableOpacity
                                      style={styles.sectionRow}
                                      activeOpacity={0.8}
                                      onPress={() => toggleSectionExpand(sectionExpandKey)}
                                    >
                                      <View style={styles.sectionTitleWrap}>
                                        <Text style={styles.activeSectionType}>{t('SECTION')}</Text>
                                        <Text style={styles.activeSectionName}>{section.title}</Text>
                                        <Text style={styles.activeSectionMetaText}>
                                          {`${sectionCompletedCount}/${section.exercises.length} ${t('exercises')} · ${section.estimated_minutes} ${t('min')}`}
                                        </Text>
                                      </View>
                                      <View style={styles.sectionActions}>
                                        <TouchableOpacity
                                          style={[styles.activeCheckButton, sectionCompleted && styles.activeCheckButtonCompleted]}
                                          activeOpacity={0.8}
                                          disabled={sectionBusy}
                                          onPress={() => handleSectionToggle(plan, selectedPlanDay.day, section.id, !sectionCompleted)}
                                        >
                                          {sectionBusy ? (
                                            <ActivityIndicator size="small" color="#000" />
                                          ) : (
                                            <Ionicons
                                              name={sectionCompleted ? 'checkmark' : 'checkmark-outline'}
                                              size={18}
                                              color={sectionCompleted ? '#000' : Colors.accentBlue}
                                            />
                                          )}
                                        </TouchableOpacity>
                                        <Ionicons
                                          name={sectionExpanded ? 'chevron-up' : 'chevron-down'}
                                          size={18}
                                          color="rgba(255,255,255,0.45)"
                                        />
                                      </View>
                                    </TouchableOpacity>

                                    {sectionExpanded ? (
                                      <View style={styles.sectionExercises}>
                                        {section.exercises.map((ex) => {
                                          const exerciseCompleted = completedExerciseIds.includes(ex.id);
                                          const exerciseProgressKey = `exercise-${plan.plan_id}-${selectedPlanDay.day}-${ex.id}`;
                                          const exerciseBusy = updatingProgressKey === exerciseProgressKey;
                                          return (
                                            <View key={ex.id} style={[styles.activeExerciseSubCard, exerciseCompleted && styles.activeExerciseSubCardCompleted]}>
                                              <View style={styles.exerciseHeader}>
                                                <View style={{ flex: 1, paddingRight: 8 }}>
                                                  <Text style={styles.activeExerciseTag}>{ex.type.toUpperCase()}</Text>
                                                  <Text style={styles.activeExerciseName}>{ex.name}</Text>
                                                </View>
                                                <TouchableOpacity
                                                  style={[styles.activeCheckButton, exerciseCompleted && styles.activeCheckButtonCompleted]}
                                                  activeOpacity={0.8}
                                                  disabled={exerciseBusy}
                                                  onPress={() => handleExerciseToggle(plan, selectedPlanDay.day, ex.id, !exerciseCompleted)}
                                                >
                                                  {exerciseBusy ? (
                                                    <ActivityIndicator size="small" color="#000" />
                                                  ) : (
                                                    <Ionicons
                                                      name={exerciseCompleted ? 'checkmark' : 'checkmark-outline'}
                                                      size={18}
                                                      color={exerciseCompleted ? '#000' : Colors.accentBlue}
                                                    />
                                                  )}
                                                </TouchableOpacity>
                                              </View>

                                              <View style={styles.exerciseMetrics}>
                                                <View style={styles.metricItem}>
                                                  <Ionicons name="layers-outline" size={16} color={Colors.accentBlue} />
                                                  <Text style={styles.metricValue}>{ex.sets} {t('Sets')}</Text>
                                                </View>
                                                <View style={styles.metricItem}>
                                                  <Ionicons name="repeat-outline" size={16} color={Colors.accentBlue} />
                                                  <Text style={styles.metricValue}>{ex.reps} {t('Reps')}</Text>
                                                </View>
                                                <View style={styles.metricItem}>
                                                  <Ionicons name="fitness-outline" size={16} color={Colors.accentBlue} />
                                                  <Text style={styles.metricValue}>{ex.weight}</Text>
                                                </View>
                                                <View style={styles.metricItem}>
                                                  <Ionicons name="timer-outline" size={16} color={Colors.accentBlue} />
                                                  <Text style={styles.metricValue}>{ex.rest} {t('Rest')}</Text>
                                                </View>
                                              </View>
                                            </View>
                                          );
                                        })}
                                      </View>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}

                          {/* Complete Session Button */}
                          <TouchableOpacity
                            style={[styles.completeSessionBtn, startButtonBusy && styles.disabledBtn]}
                            activeOpacity={0.8}
                            disabled={startButtonBusy}
                            onPress={() => handleCompleteWorkout(plan, selectedPlanDay.day)}
                          >
                            {startButtonBusy ? (
                              <ActivityIndicator size="small" color="#000" />
                            ) : (
                              <>
                               <Ionicons name="checkmark-circle" size={20} color="#000" />
                                <Text style={styles.completeSessionBtnText}>{t('WORKOUT COMPLETED')}</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Preview View (Not started or already completed) */
                        <>
                          {/* Day Selector */}
                          {dayLabels.length > 0 && (
                            <View style={styles.daySelectorContainer}>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelectorScroll}>
                                <View style={styles.daySelector}>
                                  {dayLabels.map((day) => {
                                    const isActive = selectedDay === day;
                                    return (
                                      <TouchableOpacity
                                        key={day}
                                        onPress={() => setSelectedDay(day)}
                                        style={[styles.dayBtn, isActive && styles.dayBtnActive]}
                                      >
                                        <Text style={[styles.dayText, isActive && styles.dayTextActive]}>{day}</Text>
                                        {isActive && <View style={styles.activeDot} />}
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </ScrollView>
                            </View>
                          )}

                          {/* Daily Stats */}
                          {selectedPlanDay && (
                            <View style={styles.statsRow}>
                              <View style={styles.statBox}>
                                <Text style={styles.statLabel}>{t('EST. TIME')}</Text>
                                <Text style={styles.statValue}>{selectedPlanDay.est_time ?? '-'}</Text>
                              </View>
                              <View style={styles.statDivider} />
                              <View style={styles.statBox}>
                                <Text style={styles.statLabel}>{t('VOLUME')}</Text>
                                <Text style={styles.statValue}>{selectedPlanDay.volume ?? '-'}</Text>
                              </View>
                              <View style={styles.statDivider} />
                              <View style={styles.statBox}>
                                <Text style={styles.statLabel}>{t('INTENSITY')}</Text>
                                <Text style={styles.statValue}>{selectedPlanDay.intensity ?? '-'}</Text>
                              </View>
                            </View>
                          )}

                          {selectedPlanDay ? (
                            <View style={styles.progressSummaryCard}>
                              <View style={styles.progressSummaryHeader}>
                                <Text style={styles.progressSummaryTitle}>{t('DAY PROGRESS')}</Text>
                                <Text style={[styles.progressSummaryBadge, workoutCompleted && styles.progressSummaryBadgeCompleted]}>
                                  {workoutCompleted ? t('COMPLETED') : workoutStarted ? t('IN PROGRESS') : t('NOT STARTED')}
                                </Text>
                              </View>
                              <Text style={styles.progressSummaryText}>{progressSummaryText}</Text>
                            </View>
                          ) : null}

                          {/* Section List */}
                          {selectedPlanDay && daySections.length > 0 ? (
                            <View style={styles.exerciseList}>
                              <Text style={styles.sectionHeader}>{t("TODAY'S SECTIONS")}</Text>
                              {daySections.map((section: StrengthPlanSection) => {
                                const sectionCompleted = completedSectionIds.includes(section.id);
                                const sectionProgressKey = `section-${plan.plan_id}-${selectedPlanDay.day}-${section.id}`;
                                const sectionBusy = updatingProgressKey === sectionProgressKey;
                                const sectionExpandKey = `${planId}-${selectedPlanDay.day}-${section.id}`;
                                const sectionExpanded = expandedSections[sectionExpandKey] ?? true;
                                const sectionCompletedCount = section.exercises.filter((exercise) => completedExerciseIds.includes(exercise.id)).length;
                                return (
                                  <View key={section.id} style={[styles.exerciseCard, sectionCompleted && styles.exerciseCardCompleted]}>
                                    <TouchableOpacity
                                      style={styles.sectionRow}
                                      activeOpacity={0.8}
                                      onPress={() => toggleSectionExpand(sectionExpandKey)}
                                    >
                                      <View style={styles.sectionTitleWrap}>
                                        <Text style={styles.exerciseType}>{t('SECTION')}</Text>
                                        <Text style={styles.exerciseName}>{section.title}</Text>
                                        <Text style={styles.sectionMetaText}>
                                          {`${sectionCompletedCount}/${section.exercises.length} ${t('exercises')} · ${section.estimated_minutes} ${t('min')}`}
                                        </Text>
                                      </View>
                                      <View style={styles.sectionActions}>
                                        <TouchableOpacity
                                          style={[styles.exerciseCheckButton, sectionCompleted && styles.exerciseCheckButtonCompleted]}
                                          activeOpacity={0.8}
                                          disabled={sectionBusy}
                                          onPress={() => handleSectionToggle(plan, selectedPlanDay.day, section.id, !sectionCompleted)}
                                        >
                                          {sectionBusy ? (
                                            <ActivityIndicator size="small" color={sectionCompleted ? '#001311' : Colors.accentBlue} />
                                          ) : (
                                            <Ionicons
                                              name={sectionCompleted ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                              size={22}
                                              color={sectionCompleted ? '#001311' : Colors.accentBlue}
                                            />
                                          )}
                                        </TouchableOpacity>
                                        <Ionicons
                                          name={sectionExpanded ? 'chevron-up' : 'chevron-down'}
                                          size={18}
                                          color="rgba(255,255,255,0.45)"
                                        />
                                      </View>
                                    </TouchableOpacity>

                                    {sectionExpanded ? (
                                      <View style={styles.sectionExercises}>
                                        {section.exercises.map((ex) => {
                                          const exerciseCompleted = completedExerciseIds.includes(ex.id);
                                          const exerciseProgressKey = `exercise-${plan.plan_id}-${selectedPlanDay.day}-${ex.id}`;
                                          const exerciseBusy = updatingProgressKey === exerciseProgressKey;
                                          return (
                                            <View key={ex.id} style={[styles.exerciseSubCard, exerciseCompleted && styles.exerciseSubCardCompleted]}>
                                              <View style={styles.exerciseHeader}>
                                                <View style={{ flex: 1, paddingRight: 8 }}>
                                                  <Text style={styles.exerciseType}>{ex.type.toUpperCase()}</Text>
                                                  <Text style={styles.exerciseName}>{ex.name}</Text>
                                                </View>
                                                <TouchableOpacity
                                                  style={[styles.exerciseCheckButton, exerciseCompleted && styles.exerciseCheckButtonCompleted]}
                                                  activeOpacity={0.8}
                                                  disabled={exerciseBusy}
                                                  onPress={() => handleExerciseToggle(plan, selectedPlanDay.day, ex.id, !exerciseCompleted)}
                                                >
                                                  {exerciseBusy ? (
                                                    <ActivityIndicator size="small" color={exerciseCompleted ? '#001311' : Colors.accentBlue} />
                                                  ) : (
                                                    <Ionicons
                                                      name={exerciseCompleted ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                                      size={22}
                                                      color={exerciseCompleted ? '#001311' : Colors.accentBlue}
                                                    />
                                                  )}
                                                </TouchableOpacity>
                                              </View>

                                              <View style={styles.exerciseMetrics}>
                                                <View style={styles.metricItem}>
                                                  <Ionicons name="layers-outline" size={16} color={Colors.accentBlue} />
                                                  <Text style={styles.metricValue}>{ex.sets} {t('Sets')}</Text>
                                                </View>
                                                <View style={styles.metricItem}>
                                                  <Ionicons name="repeat-outline" size={16} color={Colors.accentBlue} />
                                                  <Text style={styles.metricValue}>{ex.reps} {t('Reps')}</Text>
                                                </View>
                                                <View style={styles.metricItem}>
                                                  <Ionicons name="fitness-outline" size={16} color={Colors.accentBlue} />
                                                  <Text style={styles.metricValue}>{ex.weight}</Text>
                                                </View>
                                                <View style={styles.metricItem}>
                                                  <Ionicons name="timer-outline" size={16} color={Colors.accentBlue} />
                                                  <Text style={styles.metricValue}>{ex.rest} {t('Rest')}</Text>
                                                </View>
                                              </View>
                                            </View>
                                          );
                                        })}
                                      </View>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}

                          {/* Start Workout Button */}
                          <TouchableOpacity
                            style={[styles.startWorkoutBtn, workoutCompleted && styles.startWorkoutBtnCompleted]}
                            activeOpacity={0.8}
                            disabled={!selectedPlanDay || startButtonBusy}
                            onPress={() => {
                              if (!selectedPlanDay) {
                                return;
                              }
                              void handleStartWorkout(plan, selectedPlanDay.day);
                            }}
                          >
                            {startButtonBusy ? (
                              <ActivityIndicator size="small" color="#000" />
                            ) : (
                              <Ionicons name={workoutCompleted ? 'checkmark-circle' : 'play'} size={20} color="#000" />
                            )}
                            <Text style={styles.startWorkoutBtnText}>{startButtonLabel}</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  cardModal: { width: '100%', maxWidth: 430, maxHeight: '92%', backgroundColor: '#0B1520', borderRadius: 24, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,217,245,0.35)' },
  cardModalTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  completionCardImage: { width: '100%', height: 560, backgroundColor: '#03192A', borderRadius: 16 },
  cardModalActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 14 },
  cardModalButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: Colors.accentBlue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cardModalButtonText: { color: '#000', fontFamily: 'Inter_700Bold' },
  cardModalClose: { padding: 12 },
  cardModalCloseText: { color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter_600SemiBold' },
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  loadingStateText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  emptyStateButtonText: {
    color: '#000',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  scrollContent: {
    paddingTop: 110,
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  sectionTitle: {
    color: Colors.accentBlue,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  generateBtn: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  generateBtnText: {
    color: '#000',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  planList: {
    gap: 12,
  },
  planCard: {
    backgroundColor: '#161616',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 4,
    overflow: 'hidden',
  },
  planCardExpanded: {
    borderColor: 'rgba(6,182,212,0.2)',
  },
  planHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planBadgeButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: Colors.accentBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  planBadgeButtonText: {
    color: '#001311',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.8,
  },
  planMain: {
    flex: 1,
    gap: 4,
  },
  planSummary: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  planActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtnIcon: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  planDetails: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  daySelectorContainer: {
    marginBottom: 20,
  },
  daySelectorScroll: {
    paddingBottom: 4,
  },
  daySelector: {
    flexDirection: 'row',
    backgroundColor: '#202020',
    borderRadius: 16,
    padding: 4,
  },
  dayBtn: {
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    minWidth: 60,
  },
  dayBtnActive: {
    backgroundColor: 'rgba(6,182,212,0.15)',
  },
  dayText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  dayTextActive: {
    color: Colors.accentBlue,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accentBlue,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#202020',
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressSummaryCard: {
    backgroundColor: '#202020',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  progressSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  progressSummaryTitle: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  progressSummaryBadge: {
    color: Colors.accentBlue,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  progressSummaryBadgeCompleted: {
    color: '#34D399',
  },
  progressSummaryText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  exerciseList: {
    gap: 12,
    marginBottom: 20,
  },
  exerciseCard: {
    backgroundColor: '#202020',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  exerciseCardCompleted: {
    borderColor: 'rgba(6,182,212,0.15)',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionMetaText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 6,
  },
  exerciseType: {
    color: Colors.accentBlue,
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  exerciseName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  exerciseCheckButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  exerciseCheckButtonCompleted: {
    backgroundColor: Colors.accentBlue,
  },
  sectionExercises: {
    gap: 10,
    marginTop: 14,
  },
  exerciseSubCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  exerciseSubCardCompleted: {
    borderColor: 'rgba(6,182,212,0.15)',
  },
  exerciseMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  startWorkoutBtn: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  startWorkoutBtnCompleted: {
    backgroundColor: '#34D399',
  },
  startWorkoutBtnText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },

  /* Active Session Styles */
  activeSessionContainer: {
    paddingBottom: 16,
  },
  activeSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  activeSessionLeft: {
    flex: 1,
    paddingRight: 16,
  },
  activeSessionSubtitle: {
    color: Colors.accentBlue,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  activeSessionTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    lineHeight: 28,
  },
  activeSessionRight: {
    alignItems: 'flex-end',
  },
  activeSessionElapsedLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  activeSessionElapsedTimer: {
    color: Colors.accentBlue,
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
  },
  activeSessionProgressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 24,
  },
  activeSessionProgressBar: {
    height: '100%',
    backgroundColor: Colors.accentBlue,
    borderRadius: 2,
  },
  activeSectionCard: {
    backgroundColor: '#161618',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  activeSectionCardCompleted: {
    borderColor: 'rgba(6,182,212,0.2)',
  },
  activeSectionType: {
    color: Colors.accentBlue,
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  activeSectionName: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  activeSectionMetaText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  activeCheckButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,182,212,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
  },
  activeCheckButtonCompleted: {
    backgroundColor: Colors.accentBlue,
    borderColor: Colors.accentBlue,
  },
  activeExerciseSubCard: {
    backgroundColor: '#1E1E22',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeExerciseSubCardCompleted: {
    borderColor: 'rgba(6,182,212,0.15)',
  },
  activeExerciseTag: {
    color: Colors.accentBlue,
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  activeExerciseName: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  completeSessionBtn: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  completeSessionBtnText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
});
