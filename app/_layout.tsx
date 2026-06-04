import React, { useEffect, useRef, useState } from 'react';
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
import { appendRunLog, formatRunLogMessage } from '../lib/runLog';
import { LanguageProvider } from '../lib/i18n';
import { replaceRoute } from '../lib/navigation';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    setAuthFailureHandler(() => {
        void appendRunLog({
          level: 'warning',
          title: 'Authentication redirect',
          message: 'Session guard redirected to /login.',
          route: pathnameRef.current,
          context: 'RootLayout',
        });
        replaceRoute(router, '/login');
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
      try {
        const tokens = await getValidAuthTokens();
        if (cancelled) {
          return;
        }

        if (!tokens) {
          if (!isPublicRoute(pathname)) {
            void appendRunLog({
              level: 'warning',
              title: 'Route blocked',
              message: `Blocked unauthenticated access to ${pathname}; redirecting to /login.`,
              route: pathname,
              context: 'RootLayout',
            });
            replaceRoute(router, '/login');
          }
          setCheckingAccess(false);
          return;
        }

        const user = await fetchCurrentUser();
        if (cancelled) {
          return;
        }

        if (isPublicRoute(pathname)) {
          void appendRunLog({
            level: 'route',
            title: 'Route redirect',
            message: `Authenticated user redirected from ${pathname} to ${getPostAuthRoute(user)}.`,
            route: pathname,
            context: 'RootLayout',
          });
          replaceRoute(router, getPostAuthRoute(user));
          return;
        }

        if (!isRouteAllowedForPlan(pathname, user)) {
          void appendRunLog({
            level: 'warning',
            title: 'Route blocked',
            message: `Plan access blocked for ${pathname}; redirecting to ${getPostAuthRoute(user)}.`,
            route: pathname,
            context: 'RootLayout',
          });
          replaceRoute(router, getPostAuthRoute(user));
          return;
        }
        setCheckingAccess(false);
      } catch {
        if (cancelled) {
          return;
        }

        if (!isPublicRoute(pathname)) {
          void appendRunLog({
            level: 'error',
            title: 'Auth check failed',
            message: `Unable to verify access for ${pathname}; redirecting to /login.`,
            route: pathname,
            context: 'RootLayout',
          });
          replaceRoute(router, '/login');
        }

        setCheckingAccess(false);
      }
    };

    void guard();

    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, pathname, router]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    void appendRunLog({
      level: 'route',
      title: 'Route changed',
      message: `Active route: ${pathname}`,
      route: pathname,
      context: 'RootLayout',
    });
  }, [pathname]);

  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: unknown[]) => {
      void appendRunLog({
        level: 'error',
        title: 'Console error',
        message: formatRunLogMessage(args),
        route: pathnameRef.current,
        context: 'Console',
      });
      originalError(...args);
    };

    console.warn = (...args: unknown[]) => {
      void appendRunLog({
        level: 'warning',
        title: 'Console warning',
        message: formatRunLogMessage(args),
        route: pathnameRef.current,
        context: 'Console',
      });
      originalWarn(...args);
    };

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  if (!fontsLoaded || checkingAccess) {
    return null;
  }

  return (
    <LanguageProvider>
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
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
