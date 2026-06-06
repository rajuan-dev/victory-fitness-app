import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../lib/i18n';

type WorkoutSectionProps = {
  canAccessWorkoutPlans?: boolean;
  onRestrictedPress?: (sectionName: string) => void;
};

export default function WorkoutSection({
  canAccessWorkoutPlans = true,
  onRestrictedPress,
}: WorkoutSectionProps) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <View style={styles.section}>
      <View style={styles.workoutCard}>
        <Text style={styles.sectionTitle}>{t('NEXT UP: YOUR WORKOUT')}</Text>
        {canAccessWorkoutPlans ? (
          <>
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
          </>
        ) : (
          <>
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
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accentBlue,
    letterSpacing: 1.5,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  workoutCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    marginBottom: 24,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  workoutBtnPrimary: {
    width: '100%',
    backgroundColor: Colors.accentBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutBtnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
  },
  workoutBtnOutline: {
    width: '100%',
    backgroundColor: '#333',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  workoutBtnOutlineText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
  },
});
