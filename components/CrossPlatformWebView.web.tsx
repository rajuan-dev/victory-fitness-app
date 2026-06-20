import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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

export default function CrossPlatformWebView({
  source,
  style,
  startInLoadingState,
  renderLoading,
  onShouldStartLoadWithRequest,
}: CrossPlatformWebViewProps) {
  const [isLoading, setIsLoading] = useState(Boolean(startInLoadingState));

  const iframeSrc = source?.uri?.trim() || undefined;
  const iframeSrcDoc = source?.html || undefined;

  const allowed = useMemo(() => {
    const target = iframeSrc || '';
    if (!target || !onShouldStartLoadWithRequest) {
      return true;
    }
    return onShouldStartLoadWithRequest({ url: target });
  }, [iframeSrc, onShouldStartLoadWithRequest]);

  return (
    <View style={[styles.container, style]}>
      {isLoading ? (
        <View style={styles.loadingOverlay}>
          {renderLoading ? renderLoading() : <ActivityIndicator size="small" color="#22C55E" />}
        </View>
      ) : null}
      {allowed ? (
        <iframe
          src={iframeSrc}
          srcDoc={iframeSrcDoc}
          style={styles.iframe}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          scrolling="no"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-same-origin allow-scripts allow-forms allow-presentation allow-popups"
          onLoad={() => setIsLoading(false)}
        />
      ) : (
        <View style={styles.blockedState} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  iframe: {
    borderWidth: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  blockedState: {
    flex: 1,
    backgroundColor: '#000',
  },
});
