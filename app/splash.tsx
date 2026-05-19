import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { clearAuthTokens, fetchCurrentUser, getValidAuthTokens } from '../lib/api';
import { getPostAuthRoute } from '../lib/access';

export default function SplashScreen() {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const resolveNextRoute = async () => {
      const tokens = await getValidAuthTokens();
      if (cancelled) {
        return;
      }

      if (tokens) {
        try {
          const user = await fetchCurrentUser();
          router.replace(getPostAuthRoute(user));
        } catch {
          router.replace('/login');
        }
        return;
      }

      await clearAuthTokens();
      timer = setTimeout(() => {
        router.replace('/login');
      }, 800);
    };

    void resolveNextRoute();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [pulseAnim, router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.brandTitle}>V I C T O R Y</Text>
        <Text style={styles.brandSubtitle}>F I T N E S S</Text>
        <View style={styles.pulseDot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 10,
    fontFamily: 'Inter_700Bold',
  },
  brandSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 8,
    marginTop: 8,
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06B6D4',
    marginTop: 30,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
});
