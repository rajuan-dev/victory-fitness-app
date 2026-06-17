import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { clearAuthTokens, fetchCurrentUser, getValidAuthTokens, updateCurrentUserProfile } from '../lib/api';
import { getPostAuthRoute } from '../lib/access';
import { replaceRoute } from '../lib/navigation';

const performanceScreen = require('../assets/images/onboarding/performance-first.png') as ImageSourcePropType;
const precisionScreen = require('../assets/images/onboarding/precision-tracking.png') as ImageSourcePropType;
const communityScreen = require('../assets/images/onboarding/stronger-together.png') as ImageSourcePropType;

const SCREEN_ASPECT_RATIO = 390 / 844;

type OnboardingFrame = {
  image: ImageSourcePropType;
  nextLabel: string;
  hasVisibleSkip: boolean;
  hasSecondaryAction: boolean;
};

const FRAMES: OnboardingFrame[] = [
  {
    image: performanceScreen,
    nextLabel: 'Next',
    hasVisibleSkip: true,
    hasSecondaryAction: false,
  },
  {
    image: precisionScreen,
    nextLabel: 'Next',
    hasVisibleSkip: false,
    hasSecondaryAction: false,
  },
  {
    image: communityScreen,
    nextLabel: 'Get started',
    hasVisibleSkip: false,
    hasSecondaryAction: true,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      const tokens = await getValidAuthTokens();
      if (cancelled) {
        return;
      }

      setHasAuthSession(Boolean(tokens));

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
          if (!cancelled) {
            setHasAuthSession(false);
          }
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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeStep, fadeAnim]);

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
    if (activeStep < FRAMES.length - 1) {
      setActiveStep((current) => current + 1);
      return;
    }

    await finishOnboarding();
  };

  const handleSkip = async () => {
    await finishOnboarding();
  };

  const handleSecondaryAction = () => {
    if (hasAuthSession) {
      void handleSkip();
      return;
    }

    replaceRoute(router, '/login');
  };

  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#18E2D2" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const currentFrame = FRAMES[activeStep];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Animated.View style={[styles.frameWrap, { opacity: fadeAnim }]}>
          <Image source={currentFrame.image} style={styles.frameImage} resizeMode="contain" />

          {currentFrame.hasVisibleSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              disabled={completing}
              onPress={handleSkip}
              style={styles.skipHitbox}
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={currentFrame.nextLabel}
            disabled={completing}
            onPress={() => {
              void handleNext();
            }}
            style={activeStep === FRAMES.length - 1 ? styles.getStartedHitbox : styles.nextHitbox}
          />

          {currentFrame.hasSecondaryAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hasAuthSession ? 'Skip onboarding for now' : 'Sign in to existing account'}
              disabled={completing}
              onPress={handleSecondaryAction}
              style={styles.secondaryHitbox}
            />
          ) : null}

          {!currentFrame.hasVisibleSkip && activeStep < FRAMES.length - 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              disabled={completing}
              onPress={handleSkip}
              style={styles.hiddenSkipHitbox}
            />
          ) : null}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWrap: {
    width: '100%',
    maxWidth: 430,
    aspectRatio: SCREEN_ASPECT_RATIO,
    position: 'relative',
    backgroundColor: '#000',
  },
  frameImage: {
    width: '100%',
    height: '100%',
  },
  skipHitbox: {
    position: 'absolute',
    top: '2.4%',
    right: '3.5%',
    width: '18%',
    height: '7%',
  },
  hiddenSkipHitbox: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '28%',
    height: '16%',
  },
  nextHitbox: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    bottom: '14.5%',
    height: '6.6%',
    borderRadius: 10,
  },
  getStartedHitbox: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    bottom: '12.6%',
    height: '11.2%',
    borderRadius: 20,
  },
  secondaryHitbox: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    bottom: '7.2%',
    height: '4.4%',
  },
});
