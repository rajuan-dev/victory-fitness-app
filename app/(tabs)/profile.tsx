import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import { clearAuthTokens, fetchCurrentUser } from '../../lib/api';

const pts = 105;
const nextRankPts = 500;
const progressFraction = pts / nextRankPts;

const STATS = [
  { label: 'Workouts', value: '12', icon: '🏋️' },
  { label: 'Streak', value: '0d', icon: '🔥' },
  { label: 'Points', value: '105', icon: '⚡' },
  { label: 'Rank', value: 'Recruit', icon: '🎖️' },
];

const MENU_SECTIONS = [
  {
    title: 'Account',
    items: [
      { icon: 'person-outline', label: 'Edit Profile', tint: '#4F8EF7', route: '/profile/edit' },
      { icon: 'document-text-outline', label: 'Application', tint: '#EAB308', route: '/profile/application' },
      { icon: 'lock-closed-outline', label: 'Privacy Policy', tint: '#A855F7', route: '/profile/privacy' },
      { icon: 'language-outline', label: 'Language', tint: '#22C55E', value: 'English' },
      { icon: 'help-circle-outline', label: 'Help & Support', tint: '#8B5CF6', route: '/profile/support' },
    ],
  },
  {
    title: 'Fitness',
    items: [
      { icon: 'barbell-outline', label: 'Workout', tint: '#06B6D4', route: '/workoutplan' },
      { icon: 'restaurant-outline', label: 'Nutrition', tint: '#F97316', route: '/mealPlan' },
      { icon: 'body-outline', label: 'Journal', tint: '#EC4899', route: '/journal' },
    ],
  }
];

export default function ProfileScreen() {
  const router = useRouter();
  const [me, setMe] = React.useState<{
    id: string;
    name: string;
    email: string;
    is_verified: boolean;
    role?: string;
    is_admin?: boolean;
    country?: string;
    profileImage?: string;
  } | null>(null);
  const [loadingMe, setLoadingMe] = React.useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      const loadMe = async () => {
        setLoadingMe(true);
        try {
          const response = await fetchCurrentUser();
          if (!cancelled) {
            setMe(response);
          }
        } catch {
          if (!cancelled) {
            setMe(null);
          }
        } finally {
          if (!cancelled) {
            setLoadingMe(false);
          }
        }
      };

      loadMe();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const displayName = me?.name ?? 'Loading...';
  const displayEmail = me?.email ?? 'Fetching /me data';
  const displayRole = me?.is_admin ? 'ADMIN' : (me?.role?.toUpperCase() ?? 'MEMBER');
  const displayVerified = me?.is_verified ? 'Verified' : 'Not verified';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <VictoryHeader />

        {/* ── Hero Profile Card ── */}
        <View style={[styles.heroCard, { backgroundColor: Colors.surface }]}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <Image
              source={
                me?.profileImage
                  ? { uri: me.profileImage }
                  : require('../../assets/profile-placeholder.png')
              }
              style={styles.avatarImage}
            />
          </View>

          {/* Name & Badge */}
          <Text style={styles.heroName}>{loadingMe ? 'Loading...' : displayName}</Text>
          <Text style={styles.heroEmail}>{loadingMe ? 'Fetching /me data' : displayEmail}</Text>
          <View style={styles.heroBadgeRow}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>🎖️ {loadingMe ? 'MEMBER' : displayRole}</Text>
            </View>
            <View style={styles.ptsBadge}>
              <Text style={styles.ptsBadgeText}>⚡ {loadingMe ? '...' : pts} PTS</Text>
            </View>
          </View>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMetaText}>{loadingMe ? 'Loading profile...' : displayVerified}</Text>
            {me?.is_admin ? <Text style={styles.heroMetaAdmin}>Admin account</Text> : null}
          </View>

          {/* Rank Progress */}
          <View style={styles.rankProgressWrap}>
            <View style={styles.rankProgressLabels}>
              <Text style={styles.rankProgressLabel}>RECRUIT</Text>
              <Text style={styles.rankProgressLabel}>{nextRankPts - pts} pts to WARRIOR</Text>
            </View>
            <View style={styles.rankBarBg}>
              <View
                style={[styles.rankBarFill, { width: `${progressFraction * 100}%` as any, backgroundColor: Colors.accentBlue }]}
              />
            </View>
          </View>
        </View>

        {/* ── Stats Grid ── */}
        <View style={styles.statsGrid}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statCell}>
              <Text style={styles.statEmoji}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Body Metrics ── */}
        <View style={styles.metricsCard}>
          <View style={styles.metricsTitleRow}>
            <Text style={styles.metricsTitle}>BODY METRICS</Text>
            <TouchableOpacity
              style={styles.metricsEditBtn}
              activeOpacity={0.8}
              onPress={() => router.push('/profile/metrics')}
            >
              <Ionicons name="pencil-outline" size={14} color="#06B6D4" />
              <Text style={styles.metricsEditText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.metricsGrid}>
            {[
              { label: 'Age', value: '28', unit: 'yrs', icon: 'calendar-outline', tint: '#4F8EF7' },
              { label: 'Height', value: '175', unit: 'cm', icon: 'resize-outline', tint: '#06B6D4' },
              { label: 'Weight', value: '72', unit: 'kg', icon: 'barbell-outline', tint: '#A855F7' },
              { label: 'Gender', value: 'Male', unit: '', icon: 'person-outline', tint: '#F97316' },
            ].map((m) => (
              <View key={m.label} style={styles.metricCard}>
                <View style={[styles.metricIconBox, { backgroundColor: `${m.tint}18` }]}>
                  <Ionicons name={m.icon as any} size={18} color={m.tint} />
                </View>
                <Text style={styles.metricBigVal}>
                  {m.value}
                  {m.unit ? <Text style={styles.metricUnit}> {m.unit}</Text> : null}
                </Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Coach Cards ── */}
        <View style={styles.coachSection}>
          <Text style={styles.sectionTitle}>MY COACHES</Text>
          <View style={[styles.coachCard, { backgroundColor: Colors.surface }]}>
            <View style={[styles.coachIconWrap, { backgroundColor: Colors.accentBlue }]}>
              <Ionicons name="add" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coachName}>COACH VICTOR</Text>
              <Text style={styles.coachStatus}>🟢 Ready for you</Text>
            </View>
            <TouchableOpacity
              style={styles.coachArrow}
              onPress={() => router.push('/chat')}
            >
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
          <View style={styles.coachCard}>
            <View style={[styles.coachIconWrap, { backgroundColor: Colors.accentPurple }]}>
              <Ionicons name="pulse" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coachName}>LONGEVITY OS</Text>
              <Text style={[styles.coachStatus, { color: '#A855F7' }]}>⚡ Optimizing for you</Text>
            </View>
            <TouchableOpacity
              style={styles.coachArrow}
              onPress={() => router.push('/profile/longevity-os')}
            >
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Menu Sections ── */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, i) => (
                <View key={item.label}>
                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => (item as any).route && router.push((item as any).route)}
                  >
                    <View style={[styles.menuIconWrap, { backgroundColor: `${item.tint}20` }]}>
                      <Ionicons name={item.icon as any} size={18} color={item.tint} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <View style={styles.menuRight}>
                      {(item as any).value && <Text style={styles.menuValue}>{(item as any).value}</Text>}
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
                    </View>
                  </TouchableOpacity>
                  {i < section.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* ── Log Out ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.7}
          onPress={async () => {
            await clearAuthTokens();
            router.replace('/login');
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Victory Fitness v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 30 },


  /* Hero Card */
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.15)',
    marginBottom: 16,
  },
  avatarWrap: { position: 'relative', width: 88, height: 88, marginBottom: 16 },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    resizeMode: 'cover',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.28)',
  },
  rankRingOuter: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 50,
    padding: 3,
    overflow: 'hidden',
  },
  rankRingGrad: {
    flex: 1,
    borderRadius: 50,
    opacity: 0.5,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1E1E38',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.4)',
  },
  heroName: { fontSize: 26, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold', letterSpacing: 1, marginBottom: 10 },
  heroEmail: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  heroBadgeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  rankBadge: { backgroundColor: 'rgba(6,182,212,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)' },
  rankBadgeText: { color: '#06B6D4', fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  ptsBadge: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  ptsBadgeText: { color: '#F59E0B', fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  heroMetaText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  heroMetaAdmin: {
    color: '#D8B4FE',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  rankProgressWrap: { width: '100%', marginBottom: 16 },
  rankProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rankProgressLabel: { fontSize: 10, color: Colors.textMuted, fontFamily: 'Inter_400Regular', letterSpacing: 0.5 },
  rankBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  rankBarFill: { height: '100%', borderRadius: 4 },

  innerCirclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(6,182,212,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
  },
  innerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#06B6D4' },
  innerCircleText: { fontSize: 11, fontWeight: '700', color: '#06B6D4', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },

  /* Stats */
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  statCell: {
    flex: 1,
    backgroundColor: '#13132A',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  statEmoji: { fontSize: 20, marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 9, color: Colors.textMuted, fontFamily: 'Inter_400Regular', letterSpacing: 0.4, textTransform: 'uppercase' },

  /* Body Metrics */
  metricsCard: {
    marginHorizontal: 16,
    backgroundColor: '#13132A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 16,
  },
  metricsTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  metricsTitle: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_700Bold', letterSpacing: 1, textTransform: 'uppercase' },
  metricsEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(6,182,212,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(6,182,212,0.25)' },
  metricsEditText: { color: '#06B6D4', fontSize: 12, fontWeight: '600', fontFamily: 'Inter_700Bold' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '47.5%',
    backgroundColor: '#0D0D20',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  metricIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  metricBigVal: { fontSize: 26, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold', lineHeight: 30 },
  metricUnit: { fontSize: 13, color: Colors.textMuted, fontWeight: '400', fontFamily: 'Inter_400Regular' },
  metricLabel: { fontSize: 10, color: Colors.textMuted, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.6 },

  /* Toggles */
  togglesCard: {
    marginHorizontal: 16,
    backgroundColor: '#13132A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 16,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  toggleLabel: { fontSize: 14, color: '#fff', fontFamily: 'Inter_400Regular' },

  /* Coach */
  coachSection: { marginHorizontal: 16, marginBottom: 16 },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 10,
  },
  coachIconWrap: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  coachName: { fontSize: 14, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  coachStatus: { fontSize: 11, color: '#06B6D4', fontFamily: 'Inter_400Regular', marginTop: 3 },
  coachArrow: { padding: 4 },

  /* Menu */
  menuSection: { marginHorizontal: 16, marginBottom: 16 },
  menuCard: {
    backgroundColor: '#13132A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 14, color: '#fff', fontFamily: 'Inter_400Regular' },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuValue: { fontSize: 13, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },

  /* Section Title */
  sectionTitle: { fontSize: 11, color: Colors.textMuted, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },

  /* Divider */
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },

  versionText: { textAlign: 'center', color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 16, letterSpacing: 0.4 },
});
