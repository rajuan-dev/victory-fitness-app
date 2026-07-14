import React from 'react';

declare const process: { env?: Record<string, string | undefined> };

const firebaseConfig = {
  apiKey: String(process.env?.EXPO_PUBLIC_FIREBASE_API_KEY ?? ''),
  authDomain: `${String(process.env?.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '')}.firebaseapp.com`,
  projectId: String(process.env?.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? ''),
  storageBucket: `${String(process.env?.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '')}.firebasestorage.app`,
  messagingSenderId: String(process.env?.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? ''),
  appId: String(process.env?.EXPO_PUBLIC_FIREBASE_APP_ID ?? ''),
};

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content="#070B14" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Victory Fitness" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js" />
        <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js" />
        <script dangerouslySetInnerHTML={{ __html: `
          if (window.firebase) {
            window.firebase.initializeApp({
              apiKey: '${firebaseConfig.apiKey}',
              authDomain: '${firebaseConfig.authDomain}',
              projectId: '${firebaseConfig.projectId}',
              storageBucket: '${firebaseConfig.storageBucket}',
              messagingSenderId: '${firebaseConfig.messagingSenderId}',
              appId: '${firebaseConfig.appId}'
            });
          }
        ` }} />
        <style
          id="expo-reset"
          dangerouslySetInnerHTML={{
            __html: '#root,body,html{height:100%}body{overflow:hidden;background:#070B14}#root{display:flex}',
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
