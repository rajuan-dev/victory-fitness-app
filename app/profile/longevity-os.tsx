import React, { useState } from 'react';
import {
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import {
  connectLongevityDemoProvider,
  connectWearableProvider,
  fetchCurrentUser,
  fetchLongevityHealthSummary,
  fetchLongevityDashboard,
  generateLongevityWeeklyPlan,
  HealthMetricSummaryItem,
  LongevityCircle,
  LongevityDashboard,
  LongevityHabit,
  LongevityMasterclass,
  LongevityWeeklyPlan,
  LongevityWearableDevice,
  WearableProvider,
  syncLongevityQrImport,
  syncLongevityWearables,
  updateLongevityHabit,
} from '../../lib/api';
import { canAccessFeature } from '../../lib/access';
import { type NativeSyncTarget, syncNativeHealthSource } from '../../lib/nativeHealthSync';
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

function getWearableSourceDescription(deviceId: string) {
  switch (deviceId) {
    case 'fitbit':
    case 'garmin':
      return 'Real provider connection';
    case 'this-phone':
      return Platform.OS === 'ios' ? 'Read this iPhone via Apple Health' : Platform.OS === 'android' ? 'Read this Android phone via Health Connect' : 'Read this phone in a native mobile build';
    case 'qr-import':
      return 'Scan or paste real QR health payloads';
    case 'apple-health':
      return 'Read real Apple Health records';
    case 'health-connect':
      return 'Read real Health Connect records';
    default:
      return 'Health data source';
  }
}

function formatHealthMetricValue(item: HealthMetricSummaryItem) {
  const roundedAverage = Number.isFinite(item.average_value) ? Math.round(item.average_value * 100) / 100 : 0;
  const unitLabel = item.metric_type === 'steps'
    ? 'steps'
    : item.metric_type === 'sleep'
      ? 'hrs'
      : item.metric_type === 'heart_rate'
        ? 'bpm'
        : item.metric_type === 'distance'
          ? 'distance'
          : 'avg';
  return `${roundedAverage} ${unitLabel}`;
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

  const loadDashboard = React.useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const [response, user, summary] = await Promise.all([
        fetchLongevityDashboard(),
        fetchCurrentUser(),
        fetchLongevityHealthSummary().catch(() => null),
      ]);
      setDashboard(response);
      setHealthSummary(Array.isArray(summary?.items) ? summary.items : []);
      setCanGenerateLongevityPlan(canAccessFeature('longevity_plan', user));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load Longevity OS.';
      Alert.alert('Load failed', message);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadDashboard(true);
    }, [loadDashboard]),
  );

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

  const handleSyncWearables = async () => {
    if (syncingWearables) {
      return;
    }
    if (selectedWearableIds.length === 0) {
      Alert.alert('Select wearable', 'Tap one or more wearable sources first, then press Sync Data Now.');
      return;
    }
    if (selectedWearableIds.length === 1 && selectedWearableIds[0] === 'qr-import') {
      setShowQrImportModal(true);
      return;
    }
    if (selectedWearableIds.includes('qr-import')) {
      Alert.alert(
        'Sync separately',
        'QR Import needs a payload input, so sync it separately from Fitbit, Garmin, Apple Health, or Health Connect.',
      );
      return;
    }

    const wantsPhoneBridge = selectedWearableIds.includes('this-phone');
    const wantsAppleHealth = selectedWearableIds.includes('apple-health');
    const wantsHealthConnect = selectedWearableIds.includes('health-connect');
    const backendProviderIds = selectedWearableIds.filter((providerId) => !['this-phone', 'apple-health', 'health-connect'].includes(providerId));

    setSyncingWearables(true);
    try {
      const tasks: Promise<unknown>[] = [];
      const nativeTargets = new Set<WearableProvider>();

      if (Platform.OS === 'ios' && (wantsPhoneBridge || wantsAppleHealth)) {
        nativeTargets.add('apple-health');
      }
      if (Platform.OS === 'android' && (wantsPhoneBridge || wantsHealthConnect)) {
        nativeTargets.add('health-connect');
      }

      if (Platform.OS === 'ios' && wantsHealthConnect) {
        throw new Error('Health Connect is available on Android only.');
      }
      if (Platform.OS === 'android' && wantsAppleHealth) {
        throw new Error('Apple Health is available on iPhone only.');
      }

      nativeTargets.forEach((provider) => {
        tasks.push(syncNativeHealthSource(provider as NativeSyncTarget));
      });

      if (backendProviderIds.length > 0) {
        tasks.push(syncLongevityWearables(backendProviderIds as WearableProvider[]));
      }

      if (tasks.length === 0) {
        throw new Error('Select at least one supported data source to sync.');
      }

      await Promise.all(tasks);
      await loadDashboard(false);
      Alert.alert('Data sync successfully', 'All Longevity OS calculations are now using the synced data.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync wearables.';
      Alert.alert('Sync failed', message);
    } finally {
      setSyncingWearables(false);
    }
  };

  const handleAddWearable = () => {
    setShowWearablePicker(true);
  };

  const handleToggleWearableSelection = (deviceId: string) => {
    setSelectedWearableIds((current) => (
      current.includes(deviceId)
        ? current.filter((item) => item !== deviceId)
        : [...current, deviceId]
    ));
  };

  const closeQrImportModal = () => {
    setShowQrImportModal(false);
    setQrPayload('');
  };

  const handleSelectWearable = async (device: LongevityWearableDevice) => {
    if (connectingDeviceId) {
      return;
    }
    setConnectingDeviceId(device.id);
    try {
      if (device.id === 'fitbit' || device.id === 'garmin') {
        const response = await connectWearableProvider(device.id);
        const supported = await Linking.canOpenURL(response.authorization_url);
        if (!supported) {
          throw new Error('Unable to open the wearable connection page.');
        }
        await Linking.openURL(response.authorization_url);
        Alert.alert('Continue in browser', `Finish the ${device.name} connection flow, then return here and press Sync Data Now.`);
      } else {
        await connectLongevityDemoProvider(device.id as WearableProvider);
        if (device.id === 'qr-import') {
          Alert.alert(`${device.name} added`, 'QR import is ready. Press Sync Data Now, scan or paste the QR payload, and save the real synced data.');
        } else if (device.id === 'this-phone') {
          Alert.alert(`${device.name} added`, `This phone is ready. Press Sync Data Now to read live health data from ${Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect' : 'your supported mobile health source'}.`);
        } else if (device.id === 'apple-health' || device.id === 'health-connect') {
          Alert.alert(`${device.name} added`, `Press Sync Data Now to read real health records from ${device.name} and store them in Longevity OS.`);
        } else {
          Alert.alert(`${device.name} added`, `${device.name} is ready. Press Sync Data Now to import synced health data.`);
        }
      }
      setSelectedWearableIds((current) => (
        current.includes(device.id) ? current : [...current, device.id]
      ));
      setShowWearablePicker(false);
      await loadDashboard(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to add ${device.name}.`;
      Alert.alert('Add wearable failed', message);
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
      Alert.alert('QR data imported', response.message || 'The QR health data was stored successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to import QR health data.';
      Alert.alert('Import failed', message);
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
      Alert.alert('Weekly plan ready', 'Your AI weekly plan has been generated and saved in Healthy Food Library.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate weekly plan.';
      Alert.alert('Generation failed', message);
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleToggleHabit = async (habit: LongevityHabit) => {
    try {
      const response = await updateLongevityHabit(habit.id, !habit.done);
      setDashboard((current) => (current ? { ...current, habits: response } : current));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update habit.';
      Alert.alert('Update failed', message);
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
      const devices = dashboard?.wearables.devices || [];
      const availableDevices = devices.filter((device) => !device.active);
      const selectedSourceLabels = selectedWearableIds
        .map((providerId) => devices.find((device) => device.id === providerId)?.name || providerId)
        .join(', ');
      return (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
            <View style={styles.sectionHeaderRow}>
              <SectionTitle>Wearable Sources</SectionTitle>
              <TouchableOpacity style={styles.inlineActionButton} activeOpacity={0.88} onPress={handleAddWearable}>
                <Ionicons name="add" size={16} color="#000" />
                <Text style={styles.inlineActionText}>Add Wearable</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {devices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  activeOpacity={0.88}
                  onPress={() => handleToggleWearableSelection(device.id)}
                  style={[
                    styles.deviceCard,
                    { width: (width - 32) * 0.52 },
                    selectedWearableIds.includes(device.id) && styles.deviceCardSelected,
                  ]}
                >
                  <Image source={{ uri: safeImageUri(device.image) }} style={styles.deviceImage} />
                  <View style={styles.deviceOverlay} />
                  <View style={styles.deviceContent}>
                    <Text style={[styles.deviceTitle, device.active && { color: Colors.primary }]}>{device.name}</Text>
                    <Text style={styles.deviceMeta}>{device.status}</Text>
                    <View style={styles.deviceConnectedBadge}>
                      <Ionicons name={device.active ? 'checkmark-circle' : 'hardware-chip-outline'} size={15} color={device.active ? '#10B981' : Colors.primary} />
                      <Text style={styles.deviceConnectedText}>{selectedWearableIds.includes(device.id) ? 'SELECTED' : device.active ? 'SYNCED' : 'READY'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Real synced health data is stored in the backend database and used for Longevity OS insights, recovery tracking, and weekly planning. iPhone reads from Apple Health, Android reads from Health Connect, and Fitbit or Garmin stay on direct provider sync.
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.88} onPress={() => void handleSyncWearables()} disabled={syncingWearables}>
              <Ionicons name={syncingWearables ? 'hourglass-outline' : 'refresh'} size={18} color="#000" />
              <Text style={styles.primaryButtonText}>{syncingWearables ? 'SYNCING HEALTH DATA...' : 'SYNC DATA NOW'}</Text>
            </TouchableOpacity>
            <Text style={styles.selectionHintText}>
              Selected sources: {selectedSourceLabels || 'none'}
            </Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>{dashboard?.wearables.sync_message || 'No data synced yet.'}</Text>
              {dashboard?.wearables.last_synced_at ? (
                <Text style={styles.infoMetaText}>
                  Last synced {new Date(dashboard.wearables.last_synced_at).toLocaleString()}
                </Text>
              ) : null}
            </View>

            <SectionTitle>Synced Data</SectionTitle>
            {healthSummary.length > 0 ? (
              <View style={styles.summaryGrid}>
                {healthSummary.slice(0, 6).map((item) => (
                  <View key={`${item.provider}-${item.metric_type}`} style={styles.summaryCard}>
                    <Text style={styles.summaryMetric}>{item.metric_type.replace(/_/g, ' ').toUpperCase()}</Text>
                    <Text style={styles.summaryValue}>{formatHealthMetricValue(item)}</Text>
                    <Text style={styles.summaryMeta}>
                      {item.records} records · {item.provider}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>
                  No synced health records yet. Add a wearable source, then import a real payload from QR, this phone, Fitbit, or Garmin.
                </Text>
              </View>
            )}

            <Modal visible={showWearablePicker} transparent animationType="fade" onRequestClose={() => setShowWearablePicker(false)}>
              <Pressable style={styles.modalBackdrop} onPress={() => setShowWearablePicker(false)}>
                <Pressable style={styles.modalCard} onPress={() => undefined}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalEyebrow}>WEARABLE SETUP</Text>
                      <Text style={styles.modalTitle}>Add Wearable</Text>
                    </View>
                    <TouchableOpacity style={styles.modalCloseButton} activeOpacity={0.88} onPress={() => setShowWearablePicker(false)}>
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.connectionDescription}>
                    Select one or more wearable sources first. After they are added, use Sync Data Now to import their health data into Longevity OS.
                  </Text>
                  <View style={styles.availableDeviceList}>
                    {availableDevices.length > 0 ? (
                      availableDevices.map((device) => (
                        <TouchableOpacity
                          key={device.id}
                          style={styles.availableDeviceRow}
                          activeOpacity={0.88}
                          disabled={connectingDeviceId === device.id}
                          onPress={() => void handleSelectWearable(device)}
                        >
                          <View style={styles.availableDeviceContent}>
                            <Text style={styles.availableDeviceTitle}>{device.name}</Text>
                            <Text style={styles.availableDeviceSubtitle}>{getWearableSourceDescription(device.id)}</Text>
                          </View>
                          <Ionicons
                            name={connectingDeviceId === device.id ? 'hourglass-outline' : 'chevron-forward'}
                            size={18}
                            color={Colors.primary}
                          />
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.infoText}>All wearable sources are already added.</Text>
                    )}
                  </View>
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
  infoMetaText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
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
