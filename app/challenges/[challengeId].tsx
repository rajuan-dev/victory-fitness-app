import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { useLanguage } from '../../lib/i18n';
import { pushRoute } from '../../lib/navigation';
import { getCachedResourceSnapshot } from '../../lib/resourceCache';
import { fetchChallengeDetailData, getChallengeDetailCacheKey } from '../../lib/screenData';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

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
  started_at?: string;
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
  const { t } = useLanguage();
  const checkingAccess = useModuleAccessGuard('/challenge');
  const params = useLocalSearchParams<{ challengeId?: string }>();
  const challengeId = Array.isArray(params.challengeId) ? params.challengeId[0] : params.challengeId;
  const cachedDetail = challengeId ? getCachedResourceSnapshot<ChallengeDetail>(getChallengeDetailCacheKey(challengeId)) : null;
  const [detail, setDetail] = useState<ChallengeDetail | null>(cachedDetail ?? null);
  const [loading, setLoading] = useState(!cachedDetail);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [completingToday, setCompletingToday] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const [completeDayConfirmVisible, setCompleteDayConfirmVisible] = useState(false);

  const dayProgressMap = useMemo(() => {
    const map = new Map<number, ChallengePlanDayProgress>();
    for (const progress of detail?.viewer_plan_progress || []) {
      map.set(progress.day_number, progress);
    }
    return map;
  }, [detail?.viewer_plan_progress]);

  const currentCalendarDay = useMemo(() => {
    if (!detail?.started_at) {
      return detail?.current_day_number || 1;
    }
    const startDate = new Date(detail.started_at);
    const startLocalDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const today = new Date();
    const todayLocalDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const msDiff = todayLocalDate.getTime() - startLocalDate.getTime();
    const elapsedDays = Math.floor(msDiff / (1000 * 60 * 60 * 24));
    return Math.max(1, elapsedDays + 1);
  }, [detail?.started_at, detail?.current_day_number]);

  const isCurrentDayCompleted = useMemo(() => {
    return Boolean(dayProgressMap.get(currentCalendarDay)?.completed);
  }, [dayProgressMap, currentCalendarDay]);

  const canCompleteToday = useMemo(() => {
    return Boolean(detail?.has_joined && detail?.viewer_membership_status === 'ACTIVE' && !isCurrentDayCompleted);
  }, [detail?.has_joined, detail?.viewer_membership_status, isCurrentDayCompleted]);

  const loadDetail = useCallback(async (showLoader = false) => {
    if (!challengeId) {
      return;
    }
    if (showLoader && !cachedDetail) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const response = await fetchChallengeDetailData<ChallengeDetail>(challengeId);
      setDetail(response);
    } catch (error) {
      setErrorDialog(formatAppError(error, t('Failed to load challenge details.')));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cachedDetail, challengeId, t]);

  useEffect(() => {
    if (checkingAccess) {
      return;
    }
    void loadDetail(true);
  }, [checkingAccess, loadDetail]);

  const quoteText = useMemo(() => {
    const source = (detail?.plan_text || detail?.description || '').trim();
    if (!source) {
      return t('Show up, stay consistent, and keep your momentum moving forward.');
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
      setErrorDialog(formatAppError(error, t('Failed to start challenge.')));
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
      setErrorDialog(formatAppError(error, t('Failed to send encouragement.')));
    } finally {
      setSending(false);
    }
  }, [challengeId, detail?.can_post, loadDetail, message, sending]);

  const handleCompleteToday = useCallback(async () => {
    if (!challengeId || !canCompleteToday || completingToday) {
      return;
    }
    setCompleteDayConfirmVisible(true);
  }, [challengeId, completingToday, canCompleteToday]);

  const confirmCompleteToday = useCallback(async () => {
    if (!challengeId || !canCompleteToday || completingToday) {
      return;
    }
    setCompleteDayConfirmVisible(false);
    setCompletingToday(true);
    try {
      await apiRequest(
        `/challenges/${encodeURIComponent(challengeId)}/current-day/complete`,
        {
          method: 'POST',
        }
      );
      await loadDetail(false);
    } catch (error) {
      setErrorDialog(formatAppError(error, t('Unable to complete today right now.')));
    } finally {
      setCompletingToday(false);
    }
  }, [challengeId, completingToday, canCompleteToday, currentCalendarDay, loadDetail, t]);

  const ctaLabel = detail?.viewer_membership_status === 'ACTIVE'
    ? t('In Progress')
    : detail?.viewer_membership_status === 'COMPLETED'
      ? t('Completed')
      : t('Start Challenge');

  const ctaDisabled = !detail || starting || detail.has_joined || (!detail.can_start && !detail.has_joined);
  const showCompleteToday = Boolean(detail?.has_joined && detail?.viewer_membership_status === 'ACTIVE');
  const completeButtonLabel = isCurrentDayCompleted ? t('Completed Today') : t('Mark Complete');
  const completedDaysCount = detail?.viewer_progress_days_completed || 0;
  const totalDaysCount = detail?.duration_days || detail?.plan_days.length || 0;
  const remainingDaysCount = Math.max(totalDaysCount - completedDaysCount, 0);
  const openProgressDay = useCallback((dayNumber: number) => {
    if (!challengeId) {
      return;
    }

    pushRoute(router, {
      pathname: '/challenges/progress/[challengeId]',
      params: {
        challengeId,
        day: String(dayNumber),
      },
    });
  }, [challengeId, router]);

  if (checkingAccess) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Modal
        visible={completeDayConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCompleteDayConfirmVisible(false)}
      >
        <View style={styles.confirmModalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setCompleteDayConfirmVisible(false)} />
          <View style={styles.confirmModalCard}>
            <Text style={styles.confirmModalTitle}>{t('Complete today?')}</Text>
            <Text style={styles.confirmModalText}>
              {t('Mark day {day} as complete?', { day: currentCalendarDay })}
            </Text>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity style={styles.confirmModalSecondaryButton} onPress={() => setCompleteDayConfirmVisible(false)} activeOpacity={0.85}>
                <Text style={styles.confirmModalSecondaryText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmModalPrimaryButton} onPress={() => void confirmCompleteToday()} activeOpacity={0.85}>
                <Text style={styles.confirmModalPrimaryText}>{t('Confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('Challenges')}</Text>
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
              <Text style={styles.backText}>{t('Back to Challenges')}</Text>
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
                    <Text style={styles.pointsText}>+{detail.points} {t('Points')}</Text>
                    <View style={styles.trackerCard}>
                      <View style={styles.trackerHeader}>
                        <View>
                          <Text style={styles.trackerTitle}>Day Tracker</Text>
                          <Text style={styles.trackerSubtitle}>Tap any day number to open that day.</Text>
                        </View>
                        <View style={styles.trackerPill}>
                          <Text style={styles.trackerPillText}>{completedDaysCount}/{Math.max(totalDaysCount, 1)}</Text>
                        </View>
                      </View>
                      <View style={styles.trackerStatsRow}>
                        <View style={styles.trackerStat}>
                          <Text style={styles.trackerStatValue}>{completedDaysCount}</Text>
                          <Text style={styles.trackerStatLabel}>Done</Text>
                        </View>
                        <View style={styles.trackerStat}>
                          <Text style={styles.trackerStatValue}>{remainingDaysCount}</Text>
                          <Text style={styles.trackerStatLabel}>Left</Text>
                        </View>
                        <View style={styles.trackerStat}>
                          <Text style={styles.trackerStatValue}>{currentCalendarDay}</Text>
                          <Text style={styles.trackerStatLabel}>Current</Text>
                        </View>
                      </View>
                      <View style={styles.trackerLegendRow}>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, styles.legendDotCompleted]} />
                          <Text style={styles.legendText}>Done</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, styles.legendDotCurrent]} />
                          <Text style={styles.legendText}>Current</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, styles.legendDotMissed]} />
                          <Text style={styles.legendText}>Missed</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.dayStripWrap}>
                      <Text style={styles.dayStripTitle}>Challenge Days</Text>
                      <Text style={styles.dayStripSubtitle}>Left to right scroll</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
                        {detail.plan_days.map((day) => {
                          const progress = dayProgressMap.get(day.day_number);
                          const isCompleted = Boolean(progress?.completed);
                          const isCurrent = currentCalendarDay === day.day_number && !isCompleted;
                          const isMissed =
                            !isCompleted &&
                            !isCurrent &&
                            day.day_number < currentCalendarDay;
                          return (
                            <TouchableOpacity
                              key={`detail-day-${day.day_number}`}
                              activeOpacity={0.85}
                              accessibilityRole="button"
                              accessibilityLabel={t('Open day {day} progress', { day: day.day_number })}
                              onPress={() => openProgressDay(day.day_number)}
                              style={[
                                styles.dayChip,
                                isCompleted && styles.dayChipCompleted,
                                isCurrent && styles.dayChipCurrent,
                                isMissed && styles.dayChipMissed,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.dayChipText,
                                  isCompleted && styles.dayChipTextCompleted,
                                  isCurrent && styles.dayChipTextCurrent,
                                  isMissed && styles.dayChipTextMissed,
                                ]}
                              >
                                {day.day_number}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                    <View style={styles.heroActions}>
                      {showCompleteToday ? (
                        <TouchableOpacity
                          style={[styles.secondaryButton, (!canCompleteToday || completingToday) && styles.primaryButtonDisabled]}
                          activeOpacity={0.88}
                          onPress={() => void handleCompleteToday()}
                          disabled={!canCompleteToday || completingToday}
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
                    <Text style={styles.sectionTitle}>{t('Fellow Challengers')} ({detail.participant_count})</Text>
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
                    <Text style={styles.emptyHelper}>{t('Be the first to join!')}</Text>
                  )}
                </View>

                <View style={styles.hubCard}>
                  <Text style={styles.hubTitle}>{t('Encouragement Hub')}</Text>
                  <View style={styles.hubDivider} />
                  <View style={styles.messagesWrap}>
                    {detail.messages.length > 0 ? detail.messages.map((item) => (
                      <View key={item.id} style={styles.messageRow}>
                        <Text style={styles.messageAuthor}>{item.author_name}</Text>
                        <Text style={styles.messageTime}>{formatMessageTime(item.created_at)}</Text>
                        <Text style={styles.messageBody}>
                          {item.is_deleted ? t('Message deleted') : item.content || (item.progress_payload?.completed_day ? t('Completed day {day}.', { day: item.progress_payload.completed_day }) : '')}
                        </Text>
                      </View>
                    )) : (
                      <View style={styles.emptyMessages}>
                        <Text style={styles.emptyMessagesTitle}>{t('No messages yet.')}</Text>
                        <Text style={styles.emptyMessagesText}>{t('Be the first to send some encouragement!')}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.composerRow}>
                    <TextInput
                      style={styles.input}
                      placeholder={detail.can_post ? t('Encourage someone...') : t('Start the challenge to join the hub')}
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
        title={errorDialog?.title || t('Error')}
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
  confirmModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#101827',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  confirmModalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmModalText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 18,
  },
  confirmModalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  confirmModalSecondaryButton: {
    minWidth: 108,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  confirmModalSecondaryText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  confirmModalPrimaryButton: {
    minWidth: 108,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  confirmModalPrimaryText: {
    color: '#001311',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
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
  dayStripWrap: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
  },
  dayStripTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  dayStripSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    marginBottom: 14,
  },
  dayStrip: { gap: 12, paddingRight: 8 },
  dayChip: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  dayChipCompleted: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  dayChipCurrent: {
    borderColor: 'rgba(148,163,184,0.82)',
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  dayChipMissed: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  dayChipText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  dayChipTextCompleted: {
    color: '#052E16',
  },
  dayChipTextCurrent: {
    color: '#E5E7EB',
  },
  dayChipTextMissed: {
    color: '#FCA5A5',
  },
  quoteWrap: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  quoteBar: { width: 4, borderRadius: 999, backgroundColor: '#FBBF24' },
  quoteText: { flex: 1, color: '#9CA3AF', fontSize: 15, lineHeight: 24, fontStyle: 'italic', fontFamily: 'Inter_400Regular' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 18 },
  heroFooter: { gap: 16 },
  trackerCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(30,41,59,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.14)',
    gap: 14,
  },
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  trackerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  trackerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  trackerPill: {
    minWidth: 62,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.28)',
  },
  trackerPillText: {
    color: '#DBEAFE',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  trackerStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trackerStat: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  trackerStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  trackerStatLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackerLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendDotCompleted: {
    backgroundColor: '#22C55E',
  },
  legendDotCurrent: {
    backgroundColor: '#94A3B8',
  },
  legendDotMissed: {
    backgroundColor: '#EF4444',
  },
  legendText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
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
