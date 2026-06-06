import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import AccessRestrictionModal from '../../components/AccessRestrictionModal';
import { apiRequest, fetchCurrentUser, getAuthUser, resolveRemoteAssetUrl } from '../../lib/api';
import { canAccessFeature, normalizeSubscriptionTier } from '../../lib/access';
import { useLanguage } from '../../lib/i18n';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';
import { replaceRoute } from '../../lib/navigation';

const { width } = Dimensions.get('window');

const CHALLENGE_TABS = [
  { id: 'CHALLENGES', labelKey: 'CHALLENGES', restrictedSectionKey: 'Challenges' },
  { id: 'COMMUNITY', labelKey: 'COMMUNITY', restrictedSectionKey: 'Community' },
] as const;
const COMMUNITY_AUDIENCE_FILTERS = ['ALL', 'SILVER', 'GOLD', 'PLATINUM', 'INNER_CIRCLE'] as const;
const CHALLENGE_DURATION_ORDER = [3, 5, 7, 14, 21];
const CHALLENGE_FILTER_ALL = 'ALL';

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
  description: string;
  type: string;
  duration_days: number;
  days_left: number;
  total_days: number;
  progress: number;
  points: number;
  participants: number;
  thumbnail: string;
  color: string;
};

type CompletedChallenge = {
  id: string;
  challenge_id: string;
  title: string;
  description: string;
  duration_days: number;
  type: string;
  earned_points: number;
  participants: number;
  thumbnail: string;
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

type ChallengeLibraryItem =
  | ({ state: 'ACTIVE' } & ActiveChallenge)
  | ({ state: 'COMPLETED' } & CompletedChallenge)
  | ({ state: 'READY' | 'UPCOMING' } & ReadyChallenge);

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
function formatCommunityPostTime(value: string, t: (key: string, params?: Record<string, string | number>) => string) {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return '';
  }

  const diffMs = Date.now() - createdAt.getTime();
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);
  if (diffMinutes < 1) {
    return t('Just now');
  }
  if (diffMinutes < 60) {
    return t('{count}m ago', { count: diffMinutes });
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return t('{count}h ago', { count: diffHours });
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return t('{count}d ago', { count: diffDays });
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

function formatChallengeTime(value: string | null, t: (key: string, params?: Record<string, string | number>) => string) {
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
    return t('Now');
  }
  if (diffMinutes < 60) {
    return t('{count}m ago', { count: diffMinutes });
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return t('{count}h ago', { count: diffHours });
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return t('{count}d ago', { count: diffDays });
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

function formatDurationLabel(days: number, t: (key: string) => string) {
  return `${days} ${days === 1 ? t('Day') : t('Days')}`;
}

function formatChallengeFilterLabel(value: number | typeof CHALLENGE_FILTER_ALL, t: (key: string) => string) {
  return value === CHALLENGE_FILTER_ALL ? t('All') : formatDurationLabel(value, t);
}

export default function ChallengesScreen() {
  const checkingAccess = useModuleAccessGuard('/challenge');
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{
    tab?: string | string[];
    prefillSource?: string | string[];
    prefillChallengeId?: string | string[];
    prefillImageUri?: string | string[];
    prefillImageMimeType?: string | string[];
    prefillImageFileName?: string | string[];
    prefillStatus?: string | string[];
  }>();
  const challengeTabs = useMemo(
    () =>
      CHALLENGE_TABS.map((tab) => ({
        ...tab,
        label: t(tab.labelKey),
        restrictedSection: t(tab.restrictedSectionKey),
      })),
    [t]
  );
  const [activeTab, setActiveTab] = useState('CHALLENGES');
  const [canAccessChallenges, setCanAccessChallenges] = useState(true);
  const [canAccessCommunity, setCanAccessCommunity] = useState(true);
  const [challengeOverview, setChallengeOverview] = useState<ChallengeOverview>({
    active_chats: [],
    active_challenges: [],
    completed_challenges: [],
    ready_to_start: [],
  });
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState('');
  const [challengeStarting, setChallengeStarting] = useState<Record<string, boolean>>({});
  const [challengeDayCompleting, setChallengeDayCompleting] = useState<Record<string, boolean>>({});
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
    name: t('You'),
    profileImage: '',
  });
  const [subscriptionTier, setSubscriptionTier] = useState('NONE');
  const [isCommunityAdmin, setIsCommunityAdmin] = useState(false);
  const [selectedCommunityFilter, setSelectedCommunityFilter] = useState<(typeof COMMUNITY_AUDIENCE_FILTERS)[number]>('ALL');
  const [communityFilterPickerOpen, setCommunityFilterPickerOpen] = useState(false);

  const [restrictedSection, setRestrictedSection] = useState('');
  const [selectedDurationDays, setSelectedDurationDays] = useState<number | typeof CHALLENGE_FILTER_ALL>(CHALLENGE_FILTER_ALL);
  const consumedCommunityPrefillKeyRef = useRef('');
  const readyToStartChallenges = challengeOverview.ready_to_start.filter((challenge) => challenge.can_start);
  const upcomingChallenges = challengeOverview.ready_to_start.filter((challenge) => !challenge.can_start);
  const durationTabOptions = useMemo<(number | typeof CHALLENGE_FILTER_ALL)[]>(() => {
    const available = new Set<number>();
    challengeOverview.active_challenges.forEach((challenge) => {
      if (challenge.duration_days > 0) {
        available.add(challenge.duration_days);
      }
    });
    challengeOverview.completed_challenges.forEach((challenge) => {
      if (challenge.duration_days > 0) {
        available.add(challenge.duration_days);
      }
    });
    challengeOverview.ready_to_start.forEach((challenge) => {
      if (challenge.duration_days > 0) {
        available.add(challenge.duration_days);
      }
    });
    const ordered = CHALLENGE_DURATION_ORDER.filter((days) => available.has(days));
    const extras = Array.from(available)
      .filter((days) => !CHALLENGE_DURATION_ORDER.includes(days))
      .sort((a, b) => a - b);
    return [CHALLENGE_FILTER_ALL, ...ordered, ...extras];
  }, [challengeOverview.active_challenges, challengeOverview.completed_challenges, challengeOverview.ready_to_start]);
  const selectedDurationChallenges = useMemo<ChallengeLibraryItem[]>(() => {
    const activeItems = challengeOverview.active_challenges
      .filter((challenge) => selectedDurationDays === CHALLENGE_FILTER_ALL || challenge.duration_days === selectedDurationDays)
      .map((challenge) => ({ ...challenge, state: 'ACTIVE' as const }));
    const completedItems = challengeOverview.completed_challenges
      .filter((challenge) => selectedDurationDays === CHALLENGE_FILTER_ALL || challenge.duration_days === selectedDurationDays)
      .map((challenge) => ({ ...challenge, state: 'COMPLETED' as const }));
    const readyItems = challengeOverview.ready_to_start
      .filter((challenge) => selectedDurationDays === CHALLENGE_FILTER_ALL || challenge.duration_days === selectedDurationDays)
      .map((challenge) => ({ ...challenge, state: challenge.can_start ? 'READY' as const : 'UPCOMING' as const }));
    return [...activeItems, ...readyItems, ...completedItems];
  }, [challengeOverview.active_challenges, challengeOverview.completed_challenges, challengeOverview.ready_to_start, selectedDurationDays]);
  const hasReadyToStartChallenges = readyToStartChallenges.length > 0;
  const hasUpcomingChallenges = upcomingChallenges.length > 0;
  const hasActiveChats = false;
  const hasActiveChallenges = false;
  const hasCompletedChallenges = false;
  const hasVisibleChallengeSections =
    challengeOverview.ready_to_start.length > 0 || challengeOverview.active_challenges.length > 0 || challengeOverview.completed_challenges.length > 0;
  const allowedCommunityAudiences = useMemo(() => {
    if (!canAccessCommunity) {
      return [] as string[];
    }
    if (isCommunityAdmin) {
      return [...COMMUNITY_AUDIENCE_FILTERS];
    }
    const hierarchy: Record<string, string[]> = {
      SILVER: ['ALL', 'SILVER'],
      GOLD: ['ALL', 'SILVER', 'GOLD'],
      PLATINUM: ['ALL', 'SILVER', 'GOLD', 'PLATINUM'],
      INNER_CIRCLE: ['ALL', 'SILVER', 'GOLD', 'PLATINUM', 'INNER_CIRCLE'],
    };
    return hierarchy[subscriptionTier] ?? ['ALL'];
  }, [canAccessCommunity, isCommunityAdmin, subscriptionTier]);
  const filteredCommunityPosts = useMemo(() => {
    if (selectedCommunityFilter === 'ALL') {
      return communityPosts;
    }
    return communityPosts.filter((post) => String(post.audience || '').toUpperCase() === selectedCommunityFilter);
  }, [communityPosts, selectedCommunityFilter]);
  useEffect(() => {
    let isMounted = true;

    const loadCurrentCommunityUser = async () => {
      try {
        const [authUser, currentUser] = await Promise.all([getAuthUser(), fetchCurrentUser()]);
        if (!isMounted) {
          return;
        }

        setCanAccessChallenges(canAccessFeature('challenge', currentUser));
        setCanAccessCommunity(canAccessFeature('community', currentUser));
        setSubscriptionTier(normalizeSubscriptionTier(currentUser?.subscription_tier));
        setIsCommunityAdmin(Boolean(currentUser?.is_admin));
        setCurrentCommunityUser({
          name: authUser?.name || currentUser?.name || t('You'),
          profileImage: authUser?.profileImage || currentUser?.profileImage || '',
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setCanAccessChallenges(false);
        setCanAccessCommunity(false);
        setIsCommunityAdmin(false);
      }
    };

    loadCurrentCommunityUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!durationTabOptions.length) {
      return;
    }
    if (!durationTabOptions.includes(selectedDurationDays)) {
      setSelectedDurationDays(durationTabOptions[0]);
    }
  }, [durationTabOptions, selectedDurationDays]);

  const loadChallengeOverview = useCallback(async (showLoading = true) => {
    if (!canAccessChallenges) {
      setChallengeLoading(false);
      setChallengeError('');
      setChallengeOverview({
        active_chats: [],
        active_challenges: [],
        completed_challenges: [],
        ready_to_start: [],
      });
      return;
    }
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
      setChallengeError(error instanceof Error ? error.message : t('Failed to load challenges.'));
    } finally {
      if (showLoading) {
        setChallengeLoading(false);
      }
    }
  }, [canAccessChallenges]);

  const loadCommunityPosts = useCallback(async (showLoading = true) => {
    if (!canAccessCommunity) {
      setCommunityLoading(false);
      setCommunityError('');
      setCommunityPosts([]);
      return;
    }
    if (showLoading) {
      setCommunityLoading(true);
    }
    setCommunityError('');
    try {
      const response = await apiRequest<{ posts: CommunityPost[] }>('/community/posts');
      setCommunityPosts(Array.isArray(response.posts) ? response.posts : []);
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : t('Failed to load community posts.'));
    } finally {
      if (showLoading) {
        setCommunityLoading(false);
      }
    }
  }, [canAccessCommunity]);

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
    if (requestedTab === 'COMMUNITY' && canAccessCommunity && activeTab !== 'COMMUNITY') {
      setActiveTab('COMMUNITY');
    }
  }, [activeTab, canAccessCommunity, params.tab]);

  useEffect(() => {
    if (!allowedCommunityAudiences.includes(selectedCommunityFilter)) {
      setSelectedCommunityFilter('ALL');
    }
  }, [allowedCommunityAudiences, selectedCommunityFilter]);

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
        setCommunityError(error instanceof Error ? error.message : t('Failed to attach the shared report image.'));
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

  if (checkingAccess) {
    return null;
  }

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
      setCommunityError(t('Add a status or choose an image before posting.'));
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
      setCommunityError(error instanceof Error ? error.message : t('Failed to publish post'));
    } finally {
      setCommunityPosting(false);
    }
  };

  const handlePickCommunityImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('Permission needed'), t('Please allow photo library access to add an image.'));
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
      const message = error instanceof Error ? error.message : t('Unable to choose an image right now.');
      Alert.alert(t('Image unavailable'), message);
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
      setCommunityError(error instanceof Error ? error.message : t('Failed to update reaction'));
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
      setCommunityError(error instanceof Error ? error.message : t('Failed to add comment'));
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
      await loadChallengeOverview(false);
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : t('Failed to start challenge'));
    } finally {
      setChallengeStarting((current) => ({ ...current, [challenge.id]: false }));
    }
  };

  const handleCompleteCurrentDay = async (challenge: ActiveChallenge) => {
    if (challengeDayCompleting[challenge.id]) {
      return;
    }

    const completedDays = Math.max(challenge.total_days - challenge.days_left, 0);
    const nextDay = Math.min(completedDays + 1, Math.max(challenge.total_days, 1));
    if (nextDay <= 0 || nextDay > challenge.total_days) {
      return;
    }

    setChallengeDayCompleting((current) => ({ ...current, [challenge.id]: true }));
    setChallengeError('');
    try {
      await apiRequest(`/challenges/${encodeURIComponent(challenge.challenge_id)}/plan/days/${nextDay}/complete`, {
        method: 'POST',
        body: { completed: true },
      });
      await loadChallengeOverview(false);
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : t('Failed to complete the current day.'));
    } finally {
      setChallengeDayCompleting((current) => ({ ...current, [challenge.id]: false }));
    }
  };

  const handleInviteChallenge = (challenge: ReadyChallenge) => {
    router.push({
      pathname: '/challenge',
      params: {
        tab: 'COMMUNITY',
        prefillSource: 'challenge_invite',
        prefillChallengeId: challenge.id,
        prefillStatus: `Join me in ${challenge.title}. ${challenge.description}`,
      },
    } as any);
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
      setCommunityError(error instanceof Error ? error.message : t('Failed to delete post'));
    } finally {
      setDeleteSubmitting((current) => ({ ...current, [postId]: false }));
    }
  };

  const handleDeleteCommunityPost = (postId: string) => {
    if (deleteSubmitting[postId]) {
      return;
    }

    Alert.alert(t('Delete post'), t('Are you sure you want to delete this post?'), [
      {
        text: t('Cancel'),
        style: 'cancel',
      },
      {
        text: t('Delete'),
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
        stickyHeaderIndices={[1]}
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
        <View style={styles.tabStickyWrap}>
          <View style={styles.tabRow}>
            {challengeTabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
                onPress={() => {
                  if (tab.id === 'CHALLENGES' && !canAccessChallenges) {
                    setRestrictedSection(tab.restrictedSection);
                    return;
                  }
                  if (tab.id === 'COMMUNITY' && !canAccessCommunity) {
                    setRestrictedSection(tab.restrictedSection);
                    return;
                  }
                  setActiveTab(tab.id);
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.id && styles.tabTextActive,
                    ((tab.id === 'CHALLENGES' && !canAccessChallenges) || (tab.id === 'COMMUNITY' && !canAccessCommunity)) && styles.tabTextLocked,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
                  <Text style={styles.subSectionTitle}>{t('Challenge Chats')}</Text>
                </View>
                {challengeOverview.active_chats.map((chat) => (
                  <TouchableOpacity
                    key={chat.id}
                    style={styles.chatCard}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/challenges/${chat.challenge_id}` as any)}
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
                  <Text style={styles.chatTime}>{formatChallengeTime(chat.last_message_at, t)}</Text>
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
                  <Text style={styles.subSectionTitle}>{t('Your Active Challenges')}</Text>
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
                          <Text style={styles.activePointsText}>+{ch.points} {t('Points')}</Text>
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
                        {ch.days_left} {t('days left')}
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
                  <Text style={[styles.subSectionTitle, { color: '#22C55E' }]}>{t('Completed')}</Text>
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

            {(hasReadyToStartChallenges || hasUpcomingChallenges || hasCompletedChallenges || challengeOverview.active_challenges.length > 0) ? (
              <>
                <View style={[styles.subSectionHeader, { marginTop: 4 }]}>
                  <Ionicons name="rocket" size={16} color="#4F8EF7" />
                  <Text style={[styles.subSectionTitle, { color: '#4F8EF7' }]}>{t('Challenge Library')}</Text>
                </View>
                <Text style={styles.challengeLibraryLead}>{t('Grow through out of the Comfort zone')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.durationTabsRow}
                >
                  {durationTabOptions.map((days) => (
                    <TouchableOpacity
                      key={String(days)}
                      style={[styles.durationTabPill, selectedDurationDays === days && styles.durationTabPillActive]}
                      activeOpacity={0.88}
                      onPress={() => setSelectedDurationDays(days)}
                    >
                      <Text style={[styles.durationTabText, selectedDurationDays === days && styles.durationTabTextActive]}>
                        {formatChallengeFilterLabel(days, t)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {selectedDurationChallenges.length > 0 ? selectedDurationChallenges.map((ch) => {
                  const challengeRouteId = 'challenge_id' in ch ? ch.challenge_id : ch.id;
                  return (
                  <View key={ch.id} style={styles.challengeLibraryCard}>
                    <TouchableOpacity activeOpacity={0.94} onPress={() => router.push(`/challenges/${challengeRouteId}` as any)}>
                      {ch.thumbnail ? <Image source={{ uri: ch.thumbnail }} style={styles.challengeLibraryImage} /> : null}
                    <View style={styles.challengeLibraryCardHeader}>
                      <View style={styles.challengeLibraryTitleWrap}>
                        <Text style={styles.challengeLibraryTitle}>{ch.title}</Text>
                        <Text style={styles.challengeLibraryCategory}>{ch.type}</Text>
                      </View>
                      <View style={styles.challengeLibraryPointsBadge}>
                      <Text style={styles.challengeLibraryPointsText}>
                        +{ch.state === 'COMPLETED' ? ch.earned_points : ch.points} {t('Points')}
                      </Text>
                      </View>
                    </View>
                    <Text style={styles.challengeLibraryDescription}>{ch.description}</Text>
                      {ch.state === 'ACTIVE' ? (
                        <View style={styles.challengeLibraryProgressRow}>
                          <View style={styles.challengeLibraryProgressTrack}>
                            <View
                              style={[
                                styles.challengeLibraryProgressFill,
                                { width: `${Math.max(0, Math.min(100, Math.round(ch.progress * 100)))}%` as any },
                              ]}
                            />
                          </View>
                          <Text style={styles.challengeLibraryProgressText}>{Math.round(ch.progress * 100)}%</Text>
                        </View>
                      ) : ch.state === 'COMPLETED' ? (
                        <View style={styles.challengeLibraryProgressRow}>
                          <View style={styles.challengeLibraryProgressTrack}>
                            <View style={[styles.challengeLibraryProgressFill, { width: '100%', backgroundColor: '#22C55E' }]} />
                          </View>
                          <Text style={styles.challengeLibraryProgressText}>100%</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                    <View style={styles.challengeLibraryFooter}>
                      <View style={styles.challengeLibraryMetaRow}>
                        <View style={styles.challengeLibraryMetaItem}>
                          <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.58)" />
                          <Text style={styles.challengeLibraryMetaText}>{ch.participants}</Text>
                        </View>
                        <View style={styles.challengeLibraryMetaItem}>
                          <Ionicons
                            name={
                              ch.state === 'ACTIVE'
                                ? 'chatbubble-outline'
                                : ch.state === 'COMPLETED'
                                  ? 'checkmark-circle-outline'
                                  : 'chatbubble-outline'
                            }
                            size={14}
                            color="rgba(255,255,255,0.58)"
                          />
                          <Text style={styles.challengeLibraryMetaText}>
                            {ch.state === 'ACTIVE'
                              ? t('Chat')
                              : ch.state === 'READY'
                                ? t('Chat')
                                : ch.state === 'COMPLETED'
                                  ? `${t('Completed')} ${formatCompletedDate(ch.completed_at)}`
                                  : t('Chat')}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.challengeLibraryActionRow}>
                        {ch.state === 'ACTIVE' ? (
                          <>
                            <TouchableOpacity
                              style={styles.challengeInviteBtn}
                              activeOpacity={0.88}
                              onPress={() => handleInviteChallenge({
                                id: ch.challenge_id,
                                title: ch.title,
                                description: ch.description,
                                duration_days: ch.duration_days,
                                type: ch.type,
                                points: ch.points,
                                participants: ch.participants,
                                difficulty: 'ACTIVE',
                                difficulty_color: ch.color,
                                status: 'ACTIVE',
                                can_start: false,
                                thumbnail: ch.thumbnail,
                              })}
                            >
                              <Ionicons name="person-add-outline" size={15} color="#D9EEFF" />
                              <Text style={styles.challengeInviteBtnText}>{t('Invite')}</Text>
                            </TouchableOpacity>
                            <View style={[styles.challengeStatusBtn, styles.challengeStatusBtnActive]}>
                              <Ionicons name="checkmark" size={15} color="#052E16" />
                              <Text style={styles.challengeStatusBtnText}>{t('In Progress')}</Text>
                            </View>
                          </>
                        ) : ch.state === 'COMPLETED' ? (
                          <TouchableOpacity
                            style={[styles.challengeStatusBtn, styles.challengeStatusBtnCompleted]}
                            activeOpacity={0.88}
                            onPress={() => router.push(`/challenges/${ch.challenge_id}` as any)}
                          >
                            <Ionicons name="checkmark-circle" size={15} color="#052E16" />
                            <Text style={styles.challengeStatusBtnText}>{t('Completed')}</Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.challengeInviteBtn}
                              activeOpacity={0.88}
                              onPress={() => handleInviteChallenge(ch)}
                            >
                              <Ionicons name="person-add-outline" size={15} color="#D9EEFF" />
                              <Text style={styles.challengeInviteBtnText}>{t('Invite')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.challengeStatusBtn,
                                ch.state === 'READY' ? styles.challengeStatusBtnActive : styles.challengeStatusBtnLocked,
                                challengeStarting[ch.id] && styles.challengeStatusBtnPending,
                              ]}
                              activeOpacity={0.88}
                              onPress={() => {
                                if (ch.state === 'READY') {
                                  void handleStartChallenge(ch);
                                }
                              }}
                              disabled={challengeStarting[ch.id] || ch.state !== 'READY'}
                            >
                              {challengeStarting[ch.id] ? (
                                <ActivityIndicator size="small" color="#052E16" />
                              ) : (
                                <>
                                  <Ionicons
                                    name={ch.state === 'READY' ? 'checkmark' : 'lock-closed-outline'}
                                    size={15}
                                    color={ch.state === 'READY' ? '#052E16' : '#E9D5FF'}
                                  />
                                  <Text
                                    style={[
                                      styles.challengeStatusBtnText,
                                      ch.state !== 'READY' && styles.challengeStatusBtnTextLocked,
                                    ]}
                                  >
                                    {ch.state === 'READY' ? t('Start') : t('Coming Soon')}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                )}) : (
                  <View style={styles.challengeEmptyCard}>
                    <Text style={styles.challengeEmptyText}>
                      {selectedDurationDays === CHALLENGE_FILTER_ALL
                        ? t('No challenges available right now.')
                        : t('No duration challenges available right now.', { duration: formatDurationLabel(selectedDurationDays, t).toLowerCase() })}
                    </Text>
                  </View>
                )}
              </>
            ) : null}
            {!challengeLoading && !hasVisibleChallengeSections ? (
              <View style={styles.challengeEmptyCard}>
                <Text style={styles.challengeEmptyText}>{t('No challenges available right now.')}</Text>
              </View>
            ) : null}

          </View>
        )}


        {/* ── COMMUNITY TAB ── */}
        {activeTab === 'COMMUNITY' && (
          <View style={styles.section}>
            <View style={styles.communityFilterTrigger}>
              <View style={styles.communityFilterTriggerSpacer} />
              <TouchableOpacity
                style={styles.communityFilterIconWrap}
                activeOpacity={0.88}
                onPress={() => setCommunityFilterPickerOpen(true)}
              >
                <Ionicons name="filter" size={14} color="rgba(255,255,255,0.78)" />
              </TouchableOpacity>
            </View>

            <Modal
              visible={communityFilterPickerOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setCommunityFilterPickerOpen(false)}
            >
              <TouchableOpacity
                style={styles.communityFilterModalBackdrop}
                activeOpacity={1}
                onPress={() => setCommunityFilterPickerOpen(false)}
              >
                <View style={styles.communityFilterModalCard}>
                  {COMMUNITY_AUDIENCE_FILTERS.map((filterKey) => {
                    const isAllowed = allowedCommunityAudiences.includes(filterKey);
                    const isActive = selectedCommunityFilter === filterKey;
                    return (
                      <TouchableOpacity
                        key={filterKey}
                        style={styles.communityFilterOption}
                        activeOpacity={0.88}
                        onPress={() => {
                          setCommunityFilterPickerOpen(false);
                          if (!isAllowed) {
                            setRestrictedSection(`Community ${filterKey}`);
                            return;
                          }
                          setSelectedCommunityFilter(filterKey);
                        }}
                      >
                        <Text
                          style={[
                            styles.communityFilterOptionText,
                            isActive && styles.communityFilterOptionTextActive,
                            !isAllowed && styles.communityFilterOptionTextLocked,
                          ]}
                        >
                          {filterKey}
                        </Text>
                        {!isAllowed ? (
                          <Ionicons name="lock-closed" size={12} color="#F5D0FE" />
                        ) : isActive ? (
                          <Ionicons name="checkmark" size={14} color={Colors.primary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Post Composer */}
            <View style={styles.composerCard}>
              <TextInput
                style={styles.composerInput}
                placeholder={t("What's on your mind?")}
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
                  {communityPosting ? <ActivityIndicator size="small" color="#0A0A14" /> : <Text style={styles.postBtnText}>{t('Post')}</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {communityImage?.uri ? (
              <View style={styles.communityPreviewCard}>
                <Image source={{ uri: communityImage.uri }} style={styles.communityPreviewImage} />
                <TouchableOpacity onPress={() => setCommunityImage(null)} style={styles.communityPreviewRemove}>
                  <Text style={styles.communityPreviewRemoveText}>{t('Remove image')}</Text>
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
            {!communityLoading && filteredCommunityPosts.map((post) => (
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
                        <Text style={styles.postTime}>{formatCommunityPostTime(post.created_at, t)}</Text>
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
                      accessibilityLabel={deleteSubmitting[post.id] ? t('Deleting post') : t('Delete post')}
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
                            <Text style={styles.commentTime}>{formatCommunityPostTime(comment.created_at, t)}</Text>
                          </View>
                          <Text style={styles.commentContent}>{comment.content}</Text>
                        </View>
                      </View>
                    ))}

                    <View style={styles.commentComposer}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder={t('Write a comment...')}
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
                          <Text style={styles.commentSendText}>{t('Send')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            ))}

            {!communityLoading && filteredCommunityPosts.length === 0 ? (
              <View style={styles.challengeEmptyCard}>
                <Text style={styles.challengeEmptyText}>No community posts available for this filter.</Text>
              </View>
            ) : null}

          </View>
        )}

      </ScrollView>
      <AccessRestrictionModal
        visible={Boolean(restrictedSection)}
        sectionName={restrictedSection}
        onClose={() => setRestrictedSection('')}
        onUpdatePlan={() => {
          setRestrictedSection('');
          router.push('/plan');
        }}
        onBackHome={() => {
          setRestrictedSection('');
          replaceRoute(router, '/(tabs)');
        }}
      />

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
                      <Text style={styles.postTime}>{formatCommunityPostTime(selectedCommunityPost.created_at, t)}</Text>
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
  tabStickyWrap: {
    backgroundColor: Colors.background,
    paddingTop: 4,
    paddingBottom: 8,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
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
  tabTextLocked: {
    opacity: 0.58,
  },
  tabTextActive: {
    color: '#000',
  },

  /* Shared */
  section: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  /* Sub-section Header */
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 13,
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
  challengeLimitCard: {
    backgroundColor: '#10182B',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.18)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  challengeLimitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  challengeLimitTitle: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  challengeLimitCount: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  challengeLimitText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    marginBottom: 10,
  },
  challengeLimitBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  challengeLimitBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  challengeStatusText: {
    color: '#FCA5A5',
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  challengeLibraryLead: {
    color: '#D5DEF0',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  durationTabsRow: {
    gap: 10,
    paddingBottom: 0,
    marginBottom: 8,
  },
  durationTabPill: {
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#1F2940',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationTabPillActive: {
    backgroundColor: '#FF6A55',
    borderColor: '#FF8A75',
    shadowColor: '#FF6A55',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  durationTabText: {
    color: '#C7D2E5',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  durationTabTextActive: {
    color: '#fff',
  },
  challengeLibraryCard: {
    backgroundColor: '#343B4D',
    borderRadius: 18,
    paddingHorizontal: 5,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  challengeLibraryImage: {
    width: '100%',
    height: 82,
    borderRadius: 10,
    marginBottom: 3,
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
    marginTop: 0,
    color: '#F5A43C',
    fontSize: 9,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryPointsBadge: {
    backgroundColor: '#FFC233',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  challengeLibraryPointsText: {
    color: '#4C2A00',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryDescription: {
    color: '#E5E7EB',
    fontSize: 10,
    lineHeight: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  challengeLibraryProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
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
    fontSize: 10,
    minWidth: 32,
    textAlign: 'right',
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 3,
  },
  challengeLibraryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  challengeLibraryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  challengeLibraryMetaText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  challengeLibraryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    flexShrink: 1,
    gap: 6,
    marginTop: 0,
  },
  challengeInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2F7CF8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  challengeInviteBtnText: {
    color: '#EAF4FF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  challengeStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  challengeStatusBtnActive: {
    backgroundColor: '#22C55E',
  },
  challengeStatusBtnCompleted: {
    backgroundColor: '#22C55E',
  },
  challengeStatusBtnLocked: {
    backgroundColor: '#2E2348',
  },
  challengeStatusBtnPending: {
    opacity: 0.7,
  },
  challengeStatusBtnText: {
    color: '#052E16',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  challengeStatusBtnTextLocked: {
    color: '#E9D5FF',
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
  communityFilterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  communityFilterTriggerSpacer: {
    flex: 1,
  },
  communityFilterIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  communityFilterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,8,20,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 160,
  },
  communityFilterModalCard: {
    backgroundColor: '#13132A',
    width: '52%',
    minWidth: 190,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  communityFilterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  communityFilterOptionText: {
    color: '#D7E0F0',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  communityFilterOptionTextActive: {
    color: Colors.primary,
  },
  communityFilterOptionTextLocked: {
    color: '#F5D0FE',
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
