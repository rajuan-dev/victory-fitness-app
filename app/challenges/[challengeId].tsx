import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { apiRequest } from '../../lib/api';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { formatAppError } from '../../lib/error';

type ChallengePlanDayProgress = {
  day_number: number;
  completed: boolean;
  completed_section_ids: string[];
  completed_exercise_ids: string[];
};

type ChallengePlanDay = {
  day_number: number;
};

type ChallengeReaction = {
  emoji: string;
  count: number;
  viewer_reacted: boolean;
};

type ChallengeChatMessage = {
  id: string;
  challenge_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  author_profile_image: string;
  message_type: string;
  content: string;
  image_url: string;
  reply_to_message_id: string | null;
  progress_payload: { completed_day?: number; total_days?: number; membership_status?: string } | null;
  created_at: string;
  updated_at: string;
  can_delete: boolean;
  can_edit: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  reactions: ChallengeReaction[];
};

type ChallengeParticipant = {
  user_id: string;
  name: string;
  profile_image: string;
};

type ChallengeDetail = {
  challenge_id: string;
  title: string;
  description: string;
  plan_text: string;
  plan_days: ChallengePlanDay[];
  category: string;
  duration_days: number;
  points: number;
  difficulty: string;
  status: string;
  thumbnail: string;
  participant_count: number;
  participants: ChallengeParticipant[];
  viewer_membership_status: string;
  viewer_progress_days_completed: number;
  viewer_points_earned: number;
  viewer_plan_progress: ChallengePlanDayProgress[];
  unread_count: number;
  can_start: boolean;
  can_post: boolean;
  has_joined: boolean;
  current_day_number: number | null;
  can_complete_today: boolean;
  completed_today: boolean;
  messages: ChallengeChatMessage[];
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ challengeId?: string }>();
  const challengeId = Array.isArray(params.challengeId) ? params.challengeId[0] : params.challengeId;
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [completingToday, setCompletingToday] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const loadDetail = useCallback(async (showLoader = false) => {
    if (!challengeId) {
      return;
    }
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const response = await apiRequest<ChallengeDetail>(`/challenges/${encodeURIComponent(challengeId)}`);
      setDetail(response);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to load challenge details.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [challengeId]);

  useEffect(() => {
    void loadDetail(true);
  }, [loadDetail]);

  const quoteText = useMemo(() => {
    const source = (detail?.plan_text || detail?.description || '').trim();
    if (!source) {
      return 'Show up, stay consistent, and keep your momentum moving forward.';
    }
    return source;
  }, [detail?.description, detail?.plan_text]);

  const handleStart = useCallback(async () => {
    if (!challengeId || !detail?.can_start || starting) {
      return;
    }
    setStarting(true);
    try {
      await apiRequest(`/challenges/${encodeURIComponent(challengeId)}/start`, {
        method: 'POST',
      });
      await loadDetail(false);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to start challenge.'));
    } finally {
      setStarting(false);
    }
  }, [challengeId, detail?.can_start, loadDetail, starting]);

  const handleSend = useCallback(async () => {
    if (!challengeId || !detail?.can_post || sending) {
      return;
    }
    const content = message.trim();
    if (!content) {
      return;
    }
    setSending(true);
    try {
      await apiRequest(`/challenges/${encodeURIComponent(challengeId)}/chat/messages`, {
        method: 'POST',
        body: { content },
      });
      setMessage('');
      await loadDetail(false);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to send encouragement.'));
    } finally {
      setSending(false);
    }
  }, [challengeId, detail?.can_post, loadDetail, message, sending]);

  const handleCompleteToday = useCallback(async () => {
    if (!challengeId || !detail?.can_complete_today || !detail.current_day_number || completingToday) {
      return;
    }
    Alert.alert(
      'Complete today?',
      `Mark day ${detail.current_day_number} as complete?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            void (async () => {
              setCompletingToday(true);
              try {
                await apiRequest(
                  `/challenges/${encodeURIComponent(challengeId)}/complete-today`,
                  {
                    method: 'POST',
                  }
                );
                await loadDetail(false);
              } catch (error) {
                setErrorDialog(formatAppError(error, 'Unable to complete today right now.'));
              } finally {
                setCompletingToday(false);
              }
            })();
          },
        },
      ],
    );
  }, [challengeId, completingToday, detail?.can_complete_today, detail?.current_day_number, loadDetail]);

  const ctaLabel = detail?.viewer_membership_status === 'ACTIVE'
    ? 'In Progress'
    : detail?.viewer_membership_status === 'COMPLETED'
      ? 'Completed'
      : 'Start Challenge';

  const ctaDisabled = !detail || starting || detail.has_joined || (!detail.can_start && !detail.has_joined);
  const showCompleteToday = Boolean(detail?.has_joined && detail?.viewer_membership_status === 'ACTIVE');
  const completeButtonLabel = detail?.completed_today ? 'Completed Today' : 'Mark Complete';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Challenges</Text>
        <Ionicons name="notifications-outline" size={24} color="#E5E7EB" />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void loadDetail(false)}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.backRow} activeOpacity={0.8} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={18} color="#F59E0B" />
              <Text style={styles.backText}>Back to Challenges</Text>
            </TouchableOpacity>

            {detail ? (
              <>
                <View style={styles.heroCard}>
                  <Text style={styles.heroTitle}>{detail.title}</Text>
                  <Text style={styles.heroDescription}>{detail.description}</Text>
                  <View style={styles.quoteWrap}>
                    <View style={styles.quoteBar} />
                    <Text style={styles.quoteText}>"{quoteText}"</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroFooter}>
                    <Text style={styles.pointsText}>+{detail.points} Points</Text>
                    <View style={styles.heroActions}>
                      {showCompleteToday ? (
                        <TouchableOpacity
                          style={[styles.secondaryButton, (!detail.can_complete_today || completingToday) && styles.primaryButtonDisabled]}
                          activeOpacity={0.88}
                          onPress={() => void handleCompleteToday()}
                          disabled={!detail.can_complete_today || completingToday}
                        >
                          {completingToday ? (
                            <ActivityIndicator color="#EAF4FF" size="small" />
                          ) : (
                            <Text style={styles.secondaryButtonText}>{completeButtonLabel}</Text>
                          )}
                        </TouchableOpacity>
                      ) : null}
                      {detail.has_joined ? (
                        <View
                          style={[
                            styles.primaryButton,
                            styles.primaryButtonJoined,
                            detail.viewer_membership_status === 'COMPLETED' && styles.primaryButtonCompleted,
                          ]}
                        >
                          <Text style={styles.primaryButtonText}>{ctaLabel}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.primaryButton,
                            ctaDisabled && styles.primaryButtonDisabled,
                          ]}
                          activeOpacity={0.88}
                          onPress={() => {
                            void handleStart();
                          }}
                          disabled={ctaDisabled}
                        >
                          {starting ? (
                            <ActivityIndicator color="#FFF7ED" size="small" />
                          ) : (
                            <Text style={styles.primaryButtonText}>{ctaLabel}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.participantsCard}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="people-outline" size={24} color="#F59E0B" />
                    <Text style={styles.sectionTitle}>Fellow Challengers ({detail.participant_count})</Text>
                  </View>
                  {detail.participants.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.participantsRow}>
                      {detail.participants.map((participant) => (
                        <View key={participant.user_id} style={styles.participantChip}>
                          {participant.profile_image ? (
                            <Image source={{ uri: participant.profile_image }} style={styles.participantAvatar} />
                          ) : (
                            <View style={[styles.participantAvatar, styles.participantAvatarFallback]}>
                              <Text style={styles.participantAvatarText}>{(participant.name || 'U')[0]}</Text>
                            </View>
                          )}
                          <Text style={styles.participantName} numberOfLines={1}>{participant.name}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.emptyHelper}>Be the first to join!</Text>
                  )}
                </View>

                <View style={styles.hubCard}>
                  <Text style={styles.hubTitle}>Encouragement Hub</Text>
                  <View style={styles.hubDivider} />
                  <View style={styles.messagesWrap}>
                    {detail.messages.length > 0 ? detail.messages.map((item) => (
                      <View key={item.id} style={styles.messageRow}>
                        <Text style={styles.messageAuthor}>{item.author_name}</Text>
                        <Text style={styles.messageTime}>{formatMessageTime(item.created_at)}</Text>
                        <Text style={styles.messageBody}>
                          {item.is_deleted ? 'Message deleted' : item.content || (item.progress_payload?.completed_day ? `Completed day ${item.progress_payload.completed_day}.` : '')}
                        </Text>
                      </View>
                    )) : (
                      <View style={styles.emptyMessages}>
                        <Text style={styles.emptyMessagesTitle}>No messages yet.</Text>
                        <Text style={styles.emptyMessagesText}>Be the first to send some encouragement!</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.composerRow}>
                    <TextInput
                      style={styles.input}
                      placeholder={detail.can_post ? 'Encourage someone...' : 'Start the challenge to join the hub'}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      value={message}
                      onChangeText={setMessage}
                      editable={detail.can_post && !sending}
                    />
                    <TouchableOpacity
                      style={[styles.sendButton, (!detail.can_post || sending) && styles.sendButtonDisabled]}
                      activeOpacity={0.88}
                      onPress={() => void handleSend()}
                      disabled={!detail.can_post || sending}
                    >
                      {sending ? <ActivityIndicator color="#E5E7EB" size="small" /> : <Ionicons name="paper-plane-outline" size={20} color="#E5E7EB" />}
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <ErrorPopupModal
        visible={Boolean(errorDialog)}
        title={errorDialog?.title || 'Error'}
        message={errorDialog?.message || ''}
        onClose={() => setErrorDialog(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#123A78' },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontFamily: 'Inter_700Bold' },
  scrollContent: { padding: 20, paddingBottom: 32 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  backText: { color: '#F59E0B', fontSize: 14, fontFamily: 'Inter_500Medium' },
  heroCard: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20,
  },
  heroTitle: { color: '#FFF', fontSize: 28, lineHeight: 36, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  heroDescription: { color: '#E5E7EB', fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular', marginBottom: 18 },
  quoteWrap: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  quoteBar: { width: 4, borderRadius: 999, backgroundColor: '#FBBF24' },
  quoteText: { flex: 1, color: '#9CA3AF', fontSize: 15, lineHeight: 24, fontStyle: 'italic', fontFamily: 'Inter_400Regular' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 18 },
  heroFooter: { gap: 16 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  pointsText: { color: '#FBBF24', fontSize: 18, fontFamily: 'Inter_700Bold' },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#FF735C',
  },
  primaryButtonJoined: { backgroundColor: '#22C55E' },
  primaryButtonCompleted: { backgroundColor: '#2563EB' },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: '#FFF7ED', fontSize: 16, fontFamily: 'Inter_700Bold' },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#2563EB',
  },
  secondaryButtonText: { color: '#EAF4FF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  participantsCard: {
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontFamily: 'Inter_700Bold' },
  participantsRow: { gap: 14, paddingRight: 10 },
  participantChip: { width: 72, alignItems: 'center', gap: 8 },
  participantAvatar: { width: 52, height: 52, borderRadius: 26 },
  participantAvatarFallback: { backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  participantAvatarText: { color: '#FFF', fontSize: 18, fontFamily: 'Inter_700Bold' },
  participantName: { color: '#D1D5DB', fontSize: 11, textAlign: 'center', fontFamily: 'Inter_500Medium' },
  emptyHelper: { color: '#9CA3AF', fontSize: 15, fontFamily: 'Inter_400Regular' },
  hubCard: {
    backgroundColor: '#1F2937',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  hubTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Inter_700Bold', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  hubDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  messagesWrap: { minHeight: 220, padding: 20, gap: 14 },
  messageRow: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14 },
  messageAuthor: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  messageTime: { color: '#9CA3AF', fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  messageBody: { color: '#E5E7EB', fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  emptyMessages: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 34 },
  emptyMessagesTitle: { color: '#6B7280', fontSize: 28, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  emptyMessagesText: { color: '#6B7280', fontSize: 16, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    outlineStyle: 'none' as any,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B5563',
  },
  sendButtonDisabled: { opacity: 0.45 },
});
