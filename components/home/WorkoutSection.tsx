import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';

export default function WorkoutSection() {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <View style={styles.workoutCard}>
        <Text style={styles.sectionTitle}>NEXT UP: YOUR WORKOUT</Text>
        <Text style={styles.workoutHeading}>NO PLAN? NO PROBLEM.</Text>
        <Text style={styles.workoutDesc}>
          Choose your path to victory. Which plan will you start?
        </Text>
        <TouchableOpacity 
          style={styles.workoutBtnPrimary}
          onPress={() => router.push('/workoutplan/video-wizard')}
        >
          <Text style={styles.workoutBtnPrimaryText}>7-DAY VIDEO PLAN</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.workoutBtnOutline}
          onPress={() => router.push('/workoutplan/strength-wizard')}
        >
          <Text style={styles.workoutBtnOutlineText}>CUSTOM STRENGTH PLAN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
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
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  workoutDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
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
    fontSize: 14,
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
    fontSize: 14,
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
  },
});
