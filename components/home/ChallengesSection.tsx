import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { apiRequest } from '../../lib/api';
import { fetchChallengeOverviewData, CHALLENGE_OVERVIEW_CACHE_KEY } from '../../lib/screenData';
import { getCachedResourceSnapshot } from '../../lib/resourceCache';
import { useLanguage } from '../../lib/i18n';
import { pushRoute } from '../../lib/navigation';

type ActiveChallenge = {
  id: string;
  challenge_id: string;
  title: string;
  description: string;
  why_it_matters: string;
  type: string;
  duration_days: number;
  plan_text: string;
  days_left: number;
  total_days: number;
  progress: number;
  points: number;
  participants: number;
  thumbnail: string;
  color: string;
};

type ReadyChallenge = {
  id: string;
  title: string;
  description: string;
  why_it_matters: string;
  duration_days: number;
  type: string;
  points: number;
  participants: number;
  difficulty: string;
  difficulty_color: string;
  status: string;
  can_start: boolean;
  thumbnail: string;
};

type ChallengeOverview = {
  active_challenges: ActiveChallenge[];
  ready_to_start: ReadyChallenge[];
};

type HomeChallengeCard = {
  id: string;
  challengeId: string;
  title: string;
  goalType: string;
  whatToDo: string;
  whyItMatters: string;
  points: number;
  participants: number;
  thumbnail: string;
  state: 'ACTIVE' | 'READY' | 'UPCOMING';
  progress: number;
  daysLeftLabel: string;
  isJoining: boolean;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
};

function ChallengeCard({
  title,
  goalType,
  whatToDo,
  whyItMatters,
  points,
  participants,
  thumbnail,
  state,
  progress,
  daysLeftLabel,
  isJoining,
  onPrimaryPress,
  onSecondaryPress,
}: HomeChallengeCard) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = React.useState(false);
  return (
    <View style={styles.challengeLibraryCard}>
      {thumbnail ? <Image source={{ uri: thumbnail }} style={styles.challengeLibraryImage} resizeMode="contain" /> : null}
      <View style={styles.challengeLibraryCardHeader}>
        <View style={styles.challengeLibraryTitleWrap}>
          <Text style={styles.challengeLibraryTitle}>{title}</Text>
        </View>
        <View style={styles.challengeLibraryPointsBadge}>
          <Text style={styles.challengeLibraryPointsText}>+{points} {t('Points')}</Text>
        </View>
      </View>

      <Text style={styles.challengeLibraryFieldLabel}>Goal Type</Text>
      <Text style={styles.challengeLibraryCategory}>{goalType}</Text>

      <Text style={styles.challengeLibraryFieldLabel}>What To Do</Text>
      <Text style={styles.challengeLibraryDescription} numberOfLines={expanded ? undefined : 3}>{whatToDo}</Text>

      {whyItMatters ? (
        <>
          <TouchableOpacity style={styles.challengeExpandBtn} activeOpacity={0.84} onPress={() => setExpanded((current) => !current)}>
            <Text style={styles.challengeExpandBtnText}>{expanded ? 'Hide Why It Matters' : 'Why It Matters'}</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#BFDBFE" />
          </TouchableOpacity>
          {expanded ? <Text style={styles.challengeWhyText}>{whyItMatters}</Text> : null}
        </>
      ) : null}

      {state === 'ACTIVE' ? (
        <View style={styles.challengeLibraryProgressRow}>
          <View style={styles.challengeLibraryProgressTrack}>
            <View
              style={[
                styles.challengeLibraryProgressFill,
                { width: `${Math.max(0, Math.min(100, Math.round(progress * 100)))}%` as any },
              ]}
            />
          </View>
          <Text style={styles.challengeLibraryProgressText}>{Math.round(progress * 100)}%</Text>
        </View>
      ) : null}

      <View style={styles.challengeLibraryFooter}>
        <View style={styles.challengeLibraryMetaRow}>
          <View style={styles.challengeLibraryMetaItem}>
            <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.58)" />
            <Text style={styles.challengeLibraryMetaText}>{participants} {t('joined')}</Text>
          </View>
          <View style={styles.challengeLibraryMetaItem}>
            <Ionicons
              name={state === 'ACTIVE' ? 'chatbubble-outline' : state === 'READY' ? 'time-outline' : 'lock-closed-outline'}
              size={14}
              color="rgba(255,255,255,0.58)"
            />
            <Text style={styles.challengeLibraryMetaText}>{daysLeftLabel}</Text>
          </View>
        </View>
        <View style={styles.challengeLibraryActionRow}>
          <TouchableOpacity
            style={styles.challengeInviteBtn}
            activeOpacity={0.88}
            onPress={onSecondaryPress}
          >
            <Ionicons name={state === 'ACTIVE' ? 'chatbubble-outline' : 'person-add-outline'} size={15} color="#D9EEFF" />
            <Text style={styles.challengeInviteBtnText}>{state === 'ACTIVE' ? t('Chat') : t('Invite')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.challengeStatusBtn,
              state === 'ACTIVE' || state === 'READY' ? styles.challengeStatusBtnActive : styles.challengeStatusBtnLocked,
              isJoining && styles.challengeStatusBtnPending,
            ]}
            activeOpacity={0.88}
            onPress={onPrimaryPress}
            disabled={isJoining || state === 'UPCOMING'}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#052E16" />
            ) : (
              <>
                <Ionicons
                  name={state === 'UPCOMING' ? 'lock-closed-outline' : 'checkmark'}
                  size={15}
                  color={state === 'UPCOMING' ? '#E9D5FF' : '#052E16'}
                />
                <Text style={[styles.challengeStatusBtnText, state === 'UPCOMING' && styles.challengeStatusBtnTextLocked]}>
                  {state === 'ACTIVE' ? t('In Progress') : state === 'READY' ? t('Join') : t('Coming Soon')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ChallengeSkeletonCard({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={[styles.skeletonCard, { width: cardWidth }]}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonHeaderRow}>
        <View style={styles.skeletonTitleBlock} />
        <View style={styles.skeletonBadgeBlock} />
      </View>
      <View style={styles.skeletonStatusText} />
      <View style={styles.skeletonLineLg} />
      <View style={styles.skeletonLineMd} />
      <View style={styles.skeletonFooterRow}>
        <View style={styles.skeletonFooterText} />
        <View style={styles.skeletonOpenBlock} />
      </View>
    </View>
  );
}

export default function ChallengesSection({ refreshToken = 0 }: { refreshToken?: number }) {
  const router = useRouter();
  const routerRef = React.useRef(router);
  const { t } = useLanguage();
  const tRef = React.useRef(t);
  const { width: windowWidth } = useWindowDimensions();
  const initialCachedOverview = React.useRef(getCachedResourceSnapshot<ChallengeOverview>(CHALLENGE_OVERVIEW_CACHE_KEY));
  const cachedOverview = initialCachedOverview.current;
  const hasCachedCards = Boolean(
    cachedOverview &&
      ((Array.isArray(cachedOverview.active_challenges) && cachedOverview.active_challenges.length > 0) ||
        (Array.isArray(cachedOverview.ready_to_start) && cachedOverview.ready_to_start.length > 0)),
  );
  const [cards, setCards] = React.useState<HomeChallengeCard[]>([]);
  const [loading, setLoading] = React.useState(!cachedOverview);
  const [loadError, setLoadError] = React.useState('');
  const [joiningId, setJoiningId] = React.useState('');
  const [sectionWidth, setSectionWidth] = React.useState(0);
  const hasMountedRef = React.useRef(false);
  const joiningIdRef = React.useRef('');
  const cardWidth = Math.max(sectionWidth || windowWidth - 32, 0);

  React.useEffect(() => {
    tRef.current = t;
  }, [t]);

  React.useEffect(() => {
    routerRef.current = router;
  }, [router]);

  React.useEffect(() => {
    joiningIdRef.current = joiningId;
  }, [joiningId]);

  const hasCardsRef = React.useRef(hasCachedCards);
  const loadChallenges = React.useCallback(async (showLoader = true, forceRefresh = false) => {

    if (showLoader && !cachedOverview) {
      setLoading(true);
    }

    try {
      setLoadError('');
      const response = await fetchChallengeOverviewData({ forceRefresh }) as ChallengeOverview;
      const activeChallenges = Array.isArray(response.active_challenges) ? response.active_challenges : [];
      const readyChallenges = Array.isArray(response.ready_to_start) ? response.ready_to_start : [];

      const activeCards: HomeChallengeCard[] = activeChallenges.map((challenge) => ({
        id: challenge.id,
        challengeId: challenge.challenge_id,
        title: challenge.title,
        goalType: challenge.type,
        whatToDo: challenge.description || challenge.plan_text || `${challenge.days_left} days left in this challenge.`,
        whyItMatters: challenge.why_it_matters || '',
        points: challenge.points,
        participants: challenge.participants,
        thumbnail: challenge.thumbnail,
        state: 'ACTIVE',
        progress: challenge.progress,
        daysLeftLabel: `${challenge.days_left} days left`,
        isJoining: false,
        onPrimaryPress: () => pushRoute(routerRef.current, `/challenges/${challenge.challenge_id}` as any),
        onSecondaryPress: () => pushRoute(routerRef.current, `/challenges/chat/${challenge.challenge_id}` as any),
      }));

      const readyCards: HomeChallengeCard[] = readyChallenges.map((challenge) => ({
        id: challenge.id,
        challengeId: challenge.id,
        title: challenge.title,
        goalType: challenge.type,
        whatToDo: challenge.description || `${challenge.duration_days} day challenge ready to start.`,
        whyItMatters: challenge.why_it_matters || '',
        points: challenge.points,
        participants: challenge.participants,
        thumbnail: challenge.thumbnail,
        state: challenge.can_start ? 'READY' : 'UPCOMING',
        progress: 0,
        daysLeftLabel: challenge.can_start ? 'Ready' : 'Locked',
        isJoining: joiningIdRef.current === challenge.id,
        onPrimaryPress: async () => {
          if (!challenge.can_start || joiningIdRef.current === challenge.id) {
            return;
          }
          setJoiningId(challenge.id);
          try {
            await apiRequest(`/challenges/${encodeURIComponent(challenge.id)}/start`, {
              method: 'POST',
            });
            await loadChallenges(false, true);
          } catch (error) {
            Alert.alert('Join failed', error instanceof Error ? error.message : 'Failed to join challenge');
          } finally {
            setJoiningId('');
          }
        },
        onSecondaryPress: () =>
          pushRoute(routerRef.current, {
            pathname: '/challenge',
            params: {
              tab: 'COMMUNITY',
              prefillSource: 'challenge_invite',
              prefillChallengeId: challenge.id,
              prefillStatus: `Join me in ${challenge.title}. ${challenge.description}`,
            },
          } as any),
      }));

      setCards([...activeCards, ...readyCards]);
    } catch (error) {
      if (cards.length > 0 || hasCachedCards) {
        setLoadError('');
        return;
      }
      const message = error instanceof Error ? error.message : '';
      const normalizedMessage = message.toLowerCase();
      if (hasCardsRef.current) {
        setLoadError('');
        return;
      }
      setLoadError(
        normalizedMessage.includes('timed out') || normalizedMessage.includes('timeout')
          ? tRef.current('Challenge request timed out. Please try again.')
          : tRef.current('Unable to load challenges right now.'),
      );
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [cachedOverview]);

  React.useEffect(() => {
    hasCardsRef.current = cards.length > 0 || hasCachedCards;
  }, [cards.length, hasCachedCards]);

  React.useEffect(() => {
    if (!cachedOverview) {
      return;
    }

    const activeChallenges = Array.isArray(cachedOverview.active_challenges) ? cachedOverview.active_challenges : [];
    const readyChallenges = Array.isArray(cachedOverview.ready_to_start) ? cachedOverview.ready_to_start : [];

    const activeCards: HomeChallengeCard[] = activeChallenges.map((challenge) => ({
      id: challenge.id,
      challengeId: challenge.challenge_id,
        title: challenge.title,
        goalType: challenge.type,
        whatToDo: challenge.description || challenge.plan_text || `${challenge.days_left} days left in this challenge.`,
        whyItMatters: challenge.why_it_matters || '',
        points: challenge.points,
      participants: challenge.participants,
      thumbnail: challenge.thumbnail,
      state: 'ACTIVE',
      progress: challenge.progress,
      daysLeftLabel: `${challenge.days_left} days left`,
      isJoining: false,
      onPrimaryPress: () => pushRoute(routerRef.current, `/challenges/${challenge.challenge_id}` as any),
      onSecondaryPress: () => pushRoute(routerRef.current, `/challenges/chat/${challenge.challenge_id}` as any),
    }));

    const readyCards: HomeChallengeCard[] = readyChallenges.map((challenge) => ({
      id: challenge.id,
      challengeId: challenge.id,
      title: challenge.title,
      goalType: challenge.type,
      whatToDo: challenge.description || `${challenge.duration_days} day challenge ready to start.`,
      whyItMatters: challenge.why_it_matters || '',
      points: challenge.points,
      participants: challenge.participants,
      thumbnail: challenge.thumbnail,
      state: challenge.can_start ? 'READY' : 'UPCOMING',
      progress: 0,
      daysLeftLabel: challenge.can_start ? 'Ready' : 'Locked',
      isJoining: joiningId === challenge.id,
      onPrimaryPress: async () => {
        if (!challenge.can_start || joiningId === challenge.id) {
          return;
        }
        setJoiningId(challenge.id);
        try {
          await apiRequest(`/challenges/${encodeURIComponent(challenge.id)}/start`, {
            method: 'POST',
          });
          await loadChallenges(false, true);
        } catch (error) {
          Alert.alert('Join failed', error instanceof Error ? error.message : 'Failed to join challenge');
        } finally {
          setJoiningId('');
        }
      },
      onSecondaryPress: () =>
        pushRoute(routerRef.current, {
          pathname: '/challenge',
          params: {
            tab: 'COMMUNITY',
            prefillSource: 'challenge_invite',
            prefillChallengeId: challenge.id,
            prefillStatus: `Join me in ${challenge.title}. ${challenge.description}`,
          },
        } as any),
    }));

    setCards([...activeCards, ...readyCards]);
  }, [cachedOverview, joiningId, loadChallenges]);

  React.useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      void loadChallenges(true);
      return;
    }
    void loadChallenges(false);
  }, [loadChallenges, refreshToken]);

  return (
    <View
      style={styles.section}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        setSectionWidth((current) => (current === nextWidth ? current : nextWidth));
      }}
    >
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('CHALLENGES')}</Text>
        <TouchableOpacity style={styles.headerInviteBtn} onPress={() => router.push('/challenge')}>
          <Text style={styles.headerInviteBtnText}>{t('View All')}</Text>
        </TouchableOpacity>
      </View>

      {loadError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
          <Text style={styles.errorBannerText}>{loadError}</Text>
        </View>
      ) : null}

      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.challengesScroll}>
          <ChallengeSkeletonCard cardWidth={cardWidth} />
          <ChallengeSkeletonCard cardWidth={cardWidth} />
        </ScrollView>
      ) : cards.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t('No challenges available')}</Text>
          <Text style={styles.emptyText}>{t('Active or ready challenges will appear here based on your current plan.')}</Text>
        </View>
      ) : (
        <>
          {cards.some((card) => card.state === 'ACTIVE') ? (
            <TouchableOpacity
              style={styles.urgencyBanner}
              activeOpacity={0.86}
              onPress={() => {
                const activeCard = cards.find((card) => card.state === 'ACTIVE');
                if (activeCard) {
                  activeCard.onPrimaryPress();
                }
              }}
            >
              <View style={styles.urgencyIconWrap}>
                <Ionicons name="flame" size={20} color="#FBBF24" />
              </View>
              <View style={styles.urgencyCopy}>
                <Text style={styles.urgencyTitle}>Finish today&apos;s challenge</Text>
                <Text style={styles.urgencyText}>Complete it today or miss today&apos;s points.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FBBF24" />
            </TouchableOpacity>
          ) : null}
          <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.challengesScroll}
          bounces
          alwaysBounceHorizontal
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          snapToAlignment="start"
          >
            {cards.map((card) => (
              <View key={card.id} style={[styles.cardWrap, { width: cardWidth }]}>
                <ChallengeCard {...card} />
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accentBlue,
    letterSpacing: 1.5,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  headerInviteBtn: {
    backgroundColor: 'rgba(47,124,248,0.14)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerInviteBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(127,29,29,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorBannerText: {
    flex: 1,
    color: '#FECACA',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
  },
  challengeLibraryLead: {
    color: '#D5DEF0',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 14,
  },
  challengesScroll: {
    paddingVertical: 4,
    marginBottom: 8,
  },
  urgencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.38)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 4,
  },
  urgencyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.16)',
    marginRight: 10,
  },
  urgencyCopy: { flex: 1 },
  urgencyTitle: { color: '#FDE68A', fontSize: 13, fontFamily: 'Inter_700Bold' },
  urgencyText: { color: '#FCD34D', fontSize: 11, marginTop: 3, fontFamily: 'Inter_400Regular' },
  cardWrap: {
    paddingRight: 12,
    paddingVertical: 8,
  },
  challengeLibraryCard: {
    backgroundColor: '#343B4D',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  challengeLibraryImage: {
    width: '100%',
    height: 164,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#1F2937',
  },
  challengeLibraryCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 3,
  },
  challengeLibraryTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  challengeLibraryTitle: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryCategory: {
    marginTop: 2,
    color: '#F5A43C',
    fontSize: 9,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryFieldLabel: {
    marginTop: 10,
    marginBottom: 3,
    color: 'rgba(191,219,254,0.78)',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryPointsBadge: {
    backgroundColor: '#FFC233',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  challengeLibraryPointsText: {
    color: '#4C2A00',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryDescription: {
    marginTop: 0,
    color: '#E5E7EB',
    fontSize: 10,
    lineHeight: 13,
    fontFamily: 'Inter_400Regular',
  },
  challengeExpandBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  challengeExpandBtnText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  challengeWhyText: {
    marginTop: 8,
    color: '#CBD5E1',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Inter_400Regular',
  },
  challengeLibraryProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  challengeLibraryProgressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  challengeLibraryProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  challengeLibraryProgressText: {
    color: '#D5DEF0',
    fontSize: 12,
    minWidth: 42,
    textAlign: 'right',
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 18,
  },
  challengeLibraryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    flex: 1,
  },
  challengeLibraryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  challengeLibraryMetaText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  challengeLibraryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2F7CF8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  challengeInviteBtnText: {
    color: '#EAF4FF',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  challengeStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  challengeStatusBtnPending: {
    opacity: 0.78,
  },
  challengeStatusBtnActive: {
    backgroundColor: '#22C55E',
  },
  challengeStatusBtnLocked: {
    backgroundColor: '#2E2348',
  },
  challengeStatusBtnText: {
    color: '#052E16',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  challengeStatusBtnTextLocked: {
    color: '#E9D5FF',
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 18,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  emptyText: {
    color: '#A8B4CC',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontFamily: 'Inter_400Regular',
  },
  skeletonCard: {
    backgroundColor: '#343B4D',
    borderRadius: 18,
    padding: 16,
    marginRight: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  skeletonImage: {
    height: 164,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  skeletonTitleBlock: {
    width: '55%',
    height: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonBadgeBlock: {
    width: 86,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonStatusText: {
    width: '28%',
    height: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  skeletonLineLg: {
    width: '100%',
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  skeletonLineMd: {
    width: '88%',
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  skeletonFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  skeletonFooterText: {
    width: '38%',
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonOpenBlock: {
    width: 110,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
