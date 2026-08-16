import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import CrossPlatformWebView from '../../components/CrossPlatformWebView';
import { Colors } from '../../constants/Colors';
import AccessRestrictionModal from '../../components/AccessRestrictionModal';
import { apiRequest, fetchCurrentUser, getAuthUser, resolveRemoteAssetUrl } from '../../lib/api';
import { canAccessFeature, normalizeSubscriptionTier } from '../../lib/access';
import { useLanguage } from '../../lib/i18n';
import { clearCachedResource, getCachedResourceSnapshot } from '../../lib/resourceCache';
import {
  CHALLENGE_OVERVIEW_CACHE_KEY,
  COMMUNITY_POSTS_CACHE_KEY,
  fetchChallengeOverviewData,
  fetchCommunityPostsData,
} from '../../lib/screenData';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';
import { pushRoute, replaceRoute } from '../../lib/navigation';

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
  why_it_matters: string;
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
  why_it_matters: string;
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
  video_url: string;
  like_count: number;
  comment_count: number;
  viewer_has_liked: boolean;
  can_delete: boolean;
  comments: CommunityComment[];
  reactions?: CommunityReactionUser[];
  created_at: string;
  updated_at: string;
  is_pending_upload?: boolean;
};

type CommunityVideoKind = 'direct' | 'embed' | 'none';

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

type CommunityMediaAsset = {
  uri: string;
  mimeType: string;
  fileName: string | null;
  fileSize?: number | null;
  file?: File | null;
  width?: number | null;
  height?: number | null;
  type: 'image' | 'video';
};

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/ogg',
]);

const COMMUNITY_VIDEO_UPLOAD_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const VIDEO_FILE_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.ogg'];
const COMMUNITY_IMAGE_MAX_SIZE_BYTES = 1 * 1024 * 1024;
const COMMUNITY_VIDEO_MAX_SIZE_BYTES = 20 * 1024 * 1024;

function inferCommunityMediaType(asset: ImagePicker.ImagePickerAsset): 'image' | 'video' {
  if (asset.type === 'image') {
    return 'image';
  }
  if (asset.type === 'video') {
    return 'video';
  }

  const mimeType = String(asset.mimeType || '').trim().toLowerCase();
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (VIDEO_MIME_TYPES.has(mimeType)) {
    return 'video';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  const fileName = String(asset.fileName || '').trim().toLowerCase();
  if (VIDEO_FILE_EXTENSIONS.some((extension) => fileName.endsWith(extension))) {
    return 'video';
  }

  const uri = String(asset.uri || '').trim().toLowerCase();
  if (VIDEO_FILE_EXTENSIONS.some((extension) => uri.includes(extension))) {
    return 'video';
  }

  if (uri.startsWith('blob:') || uri.startsWith('data:video/')) {
    return 'video';
  }

  return 'image';
}

function inferCommunityMimeType(asset: ImagePicker.ImagePickerAsset, mediaType: 'image' | 'video'): string {
  const mimeType = String(asset.mimeType || '').trim().toLowerCase();
  if (mediaType === 'video') {
    if (mimeType === 'video/quicktime' || String(asset.fileName || '').toLowerCase().endsWith('.mov')) {
      return 'video/quicktime';
    }
    if (mimeType === 'video/webm' || String(asset.fileName || '').toLowerCase().endsWith('.webm')) {
      return 'video/webm';
    }
    if (mimeType === 'video/mp4' || mimeType === 'video/x-m4v' || String(asset.fileName || '').toLowerCase().endsWith('.mp4') || String(asset.fileName || '').toLowerCase().endsWith('.m4v')) {
      return 'video/mp4';
    }
    return 'video/mp4';
  }

  if (mimeType.startsWith('image/')) {
    return mimeType;
  }

  return 'image/jpeg';
}

function getCommunityUploadName(asset: any, mediaType: 'image' | 'video') {
  const fileName = String(asset.fileName || '').trim();
  if (fileName) {
    return fileName;
  }
  return mediaType === 'video' ? 'community-video.mp4' : 'community-image.jpg';
}

function getCommunityMediaSizeBytes(asset: any) {
  const fileSize = Number((asset as { fileSize?: number | null }).fileSize ?? 0) || 0;
  const fileObjectSize = Number((asset.file as { size?: number } | undefined)?.size ?? 0) || 0;
  return Math.max(fileSize, fileObjectSize);
}

function buildCommunityUploadFormData(params: {
  content: string;
  media: CommunityMediaAsset | null;
  externalVideoUrl: string;
}) {
  const formData = new FormData();
  formData.append('content', params.content);

  if (params.externalVideoUrl) {
    formData.append('external_video_url', params.externalVideoUrl);
  }

  if (params.media) {
    formData.append('mime_type', params.media.mimeType);
    formData.append('file_name', params.media.fileName || '');
    formData.append('media_type', params.media.type);

    if (params.media.file) {
      formData.append('media_file', params.media.file);
    } else {
      formData.append('media_file', {
        uri: params.media.uri,
        name: getCommunityUploadName(
          params.media,
          params.media.type,
        ),
        type: params.media.mimeType,
      } as any);
    }
  }

  return formData;
}

function getOptimisticCommunityAudience(subscriptionTier: string, isCommunityAdmin: boolean): string {
  if (isCommunityAdmin) {
    return 'ALL';
  }
  if (subscriptionTier === 'GOLD' || subscriptionTier === 'PLATINUM' || subscriptionTier === 'INNER_CIRCLE') {
    return subscriptionTier;
  }
  return 'SILVER';
}
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

function getCommunityVideoUrl(url: string | null | undefined) {
  return resolveRemoteAssetUrl(url) || '';
}

function normalizeExternalCommunityVideoUrl(url: string | null | undefined) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    return '';
  }
  try {
    const parsed = new URL(normalizedUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname || '';

    if (host === 'youtu.be') {
      const videoId = path.replace(/^\/+/, '').split('/')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0` : '';
    }
    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      const videoId =
        path.startsWith('/embed/')
          ? path.split('/embed/')[1]?.split('/')[0]
          : path.startsWith('/shorts/')
            ? path.split('/shorts/')[1]?.split('/')[0]
            : parsed.searchParams.get('v') || '';
      return videoId ? `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0` : '';
    }
    if (host === 'player.vimeo.com' && path.startsWith('/video/')) {
      const videoId = path.split('/video/')[1]?.split('/')[0] || '';
      return videoId ? `https://player.vimeo.com/video/${videoId}?playsinline=1&title=0&byline=0&portrait=0&dnt=1` : '';
    }
    if (host === 'vimeo.com' || host === 'www.vimeo.com') {
      const match = path.match(/\/(\d+)(?:$|[/?#])/);
      return match?.[1]
        ? `https://player.vimeo.com/video/${match[1]}?playsinline=1&title=0&byline=0&portrait=0&dnt=1`
        : '';
    }
  } catch {
    return '';
  }
  return '';
}

function getCommunityVideoLinkHint(t: (key: string, params?: Record<string, string | number>) => string) {
  return t('Supported links: YouTube watch/share/shorts and Vimeo links.');
}

function getCommunityVideoLinkError(
  message: string,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  const normalized = String(message || '').trim();
  if (
    normalized === 'Only YouTube and Vimeo links are supported' ||
    normalized === 'Only valid YouTube and Vimeo links are supported' ||
    normalized === 'That YouTube link is not valid' ||
    normalized === 'That Vimeo link is not valid' ||
    normalized === 'Video link is empty'
  ) {
    return t('Use a valid YouTube or Vimeo link. Supported: YouTube watch/share/shorts and Vimeo links.');
  }
  return normalized || t('Failed to publish post');
}

function getCommunityVideoKind(url: string | null | undefined): CommunityVideoKind {
  const resolvedUrl = getCommunityVideoUrl(url) || normalizeExternalCommunityVideoUrl(url);
  if (!resolvedUrl) {
    return 'none';
  }
  if (
    resolvedUrl.startsWith('https://player.vimeo.com/video/') ||
    resolvedUrl.startsWith('https://www.youtube.com/embed/') ||
    resolvedUrl.startsWith('https://www.youtube-nocookie.com/embed/')
  ) {
    return 'embed';
  }
  return 'direct';
}

function buildCommunityVideoHtml(videoUrl: string) {
  const escapedUrl = videoUrl
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const videoKind = getCommunityVideoKind(videoUrl);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #0b1020;
        height: 100%;
        overflow: hidden;
      }
      video, iframe {
        width: 100%;
        height: 100%;
        background: #0b1020;
        border: 0;
      }
      video {
        object-fit: cover;
      }
    </style>
  </head>
  <body>
    ${
      videoKind === 'embed'
        ? `<iframe src="${escapedUrl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
        : `<video controls playsinline preload="metadata" src="${escapedUrl}"></video>`
    }
  </body>
</html>`;
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
  const tRef = useRef(t);
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
  const initialCachedChallengeOverview = useRef(getCachedResourceSnapshot<ChallengeOverview>(CHALLENGE_OVERVIEW_CACHE_KEY));
  const initialCachedCommunityPosts = useRef(getCachedResourceSnapshot<{ posts: CommunityPost[] }>(COMMUNITY_POSTS_CACHE_KEY));
  const cachedChallengeOverview = initialCachedChallengeOverview.current;
  const cachedCommunityPosts = initialCachedCommunityPosts.current;
  const hasCachedChallengeOverview = Boolean(
    cachedChallengeOverview &&
      ((Array.isArray(cachedChallengeOverview.active_challenges) && cachedChallengeOverview.active_challenges.length > 0) ||
        (Array.isArray(cachedChallengeOverview.ready_to_start) && cachedChallengeOverview.ready_to_start.length > 0) ||
        (Array.isArray(cachedChallengeOverview.completed_challenges) && cachedChallengeOverview.completed_challenges.length > 0)),
  );
  const hasCachedCommunityPosts = Boolean(cachedCommunityPosts && Array.isArray(cachedCommunityPosts.posts) && cachedCommunityPosts.posts.length > 0);
  const [activeTab, setActiveTab] = useState('CHALLENGES');
  const [canAccessChallenges, setCanAccessChallenges] = useState(true);
  const [canAccessCommunity, setCanAccessCommunity] = useState(true);
  const [challengeOverview, setChallengeOverview] = useState<ChallengeOverview>(
    cachedChallengeOverview ?? {
      active_chats: [],
      active_challenges: [],
      completed_challenges: [],
      ready_to_start: [],
    }
  );
  const [challengeLoading, setChallengeLoading] = useState(!cachedChallengeOverview);
  const [challengeError, setChallengeError] = useState('');
  const [challengeStarting, setChallengeStarting] = useState<Record<string, boolean>>({});
  const [challengeDayCompleting, setChallengeDayCompleting] = useState<Record<string, boolean>>({});
  const [expandedChallengeCards, setExpandedChallengeCards] = useState<Record<string, boolean>>({});
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(cachedCommunityPosts?.posts ?? []);
  const [communityDraft, setCommunityDraft] = useState('');
  const [communityLoading, setCommunityLoading] = useState(!cachedCommunityPosts);
  const [communityPosting, setCommunityPosting] = useState(false);
  const [communityError, setCommunityError] = useState('');
  const [communityVideoLink, setCommunityVideoLink] = useState('');
  const [screenRefreshing, setScreenRefreshing] = useState(false);
  const [communityMedia, setCommunityMedia] = useState<CommunityMediaAsset | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [reactionSubmitting, setReactionSubmitting] = useState<Record<string, boolean>>({});
  const [deleteSubmitting, setDeleteSubmitting] = useState<Record<string, boolean>>({});
  const [optimisticDeletedPostIds, setOptimisticDeletedPostIds] = useState<Record<string, boolean>>({});
  const [deleteTargetPost, setDeleteTargetPost] = useState<CommunityPost | null>(null);
  const [selectedCommunityPost, setSelectedCommunityPost] = useState<CommunityPost | null>(null);
  const [currentCommunityUser, setCurrentCommunityUser] = useState<CurrentCommunityUser>({
    name: t('You'),
    profileImage: '',
  });
  const [subscriptionTier, setSubscriptionTier] = useState('NONE');
  const [isCommunityAdmin, setIsCommunityAdmin] = useState(false);
  const [selectedCommunityFilters, setSelectedCommunityFilters] = useState<(typeof COMMUNITY_AUDIENCE_FILTERS)[number][]>(['ALL']);
  const [communityFilterPickerOpen, setCommunityFilterPickerOpen] = useState(false);

  const [restrictedSection, setRestrictedSection] = useState('');
  const [selectedDurationDays, setSelectedDurationDays] = useState<number | typeof CHALLENGE_FILTER_ALL>(CHALLENGE_FILTER_ALL);
  const consumedCommunityPrefillKeyRef = useRef('');
  const hasVisibleChallengesRef = useRef(hasCachedChallengeOverview);
  const hasCommunityPostsRef = useRef(hasCachedCommunityPosts);
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
  const accessibleCommunityAudiences = useMemo(() => {
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
    return hierarchy[subscriptionTier] ?? [];
  }, [canAccessCommunity, isCommunityAdmin, subscriptionTier]);
  const availableCommunityFilters = useMemo(() => {
    if (!canAccessCommunity) {
      return [] as (typeof COMMUNITY_AUDIENCE_FILTERS)[number][];
    }
    return ['ALL', ...accessibleCommunityAudiences] as (typeof COMMUNITY_AUDIENCE_FILTERS)[number][];
  }, [accessibleCommunityAudiences, canAccessCommunity]);
  const filteredCommunityPosts = useMemo(() => {
    const visiblePosts = communityPosts.filter((post) => !optimisticDeletedPostIds[post.id]);
    const roleVisiblePosts = visiblePosts.filter((post) => {
      const audience = String(post.audience || '').toUpperCase() as (typeof COMMUNITY_AUDIENCE_FILTERS)[number];
      return accessibleCommunityAudiences.includes(audience);
    });
    if (!selectedCommunityFilters.length || selectedCommunityFilters.includes('ALL')) {
      return roleVisiblePosts;
    }
    return roleVisiblePosts.filter((post) => selectedCommunityFilters.includes(String(post.audience || '').toUpperCase() as (typeof COMMUNITY_AUDIENCE_FILTERS)[number]));
  }, [accessibleCommunityAudiences, communityPosts, optimisticDeletedPostIds, selectedCommunityFilters]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

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

  const loadChallengeOverview = useCallback(async (showLoading = true, forceRefresh = false) => {
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
    if (showLoading && !cachedChallengeOverview) {
      setChallengeLoading(true);
    }
    setChallengeError('');
    try {
      const response = await fetchChallengeOverviewData({ forceRefresh }) as ChallengeOverview;
      setChallengeOverview({
        active_chats: Array.isArray(response.active_chats) ? response.active_chats : [],
        active_challenges: Array.isArray(response.active_challenges) ? response.active_challenges : [],
        completed_challenges: Array.isArray(response.completed_challenges) ? response.completed_challenges : [],
        ready_to_start: Array.isArray(response.ready_to_start) ? response.ready_to_start : [],
      });
    } catch (error) {
      if (hasVisibleChallengesRef.current) {
        setChallengeError('');
        return;
      }
      const message = error instanceof Error ? error.message : '';
      const normalizedMessage = message.toLowerCase();
      setChallengeError(
        normalizedMessage.includes('timed out') || normalizedMessage.includes('timeout')
          ? tRef.current('Unable to load challenges right now.')
          : message || tRef.current('Failed to load challenges.'),
      );
    } finally {
      if (showLoading) {
        setChallengeLoading(false);
      }
    }
  }, [canAccessChallenges, cachedChallengeOverview]);

  const loadCommunityPosts = useCallback(async (showLoading = true) => {
    if (!canAccessCommunity) {
      setCommunityLoading(false);
      setCommunityError('');
      setCommunityPosts([]);
      return;
    }
    if (showLoading && !cachedCommunityPosts) {
      setCommunityLoading(true);
    }
    setCommunityError('');
    try {
      const response = await fetchCommunityPostsData() as { posts: CommunityPost[] };
      setCommunityPosts(Array.isArray(response.posts) ? response.posts : []);
    } catch (error) {
      if (hasCommunityPostsRef.current) {
        setCommunityError('');
        return;
      }
      const message = error instanceof Error ? error.message : '';
      const normalizedMessage = message.toLowerCase();
      setCommunityError(
        normalizedMessage.includes('timed out') || normalizedMessage.includes('timeout')
          ? tRef.current('Unable to load community posts right now.')
          : message || tRef.current('Failed to load community posts.'),
      );
    } finally {
      if (showLoading) {
        setCommunityLoading(false);
      }
    }
  }, [cachedCommunityPosts, canAccessCommunity]);

  useEffect(() => {
    hasVisibleChallengesRef.current =
      challengeOverview.active_challenges.length > 0 ||
      challengeOverview.ready_to_start.length > 0 ||
      challengeOverview.completed_challenges.length > 0 ||
      hasCachedChallengeOverview;
  }, [
    challengeOverview.active_challenges.length,
    challengeOverview.completed_challenges.length,
    challengeOverview.ready_to_start.length,
    hasCachedChallengeOverview,
  ]);

  useEffect(() => {
    hasCommunityPostsRef.current = communityPosts.length > 0 || hasCachedCommunityPosts;
  }, [communityPosts.length, hasCachedCommunityPosts]);

  useEffect(() => {
    if (activeTab !== 'CHALLENGES') {
      return;
    }
    void loadChallengeOverview(true);
  }, [activeTab, loadChallengeOverview]);

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
    setSelectedCommunityFilters((current) => {
      const next = current.filter((filterKey) => availableCommunityFilters.includes(filterKey));
      if (next.includes('ALL') && availableCommunityFilters.includes('ALL')) {
        return ['ALL'];
      }
      if (next.length > 0) {
        return next;
      }
      return availableCommunityFilters.includes('ALL')
        ? ['ALL']
        : availableCommunityFilters.length > 0
          ? [availableCommunityFilters[0] as (typeof COMMUNITY_AUDIENCE_FILTERS)[number]]
          : [];
    });
  }, [availableCommunityFilters]);

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
      if (cancelled) {
        return;
      }

      setCommunityMedia({
        uri: imageUri,
        mimeType: mimeType || 'image/svg+xml',
        fileName: fileName || 'victory-fitness-progress-report.svg',
        fileSize: null,
        file: null,
        width: 1080,
        height: 1920,
        type: 'image',
      });
      setCommunityDraft(prefillStatus || '');
      setCommunityError('');
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
      await loadChallengeOverview(false, true);
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
    const externalVideoUrl = normalizeExternalCommunityVideoUrl(communityVideoLink) || communityVideoLink.trim();
    if (communityMedia && externalVideoUrl) {
      setCommunityError(t('Choose an upload or paste a video link, not both.'));
      return;
    }
    if (!content && !communityMedia && !externalVideoUrl) {
      setCommunityError(t('Add a status, choose media, or paste a video link before posting.'));
      return;
    }

    setCommunityPosting(true);
    setCommunityError('');
    const postingMedia = communityMedia;
    const postingVideoLink = externalVideoUrl;
    const postingDraft = content;
    const optimisticPostId = `pending-${Date.now()}`;
    const optimisticVideoUrl =
      postingMedia?.type === 'video'
        ? (getCommunityVideoUrl(postingMedia.uri) || postingMedia.uri)
        : (!postingMedia?.uri && postingVideoLink ? (getCommunityVideoUrl(postingVideoLink) || postingVideoLink) : '');
    const optimisticPost: CommunityPost = {
      id: optimisticPostId,
      author_id: 'me',
      author_name: currentCommunityUser.name || t('You'),
      author_role: '',
      author_profile_image: currentCommunityUser.profileImage || '',
      audience: getOptimisticCommunityAudience(subscriptionTier, isCommunityAdmin),
      content: postingDraft,
      image_url: postingMedia?.type === 'image' ? postingMedia.uri : '',
      video_url: optimisticVideoUrl,
      like_count: 0,
      comment_count: 0,
      viewer_has_liked: false,
      can_delete: false,
      comments: [],
      reactions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_pending_upload: true,
    };
    setCommunityDraft('');
    setCommunityMedia(null);
    setCommunityVideoLink('');
    setCommunityPosts((current) => [optimisticPost, ...current]);
    try {
      const formData = buildCommunityUploadFormData({
        content: postingDraft || '',
        media: postingMedia,
        externalVideoUrl: postingVideoLink,
      });
      const response = await apiRequest<CommunityPost>('/community/posts', {
        method: 'POST',
        body: formData,
      });
      setCommunityPosts((current) => current.map((post) => (post.id === optimisticPostId ? response : post)));
      void Promise.allSettled([
        clearCachedResource(COMMUNITY_POSTS_CACHE_KEY),
        loadCommunityPosts(false),
      ]);
    } catch (error) {
      setCommunityPosts((current) => current.filter((post) => post.id !== optimisticPostId));
      setCommunityDraft(postingDraft);
      setCommunityMedia(postingMedia);
      setCommunityVideoLink(postingVideoLink);
      setCommunityError(error instanceof Error ? getCommunityVideoLinkError(error.message, t) : t('Failed to publish post'));
    } finally {
      setCommunityPosting(false);
    }
  };

  const handlePickCommunityMedia = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('Permission needed'), t('Please allow photo library access to add media.'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
        base64: false,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const assetType = inferCommunityMediaType(asset);
      const assetMimeType = inferCommunityMimeType(asset, assetType);
      const assetSize = getCommunityMediaSizeBytes(asset);

      if (assetType === 'image' && assetSize > COMMUNITY_IMAGE_MAX_SIZE_BYTES) {
        Alert.alert(t('Image too large'), t('Please choose an image that is 1MB or smaller.'));
        return;
      }

      if (assetType === 'video' && assetSize > COMMUNITY_VIDEO_MAX_SIZE_BYTES) {
        Alert.alert(t('Video too large'), t('Please choose a video that is 20MB or smaller.'));
        return;
      }

      if (assetType === 'video' && !COMMUNITY_VIDEO_UPLOAD_MIME_TYPES.has(assetMimeType)) {
        Alert.alert(t('Unsupported video format'), t('Please upload an MP4, MOV, or WEBM video.'));
        return;
      }

      setCommunityMedia({
        uri: asset.uri,
        mimeType: assetMimeType,
        fileName: asset.fileName || null,
        fileSize: asset.fileSize ?? null,
        file: asset.file ?? null,
        width: asset.width,
        height: asset.height,
        type: assetType,
      });
      setCommunityVideoLink('');
      setCommunityError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Unable to choose media right now.');
      Alert.alert(t('Media unavailable'), message);
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
      await loadChallengeOverview(false, true);
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
      await loadChallengeOverview(false, true);
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : t('Failed to complete the current day.'));
    } finally {
      setChallengeDayCompleting((current) => ({ ...current, [challenge.id]: false }));
    }
  };

  const handleInviteChallenge = (challenge: ReadyChallenge) => {
    pushRoute(router, {
      pathname: '/challenge',
      params: {
        tab: 'COMMUNITY',
        prefillSource: 'challenge_invite',
        prefillChallengeId: challenge.id,
        prefillStatus: `Join me in ${challenge.title}. ${challenge.description}`,
      },
    } as any);
  };

  const toggleChallengeCardExpansion = (challengeId: string) => {
    setExpandedChallengeCards((current) => ({
      ...current,
      [challengeId]: !current[challengeId],
    }));
  };

  const performDeleteCommunityPost = async (postId: string) => {
    if (deleteSubmitting[postId]) {
      return;
    }

    let removedPost: CommunityPost | null = null;
    let removedIndex = -1;

    setDeleteSubmitting((current) => ({ ...current, [postId]: true }));
    setCommunityError('');
    setOptimisticDeletedPostIds((current) => ({ ...current, [postId]: true }));
    setCommunityPosts((current) => {
      removedIndex = current.findIndex((post) => post.id === postId);
      if (removedIndex === -1) {
        return current;
      }
      removedPost = current[removedIndex];
      return current.filter((post) => post.id !== postId);
    });
    setSelectedCommunityPost((current) => (current?.id === postId ? null : current));
    setDeleteTargetPost((current) => (current?.id === postId ? null : current));

    try {
      await apiRequest(`/community/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
      });
      await clearCachedResource(COMMUNITY_POSTS_CACHE_KEY);
      await loadCommunityPosts(false);
      setOptimisticDeletedPostIds((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
    } catch (error) {
      setOptimisticDeletedPostIds((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
      if (removedPost) {
        const postToRestore = removedPost;
        setCommunityPosts((current) => {
          if (current.some((post) => post.id === postId)) {
            return current;
          }
          const next = [...current];
          const insertIndex = removedIndex >= 0 ? Math.min(removedIndex, next.length) : next.length;
          next.splice(insertIndex, 0, postToRestore);
          return next;
        });
      }
      setCommunityError(error instanceof Error ? error.message : t('Failed to delete post'));
    } finally {
      setDeleteSubmitting((current) => ({ ...current, [postId]: false }));
      setDeleteTargetPost((current) => (current?.id === postId ? null : current));
    }
  };

  const handleDeleteCommunityPost = (postId: string) => {
    if (deleteSubmitting[postId]) {
      return;
    }

    const targetPost =
      communityPosts.find((post) => post.id === postId)
      ?? (selectedCommunityPost?.id === postId ? selectedCommunityPost : null);

    if (!targetPost) {
      return;
    }

    setDeleteTargetPost(targetPost);
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
                    onPress={() => pushRoute(router, `/challenges/${ch.challenge_id}` as any)}
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
                  const isExpanded = Boolean(expandedChallengeCards[ch.id]);
                  return (
                  <View key={ch.id} style={styles.challengeLibraryCard}>
                    <TouchableOpacity activeOpacity={0.94} onPress={() => router.push(`/challenges/${challengeRouteId}` as any)}>
                      {ch.thumbnail ? <Image source={{ uri: ch.thumbnail }} style={styles.challengeLibraryImage} /> : null}
                      <View style={styles.challengeLibraryCardHeader}>
                        <View style={styles.challengeLibraryTitleWrap}>
                          <Text style={styles.challengeLibraryTitle}>{ch.title}</Text>
                        </View>
                        <View style={styles.challengeLibraryPointsBadge}>
                          <Text style={styles.challengeLibraryPointsText}>
                            +{ch.state === 'COMPLETED' ? ch.earned_points : ch.points} {t('Points')}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.challengeLibraryFieldLabel}>Goal Type</Text>
                      <Text style={styles.challengeLibraryCategory}>{ch.type}</Text>
                      <Text style={styles.challengeLibraryFieldLabel}>What To Do</Text>
                      <Text style={styles.challengeLibraryDescription} numberOfLines={isExpanded ? undefined : 3}>{ch.description}</Text>
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
                    {ch.why_it_matters ? (
                      <>
                        <TouchableOpacity
                          style={styles.challengeExpandBtn}
                          activeOpacity={0.84}
                          onPress={() => toggleChallengeCardExpansion(ch.id)}
                        >
                          <Text style={styles.challengeExpandBtnText}>{isExpanded ? 'Hide Why It Matters' : 'Why It Matters'}</Text>
                          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#BFDBFE" />
                        </TouchableOpacity>
                        {isExpanded ? <Text style={styles.challengeWhyText}>{ch.why_it_matters}</Text> : null}
                      </>
                    ) : null}
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
                                why_it_matters: ch.why_it_matters,
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
                            <TouchableOpacity
                              style={[styles.challengeStatusBtn, styles.challengeStatusBtnActive]}
                              activeOpacity={0.88}
                              onPress={() => router.push(`/challenges/${challengeRouteId}` as any)}
                            >
                              <Ionicons name="checkmark" size={15} color="#052E16" />
                              <Text style={styles.challengeStatusBtnText}>{t('In Progress')}</Text>
                            </TouchableOpacity>
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
                {selectedCommunityFilters.length > 0 ? (
                  <View style={styles.communityFilterCountBadge}>
                    <Text style={styles.communityFilterCountText}>
                      {selectedCommunityFilters.includes('ALL') ? 'All' : selectedCommunityFilters.length}
                    </Text>
                  </View>
                ) : null}
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
                    const isAllowed = availableCommunityFilters.includes(filterKey);
                    const isActive = selectedCommunityFilters.includes(filterKey);
                    return (
                      <TouchableOpacity
                        key={filterKey}
                        style={styles.communityFilterOption}
                        activeOpacity={0.88}
                        onPress={() => {
                          if (!isAllowed) {
                            setRestrictedSection(`Community ${filterKey}`);
                            return;
                          }
                          setSelectedCommunityFilters((current) => {
                            if (filterKey === 'ALL') {
                              return ['ALL'];
                            }
                            const withoutAll = current.filter((item) => item !== 'ALL');
                            if (withoutAll.includes(filterKey)) {
                              const next = withoutAll.filter((item) => item !== filterKey);
                              if (next.length > 0) {
                                return next;
                              }
                              return availableCommunityFilters.includes('ALL')
                                ? ['ALL']
                                : [filterKey];
                            }
                            return [...withoutAll, filterKey];
                          });
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
                  <TouchableOpacity
                    style={styles.communityFilterDoneButton}
                    activeOpacity={0.88}
                    onPress={() => setCommunityFilterPickerOpen(false)}
                  >
                    <Text style={styles.communityFilterDoneText}>{t('Done')}</Text>
                  </TouchableOpacity>
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
              <TextInput
                style={styles.composerLinkInput}
                placeholder={t('Paste a YouTube or Vimeo link')}
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={communityVideoLink}
                onChangeText={(text) => {
                  setCommunityVideoLink(text);
                  if (text.trim()) {
                    setCommunityMedia(null);
                  }
                }}
              />
              <Text style={styles.composerLinkHint}>{getCommunityVideoLinkHint(t)}</Text>
              <View style={styles.composerDivider} />
              <View style={styles.composerActions}>
                <TouchableOpacity style={styles.composerImgBtn} onPress={handlePickCommunityMedia}>
                  <Ionicons name="images-outline" size={22} color={communityMedia ? Colors.primary : 'rgba(255,255,255,0.45)'} />
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

            {communityMedia?.uri ? (
              <View style={styles.communityPreviewCard}>
                {communityMedia.type === 'video' ? (
                  <View style={styles.communityPreviewVideoWrap}>
                    <CrossPlatformWebView
                      source={{ html: buildCommunityVideoHtml(getCommunityVideoUrl(communityMedia.uri) || communityMedia.uri) }}
                      style={styles.communityPreviewVideo}
                      scrollEnabled={false}
                      javaScriptEnabled
                      mediaPlaybackRequiresUserAction
                    />
                    {communityPosting ? (
                      <View style={styles.communityUploadOverlay}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.communityUploadOverlayText}>{t('Uploading video...')}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Image source={{ uri: communityMedia.uri }} style={styles.communityPreviewImage} />
                )}
                <TouchableOpacity onPress={() => setCommunityMedia(null)} style={styles.communityPreviewRemove}>
                  <Text style={styles.communityPreviewRemoveText}>{t('Remove media')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!communityMedia?.uri && communityVideoLink.trim() ? (
              <View style={styles.communityPreviewCard}>
                <View style={styles.communityPreviewVideoWrap}>
                  <CrossPlatformWebView
                    source={{ html: buildCommunityVideoHtml(normalizeExternalCommunityVideoUrl(communityVideoLink) || communityVideoLink.trim()) }}
                    style={styles.communityPreviewVideo}
                    scrollEnabled={false}
                    javaScriptEnabled
                    mediaPlaybackRequiresUserAction
                  />
                </View>
                <TouchableOpacity onPress={() => setCommunityVideoLink('')} style={styles.communityPreviewRemove}>
                  <Text style={styles.communityPreviewRemoveText}>{t('Remove link')}</Text>
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
                    <View style={styles.postMediaFrame}>
                      <Image source={getImageSource(post.image_url)!} style={styles.postImagePreview} />
                      {post.is_pending_upload ? (
                        <View style={styles.postUploadingOverlay}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.postUploadingText}>{t('Uploading...')}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : getCommunityVideoUrl(post.video_url) ? (
                    <View style={styles.postMediaFrame}>
                      <View style={styles.postVideoPreviewWrap}>
                        <CrossPlatformWebView
                          source={{ html: buildCommunityVideoHtml(getCommunityVideoUrl(post.video_url)) }}
                          style={styles.postVideoPreview}
                          scrollEnabled={false}
                          javaScriptEnabled
                          mediaPlaybackRequiresUserAction
                        />
                      </View>
                      <View style={styles.postVideoBadge}>
                        <Ionicons name="videocam" size={14} color="#FFFFFF" />
                        <Text style={styles.postVideoBadgeText}>{t('Video')}</Text>
                      </View>
                      {post.is_pending_upload ? (
                        <View style={styles.postUploadingOverlay}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.postUploadingText}>{t('Uploading video...')}</Text>
                        </View>
                      ) : null}
                    </View>
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
        visible={deleteTargetPost !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleteTargetPost || deleteSubmitting[deleteTargetPost.id]) {
            return;
          }
          setDeleteTargetPost(null);
        }}
      >
        <View style={styles.confirmOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!deleteTargetPost || deleteSubmitting[deleteTargetPost.id]) {
                return;
              }
              setDeleteTargetPost(null);
            }}
          />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="trash-outline" size={24} color="#F87171" />
            </View>
            <Text style={styles.confirmTitle}>{t('Delete post')}</Text>
            <Text style={styles.confirmText}>{t('Are you sure you want to delete this post?')}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                activeOpacity={0.85}
                onPress={() => setDeleteTargetPost(null)}
                disabled={!deleteTargetPost || deleteSubmitting[deleteTargetPost.id]}
              >
                <Text style={styles.confirmCancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  deleteTargetPost && deleteSubmitting[deleteTargetPost.id] ? styles.confirmDeleteButtonDisabled : null,
                ]}
                activeOpacity={0.85}
                onPress={() => {
                  if (!deleteTargetPost) {
                    return;
                  }
                  void performDeleteCommunityPost(deleteTargetPost.id);
                }}
                disabled={!deleteTargetPost || deleteSubmitting[deleteTargetPost.id]}
              >
                {deleteTargetPost && deleteSubmitting[deleteTargetPost.id] ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteText}>{t('Delete')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                ) : getCommunityVideoUrl(selectedCommunityPost.video_url) ? (
                  <View style={styles.postModalVideoWrap}>
                    <CrossPlatformWebView
                      source={{ html: buildCommunityVideoHtml(getCommunityVideoUrl(selectedCommunityPost.video_url)) }}
                      style={styles.postModalVideo}
                      scrollEnabled={false}
                      javaScriptEnabled
                      mediaPlaybackRequiresUserAction
                    />
                  </View>
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
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
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
    marginTop: 2,
    color: '#F5A43C',
    fontSize: 9,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  challengeLibraryFieldLabel: {
    marginTop: 8,
    marginBottom: 2,
    color: 'rgba(191,219,254,0.78)',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  challengeExpandBtn: {
    marginTop: 8,
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
    marginTop: 6,
    color: '#CBD5E1',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Inter_400Regular',
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
    position: 'relative',
  },
  communityFilterCountBadge: {
    position: 'absolute',
    top: -8,
    right: -12,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityFilterCountText: {
    color: '#07111F',
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
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
  communityFilterDoneButton: {
    marginTop: 6,
    marginBottom: 4,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(6,182,212,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.28)',
  },
  communityFilterDoneText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
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
  composerLinkInput: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  composerLinkHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
    marginHorizontal: 16,
    marginBottom: 12,
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
  communityPreviewVideoWrap: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#0B1020',
  },
  communityPreviewVideo: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  communityUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,8,20,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  communityUploadOverlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
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
  postMediaFrame: {
    position: 'relative',
    marginBottom: 14,
  },
  postImagePreview: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    resizeMode: 'cover',
  },
  postVideoPreviewWrap: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0B1020',
  },
  postVideoPreview: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  postVideoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(11,16,32,0.76)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  postVideoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  postUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,8,20,0.62)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  postUploadingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
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
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3,8,20,0.66)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#13132A',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(248,113,113,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  confirmText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  confirmCancelButton: {
    minWidth: 96,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  confirmCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  confirmDeleteButton: {
    minWidth: 96,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
  },
  confirmDeleteButtonDisabled: {
    opacity: 0.72,
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
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
  postModalVideoWrap: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0B1020',
  },
  postModalVideo: {
    flex: 1,
    backgroundColor: '#0B1020',
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
