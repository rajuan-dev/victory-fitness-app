declare const process: {
  env?: Record<string, string | undefined>;
};

import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import { apiRequest, type AuthResponse } from './api';

WebBrowser.maybeCompleteAuthSession();

type FirebaseGoogleConfig = {
  firebaseApiKey: string;
  projectId: string;
  androidClientId: string;
  googleClientId: string;
};

type GoogleTokens = {
  idToken?: string | null;
  accessToken?: string | null;
};

function readEnv(name: string): string {
  return String(process.env?.[name] ?? '').trim();
}

export function getFirebaseGoogleConfig(): FirebaseGoogleConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, any>;
  const firebaseExtra = (extra.firebase ?? {}) as Record<string, any>;
  const googleExtra = (extra.googleHealthConnect ?? {}) as Record<string, any>;

  const firebaseApiKey =
    readEnv('EXPO_PUBLIC_FIREBASE_API_KEY')
    || String(firebaseExtra.apiKey ?? '').trim();
  const projectId =
    readEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID')
    || String(firebaseExtra.projectId ?? '').trim()
    || String(googleExtra.projectId ?? '').trim();
  const androidClientId =
    readEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID')
    || String(firebaseExtra.androidClientId ?? '').trim();
  const googleClientId =
    readEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID')
    || String(firebaseExtra.webClientId ?? '').trim()
    || String(googleExtra.clientId ?? '').trim();

  return {
    firebaseApiKey,
    projectId,
    androidClientId,
    googleClientId,
  };
}

export async function signInWithFirebaseGoogle(tokens: GoogleTokens): Promise<AuthResponse> {
  const idToken = String(tokens.idToken || '').trim();
  const accessToken = String(tokens.accessToken || '').trim();
  if (!idToken && !accessToken) {
    throw new Error('Google sign-in did not return a token.');
  }

  return apiRequest<AuthResponse>('/auth/google', {
    method: 'POST',
    body: {
      id_token: idToken || undefined,
      access_token: accessToken || undefined,
    },
  });
}
