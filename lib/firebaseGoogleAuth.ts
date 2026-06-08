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

type FirebaseIdentityToolkitResponse = {
  idToken?: string;
  email?: string;
  displayName?: string;
  localId?: string;
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

export async function exchangeGoogleTokensForFirebaseSession(tokens: GoogleTokens): Promise<FirebaseIdentityToolkitResponse> {
  const { firebaseApiKey } = getFirebaseGoogleConfig();
  if (!firebaseApiKey) {
    throw new Error('Firebase API key is not configured.');
  }

  const idToken = String(tokens.idToken || '').trim();
  const accessToken = String(tokens.accessToken || '').trim();
  if (!idToken && !accessToken) {
    throw new Error('Google sign-in did not return a token.');
  }

  const postBody = new URLSearchParams({
    providerId: 'google.com',
    requestUri: 'http://localhost',
    returnIdpCredential: 'true',
    returnSecureToken: 'true',
    id_token: idToken,
    access_token: accessToken,
  }).toString();

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      postBody,
      requestUri: 'http://localhost',
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as FirebaseIdentityToolkitResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Firebase sign-in failed.');
  }

  if (!payload.idToken) {
    throw new Error('Firebase did not return an ID token.');
  }

  return payload;
}

export async function exchangeFirebaseTokenForAppSession(firebaseIdToken: string): Promise<AuthResponse> {
  const token = String(firebaseIdToken || '').trim();
  if (!token) {
    throw new Error('Missing Firebase ID token.');
  }

  return apiRequest<AuthResponse>('/auth/firebase', {
    method: 'POST',
    body: { id_token: token },
  });
}

export async function signInWithFirebaseGoogle(tokens: GoogleTokens): Promise<AuthResponse> {
  const firebaseSession = await exchangeGoogleTokensForFirebaseSession(tokens);
  return exchangeFirebaseTokenForAppSession(firebaseSession.idToken || '');
}
