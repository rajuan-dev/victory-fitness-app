import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
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
};

type HomeChallengeCard = {
  id: string;
  title: string;
  points: number;
  description: string;
  participants: number;
  status: string;
  footerLabel: string;
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

export default function ChallengesSection() {
  const router = useRouter();
  const [cards, setCards] = React.useState<HomeChallengeCard[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadChallenges = React.useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await apiRequest<ChallengeOverview>('/challenges/overview');
      const activeChallenges = Array.isArray(response.active_challenges) ? response.active_challenges : [];
      const activeCards: HomeChallengeCard[] = activeChallenges.slice(0, 4).map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        points: challenge.points,
        description: challenge.plan_text || `${challenge.days_left} days left in this challenge.`,
        participants: 1,
        status: 'ACTIVE',
        footerLabel: `${Math.max(Math.round(challenge.progress * 100), 0)}% done`,
        route: '/challenges/chat/[challengeId]',
        params: { challengeId: challenge.challenge_id },
        accentColor: challenge.color || Colors.accentBlue,
      }));
      setCards(activeCards);
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

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>CHALLENGES</Text>
        <TouchableOpacity style={styles.headerInviteBtn} onPress={() => router.push('/challenge')}>
          <Text style={styles.headerInviteBtnText}>View All</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading challenges...</Text>
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No active challenges</Text>
          <Text style={styles.emptyText}>Active challenges will appear here when you join or start them.</Text>
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
                if (card.route === '/challenges/chat/[challengeId]' && card.params?.challengeId) {
                  router.push({ pathname: card.route as '/challenges/chat/[challengeId]', params: card.params });
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
