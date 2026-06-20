import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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

type ParsedMedia =
  | { kind: 'video'; url: string }
  | { kind: 'audio'; url: string }
  | { kind: 'iframe'; url: string }
  | { kind: 'unknown'; url: string };

function parseMediaFromHtml(html: string): ParsedMedia | null {
  const normalized = String(html || '').trim();
  if (!normalized) {
    return null;
  }

  const videoMatch = normalized.match(/<video[^>]*\ssrc="([^"]+)"/i);
  if (videoMatch?.[1]) {
    return { kind: 'video', url: videoMatch[1] };
  }

  const audioMatch = normalized.match(/<audio[^>]*\ssrc="([^"]+)"/i);
  if (audioMatch?.[1]) {
    return { kind: 'audio', url: audioMatch[1] };
  }

  const iframeMatch = normalized.match(/<iframe[^>]*\ssrc="([^"]+)"/i);
  if (iframeMatch?.[1]) {
    return { kind: 'iframe', url: iframeMatch[1] };
  }

  return { kind: 'unknown', url: normalized };
}

function isAllowedUrl(url: string, guard?: CrossPlatformWebViewProps['onShouldStartLoadWithRequest']) {
  if (!guard) {
    return true;
  }
  return guard({ url });
}

export default function CrossPlatformWebView({
  source,
  style,
  startInLoadingState,
  renderLoading,
  onShouldStartLoadWithRequest,
}: CrossPlatformWebViewProps) {
  const [isLoading, setIsLoading] = useState(Boolean(startInLoadingState));

  const media = useMemo(() => {
    if (source?.uri) {
      return { kind: 'iframe', url: source.uri.trim() } as ParsedMedia;
    }
    if (source?.html) {
      const parsed = parseMediaFromHtml(source.html);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }, [source?.html, source?.uri]);

  useEffect(() => {
    setIsLoading(Boolean(startInLoadingState));
  }, [startInLoadingState, media?.url]);

  useEffect(() => {
    if (media?.kind === 'unknown') {
      setIsLoading(false);
    }
  }, [media?.kind]);

  if (!media || !media.url) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Media unavailable</Text>
        </View>
      </View>
    );
  }

  if (!isAllowedUrl(media.url, onShouldStartLoadWithRequest)) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Blocked media URL</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {isLoading ? (
        <View style={styles.loadingOverlay}>
          {renderLoading ? renderLoading() : <ActivityIndicator size="small" color="#22C55E" />}
        </View>
      ) : null}
      {media.kind === 'video' ? (
        <video
          controls
          playsInline
          preload="metadata"
          src={media.url}
          style={styles.media}
          onLoadedData={() => setIsLoading(false)}
          onCanPlay={() => setIsLoading(false)}
        />
      ) : media.kind === 'audio' ? (
        <audio
          controls
          preload="metadata"
          src={media.url}
          style={styles.audio}
          onLoadedData={() => setIsLoading(false)}
          onCanPlay={() => setIsLoading(false)}
        />
      ) : (
        <iframe
          title="Embedded media"
          src={media.url}
          style={styles.iframe}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          scrolling="no"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setIsLoading(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: '#000',
  } as any,
  audio: {
    width: '100%',
    height: 48,
    backgroundColor: '#0f172a',
  } as any,
  iframe: {
    width: '100%',
    height: '100%',
    border: 0,
    backgroundColor: '#000',
  } as any,
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    minHeight: 120,
  },
  emptyText: {
    color: '#fff',
    fontSize: 14,
  },
});
