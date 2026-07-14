import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './api';

declare const process: { env?: Record<string, string | undefined> };

type FirebaseMessaging = {
  getToken(options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }): Promise<string>;
};

type FirebaseGlobal = {
  initializeApp(config: Record<string, string>): void;
  messaging(): FirebaseMessaging;
};

declare global {
  interface Window {
    firebase?: FirebaseGlobal;
  }
}

const REGISTERED_TOKEN_KEY = 'victory_push_token';

export async function registerWebPushNotificationsAsync(): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  const vapidKey = String(process.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim();
  if (!vapidKey || !window.firebase) {
    return null;
  }

  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const token = await window.firebase.messaging().getToken({ vapidKey, serviceWorkerRegistration: registration });
  if (!token) {
    return null;
  }

  if ((await AsyncStorage.getItem(REGISTERED_TOKEN_KEY)) !== token) {
    await apiRequest('/me/push-token', { method: 'POST', body: { token, platform: 'web' } });
    await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token);
  }
  return token;
}
