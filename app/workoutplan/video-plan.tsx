import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { getLatestVideoWorkoutPlan } from '../../lib/workout-plans';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

const { width } = Dimensions.get('window');

export default function VideoPlanResult() {
  const checkingAccess = useModuleAccessGuard('/workoutplan');
  const router = useRouter();
  const plan = getLatestVideoWorkoutPlan();
  const dayLabels = useMemo(() => (plan?.days?.length ? plan.days.map((day) => day.day) : ['Mon']), [plan]);
  const [selectedDay, setSelectedDay] = useState(dayLabels[0] ?? 'Mon');
  const selectedPlanDay = plan?.days?.find((day) => day.day === selectedDay) ?? plan?.days?.[0] ?? null;

  if (checkingAccess) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        headerShown: true,
        title: '7-DAY VIDEO PLAN',
        headerTransparent: true,
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 2 } as any,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile/Welcome Section */}
        <View style={styles.topSection}>
          <Text style={styles.welcomeText}>{plan?.summary ?? 'Your Weekly Path'}</Text>
          <Text style={styles.dateText}>Ready for Day {dayLabels.indexOf(selectedDay) + 1}?</Text>
        </View>

        {/* Premium Day Selector */}
        <View style={styles.daySelectorContainer}>
            <View style={styles.daySelector}>
            {dayLabels.map((day) => {
              const isActive = selectedDay === day;
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => setSelectedDay(day)}
                  style={[styles.dayBtn, isActive && styles.dayBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayText, isActive && styles.dayTextActive]}>{day}</Text>
                  {isActive && <View style={styles.dayIndicator} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Daily Insight Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#1A2129' }]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="time" size={20} color={Colors.accentBlue} />
            </View>
            <View>
              <Text style={styles.statLabel}>DURATION</Text>
              <Text style={styles.statValue}>{selectedPlanDay?.duration_label ?? '-'}</Text>
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#1A2129' }]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="videocam" size={20} color={Colors.accentBlue} />
            </View>
            <View>
              <Text style={styles.statLabel}>WORKOUTS</Text>
              <Text style={styles.statValue}>{selectedPlanDay?.workouts_count ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* Workout List Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TODAY'S LINEUP</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Overview</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.workoutList}>
          {(selectedPlanDay?.workouts ?? []).map((workout) => (
            <TouchableOpacity key={workout.id} style={styles.workoutCard} activeOpacity={0.95}>
              <Image source={{ uri: workout.image || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80' }} style={styles.workoutImage} />
              <View style={styles.workoutOverlay}>
                {workout.tag && (
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagText}>{workout.tag}</Text>
                  </View>
                )}
                <View style={styles.playBtnContainer}>
                  <View style={styles.playBtn}>
                    <Ionicons name="play" size={20} color="#000" />
                  </View>
                </View>
                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutCategory}>{workout.category.toUpperCase()}</Text>
                  <Text style={styles.workoutTitle}>{workout.title}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="timer-outline" size={14} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.metaText}>{workout.duration}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    paddingTop: 100,
    paddingBottom: 120,
  },
  topSection: {
    paddingHorizontal: 20,
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
    fontSize: 28,
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
    position: 'relative',
  },
  dayBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  dayIndicator: {
    position: 'absolute',
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accentBlue,
    shadowColor: Colors.accentBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(6,182,212,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  seeAllText: {
    color: Colors.accentBlue,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  workoutList: {
    paddingHorizontal: 20,
    gap: 20,
  },
  workoutCard: {
    height: 240,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#161616',
  },
  workoutImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  workoutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 24,
    justifyContent: 'space-between',
  },
  tagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagText: {
    color: Colors.accentBlue,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.5,
  },
  playBtnContainer: {
    position: 'absolute',
    top: '40%',
    left: '42%',
  },
  playBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  workoutInfo: {
    justifyContent: 'flex-end',
  },
  workoutCategory: {
    color: Colors.accentBlue,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  workoutTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  floatingStartBtn: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
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

