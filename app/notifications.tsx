import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '../constants/Colors';
import { AuthUser, fetchCurrentUser } from '../lib/api';

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
  const [loading, setLoading] = React.useState(true);

  useFocusEffect(React.useCallback(() => {
    let cancelled = false;
    void fetchCurrentUser().then((nextUser) => {
      if (!cancelled) setUser(nextUser);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []));

  const startedAt = user?.subscription_started_at ?? user?.subscription?.started_at;
  const trialDay = getTrialDay(startedAt);
  const activeDay = trialDay === null ? 0 : Math.min(trialDay, 5);
  const isComplete = trialDay !== null && trialDay >= 5;

  if (loading) return <View style={styles.loading}><Text style={styles.muted}>Loading notifications...</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
});
