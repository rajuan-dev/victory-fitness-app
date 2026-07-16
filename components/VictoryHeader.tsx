import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchAppNotifications } from '../lib/api';
import { subscribeToPushNotifications } from '../lib/pushNotifications';

export default function VictoryHeader() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const refreshUnreadCount = async () => {
      try {
        const notifications = await fetchAppNotifications();
        if (!cancelled) setUnreadCount(notifications.filter((item) => !item.read).length);
      } catch {
        // The bell remains available if the inbox is temporarily offline.
      }
    };
    void refreshUnreadCount();
    const interval = setInterval(() => { void refreshUnreadCount(); }, 15000);
    const unsubscribe = subscribeToPushNotifications(() => { void refreshUnreadCount(); });
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.brandBlock}>
          <Text style={styles.brandTitle}>V I C T O R Y</Text>
          <Text style={styles.brandSubtitle}>F I T N E S S</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          hitSlop={10}
        >
          <Ionicons name="notifications-outline" size={23} color="#fff" />
          {unreadCount > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View> : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerRow: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  brandBlock: { alignItems: 'center' },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 8,
    fontFamily: 'Inter_700Bold',
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 6,
    marginTop: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  notificationButton: {
    position: 'absolute',
    right: 2,
    top: 4,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  unreadBadge: { position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F87171', borderWidth: 2, borderColor: '#101827' },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 9, fontFamily: 'Inter_700Bold', textAlign: 'center' },
});
