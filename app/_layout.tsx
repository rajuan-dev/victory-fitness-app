import React, { useEffect, useRef, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Colors } from '../constants/Colors';
import { clearAuthTokens, fetchCurrentUser, getAuthUser, getValidAuthTokens, setAuthFailureHandler } from '../lib/api';
import { getPostAuthRoute, isAdminRestrictedFromApp, isPublicRoute, isRouteAllowedForPlan } from '../lib/access';
import { appendRunLog, formatRunLogMessage } from '../lib/runLog';
import { LanguageProvider } from '../lib/i18n';
import { blurActiveElementBeforeNavigation, replaceRoute } from '../lib/navigation';
import { PushNotificationEvent, registerForPushNotificationsAsync, subscribeToPushNotifications } from '../lib/pushNotifications';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errorBoundary}>
      <Text style={styles.errorBoundaryTitle}>Something went wrong</Text>
      <Text style={styles.errorBoundaryMessage}>
        We couldn&apos;t load this screen. Your data is safe—please try again.
      </Text>
      <TouchableOpacity style={styles.errorBoundaryButton} onPress={retry} activeOpacity={0.85}>
        <Text style={styles.errorBoundaryButtonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const lastLoggedRouteRef = useRef<string | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [toastNotification, setToastNotification] = useState<PushNotificationEvent | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPushNotifications((notification) => {
      setToastNotification(notification);
      setTimeout(() => setToastNotification(null), 5000);
    });
    return () => { unsubscribe(); };
  }, []);

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
      const applyAccess = async (user: Awaited<ReturnType<typeof getAuthUser>>) => {
        if (!user) {
          return false;
        }

        if (isAdminRestrictedFromApp(user)) {
          await clearAuthTokens();
          if (!isPublicRoute(pathname)) {
            void appendRunLog({
              level: 'warning',
              title: 'Admin app access blocked',
              message: `Admin session blocked in app for ${pathname}; redirecting to /login.`,
              route: pathname,
              context: 'RootLayout',
            });
            replaceRoute(router, '/login');
            return true;
          }

          setCheckingAccess(false);
          return false;
        }

        if (isPublicRoute(pathname)) {
          const target = getPostAuthRoute(user);
          if (pathname === target) {
            setCheckingAccess(false);
            return false;
          }

          void appendRunLog({
            level: 'route',
            title: 'Route redirect',
            message: `Authenticated user redirected from ${pathname} to ${target}.`,
            route: pathname,
            context: 'RootLayout',
          });
          replaceRoute(router, target);
          return true;
        }

        if (!isRouteAllowedForPlan(pathname, user)) {
          const target = getPostAuthRoute(user);
          if (pathname === target) {
            setCheckingAccess(false);
            return false;
          }

          void appendRunLog({
            level: 'warning',
            title: 'Route blocked',
            message: `Plan access blocked for ${pathname}; redirecting to ${target}.`,
            route: pathname,
            context: 'RootLayout',
          });
          replaceRoute(router, target);
          return true;
        }

        setCheckingAccess(false);
        return false;
      };

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

        const cachedUser = await getAuthUser();
        if (cancelled) {
          return;
        }

        if (await applyAccess(cachedUser)) {
          return;
        }

        const user = await fetchCurrentUser();
        if (cancelled) {
          return;
        }

        if (await applyAccess(user)) {
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
    blurActiveElementBeforeNavigation();
  }, [pathname]);

  useEffect(() => {
    if (!fontsLoaded || checkingAccess || isPublicRoute(pathname)) {
      return;
    }

    void registerForPushNotificationsAsync().catch(() => {
      // Notifications are optional and must not block app access.
    });
  }, [checkingAccess, fontsLoaded, pathname]);

  useEffect(() => {
    if (lastLoggedRouteRef.current === pathname) {
      return;
    }

    lastLoggedRouteRef.current = pathname;
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
        {toastNotification ? (
          <TouchableOpacity
            style={styles.notificationToast}
            onPress={() => {
              setToastNotification(null);
              router.push('/notifications');
            }}
            activeOpacity={0.9}
          >
            <View style={styles.notificationToastIcon}><Text style={styles.notificationToastIconText}>!</Text></View>
            <View style={styles.notificationToastCopy}>
              <Text style={styles.notificationToastTitle}>{toastNotification.title}</Text>
              <Text style={styles.notificationToastMessage}>{toastNotification.message}</Text>
            </View>
            <TouchableOpacity onPress={() => setToastNotification(null)} hitSlop={10} accessibilityLabel="Dismiss notification">
              <Text style={styles.notificationToastClose}>×</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ) : null}
      </View>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  errorBoundary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: Colors.background,
    gap: 12,
  },
  errorBoundaryTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  errorBoundaryMessage: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  errorBoundaryButton: {
    marginTop: 6,
    minHeight: 46,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentBlue,
  },
  errorBoundaryButtonText: {
    color: '#06111f',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notificationToast: {
    position: 'absolute',
    top: 48,
    left: 14,
    right: 14,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: 16,
    backgroundColor: '#14213D',
    borderWidth: 1,
    borderColor: `${Colors.primary}80`,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  notificationToastIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  notificationToastIconText: { color: '#07111F', fontSize: 18, fontFamily: 'Inter_700Bold' },
  notificationToastCopy: { flex: 1 },
  notificationToastTitle: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  notificationToastMessage: { marginTop: 2, color: '#CBD5E1', fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  notificationToastClose: { color: '#CBD5E1', fontSize: 24, lineHeight: 24 },
});
