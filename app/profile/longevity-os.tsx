import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import {
  connectWearableProvider,
  fetchLongevityDashboard,
  generateLongevityWeeklyPlan,
  LongevityCircle,
  LongevityDashboard,
  LongevityHabit,
  LongevityMasterclass,
  LongevityWearableDevice,
  WearableProvider,
  syncLongevityWearables,
  updateLongevityHabit,
} from '../../lib/api';

const FALLBACK_CARD_IMAGE = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80';

function safeImageUri(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  return normalized || FALLBACK_CARD_IMAGE;
}

const TABS = [
  { id: 'overview', label: 'OVERVIEW', icon: 'pulse-outline' },
  { id: 'wearables', label: 'WEARABLES', icon: 'watch-outline' },
  { id: 'heal', label: 'HEAL', icon: 'restaurant-outline' },
  { id: 'habits', label: 'HABITS', icon: 'checkbox-outline' },
  { id: 'learn', label: 'LEARN', icon: 'book-outline' },
  { id: 'circles', label: 'CIRCLES', icon: 'people-outline' },
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
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState<LongevityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingWearables, setSyncingWearables] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<LongevityWearableDevice | null>(null);

  const loadDashboard = React.useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const response = await fetchLongevityDashboard();
      setDashboard(response);
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
    setSyncingWearables(true);
    try {
      const response = await syncLongevityWearables();
      setDashboard((current) => (current ? { ...current, wearables: response } : current));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync wearables.';
      Alert.alert('Sync failed', message);
    } finally {
      setSyncingWearables(false);
    }
  };

  const handleGenerateWeeklyPlan = async () => {
    if (generatingPlan) {
      return;
    }
    setGeneratingPlan(true);
    try {
      const response = await generateLongevityWeeklyPlan();
      Alert.alert('Weekly plan ready', response.message);
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

  const closeConnectModal = () => {
    if (connectingDeviceId) {
      return;
    }
    setSelectedDevice(null);
  };

  const handleSelectDevice = (device: LongevityWearableDevice) => {
    setSelectedDevice(device);
  };

  const handleConnectDevice = async (device: LongevityWearableDevice) => {
    if (connectingDeviceId) {
      return;
    }

    if (device.id === 'apple-health') {
      if (Platform.OS !== 'ios') {
        Alert.alert('iPhone required', 'Apple Health can only be connected from the iOS app.');
        return;
      }
      Alert.alert(
        'Connect Apple Health',
        'Open the iOS Health permission flow in your app, allow Health access, then sync your data here. Apple Health does not connect through Bluetooth scanning from this screen.',
      );
      return;
    }

    if (device.id === 'health-connect') {
      if (Platform.OS !== 'android') {
        Alert.alert('Android required', 'Google Fit can only be connected from the Android app in this flow.');
        return;
      }
      Alert.alert(
        'Connect Google Fit',
        'Grant Google Fit or Health Connect permissions on Android, then return here and sync your data. This provider does not pair through Bluetooth scanning from this screen.',
      );
      return;
    }

    setConnectingDeviceId(device.id);
    try {
      const provider = device.id as Extract<WearableProvider, 'fitbit' | 'garmin'>;
      const response = await connectWearableProvider(provider);
      const supported = await Linking.canOpenURL(response.authorization_url);
      if (!supported) {
        throw new Error('Unable to open the provider connection page.');
      }
      await Linking.openURL(response.authorization_url);
      setSelectedDevice(null);
      Alert.alert('Continue in browser', `Finish the ${device.name} connection flow, then come back to sync.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to connect ${device.name}.`;
      Alert.alert('Connection failed', message);
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const renderConnectionBody = (device: LongevityWearableDevice) => {
    if (device.id === 'apple-health') {
      return (
        <>
          <Text style={styles.connectionDescription}>
            Apple Health connects through iPhone Health permissions. It does not pair by scanning a nearby watch from this screen.
          </Text>
          <View style={styles.connectionInfoCard}>
            <Text style={styles.connectionInfoTitle}>Supported method</Text>
            <Text style={styles.connectionInfoText}>HealthKit permission sync from the iOS app</Text>
          </View>
          <TouchableOpacity style={styles.connectionPrimaryButton} activeOpacity={0.88} onPress={() => void handleConnectDevice(device)}>
            <Ionicons name="phone-portrait-outline" size={18} color="#000" />
            <Text style={styles.connectionPrimaryText}>OPEN IOS HEALTH SETUP</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (device.id === 'health-connect') {
      return (
        <>
          <Text style={styles.connectionDescription}>
            Google Fit connects through Android permissions and linked health sources. It does not pair through direct Bluetooth scanning from this screen.
          </Text>
          <View style={styles.connectionInfoCard}>
            <Text style={styles.connectionInfoTitle}>Supported method</Text>
            <Text style={styles.connectionInfoText}>Google Fit or Health Connect permission sync from the Android app</Text>
          </View>
          <TouchableOpacity style={styles.connectionPrimaryButton} activeOpacity={0.88} onPress={() => void handleConnectDevice(device)}>
            <Ionicons name="logo-android" size={18} color="#000" />
            <Text style={styles.connectionPrimaryText}>OPEN GOOGLE FIT SETUP</Text>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <Text style={styles.connectionDescription}>
          {device.name} connects through account authorization. Open the secure connection flow, finish sign-in, then return here to sync data.
        </Text>
        <View style={styles.connectionInfoCard}>
          <Text style={styles.connectionInfoTitle}>Supported method</Text>
          <Text style={styles.connectionInfoText}>Secure account connection via OAuth with your {device.name} account</Text>
        </View>
        <TouchableOpacity
          style={styles.connectionPrimaryButton}
          activeOpacity={0.88}
          onPress={() => void handleConnectDevice(device)}
          disabled={connectingDeviceId === device.id}
        >
          <Ionicons name={connectingDeviceId === device.id ? 'hourglass-outline' : 'open-outline'} size={18} color="#000" />
          <Text style={styles.connectionPrimaryText}>
            {connectingDeviceId === device.id ? 'CONNECTING...' : `CONNECT ${device.name.toUpperCase()}`}
          </Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderOverview = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
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
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {(() => {
        const devices = dashboard?.wearables.devices || [];
        const connectedDevices = devices.filter((device) => device.active);
        const availableDevices = devices.filter((device) => !device.active);
        const primaryConnectDevice = availableDevices[0] || devices[0] || null;

        if (connectedDevices.length === 0) {
          return (
            <>
              <SectionTitle>Wearables</SectionTitle>
              <View style={styles.emptyConnectCard}>
                <Ionicons name="watch-outline" size={42} color={Colors.primary} />
                <Text style={styles.emptyConnectTitle}>No Wearable Connected</Text>
                <Text style={styles.emptyConnectSubtitle}>
                  Connect Fitbit, Apple Health, Google Fit, or Garmin to start syncing your health data.
                </Text>
                {primaryConnectDevice ? (
                  <TouchableOpacity style={styles.primaryButton} activeOpacity={0.88} onPress={() => handleSelectDevice(primaryConnectDevice)}>
                    <Ionicons name="link-outline" size={18} color="#000" />
                    <Text style={styles.primaryButtonText}>CONNECT WITH WEARABLE</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          );
        }

        return (
          <>
            <SectionTitle>Connected Devices</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {connectedDevices.map((device) => (
                <View key={device.id} style={[styles.deviceCard, { width: (width - 32) * 0.52 }]}>
                  <Image source={{ uri: safeImageUri(device.image) }} style={styles.deviceImage} />
                  <View style={styles.deviceOverlay} />
                  <View style={styles.deviceContent}>
                    <Text style={[styles.deviceTitle, device.active && { color: Colors.primary }]}>{device.name}</Text>
                    <Text style={styles.deviceMeta}>{device.status}</Text>
                    <TouchableOpacity style={styles.deviceConnectedBadge} activeOpacity={0.88} onPress={() => handleSelectDevice(device)}>
                      <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                      <Text style={styles.deviceConnectedText}>READY</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            {availableDevices.length > 0 ? (
              <>
                <SectionTitle>Connect Another Device</SectionTitle>
                <View style={styles.availableDeviceList}>
                  {availableDevices.map((device) => (
                    <TouchableOpacity
                      key={device.id}
                      style={styles.availableDeviceRow}
                      activeOpacity={0.88}
                      onPress={() => handleSelectDevice(device)}
                    >
                      <View style={styles.availableDeviceContent}>
                        <Text style={styles.availableDeviceTitle}>{device.name}</Text>
                        <Text style={styles.availableDeviceSubtitle}>Tap to connect this provider</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.88} onPress={() => void handleSyncWearables()} disabled={syncingWearables}>
              <Ionicons name={syncingWearables ? 'hourglass-outline' : 'refresh'} size={18} color="#000" />
              <Text style={styles.primaryButtonText}>{syncingWearables ? 'SYNCING...' : 'SYNC DATA NOW'}</Text>
            </TouchableOpacity>
          </>
        );
      })()}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>{dashboard?.wearables.sync_message || 'No data synced yet.'}</Text>
      </View>

      <Modal
        visible={Boolean(selectedDevice)}
        transparent
        animationType="fade"
        onRequestClose={closeConnectModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeConnectModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {selectedDevice ? (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalEyebrow}>DEVICE CONNECTION</Text>
                    <Text style={styles.modalTitle}>{selectedDevice.name}</Text>
                  </View>
                  <TouchableOpacity style={styles.modalCloseButton} activeOpacity={0.88} onPress={closeConnectModal}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                {renderConnectionBody(selectedDevice)}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );

  const renderHeal = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&q=80' }} style={styles.heroImage} />
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroBadge}>AI-POWERED LIBRARY</Text>
          <Text style={styles.heroTitle}>Heal with Food</Text>
          <Text style={styles.heroMeta}>Research-backed nutrition guidance tailored to your health profile.</Text>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.88} onPress={() => void handleGenerateWeeklyPlan()} disabled={generatingPlan}>
            <Ionicons name={generatingPlan ? 'hourglass-outline' : 'sparkles'} size={16} color="#000" />
            <Text style={styles.secondaryButtonText}>{generatingPlan ? 'Generating...' : 'Generate My Weekly Plan'}</Text>
          </TouchableOpacity>
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
    </ScrollView>
  );

  const renderHabits = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
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
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
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
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
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
      case 'circles':
        return renderCircles(dashboard?.circles || []);
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
