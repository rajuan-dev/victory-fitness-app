import { Platform } from 'react-native';

import type { MobileHealthSyncPayload, NormalizedHealthMetricPayload, WearableSyncResponse } from './api';
import {
  syncLongevityAppleHealth,
  syncLongevityHealthConnect,
} from './api';

export type NativeSyncTarget = 'apple-health' | 'health-connect' | 'this-phone';
export type NativeSyncEffectiveTarget = 'apple-health' | 'health-connect';
export type NativeHealthReadiness = {
  effectiveTarget: NativeSyncEffectiveTarget;
  label: string;
  isReady: boolean;
  status: 'ready' | 'needs_setup' | 'update_required' | 'unsupported_platform';
  message: string;
  actionLabel?: string;
  action?: 'open_settings' | 'open_data_management';
  detectedSourceLabels?: string[];
};
export type NativeHealthChecklistItem = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
};
export type NativeHealthChecklistState = NativeHealthReadiness & {
  items: NativeHealthChecklistItem[];
  detectedSourceLabels: string[];
  recordsFound: number;
  missingPermissions: string[];
};

const HEALTH_SYNC_LOOKBACK_DAYS = 7;
const HEALTH_CONNECT_READ_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'Distance' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
  { accessType: 'read' as const, recordType: 'HeartRateVariabilityRmssd' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
  { accessType: 'read' as const, recordType: 'OxygenSaturation' as const },
];
const HEALTH_CONNECT_SOURCE_CHECK_RECORD_TYPES = [
  'Steps',
  'Distance',
  'ActiveCaloriesBurned',
  'HeartRate',
  'HeartRateVariabilityRmssd',
  'SleepSession',
  'OxygenSaturation',
] as const;

function getSyncWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - HEALTH_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function buildExternalId(provider: string, metricType: string, startTime: string, endTime: string, value: number | string) {
  return `${provider}:${metricType}:${startTime}:${endTime}:${String(value)}`;
}

function buildMetric(
  provider: string,
  metricType: NormalizedHealthMetricPayload['metric_type'],
  value: number | string,
  unit: string,
  startTime: string,
  endTime: string,
  sourceDevice: string,
  metadata: Record<string, unknown> = {},
): NormalizedHealthMetricPayload {
  return {
    metric_type: metricType,
    value,
    unit,
    start_time: startTime,
    end_time: endTime,
    source_device: sourceDevice,
    metadata: {
      external_id: buildExternalId(provider, metricType, startTime, endTime, value),
      ...metadata,
    },
  };
}

function toHours(startTime: string, endTime: string) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.max((end - start) / (1000 * 60 * 60), 0);
}

function normalizeHealthSourceLabel(origin: string) {
  const normalized = String(origin || '').toLowerCase();
  if (!normalized) {
    return 'Unknown source';
  }
  if (normalized.includes('samsung')) {
    return 'Samsung Health';
  }
  if (normalized.includes('runmefit')) {
    return 'Runmefit';
  }
  if (normalized.includes('fitbit')) {
    return 'Fitbit';
  }
  if (normalized.includes('google') && normalized.includes('fit')) {
    return 'Google Fit';
  }
  if (normalized.includes('garmin')) {
    return 'Garmin';
  }
  if (normalized.includes('oura')) {
    return 'Oura';
  }
  if (normalized.includes('withings')) {
    return 'Withings';
  }
  return origin;
}

function sortHealthSourceLabels(labels: string[]) {
  const priority = ['Runmefit', 'Samsung Health', 'Apple Health'];
  return [...labels].sort((left, right) => {
    const leftIndex = priority.indexOf(left);
    const rightIndex = priority.indexOf(right);
    const safeLeft = leftIndex === -1 ? priority.length : leftIndex;
    const safeRight = rightIndex === -1 ? priority.length : rightIndex;
    if (safeLeft !== safeRight) {
      return safeLeft - safeRight;
    }
    return left.localeCompare(right);
  });
}

function buildNativeChecklistItems(base: {
  platformLabel: string;
  ready: boolean;
  hasPermission: boolean;
  hasSourceData: boolean;
  detectedSourceLabels: string[];
  recordsFound: number;
  setupMessage: string;
  permissionMessage: string;
  sourceMessage: string;
  syncMessage: string;
}): NativeHealthChecklistItem[] {
  return [
    {
      id: `${base.platformLabel}-available`,
      label: `${base.platformLabel} available`,
      detail: base.setupMessage,
      done: base.ready,
    },
    {
      id: `${base.platformLabel}-permission`,
      label: 'This app can read health data',
      detail: base.permissionMessage,
      done: base.hasPermission,
    },
    {
      id: `${base.platformLabel}-source`,
      label: 'Source app writes data',
      detail: base.sourceMessage,
      done: base.hasSourceData,
    },
    {
      id: `${base.platformLabel}-sync`,
      label: 'Ready to sync',
      detail: base.syncMessage,
      done: base.ready && base.hasPermission && base.hasSourceData,
    },
  ];
}

export function normalizeNativeSyncTarget(target: NativeSyncTarget): NativeSyncEffectiveTarget {
  if (target === 'this-phone') {
    if (Platform.OS === 'ios') {
      return 'apple-health';
    }
    if (Platform.OS === 'android') {
      return 'health-connect';
    }
  }
  if (target === 'apple-health') {
    return 'apple-health';
  }
  return 'health-connect';
}

export function getPreferredNativeSyncTargetForPlatform(): NativeSyncEffectiveTarget | null {
  if (Platform.OS === 'ios') {
    return 'apple-health';
  }
  if (Platform.OS === 'android') {
    return 'health-connect';
  }
  return null;
}

function assertNativePlatform(target: 'apple-health' | 'health-connect') {
  if (target === 'apple-health' && Platform.OS !== 'ios') {
    throw new Error('Apple Health sync is only available on iPhone.');
  }
  if (target === 'health-connect' && Platform.OS !== 'android') {
    throw new Error('Health Connect sync is only available on Android.');
  }
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Native health sync is only available on iPhone or Android development builds.');
  }
}

function callbackToPromise<T>(register: (callback: (error: string | null, result: T) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    register((error, result) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }
      resolve(result);
    });
  });
}

async function collectAppleHealthMetrics(): Promise<MobileHealthSyncPayload> {
  const AppleHealthKit = require('react-native-health').default;
  await authorizeAppleHealth(AppleHealthKit);

  const { startIso, endIso } = getSyncWindow();
  const baseOptions = {
    startDate: startIso,
    endDate: endIso,
    ascending: false,
  };

  const [
    stepSamples,
    distanceSamples,
    calorieSamples,
    heartRateSamples,
    hrvSamples,
    sleepSamples,
    spo2Samples,
  ] = await Promise.all([
    callbackToPromise<any[]>((callback) => AppleHealthKit.getDailyStepCountSamples(baseOptions, callback)),
    callbackToPromise<any[]>((callback) => AppleHealthKit.getDailyDistanceWalkingRunningSamples({ ...baseOptions, unit: AppleHealthKit.Constants.Units.meter }, callback)),
    callbackToPromise<any[]>((callback) => AppleHealthKit.getActiveEnergyBurned({ ...baseOptions, unit: AppleHealthKit.Constants.Units.calorie }, callback)),
    callbackToPromise<any[]>((callback) => AppleHealthKit.getHeartRateSamples({ ...baseOptions, unit: AppleHealthKit.Constants.Units.bpm, limit: 100 }, callback)),
    callbackToPromise<any[]>((callback) => AppleHealthKit.getHeartRateVariabilitySamples({ ...baseOptions, limit: 100 }, callback)),
    callbackToPromise<any[]>((callback) => AppleHealthKit.getSleepSamples(baseOptions, callback)),
    callbackToPromise<any[]>((callback) => AppleHealthKit.getOxygenSaturationSamples({ ...baseOptions, limit: 100 }, callback)),
  ]);

  const sourceDevice = 'Apple Health';
  const metrics: NormalizedHealthMetricPayload[] = [];

  stepSamples.forEach((item) => {
    metrics.push(
      buildMetric(
        'apple-health',
        'steps',
        Number(item.value ?? 0),
        'count',
        String(item.startDate),
        String(item.endDate),
        sourceDevice,
      ),
    );
  });

  distanceSamples.forEach((item) => {
    metrics.push(
      buildMetric(
        'apple-health',
        'distance',
        Number(item.value ?? 0),
        'meter',
        String(item.startDate),
        String(item.endDate),
        sourceDevice,
      ),
    );
  });

  calorieSamples.forEach((item) => {
    metrics.push(
      buildMetric(
        'apple-health',
        'calories',
        Number(item.value ?? 0),
        'calorie',
        String(item.startDate),
        String(item.endDate),
        sourceDevice,
      ),
    );
  });

  heartRateSamples.forEach((item) => {
    metrics.push(
      buildMetric(
        'apple-health',
        'heart_rate',
        Number(item.value ?? 0),
        'bpm',
        String(item.startDate),
        String(item.endDate),
        sourceDevice,
      ),
    );
  });

  hrvSamples.forEach((item) => {
    metrics.push(
      buildMetric(
        'apple-health',
        'hrv',
        Number(item.value ?? 0),
        'ms',
        String(item.startDate),
        String(item.endDate),
        sourceDevice,
      ),
    );
  });

  sleepSamples.forEach((item) => {
    const startTime = String(item.startDate);
    const endTime = String(item.endDate);
    metrics.push(
      buildMetric(
        'apple-health',
        'sleep',
        Math.round(toHours(startTime, endTime) * 100) / 100,
        'hours',
        startTime,
        endTime,
        sourceDevice,
      ),
    );
  });

  spo2Samples.forEach((item) => {
    metrics.push(
      buildMetric(
        'apple-health',
        'spo2',
        Number(item.value ?? 0),
        '%',
        String(item.startDate),
        String(item.endDate),
        sourceDevice,
      ),
    );
  });

  if (metrics.length === 0) {
    throw new Error('No Apple Health records were found for the last 7 days.');
  }

  return {
    metrics,
    source_device: sourceDevice,
    batch_id: `apple-health-${new Date().toISOString()}`,
  };
}

async function collectHealthConnectMetrics(): Promise<MobileHealthSyncPayload> {
  const HealthConnect = require('react-native-health-connect') as typeof import('react-native-health-connect');
  await authorizeHealthConnect(HealthConnect);

  const { startIso, endIso } = getSyncWindow();
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: startIso,
    endTime: endIso,
  };

  const [
    stepTotals,
    calorieTotals,
    distanceTotals,
    heartRateRecords,
    hrvRecords,
    sleepRecords,
    oxygenRecords,
  ] = await Promise.all([
    HealthConnect.aggregateRecord({ recordType: 'Steps', timeRangeFilter }),
    HealthConnect.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter }),
    HealthConnect.aggregateRecord({ recordType: 'Distance', timeRangeFilter }),
    HealthConnect.readRecords('HeartRate', { timeRangeFilter, ascendingOrder: false, pageSize: 50 }),
    HealthConnect.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter, ascendingOrder: false, pageSize: 50 }),
    HealthConnect.readRecords('SleepSession', { timeRangeFilter, ascendingOrder: false, pageSize: 30 }),
    HealthConnect.readRecords('OxygenSaturation', { timeRangeFilter, ascendingOrder: false, pageSize: 50 }),
  ]);

  const sourceDevice = 'Health Connect';
  const metrics: NormalizedHealthMetricPayload[] = [];

  if (typeof stepTotals.COUNT_TOTAL === 'number' && stepTotals.COUNT_TOTAL > 0) {
    metrics.push(buildMetric('health-connect', 'steps', stepTotals.COUNT_TOTAL, 'count', startIso, endIso, sourceDevice));
  }
  if (distanceTotals.DISTANCE?.inMeters) {
    metrics.push(buildMetric('health-connect', 'distance', distanceTotals.DISTANCE.inMeters, 'meter', startIso, endIso, sourceDevice));
  }
  if (calorieTotals.ACTIVE_CALORIES_TOTAL?.inKilocalories) {
    metrics.push(buildMetric('health-connect', 'calories', calorieTotals.ACTIVE_CALORIES_TOTAL.inKilocalories, 'kcal', startIso, endIso, sourceDevice));
  }

  heartRateRecords.records.forEach((record: any) => {
    const samples = Array.isArray(record.samples) ? record.samples : [];
    samples.forEach((sample: any) => {
      metrics.push(
        buildMetric(
          'health-connect',
          'heart_rate',
          Number(sample.beatsPerMinute ?? 0),
          'bpm',
          String(sample.time || record.startTime),
          String(sample.time || record.endTime || record.startTime),
          sourceDevice,
        ),
      );
    });
  });

  hrvRecords.records.forEach((record: any) => {
    metrics.push(
      buildMetric(
        'health-connect',
        'hrv',
        Number(record.heartRateVariabilityMillis ?? 0),
        'ms',
        String(record.time || record.startTime),
        String(record.time || record.endTime || record.startTime),
        sourceDevice,
      ),
    );
  });

  sleepRecords.records.forEach((record: any) => {
    metrics.push(
      buildMetric(
        'health-connect',
        'sleep',
        Math.round(toHours(String(record.startTime), String(record.endTime)) * 100) / 100,
        'hours',
        String(record.startTime),
        String(record.endTime),
        sourceDevice,
      ),
    );
  });

  oxygenRecords.records.forEach((record: any) => {
    metrics.push(
      buildMetric(
        'health-connect',
        'spo2',
        Number(record.percentage ?? 0),
        '%',
        String(record.time || record.startTime),
        String(record.time || record.endTime || record.startTime),
        sourceDevice,
      ),
    );
  });

  if (metrics.length === 0) {
    throw new Error('No Health Connect records were found for the last 7 days.');
  }

  return {
    metrics,
    source_device: sourceDevice,
    batch_id: `health-connect-${new Date().toISOString()}`,
  };
}

export function getNativeSyncLabel(target: NativeSyncTarget) {
  const effectiveTarget = normalizeNativeSyncTarget(target);
  return effectiveTarget === 'apple-health' ? 'Apple Health' : 'Health Connect';
}

async function authorizeAppleHealth(AppleHealthKit: any) {
  const permissions = {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.StepCount,
        AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
        AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
        AppleHealthKit.Constants.Permissions.HeartRate,
        AppleHealthKit.Constants.Permissions.HeartRateVariability,
        AppleHealthKit.Constants.Permissions.SleepAnalysis,
        AppleHealthKit.Constants.Permissions.OxygenSaturation,
      ],
      write: [],
    },
  };

  const available = await callbackToPromise<boolean>((callback) => {
    AppleHealthKit.isAvailable((error: string | null, result: boolean) => callback(error, result));
  });
  if (!available) {
    throw new Error('Apple Health is not available on this device.');
  }

  await callbackToPromise((callback) => {
    AppleHealthKit.initHealthKit(permissions, (error: string | null) => callback(error, true));
  });
}

async function authorizeHealthConnect(HealthConnect: typeof import('react-native-health-connect')) {
  const initialized = await HealthConnect.initialize();
  if (!initialized) {
    throw new Error('Health Connect could not be initialized on this device.');
  }

  await HealthConnect.requestPermission(HEALTH_CONNECT_READ_PERMISSIONS);
}

export async function getNativeHealthReadiness(target: NativeSyncTarget): Promise<NativeHealthReadiness> {
  const effectiveTarget = normalizeNativeSyncTarget(target);
  const label = getNativeSyncLabel(target);

  if (effectiveTarget === 'apple-health') {
    if (Platform.OS !== 'ios') {
      return {
        effectiveTarget,
        label,
        isReady: false,
        status: 'unsupported_platform',
        message: 'Apple Health is only available on iPhone.',
      };
    }
    return {
      effectiveTarget,
      label,
      isReady: true,
      status: 'ready',
      message: 'Apple Health is available. Connect it and allow read access to sync iPhone health sources.',
    };
  }

  if (Platform.OS !== 'android') {
    return {
      effectiveTarget,
      label,
      isReady: false,
      status: 'unsupported_platform',
      message: 'Health Connect is only available on Android.',
    };
  }

  const HealthConnect = require('react-native-health-connect') as typeof import('react-native-health-connect');
  const { SdkAvailabilityStatus } = HealthConnect;
  const sdkStatus = await HealthConnect.getSdkStatus();

  if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return {
      effectiveTarget,
      label,
      isReady: false,
      status: 'update_required',
      message: 'Health Connect needs to be installed or updated before this app can sync Android health sources.',
      action: 'open_settings',
      actionLabel: 'Open Health Connect',
    };
  }

  if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    return {
      effectiveTarget,
      label,
      isReady: false,
      status: 'needs_setup',
      message: 'Health Connect is not ready on this phone yet. Install it first, then connect Samsung Health, Runmefit, or other Android health apps.',
      action: 'open_settings',
      actionLabel: 'Open Health Connect',
    };
  }

  const initialized = await HealthConnect.initialize();
  if (!initialized) {
    return {
      effectiveTarget,
      label,
      isReady: false,
      status: 'needs_setup',
      message: 'Health Connect is installed, but the app could not initialize it yet. Open Health Connect and finish setup first.',
      action: 'open_settings',
      actionLabel: 'Open Health Connect',
    };
  }

  const grantedPermissions = await HealthConnect.getGrantedPermissions().catch(() => []);
  const hasAnyReadPermission = Array.isArray(grantedPermissions)
    && grantedPermissions.some((permission: any) => permission?.accessType === 'read');

  return {
    effectiveTarget,
    label,
    isReady: true,
    status: 'ready',
    message: hasAnyReadPermission
      ? 'Health Connect is ready. Sync approved records from Samsung Health, Runmefit, and other connected Android apps.'
      : 'Health Connect is installed. Connect it in this app and allow read access to sync Samsung Health, Runmefit, and other Android apps.',
    action: 'open_data_management',
    actionLabel: 'Manage Permissions',
  };
}

async function inspectAndroidSourceRecords(HealthConnect: typeof import('react-native-health-connect')) {
  const { startIso, endIso } = getSyncWindow();
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: startIso,
    endTime: endIso,
  };

  const readResults = await Promise.all(
    HEALTH_CONNECT_SOURCE_CHECK_RECORD_TYPES.map(async (recordType) => {
      try {
        const result = await HealthConnect.readRecords(recordType as any, {
          timeRangeFilter,
          ascendingOrder: false,
          pageSize: 1,
        });
        return Array.isArray(result.records) ? result.records : [];
      } catch {
        return [];
      }
    }),
  );

  const records = readResults.flat();
  const origins = new Set<string>();
  records.forEach((record: any) => {
    const origin = String(record?.metadata?.dataOrigin || '').trim();
    if (origin) {
      origins.add(origin);
    }
  });

  const detectedSourceLabels = sortHealthSourceLabels(Array.from(origins).map(normalizeHealthSourceLabel));
  return {
    recordsFound: records.length,
    detectedSourceLabels,
  };
}

export async function inspectNativeHealthChecklist(target: NativeSyncTarget): Promise<NativeHealthChecklistState> {
  const effectiveTarget = normalizeNativeSyncTarget(target);
  const label = getNativeSyncLabel(target);

  if (effectiveTarget === 'apple-health') {
    const AppleHealthKit = require('react-native-health').default;
    const available = await callbackToPromise<boolean>((callback) => {
      AppleHealthKit.isAvailable((error: string | null, result: boolean) => callback(error, result));
    }).catch(() => false);
    const detectedSourceLabels = available ? ['Apple Health'] : [];
    const items = buildNativeChecklistItems({
      platformLabel: 'Apple Health',
      ready: available,
      hasPermission: available,
      hasSourceData: available,
      detectedSourceLabels,
      recordsFound: available ? 1 : 0,
      setupMessage: available
        ? 'Apple Health is available on this iPhone.'
        : 'Apple Health is not available on this device.',
      permissionMessage: available
        ? 'Apple Health can be read after you approve the permission prompt.'
        : 'Open Apple Health on iPhone first.',
      sourceMessage: available
        ? 'Apple Health can contain data from approved iPhone health apps and devices.'
        : 'No Apple Health data can be read yet.',
      syncMessage: available
        ? 'Press Sync Data to import the last 7 days into Longevity OS.'
        : 'Enable Apple Health first, then sync.',
    });

    return {
      effectiveTarget,
      label,
      isReady: available,
      status: available ? 'ready' : 'needs_setup',
      message: available
        ? 'Apple Health is available. Connect it and allow read access to sync iPhone health sources.'
        : 'Apple Health is not available on this device.',
      items,
      detectedSourceLabels,
      recordsFound: available ? 1 : 0,
      missingPermissions: [],
    };
  }

  if (Platform.OS !== 'android') {
    return {
      effectiveTarget,
      label,
      isReady: false,
      status: 'unsupported_platform',
      message: 'Health Connect is only available on Android.',
      items: [],
      detectedSourceLabels: [],
      recordsFound: 0,
      missingPermissions: [],
    };
  }

  const HealthConnect = require('react-native-health-connect') as typeof import('react-native-health-connect');
  const { SdkAvailabilityStatus } = HealthConnect;
  const sdkStatus = await HealthConnect.getSdkStatus();

  if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return {
      effectiveTarget,
      label,
      isReady: false,
      status: 'update_required',
      message: 'Health Connect needs to be installed or updated before this app can sync Android health sources.',
      action: 'open_settings',
      actionLabel: 'Open Health Connect',
      items: buildNativeChecklistItems({
        platformLabel: 'Health Connect',
        ready: false,
        hasPermission: false,
        hasSourceData: false,
        detectedSourceLabels: [],
        recordsFound: 0,
        setupMessage: 'Install or update Health Connect first.',
        permissionMessage: 'Grant read access after Health Connect is ready.',
        sourceMessage: 'No Android health source data can be checked yet.',
        syncMessage: 'Finish Health Connect setup before syncing.',
      }),
      detectedSourceLabels: [],
      recordsFound: 0,
      missingPermissions: [],
    };
  }

  if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    return {
      effectiveTarget,
      label,
      isReady: false,
      status: 'needs_setup',
      message: 'Health Connect is not ready on this phone yet. Install it first, then connect Samsung Health, Runmefit, or other Android health apps.',
      action: 'open_settings',
      actionLabel: 'Open Health Connect',
      items: buildNativeChecklistItems({
        platformLabel: 'Health Connect',
        ready: false,
        hasPermission: false,
        hasSourceData: false,
        detectedSourceLabels: [],
        recordsFound: 0,
        setupMessage: 'Install or open Health Connect first.',
        permissionMessage: 'Grant read access after Health Connect is ready.',
        sourceMessage: 'No Android health source data can be checked yet.',
        syncMessage: 'Finish Health Connect setup before syncing.',
      }),
      detectedSourceLabels: [],
      recordsFound: 0,
      missingPermissions: [],
    };
  }

  const initialized = await HealthConnect.initialize();
  if (!initialized) {
    return {
      effectiveTarget,
      label,
      isReady: false,
      status: 'needs_setup',
      message: 'Health Connect is installed, but the app could not initialize it yet. Open Health Connect and finish setup first.',
      action: 'open_settings',
      actionLabel: 'Open Health Connect',
      items: buildNativeChecklistItems({
        platformLabel: 'Health Connect',
        ready: false,
        hasPermission: false,
        hasSourceData: false,
        detectedSourceLabels: [],
        recordsFound: 0,
        setupMessage: 'Health Connect is installed but not initialized.',
        permissionMessage: 'Grant read access after Health Connect is ready.',
        sourceMessage: 'No Android health source data can be checked yet.',
        syncMessage: 'Finish Health Connect setup before syncing.',
      }),
      detectedSourceLabels: [],
      recordsFound: 0,
      missingPermissions: [],
    };
  }

  const grantedPermissions = await HealthConnect.getGrantedPermissions().catch(() => []);
  const grantedPermissionKeys = new Set(
    (Array.isArray(grantedPermissions) ? grantedPermissions : []).map((permission: any) => `${permission?.accessType || ''}:${permission?.recordType || ''}`),
  );
  const missingPermissions = HEALTH_CONNECT_READ_PERMISSIONS
    .filter((permission) => !grantedPermissionKeys.has(`${permission.accessType}:${permission.recordType}`))
    .map((permission) => permission.recordType);
  const hasPermission = missingPermissions.length === 0;

  const { recordsFound, detectedSourceLabels } = await inspectAndroidSourceRecords(HealthConnect);
  const hasSourceData = recordsFound > 0;
  const sourceMessage = hasSourceData
    ? `Detected data from ${detectedSourceLabels.join(', ')} in the last 7 days.`
    : 'No source app data was found in the last 7 days. Open Runmefit, Samsung Health, or another source app and make sure it is writing into Health Connect.';
  const isReady = hasPermission && hasSourceData;

  return {
    effectiveTarget,
    label,
    isReady,
    status: isReady ? 'ready' : 'needs_setup',
    message: hasPermission && hasSourceData
      ? `Health Connect is ready. Sync approved records from ${detectedSourceLabels.join(', ')}.`
      : hasPermission
        ? 'Health Connect is installed and your app can read it, but no source app has written data into it yet.'
        : 'Health Connect is installed, but your app still needs read access for the requested health data types.',
    action: hasPermission ? undefined : 'open_data_management',
    actionLabel: hasPermission ? undefined : 'Manage Permissions',
    items: buildNativeChecklistItems({
      platformLabel: 'Health Connect',
      ready: isReady,
      hasPermission,
      hasSourceData,
      detectedSourceLabels,
      recordsFound,
      setupMessage: 'Health Connect is available on this Android phone.',
      permissionMessage: hasPermission
        ? 'Read permissions were granted for the requested health record types.'
        : `Missing read access for: ${missingPermissions.join(', ')}.`,
      sourceMessage,
      syncMessage: hasPermission && hasSourceData
        ? 'Press Sync Data to import the last 7 days into Longevity OS.'
        : 'Fix permissions or source app data before syncing.',
    }),
    detectedSourceLabels,
    recordsFound,
    missingPermissions,
  };
}

export async function openNativeHealthSettings(target: NativeSyncTarget): Promise<boolean> {
  const effectiveTarget = normalizeNativeSyncTarget(target);
  if (effectiveTarget !== 'health-connect' || Platform.OS !== 'android') {
    return false;
  }

  const HealthConnect = require('react-native-health-connect') as typeof import('react-native-health-connect');
  const readiness = await getNativeHealthReadiness(target);
  if (readiness.action === 'open_data_management') {
    HealthConnect.openHealthConnectDataManagement();
    return true;
  }
  HealthConnect.openHealthConnectSettings();
  return true;
}

export async function authorizeNativeHealthSource(target: NativeSyncTarget) {
  const effectiveTarget = normalizeNativeSyncTarget(target);
  assertNativePlatform(effectiveTarget);

  if (effectiveTarget === 'apple-health') {
    const AppleHealthKit = require('react-native-health').default;
    await authorizeAppleHealth(AppleHealthKit);
    return getNativeSyncLabel(target);
  }

  const HealthConnect = require('react-native-health-connect') as typeof import('react-native-health-connect');
  await authorizeHealthConnect(HealthConnect);
  return getNativeSyncLabel(target);
}

export async function revokeNativeHealthPermissions(target: NativeSyncTarget) {
  const effectiveTarget = normalizeNativeSyncTarget(target);
  if (effectiveTarget !== 'health-connect' || Platform.OS !== 'android') {
    return false;
  }

  const HealthConnect = require('react-native-health-connect') as typeof import('react-native-health-connect');
  await HealthConnect.revokeAllPermissions();
  return true;
}

export async function syncNativeHealthSource(target: NativeSyncTarget): Promise<WearableSyncResponse> {
  const effectiveTarget = normalizeNativeSyncTarget(target);
  assertNativePlatform(effectiveTarget);
  if (effectiveTarget === 'apple-health') {
    const payload = await collectAppleHealthMetrics();
    return syncLongevityAppleHealth(payload);
  }
  const payload = await collectHealthConnectMetrics();
  return syncLongevityHealthConnect(payload);
}
