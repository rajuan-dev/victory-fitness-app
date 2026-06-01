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
import VictoryHeader from '../../components/VictoryHeader';
import {
  connectLongevityLocalProvider,
  connectWearableProvider,
  disconnectLongevityProvider,
  fetchCurrentUser,
  fetchLongevityHealthSummary,
  fetchLongevityDashboard,
  fetchIntegrationConnections,
  generateLongevityWeeklyPlan,
  HealthMetricSummaryItem,
  IntegrationConnection,
  LongevityCircle,
  LongevityDashboard,
  LongevityHabit,
  LongevityMasterclass,
  LongevityWeeklyPlan,
  LongevityWearableDevice,
  markNativeIntegrationConnected,
  WearableProvider,
  syncLongevityQrImport,
  syncLongevityWearables,
  updateLongevityHabit,
} from '../../lib/api';
import { canAccessFeature } from '../../lib/access';
import {
  authorizeNativeHealthSource,
  getNativeHealthReadiness,
  inspectNativeHealthChecklist,
  getPreferredNativeSyncTargetForPlatform,
  openNativeHealthSettings,
  revokeNativeHealthPermissions,
  type NativeHealthChecklistState,
  type NativeSyncTarget,
  syncNativeHealthSource,
} from '../../lib/nativeHealthSync';
import {
  appendRunLog,
} from '../../lib/runLog';
import type { RunLogEntry } from '../../lib/runLog';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

const FALLBACK_CARD_IMAGE = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80';

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
    return ['Samsung Health', 'Runmefit', 'Health Connect apps', 'Galaxy Watch', 'Pixel Watch', 'Amazfit'];
  }
  if (deviceId === 'this-phone') {
    return Platform.OS === 'ios'
      ? ['Apple Health', 'Apple Watch', 'Oura', 'Withings', 'Polar']
      : Platform.OS === 'android'
        ? ['Samsung Health', 'Runmefit', 'Health Connect apps', 'Galaxy Watch', 'Pixel Watch', 'Amazfit']
        : ['Supported mobile health sources'];
  }
  return [];
}

function getRunmefitBridgeTitle(deviceId: string) {
  if (deviceId === 'apple-health') {
    return 'Apple Health source bridge';
  }
  if (deviceId === 'health-connect') {
    return 'Health Connect source bridge';
  }
  if (deviceId === 'this-phone') {
    return Platform.OS === 'ios'
      ? 'Apple Health source bridge on this iPhone'
      : Platform.OS === 'android'
        ? 'Health Connect source bridge on this Android phone'
        : 'Native phone health bridge';
  }
  return 'Native health source bridge';
}

function getRunmefitBridgeSummary(deviceId: string) {
  if (deviceId === 'apple-health') {
    return 'Connect Apple Health once to read approved records from iPhone health apps and devices.';
  }
  if (deviceId === 'health-connect') {
    return 'Connect Health Connect once to read approved records from Samsung Health, Runmefit, and other Android health apps.';
  }
  if (deviceId === 'this-phone') {
    return Platform.OS === 'ios'
      ? 'Use Apple Health on this iPhone, then press Sync Data here.'
      : Platform.OS === 'android'
        ? 'Use Health Connect on this Android phone, then press Sync Data here.'
        : 'Sync into the phone health store first, then press Sync Data here.';
  }
  return 'Connect the supported phone health framework first, then press Sync Data here.';
}

function getWearableSourceDescription(deviceId: string) {
  switch (deviceId) {
    case 'fitbit':
      return 'Browser login with Fitbit OAuth';
    case 'google-fit':
      return 'Browser login with Google OAuth for Google Fit';
    case 'garmin':
      return 'Browser login with Garmin OAuth';
    case 'this-phone':
      return Platform.OS === 'ios' ? 'Uses native Apple Health permission on this iPhone and can read data from apps that sync into Apple Health' : Platform.OS === 'android' ? 'Uses native Health Connect permission on this Android phone and can read data from apps that sync into Health Connect' : 'Uses native phone health permission';
    case 'qr-import':
      return 'Fallback import by QR payload';
    case 'apple-health':
      return 'Native Apple Health permission for Apple Health and other iPhone health sources';
    case 'health-connect':
      return 'Native Health Connect permission for Android health data, including Samsung Health and Runmefit when they sync into Health Connect';
    default:
      return 'Health data source';
  }
}

function getWearableDisplayName(deviceId: string, fallbackName: string) {
  switch (deviceId) {
    case 'apple-health':
      return 'Apple Health Sources';
    case 'health-connect':
      return 'Android Health Sources';
    case 'fitbit':
      return 'Fitbit Devices';
    case 'google-fit':
      return 'Google Fit';
    case 'garmin':
      return 'Garmin Devices';
    case 'this-phone':
      return Platform.OS === 'ios' ? 'This iPhone' : Platform.OS === 'android' ? 'This Android Phone' : fallbackName;
    case 'qr-import':
      return 'QR Import / Other Device';
    default:
      return fallbackName;
  }
}

function getWearableCompatibleDevices(deviceId: string) {
  switch (deviceId) {
    case 'apple-health':
      return ['Apple Watch', 'iPhone Health', 'Oura Ring', 'Withings', 'Polar', 'Health apps synced to Apple Health'];
    case 'health-connect':
      return ['Samsung Health', 'Runmefit', 'Samsung Galaxy Watch', 'Pixel Watch', 'Amazfit', 'Health Connect apps'];
    case 'fitbit':
      return ['Fitbit Charge', 'Fitbit Sense', 'Fitbit Versa', 'Google Fitbit'];
    case 'google-fit':
      return ['Google Fit account', 'Android Fitness Store', 'Google ecosystem'];
    case 'garmin':
      return ['Garmin Venu', 'Garmin Forerunner', 'Garmin Fenix', 'Garmin Instinct'];
    case 'this-phone':
      return Platform.OS === 'ios'
        ? ['Apple Health', 'Apple Watch on this iPhone', 'Oura', 'Withings']
        : Platform.OS === 'android'
          ? ['Samsung Health', 'Runmefit', 'Health Connect', 'Galaxy Watch', 'Pixel Watch']
          : ['Native mobile health source'];
    case 'qr-import':
      return ['Other wearable export', 'Partner QR bridge', 'Manual clinic data'];
    default:
      return [];
  }
}

function getWearableFlowSummary(deviceId: string) {
  switch (deviceId) {
    case 'fitbit':
      return 'Login in browser, return to app, then sync real Fitbit data.';
    case 'google-fit':
      return 'Login in browser with Google, return to app, then sync Google Fit data.';
    case 'garmin':
      return 'Login in browser, return to app, then sync real Garmin data.';
    case 'apple-health':
      return 'Approve Apple Health access on iPhone, then sync Apple Health records from connected iPhone health apps and devices.';
    case 'health-connect':
      return 'Approve Health Connect access on Android, then sync Health Connect records from Samsung Health, Runmefit, and other connected Android apps.';
    case 'this-phone':
      return Platform.OS === 'ios'
        ? 'Uses Apple Health on this iPhone, then syncs approved health data from connected iPhone health apps.'
        : Platform.OS === 'android'
          ? 'Uses Health Connect on this Android phone, then syncs approved health data from Samsung Health, Runmefit, and other Android apps.'
          : 'Uses the native phone health connection, then syncs the approved health data.';
    case 'qr-import':
      return 'Connect the import option, then paste or scan a QR payload when syncing.';
    default:
      return 'Connect first, then sync the health data.';
  }
}

function getWearableCategoryLabel(deviceId: string) {
  switch (deviceId) {
    case 'apple-health':
    case 'this-phone':
      return 'iPhone / Apple';
    case 'health-connect':
      return 'Android / Health Connect';
    case 'fitbit':
      return 'Fitbit';
    case 'google-fit':
      return 'Google Fit';
    case 'garmin':
      return 'Garmin';
    case 'qr-import':
      return 'Other Device / QR';
    default:
      return 'Other Devices';
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

function getIntegrationStatusLabel(status: string) {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'needs_permission':
      return 'Needs Permission';
    case 'syncing':
      return 'Syncing';
    case 'error':
      return 'Error';
    case 'provider_not_configured':
      return 'Not Configured';
    default:
      return 'Not Connected';
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
    };

    bucket.records += Number(item.records || 0);
    if (item.latest_end_time && (!bucket.latest_end_time || new Date(item.latest_end_time) > new Date(bucket.latest_end_time))) {
      bucket.latest_end_time = item.latest_end_time;
    }

    if (metricType === 'distance') {
      const normalizedUnit = unit === 'mi' || unit === 'mile' || unit === 'miles'
        ? 'mi'
        : 'km';
      bucket.distance_meters += distanceToMeters(Number(item.total_value || 0), unit);
      bucket.distance_unit_counts[normalizedUnit] = Number(bucket.distance_unit_counts[normalizedUnit] || 0) + 1;
    } else if (metricType === 'steps' || metricType === 'calories' || metricType === 'workouts') {
      bucket.total_value += Number(item.total_value || 0);
      bucket.unit = bucket.unit || unit || (metricType === 'calories' ? 'kcal' : 'count');
    } else {
      const weight = Math.max(Number(item.records || 0), 1);
      bucket.weighted_average_sum += Number(item.average_value || 0) * weight;
      bucket.weighted_average_count += weight;
      bucket.unit = bucket.unit || unit;
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
    }));
}

function formatHealthMetricValue(item: Pick<HealthMetricSummaryItem, 'metric_type' | 'total_value' | 'average_value' | 'unit'>) {
  const metricType = String(item.metric_type || '').toLowerCase();
  const unit = String(item.unit || '').trim().toLowerCase();
  const isAdditiveLike = ['steps', 'distance', 'calories', 'workouts'].includes(metricType) || unit === 'count';
  const isRateLike = ['heart_rate', 'hrv', 'spo2', 'stress', 'body_battery'].includes(metricType);
  const isDurationLike = metricType === 'sleep' || unit === 'hours' || unit === 'hrs' || unit === 'hr' || unit === 'h';
  const value = isAdditiveLike ? item.total_value : item.average_value;
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

const TABS = [
  { id: 'overview', label: 'OVERVIEW', icon: 'pulse-outline' },
  { id: 'wearables', label: 'WEARABLES', icon: 'watch-outline' },
  { id: 'heal', label: 'HEAL', icon: 'restaurant-outline' },
  { id: 'habits', label: 'HABITS', icon: 'checkbox-outline' },
  { id: 'learn', label: 'LEARN', icon: 'book-outline' },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function LoadingState() {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>Loading Longevity OS...</Text>
    </View>
  );
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
  useModuleAccessGuard('/profile/longevity-os');
  const router = useRouter();
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
  const [qrPayload, setQrPayload] = useState('');
  const [importingPayload, setImportingPayload] = useState(false);
  const [healthSummary, setHealthSummary] = useState<HealthMetricSummaryItem[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [syncingProviderIds, setSyncingProviderIds] = useState<string[]>([]);
  const [nativeChecklistState, setNativeChecklistState] = useState<NativeHealthChecklistState | null>(null);
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

  const visibleHealthSummaryCards = buildHealthSummaryCards(healthSummary);

  const loadIntegrationStatuses = React.useCallback(async () => {
    const response = await fetchIntegrationConnections();
    setIntegrations(Array.isArray(response.items) ? response.items : []);
  }, []);

  const loadDashboard = React.useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const [response, user, summary, integrationResponse] = await Promise.all([
        fetchLongevityDashboard(),
        fetchCurrentUser(),
        fetchLongevityHealthSummary().catch(() => null),
        fetchIntegrationConnections().catch(() => null),
      ]);
      setDashboard(response);
      const activeDeviceIds = Array.isArray(response?.wearables?.devices)
        ? response.wearables.devices.filter((device) => device.active && isVisibleWearableForPlatform(device.id)).map((device) => device.id)
        : [];
      setSelectedWearableIds((current) => (current.length > 0 ? current : activeDeviceIds));
      setHealthSummary(Array.isArray(summary?.items) ? summary.items : []);
      setIntegrations(Array.isArray(integrationResponse?.items) ? integrationResponse.items : []);
      setCanGenerateLongevityPlan(canAccessFeature('longevity_plan', user));
      dismissScreenError();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load Longevity OS.';
      showScreenError('Load failed', message);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [dismissScreenError, showScreenError]);

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

  React.useEffect(() => {
    if (activeTab !== 'wearables') {
      return;
    }
    const nativeTarget = getPreferredNativeSyncTargetForPlatform();
    if (!nativeTarget) {
      setNativeChecklistState(null);
      return;
    }
    void inspectNativeHealthChecklist(nativeTarget)
      .then((checklist) => setNativeChecklistState(checklist))
      .catch(() => setNativeChecklistState(null));
  }, [activeTab, dashboard?.wearables.last_synced_at]);

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
  ) => {
    const {
      showSuccessAlert = true,
      showFailureAlert = true,
    } = options;
    if (syncingWearables) {
      return;
    }
    const connectedDeviceIds = (dashboard?.wearables.devices || [])
      .filter((device) => device.active && isVisibleWearableForPlatform(device.id))
      .map((device) => device.id);

    if (targetDeviceIds.length === 0) {
      showScreenError('Add device', 'Connect a device first, then press Sync Data Now.');
      return;
    }
    if (targetDeviceIds.length === 1 && targetDeviceIds[0] === 'qr-import') {
      setShowQrImportModal(true);
      return;
    }
    if (targetDeviceIds.includes('qr-import')) {
      showScreenError(
        'Sync separately',
        'QR Import needs a payload input, so sync it separately from Fitbit, Google Fit, Garmin, Apple Health, or Health Connect.',
      );
      return;
    }

    const wantsAppleHealth = targetDeviceIds.includes('apple-health');
    const wantsHealthConnect = targetDeviceIds.includes('health-connect');
    const backendProviderIds = targetDeviceIds.filter((providerId) => !['apple-health', 'health-connect', 'this-phone'].includes(providerId));
    let nativeSetupIssue: { title: string; message: string } | null = null;

    setSyncingWearables(true);
    setSyncingProviderIds(targetDeviceIds);
    try {
      const tasks: Promise<unknown>[] = [];
      const nativeTargets = new Set<NativeSyncTarget>();
      const preferredNativeTarget = getPreferredNativeSyncTargetForPlatform();

      if (Platform.OS === 'ios' && wantsAppleHealth) {
        nativeTargets.add('apple-health');
      }
      if (Platform.OS === 'android' && wantsHealthConnect) {
        nativeTargets.add('health-connect');
      }
      if (!nativeTargets.size && preferredNativeTarget && connectedDeviceIds.includes(preferredNativeTarget) && targetDeviceIds.length === 1) {
        nativeTargets.add(preferredNativeTarget);
      }

      for (const provider of nativeTargets) {
        const checklist = await inspectNativeHealthChecklist(provider);
        if (!checklist.isReady) {
          if (checklist.action === 'open_data_management') {
            await authorizeNativeHealthSource(provider);
            const refreshedChecklist = await inspectNativeHealthChecklist(provider);
            setNativeChecklistState(refreshedChecklist);
            if (!refreshedChecklist.isReady) {
              nativeSetupIssue = {
                title: refreshedChecklist.action === 'open_settings'
                  ? 'Health Connect update required'
                  : 'Health Connect permissions needed',
                message: refreshedChecklist.message,
              };
              if (refreshedChecklist.action === 'open_settings') {
                void openNativeHealthSettings(provider);
              }
              continue;
            }
            tasks.push(syncNativeHealthSource(provider));
            continue;
          }
          setNativeChecklistState(checklist);
          nativeSetupIssue = {
            title: checklist.action === 'open_settings'
              ? 'Health Connect update required'
              : 'Health Connect permissions needed',
            message: checklist.message,
          };
          if (checklist.action === 'open_settings') {
            void openNativeHealthSettings(provider);
          }
          continue;
        }
        tasks.push(syncNativeHealthSource(provider));
      }

      if (Platform.OS === 'ios' && wantsHealthConnect) {
        throw new Error('Health Connect is available on Android only.');
      }
      if (Platform.OS === 'android' && wantsAppleHealth) {
        throw new Error('Apple Health is available on iPhone only.');
      }

      if (tasks.length === 0 && backendProviderIds.length === 0 && preferredNativeTarget) {
        const checklist = await inspectNativeHealthChecklist(preferredNativeTarget);
        setNativeChecklistState(checklist);
        throw new Error(checklist.message);
      }

      if (tasks.length === 0 && backendProviderIds.length === 0) {
        throw new Error('Select at least one supported data source to sync.');
      }

      if (backendProviderIds.length > 0) {
        tasks.push(syncLongevityWearables(backendProviderIds as WearableProvider[]));
      }

      try {
        await Promise.all(tasks);
      } catch (error) {
        if (error instanceof Error && error.message.includes('No Health Connect records were found for the last 7 days.')) {
          throw new Error('Health Connect is connected, but no records were found in the last 7 days. Open Health Connect and confirm Samsung Health, Runmefit, or another source app is writing data.');
        }
        if (error instanceof Error && error.message.includes('No Apple Health records were found for the last 7 days.')) {
          throw new Error('Apple Health is connected, but no records were found in the last 7 days. Confirm your health apps or devices are writing data into Apple Health.');
        }
        throw error;
      }

      await loadDashboard(false);
      if (preferredNativeTarget) {
        void inspectNativeHealthChecklist(preferredNativeTarget)
          .then((checklist) => setNativeChecklistState(checklist))
          .catch(() => undefined);
      }
      if (showSuccessAlert) {
        Alert.alert('Data sync successful', 'All available synced health records are now flowing into Longevity OS.');
      }
      if (nativeSetupIssue) {
        showScreenError(nativeSetupIssue.title, nativeSetupIssue.message);
      } else {
        dismissScreenError();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync wearables.';
      if (showFailureAlert) {
        showScreenError('Sync failed', message);
      }
      throw error;
    } finally {
      setSyncingWearables(false);
      setSyncingProviderIds([]);
    }
  }, [dashboard?.wearables.devices, dismissScreenError, loadDashboard, showScreenError, syncingWearables]);

  const handleSyncWearables = async () => {
    if (syncingWearables) {
      return;
    }
    const connectedDeviceIds = (dashboard?.wearables.devices || [])
      .filter((device) => device.active && isVisibleWearableForPlatform(device.id))
      .map((device) => device.id);
    const targetDeviceIds = selectedWearableIds.length > 0 ? selectedWearableIds : connectedDeviceIds;
    try {
      await syncWearableTargets(targetDeviceIds, { showSuccessAlert: true, showFailureAlert: true });
      recordRunLog({
        level: 'success',
        title: 'Sync complete',
        message: 'Longevity OS synced the selected health sources successfully.',
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
    setSelectedWearableIds((current) => (
      current.includes(deviceId)
        ? current.filter((item) => item !== deviceId)
        : [...current, deviceId]
    ));
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
        title: 'Device disconnected',
        message: `${getWearableDisplayName(device.id, device.name)} disconnected from Longevity OS.`,
      });
      if (nativeDisconnectTimerRef.current) {
        clearTimeout(nativeDisconnectTimerRef.current);
      }
      nativeDisconnectTimerRef.current = setTimeout(() => {
        setNativeConnectionDisconnectedDeviceId(null);
      }, 8000);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to disconnect ${device.name}.`;
      showScreenError('Disconnect failed', message);
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const handlePromptDisconnectWearable = (device: LongevityWearableDevice) => {
    if (connectingDeviceId) {
      return;
    }
    Alert.alert(
      'Disconnect device?',
      `Disconnect ${getWearableDisplayName(device.id, device.name)} from Longevity OS?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => void handleDisconnectWearable(device) },
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
      showScreenError('Provider not configured', `${getWearableDisplayName(device.id, device.name)} is not configured on the backend yet.`);
      return;
    }
    setConnectingDeviceId(device.id);
    try {
      if (device.id === 'fitbit' || device.id === 'google-fit' || device.id === 'garmin') {
        const response = await connectWearableProvider(device.id);
        const supported = await Linking.canOpenURL(response.authorization_url);
        if (!supported) {
          throw new Error('Unable to open the wearable connection page.');
        }
        await Linking.openURL(response.authorization_url);
        Alert.alert('Continue in browser', `Finish the ${device.name} login in browser, then return here and press Sync Data.`);
      } else if (Platform.OS === 'web' && device.id === 'apple-health') {
        Alert.alert('Open mobile app', 'Open the iPhone app to connect Apple Health and approve Health permissions.');
      } else if (Platform.OS === 'web' && device.id === 'health-connect') {
        Alert.alert('Open mobile app', 'Open the Android app to connect Health Connect and approve permissions.');
      } else if (Platform.OS === 'web' && device.id === 'this-phone') {
        Alert.alert('Use mobile app', 'Connect the native health source from the mobile app on the device you want to sync.');
      } else if (
        (Platform.OS === 'ios' && (device.id === 'apple-health' || device.id === 'this-phone')) ||
        (Platform.OS === 'android' && (device.id === 'health-connect' || device.id === 'this-phone'))
      ) {
        const readiness = await getNativeHealthReadiness(device.id as NativeSyncTarget);
        if (!readiness.isReady) {
          throw new Error(readiness.message);
        }
        try {
          await authorizeNativeHealthSource(device.id as NativeSyncTarget);
          await markNativeIntegrationConnected({
            provider: device.id as WearableProvider,
            permission_granted: true,
            platform: Platform.OS,
            source_device: getWearableDisplayName(device.id, device.name),
            metadata: {
              bridge_mode: 'native-aggregator',
              bridge_title: Platform.OS === 'ios' ? 'Apple Health source bridge' : 'Android Health Connect source bridge',
              bridge_summary: Platform.OS === 'ios'
                ? 'Reads approved data from apps and devices that sync into Apple Health.'
                : 'Reads approved data from apps and devices that sync into Health Connect.',
              accepted_sources: getPlatformHealthSources(device.id),
              preferred_source_hints: ['Samsung Health', 'Runmefit', 'Apple Health'],
            },
          });
          playNativeSuccessAnimation(device.id);
          setNativeConnectionDisconnectedDeviceId(null);
          recordRunLog({
            level: 'success',
            title: 'Connected successfully',
            message: `${getWearableDisplayName(device.id, device.name)} connected and permission was granted.`,
          });
          dismissScreenError();
        } catch (connectError) {
          const message = connectError instanceof Error ? connectError.message : `Unable to connect ${device.name}.`;
          await markNativeIntegrationConnected({
            provider: device.id as WearableProvider,
            permission_granted: false,
            platform: Platform.OS,
            source_device: getWearableDisplayName(device.id, device.name),
            metadata: {
              bridge_mode: 'native-aggregator',
              bridge_title: Platform.OS === 'ios' ? 'Apple Health source bridge' : 'Android Health Connect source bridge',
              bridge_summary: Platform.OS === 'ios'
                ? 'Reads approved data from apps and devices that sync into Apple Health.'
                : 'Reads approved data from apps and devices that sync into Health Connect.',
              accepted_sources: getPlatformHealthSources(device.id),
              preferred_source_hints: ['Samsung Health', 'Runmefit', 'Apple Health'],
              connection_failed: true,
              failure_message: message,
            },
          }).catch(() => undefined);
          setNativeConnectionFailedDeviceId(device.id);
          setNativeConnectionFailureMessage(message);
          recordRunLog({
            level: 'error',
            title: 'Connection failed',
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
          title: 'Device added',
          message: `${getWearableDisplayName(device.id, device.name)} was added.`,
        });
        if (device.id === 'qr-import') {
          Alert.alert(`${device.name} added`, 'QR import is ready. Press Sync Data, then scan or paste the QR payload to save real synced data.');
        } else if (device.id === 'this-phone') {
          Alert.alert(`${device.name} added`, `This phone is ready. Press Sync Data to read live health data from ${Platform.OS === 'ios' ? 'Apple Health and connected iPhone health apps' : Platform.OS === 'android' ? 'Health Connect and connected Android health apps such as Samsung Health or Runmefit' : 'your supported mobile health source'}.`);
        } else if (device.id === 'apple-health' || device.id === 'health-connect') {
          Alert.alert(`${device.name} added`, `Press Sync Data to read real health records from ${device.name} and store them in Longevity OS. This path accepts any supported source that syncs into the OS health store.`);
        } else {
          Alert.alert(`${device.name} added`, `${device.name} is ready. Press Sync Data to import synced health data.`);
        }
      }
      setSelectedWearableIds([device.id]);
      setShowWearablePicker(false);
      if (device.id !== 'apple-health' && device.id !== 'health-connect' && device.id !== 'this-phone') {
        await loadDashboard(false);
      }
      dismissScreenError();
      const nativeTarget = getPreferredNativeSyncTargetForPlatform();
      if (nativeTarget) {
        void inspectNativeHealthChecklist(nativeTarget)
          .then((checklist) => setNativeChecklistState(checklist))
          .catch(() => undefined);
      }
    } catch (error) {
      if (error instanceof Error && error.message === '__NATIVE_CONNECT_FAILED__') {
        return;
      }
      const message = error instanceof Error ? error.message : `Unable to add ${device.name}.`;
      showScreenError('Add wearable failed', message);
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
      const response = await syncLongevityQrImport(qrPayload, 'QR Import');
      await loadDashboard(false);
      closeQrImportModal();
      dismissScreenError();
      recordRunLog({
        level: 'success',
        title: 'QR imported',
        message: response.message || 'QR health data was imported successfully.',
      });
      Alert.alert('QR data imported', response.message || 'The QR health data was stored successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to import QR health data.';
      showScreenError('Import failed', message);
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
      await generateLongevityWeeklyPlan();
      await loadDashboard(false);
      dismissScreenError();
      recordRunLog({
        level: 'success',
        title: 'Weekly plan ready',
        message: 'The AI weekly plan was generated and saved.',
      });
      Alert.alert('Weekly plan ready', 'Your AI weekly plan has been generated and saved in Healthy Food Library.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate weekly plan.';
      showScreenError('Generation failed', message);
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleToggleHabit = async (habit: LongevityHabit) => {
    try {
      const response = await updateLongevityHabit(habit.id, !habit.done);
      setDashboard((current) => (current ? { ...current, habits: response } : current));
      dismissScreenError();
      recordRunLog({
        level: 'info',
        title: 'Habit updated',
        message: `${habit.title} is now ${!habit.done ? 'done' : 'not done'}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update habit.';
      showScreenError('Update failed', message);
    }
  };

  const renderOverview = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      <SectionTitle>Your Health Status</SectionTitle>
      <View style={styles.heroCard}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=900&q=80' }} style={styles.heroImage} />
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroBadge}>VICTORY AGE</Text>
          <Text style={styles.heroTitle}>Biological Age: {dashboard?.overview.biological_age || 'N/A'}</Text>
          <Text style={styles.heroMeta}>
            Trending {dashboard?.overview.trending_years_younger ?? 0} years younger · Chronological: {dashboard?.overview.chronological_age || 'N/A'}
          </Text>
        </View>
      </View>

      <View style={[styles.metricCard, { marginTop: 14 }]}>
        <Text style={styles.metricLabel}>RECOVERY SCORE</Text>
        <Text style={styles.metricPrimary}>{dashboard?.overview.recovery_score ?? 0}%</Text>
        <Text style={styles.metricMeta}>HRV: {dashboard?.overview.hrv_ms ?? 0} ms · Sleep: {dashboard?.overview.sleep_score ?? 0}%</Text>
      </View>

      <SectionTitle>Quick Actions</SectionTitle>
      <View style={styles.grid}>
        {(dashboard?.quick_actions || []).map((item, index) => (
          <View key={item.id} style={[styles.quickCard, { width: index === 4 ? width - 32 : (width - 44) / 2 }]}>
            <Image source={{ uri: safeImageUri(item.image) }} style={styles.quickImage} />
            <View style={[styles.quickOverlay, { backgroundColor: `${item.color}CC` }]} />
            <Text style={styles.quickText}>{item.label}</Text>
          </View>
        ))}
      </View>

      <SectionTitle>Daily Habits</SectionTitle>
      <View style={styles.listCard}>
        {(dashboard?.habits.habits || []).slice(0, 3).map((habit) => (
          <View key={habit.id} style={styles.listRow}>
            <Ionicons name={habit.icon as any} size={18} color="rgba(255,255,255,0.5)" />
            <Text style={styles.listText}>{habit.title}</Text>
            <Ionicons name={habit.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={habit.done ? '#10B981' : 'rgba(255,255,255,0.3)'} />
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderWearables = () => (
    (() => {
      const devices = (dashboard?.wearables.devices || []).filter((device) => isVisibleWearableForPlatform(device.id));
      const integrationsByProvider = integrations.reduce<Record<string, IntegrationConnection>>((accumulator, item) => {
        accumulator[item.provider] = item;
        return accumulator;
      }, {});
      const nativeDeviceId = Platform.OS === 'ios' ? 'apple-health' : 'health-connect';
      const nativeDevice = devices.find((device) => device.id === nativeDeviceId);
      return (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
            <SectionTitle>Connected Devices</SectionTitle>
            <TouchableOpacity style={styles.addDeviceCard} activeOpacity={0.88} onPress={handleAddWearable}>
              <View style={styles.addDeviceIconWrap}>
                <Ionicons name="add" size={24} color="#000" />
              </View>
              <View style={styles.addDeviceContent}>
                <Text style={styles.addDeviceTitle}>Add Device</Text>
                <Text style={styles.addDeviceSubtitle}>Choose Apple Health on iPhone or Health Connect on Android.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.88} onPress={() => void handleSyncWearables()} disabled={syncingWearables}>
              <Ionicons name={syncingWearables ? 'hourglass-outline' : 'refresh'} size={18} color="#000" />
              <Text style={styles.primaryButtonText}>{syncingWearables ? 'SYNCING HEALTH DATA...' : 'SYNC DATA'}</Text>
            </TouchableOpacity>
            <SectionTitle>Synced Data</SectionTitle>
            {visibleHealthSummaryCards.length > 0 ? (
              <View style={styles.summaryGrid}>
                {visibleHealthSummaryCards.slice(0, 6).map((item) => (
                  <View key={item.metric_type} style={styles.summaryCard}>
                    <Text style={styles.summaryMetric}>
                      {item.metric_type.replace(/_/g, ' ').toUpperCase()}
                      {item.metric_type === 'distance' && item.unit ? ` (${item.unit.toUpperCase()})` : ''}
                    </Text>
                    <Text style={styles.summaryValue}>{formatHealthMetricValue(item)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>No synced health records yet.</Text>
              </View>
            )}

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
                      <Text style={styles.modalEyebrow}>DEVICE SETUP</Text>
                      <Text style={styles.modalTitle}>Add Device</Text>
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
                            const statusLabel = getIntegrationStatusLabel(statusValue);
                            const lastSyncedLabel = formatIntegrationTimestamp(integration?.last_synced_at);
                            const isNativeSuccess = nativeConnectionSuccessDeviceId === nativeDevice.id;
                            const isNativeFailure = nativeConnectionFailedDeviceId === nativeDevice.id;
                            const isNativeDisconnected = nativeConnectionDisconnectedDeviceId === nativeDevice.id;
                            const isConnectedState = isNativeSuccess || statusValue === 'connected';
                            const connectLabel = connectingDeviceId === nativeDevice.id
                              ? (isConnectedState ? 'Disconnecting...' : 'Connecting...')
                              : statusValue === 'syncing'
                                ? 'Syncing...'
                                : statusValue === 'provider_not_configured'
                                  ? 'Unavailable'
                                  : isNativeFailure
                                    ? 'Retry Connect'
                                    : isConnectedState
                                      ? 'Disconnect'
                                      : 'Connect';
                            const connectDisabled = connectingDeviceId === nativeDevice.id
                              || statusValue === 'syncing'
                              || statusValue === 'provider_not_configured';
                            return (
                              <>
                                <View style={styles.availableDeviceContent}>
                                  <Text style={styles.availableDeviceTitle}>{getWearableDisplayName(nativeDevice.id, nativeDevice.name)}</Text>
                                  <Text style={styles.availableDeviceSubtitle}>{getWearableSourceDescription(nativeDevice.id)}</Text>
                                  <Text style={styles.availableDeviceFlow}>{getRunmefitBridgeSummary(nativeDevice.id)}</Text>
                                  {isNativeSuccess ? (
                                    <Animated.View
                                      style={[
                                        styles.deviceConnectedBadge,
                                        {
                                          opacity: nativeSuccessOpacity,
                                          transform: [{ scale: nativeSuccessScale }],
                                        },
                                      ]}
                                    >
                                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                      <Text style={styles.deviceConnectedText}>Connected successfully</Text>
                                    </Animated.View>
                                  ) : isNativeDisconnected ? (
                                    <View style={styles.deviceDisconnectedBadge}>
                                      <Ionicons name="information-circle-outline" size={14} color="#93C5FD" />
                                      <View style={styles.deviceFailedCopy}>
                                        <Text style={styles.deviceDisconnectedText}>Disconnected</Text>
                                        <Text style={styles.deviceDisconnectedMessage} numberOfLines={2}>
                                          Your health data is not being synced.
                                        </Text>
                                      </View>
                                    </View>
                                  ) : isNativeFailure ? (
                                    <View style={styles.deviceFailedBadge}>
                                      <Ionicons name="close-circle" size={14} color="#F87171" />
                                      <View style={styles.deviceFailedCopy}>
                                        <Text style={styles.deviceFailedText}>Connection failed</Text>
                                        <Text style={styles.deviceFailedMessage} numberOfLines={2}>
                                          {nativeConnectionFailureMessage || 'Permission was denied or the native flow could not complete.'}
                                        </Text>
                                      </View>
                                    </View>
                                  ) : (
                                    <Text style={styles.availableDeviceStatus}>
                                      {statusLabel}{lastSyncedLabel ? ` · Last synced ${lastSyncedLabel}` : ''}
                                    </Text>
                                  )}
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
                                    <Ionicons name="hourglass-outline" size={14} color="#000" />
                                  ) : isConnectedState ? (
                                    <Ionicons name="remove-circle-outline" size={14} color="#000" />
                                  ) : isNativeFailure ? (
                                    <Ionicons name="refresh" size={14} color="#000" />
                                  ) : statusValue === 'syncing' ? (
                                    <Ionicons name="sync" size={14} color="#000" />
                                  ) : statusValue === 'provider_not_configured' ? (
                                    <Ionicons name="alert-circle-outline" size={14} color="#000" />
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
                        <Text style={styles.infoText}>No native source is available for this platform.</Text>
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
                      <Text style={styles.modalEyebrow}>QR IMPORT</Text>
                      <Text style={styles.modalTitle}>Import QR Health Data</Text>
                    </View>
                    <TouchableOpacity style={styles.modalCloseButton} activeOpacity={0.88} onPress={closeQrImportModal}>
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.connectionDescription}>
                    Paste the real QR payload from the wearable export or bridge app. The backend validates it and stores the synced metrics in the database.
                  </Text>
                  <View style={styles.connectionInfoCard}>
                    <Text style={styles.connectionInfoTitle}>Payload format</Text>
                    <Text style={styles.connectionInfoText}>
                      JSON or base64 JSON containing `metrics`, optional `source_device`, and optional `batch_id`.
                    </Text>
                  </View>
                  <TextInput
                    value={qrPayload}
                    onChangeText={setQrPayload}
                    placeholder="Paste QR payload here"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    multiline
                    textAlignVertical="top"
                    style={styles.payloadInput}
                  />
                  <TouchableOpacity style={styles.connectionPrimaryButton} activeOpacity={0.88} onPress={() => void handleImportQrPayload()} disabled={importingPayload}>
                    <Ionicons name={importingPayload ? 'hourglass-outline' : 'qr-code-outline'} size={18} color="#000" />
                    <Text style={styles.connectionPrimaryText}>{importingPayload ? 'IMPORTING...' : 'SAVE QR DATA'}</Text>
                  </TouchableOpacity>
                </Pressable>
              </Pressable>
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
          <Text style={styles.heroBadge}>AI-POWERED LIBRARY</Text>
          <Text style={styles.heroTitle}>Heal with Food</Text>
          <Text style={styles.heroMeta}>Research-backed nutrition guidance tailored to your health profile.</Text>
          {canGenerateLongevityPlan ? (
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.88} onPress={() => void handleGenerateWeeklyPlan()} disabled={generatingPlan}>
              <Ionicons name={generatingPlan ? 'hourglass-outline' : 'sparkles'} size={16} color="#000" />
              <Text style={styles.secondaryButtonText}>{generatingPlan ? 'Generating...' : 'Generate My Weekly Plan'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>Weekly Longevity plan generation is available on Inner Circle only.</Text>
            </View>
          )}
        </View>
      </View>

      <SectionTitle>Health Food Library</SectionTitle>
      <View style={styles.grid}>
        {(dashboard?.heal_categories || []).map((item) => (
          <View key={item.id} style={[styles.quickCard, { width: (width - 44) / 2 }]}>
            <Image source={{ uri: safeImageUri(item.image) }} style={styles.quickImage} />
            <View style={[styles.quickOverlay, { backgroundColor: `${item.color}CC` }]} />
            <Text style={styles.quickText}>{item.label}</Text>
          </View>
        ))}
      </View>
      {dashboard?.weekly_plan ? (
        <>
          <SectionTitle>Your Weekly AI Plan</SectionTitle>
          <View style={styles.listCard}>
            <View style={styles.planHeaderCard}>
              <Text style={styles.planSummaryText}>{dashboard.weekly_plan.message}</Text>
              <Text style={styles.planGeneratedAt}>
                Generated {new Date(dashboard.weekly_plan.generated_at).toLocaleDateString()}
              </Text>
            </View>
            {dashboard.weekly_plan.plan_sections.map((section) => (
              <View key={section.id} style={styles.planSectionCard}>
                <Text style={styles.planSectionTitle}>{section.title}</Text>
                <Text style={styles.planSectionSummary}>{section.summary}</Text>
                {section.actions.map((action, index) => (
                  <View key={`${section.id}-${index}`} style={styles.planActionRow}>
                    <Ionicons name="sparkles" size={14} color={Colors.primary} />
                    <Text style={styles.planActionText}>{action}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );

  const renderHabits = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>{dashboard?.habits.streak_days ?? 0} DAY STREAK</Text>
        <Text style={styles.metricPrimary}>Longevity Habits</Text>
        <Text style={styles.metricMeta}>Tap a habit to toggle completion.</Text>
      </View>
      <SectionTitle>Your Habits</SectionTitle>
      <View style={styles.listCard}>
        {(dashboard?.habits.habits || []).map((habit) => (
          <TouchableOpacity key={habit.id} style={[styles.listRow, habit.done && styles.listRowActive]} activeOpacity={0.85} onPress={() => void handleToggleHabit(habit)}>
            <Ionicons name={habit.icon as any} size={18} color={habit.done ? '#10B981' : 'rgba(255,255,255,0.5)'} />
            <View style={styles.listTextWrap}>
              <Text style={[styles.listText, habit.done && styles.listTextActive]}>{habit.title}</Text>
              <Text style={styles.listSubtext}>{habit.subtitle}</Text>
            </View>
            <Ionicons name={habit.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={habit.done ? '#10B981' : 'rgba(255,255,255,0.28)'} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderLearn = (items: LongevityMasterclass[]) => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      <SectionTitle>Masterclasses</SectionTitle>
      {items.length === 0 ? (
        <EmptyState icon="book-outline" title="No Masterclasses Available" subtitle="Check back later for new longevity insights." />
      ) : (
        <View style={styles.listCard}>
          {items.map((item) => (
            <View key={item.id} style={styles.listRow}>
              <Ionicons name="book-outline" size={18} color={Colors.primary} />
              <View style={styles.listTextWrap}>
                <Text style={styles.listText}>{item.title}</Text>
                <Text style={styles.listSubtext}>{item.description}</Text>
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
      return <LoadingState />;
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
            {TABS.map((tab) => {
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
    height: 134,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1F35',
  },
  quickImage: {
    ...StyleSheet.absoluteFillObject,
  },
  quickOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  quickText: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Inter_700Bold',
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
    marginBottom: 3,
  },
  availableDeviceSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  availableDeviceStatus: {
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'Inter_700Bold',
  },
  availableDeviceExamples: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
    fontFamily: 'Inter_400Regular',
  },
  availableDeviceFlow: {
    color: '#DCE7F5',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
    fontFamily: 'Inter_500Medium',
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
    color: '#000',
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
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
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
