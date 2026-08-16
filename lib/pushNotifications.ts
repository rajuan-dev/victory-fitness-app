import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, buildApiWebSocketUrl, getValidAuthTokens } from './api';
import { registerWebPushNotificationsAsync, setupWebPushNotificationsAsync } from './firebaseWebPush';

declare const process: { env?: Record<string, string | undefined> };

export const FIREBASE_VAPID_KEY = String(process.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim();

const REGISTERED_TOKEN_KEY = 'victory_push_token';

type NotificationsModule = typeof import('expo-notifications');
export type PushNotificationEvent = {
  title: string;
  message: string;
  data: Record<string, unknown>;
};

const pushNotificationListeners = new Set<(event: PushNotificationEvent) => void>();
let notificationsModule: NotificationsModule | null = null;
let nativeListenerInstalled = false;
let nativeResponseListenerInstalled = false;
let notificationSocket: WebSocket | null = null;
let notificationSocketStarted = false;
let notificationSocketReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let notificationSocketManuallyClosed = false;

export function subscribeToPushNotifications(listener: (event: PushNotificationEvent) => void) {
  pushNotificationListeners.add(listener);
  return () => pushNotificationListeners.delete(listener);
}

function emitPushNotification(event: PushNotificationEvent) {
  pushNotificationListeners.forEach((listener) => listener(event));
}

export function startForegroundNotificationStream() {
  if (notificationSocketStarted) {
    return;
  }

  notificationSocketStarted = true;
  notificationSocketManuallyClosed = false;
  void connectForegroundNotificationSocket();
}

export function stopForegroundNotificationStream() {
  notificationSocketStarted = false;
  notificationSocketManuallyClosed = true;
  if (notificationSocketReconnectTimer) {
    clearTimeout(notificationSocketReconnectTimer);
    notificationSocketReconnectTimer = null;
  }
  notificationSocket?.close();
  notificationSocket = null;
}

async function connectForegroundNotificationSocket() {
  if (!notificationSocketStarted || notificationSocket) {
    return;
  }

  try {
    const tokens = await getValidAuthTokens();
    if (!tokens?.access_token || !notificationSocketStarted) {
      scheduleForegroundNotificationReconnect();
      return;
    }

    const socket = new WebSocket(buildApiWebSocketUrl('/ws/notifications', { token: tokens.access_token }));
    notificationSocket = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data || '{}')) as {
          type?: string;
          notification?: {
            title?: string;
            message?: string;
            data?: Record<string, unknown>;
          };
        };
        if (payload.type !== 'notification_created' || !payload.notification) {
          return;
        }
        emitPushNotification({
          title: String(payload.notification.title || 'Victory Fitness'),
          message: String(payload.notification.message || 'You have a new update from Victory Fitness.'),
          data: payload.notification.data || {},
        });
      } catch {
        // Ignore malformed realtime events; push/inbox remain source of truth.
      }
    };

    socket.onclose = () => {
      if (notificationSocket === socket) {
        notificationSocket = null;
      }
      if (!notificationSocketManuallyClosed) {
        scheduleForegroundNotificationReconnect();
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  } catch {
    scheduleForegroundNotificationReconnect();
  }
}

function scheduleForegroundNotificationReconnect() {
  if (!notificationSocketStarted || notificationSocketReconnectTimer) {
    return;
  }
  notificationSocketReconnectTimer = setTimeout(() => {
    notificationSocketReconnectTimer = null;
    void connectForegroundNotificationSocket();
  }, 5000);
}

function getNativeNotifications(): NotificationsModule {
  if (Platform.OS === 'web') {
    throw new Error('Native notifications are unavailable on web.');
  }

  if (!notificationsModule) {
    notificationsModule = require('expo-notifications') as NotificationsModule;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  return notificationsModule;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web' || !Constants.isDevice) {
    if (Platform.OS !== 'web') return null;
    // Browser permission must be requested by the explicit button on the
    // Notifications screen, not by an app-start effect.
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      return null;
    }
    return registerWebPushNotificationsAsync(emitPushNotification);
  }

  const granted = await requestNotificationPermissionAsync();
  if (!granted) {
    return null;
  }

  const notifications = getNativeNotifications();

  if (!nativeListenerInstalled) {
    notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content as { title?: string; body?: string; data?: Record<string, unknown> };
      emitPushNotification({
        title: String(content.title || 'Victory Fitness'),
        message: String(content.body || 'You have a new update from Victory Fitness.'),
        data: content.data || {},
      });
    });
    nativeListenerInstalled = true;
  }

  if (!nativeResponseListenerInstalled) {
    notifications.addNotificationResponseReceivedListener((response) => {
      const content = response.notification.request.content as { title?: string; body?: string; data?: Record<string, unknown> };
      emitPushNotification({
        title: String(content.title || 'Victory Fitness'),
        message: String(content.body || 'You have a new update from Victory Fitness.'),
        data: content.data || {},
      });
    });
    nativeResponseListenerInstalled = true;
  }

  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('default', {
      name: 'Victory Fitness',
      importance: notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  // Register on every authenticated app session. The same device token can
  // belong to a different account after logout, so a global local-storage
  // cache can otherwise prevent the new account from receiving pushes.
  await apiRequest('/me/push-token', { method: 'POST', body: { token, platform: Platform.OS } });
  await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token);
  return token;
}

export async function requestNotificationPermissionAsync(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return setupWebPushNotificationsAsync();
  }

  if (!Constants.isDevice) {
    return false;
  }

  const notifications = getNativeNotifications();
  const existing = await notifications.getPermissionsAsync() as unknown as { granted: boolean };
  if (existing.granted) {
    return true;
  }

  return (await notifications.requestPermissionsAsync() as unknown as { granted: boolean }).granted;
}
