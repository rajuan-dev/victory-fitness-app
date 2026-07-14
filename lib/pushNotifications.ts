import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './api';
import { registerWebPushNotificationsAsync } from './firebaseWebPush';

declare const process: { env?: Record<string, string | undefined> };

export const FIREBASE_VAPID_KEY = String(process.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim();

const REGISTERED_TOKEN_KEY = 'victory_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web' || !Constants.isDevice) {
    return Platform.OS === 'web' ? registerWebPushNotificationsAsync() : null;
  }

  const existing = await Notifications.getPermissionsAsync() as unknown as { granted: boolean };
  let granted = existing.granted;
  if (!granted) {
    granted = (await Notifications.requestPermissionsAsync() as unknown as { granted: boolean }).granted;
  }
  if (!granted) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Victory Fitness',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  const previousToken = await AsyncStorage.getItem(REGISTERED_TOKEN_KEY);
  if (previousToken !== token) {
    await apiRequest('/me/push-token', { method: 'POST', body: { token, platform: Platform.OS } });
    await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token);
  }
  return token;
}
