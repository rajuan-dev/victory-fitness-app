import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '../constants/Colors';
import { AppNotification, AuthUser, fetchAppNotifications, fetchCurrentUser } from '../lib/api';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
import { fetchChallengeOverviewData, fetchCommunityPostsData } from '../lib/screenData';

type CampaignItem = {
  day: number;
  label: string;
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  action?: { label: string; route: string };
  fallback?: string;
};

type ChallengeAlert = {
  challenge_id: string;
  title: string;
  progress: number;
  points: number;
  days_left: number;
};

type ActivityNotification = {
  id: string;
  category: string;
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  route: string;
};

const CAMPAIGN: CampaignItem[] = [
  {
    day: 0,
    label: 'WELCOME + FIRST TASTE',
    title: 'Your coach is ready when you are',
    message: 'Welcome to Victory Gold. Ask your AI Coach one question right now and get your first useful answer.',
    icon: 'sparkles-outline',
    accent: Colors.primary,
    action: { label: 'Ask AI Coach', route: '/chat' },
  },
  {
    day: 1,
    label: 'GET INTO NUTRITION',
    title: 'Have you set up your meal plan?',
    message: 'It takes about 2 minutes to create a plan built around your goals. Starting early gives you more time to use it.',
    icon: 'restaurant-outline',
    accent: '#F97316',
    action: { label: 'Open Nutrition', route: '/mealPlan' },
  },
  {
    day: 2,
    label: 'SHOW, DO NOT TELL',
    title: 'See what Gold can do for you',
    message: 'Take a quick look at the Gold experience, then choose one feature to try today.',
    icon: 'play-circle-outline',
    accent: '#38BDF8',
    fallback: 'Video preview is not available yet. Explore your plan and coach instead.',
  },
  {
    day: 3,
    label: 'CHECK-IN',
    title: 'Keep your momentum going',
    message: 'A small action today makes the rest of your trial more useful. Open your coach or nutrition plan to continue.',
    icon: 'pulse-outline',
    accent: '#A855F7',
    action: { label: 'Continue Trial', route: '/(tabs)' },
  },
  {
    day: 4,
    label: 'PRE-DECISION WARMUP',
    title: 'Your trial ends tomorrow',
    message: 'Review what you have explored so far, then decide whether Gold fits the way you want to train.',
    icon: 'calendar-outline',
    accent: Colors.accentGold,
    action: { label: 'Review Plan', route: '/plan' },
  },
  {
    day: 5,
    label: 'CONVERSION MOMENT',
    title: 'Your 5-day trial is complete',
    message: 'You have reached the end of the Gold trial. Keep your plan, nutrition tools, and coaching support available by choosing your plan.',
    icon: 'checkmark-circle-outline',
    accent: Colors.accentGold,
    action: { label: 'Choose Your Plan', route: '/plan' },
    fallback: 'Video preview is not available yet. The plan decision is still available here.',
  },
];

function getTrialDay(startedAt?: string | null) {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [challengeAlert, setChallengeAlert] = React.useState<ChallengeAlert | null>(null);
  const [activityNotifications, setActivityNotifications] = React.useState<ActivityNotification[]>([]);
  const [pushNotifications, setPushNotifications] = React.useState<AppNotification[]>([]);
  const [permissionMessage, setPermissionMessage] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');

  const loadNotifications = React.useCallback(async (initialLoad = false) => {
    if (initialLoad) setLoading(true);
    else setRefreshing(true);

    try {
      setLoadError('');
      const [nextUser, overview, community, storedNotifications] = await Promise.all([
        fetchCurrentUser(),
        fetchChallengeOverviewData().catch(() => ({ active_challenges: [] })),
        fetchCommunityPostsData().catch(() => ({ posts: [] })),
        fetchAppNotifications().catch(() => []),
      ]);
      const overviewData = overview as { active_challenges?: Array<Partial<ChallengeAlert> & { id?: string }> };
      const active = Array.isArray(overviewData?.active_challenges) ? overviewData.active_challenges[0] : null;
      setUser(nextUser);
      setPushNotifications(storedNotifications);
      setChallengeAlert(active ? {
        challenge_id: String(active.challenge_id || active.id || ''),
        title: String(active.title || 'Today\'s challenge'),
        progress: Math.max(0, Math.min(1, Number(active.progress || 0))),
        points: Math.max(0, Number(active.points || 0)),
        days_left: Math.max(0, Number(active.days_left || 0)),
      } : null);
      const fullOverview = overview as {
        active_challenges?: Array<Record<string, unknown>>;
        completed_challenges?: Array<Record<string, unknown>>;
        ready_to_start?: Array<Record<string, unknown>>;
        active_chats?: Array<Record<string, unknown>>;
      };
      const nextActivity: ActivityNotification[] = [];
      const addChallengeItems = (items: Array<Record<string, unknown>> | undefined, category: string, icon: keyof typeof Ionicons.glyphMap, accent: string, message: (item: Record<string, unknown>) => string, routeFor: (item: Record<string, unknown>) => string) => {
        (Array.isArray(items) ? items : []).forEach((item, index) => {
          const id = String(item.challenge_id || item.id || `${category}-${index}`);
          nextActivity.push({ id: `${category}-${id}`, category, title: String(item.title || 'Challenge'), message: message(item), icon, accent, route: routeFor(item) });
        });
      };
      addChallengeItems(fullOverview.ready_to_start, 'CHALLENGE READY', 'flag-outline', '#38BDF8', (item) => `${String(item.description || 'This challenge is ready to start.')} ${Number(item.points || 0)} points available.`, (item) => `/challenges/${String(item.id || item.challenge_id || '')}`);
      addChallengeItems(fullOverview.active_challenges, 'CHALLENGE ACTIVE', 'flame-outline', '#FBBF24', (item) => `${Math.round(Number(item.progress || 0) * 100)}% complete. Finish today to keep your progress moving.`, (item) => `/challenges/progress/${String(item.challenge_id || item.id || '')}`);
      addChallengeItems(fullOverview.completed_challenges, 'CHALLENGE COMPLETE', 'trophy-outline', Colors.accentGold, (item) => `Completed with ${Number(item.points || 0)} points. View your progress card and share it.`, (item) => `/challenges/progress/${String(item.challenge_id || item.id || '')}`);
      addChallengeItems(fullOverview.active_chats, 'CHALLENGE CHAT', 'chatbubbles-outline', '#A855F7', (item) => `${Number(item.unread_count || item.unreadCount || 0)} unread messages in this challenge discussion.`, (item) => `/challenges/${String(item.challenge_id || item.id || '')}`);
      const posts = (community as { posts?: Array<Record<string, unknown>> })?.posts;
      (Array.isArray(posts) ? posts : []).slice(0, 30).forEach((post, index) => {
        const content = String(post.content || '').trim();
        const author = String(post.author_name || 'Community member');
        nextActivity.push({
          id: `community-${String(post.id || index)}`,
          category: 'COMMUNITY POST',
          title: `${author} posted in Community`,
          message: `${content.slice(0, 150)}${content.length > 150 ? '...' : ''}  ${Number(post.like_count || 0)} likes, ${Number(post.comment_count || 0)} comments.`,
          icon: 'people-outline',
          accent: '#22D3EE',
          route: '/community',
        });
      });
      setActivityNotifications(nextActivity);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load notifications right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => {
    let cancelled = false;
    if (!cancelled) void loadNotifications(!user);
    return () => { cancelled = true; };
  }, [loadNotifications, user]));

  const startedAt = user?.subscription_started_at ?? user?.subscription?.started_at;
  const trialDay = getTrialDay(startedAt);
  const activeDay = trialDay === null ? 0 : Math.min(trialDay, 5);
  const isComplete = trialDay !== null && trialDay >= 5;

  const enableNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      setPermissionMessage(token ? 'Notifications enabled.' : 'Notifications were not enabled. Check browser or device settings.');
    } catch {
      setPermissionMessage('Unable to enable notifications. Check browser or device settings.');
    }
  };

  if (loading) return <View style={styles.loading}><Text style={styles.muted}>Loading notifications...</Text></View>;
  if (loadError && !user) {
    return (
      <View style={styles.loading}>
        <Ionicons name="cloud-offline-outline" size={32} color={Colors.primary} />
        <Text style={styles.emptyTitle}>Notifications unavailable</Text>
        <Text style={styles.muted}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void loadNotifications(true)}><Text style={styles.retryText}>Try Again</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadNotifications(false)} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>GOLD TRIAL</Text>
            <Text style={styles.title}>Notifications</Text>
          </View>
          <View style={[styles.statusDot, isComplete && styles.statusDotComplete]} />
        </View>

        <View style={styles.permissionCard}>
          <View style={styles.permissionRow}><Ionicons name="notifications-outline" size={22} color={Colors.primary} /><Text style={styles.permissionText}>Get an alert when new workouts are published.</Text></View>
          <TouchableOpacity style={styles.permissionButton} onPress={() => void enableNotifications()}><Text style={styles.permissionButtonText}>Enable notifications</Text></TouchableOpacity>
          {permissionMessage ? <Text style={styles.permissionStatus}>{permissionMessage}</Text> : null}
        </View>

        {pushNotifications.length > 0 ? (
          <View style={styles.activitySection}>
            <Text style={styles.activitySectionTitle}>NEW FROM VICTORY FITNESS</Text>
            {pushNotifications.map((item) => (
              <View key={item.id} style={styles.activityItem}>
                <View style={[styles.activityIcon, { backgroundColor: `${Colors.primary}20` }]}><Ionicons name="sparkles-outline" size={21} color={Colors.primary} /></View>
                <View style={styles.activityBody}><Text style={[styles.activityCategory, { color: Colors.primary }]}>{item.type.replaceAll('_', ' ').toUpperCase()}</Text><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityText}>{item.message}</Text><Text style={styles.permissionStatus}>{formatDate(item.created_at)}</Text></View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>{isComplete ? 'TRIAL COMPLETE' : 'YOUR TRIAL PROGRESS'}</Text>
              <Text style={styles.summaryTitle}>{trialDay === null ? 'Gold trial setup' : `Day ${Math.min(trialDay, 5)} of 5`}</Text>
            </View>
            <Text style={styles.summaryNumber}>{trialDay === null ? '—' : `${Math.min(trialDay, 5)}/5`}</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${trialDay === null ? 0 : Math.min(trialDay / 5, 1) * 100}%` }]} /></View>
          <Text style={styles.summaryMeta}>Started {formatDate(startedAt)}</Text>
        </View>

        {loadError ? <View style={styles.inlineError}><Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" /><Text style={styles.inlineErrorText}>{loadError}</Text></View> : null}

        {activityNotifications.length > 0 ? (
          <View style={styles.activitySection}>
            <Text style={styles.activitySectionTitle}>CHALLENGES & COMMUNITY</Text>
            {activityNotifications.map((item) => (
              <TouchableOpacity key={item.id} style={styles.activityItem} onPress={() => router.push(item.route as never)} activeOpacity={0.82}>
                <View style={[styles.activityIcon, { backgroundColor: `${item.accent}20` }]}><Ionicons name={item.icon} size={21} color={item.accent} /></View>
                <View style={styles.activityBody}><Text style={[styles.activityCategory, { color: item.accent }]}>{item.category}</Text><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityText}>{item.message}</Text></View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {trialDay === null ? (
          <View style={styles.emptyState}><Ionicons name="notifications-off-outline" size={30} color={Colors.primary} /><Text style={styles.emptyTitle}>Your trial timeline is not ready yet</Text><Text style={styles.muted}>Notifications will appear here once your Gold trial start date is recorded.</Text></View>
        ) : null}

        {CAMPAIGN.map((item) => {
          const available = item.day <= activeDay;
          const current = item.day === activeDay && !isComplete;
          return (
            <View key={item.day} style={[styles.item, !available && styles.itemUpcoming, current && styles.itemCurrent]}>
              <View style={[styles.itemIcon, { backgroundColor: `${item.accent}20` }]}><Ionicons name={item.icon} size={21} color={item.accent} /></View>
              <View style={styles.itemBody}>
                <View style={styles.itemMeta}><Text style={[styles.day, { color: item.accent }]}>DAY {item.day}</Text><Text style={styles.label}>{item.label}</Text></View>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.message}>{item.message}</Text>
                {available && item.fallback ? <Text style={styles.fallback}><Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} /> {item.fallback}</Text> : null}
                {available && item.action ? <TouchableOpacity style={[styles.action, { borderColor: `${item.accent}70` }]} onPress={() => router.push(item.action!.route as never)}><Text style={[styles.actionText, { color: item.accent }]}>{item.action.label}</Text><Ionicons name="arrow-forward" size={16} color={item.accent} /></TouchableOpacity> : null}
              </View>
            </View>
          );
        })}

        <View style={styles.consentNote}><Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} /><Text style={styles.consentText}>{user?.marketing_consent ? 'You agreed to email/SMS re-engagement at signup.' : 'Marketing consent is off. Future win-back messages will not be sent.'}</Text></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, paddingTop: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 12 },
  eyebrow: { color: Colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 26, fontFamily: 'Inter_700Bold', marginTop: 3 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  statusDotComplete: { backgroundColor: Colors.accentGold },
  summary: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.inputBorder, marginBottom: 20 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: Colors.textMuted, fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  summaryTitle: { color: Colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 5 },
  summaryNumber: { color: Colors.primary, fontSize: 22, fontFamily: 'Inter_700Bold' },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 18 },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  summaryMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 10, fontFamily: 'Inter_400Regular' },
  item: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 14, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: Colors.inputBorder },
  itemCurrent: { borderColor: 'rgba(0,240,208,0.5)' },
  itemUpcoming: { opacity: 0.48 },
  itemIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemBody: { flex: 1 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  day: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  label: { color: Colors.textMuted, fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  itemTitle: { color: Colors.text, fontSize: 17, fontFamily: 'Inter_700Bold', marginTop: 7 },
  message: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6, fontFamily: 'Inter_400Regular' },
  fallback: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 9, fontFamily: 'Inter_400Regular' },
  action: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 12 },
  actionText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  emptyState: { backgroundColor: Colors.surface, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 10, marginBottom: 6 },
  muted: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  consentNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.inputBorder },
  consentText: { flex: 1, color: Colors.textMuted, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  permissionCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.inputBorder, marginBottom: 20 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  permissionText: { color: Colors.text, fontSize: 13, lineHeight: 18, flex: 1 },
  permissionButton: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  permissionButtonText: { color: Colors.background, fontFamily: 'Inter_700Bold', fontSize: 12 },
  permissionStatus: { color: Colors.textMuted, fontSize: 11, marginTop: 7 },
  challengeNotice: { flexDirection: 'row', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.34)', borderRadius: 14, padding: 14, marginBottom: 14 },
  challengeNoticeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  challengeNoticeBody: { flex: 1 },
  challengeNoticeEyebrow: { color: '#FBBF24', fontSize: 10, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
  challengeNoticeTitle: { color: Colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 4 },
  challengeNoticeText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 4 },
  challengeNoticeAction: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  challengeNoticeActionText: { color: Colors.primary, fontSize: 12, fontFamily: 'Inter_700Bold' },
  activitySection: { marginBottom: 16 },
  activitySectionTitle: { color: Colors.textMuted, fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold', marginBottom: 9 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 9, borderWidth: 1, borderColor: Colors.inputBorder },
  activityIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  activityBody: { flex: 1, minWidth: 0 },
  activityCategory: { fontSize: 10, letterSpacing: 1, fontFamily: 'Inter_700Bold' },
  activityTitle: { color: Colors.text, fontSize: 15, fontFamily: 'Inter_700Bold', marginTop: 4 },
  activityText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4, fontFamily: 'Inter_400Regular' },
  retryButton: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#06201C', fontSize: 13, fontFamily: 'Inter_700Bold' },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(127,29,29,0.22)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)', borderRadius: 10, padding: 10, marginBottom: 14 },
  inlineErrorText: { flex: 1, color: '#FECACA', fontSize: 12, fontFamily: 'Inter_400Regular' },
});
