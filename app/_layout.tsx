import React, { useEffect, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Colors } from '../constants/Colors';
import { fetchCurrentUser, getValidAuthTokens, setAuthFailureHandler } from '../lib/api';
import { getPostAuthRoute, isPublicRoute, isRouteAllowedForPlan } from '../lib/access';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    setAuthFailureHandler(() => {
      router.replace('/login');
    });

    return () => {
      setAuthFailureHandler(null);
    };
  }, [router]);

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    let cancelled = false;

    const guard = async () => {
      const tokens = await getValidAuthTokens();
      if (cancelled) {
        return;
      }

      if (!tokens) {
        if (!isPublicRoute(pathname)) {
          router.replace('/login');
        }
        setCheckingAccess(false);
        return;
      }

      try {
        const user = await fetchCurrentUser();
        if (cancelled) {
          return;
        }

        if (isPublicRoute(pathname)) {
          router.replace(getPostAuthRoute(user));
          return;
        }

        if (!isRouteAllowedForPlan(pathname, user)) {
          router.replace(getPostAuthRoute(user));
          return;
        }
      } catch {
        if (!cancelled && !isPublicRoute(pathname)) {
          router.replace('/login');
          return;
        }
      }

      if (!cancelled) {
        setCheckingAccess(false);
      }
    };

    void guard();

    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, pathname, router]);

  if (!fontsLoaded || checkingAccess) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'none',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
