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
let webPushSetupPromise: Promise<boolean> | null = null;

function hasWebPushConfiguration() {
  return Boolean(String(process.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim() && window.firebase);
}

/**
 * Requests browser notification permission and installs the foreground
 * listener. This is intentionally independent from token registration so the
 * permission prompt can be shown before a user signs in.
 */
export function setupWebPushNotificationsAsync(): Promise<boolean> {
  if (webPushSetupPromise) {
    return webPushSetupPromise;
  }

  const setupPromise = (async () => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      return false;
    }

    const vapidKey = String(process.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim();
    if (!vapidKey || !window.firebase) {
      return true;
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

    // Keep the registration alive for the token request below.
    void registration;
    return true;
  })().catch(() => false);

  webPushSetupPromise = setupPromise.then((result) => {
    // Allow a later retry if Firebase scripts/config were not ready yet.
    if (!result || (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default')) {
      webPushSetupPromise = null;
    }
    return result;
  });

  return webPushSetupPromise;
}

export async function registerWebPushNotificationsAsync(): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  if (!(await setupWebPushNotificationsAsync()) || !hasWebPushConfiguration()) {
    return null;
  }

  const vapidKey = String(process.env?.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim();
  const registration = await navigator.serviceWorker.ready;
  if (!registration.pushManager) {
    return null;
  }
  const firebase = window.firebase;
  if (!firebase) {
    return null;
  }
  let token: string;
  try {
    token = await firebase.messaging().getToken({ vapidKey, serviceWorkerRegistration: registration });
  } catch {
    return null;
  }
  if (!token) {
    return null;
  }

  if ((await AsyncStorage.getItem(REGISTERED_TOKEN_KEY)) !== token) {
    await apiRequest('/me/push-token', { method: 'POST', body: { token, platform: 'web' } });
    await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token);
  }
  return token;
}
