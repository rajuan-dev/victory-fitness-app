import { Platform } from 'react-native';

import type { MobileHealthSyncPayload, NormalizedHealthMetricPayload, WearableSyncResponse } from './api';
import {
  syncLongevityAppleHealth,
  syncLongevityHealthConnect,
} from './api';

export type NativeSyncTarget = 'apple-health' | 'health-connect' | 'this-phone';

const HEALTH_SYNC_LOOKBACK_DAYS = 7;

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

function normalizeNativeSyncTarget(target: NativeSyncTarget): 'apple-health' | 'health-connect' {
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
  const initialized = await HealthConnect.initialize();
  if (!initialized) {
    throw new Error('Health Connect could not be initialized on this device.');
  }

  await HealthConnect.requestPermission([
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
    { accessType: 'read', recordType: 'SleepSession' },
    { accessType: 'read', recordType: 'OxygenSaturation' },
  ]);

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
