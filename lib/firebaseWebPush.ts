import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './api';

declare const process: { env?: Record<string, string | undefined> };

type FirebaseMessaging = {
  getToken(options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }): Promise<string>;
  onMessage(callback: (payload: { notification?: { title?: string; body?: string } }) => void): () => void;
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
let foregroundListenerInstalled = false;

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
  if (!foregroundListenerInstalled) {
    window.firebase.messaging().onMessage((payload) => {
      const title = payload.notification?.title || 'Victory Fitness';
      const body = payload.notification?.body || 'You have a new update from Victory Fitness.';
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192.png' });
      }
    });
    foregroundListenerInstalled = true;
  }
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
