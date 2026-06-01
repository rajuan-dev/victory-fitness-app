import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { apiRequest } from '../../lib/api';

const { width } = Dimensions.get('window');

type ActiveChallenge = {
  id: string;
  challenge_id: string;
  title: string;
  description: string;
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
  category: string;
  description: string;
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
  category,
  description,
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
  return (
    <View style={styles.challengeLibraryCard}>
      {thumbnail ? <Image source={{ uri: thumbnail }} style={styles.challengeLibraryImage} /> : null}
      <View style={styles.challengeLibraryCardHeader}>
        <View style={styles.challengeLibraryTitleWrap}>
          <Text style={styles.challengeLibraryTitle}>{title}</Text>
          <Text style={styles.challengeLibraryCategory}>{category}</Text>
        </View>
        <View style={styles.challengeLibraryPointsBadge}>
          <Text style={styles.challengeLibraryPointsText}>+{points} Points</Text>
        </View>
      </View>

      <Text style={styles.challengeLibraryDescription} numberOfLines={3}>{description}</Text>

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
            <Text style={styles.challengeLibraryMetaText}>{participants} joined</Text>
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
            <Text style={styles.challengeInviteBtnText}>{state === 'ACTIVE' ? 'Chat' : 'Invite'}</Text>
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
                  {state === 'ACTIVE' ? 'In Progress' : state === 'READY' ? 'Join' : 'Coming Soon'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ChallengeSkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
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
  const [cards, setCards] = React.useState<HomeChallengeCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [joiningId, setJoiningId] = React.useState('');
  const hasMountedRef = React.useRef(false);

  const loadChallenges = React.useCallback(async (showLoader = true) => {

    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await apiRequest<ChallengeOverview>('/challenges/overview');
      const activeChallenges = Array.isArray(response.active_challenges) ? response.active_challenges : [];
      const readyChallenges = Array.isArray(response.ready_to_start) ? response.ready_to_start : [];

      const activeCards: HomeChallengeCard[] = activeChallenges.slice(0, 4).map((challenge) => ({
        id: challenge.id,
        challengeId: challenge.challenge_id,
        title: challenge.title,
        category: challenge.type,
        description: challenge.description || challenge.plan_text || `${challenge.days_left} days left in this challenge.`,
        points: challenge.points,
        participants: challenge.participants,
        thumbnail: challenge.thumbnail,
        state: 'ACTIVE',
        progress: challenge.progress,
        daysLeftLabel: `${challenge.days_left} days left`,
        isJoining: false,
        onPrimaryPress: () => router.push(`/challenges/progress/${challenge.challenge_id}` as any),
        onSecondaryPress: () => router.push(`/challenges/chat/${challenge.challenge_id}` as any),
      }));

      const readyCards: HomeChallengeCard[] = readyChallenges.slice(0, 4).map((challenge) => ({
        id: challenge.id,
        challengeId: challenge.id,
        title: challenge.title,
        category: challenge.type,
        description: challenge.description || `${challenge.duration_days} day challenge ready to start.`,
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
            await loadChallenges(false);
          } catch (error) {
            Alert.alert('Join failed', error instanceof Error ? error.message : 'Failed to join challenge');
          } finally {
            setJoiningId('');
          }
        },
        onSecondaryPress: () =>
          router.push({
            pathname: '/challenge',
            params: {
              tab: 'COMMUNITY',
              prefillSource: 'challenge_invite',
              prefillChallengeId: challenge.id,
              prefillStatus: `Join me in ${challenge.title}. ${challenge.description}`,
            },
          } as any),
      }));

      setCards(activeCards.length > 0 ? activeCards : readyCards);
    } catch {
      setCards([]);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [joiningId, router]);

  useFocusEffect(
    React.useCallback(() => {
      void loadChallenges(true);
    }, [loadChallenges]),
  );

  React.useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    void loadChallenges(false);
  }, [loadChallenges, refreshToken]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>CHALLENGES</Text>
        <TouchableOpacity style={styles.headerInviteBtn} onPress={() => router.push('/challenge')}>
          <Text style={styles.headerInviteBtnText}>View All</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.challengeLibraryLead}>Grow through out of the Comfort zone</Text>

      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.challengesScroll}>
          <ChallengeSkeletonCard />
          <ChallengeSkeletonCard />
        </ScrollView>
      ) : cards.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No challenges available</Text>
          <Text style={styles.emptyText}>Active or ready challenges will appear here based on your current plan.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.challengesScroll}
          snapToInterval={width - 56}
          decelerationRate="fast"
          snapToAlignment="start"
        >
          {cards.map((card) => (
            <View key={card.id} style={styles.cardWrap}>
              <ChallengeCard {...card} />
            </View>
          ))}
        </ScrollView>
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
    fontSize: 16,
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
  challengeLibraryLead: {
    color: '#D5DEF0',
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter_700Bold',
    marginBottom: 14,
  },
  challengesScroll: { paddingRight: 20, marginBottom: 8 },
  cardWrap: {
    width: width - 56,
    marginRight: 16,
  },
  challengeLibraryCard: {
    backgroundColor: '#343B4D',
    borderRadius: 18,
    padding: 14,
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
    gap: 12,
    marginBottom: 10,
  },
  challengeLibraryTitleWrap: {
    flex: 1,
  },
  challengeLibraryTitle: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 23,
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryCategory: {
    marginTop: 4,
    color: '#F5A43C',
    fontSize: 12,
    textTransform: 'uppercase',
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
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  emptyText: {
    color: '#A8B4CC',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    fontFamily: 'Inter_400Regular',
  },
  skeletonCard: {
    backgroundColor: '#343B4D',
    borderRadius: 18,
    padding: 14,
    width: width - 56,
    marginRight: 16,
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
