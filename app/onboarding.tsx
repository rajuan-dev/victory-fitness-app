import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

import { clearAuthTokens, fetchCurrentUser, getValidAuthTokens, updateCurrentUserProfile } from '../lib/api';
import { getPostAuthRoute } from '../lib/access';
import { replaceRoute } from '../lib/navigation';

type OnboardingStep = {
  title: string;
  subtitle: string;
  detail: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
  panel: [string, string];
  stats: [string, string, string];
};

const ONBOARDING_DATA: OnboardingStep[] = [
  {
    title: 'Build a body that performs under pressure.',
    subtitle: 'Elite programming',
    detail: 'Move from generic plans to a coaching system built around strength, consistency, and real progression.',
    icon: 'barbell-outline',
    accent: '#F97316',
    panel: ['#2A1408', '#140C08'],
    stats: ['Strength blocks', 'Weekly check-ins', 'Performance focus'],
  },
  {
    title: 'Treat recovery and longevity like part of training.',
    subtitle: 'Healthspan metrics',
    detail: 'Track the signals that matter so your energy, recovery, and long-term health improve with the work.',
    icon: 'pulse-outline',
    accent: '#10B981',
    panel: ['#0A241A', '#07120F'],
    stats: ['Sleep awareness', 'Biomarker mindset', 'Lower burnout'],
  },
  {
    title: 'Let AI personalize the next move.',
    subtitle: 'Adaptive guidance',
    detail: 'Use tailored nutrition, workouts, and feedback loops that adapt as your goals and data change.',
    icon: 'sparkles-outline',
    accent: '#38BDF8',
    panel: ['#092133', '#070D14'],
    stats: ['Custom plans', 'Coach prompts', 'Daily momentum'],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [completing, setCompleting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      const tokens = await getValidAuthTokens();
      if (cancelled) {
        return;
      }

      if (tokens) {
        try {
          const user = await fetchCurrentUser();
          const targetRoute = getPostAuthRoute(user);
          if (targetRoute !== '/onboarding') {
            replaceRoute(router, targetRoute);
            return;
          }
        } catch {
          await clearAuthTokens();
        }
      }

      if (!cancelled) {
        setCheckingAuth(false);
      }
    };

    void redirectIfAuthenticated();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(18);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeStep, fadeAnim, slideAnim]);

  const finishOnboarding = async () => {
    const tokens = await getValidAuthTokens();
    if (!tokens) {
      replaceRoute(router, '/login');
      return;
    }

    setCompleting(true);
    try {
      const user = await updateCurrentUserProfile({ onboarding_completed: true });
      replaceRoute(router, getPostAuthRoute(user));
    } catch (err) {
      console.error('Failed to complete onboarding', err);
      replaceRoute(router, '/plan');
    } finally {
      setCompleting(false);
    }
  };

  const handleNext = async () => {
    if (activeStep < ONBOARDING_DATA.length - 1) {
      setActiveStep((current) => current + 1);
      return;
    }

    await finishOnboarding();
  };

  const handleSkip = async () => {
    await finishOnboarding();
  };

  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="light" />
        <LinearGradient colors={['#050816', '#0B1020', '#050816']} style={styles.loadingGradient}>
          <View style={styles.loadingOrb} />
          <Animated.View style={styles.loadingCard}>
            <Ionicons name="sparkles-outline" size={28} color="#38BDF8" />
            <Text style={styles.loadingTitle}>Preparing your coaching flow</Text>
            <Text style={styles.loadingText}>Checking your account and onboarding status.</Text>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const currentData = ONBOARDING_DATA[activeStep];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#050816', '#0B1020', '#111827']} style={styles.background}>
        <View style={[styles.ambientGlow, styles.glowOne]} />
        <View style={[styles.ambientGlow, styles.glowTwo, { backgroundColor: currentData.accent }]} />

        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Victory Protocol</Text>
            <Text style={styles.progressLabel}>
              {String(activeStep + 1).padStart(2, '0')} / {String(ONBOARDING_DATA.length).padStart(2, '0')}
            </Text>
          </View>
          <TouchableOpacity disabled={completing} onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView bounces={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View
            style={[
              styles.heroWrap,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <LinearGradient colors={currentData.panel} style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={[styles.iconBadge, { backgroundColor: `${currentData.accent}22`, borderColor: `${currentData.accent}55` }]}>
                  <Ionicons name={currentData.icon} size={28} color={currentData.accent} />
                </View>
                <View style={[styles.livePill, { borderColor: `${currentData.accent}66` }]}>
                  <View style={[styles.liveDot, { backgroundColor: currentData.accent }]} />
                  <Text style={styles.livePillText}>{currentData.subtitle}</Text>
                </View>
              </View>

              <Text style={styles.heroTitle}>{currentData.title}</Text>
              <Text style={styles.heroDetail}>{currentData.detail}</Text>

              <View style={styles.statGrid}>
                {currentData.stats.map((item) => (
                  <View key={item} style={styles.statChip}>
                    <Ionicons name="checkmark-circle" size={16} color={currentData.accent} />
                    <Text style={styles.statChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>

          <View style={styles.copySection}>
            <Text style={styles.sectionEyebrow}>Why this matters</Text>
            <Text style={styles.sectionTitle}>A sharper first-run experience, not a placeholder intro.</Text>
            <Text style={styles.sectionBody}>
              This onboarding is now structured around performance, recovery, and personalization so users immediately understand what the app is built to do.
            </Text>
          </View>

          <View style={styles.timeline}>
            {ONBOARDING_DATA.map((item, index) => {
              const isActive = index === activeStep;
              const isComplete = index < activeStep;

              return (
                <TouchableOpacity
                  key={item.title}
                  style={[styles.timelineItem, isActive && styles.timelineItemActive]}
                  onPress={() => setActiveStep(index)}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.timelineIndex,
                      isActive && { borderColor: item.accent, backgroundColor: `${item.accent}22` },
                      isComplete && { backgroundColor: item.accent, borderColor: item.accent },
                    ]}
                  >
                    {isComplete ? (
                      <Ionicons name="checkmark" size={16} color="#04111E" />
                    ) : (
                      <Text style={[styles.timelineIndexText, isActive && { color: '#fff' }]}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.timelineTextWrap}>
                    <Text style={styles.timelineTitle}>{item.subtitle}</Text>
                    <Text style={styles.timelineText}>{item.detail}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.indicatorRow}>
            {ONBOARDING_DATA.map((item, index) => (
              <View
                key={item.title}
                style={[
                  styles.indicator,
                  index === activeStep && { width: 34, backgroundColor: item.accent },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: currentData.accent }]}
            onPress={handleNext}
            activeOpacity={0.9}
            disabled={completing}
          >
            <Text style={styles.nextBtnText}>{activeStep === ONBOARDING_DATA.length - 1 ? 'Enter app' : 'Continue'}</Text>
            <Ionicons
              name={completing ? 'hourglass-outline' : activeStep === ONBOARDING_DATA.length - 1 ? 'rocket-outline' : 'arrow-forward'}
              size={18}
              color="#04111E"
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#050816',
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  loadingCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: 'rgba(10, 18, 36, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
  },
  loadingTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    textAlign: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  container: {
    flex: 1,
    backgroundColor: '#050816',
  },
  background: {
    flex: 1,
  },
  ambientGlow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.18,
  },
  glowOne: {
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    backgroundColor: '#F97316',
  },
  glowTwo: {
    bottom: 120,
    left: -80,
    width: 260,
    height: 260,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  kicker: {
    color: '#E2E8F0',
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  progressLabel: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    fontFamily: 'Inter_500Medium',
  },
  skipBtn: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  skipText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 22,
  },
  heroWrap: {
    marginTop: 8,
  },
  heroCard: {
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    gap: 12,
  },
  iconBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  livePillText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 30,
    lineHeight: 36,
    fontFamily: 'Inter_900Black',
  },
  heroDetail: {
    color: '#B6C2D2',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    fontFamily: 'Inter_400Regular',
  },
  statGrid: {
    marginTop: 24,
    gap: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  statChipText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  copySection: {
    gap: 10,
  },
  sectionEyebrow: {
    color: '#38BDF8',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    lineHeight: 31,
    fontFamily: 'Inter_800ExtraBold',
  },
  sectionBody: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  timeline: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  timelineItemActive: {
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
  },
  timelineIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timelineIndexText: {
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  timelineTextWrap: {
    flex: 1,
    gap: 4,
  },
  timelineTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  timelineText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    gap: 18,
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
  },
  nextBtn: {
    minHeight: 62,
    borderRadius: 22,
    paddingHorizontal: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  nextBtnText: {
    color: '#04111E',
    fontSize: 16,
    fontFamily: 'Inter_900Black',
  },
});
