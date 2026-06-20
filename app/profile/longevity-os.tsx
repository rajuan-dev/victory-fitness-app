import React, { useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
  Easing,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ScreenState } from '../../components/ScreenState';
import VictoryHeader from '../../components/VictoryHeader';
import {
  connectLongevityLocalProvider,
  connectWearableProvider,
  disconnectLongevityProvider,
  fetchCurrentUser,
  fetchLongevityHealthRecords,
  fetchLongevityDashboard,
  fetchIntegrationConnections,
  generateLongevityWeeklyPlan,
  HealthMetricRecord,
  HealthMetricSummaryItem,
  IntegrationConnection,
  LongevityCircle,
  LongevityDashboard,
  LongevityHabit,
  LongevityMasterclass,
  LongevityWeeklyPlan,
  LongevityWeeklyPlanSection,
  LongevityWearableDevice,
  markNativeIntegrationConnected,
  resolveRemoteAssetUrl,
  type WearableSyncResponse,
  WearableProvider,
  syncLongevityQrImport,
  syncLongevityWearables,
  updateLongevityHabit,
} from '../../lib/api';
import { WebView } from 'react-native-webview';
import { canAccessFeature } from '../../lib/access';
import {
  authorizeNativeHealthSource,
  getNativeHealthReadiness,
  openNativeHealthSettings,
  revokeNativeHealthPermissions,
  type NativeSyncTarget,
  syncNativeHealthSource,
} from '../../lib/nativeHealthSync';
import {
  appendRunLog,
} from '../../lib/runLog';
import type { RunLogEntry } from '../../lib/runLog';
import { useLanguage } from '../../lib/i18n';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

const FALLBACK_CARD_IMAGE = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80';
type TFunction = (key: string, params?: Record<string, string | number>) => string;

function formatWeeklyPlanMessage(plan: LongevityWeeklyPlan) {
  const sections = plan.plan_sections
    .map((section) => {
      const actions = section.actions.map((action) => `• ${action}`).join('\n');
      return `${section.title}\n${section.summary}${actions ? `\n${actions}` : ''}`;
    })
    .join('\n\n');

  return sections ? `${plan.message}\n\n${sections}` : plan.message;
}

function safeImageUri(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  return normalized || FALLBACK_CARD_IMAGE;
}

function resolveMasterclassMediaUrl(value: string | null | undefined) {
  return resolveRemoteAssetUrl(value) || String(value || '').trim();
}

function buildMasterclassAudioHtml(audioUrl: string) {
  const escapedUrl = String(audioUrl || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #0f172a;
        overflow: hidden;
      }
      .wrap {
        padding: 8px 10px 0;
      }
      audio {
        width: 100%;
        height: 42px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <audio controls preload="metadata" src="${escapedUrl}"></audio>
    </div>
  </body>
</html>`;
}

function normalizeMasterclassVideoUrl(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (
    /^https?:\/\/.+\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(normalized) ||
    normalized.includes('/masterclass-videos/')
  ) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname || '';

    if (host === 'youtu.be') {
      const videoId = path.replace(/^\/+/, '').split('/')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0` : '';
    }

    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      const videoId = path.startsWith('/embed/')
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

function buildMasterclassVideoHtml(videoUrl: string) {
  const escapedUrl = String(videoUrl || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const isDirectVideo =
    /^https?:\/\/.+\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(videoUrl) ||
    videoUrl.includes('/masterclass-videos/');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #0f172a;
        height: 100%;
        overflow: hidden;
      }
      iframe, video {
        width: 100%;
        height: 100%;
        border: 0;
        background: #0f172a;
      }
      video {
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    ${isDirectVideo
      ? `<video controls playsinline preload="metadata" src="${escapedUrl}"></video>`
      : `<iframe src="${escapedUrl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`}
  </body>
</html>`;
}

function getHealPlanSectionId(value: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return 'heart_health';
  }
  if (normalized.includes('heart') || normalized.includes('blood pressure') || normalized.includes('hbp')) {
    return 'heart_health';
  }
  if (normalized.includes('recover') || normalized.includes('workout')) {
    return 'post_workout_recovery';
  }
  if (normalized.includes('mental') || normalized.includes('anxiety') || normalized.includes('stress')) {
    return 'mental_health_and_anxiety';
  }
  if (normalized.includes('immunity') || normalized.includes('infection') || normalized.includes('immune')) {
    return 'immunity_and_infection';
  }
  return 'heart_health';
}

function getHealPlanSection(plan: LongevityWeeklyPlan | null | undefined, healCardId: string): LongevityWeeklyPlanSection | null {
  if (!plan?.plan_sections?.length) {
    return null;
  }
  const preferredSectionId = getHealPlanSectionId(healCardId);
  return plan.plan_sections.find((section) => section.id === preferredSectionId) ?? plan.plan_sections[0] ?? null;
}

function isVisibleWearableForPlatform(deviceId: string) {
  if (Platform.OS === 'ios') {
    return deviceId !== 'health-connect' && deviceId !== 'this-phone';
  }
  if (Platform.OS === 'android') {
    return deviceId !== 'apple-health' && deviceId !== 'this-phone';
  }
  return deviceId !== 'this-phone';
}

function getPlatformHealthSources(deviceId: string) {
  if (deviceId === 'apple-health') {
    return ['Apple Health', 'Apple Watch', 'Oura', 'Withings', 'Polar'];
  }
  if (deviceId === 'health-connect') {
    return ['Runmefit', 'Android health apps', 'Galaxy Watch', 'Pixel Watch', 'Amazfit'];
  }
  if (deviceId === 'this-phone') {
    return Platform.OS === 'ios'
      ? ['Apple Health', 'Apple Watch', 'Oura', 'Withings', 'Polar']
      : Platform.OS === 'android'
        ? ['Runmefit', 'Android health apps', 'Galaxy Watch', 'Pixel Watch', 'Amazfit']
        : ['Supported mobile health sources'];
  }
  return [];
}

function getRunmefitBridgeTitle(t: TFunction, deviceId: string) {
  if (deviceId === 'apple-health') {
    return t('Apple Health source bridge');
  }
  if (deviceId === 'health-connect') {
    return t('Health Connect source bridge');
  }
  if (deviceId === 'this-phone') {
    return Platform.OS === 'ios'
      ? t('Apple Health source bridge on this iPhone')
      : Platform.OS === 'android'
        ? t('Health Connect source bridge on this Android phone')
        : t('Native phone health bridge');
  }
  return t('Native health source bridge');
}

function getRunmefitBridgeSummary(t: TFunction, deviceId: string) {
  if (deviceId === 'apple-health') {
    return t('Connect Apple Health once to read approved records from iPhone health apps and devices.');
  }
  if (deviceId === 'health-connect') {
    return t('Connect Health Connect once to read approved records from Android health apps and devices.');
  }
  if (deviceId === 'this-phone') {
    return Platform.OS === 'ios'
      ? t('Use Apple Health on this iPhone, then press Sync Data here.')
      : Platform.OS === 'android'
        ? t('Use Health Connect on this Android phone, then press Sync Data here.')
        : t('Sync into the phone health store first, then press Sync Data here.');
  }
  return t('Connect the supported phone health framework first, then press Sync Data here.');
}

function getWearableSourceDescription(t: TFunction, deviceId: string) {
  switch (deviceId) {
    case 'fitbit':
      return t('Browser login with Fitbit OAuth');
    case 'google-fit':
      return t('Browser login with Google OAuth for Google Fit');
    case 'garmin':
      return t('Browser login with Garmin OAuth');
    case 'this-phone':
      return Platform.OS === 'ios'
        ? t('Uses native Apple Health permission on this iPhone and can read data from apps that sync into Apple Health')
        : Platform.OS === 'android'
          ? t('Uses native Health Connect permission on this Android phone and can read data from apps that sync into Health Connect')
          : t('Uses native phone health permission');
    case 'qr-import':
      return t('Fallback import by QR payload');
    case 'apple-health':
      return t('Native Apple Health permission for Apple Health and other iPhone health sources');
    case 'health-connect':
      return t('Native Health Connect permission for Android health data from connected apps and devices');
    default:
      return t('Health data source');
  }
}

function getWearableDisplayName(t: TFunction, deviceId: string, fallbackName: string) {
  switch (deviceId) {
    case 'apple-health':
      return t('Apple Health Sources');
    case 'health-connect':
      return t('Android Health Sources');
    case 'fitbit':
      return t('Fitbit Devices');
    case 'google-fit':
      return t('Google Fit');
    case 'garmin':
      return t('Garmin Devices');
    case 'this-phone':
      return Platform.OS === 'ios' ? t('This iPhone') : Platform.OS === 'android' ? t('This Android Phone') : fallbackName;
    case 'qr-import':
      return t('QR Import / Other Device');
    default:
      return fallbackName;
  }
}

function getWearableCompatibleDevices(t: TFunction, deviceId: string) {
  switch (deviceId) {
    case 'apple-health':
      return [t('Apple Watch'), t('iPhone Health'), t('Oura Ring'), t('Withings'), t('Polar'), t('Health apps synced to Apple Health')];
    case 'health-connect':
      return [t('Runmefit'), t('Android health apps'), t('Galaxy Watch'), t('Pixel Watch'), t('Amazfit')];
    case 'fitbit':
      return [t('Fitbit Charge'), t('Fitbit Sense'), t('Fitbit Versa'), t('Google Fitbit')];
    case 'google-fit':
      return [t('Google Fit account'), t('Android Fitness Store'), t('Google ecosystem')];
    case 'garmin':
      return [t('Garmin Venu'), t('Garmin Forerunner'), t('Garmin Fenix'), t('Garmin Instinct')];
    case 'this-phone':
      return Platform.OS === 'ios'
        ? [t('Apple Health'), t('Apple Watch on this iPhone'), t('Oura'), t('Withings')]
        : Platform.OS === 'android'
          ? [t('Runmefit'), t('Android health apps'), t('Health Connect'), t('Galaxy Watch'), t('Pixel Watch')]
          : [t('Native mobile health source')];
    case 'qr-import':
      return [t('Other wearable export'), t('Partner QR bridge'), t('Manual clinic data')];
    default:
      return [];
  }
}

function getWearableFlowSummary(t: TFunction, deviceId: string) {
  switch (deviceId) {
    case 'fitbit':
      return t('Login in browser, return to app, then sync real Fitbit data.');
    case 'google-fit':
      return t('Login in browser with Google, return to app, then sync Google Fit data.');
    case 'garmin':
      return t('Login in browser, return to app, then sync real Garmin data.');
    case 'apple-health':
      return t('Approve Apple Health access on iPhone, then sync Apple Health records from connected iPhone health apps and devices.');
    case 'health-connect':
      return t('Approve Health Connect access on Android, then sync records from connected Android apps.');
    case 'this-phone':
      return Platform.OS === 'ios'
        ? t('Uses Apple Health on this iPhone, then syncs approved health data from connected iPhone health apps.')
        : Platform.OS === 'android'
          ? t('Uses Health Connect on this Android phone, then syncs approved health data from connected Android apps.')
          : t('Uses the native phone health connection, then syncs the approved health data.');
    case 'qr-import':
      return t('Connect the import option, then paste or scan a QR payload when syncing.');
    default:
      return t('Connect first, then sync the health data.');
  }
}

function getWearableCategoryLabel(t: TFunction, deviceId: string) {
  switch (deviceId) {
    case 'apple-health':
    case 'this-phone':
      return t('iPhone / Apple');
    case 'health-connect':
      return t('Android / Health Connect');
    case 'fitbit':
      return t('Fitbit');
    case 'google-fit':
      return t('Google Fit');
    case 'garmin':
      return t('Garmin');
    case 'qr-import':
      return t('Other Device / QR');
    default:
      return t('Other Devices');
  }
}

function getIntegrationStatusValue(integration: IntegrationConnection | undefined, isSyncing: boolean) {
  if (isSyncing) {
    return 'syncing';
  }
  if (!integration) {
    return 'not_connected';
  }
  if (integration.status === 'not_connected' && integration.needs_permission) {
    return 'needs_permission';
  }
  return integration.status;
}

function getIntegrationStatusLabel(t: TFunction, status: string) {
  switch (status) {
    case 'connected':
      return t('Connected');
    case 'needs_permission':
      return t('Needs Permission');
    case 'syncing':
      return t('Syncing');
    case 'error':
      return t('Error');
    case 'provider_not_configured':
      return t('Not Configured');
    default:
      return t('Not Connected');
  }
}

function getIntegrationStatusColor(status: string) {
  switch (status) {
    case 'connected':
      return '#10B981';
    case 'needs_permission':
      return '#F59E0B';
    case 'syncing':
      return Colors.primary;
    case 'error':
      return '#FF6B6B';
    case 'provider_not_configured':
      return '#94A3B8';
    default:
      return 'rgba(255,255,255,0.54)';
  }
}

function formatIntegrationTimestamp(value?: string | null) {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toLocaleString();
}

function formatMetricNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(2).replace(/\.?0+$/, '')}`;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DISPLAYABLE_HEALTH_METRICS = new Set([
  'steps',
  'distance',
  'calories',
  'heart_rate',
  'sleep',
  'spo2',
  'hrv',
  'stress',
  'body_battery',
  'workouts',
]);

function distanceToMeters(value: number, unit: string) {
  const normalizedUnit = String(unit || '').trim().toLowerCase();
  if (normalizedUnit === 'mi' || normalizedUnit === 'mile' || normalizedUnit === 'miles') {
    return value * 1609.344;
  }
  if (normalizedUnit === 'km' || normalizedUnit === 'kilometer' || normalizedUnit === 'kilometers') {
    return value * 1000;
  }
  return value;
}

function normalizeDistance(value: number, unit: string) {
  const normalizedUnit = String(unit || '').trim().toLowerCase();
  if (normalizedUnit === 'mi' || normalizedUnit === 'mile' || normalizedUnit === 'miles') {
    return { value, unit: 'mi' };
  }
  if (normalizedUnit === 'km' || normalizedUnit === 'kilometer' || normalizedUnit === 'kilometers') {
    return { value, unit: 'km' };
  }
  if (normalizedUnit === 'm' || normalizedUnit === 'meter' || normalizedUnit === 'meters' || !normalizedUnit) {
    return { value: value / 1000, unit: 'km' };
  }
  return { value, unit: normalizedUnit };
}

function buildHealthSummaryCards(items: HealthMetricSummaryItem[]) {
  const buckets = new Map<string, {
    metric_type: string;
    total_value: number;
    weighted_average_sum: number;
    weighted_average_count: number;
    records: number;
    unit: string;
    distance_meters: number;
    distance_unit_counts: Record<string, number>;
    latest_end_time?: string | null;
    latest_value?: number | null;
  }>();

  for (const item of items) {
    const metricType = String(item.metric_type || '').toLowerCase();
    if (!DISPLAYABLE_HEALTH_METRICS.has(metricType)) {
      continue;
    }

    const unit = String(item.unit || '').trim().toLowerCase();
    const bucket = buckets.get(metricType) ?? {
      metric_type: metricType,
      total_value: 0,
      weighted_average_sum: 0,
      weighted_average_count: 0,
      records: 0,
      unit: '',
      distance_meters: 0,
      distance_unit_counts: {},
      latest_end_time: null,
      latest_value: null,
    };

    bucket.records += Number(item.records || 0);
    const itemLatestEndTime = item.latest_end_time ? new Date(item.latest_end_time) : null;
    const bucketLatestEndTime = bucket.latest_end_time ? new Date(bucket.latest_end_time) : null;

    if (metricType === 'distance') {
      const normalizedUnit = unit === 'mi' || unit === 'mile' || unit === 'miles'
        ? 'mi'
        : 'km';
      const latestValue = Number(item.latest_value ?? item.total_value ?? 0);
      if (!bucketLatestEndTime || (itemLatestEndTime && itemLatestEndTime > bucketLatestEndTime)) {
        bucket.latest_end_time = item.latest_end_time ?? bucket.latest_end_time ?? null;
        bucket.latest_value = latestValue;
        bucket.distance_meters = distanceToMeters(latestValue, unit);
        bucket.unit = normalizedUnit;
      }
      bucket.distance_unit_counts[normalizedUnit] = Number(bucket.distance_unit_counts[normalizedUnit] || 0) + 1;
    } else if (metricType === 'steps' || metricType === 'calories' || metricType === 'workouts') {
      const latestValue = Number(item.latest_value ?? item.total_value ?? 0);
      if (!bucketLatestEndTime || (itemLatestEndTime && itemLatestEndTime > bucketLatestEndTime)) {
        bucket.latest_end_time = item.latest_end_time ?? bucket.latest_end_time ?? null;
        bucket.latest_value = latestValue;
        bucket.unit = unit || (metricType === 'calories' ? 'kcal' : 'count');
      }
    } else {
      const weight = Math.max(Number(item.records || 0), 1);
      bucket.weighted_average_sum += Number(item.average_value || 0) * weight;
      bucket.weighted_average_count += weight;
      bucket.unit = bucket.unit || unit;
      if (!bucketLatestEndTime || (itemLatestEndTime && itemLatestEndTime > bucketLatestEndTime)) {
        bucket.latest_end_time = item.latest_end_time ?? bucket.latest_end_time ?? null;
      }
    }

    buckets.set(metricType, bucket);
  }

  const priority: Record<string, number> = {
    steps: 0,
    distance: 1,
    calories: 2,
    heart_rate: 3,
    sleep: 4,
    spo2: 5,
    hrv: 6,
    stress: 7,
    body_battery: 8,
    workouts: 9,
  };

  return Array.from(buckets.values())
    .sort((left, right) => (priority[left.metric_type] ?? 99) - (priority[right.metric_type] ?? 99))
    .map((bucket) => ({
      ...bucket,
      ...(bucket.metric_type === 'distance'
        ? {
            total_value: bucket.distance_meters / ((bucket.distance_unit_counts.mi || 0) > 0 ? 1609.344 : 1000),
            unit: (bucket.distance_unit_counts.mi || 0) > 0 ? 'mi' : 'km',
          }
        : {}),
      average_value: bucket.weighted_average_count > 0 ? bucket.weighted_average_sum / bucket.weighted_average_count : 0,
      latest_value: bucket.latest_value ?? undefined,
    }));
}

function formatHealthMetricValue(item: Pick<HealthMetricSummaryItem, 'metric_type' | 'total_value' | 'average_value' | 'unit' | 'latest_value'>) {
  const metricType = String(item.metric_type || '').toLowerCase();
  const unit = String(item.unit || '').trim().toLowerCase();
  const isAdditiveLike = ['steps', 'distance', 'calories', 'workouts'].includes(metricType) || unit === 'count';
  const isRateLike = ['heart_rate', 'hrv', 'spo2', 'stress', 'body_battery'].includes(metricType);
  const isDurationLike = metricType === 'sleep' || unit === 'hours' || unit === 'hrs' || unit === 'hr' || unit === 'h';
  const value = isAdditiveLike ? Number(item.latest_value ?? item.total_value) : item.average_value;
  const displayNumber = formatMetricNumber(value);

  if (metricType === 'steps') {
    return `${displayNumber} steps`;
  }

  if (metricType === 'distance') {
    const distance = normalizeDistance(value, unit);
    return `${formatMetricNumber(distance.value)} ${distance.unit}`;
  }

  if (metricType === 'calories') {
    return unit ? `${displayNumber} ${unit}` : `${displayNumber} kcal`;
  }

  if (isDurationLike) {
    return `${displayNumber} ${unit === 'hours' ? 'hrs' : unit || 'hrs'}`;
  }

  if (isRateLike) {
    return `${displayNumber} ${unit || (metricType === 'heart_rate' ? 'bpm' : 'avg')}`;
  }

  if (unit) {
    return `${displayNumber} ${unit}`;
  }

  return `${displayNumber} ${metricType || 'avg'}`;
}

function normalizeHealthLabel(value: string) {
  const normalized = String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) {
    return 'Health Metric';
  }
  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatHealthRecordValue(value: number | string, unit: string) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const displayNumber = formatMetricNumber(value);
    return unit ? `${displayNumber} ${unit}` : displayNumber;
  }

  const text = String(value ?? '').trim();
  return text || '—';
}

function formatRecordDisplayValue(metricType: string, value: number | string, unit: string) {
  return formatHealthRecordValue(value, unit);
}

function getHealthRecordOrderValue(item: Pick<HealthMetricRecord, 'synced_at' | 'end_time' | 'start_time' | 'id'>) {
  const syncedAt = item.synced_at ? new Date(item.synced_at).getTime() : 0;
  const endTime = item.end_time ? new Date(item.end_time).getTime() : 0;
  const startTime = item.start_time ? new Date(item.start_time).getTime() : 0;
  return Number.isFinite(syncedAt) && syncedAt > 0
    ? syncedAt
    : Number.isFinite(endTime) && endTime > 0
      ? endTime
      : Number.isFinite(startTime) && startTime > 0
        ? startTime
        : String(item.id || '').length > 0
          ? 1
          : 0;
}

function mergeLatestHealthRecords(items: HealthMetricRecord[]) {
  const buckets = new Map<string, HealthMetricRecord>();

  for (const item of items) {
    const metricType = String(item.metric_type || '').trim().toLowerCase();
    if (!metricType) {
      continue;
    }

    const current = buckets.get(metricType);
    if (!current) {
      buckets.set(metricType, item);
      continue;
    }

    const currentScore = getHealthRecordOrderValue(current);
    const itemScore = getHealthRecordOrderValue(item);
    if (itemScore > currentScore) {
      buckets.set(metricType, item);
      continue;
    }

    if (itemScore === currentScore && String(item.id || '') > String(current.id || '')) {
      buckets.set(metricType, item);
    }
  }

  return Array.from(buckets.values()).sort((left, right) => {
    const leftScore = getHealthRecordOrderValue(left);
    const rightScore = getHealthRecordOrderValue(right);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    return String(left.metric_type || '').localeCompare(String(right.metric_type || ''));
  });
}

type DynamicHealthCard = {
  key: string;
  metric_type: string;
  provider: string;
  source_device: string;
  unit: string;
  value_label: string;
  records: number;
  latest_synced_at?: string | null;
  latest_end_time?: string | null;
  raw_json: string;
  analysis: string;
};

function buildDynamicHealthCards(items: HealthMetricRecord[]): DynamicHealthCard[] {
  const latestSyncedAt = items.reduce<number>((latest, item) => {
    const syncedAt = item.synced_at ? new Date(item.synced_at).getTime() : 0;
    return Number.isFinite(syncedAt) && syncedAt > latest ? syncedAt : latest;
  }, 0);
  const syncWindowMs = 5 * 60 * 1000;
  const latestBatchItems = latestSyncedAt > 0
    ? items.filter((item) => {
        const syncedAt = item.synced_at ? new Date(item.synced_at).getTime() : 0;
        return Number.isFinite(syncedAt) && syncedAt >= (latestSyncedAt - syncWindowMs);
      })
    : items;
  const sourceItems = latestBatchItems.length > 0 ? latestBatchItems : items;

  const buckets = new Map<string, {
    metric_type: string;
    provider: string;
    source_device: string;
    unit: string;
    records: number;
    latest_synced_at?: string | null;
    latest_end_time?: string | null;
    latest_record: HealthMetricRecord | null;
  }>();

  for (const item of sourceItems) {
    const metricType = String(item.metric_type || '').trim().toLowerCase();
    if (!metricType) {
      continue;
    }

    const provider = String(item.provider || '').trim().toLowerCase() || 'source';
    const sourceDevice = String(item.source_device || '').trim();
    const unit = String(item.unit || '').trim().toLowerCase();
    const key = metricType;
    const bucket = buckets.get(key) ?? {
      metric_type: metricType,
      provider,
      source_device: sourceDevice,
      unit,
      records: 0,
      latest_synced_at: null,
      latest_end_time: null,
      latest_record: null,
    };

    bucket.records += 1;
    const itemSyncedAt = item.synced_at ? new Date(item.synced_at) : null;
    const itemEndTime = item.end_time ? new Date(item.end_time) : null;
    const bucketSyncedAt = bucket.latest_synced_at ? new Date(bucket.latest_synced_at) : null;
    const bucketEndTime = bucket.latest_end_time ? new Date(bucket.latest_end_time) : null;
    const itemLatestTime = itemSyncedAt ?? itemEndTime;
    const bucketLatestTime = bucketSyncedAt ?? bucketEndTime;
    if (
      !bucket.latest_record
      || (itemLatestTime && (!bucketLatestTime || itemLatestTime > bucketLatestTime))
    ) {
      bucket.latest_synced_at = item.synced_at ?? bucket.latest_synced_at ?? null;
      bucket.latest_end_time = item.end_time ?? bucket.latest_end_time ?? null;
      bucket.latest_record = item;
      bucket.unit = unit || bucket.unit;
      bucket.source_device = sourceDevice || bucket.source_device;
      bucket.provider = provider || bucket.provider;
    }

    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .sort((left, right) => {
      const leftSyncedAt = left.latest_synced_at ? new Date(left.latest_synced_at).getTime() : 0;
      const rightSyncedAt = right.latest_synced_at ? new Date(right.latest_synced_at).getTime() : 0;
      if (leftSyncedAt !== rightSyncedAt) {
        return rightSyncedAt - leftSyncedAt;
      }

      const leftEndTime = left.latest_end_time ? new Date(left.latest_end_time).getTime() : 0;
      const rightEndTime = right.latest_end_time ? new Date(right.latest_end_time).getTime() : 0;
      if (leftEndTime !== rightEndTime) {
        return rightEndTime - leftEndTime;
      }

      return left.metric_type.localeCompare(right.metric_type) || left.provider.localeCompare(right.provider);
    })
    .map((bucket) => {
      const latest = bucket.latest_record;
      const valueLabel = latest ? formatRecordDisplayValue(bucket.metric_type, latest.value, bucket.unit) : '—';
      const analysis = [
        bucket.source_device || '',
        bucket.provider,
      ].filter(Boolean).join(' • ');
      return {
        key: [bucket.metric_type, bucket.source_device || 'source', bucket.unit || 'value'].join(':'),
        metric_type: bucket.metric_type,
        provider: bucket.provider,
        source_device: bucket.source_device,
        unit: bucket.unit,
        value_label: valueLabel,
        records: bucket.records,
        latest_synced_at: bucket.latest_synced_at,
        latest_end_time: bucket.latest_end_time,
        raw_json: latest
          ? JSON.stringify({
              metric_type: latest.metric_type,
              provider: latest.provider,
              value: latest.value,
              unit: latest.unit,
              start_time: latest.start_time,
              end_time: latest.end_time,
              synced_at: latest.synced_at,
              source_device: latest.source_device,
              metadata: latest.metadata,
            }, null, 2)
          : '',
        analysis,
      };
    });
}

function buildAllSyncedHealthCards(items: HealthMetricRecord[]): DynamicHealthCard[] {
  const buckets = new Map<string, HealthMetricRecord>();

  for (const item of items) {
    const metricType = String(item.metric_type || '').trim().toLowerCase();
    if (!DISPLAYABLE_HEALTH_METRICS.has(metricType)) {
      continue;
    }

    const current = buckets.get(metricType);
    if (!current) {
      buckets.set(metricType, item);
      continue;
    }

    const currentOrderValue = getHealthRecordOrderValue(current);
    const itemOrderValue = getHealthRecordOrderValue(item);
    if (itemOrderValue > currentOrderValue || (itemOrderValue === currentOrderValue && String(item.id || '') > String(current.id || ''))) {
      buckets.set(metricType, item);
    }
  }

  return Array.from(buckets.values())
    .sort((left, right) => {
      const leftSyncedAt = left.synced_at ? new Date(left.synced_at).getTime() : 0;
      const rightSyncedAt = right.synced_at ? new Date(right.synced_at).getTime() : 0;
      if (leftSyncedAt !== rightSyncedAt) {
        return rightSyncedAt - leftSyncedAt;
      }

      const leftEndTime = left.end_time ? new Date(left.end_time).getTime() : 0;
      const rightEndTime = right.end_time ? new Date(right.end_time).getTime() : 0;
      if (leftEndTime !== rightEndTime) {
        return rightEndTime - leftEndTime;
      }

      return String(left.metric_type || '').localeCompare(String(right.metric_type || ''));
    })
    .map((item) => {
      const metricType = String(item.metric_type || '').trim().toLowerCase();
      const provider = String(item.provider || '').trim().toLowerCase() || 'source';
      const sourceDevice = String(item.source_device || '').trim() || provider;
      const unit = String(item.unit || '').trim().toLowerCase();
      const valueLabel = formatRecordDisplayValue(metricType, item.value, unit);
      const analysis = [
        sourceDevice,
        provider,
        item.synced_at ? `synced ${new Date(item.synced_at).toLocaleString()}` : '',
      ].filter(Boolean).join(' • ');

      return {
        key: String(item.id || [metricType, provider, item.synced_at || item.end_time || item.start_time || valueLabel].join(':')),
        metric_type: metricType,
        provider,
        source_device: sourceDevice,
        unit,
        value_label: valueLabel,
        records: 1,
        latest_synced_at: item.synced_at ?? null,
        latest_end_time: item.end_time ?? null,
        raw_json: JSON.stringify(item),
        analysis,
      };
    });
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function LoadingState({ t }: { t: TFunction }) {
  return <ScreenState mode="loading" message={t('Loading Longevity OS...')} />;
}

function EmptyState({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={52} color="rgba(255,255,255,0.14)" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function LongevityOS() {
  const checkingAccess = useModuleAccessGuard('/profile/longevity-os');
  const router = useRouter();
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState<LongevityDashboard | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingWearables, setSyncingWearables] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [canGenerateLongevityPlan, setCanGenerateLongevityPlan] = useState(false);
  const [showWearablePicker, setShowWearablePicker] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [selectedWearableIds, setSelectedWearableIds] = useState<string[]>([]);
  const [showQrImportModal, setShowQrImportModal] = useState(false);
  const [masterclassVideoModal, setMasterclassVideoModal] = useState<{ title: string; embedUrl: string } | null>(null);
  const [qrPayload, setQrPayload] = useState('');
  const [importingPayload, setImportingPayload] = useState(false);
  const [healthSummary, setHealthSummary] = useState<HealthMetricRecord[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [syncingProviderIds, setSyncingProviderIds] = useState<string[]>([]);
  const [syncProgressMessage, setSyncProgressMessage] = useState<string>('');
  const [nativeConnectionSuccessDeviceId, setNativeConnectionSuccessDeviceId] = useState<string | null>(null);
  const [nativeConnectionFailedDeviceId, setNativeConnectionFailedDeviceId] = useState<string | null>(null);
  const [nativeConnectionDisconnectedDeviceId, setNativeConnectionDisconnectedDeviceId] = useState<string | null>(null);
  const [nativeConnectionFailureMessage, setNativeConnectionFailureMessage] = useState<string>('');
  const [screenError, setScreenError] = useState<{ title: string; message: string } | null>(null);
  const nativeSuccessOpacity = useRef(new Animated.Value(0)).current;
  const nativeSuccessScale = useRef(new Animated.Value(0.7)).current;
  const nativeSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeFailureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabs = React.useMemo(() => ([
    { id: 'overview', label: t('OVERVIEW'), icon: 'pulse-outline' },
    { id: 'wearables', label: t('WEARABLES'), icon: 'watch-outline' },
    { id: 'heal', label: t('HEAL'), icon: 'restaurant-outline' },
    { id: 'habits', label: t('HABITS'), icon: 'checkbox-outline' },
    { id: 'learn', label: t('LEARN'), icon: 'book-outline' },
  ]), [t]);

  const recordRunLog = React.useCallback((entry: Omit<RunLogEntry, 'id' | 'timestamp'>) => {
    void appendRunLog({
      ...entry,
      route: '/profile/longevity-os',
      context: 'LongevityOS',
    });
  }, []);

  const showScreenError = React.useCallback((title: string, message: string) => {
    setScreenError({ title, message });
    recordRunLog({
      level: 'error',
      title,
      message,
    });
  }, [recordRunLog]);

  const dismissScreenError = React.useCallback(() => {
    setScreenError(null);
  }, []);

  const visibleHealthSummaryCards = buildAllSyncedHealthCards(healthSummary);
  const overviewHealthCards = visibleHealthSummaryCards;

  const localizeDashboard = React.useCallback((response: LongevityDashboard): LongevityDashboard => {
    const localizeText = (value: string) => t(value);
    return {
      ...response,
      quick_actions: Array.isArray(response.quick_actions)
        ? response.quick_actions.map((item) => ({
            ...item,
            label: localizeText(item.label),
            subtitle: localizeText(item.subtitle),
          }))
        : [],
      wearables: {
        ...response.wearables,
        sync_message: localizeText(response.wearables?.sync_message || ''),
      },
      habits: {
        ...response.habits,
        habits: Array.isArray(response.habits?.habits)
          ? response.habits.habits.map((habit) => ({
              ...habit,
              title: localizeText(habit.title),
              subtitle: localizeText(habit.subtitle),
            }))
          : [],
      },
      heal_categories: Array.isArray(response.heal_categories)
        ? response.heal_categories.map((item) => ({
            ...item,
            label: localizeText(item.label),
          }))
        : [],
      weekly_plan: response.weekly_plan
        ? {
            ...response.weekly_plan,
            message: localizeText(response.weekly_plan.message),
            plan_sections: Array.isArray(response.weekly_plan.plan_sections)
              ? response.weekly_plan.plan_sections.map((section) => ({
                  ...section,
                  title: localizeText(section.title),
                  summary: localizeText(section.summary),
                  actions: Array.isArray(section.actions) ? section.actions.map((action) => localizeText(action)) : [],
                }))
              : [],
          }
        : null,
      masterclasses: Array.isArray(response.masterclasses)
        ? response.masterclasses.map((item) => ({
            ...item,
            title: localizeText(item.title),
            description: localizeText(item.description),
          }))
        : [],
      circles: Array.isArray(response.circles)
        ? response.circles.map((item) => ({
            ...item,
            name: localizeText(item.name),
            description: localizeText(item.description),
          }))
        : [],
    };
  }, [t]);

  const loadIntegrationStatuses = React.useCallback(async () => {
    const response = await fetchIntegrationConnections();
    setIntegrations(Array.isArray(response.items) ? response.items : []);
  }, []);

  const loadDashboard = React.useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const today = formatLocalDate(new Date());
      const [response, user, records, integrationResponse] = await Promise.all([
        fetchLongevityDashboard(language),
        fetchCurrentUser(),
        fetchLongevityHealthRecords({}, language).catch(() => null),
        fetchIntegrationConnections().catch(() => null),
      ]);
      setDashboard(localizeDashboard(response));
      const activeDeviceIds = Array.isArray(response?.wearables?.devices)
        ? response.wearables.devices.filter((device) => device.active && isVisibleWearableForPlatform(device.id)).map((device) => device.id)
        : [];
      setSelectedWearableIds((current) => {
        if (activeDeviceIds.length > 0) {
          return [activeDeviceIds[0]];
        }
        return [];
      });
      setHealthSummary(mergeLatestHealthRecords(Array.isArray(records?.items) ? records.items : []));
      setIntegrations(Array.isArray(integrationResponse?.items) ? integrationResponse.items : []);
      setCanGenerateLongevityPlan(canAccessFeature('longevity_plan', user));
      dismissScreenError();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Unable to load Longevity OS.');
      showScreenError(t('Load failed'), message);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [dismissScreenError, language, localizeDashboard, showScreenError, t]);

  const refreshDashboardAfterSync = React.useCallback(async () => {
    try {
      const response = await fetchLongevityDashboard(language);
      setDashboard(localizeDashboard(response));
      setSelectedWearableIds((current) => {
        const activeDeviceIds = Array.isArray(response?.wearables?.devices)
          ? response.wearables.devices.filter((device) => device.active && isVisibleWearableForPlatform(device.id)).map((device) => device.id)
          : [];
        if (activeDeviceIds.length > 0) {
          return [activeDeviceIds[0]];
        }
        return current;
      });
    } catch (error) {
      console.warn('[LongevityOS] Dashboard refresh after sync failed:', error);
    }
  }, [language, localizeDashboard]);

  const refreshHealthSummaryAfterSync = React.useCallback(async () => {
    try {
      const response = await fetchLongevityHealthRecords({}, language);
      setHealthSummary(mergeLatestHealthRecords(Array.isArray(response?.items) ? response.items : []));
    } catch (error) {
      console.warn('[LongevityOS] Health summary refresh after sync failed:', error);
    }
  }, [language]);

  useFocusEffect(
    React.useCallback(() => {
      void loadDashboard(true);
    }, [loadDashboard]),
  );

  React.useEffect(() => {
    if (activeTab !== 'wearables') {
      return;
    }
    const interval = setInterval(() => {
      void loadIntegrationStatuses().catch(() => undefined);
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab, loadIntegrationStatuses]);

  React.useEffect(() => () => {
    if (nativeSuccessTimerRef.current) {
      clearTimeout(nativeSuccessTimerRef.current);
    }
    if (nativeFailureTimerRef.current) {
      clearTimeout(nativeFailureTimerRef.current);
    }
    if (nativeDisconnectTimerRef.current) {
      clearTimeout(nativeDisconnectTimerRef.current);
    }
  }, []);

  const handleRefresh = React.useCallback(async () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    try {
      await loadDashboard(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard, refreshing]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void handleRefresh()}
      tintColor={Colors.primary}
      colors={[Colors.primary]}
      progressBackgroundColor="#0F172A"
    />
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile');
    }
  };

  const syncWearableTargets = React.useCallback(async (
    targetDeviceIds: string[],
    options: { showSuccessAlert?: boolean; showFailureAlert?: boolean } = {},
  ): Promise<WearableSyncResponse | null> => {
    const {
      showSuccessAlert = true,
      showFailureAlert = true,
    } = options;
    if (syncingWearables) {
      return null;
    }
    const connectedDeviceIds = (dashboard?.wearables.devices || [])
      .filter((device) => device.active && isVisibleWearableForPlatform(device.id))
      .map((device) => device.id);

    if (targetDeviceIds.length === 0) {
      showScreenError(t('Add device'), t('Connect a device first, then press Sync Data Now.'));
      return null;
    }
    if (targetDeviceIds.length === 1 && targetDeviceIds[0] === 'qr-import') {
      setShowQrImportModal(true);
      return null;
    }
    if (targetDeviceIds.includes('qr-import')) {
      showScreenError(
        t('Sync separately'),
        t('QR Import needs a payload input, so sync it separately from Fitbit, Google Fit, Garmin, Apple Health, or Health Connect.'),
      );
      return null;
    }

    const wantsAppleHealth = targetDeviceIds.includes('apple-health');
    const wantsHealthConnect = targetDeviceIds.includes('health-connect');
    const wantsThisPhone = targetDeviceIds.includes('this-phone');
    const backendProviderIds = targetDeviceIds.filter((providerId) => !['apple-health', 'health-connect', 'this-phone'].includes(providerId));
    const incrementalSyncStart = dashboard?.wearables.last_synced_at || undefined;

    setSyncingWearables(true);
    setSyncingProviderIds(targetDeviceIds);
    setSyncProgressMessage(t('Preparing sync...'));
    try {
      const tasks: Promise<WearableSyncResponse | void>[] = [];
      const nativeTargets = new Set<NativeSyncTarget>();

      if (Platform.OS === 'ios' && (wantsAppleHealth || wantsThisPhone)) {
        nativeTargets.add('apple-health');
      }
      if (Platform.OS === 'android' && (wantsHealthConnect || wantsThisPhone)) {
        nativeTargets.add('health-connect');
      }

      for (const provider of nativeTargets) {
        setSyncProgressMessage(provider === 'health-connect' ? t('Reading Health Connect data...') : t('Reading Apple Health data...'));
        try {
          tasks.push(syncNativeHealthSource(provider, { startFrom: incrementalSyncStart }));
        } catch (error) {
          if (error instanceof Error && error.message === 'Health Connect sync is only available on Android.') {
            throw new Error(t('Health Connect is available on Android only.'));
          }
          if (error instanceof Error && error.message === 'Apple Health sync is only available on iPhone.') {
            throw new Error(t('Apple Health is available on iPhone only.'));
          }
          throw error;
        }
      }

      if (Platform.OS === 'ios' && wantsHealthConnect) {
        throw new Error(t('Health Connect is available on Android only.'));
      }
      if (Platform.OS === 'android' && wantsAppleHealth) {
        throw new Error(t('Apple Health is available on iPhone only.'));
      }

      if (tasks.length === 0 && backendProviderIds.length === 0) {
        throw new Error(t('Select at least one supported data source to sync.'));
      }

      if (backendProviderIds.length > 0) {
        setSyncProgressMessage(t('Syncing {providers}...', { providers: backendProviderIds.join(', ') }));
        tasks.push(syncLongevityWearables(backendProviderIds as WearableProvider[], language).then(() => undefined));
      }

      let syncResponses: WearableSyncResponse[] = [];
      try {
        const resolved = await Promise.all(tasks);
        syncResponses = resolved.filter((item): item is WearableSyncResponse => Boolean(item && typeof item === 'object' && 'synced_records' in item));
      } catch (error) {
        if (error instanceof Error && error.message.includes('No Health Connect records were found for the last 7 days.')) {
          throw new Error(t('Health Connect is connected, but no records were found in the last 7 days. Open Health Connect and confirm your Android health app is writing data.'));
        }
        if (error instanceof Error && error.message.includes('No Apple Health records were found for the last 7 days.')) {
          throw new Error(t('Apple Health is connected, but no records were found in the last 7 days. Confirm your health apps or devices are writing data into Apple Health.'));
        }
        throw error;
      }

      setSyncProgressMessage(t('Updating dashboard...'));
      void refreshDashboardAfterSync();
      void refreshHealthSummaryAfterSync();
      if (showSuccessAlert) {
        Alert.alert(t('Data sync successful'), t('All available synced health records are now flowing into Longevity OS.'));
      }
      setSyncProgressMessage(t('Sync complete.'));
      dismissScreenError();
      return syncResponses[0] || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync wearables.';
      if (showFailureAlert) {
      showScreenError(t('Sync failed'), message);
      }
      throw error;
    } finally {
      setSyncingWearables(false);
      setSyncingProviderIds([]);
      setSyncProgressMessage('');
    }
  }, [dashboard?.wearables.devices, dismissScreenError, language, loadDashboard, refreshHealthSummaryAfterSync, refreshDashboardAfterSync, showScreenError, syncingWearables, t]);

  const handleSyncWearables = async () => {
    if (syncingWearables) {
      return;
    }
    const connectedDeviceIds = (dashboard?.wearables.devices || [])
      .filter((device) => device.active && isVisibleWearableForPlatform(device.id))
      .map((device) => device.id);
    const targetDeviceIds = selectedWearableIds.length > 0 ? selectedWearableIds : connectedDeviceIds;
    try {
      const syncResponse = await syncWearableTargets(targetDeviceIds, { showSuccessAlert: true, showFailureAlert: true });
      const payloadPreview = syncResponse?.payload_preview ?? [];
      const lastPayloadPreview = payloadPreview.length > 0 ? payloadPreview[payloadPreview.length - 1] : null;
      recordRunLog({
        level: 'success',
        title: t('Sync complete'),
        message: syncResponse
          ? (lastPayloadPreview
            ? JSON.stringify(lastPayloadPreview)
            : '')
          : t('Longevity OS synced the selected health sources successfully.'),
      });
    } catch {
      // The sync path already surfaces a card-level error for the user.
    }
  };

  const playNativeSuccessAnimation = (deviceId: string) => {
    if (nativeSuccessTimerRef.current) {
      clearTimeout(nativeSuccessTimerRef.current);
    }
    if (nativeFailureTimerRef.current) {
      clearTimeout(nativeFailureTimerRef.current);
    }
    setNativeConnectionFailedDeviceId(null);
    setNativeConnectionFailureMessage('');
    setNativeConnectionSuccessDeviceId(deviceId);
    nativeSuccessOpacity.setValue(0);
    nativeSuccessScale.setValue(0.7);
    Animated.parallel([
      Animated.timing(nativeSuccessOpacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(nativeSuccessScale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
    nativeSuccessTimerRef.current = setTimeout(() => {
      setNativeConnectionSuccessDeviceId(null);
    }, 8000);
  };

  const handleAddWearable = () => {
    setNativeConnectionSuccessDeviceId(null);
    setNativeConnectionFailedDeviceId(null);
    setNativeConnectionFailureMessage('');
    setShowWearablePicker(true);
  };

  const handleToggleWearableSelection = (deviceId: string) => {
    setSelectedWearableIds([deviceId]);
  };

  const handleChooseDevice = async (device: LongevityWearableDevice) => {
    if (device.active) {
      setSelectedWearableIds([device.id]);
      setShowWearablePicker(false);
      return;
    }
    await handleSelectWearable(device);
  };

  const handleDisconnectWearable = async (device: LongevityWearableDevice) => {
    if (connectingDeviceId) {
      return;
    }
    setConnectingDeviceId(device.id);
    try {
      if (Platform.OS === 'android' && (device.id === 'health-connect' || device.id === 'this-phone')) {
        await revokeNativeHealthPermissions('health-connect').catch(() => undefined);
      }
      await disconnectLongevityProvider(device.id as WearableProvider);
      setSelectedWearableIds((current) => current.filter((item) => item !== device.id));
      setNativeConnectionSuccessDeviceId(null);
      setNativeConnectionFailedDeviceId(null);
      setNativeConnectionFailureMessage('');
      setNativeConnectionDisconnectedDeviceId(device.id);
      await loadDashboard(false);
      dismissScreenError();
      recordRunLog({
        level: 'info',
        title: t('Device disconnected'),
        message: t('{deviceName} disconnected from Longevity OS.', { deviceName: getWearableDisplayName(t, device.id, device.name) }),
      });
      if (nativeDisconnectTimerRef.current) {
        clearTimeout(nativeDisconnectTimerRef.current);
      }
      nativeDisconnectTimerRef.current = setTimeout(() => {
        setNativeConnectionDisconnectedDeviceId(null);
      }, 8000);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Unable to disconnect {deviceName}.', { deviceName: device.name });
      showScreenError(t('Disconnect failed'), message);
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const handlePromptDisconnectWearable = (device: LongevityWearableDevice) => {
    if (connectingDeviceId) {
      return;
    }
    Alert.alert(
      t('Disconnect device?'),
      t('Disconnect {deviceName} from Longevity OS?', { deviceName: getWearableDisplayName(t, device.id, device.name) }),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Disconnect'), style: 'destructive', onPress: () => void handleDisconnectWearable(device) },
      ],
    );
  };

  const closeQrImportModal = () => {
    setShowQrImportModal(false);
    setQrPayload('');
  };

  const handleSelectWearable = async (device: LongevityWearableDevice) => {
    if (connectingDeviceId) {
      return;
    }
    setNativeConnectionFailedDeviceId(null);
    setNativeConnectionFailureMessage('');
    setNativeConnectionDisconnectedDeviceId(null);
    const integration = integrations.find((item) => item.provider === device.id);
    if (integration?.status === 'provider_not_configured') {
      showScreenError(t('Provider not configured'), t('{deviceName} is not configured on the backend yet.', { deviceName: getWearableDisplayName(t, device.id, device.name) }));
      return;
    }
    setConnectingDeviceId(device.id);
    try {
      if (device.id === 'fitbit' || device.id === 'google-fit' || device.id === 'garmin') {
        const response = await connectWearableProvider(device.id);
        const supported = await Linking.canOpenURL(response.authorization_url);
        if (!supported) {
          throw new Error(t('Unable to open the wearable connection page.'));
        }
        await Linking.openURL(response.authorization_url);
        Alert.alert(t('Continue in browser'), t('Finish the {deviceName} login in browser, then return here and press Sync Data.', { deviceName: device.name }));
      } else if (Platform.OS === 'web' && device.id === 'apple-health') {
        Alert.alert(t('Open mobile app'), t('Open the iPhone app to connect Apple Health and approve Health permissions.'));
      } else if (Platform.OS === 'web' && device.id === 'health-connect') {
        Alert.alert(t('Open mobile app'), t('Open the Android app to connect Health Connect and approve permissions.'));
      } else if (Platform.OS === 'web' && device.id === 'this-phone') {
        Alert.alert(t('Use mobile app'), t('Connect the native health source from the mobile app on the device you want to sync.'));
      } else if (
        (Platform.OS === 'ios' && (device.id === 'apple-health' || device.id === 'this-phone')) ||
        (Platform.OS === 'android' && (device.id === 'health-connect' || device.id === 'this-phone'))
      ) {
        const readiness = await getNativeHealthReadiness(device.id as NativeSyncTarget);
        const detectedSourceLabel = Array.isArray(readiness.detectedSourceLabels) && readiness.detectedSourceLabels.length > 0
          ? readiness.detectedSourceLabels.join(', ')
          : getWearableDisplayName(t, device.id, device.name);
        if (
          readiness.status === 'unsupported_platform' ||
          readiness.status === 'update_required' ||
          readiness.action === 'open_settings'
        ) {
          throw new Error(readiness.message);
        }
        try {
          await authorizeNativeHealthSource(device.id as NativeSyncTarget);
          const refreshedReadiness = await getNativeHealthReadiness(device.id as NativeSyncTarget);
          if (!refreshedReadiness.isReady && refreshedReadiness.status !== 'ready') {
            throw new Error(refreshedReadiness.message);
          }
          await markNativeIntegrationConnected({
            provider: device.id as WearableProvider,
            permission_granted: true,
            platform: Platform.OS,
            source_device: detectedSourceLabel,
            metadata: {
              bridge_mode: 'native-aggregator',
              bridge_title: Platform.OS === 'ios' ? t('Apple Health source bridge') : t('Android Health Connect source bridge'),
              bridge_summary: Platform.OS === 'ios'
                ? t('Reads approved data from apps and devices that sync into Apple Health.')
                : t('Reads approved data from apps and devices that sync into Health Connect.'),
              accepted_sources: getPlatformHealthSources(device.id),
              preferred_source_hints: ['Runmefit', 'Android health apps', 'Apple Health'],
            },
          });
          playNativeSuccessAnimation(device.id);
          setNativeConnectionDisconnectedDeviceId(null);
          recordRunLog({
            level: 'success',
            title: t('Connected successfully'),
            message: `${getWearableDisplayName(t, device.id, device.name)} connected and permission was granted.`,
          });
          dismissScreenError();
          await syncWearableTargets(
            [device.id],
            { showSuccessAlert: false, showFailureAlert: false },
          );
        } catch (connectError) {
          const message = connectError instanceof Error ? connectError.message : t('Unable to connect {deviceName}.', { deviceName: device.name });
          await markNativeIntegrationConnected({
            provider: device.id as WearableProvider,
            permission_granted: false,
            platform: Platform.OS,
            source_device: detectedSourceLabel,
            metadata: {
              bridge_mode: 'native-aggregator',
              bridge_title: Platform.OS === 'ios' ? t('Apple Health source bridge') : t('Android Health Connect source bridge'),
              bridge_summary: Platform.OS === 'ios'
                ? t('Reads approved data from apps and devices that sync into Apple Health.')
                : t('Reads approved data from apps and devices that sync into Health Connect.'),
              accepted_sources: getPlatformHealthSources(device.id),
              preferred_source_hints: ['Runmefit', 'Android health apps', 'Apple Health'],
              connection_failed: true,
              failure_message: message,
            },
          }).catch(() => undefined);
          setNativeConnectionFailedDeviceId(device.id);
          setNativeConnectionFailureMessage(message);
          recordRunLog({
            level: 'error',
            title: t('Connection failed'),
            message,
          });
          if (nativeFailureTimerRef.current) {
            clearTimeout(nativeFailureTimerRef.current);
          }
          nativeFailureTimerRef.current = setTimeout(() => {
            setNativeConnectionFailedDeviceId(null);
            setNativeConnectionFailureMessage('');
          }, 8000);
          throw new Error('__NATIVE_CONNECT_FAILED__');
        }
      } else {
        await connectLongevityLocalProvider(device.id as WearableProvider);
        recordRunLog({
          level: 'success',
          title: t('Device added'),
          message: `${getWearableDisplayName(t, device.id, device.name)} was added.`,
        });
        if (device.id === 'qr-import') {
          Alert.alert(t('{deviceName} added', { deviceName: device.name }), t('QR import is ready. Press Sync Data, then scan or paste the QR payload to save real synced data.'));
        } else if (device.id === 'this-phone') {
          Alert.alert(t('{deviceName} added', { deviceName: device.name }), t('This phone is ready. Press Sync Data to read live health data from {source}.', { source: Platform.OS === 'ios' ? t('Apple Health and connected iPhone health apps') : Platform.OS === 'android' ? t('Health Connect and connected Android health apps') : t('your supported mobile health source') }));
        } else if (device.id === 'apple-health' || device.id === 'health-connect') {
          Alert.alert(t('{deviceName} added', { deviceName: device.name }), t('Press Sync Data to read real health records from {deviceName} and store them in Longevity OS. This path accepts any supported source that syncs into the OS health store.', { deviceName: device.name }));
        } else {
          Alert.alert(t('{deviceName} added', { deviceName: device.name }), t('{deviceName} is ready. Press Sync Data to import synced health data.', { deviceName: device.name }));
        }
      }
      setSelectedWearableIds([device.id]);
      setShowWearablePicker(false);
      if (device.id !== 'apple-health' && device.id !== 'health-connect' && device.id !== 'this-phone') {
        await loadDashboard(false);
      }
      dismissScreenError();
    } catch (error) {
      if (error instanceof Error && error.message === '__NATIVE_CONNECT_FAILED__') {
        return;
      }
      const message = error instanceof Error ? error.message : t('Unable to add {deviceName}.', { deviceName: device.name });
      showScreenError(t('Add wearable failed'), message);
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const handleImportQrPayload = async () => {
    if (importingPayload) {
      return;
    }
    setImportingPayload(true);
    try {
      const response = await syncLongevityQrImport(qrPayload, 'QR Import', language);
      await loadDashboard(false);
      closeQrImportModal();
      dismissScreenError();
      recordRunLog({
        level: 'success',
        title: t('QR imported'),
        message: response.message || t('QR health data was imported successfully.'),
      });
      Alert.alert(t('QR data imported'), response.message || t('The QR health data was stored successfully.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Unable to import QR health data.');
      showScreenError(t('Import failed'), message);
    } finally {
      setImportingPayload(false);
    }
  };

  const handleGenerateWeeklyPlan = async () => {
    if (generatingPlan) {
      return;
    }
    setGeneratingPlan(true);
    try {
      const response = await generateLongevityWeeklyPlan(language);
      setDashboard((current) => (current ? localizeDashboard({ ...current, weekly_plan: response }) : current));
      await loadDashboard(false);
      dismissScreenError();
      recordRunLog({
        level: 'success',
        title: t('Weekly plan ready'),
        message: t('The AI weekly plan was generated and saved.'),
      });
      Alert.alert(t('Weekly plan ready'), t('Your AI weekly plan has been generated and saved in Healthy Food Library.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Unable to generate weekly plan.');
      const timedOut = message.toLowerCase().includes('timed out');
      if (timedOut) {
        let recovered = false;
        for (const delayMs of [1500, 3000, 5000]) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          try {
            const refreshedDashboard = await fetchLongevityDashboard(language);
            setDashboard(localizeDashboard(refreshedDashboard));
            if (refreshedDashboard.weekly_plan) {
              recovered = true;
              dismissScreenError();
              recordRunLog({
                level: 'success',
                title: t('Weekly plan ready'),
                message: t('The AI weekly plan finished after the request timed out and was loaded from the dashboard.'),
              });
              Alert.alert(t('Weekly plan ready'), t('Your AI weekly plan finished generating and is now available in Healthy Food Library.'));
              break;
            }
          } catch {
            // Keep retrying until the dashboard reflects the saved plan or retries are exhausted.
          }
        }
        if (recovered) {
          return;
        }
      }
      showScreenError(t('Generation failed'), message);
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleToggleHabit = async (habit: LongevityHabit) => {
    try {
      const response = await updateLongevityHabit(habit.id, !habit.done, language);
      setDashboard((current) => (current ? localizeDashboard({ ...current, habits: response }) : current));
      dismissScreenError();
      recordRunLog({
        level: 'info',
        title: t('Habit updated'),
        message: t('{habitTitle} is now {state}.', { habitTitle: habit.title, state: !habit.done ? t('done') : t('not done') }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Unable to update habit.');
      showScreenError(t('Update failed'), message);
    }
  };

  const renderOverview = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      {overviewHealthCards.length > 0 ? (
        <View style={styles.summaryGrid}>
          {overviewHealthCards.map((item) => (
            <View key={item.key} style={styles.summaryCard}>
              <Text style={styles.summaryMetric}>{item.metric_type}</Text>
              <Text style={styles.summaryValue}>{item.value_label}</Text>
              <Text style={styles.summaryMeta}>{item.analysis}</Text>
              {(item.latest_synced_at || item.latest_end_time) ? (
                <Text style={styles.summaryTime}>
                  {new Date(item.latest_synced_at || item.latest_end_time || '').toLocaleString()}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>{t('Sync data to see your latest health metrics here.')}</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderWearables = () => (
    (() => {
      const devices = (dashboard?.wearables.devices || []).filter((device) => isVisibleWearableForPlatform(device.id));
      const connectedDevices = devices.filter((device) => device.active);
      const hasConnectedDevice = connectedDevices.length > 0;
      const integrationsByProvider = integrations.reduce<Record<string, IntegrationConnection>>((accumulator, item) => {
        accumulator[item.provider] = item;
        return accumulator;
      }, {});
      const nativeDeviceId = Platform.OS === 'ios' ? 'apple-health' : 'health-connect';
      const nativeDevice = devices.find((device) => device.id === nativeDeviceId);
      const nativeDeviceLabel = nativeDevice
        ? (nativeDevice.source_device?.trim() || getWearableDisplayName(t, nativeDevice.id, nativeDevice.name))
        : '';
      const connectedDevice = connectedDevices[0];
      const visibleAddDeviceLabel = connectedDevice
        ? (connectedDevice.source_device?.trim() || getWearableDisplayName(t, connectedDevice.id, connectedDevice.name))
        : t('Add Device');
      const visibleAddDeviceSubtitle = connectedDevice
        ? t('Tap to disconnect this device.')
        : t('Choose Apple Health on iPhone or Health Connect on Android.');
      return (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
            <SectionTitle>{t('Connected Devices')}</SectionTitle>
            <TouchableOpacity
              style={styles.addDeviceCard}
              activeOpacity={0.88}
              onPress={() => {
                if (connectedDevice) {
                  void handlePromptDisconnectWearable(connectedDevice);
                  return;
                }
                handleAddWearable();
              }}
            >
              <View style={styles.addDeviceIconWrap}>
                <Ionicons name={connectedDevice ? 'watch' : 'add'} size={24} color="#000" />
              </View>
              <View style={styles.addDeviceContent}>
                <Text style={styles.addDeviceTitle}>{visibleAddDeviceLabel}</Text>
                <Text style={styles.addDeviceSubtitle}>{visibleAddDeviceSubtitle}</Text>
              </View>
              <Ionicons name={connectedDevice ? 'remove-circle-outline' : 'chevron-forward'} size={20} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.88} onPress={() => void handleSyncWearables()} disabled={syncingWearables}>
              <Ionicons name={syncingWearables ? 'hourglass-outline' : 'refresh'} size={18} color="#000" />
              <Text style={styles.primaryButtonText}>{syncingWearables ? t('SYNCING HEALTH DATA...') : t('SYNC DATA')}</Text>
            </TouchableOpacity>
            {syncingWearables || syncProgressMessage ? (
              <Text style={styles.syncStatusText}>{syncProgressMessage || t('Starting sync...')}</Text>
            ) : null}

            <Modal visible={showWearablePicker} transparent animationType="fade" onRequestClose={() => {
              setNativeConnectionSuccessDeviceId(null);
              setShowWearablePicker(false);
            }}>
              <Pressable style={styles.modalBackdrop} onPress={() => {
                setNativeConnectionSuccessDeviceId(null);
                setShowWearablePicker(false);
              }}>
                <Pressable style={styles.modalCard} onPress={() => undefined}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalEyebrow}>{t('DEVICE SETUP')}</Text>
                      <Text style={styles.modalTitle}>{t('Add Device')}</Text>
                    </View>
                    <TouchableOpacity style={styles.modalCloseButton} activeOpacity={0.88} onPress={() => {
                      setNativeConnectionSuccessDeviceId(null);
                      setShowWearablePicker(false);
                    }}>
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    style={styles.deviceModalScroll}
                    contentContainerStyle={styles.deviceModalScrollContent}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    <View style={styles.availableDeviceList}>
                      {nativeDevice ? (
                        <View
                          key={nativeDevice.id}
                          style={styles.availableDeviceRow}
                        >
                          {(() => {
                            const integration = integrationsByProvider[nativeDevice.id];
                            const statusValue = getIntegrationStatusValue(integration, syncingProviderIds.includes(nativeDevice.id));
                            const isNativeSuccess = nativeConnectionSuccessDeviceId === nativeDevice.id;
                            const isNativeFailure = nativeConnectionFailedDeviceId === nativeDevice.id;
                            const isNativeDisconnected = nativeConnectionDisconnectedDeviceId === nativeDevice.id;
                            const isConnectedState = isNativeSuccess || statusValue === 'connected';
                            const connectLabel = connectingDeviceId === nativeDevice.id
                              ? (isConnectedState ? t('Disconnecting...') : t('Connecting...'))
                              : statusValue === 'syncing'
                                ? t('Syncing...')
                                : statusValue === 'provider_not_configured'
                                  ? t('Unavailable')
                                  : isNativeFailure
                                    ? t('Retry Connect')
                                    : isConnectedState
                                      ? t('Disconnect')
                                      : t('Connect');
                            const connectDisabled = connectingDeviceId === nativeDevice.id
                              || statusValue === 'syncing'
                              || statusValue === 'provider_not_configured';
                            return (
                              <>
                                <View style={styles.availableDeviceContent}>
                                  <Text style={styles.availableDeviceTitle}>{nativeDeviceLabel || getWearableDisplayName(t, nativeDevice.id, nativeDevice.name)}</Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.availableDeviceConnectButton}
                                  activeOpacity={0.88}
                                  disabled={connectDisabled}
                                  onPress={() => void (
                                    isConnectedState ? handlePromptDisconnectWearable(nativeDevice)
                                      : handleChooseDevice(nativeDevice)
                                  )}
                                >
                                  {connectingDeviceId === nativeDevice.id ? (
                                    <Ionicons name="hourglass-outline" size={14} color="#fff" />
                                  ) : isConnectedState ? (
                                    <Ionicons name="remove-circle-outline" size={14} color="#fff" />
                                  ) : isNativeFailure ? (
                                    <Ionicons name="refresh" size={14} color="#fff" />
                                  ) : statusValue === 'syncing' ? (
                                    <Ionicons name="sync" size={14} color="#fff" />
                                  ) : statusValue === 'provider_not_configured' ? (
                                    <Ionicons name="alert-circle-outline" size={14} color="#fff" />
                                  ) : null}
                                  <Text style={styles.availableDeviceConnectText}>
                                    {connectLabel}
                                  </Text>
                                </TouchableOpacity>
                              </>
                            );
                          })()}
                        </View>
                      ) : (
                        <Text style={styles.infoText}>{t('No native source is available for this platform.')}</Text>
                      )}
                    </View>
                  </ScrollView>
                </Pressable>
              </Pressable>
            </Modal>

            <Modal visible={showQrImportModal} transparent animationType="fade" onRequestClose={closeQrImportModal}>
              <Pressable style={styles.modalBackdrop} onPress={closeQrImportModal}>
                <Pressable style={styles.modalCard} onPress={() => undefined}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalEyebrow}>{t('QR IMPORT')}</Text>
                      <Text style={styles.modalTitle}>{t('Import QR Health Data')}</Text>
                    </View>
                    <TouchableOpacity style={styles.modalCloseButton} activeOpacity={0.88} onPress={closeQrImportModal}>
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                    <Text style={styles.connectionDescription}>
                    {t('Paste the real QR payload from the wearable export or bridge app. The backend validates it and stores the synced metrics in the database.')}
                  </Text>
                  <View style={styles.connectionInfoCard}>
                    <Text style={styles.connectionInfoTitle}>{t('Payload format')}</Text>
                    <Text style={styles.connectionInfoText}>
                      {t('JSON or base64 JSON containing `metrics`, optional `source_device`, and optional `batch_id`.')}
                    </Text>
                  </View>
                  <TextInput
                    value={qrPayload}
                    onChangeText={setQrPayload}
                    placeholder={t('Paste QR payload here')}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    multiline
                    textAlignVertical="top"
                    style={styles.payloadInput}
                  />
                  <TouchableOpacity style={styles.connectionPrimaryButton} activeOpacity={0.88} onPress={() => void handleImportQrPayload()} disabled={importingPayload}>
                    <Ionicons name={importingPayload ? 'hourglass-outline' : 'qr-code-outline'} size={18} color="#000" />
                    <Text style={styles.connectionPrimaryText}>{importingPayload ? t('IMPORTING...') : t('SAVE QR DATA')}</Text>
                  </TouchableOpacity>
                </Pressable>
              </Pressable>
            </Modal>

            <Modal
              visible={Boolean(masterclassVideoModal)}
              transparent
              animationType="fade"
              onRequestClose={() => setMasterclassVideoModal(null)}
            >
              <View style={styles.learnVideoModalBackdrop}>
                <View style={styles.learnVideoModalCard}>
                  <View style={styles.learnVideoModalHeader}>
                    <View style={styles.learnVideoModalTitleWrap}>
                      <Text style={styles.learnVideoModalEyebrow}>{t('Masterclass')}</Text>
                      <Text style={styles.learnVideoModalTitle} numberOfLines={2}>
                        {masterclassVideoModal?.title || t('Lesson Video')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.learnVideoModalClose}
                      activeOpacity={0.88}
                      onPress={() => setMasterclassVideoModal(null)}
                    >
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  {masterclassVideoModal?.embedUrl ? (
                    <View style={styles.learnVideoModalPlayerWrap}>
                      <WebView
                        source={{ html: buildMasterclassVideoHtml(masterclassVideoModal.embedUrl) }}
                        style={styles.learnVideoModalPlayer}
                        scrollEnabled={false}
                        javaScriptEnabled
                        mediaPlaybackRequiresUserAction
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            </Modal>
        </ScrollView>
      );
    })()
  );

  const renderHeal = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      <View style={styles.heroCard}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&q=80' }} style={styles.heroImage} />
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroBadge}>{t('AI-POWERED LIBRARY')}</Text>
          <Text style={styles.heroTitle}>{t('Heal with Food')}</Text>
          <Text style={styles.heroMeta}>{t('Research-backed nutrition guidance tailored to your health profile.')}</Text>
          {canGenerateLongevityPlan ? (
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.88} onPress={() => void handleGenerateWeeklyPlan()} disabled={generatingPlan}>
              <Ionicons name={generatingPlan ? 'hourglass-outline' : 'sparkles'} size={16} color="#000" />
              <Text style={styles.secondaryButtonText}>{generatingPlan ? t('Generating...') : t('Generate My Weekly Plan')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {canGenerateLongevityPlan ? (
        <>
          <SectionTitle>{t('Health Food Library')}</SectionTitle>
          <View style={styles.grid}>
            {(dashboard?.heal_categories || []).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.quickCard, { width: (width - 44) / 2 }]}
                activeOpacity={0.9}
                onPress={() => {
                  router.push({
                    pathname: '/profile/heal/[id]',
                    params: {
                      id: item.id,
                    },
                  });
                }}
              >
                <Image source={{ uri: safeImageUri(item.image) }} style={styles.quickImage} />
                <View style={[styles.quickOverlay, { backgroundColor: `${item.color}CC` }]} />
                <View style={styles.quickTextWrap}>
                  <Text style={styles.quickText}>{item.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );

  const renderHabits = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      {(() => {
        const habits = [...(dashboard?.habits.habits || [])].sort((left, right) => {
          if (left.done === right.done) {
            return left.title.localeCompare(right.title);
          }
          return left.done ? 1 : -1;
        });
        const completedCount = habits.filter((habit) => habit.done).length;
        const totalCount = habits.length;
        const progress = totalCount > 0 ? completedCount / totalCount : 0;
        return (
          <>
            <View style={styles.habitsHeroCard}>
              <View style={styles.habitsHeroHeader}>
                <View style={styles.habitsHeroCopy}>
                  <Text style={styles.habitsHeroEyebrow}>{t('Connected to dashboard')}</Text>
                  <Text style={styles.habitsHeroTitle}>{t('Habits')}</Text>
                </View>
                <View style={styles.habitsHeroBadge}>
                  <Ionicons name="checkbox-outline" size={14} color={Colors.primary} />
                  <Text style={styles.habitsHeroBadgeText}>{t('{completed}/{total} done', { completed: completedCount, total: totalCount || 0 })}</Text>
                </View>
              </View>
              <Text style={styles.habitsHeroMeta}>
                {t('These habits are generated from your sync history and adapt as your recovery profile changes.')}
              </Text>
              <View style={styles.habitsProgressTrack}>
                <View style={[styles.habitsProgressFill, { width: `${Math.max(progress, 0.06) * 100}%` }]} />
              </View>
              <Text style={styles.habitsProgressLabel}>
                {t('{percent}% completed today', { percent: Math.round(progress * 100) || 0 })}
              </Text>
            </View>

            <SectionTitle>{t('Dashboard Habits')}</SectionTitle>
            <View style={styles.habitList}>
              {habits.map((habit, index) => (
                <TouchableOpacity key={habit.id} style={[styles.habitCard, habit.done && styles.habitCardDone]} activeOpacity={0.88} onPress={() => void handleToggleHabit(habit)}>
                  <View style={styles.habitCardHeader}>
                    <View style={[styles.habitIconWrap, habit.done && styles.habitIconWrapDone]}>
                      <Ionicons name={habit.icon as any} size={18} color={habit.done ? '#10B981' : '#D8E8FF'} />
                    </View>
                    <View style={styles.habitCardCopy}>
                      <View style={styles.habitCardTitleRow}>
                        <Text style={[styles.habitTitle, habit.done && styles.habitTitleDone]}>{habit.title}</Text>
                        <View style={[styles.habitStatusBadge, habit.done && styles.habitStatusBadgeDone]}>
                          <Text style={[styles.habitStatusText, habit.done && styles.habitStatusTextDone]}>
                            {habit.done ? t('Done') : t('To do')}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.habitSubtitle}>{habit.subtitle}</Text>
                    </View>
                    <Ionicons name={habit.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={habit.done ? '#10B981' : 'rgba(255,255,255,0.28)'} />
                  </View>
                  <View style={styles.habitCardFooter}>
                    <Text style={styles.habitCardIndex}>0{index + 1}</Text>
                    <Text style={styles.habitCardHint}>{habit.done ? t('Keep the rhythm') : t('Tap to mark complete')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      })()}
    </ScrollView>
  );

  const renderLearn = (items: LongevityMasterclass[]) => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      <View style={styles.learnHeroCard}>
        <Text style={styles.learnHeroEyebrow}>{t('Connected to dashboard')}</Text>
        <Text style={styles.learnHeroTitle}>{t('Masterclasses')}</Text>
        <Text style={styles.learnHeroMeta}>
          {t('These lessons are selected from your current dashboard profile and heal focus areas.')}
        </Text>
      </View>
      <SectionTitle>{t('Dashboard Learning')}</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon="book-outline" title={t('No Masterclasses Available')} subtitle={t('Check back later for new longevity insights.')} />
      ) : (
        <View style={styles.learnList}>
          {items.map((item) => (
            <View key={item.id} style={styles.learnCard}>
              <View style={styles.learnCardThumb}>
                <Image source={{ uri: safeImageUri(item.thumbnail) }} style={styles.learnCardImage} />
                <View style={styles.learnCardOverlay} />
                <View style={styles.learnCardBadge}>
                  <Ionicons name="book-outline" size={12} color="#fff" />
                  <Text style={styles.learnCardBadgeText}>{t('Dashboard')}</Text>
                </View>
              </View>
              <View style={styles.learnCardBody}>
                <Text style={styles.learnCardTitle}>{item.title}</Text>
                <Text style={styles.learnCardDescription}>{item.description}</Text>
                {item.duration ? <Text style={styles.learnCardMeta}>{item.duration}</Text> : null}
                {resolveMasterclassMediaUrl(item.audioUrl) ? (
                  <View style={styles.learnAudioWrap}>
                    <Text style={styles.learnAudioLabel}>{t('Audio lesson')}</Text>
                    <WebView
                      source={{ html: buildMasterclassAudioHtml(resolveMasterclassMediaUrl(item.audioUrl)) }}
                      style={styles.learnAudioPlayer}
                      scrollEnabled={false}
                      javaScriptEnabled
                      mediaPlaybackRequiresUserAction
                    />
                  </View>
                ) : null}
                {resolveMasterclassMediaUrl(item.videoUrl) ? (
                  <TouchableOpacity
                    style={styles.learnVideoButton}
                    activeOpacity={0.88}
                    onPress={() => {
                      const rawVideoUrl = resolveMasterclassMediaUrl(item.videoUrl);
                      const embedUrl = normalizeMasterclassVideoUrl(rawVideoUrl);
                      if (embedUrl) {
                        setMasterclassVideoModal({ title: item.title, embedUrl });
                        return;
                      }
                      Linking.openURL(rawVideoUrl);
                    }}
                  >
                    <Ionicons name="play-circle-outline" size={18} color="#04111F" />
                    <Text style={styles.learnVideoButtonText}>{t('Play lesson video')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderCircles = (items: LongevityCircle[]) => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      <SectionTitle>Your Circles</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon="people-outline" title="No Circles Yet" subtitle="You have not joined any circles yet." />
      ) : (
        <View style={styles.listCard}>
          {items.map((item) => (
            <View key={item.id} style={styles.listRow}>
              <Ionicons name="people-outline" size={18} color={Colors.primary} />
              <View style={styles.listTextWrap}>
                <Text style={styles.listText}>{item.name}</Text>
                <Text style={styles.listSubtext}>{item.member_count} members · {item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderTabContent = () => {
    if (loading && !dashboard) {
      return <LoadingState t={t} />;
    }

    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'wearables':
        return renderWearables();
      case 'heal':
        return renderHeal();
      case 'habits':
        return renderHabits();
      case 'learn':
        return renderLearn(dashboard?.masterclasses || []);
      default:
        return renderOverview();
    }
  };

  if (checkingAccess) {
    return <LoadingState t={t} />;
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <VictoryHeader />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
        </View>

        <Text style={styles.pageTitle}>LONGEVITY OS</Text>

        {screenError ? (
          <View style={styles.screenErrorCard}>
            <View style={styles.screenErrorHeader}>
              <Ionicons name="warning-outline" size={18} color="#FCA5A5" />
              <Text style={styles.screenErrorTitle}>{screenError.title}</Text>
              <TouchableOpacity onPress={dismissScreenError} activeOpacity={0.88} style={styles.screenErrorClose}>
                <Ionicons name="close" size={16} color="#FCA5A5" />
              </TouchableOpacity>
            </View>
            <Text style={styles.screenErrorMessage}>{screenError.message}</Text>
          </View>
        ) : null}

        <View style={styles.tabBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity key={tab.id} style={styles.tabItem} onPress={() => setActiveTab(tab.id)}>
                  <Ionicons name={tab.icon as any} size={20} color={isActive ? Colors.primary : 'rgba(255,255,255,0.4)'} />
                  <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{tab.label}</Text>
                  {isActive ? <View style={styles.activeLine} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.flex}>{renderTabContent()}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    paddingHorizontal: 16,
    color: Colors.primary,
    fontSize: 28,
    letterSpacing: 2,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tabBar: {
    paddingHorizontal: 12,
    gap: 10,
  },
  tabItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  activeTabLabel: {
    color: Colors.primary,
  },
  activeLine: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 8,
  },
  tabContent: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: Colors.primary,
    fontSize: 15,
    letterSpacing: 1.3,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    marginBottom: 14,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineActionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineActionText: {
    color: '#000',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  addDeviceCard: {
    backgroundColor: '#12182B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  addDeviceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDeviceContent: {
    flex: 1,
  },
  addDeviceTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  addDeviceSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  heroCard: {
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1A1F35',
    marginBottom: 14,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,8,22,0.52)',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentBlue,
    color: '#001311',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  metricCard: {
    backgroundColor: '#12182B',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 18,
  },
  metricLabel: {
    color: Colors.primary,
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  metricPrimary: {
    color: '#10B981',
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  metricMeta: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  quickCard: {
    height: 146,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1A1F35',
  },
  quickImage: {
    ...StyleSheet.absoluteFillObject,
  },
  quickOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  quickTextWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    bottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  quickSubtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Inter_400Regular',
  },
  planFeedWrap: {
    marginTop: 18,
  },
  habitsHeroCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#12182B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  habitsHeroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  habitsHeroCopy: {
    flex: 1,
    gap: 4,
  },
  habitsHeroEyebrow: {
    color: 'rgba(216, 232, 255, 0.62)',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  habitsHeroTitle: {
    color: '#fff',
    fontSize: 24,
    lineHeight: 29,
    fontFamily: 'Inter_700Bold',
  },
  habitsHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 142, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79, 142, 247, 0.16)',
  },
  habitsHeroBadgeText: {
    color: '#D8E8FF',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  habitsHeroMeta: {
    color: 'rgba(241, 246, 255, 0.75)',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  habitsProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  habitsProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  habitsProgressLabel: {
    color: 'rgba(216, 232, 255, 0.7)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  habitList: {
    gap: 12,
  },
  habitCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#12182B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  habitCardDone: {
    borderColor: 'rgba(16, 185, 129, 0.18)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  habitCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  habitIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  habitIconWrapDone: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.14)',
  },
  habitCardCopy: {
    flex: 1,
    gap: 4,
  },
  habitCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  habitTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Inter_700Bold',
  },
  habitTitleDone: {
    color: '#DFF9EE',
  },
  habitSubtitle: {
    color: 'rgba(216, 232, 255, 0.62)',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
  },
  habitStatusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  habitStatusBadgeDone: {
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  habitStatusText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: 'Inter_700Bold',
  },
  habitStatusTextDone: {
    color: '#A7F3D0',
  },
  habitCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  habitCardIndex: {
    color: 'rgba(216, 232, 255, 0.45)',
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: 'Inter_700Bold',
  },
  habitCardHint: {
    color: 'rgba(216, 232, 255, 0.55)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  learnHeroCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#12182B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  learnHeroEyebrow: {
    color: 'rgba(216, 232, 255, 0.62)',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  learnHeroTitle: {
    color: '#fff',
    fontSize: 24,
    lineHeight: 29,
    fontFamily: 'Inter_700Bold',
  },
  learnHeroMeta: {
    color: 'rgba(241, 246, 255, 0.74)',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  learnList: {
    gap: 12,
  },
  learnCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#12182B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  learnCardThumb: {
    height: 132,
    position: 'relative',
  },
  learnCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  learnCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,16,32,0.38)',
  },
  learnCardBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  learnCardBadgeText: {
    color: '#fff',
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: 'Inter_700Bold',
  },
  learnCardBody: {
    padding: 16,
    gap: 6,
  },
  learnCardTitle: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 21,
    fontFamily: 'Inter_700Bold',
  },
  learnCardDescription: {
    color: 'rgba(216, 232, 255, 0.72)',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  learnCardMeta: {
    color: 'rgba(143, 208, 255, 0.72)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },
  learnAudioWrap: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0F172A',
  },
  learnAudioLabel: {
    color: '#D7E8FF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  learnAudioPlayer: {
    height: 62,
    backgroundColor: '#0F172A',
  },
  learnVideoButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#22D3EE',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  learnVideoButtonText: {
    color: '#04111F',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  learnVideoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.84)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  learnVideoModalCard: {
    backgroundColor: '#12182B',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  learnVideoModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  learnVideoModalTitleWrap: {
    flex: 1,
    gap: 2,
  },
  learnVideoModalEyebrow: {
    color: 'rgba(143, 208, 255, 0.72)',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  learnVideoModalTitle: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter_700Bold',
  },
  learnVideoModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  learnVideoModalPlayerWrap: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  learnVideoModalPlayer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  listCard: {
    backgroundColor: '#12182B',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  planHeaderCard: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(34,211,238,0.05)',
  },
  planSummaryText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_500Medium',
  },
  planGeneratedAt: {
    marginTop: 8,
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  planSectionCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  planSectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  planSectionSummary: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 10,
    fontFamily: 'Inter_400Regular',
  },
  planActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
  },
  planActionText: {
    flex: 1,
    color: '#DCE7F5',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_500Medium',
  },
  planJsonCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  planJsonLabel: {
    color: Colors.primary,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  planJsonText: {
    color: '#DCE7F5',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  listRowActive: {
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  listTextWrap: {
    flex: 1,
  },
  listText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  listTextActive: {
    color: '#10B981',
  },
  listSubtext: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  horizontalList: {
    paddingRight: 16,
    gap: 12,
    marginBottom: 18,
  },
  deviceCard: {
    height: 170,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1A1F35',
  },
  deviceCardSelected: {
    backgroundColor: '#0E1629',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  deviceImage: {
    ...StyleSheet.absoluteFillObject,
  },
  deviceOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,8,22,0.5)',
  },
  deviceContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  deviceTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  deviceMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  deviceHint: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
  },
  deviceTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  deviceTag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deviceTagText: {
    color: '#DCE7F5',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  deviceActionButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceActionText: {
    color: '#000',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  deviceConnectedBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  deviceConnectedText: {
    color: '#10B981',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  deviceFailedBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.28)',
  },
  deviceFailedCopy: {
    flex: 1,
  },
  deviceFailedText: {
    color: '#F87171',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  deviceFailedMessage: {
    marginTop: 2,
    color: '#FECACA',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Inter_400Regular',
  },
  deviceDisconnectedBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.28)',
  },
  deviceDisconnectedText: {
    color: '#93C5FD',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  deviceDisconnectedMessage: {
    marginTop: 2,
    color: '#DBEAFE',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Inter_400Regular',
  },
  emptyConnectCard: {
    backgroundColor: '#12182B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyConnectTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyConnectSubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    marginBottom: 18,
  },
  availableDeviceList: {
    backgroundColor: '#12182B',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  availableDeviceGroup: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  availableDeviceGroupTitle: {
    color: Colors.primary,
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  availableDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  availableDeviceContent: {
    flex: 1,
    paddingRight: 12,
  },
  availableDeviceTitle: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  availableDeviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
  },
  availableDeviceBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  availableDeviceConnectButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableDeviceConnectText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  syncStatusText: {
    marginTop: -4,
    marginBottom: 16,
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  selectionHintText: {
    marginTop: -4,
    marginBottom: 16,
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  secondaryButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  infoCard: {
    backgroundColor: '#12182B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  lockCard: {
    backgroundColor: '#12182B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'flex-start',
    gap: 10,
  },
  lockBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.28)',
  },
  lockTitle: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Inter_700Bold',
  },
  lockText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  lockPrimaryButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lockPrimaryButtonText: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  infoText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#12182B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  summaryMetric: {
    color: Colors.primary,
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  summaryMeta: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  summaryTime: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.2,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,6,18,0.78)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: '#12182B',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    maxHeight: '86%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalEyebrow: {
    color: Colors.primary,
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionDescription: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  deviceModalScroll: {
    maxHeight: '100%',
  },
  deviceModalScrollContent: {
    paddingBottom: 4,
  },
  connectionInfoCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 18,
  },
  connectionInfoTitle: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  connectionInfoText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  connectionPrimaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  connectionPrimaryText: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  payloadInput: {
    minHeight: 160,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  screenErrorCard: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.24)',
    padding: 14,
  },
  screenErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenErrorTitle: {
    flex: 1,
    color: '#FECACA',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  screenErrorClose: {
    padding: 4,
  },
  screenErrorMessage: {
    marginTop: 8,
    color: '#FDE8E8',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  emptyCard: {
    minHeight: 220,
    backgroundColor: '#12182B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
});
