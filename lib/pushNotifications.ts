import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './api';
import { registerWebPushNotificationsAsync, setupWebPushNotificationsAsync } from './firebaseWebPush';

declare const process: { env?: Record<string, string | undefined> };

export const FIREBASE_VAPID_KEY = String(process.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim();

const REGISTERED_TOKEN_KEY = 'victory_push_token';

type NotificationsModule = typeof import('expo-notifications');
let notificationsModule: NotificationsModule | null = null;

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
    return Platform.OS === 'web' ? registerWebPushNotificationsAsync() : null;
  }

  const granted = await requestNotificationPermissionAsync();
  if (!granted) {
    return null;
  }

  const notifications = getNativeNotifications();

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
  const previousToken = await AsyncStorage.getItem(REGISTERED_TOKEN_KEY);
  if (previousToken !== token) {
    await apiRequest('/me/push-token', { method: 'POST', body: { token, platform: Platform.OS } });
    await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token);
  }
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
