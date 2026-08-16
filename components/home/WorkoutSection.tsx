import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../lib/i18n';
import {
  fetchLatestStrengthWorkoutPlan,
  loadLatestStrengthWorkoutPlan,
  loadLatestVideoWorkoutPlan,
  StrengthPlanResponse,
  VideoPlanResponse,
} from '../../lib/workout-plans';

type WorkoutSectionProps = {
  canAccessWorkoutPlans?: boolean;
  onRestrictedPress?: (sectionName: string) => void;
};

function getPlanDisplayData(summary: string, defaultTitle: string) {
  if (!summary) return { title: defaultTitle, description: '' };
  
  const cleanSummary = summary.replace(/\s+/g, ' ').trim();
  
  const match = cleanSummary.match(/^(.*?)\s+plan\s+using\s+a\s+(.*)$/i) || 
                cleanSummary.match(/^(.*?)\s+plan\s+with\s+(.*)$/i) ||
                cleanSummary.match(/^(.*?)\s+built\s+for\s+(.*)$/i);
                
  if (match) {
    const rawTitle = match[1];
    let rawDesc = match[2];
    
    const title = rawTitle
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ') + ' Plan';
      
    const description = rawDesc.charAt(0).toUpperCase() + rawDesc.slice(1);
    
    return { title, description };
  }
  
  const words = cleanSummary.split(' ');
  if (words.length > 3) {
    const title = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') + ' Plan';
    const description = words.slice(3).join(' ');
    return { title, description };
  }
  
  return { title: cleanSummary, description: '' };
}

export default function WorkoutSection({
  canAccessWorkoutPlans = false,
  onRestrictedPress,
}: WorkoutSectionProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [strengthPlan, setStrengthPlan] = useState<StrengthPlanResponse | null>(null);
  const [videoPlan, setVideoPlan] = useState<VideoPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      if (!canAccessWorkoutPlans) {
        setStrengthPlan(null);
        setVideoPlan(null);
        setLoading(false);
        return;
      }

      try {
        const [latestStrength, latestVideo] = await Promise.all([
          fetchLatestStrengthWorkoutPlan().catch(() => loadLatestStrengthWorkoutPlan()),
          loadLatestVideoWorkoutPlan().catch(() => null),
        ]);
        if (!cancelled) {
          setStrengthPlan(latestStrength);
          setVideoPlan(latestVideo);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, [canAccessWorkoutPlans]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  const hasPlan = Boolean(strengthPlan || videoPlan);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {hasPlan ? t('YOUR ACTIVE PLAN') : t('NEXT UP: YOUR WORKOUT')}
      </Text>

      {canAccessWorkoutPlans ? (
        hasPlan ? (
          <View style={styles.plansContainer}>
            {strengthPlan ? (() => {
              const totalDays = strengthPlan.days?.length || 0;
              const completedDays = strengthPlan.progress?.filter((p) => p.completed).length || 0;
              const progressPercent = totalDays > 0 ? completedDays / totalDays : 0;
              const display = getPlanDisplayData(strengthPlan.summary, t('Custom Strength Plan'));

              return (
                <View style={styles.planCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardEyebrow}>{t('CUSTOM STRENGTH PLAN')}</Text>
                    <Ionicons name="barbell-outline" size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.planTitle} numberOfLines={1}>{display.title}</Text>
                  {display.description ? (
                    <Text style={styles.planDescription} numberOfLines={2}>{display.description}</Text>
                  ) : null}
                  
                  <View style={styles.progressRow}>
                    <Text style={styles.progressText}>
                      {completedDays} {t('of')} {totalDays} {totalDays === 1 ? t('Day') : t('Days')} {t('Completed')}
                    </Text>
                    <Text style={styles.progressPercent}>{Math.round(progressPercent * 100)}%</Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${progressPercent * 100}%` }]} />
                  </View>

                  <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => router.push('/workoutplan/strength-plan')}
                  >
                    <Text style={styles.actionBtnText}>{t('RESUME WORKOUT')}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#000" style={styles.actionBtnIcon} />
                  </TouchableOpacity>
                </View>
              );
            })() : null}

            {videoPlan ? (() => {
              const activeDays = videoPlan.days?.filter((day) => day.workouts_count > 0).length || 0;
              const progressPercent = activeDays / 7;
              const display = getPlanDisplayData(videoPlan.summary, t('7-Day Video Plan'));

              return (
                <View style={styles.planCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardEyebrow}>{t('7-DAY VIDEO PLAN')}</Text>
                    <Ionicons name="play-outline" size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.planTitle} numberOfLines={1}>{display.title}</Text>
                  {display.description ? (
                    <Text style={styles.planDescription} numberOfLines={2}>{display.description}</Text>
                  ) : null}

                  <View style={styles.progressRow}>
                    <Text style={styles.progressText}>
                      {activeDays} {t('Active')} {activeDays === 1 ? t('Day') : t('Days')}
                    </Text>
                    <Text style={styles.progressPercent}>{Math.round(progressPercent * 100)}%</Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${progressPercent * 100}%` }]} />
                  </View>

                  <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => router.push('/workoutplan/video-plan')}
                  >
                    <Text style={styles.actionBtnText}>{t('RESUME VIDEO PLAN')}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#000" style={styles.actionBtnIcon} />
                  </TouchableOpacity>
                </View>
              );
            })() : null}
          </View>
        ) : (
          <View style={styles.workoutCardFallback}>
            <Text style={styles.workoutHeading}>{t('NO PLAN? NO PROBLEM.')}</Text>
            <Text style={styles.workoutDesc}>
              {t('Choose your path to victory. Which plan will you start?')}
            </Text>
            <TouchableOpacity 
              style={styles.workoutBtnPrimary}
              onPress={() => router.push('/workoutplan/video-wizard')}
            >
              <Text style={styles.workoutBtnPrimaryText}>{t('7-DAY VIDEO PLAN')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.workoutBtnOutline}
              onPress={() => router.push('/workoutplan/strength-wizard')}
            >
              <Text style={styles.workoutBtnOutlineText}>{t('CUSTOM STRENGTH PLAN')}</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <View style={styles.workoutCardFallback}>
          <Text style={styles.workoutHeading}>{t('WORKOUT LIBRARY READY.')}</Text>
          <Text style={styles.workoutDesc}>
            {t('Your current plan includes the workout library. Upgrade to unlock custom workout plans.')}
          </Text>
          <TouchableOpacity
            style={styles.workoutBtnPrimary}
            onPress={() => onRestrictedPress?.('Workout Plans')}
          >
            <Text style={styles.workoutBtnPrimaryText}>{t('UNLOCK WORKOUT PLANS')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: 12,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  plansContainer: {
    gap: 16,
  },
  planCard: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardEyebrow: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
  },
  planTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  planDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  progressPercent: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    gap: 6,
  },
  actionBtnText: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  actionBtnIcon: {
    marginLeft: 2,
  },
  workoutCardFallback: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  workoutHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  workoutDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  workoutBtnPrimary: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutBtnPrimaryText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },
  workoutBtnOutline: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  workoutBtnOutlineText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },
});
