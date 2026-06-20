import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

type WebSource = {
  html?: string;
  uri?: string;
};

type RequestLike = {
  url: string;
};

type CrossPlatformWebViewProps = {
  source: WebSource;
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
  onShouldStartLoadWithRequest?: (request: RequestLike) => boolean;
};

export default function CrossPlatformWebView(props: CrossPlatformWebViewProps) {
  return <WebView {...props} />;
}
