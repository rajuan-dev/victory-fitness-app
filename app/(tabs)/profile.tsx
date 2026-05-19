import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import { BodyMetrics, clearAuthTokens, fetchCurrentUser, fetchCurrentUserBodyMetrics, updateCurrentUserBodyMetrics } from '../../lib/api';
import { canAccessFeature, canAccessPlanRoute } from '../../lib/access';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

function getRankIcon(rank: string) {
  const normalized = rank.trim().toLowerCase();
  switch (normalized) {
    case 'bronze':
      return '🥉';
    case 'silver':
      return '🥈';
    case 'gold':
      return '🥇';
    case 'platinum':
      return '💠';
    case 'diamond':
      return '💎';
    case 'master':
      return '👑';
    case 'champion':
      return '🏆';
    case 'titan':
      return '🛡️';
    case 'legend':
      return '🌟';
    case 'immortal':
      return '🔥';
    default:
      return '🔰';
  }
}

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
      { icon: 'analytics-outline', label: 'Body Metrics', tint: '#06B6D4', action: 'body_metrics' },
      { icon: 'barbell-outline', label: 'Workout', tint: '#06B6D4', route: '/workoutplan' },
      { icon: 'restaurant-outline', label: 'Nutrition', tint: '#F97316', route: '/mealPlan' },
      { icon: 'body-outline', label: 'Journal', tint: '#EC4899', route: '/journal' },
    ],
  }
];

function getDynamicRankIcon(rank: string) {
  const normalized = rank.trim().toLowerCase();

  switch (normalized) {
    case 'bronze':
      return '\u{1F949}';
    case 'silver':
      return '\u{1F948}';
    case 'gold':
      return '\u{1F947}';
    case 'platinum':
      return '\u{1F4A0}';
    case 'diamond':
      return '\u{1F48E}';
    case 'master':
      return '\u{1F451}';
    case 'champion':
      return '\u{1F3C6}';
    case 'titan':
      return '\u{1F6E1}\uFE0F';
    case 'legend':
      return '\u{1F31F}';
    case 'immortal':
      return '\u{1F525}';
    default:
      return '\u{1F530}';
  }
}

export default function ProfileScreen() {
  useModuleAccessGuard('/profile');
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
    points?: number;
    workouts_completed?: number;
    workouts_total?: number;
    streak_days?: number;
    rank?: string;
    next_rank?: string;
    points_to_next_rank?: number;
    rank_progress_fraction?: number;
  } | null>(null);
  const [loadingMe, setLoadingMe] = React.useState(true);
  const [bodyMetrics, setBodyMetrics] = React.useState<BodyMetrics>({
    age: '',
    height: '',
    weight: '',
    gender: '',
  });
  const [showMetricsModal, setShowMetricsModal] = React.useState(false);
  const [savingMetrics, setSavingMetrics] = React.useState(false);
  const [metricsDraft, setMetricsDraft] = React.useState<BodyMetrics>({
    age: '',
    height: '',
    weight: '',
    gender: '',
  });
  const [showGenderModal, setShowGenderModal] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const bodyMetricsSummary = React.useMemo(() => {
    const parts = [
      bodyMetrics.age ? `${bodyMetrics.age}y` : '',
      bodyMetrics.height ? `${bodyMetrics.height}cm` : '',
      bodyMetrics.weight ? `${bodyMetrics.weight}kg` : '',
      bodyMetrics.gender || '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' • ') : 'Not set';
  }, [bodyMetrics.age, bodyMetrics.gender, bodyMetrics.height, bodyMetrics.weight]);

  const visibleMenuSections = React.useMemo(() => {
    return MENU_SECTIONS.map((section) => ({
      ...section,
      items: section.items
        .filter((item) => {
          if (!('route' in item) || !item.route) {
            return true;
          }
          if (item.route === '/workoutplan') {
            return canAccessFeature('workoutplan', me);
          }
          if (item.route === '/mealPlan') {
            return canAccessPlanRoute('/mealPlan', me);
          }
          if (item.route === '/profile/application') {
            return canAccessFeature('application', me);
          }
          if (item.route === '/profile/longevity-os') {
            return canAccessFeature('longevity', me);
          }
          return true;
        })
        .map((item) => {
          if ((item as any).action === 'body_metrics') {
            return {
              ...item,
              value: bodyMetricsSummary,
            };
          }
          return item;
        }),
    })).filter((section) => section.items.length > 0);
  }, [bodyMetricsSummary, me]);

  const genderOptions = ['Male', 'Female', 'Other'];

  const loadProfileData = React.useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoadingMe(true);
    }
    try {
      const [response, metricsResponse] = await Promise.all([
        fetchCurrentUser(),
        fetchCurrentUserBodyMetrics(),
      ]);
      setMe(response);
      setBodyMetrics(metricsResponse);
    } catch {
      setMe(null);
      setBodyMetrics({ age: '', height: '', weight: '', gender: '' });
    } finally {
      if (showLoading) {
        setLoadingMe(false);
      }
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      void (async () => {
        if (cancelled) {
          return;
        }
        await loadProfileData(true);
      })();

      return () => {
        cancelled = true;
      };
    }, [loadProfileData]),
  );

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProfileData(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfileData]);

  const displayName = me?.name ?? 'Loading...';
  const displayEmail = me?.email ?? 'Fetching /me data';
  const displayVerified = me?.is_verified ? 'Verified' : 'Not verified';
  const points = me?.points ?? 0;
  const workoutsCompleted = me?.workouts_completed ?? 0;
  const workoutsTotal = me?.workouts_total ?? 0;
  const canAccessLongevity = canAccessFeature('longevity', me);
  const canAccessCoachVictor = canAccessFeature('coach_victor', me);
  const streakDays = me?.streak_days ?? 0;
  const rank = me?.rank ?? 'Noob';
  const nextRank = me?.next_rank ?? rank;
  const progressFraction = Math.min(Math.max(me?.rank_progress_fraction ?? 0, 0), 1);
  const pointsToNextRank = Math.max(me?.points_to_next_rank ?? 0, 0);
  const rankIcon = getDynamicRankIcon(rank);
  const profileStats = [
    { label: 'Exercises completed', value: workoutsTotal > 0 ? `${workoutsCompleted}/${workoutsTotal}` : String(workoutsCompleted), icon: '\u{1F3CB}\uFE0F' },
    { label: 'Streak', value: `${streakDays}d`, icon: '\u{1F525}' },
    { label: 'Points', value: String(points), icon: '\u26A1' },
    { label: 'Rank', value: rank.toUpperCase(), icon: rankIcon },
  ];

  const openMetricsModal = () => {
    setMetricsDraft(bodyMetrics);
    setShowMetricsModal(true);
  };

  const handleSaveMetrics = async () => {
    if (savingMetrics) {
      return;
    }

    setSavingMetrics(true);
    try {
      const updated = await updateCurrentUserBodyMetrics({
        age: metricsDraft.age.trim(),
        height: metricsDraft.height.trim(),
        weight: metricsDraft.weight.trim(),
        gender: metricsDraft.gender.trim(),
      });
      setBodyMetrics(updated);
      setShowMetricsModal(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update body metrics right now.';
      Alert.alert('Save failed', message);
    } finally {
      setSavingMetrics(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >

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
              <Text style={styles.rankBadgeText}>{loadingMe ? 'MEMBER' : `${rankIcon} ${rank.toUpperCase()}`}</Text>
            </View>
            <View style={styles.ptsBadge}>
              <Text style={styles.ptsBadgeText}>⚡ {loadingMe ? '...' : points} PTS</Text>
            </View>
          </View>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMetaText}>{loadingMe ? 'Loading profile...' : displayVerified}</Text>
            {me?.is_admin ? <Text style={styles.heroMetaAdmin}>Admin account</Text> : null}
          </View>

          {/* Rank Progress */}
          <View style={styles.rankProgressWrap}>
            <View style={styles.rankProgressLabels}>
              <Text style={styles.rankProgressLabel}>{rank.toUpperCase()}</Text>
              <Text style={styles.rankProgressLabel}>
                {pointsToNextRank > 0 ? `${pointsToNextRank} pts to ${nextRank.toUpperCase()}` : 'MAX RANK'}
              </Text>
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
          {profileStats.map((s) => (
            <View key={s.label} style={styles.statCell}>
              <Text style={styles.statEmoji}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Body Metrics ── */}


        {/* ── Coach Cards ── */}
        <View style={styles.coachSection}>
          <Text style={styles.sectionTitle}>MY COACHES</Text>
          {canAccessCoachVictor ? <View style={[styles.coachCard, { backgroundColor: Colors.surface }]}>
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
          </View> : null}
          {canAccessLongevity ? (
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
          ) : null}
        </View>

        {/* ── Menu Sections ── */}
        {visibleMenuSections.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, i) => (
                <View key={item.label}>
                  <TouchableOpacity
                    style={styles.menuRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      if ((item as any).action === 'body_metrics') {
                        openMetricsModal();
                        return;
                      }
                      if ((item as any).route) {
                        router.push((item as any).route);
                      }
                    }}
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

      <Modal visible={showMetricsModal} transparent animationType="fade" onRequestClose={() => setShowMetricsModal(false)}>
        <View style={styles.metricsModalOverlay}>
          <View style={styles.metricsModalCard}>
            {savingMetrics ? (
              <View style={styles.metricsSavingOverlay}>
                <View style={styles.metricsSavingCard}>
                  <ActivityIndicator color={Colors.accentBlue} size="large" />
                  <Text style={styles.metricsSavingText}>Saving metrics...</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.metricsModalHeader}>
              <Text style={styles.metricsModalTitle}>UPDATE BODY METRICS</Text>
              <TouchableOpacity onPress={() => setShowMetricsModal(false)} disabled={savingMetrics}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            <View style={styles.metricsFormGrid}>
              <View style={styles.metricsInputGroup}>
                <Text style={styles.metricsInputLabel}>AGE</Text>
                <View style={styles.metricsInputWrap}>
                  <TextInput
                    style={styles.metricsInput}
                    value={metricsDraft.age}
                    onChangeText={(value) => setMetricsDraft((prev) => ({ ...prev, age: value }))}
                    keyboardType="numeric"
                    editable={!savingMetrics}
                  />
                  <Text style={styles.metricsInputUnit}>yrs</Text>
                </View>
              </View>

              <View style={styles.metricsInputGroup}>
                <Text style={styles.metricsInputLabel}>GENDER</Text>
                <TouchableOpacity
                  style={styles.metricsInputWrap}
                  activeOpacity={0.8}
                  onPress={() => setShowGenderModal(true)}
                  disabled={savingMetrics}
                >
                  <Text style={styles.metricsInput}>{metricsDraft.gender || 'Select'}</Text>
                  <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>
              </View>

              <View style={styles.metricsInputGroup}>
                <Text style={styles.metricsInputLabel}>HEIGHT</Text>
                <View style={styles.metricsInputWrap}>
                  <TextInput
                    style={styles.metricsInput}
                    value={metricsDraft.height}
                    onChangeText={(value) => setMetricsDraft((prev) => ({ ...prev, height: value }))}
                    keyboardType="numeric"
                    editable={!savingMetrics}
                  />
                  <Text style={styles.metricsInputUnit}>cm</Text>
                </View>
              </View>

              <View style={styles.metricsInputGroup}>
                <Text style={styles.metricsInputLabel}>WEIGHT</Text>
                <View style={styles.metricsInputWrap}>
                  <TextInput
                    style={styles.metricsInput}
                    value={metricsDraft.weight}
                    onChangeText={(value) => setMetricsDraft((prev) => ({ ...prev, weight: value }))}
                    keyboardType="numeric"
                    editable={!savingMetrics}
                  />
                  <Text style={styles.metricsInputUnit}>kg</Text>
                </View>
              </View>
            </View>

            <View style={styles.metricsActionRow}>
              <TouchableOpacity
                style={styles.metricsCancelBtn}
                activeOpacity={0.85}
                onPress={() => setShowMetricsModal(false)}
                disabled={savingMetrics}
              >
                <Text style={styles.metricsCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.metricsSaveBtn} activeOpacity={0.85} onPress={handleSaveMetrics} disabled={savingMetrics}>
                {savingMetrics ? <ActivityIndicator size="small" color="#04111F" /> : <Text style={styles.metricsSaveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showGenderModal} transparent animationType="fade" onRequestClose={() => setShowGenderModal(false)}>
        <TouchableOpacity style={styles.metricsModalOverlay} activeOpacity={1} onPress={() => setShowGenderModal(false)}>
          <View style={styles.genderModalCard}>
            <Text style={styles.genderModalTitle}>SELECT GENDER</Text>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.genderModalOption}
                onPress={() => {
                  setMetricsDraft((prev) => ({ ...prev, gender: option }));
                  setShowGenderModal(false);
                }}
              >
                <Text style={[styles.genderModalOptionText, metricsDraft.gender === option && styles.genderModalOptionTextActive]}>
                  {option.toUpperCase()}
                </Text>
                {metricsDraft.gender === option ? (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.accentBlue} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
  metricsEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(6,182,212,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.25)',
    marginTop: 16,
  },
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
  metricsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3,6,20,0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  metricsModalCard: {
    backgroundColor: '#151629',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  metricsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  metricsModalTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  metricsFormGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  metricsInputGroup: {
    width: '48%',
    marginBottom: 16,
  },
  metricsInputLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  metricsInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D20',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  metricsInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    outlineStyle: 'none' as any,
  },
  metricsInputUnit: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  metricsActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricsCancelBtn: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricsCancelBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  metricsSaveBtn: {
    flex: 1,
    backgroundColor: Colors.accentBlue,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  metricsSaveBtnText: {
    color: '#04111F',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
  },
  metricsSavingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7,10,24,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  metricsSavingCard: {
    backgroundColor: '#0E1325',
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  metricsSavingText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  genderModalCard: {
    backgroundColor: '#151629',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  genderModalTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 18,
  },
  genderModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  genderModalOptionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  genderModalOptionTextActive: {
    color: Colors.accentBlue,
  },

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
