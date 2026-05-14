import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../../constants/Colors';
import { apiRequest, getValidAuthTokens } from '../../../lib/api';
import { ErrorPopupModal } from '../../../components/ErrorPopupModal';
import { formatAppError } from '../../../lib/error';

type ChallengeReaction = {
  emoji: string;
  count: number;
  viewer_reacted: boolean;
};

type ChallengePlanExercise = {
  id: string;
  name: string;
  details: string;
  notes: string;
  workout_id: string;
  workout_title: string;
  workout_vimeo_id: string;
  workout_thumbnail: string;
};

type ChallengePlanSection = {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  exercises: ChallengePlanExercise[];
};

type ChallengePlanDay = {
  day_number: number;
  title: string;
  focus: string;
  notes: string;
  sections: ChallengePlanSection[];
};

type ChallengePlanDayProgress = {
  day_number: number;
  completed: boolean;
  completed_section_ids: string[];
};

type ChallengePlanProgressResponse = {
  challenge_id: string;
  viewer_membership_status: string;
  viewer_progress_days_completed: number;
  viewer_plan_progress: ChallengePlanDayProgress[];
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

type ChallengeChatThread = {
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
  viewer_membership_status: string;
  viewer_progress_days_completed: number;
  viewer_plan_progress: ChallengePlanDayProgress[];
  unread_count: number;
  messages: ChallengeChatMessage[];
};

type ChallengeChatEvent = {
  event: 'message_created' | 'message_updated' | 'message_deleted' | 'reaction_toggled';
  challenge_id: string;
  message?: ChallengeChatMessage | null;
  message_id?: string | null;
};

const QUICK_REACTIONS = ['🔥', '💪', '👏'];

declare const process: {
  env?: Record<string, string | undefined>;
};

const RAW_API_URL = process.env?.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000';

function resolveApiUrl(url: string): string {
  if (Platform.OS !== 'android') {
    return url;
  }

  if (url.includes('://127.0.0.1') || url.includes('://localhost')) {
    return url.replace('://127.0.0.1', '://10.0.2.2').replace('://localhost', '://10.0.2.2');
  }

  return url;
}

function buildChallengeChatSocketUrl(challengeId: string, token: string) {
  const apiUrl = resolveApiUrl(RAW_API_URL).replace(/^http/, 'ws').replace(/\/$/, '');
  return `${apiUrl}/ws/challenges/${encodeURIComponent(challengeId)}/chat?token=${encodeURIComponent(token)}`;
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function mergeMessage(current: ChallengeChatMessage[], next: ChallengeChatMessage) {
  const existingIndex = current.findIndex((item) => item.id === next.id);
  if (existingIndex === -1) {
    return [...current, next].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  const updated = [...current];
  updated[existingIndex] = next;
  return updated;
}

function ThreadPreview({
  item,
  repliedMessage,
}: {
  item: ChallengeChatMessage;
  repliedMessage?: ChallengeChatMessage | undefined;
}) {
  if (!item.reply_to_message_id || !repliedMessage) {
    return null;
  }

  return (
    <View style={styles.replyPreview}>
      <Text style={styles.replyPreviewAuthor}>{repliedMessage.author_name}</Text>
      <Text style={styles.replyPreviewText} numberOfLines={1}>
        {repliedMessage.is_deleted ? 'Message deleted' : repliedMessage.content || (repliedMessage.image_url ? 'Image' : '')}
      </Text>
    </View>
  );
}

function MessageBubble({
  item,
  repliedMessage,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: {
  item: ChallengeChatMessage;
  repliedMessage?: ChallengeChatMessage;
  onReply: (item: ChallengeChatMessage) => void;
  onEdit: (item: ChallengeChatMessage) => void;
  onDelete: (item: ChallengeChatMessage) => void;
  onReact: (item: ChallengeChatMessage, emoji: string) => void;
}) {
  const isCoach = item.author_role === 'coach' || item.author_id === 'coach_bot';
  const isSystem = item.message_type === 'system_event' || item.author_id === 'system';
  const isProgress = item.message_type === 'progress_update';

  if (isSystem) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{item.content}</Text>
      </View>
    );
  }

  return (
    <View style={styles.messageRow}>
      {item.author_profile_image ? (
        <Image source={{ uri: item.author_profile_image }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, isCoach ? styles.avatarCoach : styles.avatarUser]}>
          <Text style={styles.avatarText}>{(item.author_name || 'U')[0]}</Text>
        </View>
      )}
      <View style={styles.messageContent}>
        <View style={styles.messageMetaRow}>
          <Text style={styles.authorName}>{item.author_name}</Text>
          {isCoach ? <Text style={styles.coachBadge}>COACH</Text> : null}
          {isProgress ? <Text style={styles.progressBadge}>PROGRESS</Text> : null}
          {item.is_edited ? <Text style={styles.editedBadge}>EDITED</Text> : null}
          {item.is_deleted ? <Text style={styles.deletedBadge}>DELETED</Text> : null}
          <Text style={styles.messageTime}>{formatMessageTime(item.created_at)}</Text>
        </View>
        <View style={[styles.bubble, isCoach ? styles.coachBubble : styles.userBubble, isProgress && styles.progressBubble]}>
          <ThreadPreview item={item} repliedMessage={repliedMessage} />
          {item.is_deleted ? (
            <Text style={styles.deletedText}>Message deleted</Text>
          ) : (
            <>
              {item.content ? <Text style={styles.messageText}>{item.content}</Text> : null}
              {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.messageImage} /> : null}
            </>
          )}
        </View>
        <View style={styles.reactionsWrap}>
          {item.reactions.map((reaction) => (
            <TouchableOpacity
              key={`${item.id}-${reaction.emoji}`}
              onPress={() => onReact(item, reaction.emoji)}
              style={[styles.reactionChip, reaction.viewer_reacted && styles.reactionChipActive]}
            >
              <Text style={styles.reactionChipText}>{reaction.emoji} {reaction.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.messageActionsRow}>
          {QUICK_REACTIONS.map((emoji) => (
            <TouchableOpacity key={`${item.id}-${emoji}`} onPress={() => onReact(item, emoji)} style={styles.iconAction}>
              <Text style={styles.quickReactionText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => onReply(item)} style={styles.iconAction}>
            <Ionicons name="return-up-back-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          {item.can_edit && !item.is_deleted ? (
            <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconAction}>
              <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          {item.can_delete && !item.is_deleted ? (
            <TouchableOpacity onPress={() => onDelete(item)} style={styles.iconAction}>
              <Ionicons name="trash-outline" size={14} color="#FCA5A5" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function ChallengeChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ challengeId?: string }>();
  const challengeId = Array.isArray(params.challengeId) ? params.challengeId[0] : params.challengeId;
  const socketRef = useRef<WebSocket | null>(null);

  const [thread, setThread] = useState<ChallengeChatThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChallengeChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChallengeChatMessage | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [completionUpdatingKey, setCompletionUpdatingKey] = useState('');
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const canPostInChallenge = useMemo(
    () => Boolean(thread && thread.viewer_membership_status === 'ACTIVE' && thread.status === 'ACTIVE'),
    [thread]
  );

  const messagesById = useMemo(() => {
    const map = new Map<string, ChallengeChatMessage>();
    for (const message of thread?.messages || []) {
      map.set(message.id, message);
    }
    return map;
  }, [thread?.messages]);

  const dayProgressMap = useMemo(() => {
    const map = new Map<number, ChallengePlanDayProgress>();
    for (const dayProgress of thread?.viewer_plan_progress || []) {
      map.set(dayProgress.day_number, dayProgress);
    }
    return map;
  }, [thread?.viewer_plan_progress]);

  const loadThread = useCallback(async (showLoader = false) => {
    if (!challengeId) {
      return;
    }

    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await apiRequest<ChallengeChatThread>(`/challenges/${encodeURIComponent(challengeId)}/chat`);
      setThread(response);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to load challenge chat.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [challengeId]);

  useEffect(() => {
    void loadThread(true);
  }, [loadThread]);

  const openLinkedWorkout = useCallback((exercise: ChallengePlanExercise) => {
    if (!exercise.workout_vimeo_id) {
      return;
    }
    router.push({
      pathname: '/workout-library/[id]',
      params: {
        id: exercise.workout_id || exercise.id,
        title: exercise.workout_title || `${exercise.name} Demo`,
        vimeoId: exercise.workout_vimeo_id,
        tag: 'Instruction Video',
        thumbnail: exercise.workout_thumbnail || '',
      },
    });
  }, [router]);

  useEffect(() => {
    let closed = false;

    const connectSocket = async () => {
      if (!challengeId) {
        return;
      }

      const tokens = await getValidAuthTokens();
      if (!tokens?.access_token || closed) {
        return;
      }

      const socket = new WebSocket(buildChallengeChatSocketUrl(challengeId, tokens.access_token));
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as ChallengeChatEvent;
          if (!payload?.event) {
            return;
          }

          setThread((current) => {
            if (!current) {
              return current;
            }

            if (payload.event === 'message_created' || payload.event === 'message_updated' || payload.event === 'reaction_toggled') {
              if (!payload.message) {
                return current;
              }
              return {
                ...current,
                messages: mergeMessage(current.messages, payload.message),
              };
            }

            if (payload.event === 'message_deleted' && payload.message) {
              return {
                ...current,
                messages: mergeMessage(current.messages, payload.message),
              };
            }

            return current;
          });
        } catch {
          return;
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
      };
    };

    void connectSocket();

    return () => {
      closed = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [challengeId]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to add an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setSelectedImage(result.assets[0]);
    }
  };

  const resetComposer = () => {
    setInputText('');
    setSelectedImage(null);
    setReplyingTo(null);
    setEditingMessage(null);
  };

  const applyPlanProgress = useCallback((response: ChallengePlanProgressResponse) => {
    setThread((current) => {
      if (!current || current.challenge_id !== response.challenge_id) {
        return current;
      }
      return {
        ...current,
        viewer_membership_status: response.viewer_membership_status,
        viewer_progress_days_completed: response.viewer_progress_days_completed,
        viewer_plan_progress: Array.isArray(response.viewer_plan_progress) ? response.viewer_plan_progress : [],
      };
    });
  }, []);

  const sendMessage = async () => {
    if (!challengeId) {
      return;
    }

    const content = inputText.trim();
    if (!content && !selectedImage?.base64) {
      return;
    }

    setSending(true);
    try {
      if (editingMessage) {
        await apiRequest(`/challenges/${encodeURIComponent(challengeId)}/chat/messages/${encodeURIComponent(editingMessage.id)}`, {
          method: 'PATCH',
          body: { content },
        });
      } else {
        await apiRequest(`/challenges/${encodeURIComponent(challengeId)}/chat/messages`, {
          method: 'POST',
          body: {
            content,
            image_base64: selectedImage?.base64 ?? undefined,
            mime_type: selectedImage?.mimeType ?? 'image/jpeg',
            file_name: selectedImage?.fileName ?? null,
            reply_to_message_id: replyingTo?.id ?? undefined,
          },
        });
      }

      resetComposer();
    } catch (error) {
      setErrorDialog(formatAppError(error, editingMessage ? 'Failed to update message.' : 'Failed to send message.'));
    } finally {
      setSending(false);
    }
  };

  const shareProgress = async () => {
    if (!challengeId || !thread || sending || !canPostInChallenge) {
      return;
    }

    setSending(true);
    try {
      const nextPlanDay = thread.plan_days.find((day) => !dayProgressMap.get(day.day_number)?.completed);
      if (nextPlanDay) {
        const response = await apiRequest<ChallengePlanProgressResponse>(
          `/challenges/${encodeURIComponent(challengeId)}/plan/days/${nextPlanDay.day_number}/complete`,
          {
            method: 'POST',
            body: { completed: true },
          }
        );
        applyPlanProgress(response);
      } else {
        await apiRequest(`/challenges/${encodeURIComponent(challengeId)}/progress`, {
          method: 'POST',
          body: {
            completed_day: Math.min(thread.viewer_progress_days_completed + 1, thread.duration_days),
            note: `Completed day ${Math.min(thread.viewer_progress_days_completed + 1, thread.duration_days)}.`,
          },
        });
      }
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to share progress.'));
    } finally {
      setSending(false);
    }
  };

  const toggleDayCompletion = useCallback(async (dayNumber: number, completed: boolean) => {
    if (!challengeId) {
      return;
    }
    const key = `day-${dayNumber}`;
    setCompletionUpdatingKey(key);
    try {
      const response = await apiRequest<ChallengePlanProgressResponse>(
        `/challenges/${encodeURIComponent(challengeId)}/plan/days/${dayNumber}/complete`,
        {
          method: 'POST',
          body: { completed },
        }
      );
      applyPlanProgress(response);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to update day completion.'));
    } finally {
      setCompletionUpdatingKey('');
    }
  }, [applyPlanProgress, challengeId]);

  const toggleSectionCompletion = useCallback(async (dayNumber: number, sectionId: string, completed: boolean) => {
    if (!challengeId) {
      return;
    }
    const key = `section-${dayNumber}-${sectionId}`;
    setCompletionUpdatingKey(key);
    try {
      const response = await apiRequest<ChallengePlanProgressResponse>(
        `/challenges/${encodeURIComponent(challengeId)}/plan/days/${dayNumber}/sections/${encodeURIComponent(sectionId)}/complete`,
        {
          method: 'POST',
          body: { completed },
        }
      );
      applyPlanProgress(response);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to update section completion.'));
    } finally {
      setCompletionUpdatingKey('');
    }
  }, [applyPlanProgress, challengeId]);

  const handleDelete = (item: ChallengeChatMessage) => {
    if (!challengeId) {
      return;
    }
    Alert.alert('Delete message', 'Delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/challenges/${encodeURIComponent(challengeId)}/chat/messages/${encodeURIComponent(item.id)}`, {
              method: 'DELETE',
            });
          } catch (error) {
            setErrorDialog(formatAppError(error, 'Failed to delete message.'));
          }
        },
      },
    ]);
  };

  const handleReact = async (item: ChallengeChatMessage, emoji: string) => {
    if (!challengeId) {
      return;
    }
    try {
      await apiRequest(`/challenges/${encodeURIComponent(challengeId)}/chat/messages/${encodeURIComponent(item.id)}/reactions/toggle`, {
        method: 'POST',
        body: { emoji },
      });
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to update reaction.'));
    }
  };

  const nextDayLabel = useMemo(() => {
    if (!thread) {
      return 'Share progress';
    }
    if (thread.status === 'UPCOMING') {
      return 'Challenge coming soon';
    }
    if (thread.status === 'ARCHIVED') {
      return 'Challenge archived';
    }
    if (thread.viewer_membership_status !== 'ACTIVE') {
      return 'Posting locked';
    }
    const nextPlanDay = thread.plan_days.find((day) => !dayProgressMap.get(day.day_number)?.completed);
    if (nextPlanDay) {
      return `Mark day ${nextPlanDay.day_number} done`;
    }
    return thread.viewer_progress_days_completed >= thread.duration_days
      ? 'Challenge completed'
      : `Mark day ${thread.viewer_progress_days_completed + 1} done`;
  }, [dayProgressMap, thread]);

  if (loading && !thread) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ErrorPopupModal
        visible={Boolean(errorDialog)}
        title={errorDialog?.title ?? 'Error'}
        message={errorDialog?.message ?? ''}
        onClose={() => setErrorDialog(null)}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>{thread?.title || 'Challenge Chat'}</Text>
          <Text style={styles.headerMeta}>
            {thread?.participant_count || 0} members · {thread?.category || 'Challenge'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => void loadThread(false)} style={styles.headerIcon}>
          {refreshing ? <ActivityIndicator color={Colors.primary} size="small" /> : <Ionicons name="refresh" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>

      {thread ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroDescription}>{thread.description}</Text>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMeta}>{thread.difficulty}</Text>
            <Text style={[styles.heroMeta, thread.status !== 'ACTIVE' && styles.heroMetaMuted]}>{thread.status}</Text>
            <Text style={styles.heroMeta}>{thread.viewer_progress_days_completed}/{thread.duration_days} days</Text>
            <Text style={styles.heroMeta}>+{thread.points} pts</Text>
          </View>
          {!canPostInChallenge ? (
            <View style={styles.statusNotice}>
              <Text style={styles.statusNoticeText}>
                {thread.status === 'UPCOMING'
                  ? 'This challenge is upcoming. You can view the details, but posting is locked until it becomes active.'
                  : thread.status === 'ARCHIVED'
                    ? 'This challenge has been archived. Chat is read-only.'
                    : thread.viewer_membership_status !== 'ACTIVE'
                      ? 'Your membership is no longer active. Chat is read-only.'
                      : 'This challenge is read-only right now.'}
              </Text>
            </View>
          ) : null}
          {thread.plan_days.length > 0 || thread.plan_text ? (
            <View style={styles.planSection}>
              <TouchableOpacity style={styles.planToggle} onPress={() => setShowPlan((current) => !current)}>
                <Text style={styles.planToggleText}>{showPlan ? 'Hide Plan' : 'View Plan'}</Text>
                <Ionicons name={showPlan ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
              </TouchableOpacity>
              {showPlan ? (
                <View style={styles.planCard}>
                  {thread.plan_days.length > 0 ? (
                    <View style={styles.planDaysWrap}>
                      {thread.plan_days.map((day) => {
                        const dayProgress = dayProgressMap.get(day.day_number);
                        const completedSectionIds = dayProgress?.completed_section_ids || [];
                        const dayCompleted = Boolean(dayProgress?.completed);
                        return (
                          <View key={`plan-day-${day.day_number}`} style={[styles.planDayCard, dayCompleted && styles.planDayCardCompleted]}>
                            <View style={styles.planDayHeader}>
                              <View style={styles.planDayHeaderText}>
                                <Text style={styles.planDayEyebrow}>Day {day.day_number}</Text>
                                <Text style={styles.planDayTitle}>{day.title}</Text>
                                <Text style={styles.planDayFocus}>{day.focus}</Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.planDayButton, dayCompleted && styles.planDayButtonCompleted, !canPostInChallenge && styles.buttonDisabled]}
                                disabled={!canPostInChallenge || completionUpdatingKey === `day-${day.day_number}`}
                                onPress={() => void toggleDayCompletion(day.day_number, !dayCompleted)}
                              >
                                {completionUpdatingKey === `day-${day.day_number}` ? (
                                  <ActivityIndicator size="small" color={dayCompleted ? '#001311' : Colors.primary} />
                                ) : (
                                  <>
                                    <Ionicons
                                      name={dayCompleted ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                      size={16}
                                      color={dayCompleted ? '#001311' : Colors.primary}
                                    />
                                    <Text style={[styles.planDayButtonText, dayCompleted && styles.planDayButtonTextCompleted]}>
                                      {dayCompleted ? 'Completed' : 'Complete day'}
                                    </Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            </View>
                            {day.notes ? <Text style={styles.planDayNotes}>{day.notes}</Text> : null}
                            <View style={styles.planSectionsWrap}>
                              {day.sections.map((section) => {
                                const sectionCompleted = completedSectionIds.includes(section.id);
                                return (
                                  <View key={section.id} style={[styles.planSectionCard, sectionCompleted && styles.planSectionCardCompleted]}>
                                    <View style={styles.planSectionHeader}>
                                      <View style={styles.planSectionTextWrap}>
                                        <Text style={styles.planSectionTitle}>{section.title}</Text>
                                        {section.description ? <Text style={styles.planSectionDescription}>{section.description}</Text> : null}
                                      </View>
                                      <TouchableOpacity
                                        style={[styles.planSectionButton, sectionCompleted && styles.planSectionButtonCompleted, !canPostInChallenge && styles.buttonDisabled]}
                                        disabled={!canPostInChallenge || completionUpdatingKey === `section-${day.day_number}-${section.id}`}
                                        onPress={() => void toggleSectionCompletion(day.day_number, section.id, !sectionCompleted)}
                                      >
                                        {completionUpdatingKey === `section-${day.day_number}-${section.id}` ? (
                                          <ActivityIndicator size="small" color={sectionCompleted ? '#001311' : Colors.primary} />
                                        ) : (
                                          <Ionicons
                                            name={sectionCompleted ? 'checkmark' : 'ellipse-outline'}
                                            size={16}
                                            color={sectionCompleted ? '#001311' : Colors.primary}
                                          />
                                        )}
                                      </TouchableOpacity>
                                    </View>
                                    <Text style={styles.planSectionMeta}>{section.estimated_minutes} min</Text>
                                    <View style={styles.planExercisesWrap}>
                                      {section.exercises.map((exercise) => (
                                        <View key={exercise.id} style={styles.planExerciseRow}>
                                          <View style={styles.planExerciseDot} />
                                          <View style={styles.planExerciseTextWrap}>
                                            <Text style={styles.planExerciseName}>{exercise.name}</Text>
                                            <Text style={styles.planExerciseDetails}>{exercise.details}</Text>
                                            {exercise.notes ? <Text style={styles.planExerciseNotes}>{exercise.notes}</Text> : null}
                                            {exercise.workout_vimeo_id ? (
                                              <TouchableOpacity
                                                onPress={() => openLinkedWorkout(exercise)}
                                                style={styles.exerciseVideoButton}
                                                activeOpacity={0.85}
                                              >
                                                <Ionicons name="play-circle" size={15} color="#001311" />
                                                <Text style={styles.exerciseVideoButtonText}>
                                                  Watch {exercise.workout_title || `${exercise.name} Demo`}
                                                </Text>
                                              </TouchableOpacity>
                                            ) : null}
                                          </View>
                                        </View>
                                      ))}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.planText}>{thread.plan_text}</Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <FlatList
          data={thread?.messages || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              item={item}
              repliedMessage={item.reply_to_message_id ? messagesById.get(item.reply_to_message_id) : undefined}
              onReply={setReplyingTo}
              onEdit={(message) => {
                setEditingMessage(message);
                setReplyingTo(null);
                setInputText(message.content);
              }}
              onDelete={handleDelete}
              onReact={handleReact}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.progressButton, (!thread || thread.viewer_progress_days_completed >= thread.duration_days || sending || !canPostInChallenge) && styles.buttonDisabled]}
            onPress={shareProgress}
            disabled={!thread || thread.viewer_progress_days_completed >= thread.duration_days || sending || !canPostInChallenge}
          >
            <Ionicons name="checkmark-circle" size={16} color="#001311" />
            <Text style={styles.progressButtonText}>{nextDayLabel}</Text>
          </TouchableOpacity>
        </View>

        {replyingTo || editingMessage ? (
          <View style={styles.composerBanner}>
            <View style={styles.composerBannerTextWrap}>
              <Text style={styles.composerBannerTitle}>{editingMessage ? 'Editing message' : `Replying to ${replyingTo?.author_name}`}</Text>
              <Text style={styles.composerBannerText} numberOfLines={1}>
                {editingMessage?.content || replyingTo?.content || (replyingTo?.image_url ? 'Image' : '')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setReplyingTo(null); setEditingMessage(null); }} style={styles.composerBannerClose}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedImage?.uri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.previewRemove}>
              <Ionicons name="close-circle" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickImage} style={styles.attachButton} disabled={sending || Boolean(editingMessage) || !canPostInChallenge}>
            <Ionicons name="image-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder='Share progress or type "@Coach ..."'
              placeholderTextColor="rgba(255,255,255,0.38)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!sending && canPostInChallenge}
            />
          </View>
          <TouchableOpacity onPress={sendMessage} style={[styles.sendButton, (!canPostInChallenge || sending) && styles.buttonDisabled]} disabled={sending || !canPostInChallenge}>
            {sending ? <ActivityIndicator color="#001311" size="small" /> : <Ionicons name={editingMessage ? 'checkmark' : 'arrow-up'} size={18} color="#001311" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B14' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerBody: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  headerMeta: { color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroDescription: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  heroMetaRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  heroMeta: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    backgroundColor: 'rgba(0,240,208,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroMetaMuted: {
    color: '#F59E0B',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  statusNotice: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.16)',
    padding: 12,
  },
  statusNoticeText: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  planSection: { marginTop: 12 },
  planToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  planToggleText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  planCard: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },
  planDaysWrap: { gap: 12 },
  planDayCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0B1220',
    padding: 12,
    gap: 10,
  },
  planDayCardCompleted: {
    borderColor: 'rgba(34,197,94,0.28)',
    backgroundColor: '#0E1A16',
  },
  planDayHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  planDayHeaderText: { flex: 1 },
  planDayEyebrow: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  planDayTitle: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 2 },
  planDayFocus: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 4 },
  planDayNotes: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  planDayButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,240,208,0.24)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,240,208,0.08)',
  },
  planDayButtonCompleted: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  planDayButtonText: { color: Colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold' },
  planDayButtonTextCompleted: { color: '#001311' },
  planSectionsWrap: { gap: 10 },
  planSectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#111827',
    padding: 10,
    gap: 8,
  },
  planSectionCardCompleted: {
    borderColor: 'rgba(34,197,94,0.24)',
    backgroundColor: '#122019',
  },
  planSectionHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  planSectionTextWrap: { flex: 1 },
  planSectionTitle: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  planSectionDescription: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 2 },
  planSectionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,240,208,0.2)',
    backgroundColor: 'rgba(0,240,208,0.06)',
  },
  planSectionButtonCompleted: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  planSectionMeta: { color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' },
  planExercisesWrap: { gap: 8 },
  planExerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  planExerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  planExerciseTextWrap: { flex: 1 },
  planExerciseName: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  planExerciseDetails: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 1 },
  planExerciseNotes: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 2 },
  exerciseVideoButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exerciseVideoButtonText: {
    color: '#001311',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  planText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 },
  systemRow: { alignItems: 'center', marginVertical: 6 },
  systemText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  messageRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarCoach: { backgroundColor: 'rgba(6,182,212,0.18)' },
  avatarUser: { backgroundColor: 'rgba(168,85,247,0.18)' },
  avatarText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  messageContent: { flex: 1 },
  messageMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  authorName: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  coachBadge: {
    color: Colors.accentBlue,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    backgroundColor: 'rgba(6,182,212,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  progressBadge: {
    color: Colors.accentGold,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  editedBadge: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  deletedBadge: {
    color: '#FCA5A5',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  messageTime: { color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  coachBubble: { backgroundColor: '#0B1D2A', borderColor: 'rgba(6,182,212,0.25)' },
  userBubble: { backgroundColor: '#151A2D', borderColor: 'rgba(255,255,255,0.06)' },
  progressBubble: { backgroundColor: '#21170A', borderColor: 'rgba(245,158,11,0.22)' },
  messageText: { color: '#fff', fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  messageImage: { width: 220, height: 180, borderRadius: 12, marginTop: 10, backgroundColor: '#111827' },
  deletedText: { color: Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
    paddingLeft: 8,
    marginBottom: 8,
  },
  replyPreviewAuthor: { color: Colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold' },
  replyPreviewText: { color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  reactionsWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  reactionChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionChipActive: { borderColor: 'rgba(0,240,208,0.35)', backgroundColor: 'rgba(0,240,208,0.08)' },
  reactionChipText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_400Regular' },
  messageActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  iconAction: { paddingVertical: 4, paddingRight: 2 },
  quickReactionText: { fontSize: 15 },
  actionsRow: { paddingHorizontal: 16, paddingBottom: 10 },
  progressButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  progressButtonText: { color: '#001311', fontSize: 13, fontFamily: 'Inter_700Bold' },
  composerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  composerBannerTextWrap: { flex: 1 },
  composerBannerTitle: { color: Colors.primary, fontSize: 12, fontFamily: 'Inter_700Bold' },
  composerBannerText: { color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  composerBannerClose: { marginLeft: 10 },
  previewWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: 160, backgroundColor: '#111827' },
  previewRemove: { position: 'absolute', top: 8, right: 8 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 18 : 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#070B14',
  },
  attachButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,240,208,0.08)',
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#121A2A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
  },
  input: { color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular' },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
});
