import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import { fetchLatestStrengthWorkoutPlan, getLatestStrengthWorkoutPlan, loadLatestStrengthWorkoutPlan, StrengthPlanResponse } from '../../lib/workout-plans';

export default function StrengthPlanResult() {
  const router = useRouter();
  const [plan, setPlan] = useState<StrengthPlanResponse | null>(getLatestStrengthWorkoutPlan());
  const [loading, setLoading] = useState(!plan);
  const dayLabels = useMemo(() => (plan?.days?.length ? plan.days.map((day) => day.day) : ['Mon']), [plan]);
  const [selectedDay, setSelectedDay] = useState(dayLabels[0] ?? 'Mon');
  const selectedPlanDay = plan?.days?.find((day) => day.day === selectedDay) ?? plan?.days?.[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    const loadPlan = async () => {
      try {
        const serverPlan = await fetchLatestStrengthWorkoutPlan();
        if (!cancelled) {
          setPlan(serverPlan);
          setLoading(false);
        }
      } catch {
        const storedPlan = await loadLatestStrengthWorkoutPlan();
        if (!cancelled) {
          setPlan(storedPlan);
          setLoading(false);
        }
      }
    };

    if (!plan) {
      void loadPlan();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [plan]);

  useEffect(() => {
    if (dayLabels.length > 0 && !dayLabels.includes(selectedDay)) {
      setSelectedDay(dayLabels[0]);
    }
  }, [dayLabels, selectedDay]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        headerShown: true,
        title: 'CUSTOM STRENGTH PLAN',
        headerTransparent: true,
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 2 } as any,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        ),
      }} />
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.accentBlue} />
          <Text style={styles.loadingStateText}>Loading your custom strength plan...</Text>
        </View>
      ) : !plan || !selectedPlanDay ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No custom strength plan yet</Text>
          <Text style={styles.emptyStateText}>Create a plan first from the wizard to see it here.</Text>
          <TouchableOpacity style={styles.emptyStateButton} onPress={() => router.replace('/workoutplan/strength-wizard')}>
            <Text style={styles.emptyStateButtonText}>Create Plan</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.topSection}>
          <Text style={styles.welcomeText}>{plan?.summary ?? 'Your Strength Roadmap'}</Text>
          <Text style={styles.dateText}>
            {selectedPlanDay ? `Day ${dayLabels.indexOf(selectedPlanDay.day) + 1}: ${selectedPlanDay.title}` : 'No generated plan'}
          </Text>
        </View>

        {/* Day Selector */}
        <View style={styles.daySelectorContainer}>
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
        </View>

        {/* Daily Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>EST. TIME</Text>
            <Text style={styles.statValue}>{selectedPlanDay?.est_time ?? '-'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>VOLUME</Text>
            <Text style={styles.statValue}>{selectedPlanDay?.volume ?? '-'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>INTENSITY</Text>
            <Text style={styles.statValue}>{selectedPlanDay?.intensity ?? '-'}</Text>
          </View>
        </View>

        {/* Exercise List */}
        <Text style={styles.sectionHeader}>TODAY'S EXERCISES</Text>
        <View style={styles.exerciseList}>
          {(selectedPlanDay?.exercises ?? []).map((ex) => (
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
                  <Text style={styles.metricValue}>{ex.sets} Sets</Text>
                </View>
                <View style={styles.metricItem}>
                  <Ionicons name="repeat-outline" size={16} color={Colors.accentBlue} />
                  <Text style={styles.metricValue}>{ex.reps} Reps</Text>
                </View>
                <View style={styles.metricItem}>
                  <Ionicons name="fitness-outline" size={16} color={Colors.accentBlue} />
                  <Text style={styles.metricValue}>{ex.weight}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Ionicons name="timer-outline" size={16} color={Colors.accentBlue} />
                  <Text style={styles.metricValue}>{ex.rest} Rest</Text>
                </View>
              </View>
            </View>
          ))}
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
    paddingBottom: 120,
  },
  topSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  welcomeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dateText: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
  },
  daySelectorContainer: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  daySelector: {
    flexDirection: 'row',
    backgroundColor: '#161616',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  dayBtn: {
    flex: 1,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  dayBtnActive: {
    backgroundColor: 'rgba(6,182,212,0.1)',
  },
  dayText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '700',
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
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#161616',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 40,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  exerciseList: {
    paddingHorizontal: 24,
    gap: 16,
  },
  exerciseCard: {
    backgroundColor: '#161616',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  exerciseType: {
    color: Colors.accentBlue,
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  exerciseName: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  infoIcon: {
    marginTop: 4,
  },
  exerciseMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricValue: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  floatingStartBtn: {
    position: 'absolute',
    bottom: 30,
    left: 24,
    right: 24,
    height: 64,
    backgroundColor: Colors.accentBlue,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: Colors.accentBlue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  floatingStartBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Inter_900Black',
    letterSpacing: 1,
  },
});

