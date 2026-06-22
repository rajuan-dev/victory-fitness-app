/**
 * CrossPlatformWebView — shared type barrel.
 *
 * TypeScript uses this file for type-checking.
 * At runtime the Metro / Expo bundler automatically picks up:
 *   • CrossPlatformWebView.web.tsx    – web
 *   • CrossPlatformWebView.native.tsx – iOS / Android
 *
 * DO NOT import react-native-webview here; it is not available on web
 * and would break TypeScript resolution in a web-first tsconfig.
 */
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type CrossPlatformWebViewProps = {
  source: { html?: string; uri?: string };
  style?: StyleProp<ViewStyle>;
  originWhitelist?: string[];
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  allowsInlineMediaPlayback?: boolean;
  setSupportMultipleWindows?: boolean;
  javaScriptCanOpenWindowsAutomatically?: boolean;
  scrollEnabled?: boolean;
  startInLoadingState?: boolean;
  renderLoading?: () => React.ReactElement | null;
  onShouldStartLoadWithRequest?: (request: { url: string }) => boolean;
};

// This default export is a type-only stub so TypeScript is happy.
// The real implementations live in .native.tsx and .web.tsx and are
// swapped in by the bundler — this export is never executed at runtime.
declare const CrossPlatformWebView: React.ComponentType<CrossPlatformWebViewProps>;
export default CrossPlatformWebView;
