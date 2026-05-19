import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { apiRequest, getAuthUser, resolveRemoteAssetUrl } from '../../lib/api';

const { width } = Dimensions.get('window');

const TABS = ['CHALLENGES', 'COMMUNITY'];

type ChallengeChat = {
  id: string;
  challenge_id: string;
  name: string;
  last_message: string;
  last_message_at: string | null;
  unread_count: number;
  avatar: string;
};

type ActiveChallenge = {
  id: string;
  challenge_id: string;
  title: string;
  type: string;
  days_left: number;
  total_days: number;
  progress: number;
  points: number;
  color: string;
};

type CompletedChallenge = {
  id: string;
  challenge_id: string;
  title: string;
  type: string;
  earned_points: number;
  completed_at: string;
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
  active_chats: ChallengeChat[];
  active_challenges: ActiveChallenge[];
  completed_challenges: CompletedChallenge[];
  ready_to_start: ReadyChallenge[];
};

// ── Community Posts ──
type CommunityPost = {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  author_profile_image: string;
  audience: string;
  content: string;
  image_url: string;
  like_count: number;
  comment_count: number;
  viewer_has_liked: boolean;
  can_delete: boolean;
  comments: CommunityComment[];
  reactions?: CommunityReactionUser[];
  created_at: string;
  updated_at: string;
};

type CommunityComment = {
  id: string;
  post_id: string;
  author_name: string;
  author_role: string;
  author_profile_image: string;
  content: string;
  created_at: string;
};

type CurrentCommunityUser = {
  name: string;
  profileImage: string;
};

type CommunityReactionUser = {
  user_id: string;
  user_name: string;
  user_role: string;
  user_profile_image: string;
  created_at: string;
};
function formatCommunityPostTime(value: string) {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return '';
  }

  const diffMs = Date.now() - createdAt.getTime();
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return createdAt.toLocaleDateString();
}

function getImageSource(url: string | null | undefined) {
  const resolvedUrl = resolveRemoteAssetUrl(url);
  return resolvedUrl ? { uri: resolvedUrl } : null;
}

function SkeletonBlock({
  width = '100%',
  height,
  style,
}: {
  width?: number | `${number}%` | '100%';
  height: number;
  style?: any;
}) {
  return <View style={[styles.skeletonBlock, { width, height }, style]} />;
}

function formatChallengeTime(value: string | null) {
  if (!value) {
    return '';
  }

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return '';
  }

  const diffMs = Date.now() - createdAt.getTime();
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);
  if (diffMinutes < 1) {
    return 'Now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return createdAt.toLocaleDateString();
}

function formatCompletedDate(value: string) {
  const completedAt = new Date(value);
  if (Number.isNaN(completedAt.getTime())) {
    return '';
  }

  return completedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDurationLabel(days: number) {
  return `${days} Day${days === 1 ? '' : 's'}`;
}

export default function ChallengesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tab?: string | string[];
    prefillSource?: string | string[];
    prefillChallengeId?: string | string[];
    prefillImageUri?: string | string[];
    prefillImageMimeType?: string | string[];
    prefillImageFileName?: string | string[];
    prefillStatus?: string | string[];
  }>();
  const [activeTab, setActiveTab] = useState('CHALLENGES');
  const [challengeOverview, setChallengeOverview] = useState<ChallengeOverview>({
    active_chats: [],
    active_challenges: [],
    completed_challenges: [],
    ready_to_start: [],
  });
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState('');
  const [challengeStarting, setChallengeStarting] = useState<Record<string, boolean>>({});
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityDraft, setCommunityDraft] = useState('');
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityPosting, setCommunityPosting] = useState(false);
  const [communityError, setCommunityError] = useState('');
  const [screenRefreshing, setScreenRefreshing] = useState(false);
  const [communityImage, setCommunityImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [reactionSubmitting, setReactionSubmitting] = useState<Record<string, boolean>>({});
  const [deleteSubmitting, setDeleteSubmitting] = useState<Record<string, boolean>>({});
  const [selectedCommunityPost, setSelectedCommunityPost] = useState<CommunityPost | null>(null);
  const [currentCommunityUser, setCurrentCommunityUser] = useState<CurrentCommunityUser>({
    name: 'You',
    profileImage: '',
  });
  const consumedCommunityPrefillKeyRef = useRef('');
  const readyToStartChallenges = challengeOverview.ready_to_start.filter((challenge) => challenge.can_start);
  const upcomingChallenges = challengeOverview.ready_to_start.filter((challenge) => !challenge.can_start);
  const hasActiveChats = challengeOverview.active_chats.length > 0;
  const hasActiveChallenges = challengeOverview.active_challenges.length > 0;
  const hasCompletedChallenges = challengeOverview.completed_challenges.length > 0;
  const hasReadyToStartChallenges = readyToStartChallenges.length > 0;
  const hasUpcomingChallenges = upcomingChallenges.length > 0;
  const hasVisibleChallengeSections =
    hasReadyToStartChallenges || hasUpcomingChallenges || hasActiveChats || hasActiveChallenges || hasCompletedChallenges;

  useEffect(() => {
    let isMounted = true;

    const loadCurrentCommunityUser = async () => {
      const authUser = await getAuthUser();
      if (!isMounted || !authUser) {
        return;
      }

      setCurrentCommunityUser({
        name: authUser.name || 'You',
        profileImage: authUser.profileImage || '',
      });
    };

    loadCurrentCommunityUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadChallengeOverview = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setChallengeLoading(true);
    }
    setChallengeError('');
    try {
      const response = await apiRequest<ChallengeOverview>('/challenges/overview');
      setChallengeOverview({
        active_chats: Array.isArray(response.active_chats) ? response.active_chats : [],
        active_challenges: Array.isArray(response.active_challenges) ? response.active_challenges : [],
        completed_challenges: Array.isArray(response.completed_challenges) ? response.completed_challenges : [],
        ready_to_start: Array.isArray(response.ready_to_start) ? response.ready_to_start : [],
      });
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : 'Failed to load challenges');
    } finally {
      if (showLoading) {
        setChallengeLoading(false);
      }
    }
  }, []);

  const loadCommunityPosts = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setCommunityLoading(true);
    }
    setCommunityError('');
    try {
      const response = await apiRequest<{ posts: CommunityPost[] }>('/community/posts');
      setCommunityPosts(Array.isArray(response.posts) ? response.posts : []);
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : 'Failed to load community posts');
    } finally {
      if (showLoading) {
        setCommunityLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'CHALLENGES') {
      return;
    }
    void loadChallengeOverview(true);
  }, [activeTab, loadChallengeOverview]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'CHALLENGES') {
        void loadChallengeOverview(false);
      }
      if (activeTab === 'COMMUNITY') {
        void loadCommunityPosts(false);
      }
    }, [activeTab, loadChallengeOverview, loadCommunityPosts])
  );

  useEffect(() => {
    if (activeTab !== 'COMMUNITY') {
      return;
    }
    void loadCommunityPosts(true);
  }, [activeTab, loadCommunityPosts]);

  useEffect(() => {
    const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (requestedTab === 'COMMUNITY' && activeTab !== 'COMMUNITY') {
      setActiveTab('COMMUNITY');
    }
  }, [activeTab, params.tab]);

  useEffect(() => {
    const source = Array.isArray(params.prefillSource) ? params.prefillSource[0] : params.prefillSource;
    const challengeId = Array.isArray(params.prefillChallengeId) ? params.prefillChallengeId[0] : params.prefillChallengeId;
    const imageUri = Array.isArray(params.prefillImageUri) ? params.prefillImageUri[0] : params.prefillImageUri;
    const mimeType = Array.isArray(params.prefillImageMimeType) ? params.prefillImageMimeType[0] : params.prefillImageMimeType;
    const fileName = Array.isArray(params.prefillImageFileName) ? params.prefillImageFileName[0] : params.prefillImageFileName;
    const prefillStatus = Array.isArray(params.prefillStatus) ? params.prefillStatus[0] : params.prefillStatus;

    if (!source || !imageUri) {
      return;
    }

    const prefillKey = `${source}:${challengeId || ''}:${imageUri}`;
    if (consumedCommunityPrefillKeyRef.current === prefillKey) {
      return;
    }

    let cancelled = false;
    consumedCommunityPrefillKeyRef.current = prefillKey;
    setActiveTab('COMMUNITY');

    const applyCommunityPrefill = async () => {
      try {
        const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (cancelled) {
          return;
        }

        setCommunityImage({
          uri: imageUri,
          base64: imageBase64,
          mimeType: mimeType || 'image/svg+xml',
          fileName: fileName || 'victory-fitness-progress-report.svg',
          width: 1080,
          height: 1920,
          type: 'image',
          assetId: null,
        } as unknown as ImagePicker.ImagePickerAsset);
        setCommunityDraft(prefillStatus || '');
        setCommunityError('');
      } catch (error) {
        if (cancelled) {
          return;
        }
        consumedCommunityPrefillKeyRef.current = '';
        setCommunityError(error instanceof Error ? error.message : 'Failed to attach the shared report image.');
      }
    };

    void applyCommunityPrefill();

    return () => {
      cancelled = true;
    };
  }, [
    params.prefillChallengeId,
    params.prefillImageFileName,
    params.prefillImageMimeType,
    params.prefillImageUri,
    params.prefillSource,
    params.prefillStatus,
  ]);

  const handleRefresh = useCallback(async () => {
    setScreenRefreshing(true);
    try {
      if (activeTab === 'COMMUNITY') {
        await loadCommunityPosts(false);
        return;
      }
      await loadChallengeOverview(false);
    } finally {
      setScreenRefreshing(false);
    }
  }, [activeTab, loadChallengeOverview, loadCommunityPosts]);

  const renderChallengeSkeleton = () => (
    <>
      <View style={styles.subSectionHeader}>
        <SkeletonBlock width={170} height={16} />
      </View>
      {[0, 1].map((item) => (
        <View key={`challenge-chat-skeleton-${item}`} style={styles.chatCard}>
          <View style={styles.chatAvatarWrap}>
            <SkeletonBlock width={44} height={44} style={styles.skeletonCircle} />
          </View>
          <View style={styles.chatContent}>
            <SkeletonBlock width="55%" height={14} style={styles.skeletonGapSm} />
            <SkeletonBlock width="85%" height={12} />
          </View>
          <View style={styles.chatRight}>
            <SkeletonBlock width={38} height={12} />
          </View>
        </View>
      ))}

      <View style={[styles.subSectionHeader, { marginTop: 24 }]}>
        <SkeletonBlock width={180} height={16} />
      </View>
      {[0, 1].map((item) => (
        <View key={`challenge-card-skeleton-${item}`} style={styles.activeCard}>
          <View style={styles.activeCardTop}>
            <SkeletonBlock width={12} height={12} style={styles.skeletonCircle} />
            <SkeletonBlock width="50%" height={15} />
            <SkeletonBlock width={56} height={22} style={styles.skeletonBadge} />
          </View>
          <View style={styles.activeProgressRow}>
            <SkeletonBlock width="72%" height={8} style={styles.skeletonRounded} />
            <SkeletonBlock width={64} height={12} />
          </View>
          <View style={styles.activeCardMeta}>
            <SkeletonBlock width={80} height={12} />
            <SkeletonBlock width={74} height={12} />
          </View>
        </View>
      ))}

      <View style={[styles.subSectionHeader, { marginTop: 24 }]}>
        <SkeletonBlock width={150} height={16} />
      </View>
      {[0, 1].map((item) => (
        <View key={`challenge-ready-skeleton-${item}`} style={styles.readyCard}>
          <View style={styles.readyCardTop}>
            <SkeletonBlock width="58%" height={16} />
            <SkeletonBlock width={60} height={20} style={styles.skeletonBadge} />
          </View>
          <SkeletonBlock width="92%" height={12} style={styles.skeletonGapSm} />
          <SkeletonBlock width="68%" height={12} style={styles.skeletonGapMd} />
          <View style={styles.readyMeta}>
            <SkeletonBlock width={72} height={12} />
            <SkeletonBlock width={72} height={12} />
            <SkeletonBlock width={72} height={12} />
          </View>
          <SkeletonBlock width="100%" height={44} style={styles.skeletonButton} />
        </View>
      ))}
    </>
  );

  const renderCommunitySkeleton = () => (
    <>
      {[0, 1, 2].map((item) => (
        <View key={`community-post-skeleton-${item}`} style={styles.postCard}>
          <View style={styles.postHeader}>
            <SkeletonBlock width={46} height={46} style={styles.skeletonCircle} />
            <View style={styles.postMeta}>
              <View style={styles.postMetaRow}>
                <SkeletonBlock width={120} height={14} />
                <SkeletonBlock width={56} height={12} />
                <SkeletonBlock width={54} height={20} style={styles.skeletonBadge} />
              </View>
            </View>
          </View>
          <SkeletonBlock width="100%" height={12} style={styles.skeletonGapSm} />
          <SkeletonBlock width="88%" height={12} style={styles.skeletonGapSm} />
          <SkeletonBlock width="76%" height={12} style={styles.skeletonGapMd} />
          <SkeletonBlock width="100%" height={180} style={styles.skeletonImage} />
          <View style={styles.postFooter}>
            <SkeletonBlock width={56} height={16} />
            <SkeletonBlock width={56} height={16} />
          </View>
        </View>
      ))}
    </>
  );

  const handleCommunityPost = async () => {
    const content = communityDraft.trim();
    if (!content && !communityImage?.base64) {
      setCommunityError('Add a status or choose an image before posting.');
      return;
    }

    setCommunityPosting(true);
    setCommunityError('');
    try {
      const response = await apiRequest<CommunityPost>('/community/posts', {
        method: 'POST',
        body: {
          content: content || '',
          image_base64: communityImage?.base64 ?? undefined,
          mime_type: communityImage?.mimeType ?? 'image/jpeg',
          file_name: communityImage?.fileName ?? null,
        },
      });
      setCommunityDraft('');
      setCommunityImage(null);
      setCommunityPosts((current) => [response, ...current]);
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : 'Failed to publish post');
    } finally {
      setCommunityPosting(false);
    }
  };

  const handlePickCommunityImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to add an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
        base64: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        throw new Error('The selected image could not be processed for upload.');
      }

      setCommunityImage(asset);
      setCommunityError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to choose an image right now.';
      Alert.alert('Image unavailable', message);
    }
  };

  const updatePostInState = (postId: string, updater: (post: CommunityPost) => CommunityPost) => {
    setCommunityPosts((current) => current.map((post) => (post.id === postId ? updater(post) : post)));
    setSelectedCommunityPost((current) => {
      if (!current || current.id !== postId) {
        return current;
      }
      return updater(current);
    });
  };

  const handleToggleReaction = async (postId: string) => {
    if (reactionSubmitting[postId]) {
      return;
    }

    let previousLikeCount = 0;
    let previousViewerHasLiked = false;
    updatePostInState(postId, (post) => {
      previousLikeCount = post.like_count;
      previousViewerHasLiked = post.viewer_has_liked;
      const nextViewerHasLiked = !post.viewer_has_liked;
      return {
        ...post,
        viewer_has_liked: nextViewerHasLiked,
        like_count: Math.max(0, post.like_count + (nextViewerHasLiked ? 1 : -1)),
      };
    });

    setReactionSubmitting((current) => ({ ...current, [postId]: true }));
    try {
      const response = await apiRequest<{ post_id: string; like_count: number; viewer_has_liked: boolean }>(
        `/community/posts/${encodeURIComponent(postId)}/reactions/toggle`,
        { method: 'POST' }
      );
      updatePostInState(postId, (post) => ({
        ...post,
        like_count: response.like_count,
        viewer_has_liked: response.viewer_has_liked,
      }));
    } catch (error) {
      updatePostInState(postId, (post) => ({
        ...post,
        like_count: previousLikeCount,
        viewer_has_liked: previousViewerHasLiked,
      }));
      setCommunityError(error instanceof Error ? error.message : 'Failed to update reaction');
    } finally {
      setReactionSubmitting((current) => ({ ...current, [postId]: false }));
    }
  };

  const handleSubmitComment = async (postId: string) => {
    const content = (commentDrafts[postId] || '').trim();
    if (!content || commentSubmitting[postId]) {
      return;
    }

    const optimisticComment: CommunityComment = {
      id: `temp-${Date.now()}`,
      post_id: postId,
      author_name: currentCommunityUser.name,
      author_role: 'user',
      author_profile_image: currentCommunityUser.profileImage,
      content,
      created_at: new Date().toISOString(),
    };

    setCommentDrafts((current) => ({ ...current, [postId]: '' }));
    setExpandedComments((current) => ({ ...current, [postId]: true }));
    updatePostInState(postId, (post) => {
      const nextComments = [...(post.comments || []), optimisticComment];
      return {
        ...post,
        comment_count: post.comment_count + 1,
        comments: nextComments.slice(-3),
      };
    });

    setCommentSubmitting((current) => ({ ...current, [postId]: true }));
    try {
      const response = await apiRequest<CommunityComment>(`/community/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        body: { content },
      });
      updatePostInState(postId, (post) => ({
        ...post,
        comments: (post.comments || []).map((comment) => (comment.id === optimisticComment.id ? response : comment)),
      }));
    } catch (error) {
      setCommentDrafts((current) => ({ ...current, [postId]: content }));
      updatePostInState(postId, (post) => ({
        ...post,
        comment_count: Math.max(0, post.comment_count - 1),
        comments: (post.comments || []).filter((comment) => comment.id !== optimisticComment.id),
      }));
      setCommunityError(error instanceof Error ? error.message : 'Failed to add comment');
    } finally {
      setCommentSubmitting((current) => ({ ...current, [postId]: false }));
    }
  };

  const handleStartChallenge = async (challenge: ReadyChallenge) => {
    if (challengeStarting[challenge.id]) {
      return;
    }

    setChallengeStarting((current) => ({ ...current, [challenge.id]: true }));
    setChallengeError('');
    try {
      await apiRequest(`/challenges/${encodeURIComponent(challenge.id)}/start`, {
        method: 'POST',
      });

      setChallengeOverview((current) => ({
        active_chats: [
          {
            id: `chat-${challenge.id}`,
            challenge_id: challenge.id,
            name: challenge.title,
            last_message: 'Coach: Welcome to the challenge.',
            last_message_at: new Date().toISOString(),
            unread_count: 0,
            avatar: challenge.thumbnail,
          },
          ...current.active_chats.filter((item) => item.challenge_id !== challenge.id),
        ],
        active_challenges: [
          {
            id: challenge.id,
            challenge_id: challenge.id,
            title: challenge.title,
            type: challenge.type,
            days_left: challenge.duration_days,
            total_days: challenge.duration_days,
            progress: 0,
            points: challenge.points,
            color: challenge.difficulty_color || Colors.primary,
          },
          ...current.active_challenges.filter((item) => item.challenge_id !== challenge.id),
        ],
        completed_challenges: current.completed_challenges,
        ready_to_start: current.ready_to_start.filter((item) => item.id !== challenge.id),
      }));
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : 'Failed to start challenge');
    } finally {
      setChallengeStarting((current) => ({ ...current, [challenge.id]: false }));
    }
  };

  const performDeleteCommunityPost = async (postId: string) => {
    if (deleteSubmitting[postId]) {
      return;
    }

    setDeleteSubmitting((current) => ({ ...current, [postId]: true }));
    setCommunityError('');
    try {
      await apiRequest(`/community/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
      });
      setCommunityPosts((current) => current.filter((post) => post.id !== postId));
      setSelectedCommunityPost((current) => (current?.id === postId ? null : current));
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : 'Failed to delete post');
    } finally {
      setDeleteSubmitting((current) => ({ ...current, [postId]: false }));
    }
  };

  const handleDeleteCommunityPost = (postId: string) => {
    if (deleteSubmitting[postId]) {
      return;
    }

    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void performDeleteCommunityPost(postId);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={screenRefreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >

        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandTitle}>V I C T O R Y</Text>
          <Text style={styles.brandSubtitle}>F I T N E S S</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── CHALLENGES TAB ── */}
        {activeTab === 'CHALLENGES' && (
          <View style={styles.section}>
            {challengeError ? (
              <View style={styles.challengeStatusCard}>
                <Text style={styles.challengeStatusText}>{challengeError}</Text>
              </View>
            ) : null}
            {challengeLoading ? renderChallengeSkeleton() : null}

            {/* ─ Active Challenge Chats ─ */}
            {hasActiveChats ? (
              <>
                <View style={styles.subSectionHeader}>
                  <Ionicons name="chatbubbles" size={16} color={Colors.primary} />
                  <Text style={styles.subSectionTitle}>Challenge Chats</Text>
                </View>
                {challengeOverview.active_chats.map((chat) => (
                  <TouchableOpacity
                    key={chat.id}
                    style={styles.chatCard}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/challenges/chat/${chat.challenge_id}` as any)}
                  >
                    <View style={styles.chatAvatarWrap}>
                      {chat.avatar ? (
                        <Image source={{ uri: chat.avatar }} style={styles.chatAvatarImage} />
                      ) : (
                        <Text style={styles.chatAvatarEmoji}>{(chat.name || 'C')[0]}</Text>
                      )}
                    </View>
                    <View style={styles.chatContent}>
                      <Text style={styles.chatName}>{chat.name}</Text>
                      <Text style={styles.chatLastMsg} numberOfLines={1}>{chat.last_message}</Text>
                    </View>
                    <View style={styles.chatRight}>
                      <Text style={styles.chatTime}>{formatChallengeTime(chat.last_message_at)}</Text>
                      {chat.unread_count > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{chat.unread_count}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}

            {/* ─ Your Active Challenges ─ */}
            {hasActiveChallenges ? (
              <>
                <View
                  style={[
                    styles.subSectionHeader,
                    hasActiveChats || hasActiveChallenges || hasCompletedChallenges ? { marginTop: 24 } : null,
                  ]}
                >
                  <Ionicons name="flash" size={16} color={Colors.primary} />
                  <Text style={styles.subSectionTitle}>Your Active Challenges</Text>
                </View>
                {challengeOverview.active_challenges.map((ch) => (
                  <TouchableOpacity
                    key={ch.id}
                    style={styles.activeCard}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/challenges/progress/${ch.challenge_id}` as any)}
                  >
                    <View style={styles.activeCardTop}>
                      <View style={[styles.activeColorDot, { backgroundColor: ch.color }]} />
                      <Text style={styles.activeCardTitle}>{ch.title}</Text>
                      <View style={styles.activePointsBadge}>
                        <Ionicons name="star" size={11} color="#F59E0B" />
                        <Text style={styles.activePointsText}>+{ch.points}</Text>
                      </View>
                    </View>
                    <View style={styles.activeProgressRow}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${ch.progress * 100}%` as any, backgroundColor: ch.color }]} />
                      </View>
                      <Text style={styles.progressLabel}>
                        {Math.round(ch.progress * 100)}%
                      </Text>
                    </View>
                    <View style={styles.activeCardMeta}>
                      <Text style={styles.activeMetaText}>{ch.type}</Text>
                      <Text style={[styles.daysLeftText, { color: ch.days_left <= 2 ? '#EF4444' : Colors.textMuted }]}>
                        {ch.days_left} days left
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}

            {/* ─ Completed ─ */}
            {hasCompletedChallenges ? (
              <>
                <View style={[styles.subSectionHeader, { marginTop: 24 }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text style={[styles.subSectionTitle, { color: '#22C55E' }]}>Completed</Text>
                </View>
                {challengeOverview.completed_challenges.map((ch) => (
              <View key={ch.id} style={styles.completedCard}>
                <View style={[styles.completedIcon, { backgroundColor: `${ch.color}22` }]}>
                  <Ionicons name="trophy" size={20} color={ch.color} />
                </View>
                <View style={styles.completedInfo}>
                  <Text style={styles.completedTitle}>{ch.title}</Text>
                  <Text style={styles.completedMeta}>{ch.type} · {formatCompletedDate(ch.completed_at)}</Text>
                </View>
                <View style={styles.completedPts}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.completedPtsText}>+{ch.earned_points} Pts</Text>
                </View>
              </View>
            ))}
              </>
            ) : null}

            {/* ─ Ready to Start ─ */}
            {hasReadyToStartChallenges ? (
              <>
                <View style={[styles.subSectionHeader, { marginTop: 24 }]}>
                  <Ionicons name="rocket" size={16} color="#4F8EF7" />
                  <Text style={[styles.subSectionTitle, { color: '#4F8EF7' }]}>Ready to Start</Text>
                </View>
                {readyToStartChallenges.map((ch) => (
                  <View key={ch.id} style={styles.readyCard}>
                    <View style={styles.readyCardTop}>
                      <Text style={styles.readyTitle}>{ch.title}</Text>
                      <View style={[styles.difficultyBadge, { backgroundColor: `${ch.difficulty_color}22` }]}>
                        <Text style={[styles.difficultyText, { color: ch.difficulty_color }]}>{ch.difficulty}</Text>
                      </View>
                    </View>
                    <Text style={styles.readyDesc} numberOfLines={2}>{ch.description}</Text>
                    <View style={styles.readyMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.metaText}>{formatDurationLabel(ch.duration_days)}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.metaText}>{ch.participants} joined</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={[styles.metaText, { color: '#F59E0B' }]}>+{ch.points} Pts</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.startBtn,
                        (challengeStarting[ch.id] || !ch.can_start) && { opacity: 0.55 },
                      ]}
                      activeOpacity={0.85}
                      onPress={() => handleStartChallenge(ch)}
                      disabled={challengeStarting[ch.id] || !ch.can_start}
                    >
                      {challengeStarting[ch.id] ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <>
                          <Text style={styles.startBtnText}>START CHALLENGE</Text>
                          <Ionicons name="arrow-forward" size={14} color="#000" />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            ) : null}

            {hasUpcomingChallenges ? (
              <>
                <View style={[styles.subSectionHeader, { marginTop: 24 }]}>
                  <Ionicons name="time-outline" size={16} color="#A78BFA" />
                  <Text style={[styles.subSectionTitle, { color: '#A78BFA' }]}>Upcoming Challenges</Text>
                </View>
                {upcomingChallenges.map((ch) => (
                  <View key={ch.id} style={[styles.readyCard, styles.upcomingCard]}>
                    <View style={styles.readyCardTop}>
                      <Text style={styles.readyTitle}>{ch.title}</Text>
                      <View style={[styles.difficultyBadge, styles.upcomingDifficultyBadge, { backgroundColor: `${ch.difficulty_color}22` }]}>
                        <Text style={[styles.difficultyText, { color: ch.difficulty_color }]}>{ch.difficulty}</Text>
                      </View>
                    </View>
                    <Text style={styles.readyDesc} numberOfLines={2}>{ch.description}</Text>
                    <View style={styles.upcomingNoticeRow}>
                      <Ionicons name="lock-closed-outline" size={13} color="#C4B5FD" />
                      <Text style={styles.upcomingNoticeText}>Locked until the admin changes the status to ACTIVE.</Text>
                    </View>
                    <View style={styles.readyMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.metaText}>{formatDurationLabel(ch.duration_days)}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.metaText}>{ch.participants} joined</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={[styles.metaText, { color: '#F59E0B' }]}>+{ch.points} Pts</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.startBtn, styles.upcomingStartBtn]}
                      activeOpacity={1}
                      disabled
                    >
                      <Ionicons name="lock-closed-outline" size={14} color="#C4B5FD" />
                      <Text style={[styles.startBtnText, styles.upcomingStartBtnText]}>COMING SOON</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            ) : null}
            {!challengeLoading && !hasVisibleChallengeSections ? (
              <View style={styles.challengeEmptyCard}>
                <Text style={styles.challengeEmptyText}>No challenges available right now.</Text>
              </View>
            ) : null}

          </View>
        )}


        {/* ── COMMUNITY TAB ── */}
        {activeTab === 'COMMUNITY' && (
          <View style={styles.section}>

            {/* Post Composer */}
            <View style={styles.composerCard}>
              <TextInput
                style={styles.composerInput}
                placeholder="What's on your mind?"
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                value={communityDraft}
                onChangeText={setCommunityDraft}
              />
              <View style={styles.composerDivider} />
              <View style={styles.composerActions}>
                <TouchableOpacity style={styles.composerImgBtn} onPress={handlePickCommunityImage}>
                  <Ionicons name="image-outline" size={22} color={communityImage ? Colors.primary : 'rgba(255,255,255,0.45)'} />
                </TouchableOpacity>

                {/* Tier Dropdown */}
                {/* <View style={styles.tierDropdownWrapper}>
                  <TouchableOpacity
                    style={styles.tierSelector}
                    onPress={() => setTierDropdownOpen(!tierDropdownOpen)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tierText}>{selectedTier}</Text>
                    <Ionicons
                      name={tierDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={13}
                      color="rgba(255,255,255,0.6)"
                    />
                  </TouchableOpacity>
                  {tierDropdownOpen && (
                    <View style={styles.tierDropdown}>
                      {TIERS.map((tier) => (
                        <TouchableOpacity
                          key={tier}
                          style={[
                            styles.tierOption,
                            selectedTier === tier && styles.tierOptionActive,
                          ]}
                          onPress={() => {
                            setSelectedTier(tier);
                            setTierDropdownOpen(false);
                          }}
                        >
                          <Text style={[
                            styles.tierOptionText,
                            selectedTier === tier && styles.tierOptionTextActive,
                          ]}>
                            {tier}
                          </Text>
                          {selectedTier === tier && (
                            <Ionicons name="checkmark" size={14} color={Colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View> */}

                <TouchableOpacity
                  style={[styles.postBtn, communityPosting && { opacity: 0.7 }]}
                  onPress={handleCommunityPost}
                  disabled={communityPosting}
                >
                  {communityPosting ? <ActivityIndicator size="small" color="#0A0A14" /> : <Text style={styles.postBtnText}>Post</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {communityImage?.uri ? (
              <View style={styles.communityPreviewCard}>
                <Image source={{ uri: communityImage.uri }} style={styles.communityPreviewImage} />
                <TouchableOpacity onPress={() => setCommunityImage(null)} style={styles.communityPreviewRemove}>
                  <Text style={styles.communityPreviewRemoveText}>Remove image</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {communityError ? (
              <View style={styles.communityErrorCard}>
                <Text style={styles.communityErrorText}>{communityError}</Text>
              </View>
            ) : null}
            {communityLoading ? renderCommunitySkeleton() : null}

            {/* Community Posts */}
            {!communityLoading && communityPosts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <TouchableOpacity activeOpacity={0.92} onPress={() => setSelectedCommunityPost(post)}>
                  <View style={styles.postHeader}>
                    {getImageSource(post.author_profile_image) ? (
                      <Image source={getImageSource(post.author_profile_image)!} style={styles.postAvatarImage} />
                    ) : (
                      <View style={styles.postAvatar}>
                        <Text style={styles.postAvatarText}>{(post.author_name || 'U')[0]}</Text>
                      </View>
                    )}
                    <View style={styles.postMeta}>
                      <View style={styles.postMetaRow}>
                        <Text style={styles.postAuthor}>{post.author_name}</Text>
                        <Text style={styles.postTime}>{formatCommunityPostTime(post.created_at)}</Text>
                        <View style={[styles.tierBadge, { backgroundColor: post.audience === 'ALL' ? '#22C55E' : '#A855F7' }]}>
                          <Text style={styles.tierBadgeText}>{post.audience}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {post.content ? <Text style={styles.postBody}>{post.content}</Text> : null}
                  {getImageSource(post.image_url) ? (
                    <Image source={getImageSource(post.image_url)!} style={styles.postImagePreview} />
                  ) : null}
                </TouchableOpacity>

                {/* Post Footer */}
                <View style={styles.postFooter}>
                  <TouchableOpacity
                    style={styles.postAction}
                    onPress={() => handleToggleReaction(post.id)}
                    disabled={reactionSubmitting[post.id]}
                  >
                    <Ionicons
                      name={post.viewer_has_liked ? 'heart' : 'heart-outline'}
                      size={16}
                      color={post.viewer_has_liked ? '#F87171' : 'rgba(255,255,255,0.5)'}
                    />
                    <Text style={[styles.postActionText, post.viewer_has_liked && styles.postActionTextActive]}>{post.like_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.postAction}
                    onPress={() =>
                      setExpandedComments((current) => ({
                        ...current,
                        [post.id]: !current[post.id],
                      }))
                    }
                  >
                    <Ionicons name="chatbubble-outline" size={16} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.postActionText}>{post.comment_count}</Text>
                  </TouchableOpacity>
                  {post.can_delete ? (
                    <TouchableOpacity
                      style={styles.postDeleteAction}
                      onPress={() => handleDeleteCommunityPost(post.id)}
                      disabled={deleteSubmitting[post.id]}
                      accessibilityLabel={deleteSubmitting[post.id] ? 'Deleting post' : 'Delete post'}
                    >
                      {deleteSubmitting[post.id] ? (
                        <ActivityIndicator size="small" color="#F87171" />
                      ) : (
                        <Ionicons name="trash-outline" size={16} color="rgba(248,113,113,0.9)" />
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>

                {(expandedComments[post.id] || (post.comments?.length ?? 0) > 0) ? (
                  <View style={styles.commentsWrap}>
                    {(post.comments || []).map((comment) => (
                      <View key={comment.id} style={styles.commentRow}>
                        {getImageSource(comment.author_profile_image) ? (
                          <Image source={getImageSource(comment.author_profile_image)!} style={styles.commentAvatarImage} />
                        ) : (
                          <View style={styles.commentAvatar}>
                            <Text style={styles.commentAvatarText}>{(comment.author_name || 'U')[0]}</Text>
                          </View>
                        )}
                        <View style={styles.commentBubble}>
                          <View style={styles.commentMetaRow}>
                            <Text style={styles.commentAuthor}>{comment.author_name}</Text>
                            <Text style={styles.commentTime}>{formatCommunityPostTime(comment.created_at)}</Text>
                          </View>
                          <Text style={styles.commentContent}>{comment.content}</Text>
                        </View>
                      </View>
                    ))}

                    <View style={styles.commentComposer}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Write a comment..."
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={commentDrafts[post.id] || ''}
                        onChangeText={(text) => setCommentDrafts((current) => ({ ...current, [post.id]: text }))}
                      />
                      <TouchableOpacity
                        style={[styles.commentSendBtn, commentSubmitting[post.id] && { opacity: 0.7 }]}
                        onPress={() => handleSubmitComment(post.id)}
                        disabled={commentSubmitting[post.id]}
                      >
                        {commentSubmitting[post.id] ? (
                          <ActivityIndicator size="small" color="#0A0A14" />
                        ) : (
                          <Text style={styles.commentSendText}>Send</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            ))}

          </View>
        )}

      </ScrollView>

      <Modal
        visible={selectedCommunityPost !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCommunityPost(null)}
      >
        <View style={styles.postModalOverlay}>
          <View style={styles.postModalCard}>
            <TouchableOpacity style={styles.postModalClose} onPress={() => setSelectedCommunityPost(null)}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            {selectedCommunityPost ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.postHeader}>
                  {getImageSource(selectedCommunityPost.author_profile_image) ? (
                    <Image source={getImageSource(selectedCommunityPost.author_profile_image)!} style={styles.postAvatarImage} />
                  ) : (
                    <View style={styles.postAvatar}>
                      <Text style={styles.postAvatarText}>{(selectedCommunityPost.author_name || 'U')[0]}</Text>
                    </View>
                  )}
                  <View style={styles.postMeta}>
                    <View style={styles.postMetaRow}>
                      <Text style={styles.postAuthor}>{selectedCommunityPost.author_name}</Text>
                      <Text style={styles.postTime}>{formatCommunityPostTime(selectedCommunityPost.created_at)}</Text>
                    </View>
                    <View style={[styles.modalTierBadge, { backgroundColor: selectedCommunityPost.audience === 'ALL' ? '#22C55E' : '#A855F7' }]}>
                      <Text style={styles.tierBadgeText}>{selectedCommunityPost.audience}</Text>
                    </View>
                  </View>
                </View>

                {selectedCommunityPost.content ? <Text style={styles.postModalBody}>{selectedCommunityPost.content}</Text> : null}

                {getImageSource(selectedCommunityPost.image_url) ? (
                  <Image source={getImageSource(selectedCommunityPost.image_url)!} style={styles.postModalImage} />
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },

  /* Brand Header */
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 8,
    fontFamily: 'Inter_700Bold',
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 6,
    marginTop: 4,
    fontFamily: 'Inter_600SemiBold',
  },

  /* Page Title */
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 3,
    fontFamily: 'Inter_700Bold',
  },
  pageSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  inviteBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },
  tabTextActive: {
    color: '#000',
  },

  /* Shared */
  section: {
    paddingHorizontal: 16,
  },

  /* Sub-section Header */
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },
  challengeStatusCard: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  challengeStatusText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  challengeLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  challengeLoadingText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  skeletonBlock: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
  skeletonCircle: {
    borderRadius: 999,
  },
  skeletonRounded: {
    borderRadius: 999,
  },
  skeletonBadge: {
    borderRadius: 8,
  },
  skeletonGapSm: {
    marginBottom: 8,
  },
  skeletonGapMd: {
    marginBottom: 14,
  },
  skeletonButton: {
    borderRadius: 12,
  },
  skeletonImage: {
    borderRadius: 16,
    marginBottom: 12,
  },
  challengeEmptyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  challengeEmptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },

  /* Active Challenge Chats */
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  chatAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,240,208,0.1)',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatAvatarEmoji: {
    fontSize: 22,
    color: '#fff',
    fontFamily: 'Inter_700Bold',
  },
  chatAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  chatContent: {
    flex: 1,
  },
  chatName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginBottom: 3,
  },
  chatLastMsg: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  chatRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  chatTime: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },

  /* Your Active Challenges */
  activeCard: {
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  activeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  activeColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeCardTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  activePointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activePointsText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  activeProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
    minWidth: 50,
    textAlign: 'right',
  },
  activeCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activeMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  daysLeftText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  /* Completed */
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    gap: 12,
  },
  completedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedInfo: {
    flex: 1,
  },
  completedTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginBottom: 3,
  },
  completedMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  completedPts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedPtsText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  /* Ready to Start */
  readyCard: {
    backgroundColor: '#13132A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(79,142,247,0.2)',
  },
  upcomingCard: {
    backgroundColor: '#161433',
    borderColor: 'rgba(167,139,250,0.28)',
  },
  readyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  readyTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  readyDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
    marginBottom: 12,
  },
  readyMeta: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  upcomingDifficultyBadge: {
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.16)',
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  upcomingStartBtn: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  upcomingStartBtnText: {
    color: '#C4B5FD',
  },
  upcomingNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.14)',
  },
  upcomingNoticeText: {
    flex: 1,
    color: '#C4B5FD',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
  },


  /* Community */
  communityBanner: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  communityBannerCount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    marginTop: 8,
  },
  communityBannerLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  communityInviteBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  communityInviteBtnText: {
    color: '#3730A3',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13132A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  feedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedAvatarText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },
  feedContent: {
    flex: 1,
  },
  feedText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  feedUser: {
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  feedTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
    fontFamily: 'Inter_400Regular',
  },
  feedPts: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  feedPtsText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  /* Community Composer */
  composerCard: {
    backgroundColor: '#13132A',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  searchInput: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 12,
    outlineStyle: 'none' as any,
  },
  composerInput: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    padding: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  composerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 0,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  composerImgBtn: {
    padding: 6,
  },
  tierSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tierText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  postBtn: {
    marginLeft: 'auto',
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 10,
  },
  postBtnText: {
    color: '#0A0A14',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  communityErrorCard: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    padding: 12,
    marginBottom: 12,
  },
  communityErrorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  communityLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  communityLoadingText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  communityPreviewCard: {
    backgroundColor: '#13132A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    marginBottom: 12,
  },
  communityPreviewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    resizeMode: 'cover',
    marginBottom: 10,
  },
  communityPreviewRemove: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  communityPreviewRemoveText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },

  /* Post Card */
  postCard: {
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAvatarText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },
  postMeta: {
    flex: 1,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  postAuthor: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  postTime: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  postBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    marginBottom: 14,
  },
  postImagePreview: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    resizeMode: 'cover',
    marginBottom: 14,
  },
  postFooter: {
    flexDirection: 'row',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postDeleteAction: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postActionText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  postActionTextActive: {
    color: '#FCA5A5',
  },
  postModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 32,
  },
  postModalCard: {
    backgroundColor: '#13132A',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '88%',
  },
  postModalClose: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  modalTierBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  postModalBody: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  postModalImage: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  commentsWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  commentBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  commentAuthor: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  commentTime: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  commentContent: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    outlineStyle: 'none' as any,
  },
  commentSendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 66,
  },
  commentSendText: {
    color: '#000',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },

  /* Tier Dropdown */
  tierDropdownWrapper: {
    position: 'relative',
  },
  tierDropdown: {
    position: 'absolute',
    top: 40,
    left: 0,
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 999,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  tierOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tierOptionActive: {
    backgroundColor: 'rgba(0,240,208,0.08)',
  },
  tierOptionText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  tierOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
