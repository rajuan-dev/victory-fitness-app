import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
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
  type: string;
  plan_text: string;
  days_left: number;
  total_days: number;
  progress: number;
  points: number;
  color: string;
};

type ChallengeOverview = {
  active_challenges: ActiveChallenge[];
  ready_to_start: {
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
  }[];
};

type HomeChallengeCard = {
  id: string;
  title: string;
  points: number;
  description: string;
  participants: number;
  status: string;
  footerLabel: string;
  progress: number;
  route: string;
  params?: Record<string, string>;
  accentColor: string;
};

function ChallengeCard({
  title,
  points,
  description,
  participants,
  status,
  footerLabel,
  progress,
  accentColor,
  onPress,
}: HomeChallengeCard & { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.challengeCard} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.challengeCardHeader}>
        <Text style={styles.challengeCardTitle}>{title}</Text>
        <View style={[styles.pointsBadge, { backgroundColor: accentColor || Colors.accentPurple }]}>
          <Text style={styles.pointsText}>+{points} Pts.</Text>
        </View>
      </View>

      <View style={styles.activeStatusRow}>
        <View style={[styles.activeDot, { backgroundColor: accentColor || Colors.accentBlue }]} />
        <Text style={[styles.activeText, { color: accentColor || Colors.accentBlue }]}>{status}</Text>
      </View>

      <Text style={styles.challengeDescription} numberOfLines={3}>{description}</Text>

      <View style={styles.progressRow}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.max(Math.min(progress * 100, 100), 0)}%` as any,
                backgroundColor: accentColor || Colors.accentBlue,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{footerLabel}</Text>
      </View>

      <View style={styles.challengeDivider} />

      <View style={styles.challengeFooter}>
        <View style={styles.footerInfo}>
          <View style={styles.participantInfo}>
            <Ionicons name="people-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.footerText}>{participants}</Text>
          </View>
          <View style={styles.chatAction}>
            <Ionicons name="flash-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.footerText}>{footerLabel}</Text>
          </View>
        </View>
        <View style={styles.cardInviteBtn}>
          <Text style={styles.cardInviteBtnText}>Open</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ChallengeSkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonHeaderRow}>
        <View style={styles.skeletonTitleBlock} />
        <View style={styles.skeletonBadgeBlock} />
      </View>
      <View style={styles.skeletonStatusRow}>
        <View style={styles.skeletonStatusDot} />
        <View style={styles.skeletonStatusText} />
      </View>
      <View style={styles.skeletonLineLg} />
      <View style={styles.skeletonLineMd} />
      <View style={styles.skeletonLineSm} />
      <View style={styles.challengeDivider} />
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
        title: challenge.title,
        points: challenge.points,
        description: challenge.plan_text || `${challenge.days_left} days left in this challenge.`,
        participants: 1,
        status: 'ACTIVE',
        footerLabel: `${Math.max(Math.round(challenge.progress * 100), 0)}% done`,
        progress: challenge.progress,
        route: '/challenges/progress/[challengeId]',
        params: { challengeId: challenge.challenge_id },
        accentColor: challenge.color || Colors.accentBlue,
      }));
      const readyCards: HomeChallengeCard[] = readyChallenges.slice(0, 4).map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        points: challenge.points,
        description: challenge.description || `${challenge.duration_days} day challenge ready to start.`,
        participants: challenge.participants,
        status: challenge.status === 'UPCOMING' ? 'COMING SOON' : challenge.can_start ? 'READY TO START' : 'LIMIT REACHED',
        footerLabel: challenge.status === 'UPCOMING' ? 'Coming soon' : `${challenge.duration_days} days`,
        progress: 0,
        route: '/challenge',
        accentColor: challenge.difficulty_color || Colors.accentBlue,
      }));
      setCards(activeCards.length > 0 ? activeCards : readyCards);
    } catch {
      setCards([]);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

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

      {loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.challengesScroll}
        >
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
          snapToInterval={width - 48}
          decelerationRate="fast"
          snapToAlignment="start"
        >
          {cards.map((card) => (
            <ChallengeCard
              key={card.id}
              {...card}
              onPress={() => {
                if (
                  (card.route === '/challenges/chat/[challengeId]' || card.route === '/challenges/progress/[challengeId]') &&
                  card.params?.challengeId
                ) {
                  router.push({ pathname: card.route as '/challenges/progress/[challengeId]', params: card.params });
                  return;
                }
                router.push('/challenge');
              }}
            />
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
    marginBottom: 16,
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
  challengesScroll: { paddingRight: 20, marginBottom: 8 },
  challengeCard: {
    backgroundColor: '#1E1E2E',
    borderRadius: 24,
    padding: 24,
    width: width - 64,
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  challengeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  challengeCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  pointsBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 8,
  },
  pointsText: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  activeStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  challengeDescription: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: 'Inter_400Regular',
  },
  progressRow: {
    gap: 8,
    marginBottom: 16,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  challengeDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  challengeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerInfo: { flexDirection: 'row', alignItems: 'center' },
  participantInfo: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  chatAction: { flexDirection: 'row', alignItems: 'center' },
  footerText: { color: Colors.textMuted, fontSize: 13, marginLeft: 4 },
  cardInviteBtn: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cardInviteBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  headerInviteBtn: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerInviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  loadingCard: {
    backgroundColor: '#1E1E2E',
    borderRadius: 24,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  skeletonCard: {
    backgroundColor: '#1E1E2E',
    borderRadius: 24,
    padding: 24,
    width: width - 64,
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  skeletonTitleBlock: {
    width: '58%',
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonBadgeBlock: {
    width: 74,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  skeletonStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  skeletonStatusText: {
    width: 68,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonLineLg: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  skeletonLineMd: {
    width: '88%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  skeletonLineSm: {
    width: '70%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  skeletonFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonFooterText: {
    width: 90,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonOpenBlock: {
    width: 64,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  emptyCard: {
    backgroundColor: '#1E1E2E',
    borderRadius: 24,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
});
