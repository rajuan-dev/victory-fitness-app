import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  fetchLatestStrengthWorkoutPlan,
  loadLatestVideoWorkoutPlan,
  StrengthPlanResponse,
  VideoPlanResponse,
} from '../../lib/workout-plans';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

const { width } = Dimensions.get('window');

export default function WorkoutPlanScreen() {
  const checkingAccess = useModuleAccessGuard('/workoutplan');
  const router = useRouter();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [strengthPlan, setStrengthPlan] = useState<StrengthPlanResponse | null>(null);
  const [videoPlan, setVideoPlan] = useState<VideoPlanResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      try {
        const [latestStrength, latestVideo] = await Promise.all([
          fetchLatestStrengthWorkoutPlan().catch(() => null),
          loadLatestVideoWorkoutPlan().catch(() => null),
        ]);
        if (!cancelled) {
          setStrengthPlan(latestStrength);
          setVideoPlan(latestVideo);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasSavedPlan = Boolean(strengthPlan || videoPlan);

  if (checkingAccess) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: 'WORKOUT PLAN',
        headerTransparent: true,
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: 2 } as any,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
        ),
      }} />

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accentBlue} />
          <Text style={styles.loadingText}>Loading saved workout plans...</Text>
        </View>
      ) : hasSavedPlan ? (
        <ScrollView contentContainerStyle={styles.savedContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.savedHeading}>Saved Workout Plans</Text>

          {strengthPlan ? (
            <TouchableOpacity
              style={styles.savedPlanCard}
              activeOpacity={0.85}
              onPress={() => router.push('/workoutplan/strength-plan')}
            >
              <Text style={styles.savedPlanEyebrow}>CUSTOM STRENGTH PLAN</Text>
              <Text style={styles.savedPlanTitle}>{strengthPlan.summary}</Text>
              <Text style={styles.savedPlanMeta}>{strengthPlan.days.length} training day{strengthPlan.days.length === 1 ? '' : 's'}</Text>
            </TouchableOpacity>
          ) : null}

          {videoPlan ? (
            <TouchableOpacity
              style={styles.savedPlanCard}
              activeOpacity={0.85}
              onPress={() => router.push('/workoutplan/video-plan')}
            >
              <Text style={styles.savedPlanEyebrow}>7-DAY VIDEO PLAN</Text>
              <Text style={styles.savedPlanTitle}>{videoPlan.summary}</Text>
              <Text style={styles.savedPlanMeta}>{videoPlan.days.filter((day) => day.workouts_count > 0).length} active day{videoPlan.days.filter((day) => day.workouts_count > 0).length === 1 ? '' : 's'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.createBtn}
            activeOpacity={0.8}
            onPress={() => setIsModalVisible(true)}
          >
            <Text style={styles.createBtnText}>Create Another Plan</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
      <View style={styles.centerContent}>
        <View style={styles.emptyCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="person" size={40} color="rgba(255,255,255,0.4)" />
          </View>

          <Text style={styles.title}>No Plan? No Problem.</Text>
          <Text style={styles.subtitle}>
            Create your personal AI plan to reach your goals faster.
          </Text>

          <TouchableOpacity 
            style={styles.createBtn} 
            activeOpacity={0.8}
            onPress={() => setIsModalVisible(true)}
          >
            <Text style={styles.createBtnText}>Create Plan</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}

      {/* Plan Selection Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Plan</Text>
              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={() => setIsModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose the type of plan you want to create.
            </Text>

            <TouchableOpacity 
              style={styles.optionCard} 
              activeOpacity={0.7}
              onPress={() => {
                setIsModalVisible(false);
                router.push('/workoutplan/video-wizard');
              }}
            >
              <Text style={styles.optionTitle}>7-DAY VIDEO PLAN</Text>
              <Text style={styles.optionDescription}>
                A flexible 7-day plan based on our video library, tailored to your goals by AI.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionCard} 
              activeOpacity={0.7}
              onPress={() => {
                setIsModalVisible(false);
                router.push('/workoutplan/strength-wizard');
              }}
            >
              <Text style={styles.optionTitle}>CUSTOM STRENGTH PLAN</Text>
              <Text style={styles.optionDescription}>
                A detailed, periodized plan to maximize strength and muscle gain.
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  savedContent: {
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 60,
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 14,
  },
  savedHeading: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  savedPlanCard: {
    backgroundColor: '#161616',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  savedPlanEyebrow: {
    color: Colors.accentBlue,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  savedPlanTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    lineHeight: 26,
    marginBottom: 8,
  },
  savedPlanMeta: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  emptyCard: {
    width: '100%',
    backgroundColor: '#161616',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    marginBottom: 32,
    maxWidth: '85%',
  },
  createBtn: {
    backgroundColor: Colors.accentBlue,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  createBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1C252E', 
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    marginBottom: 32,
    lineHeight: 22,
  },
  optionCard: {
    backgroundColor: '#121921',
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  optionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  optionDescription: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
});

