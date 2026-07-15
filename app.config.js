const baseConfig = require('./app.json');

const env = (name) => String(process.env[name] || '').trim();

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    extra: {
      ...baseConfig.expo.extra,
      firebase: {
        apiKey: env('EXPO_PUBLIC_FIREBASE_API_KEY'),
        projectId: env('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
        messagingSenderId: env('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
        appId: env('EXPO_PUBLIC_FIREBASE_APP_ID'),
        vapidKey: env('EXPO_PUBLIC_FIREBASE_VAPID_KEY'),
        androidClientId: env('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
        webClientId: env('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
      },
    },
  },
};
