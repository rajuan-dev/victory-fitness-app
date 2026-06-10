import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  deleteStrengthWorkoutPlan,
  fetchStrengthWorkoutPlans,
  loadLatestStrengthWorkoutPlan,
  StrengthPlanResponse,
} from '../../lib/workout-plans';
import { goBackOrReplace } from '../../lib/navigation';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';
import { useLanguage } from '../../lib/i18n';

export default function StrengthPlanDashboard() {
  const checkingAccess = useModuleAccessGuard('/workoutplan');
  const router = useRouter();
  const { t } = useLanguage();
  const [plans, setPlans] = useState<StrengthPlanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  // Accordion and Day selection states
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('Day 1');

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

    return () => {
      cancelled = true;
    };
  }, []);

  if (checkingAccess) {
    return null;
  }

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

                  {/* Expanded Portion showing details */}
                  {isExpanded && (
                    <View style={styles.planDetails}>
                      <View style={styles.divider} />

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

                      {/* Exercises List */}
                      {selectedPlanDay && selectedPlanDay.exercises && selectedPlanDay.exercises.length > 0 ? (
                        <View style={styles.exerciseList}>
                          <Text style={styles.sectionHeader}>{t("TODAY'S EXERCISES")}</Text>
                          {selectedPlanDay.exercises.map((ex) => (
                            <View key={ex.id} style={styles.exerciseCard}>
                              <View style={styles.exerciseHeader}>
                                <View>
                                  <Text style={styles.exerciseType}>{ex.type.toUpperCase()}</Text>
                                  <Text style={styles.exerciseName}>{ex.name}</Text>
                                </View>
                                <TouchableOpacity style={styles.infoIcon}>
                                  <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.3)" />
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
                          ))}
                        </View>
                      ) : null}

                      {/* Start Workout Button */}
                      <TouchableOpacity
                        style={styles.startWorkoutBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                          Alert.alert(t('Workout Started'), t('Your workout session has begun! Enjoy your custom training.'));
                        }}
                      >
                        <Ionicons name="play" size={20} color="#000" />
                        <Text style={styles.startWorkoutBtnText}>{t('START WORKOUT')}</Text>
                      </TouchableOpacity>
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
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  infoIcon: {
    marginTop: 2,
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
  startWorkoutBtnText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
});
