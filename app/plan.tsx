import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { fetchCurrentUser, updateCurrentUserSubscription } from '../lib/api';
import { getPostAuthRoute, getSubscriptionCard, isSubscriptionActive, PLAN_CARDS, SubscriptionTier } from '../lib/access';

export default function PlanSelectionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('SILVER');
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('NONE');
  const [userName, setUserName] = useState('Member');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const user = await fetchCurrentUser();
        if (cancelled) {
          return;
        }

        if (isSubscriptionActive(user)) {
          router.replace(getPostAuthRoute(user));
          return;
        }

        const tier = String(user.subscription_tier ?? 'NONE').toUpperCase().replace(/\s+/g, '_') as SubscriptionTier;
        setCurrentTier(tier === 'NONE' ? 'NONE' : tier);
        setSelectedTier(tier === 'NONE' ? 'SILVER' : tier);
        setUserName(String(user.name || 'Member'));
      } catch {
        if (!cancelled) {
          Alert.alert('Access error', 'Unable to load your subscription state right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const selectedPlan = useMemo(() => getSubscriptionCard(selectedTier), [selectedTier]);

  const handleConfirm = async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      await updateCurrentUserSubscription({
        subscription_tier: selectedTier,
        confirm_payment: true,
      });
      router.replace('/(tabs)');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to activate the selected plan.';
      Alert.alert('Payment confirmation failed', message);
    } finally {
      setSaving(false);
      setConfirmVisible(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ImageBackground source={require('../assets/images/gym-bg.png')} style={styles.background} resizeMode="cover">
          <View style={styles.overlay}>
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading your access plans...</Text>
            </View>
          </View>
        </ImageBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ImageBackground source={require('../assets/images/gym-bg.png')} style={styles.background} resizeMode="cover">
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <Text style={styles.kicker}>ACCESS REQUIRED</Text>
              <Text style={styles.title}>Choose your plan</Text>
              <Text style={styles.subtitle}>
                {userName}, select a subscription to unlock the app. Payment is confirmed manually for now.
              </Text>
            </View>

            <View style={styles.cardsWrap}>
              {PLAN_CARDS.map((card) => {
                const active = selectedTier === card.tier;
                const current = currentTier === card.tier;
                return (
                  <TouchableOpacity
                    key={card.tier}
                    activeOpacity={0.9}
                    style={[
                      styles.card,
                      active && { borderColor: card.accent, shadowColor: card.accent },
                      current && styles.currentCard,
                    ]}
                    onPress={() => setSelectedTier(card.tier)}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={[styles.badge, { backgroundColor: card.accent }]}>
                        <Ionicons
                          name={card.tier === 'INNER_CIRCLE' ? 'ellipse-outline' : 'medal-outline'}
                          color="#081018"
                          size={18}
                        />
                      </View>
                      {card.badge ? (
                        <View style={styles.popularPill}>
                          <Text style={styles.popularText}>{card.badge}</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.cardTitle}>{card.title}</Text>
                    <Text style={styles.cardDescription}>{card.description}</Text>
                    <Text style={[styles.price, { color: card.accent }]}>{card.price}</Text>

                    <View style={styles.featureList}>
                      {card.features.map((feature) => (
                        <View key={feature} style={styles.featureRow}>
                          <Ionicons name="checkmark-circle" size={16} color={card.accent} />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={[styles.selectPill, active && { backgroundColor: card.accent }]}>
                      <Text style={[styles.selectText, active && styles.selectTextActive]}>
                        {active ? 'Selected' : 'Select Plan'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Current selection</Text>
              <Text style={styles.summaryTitle}>{selectedPlan.title}</Text>
              <Text style={styles.summaryText}>
                This unlocks: {selectedPlan.tabAccess.join(', ')}.
              </Text>
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={() => setConfirmVisible(true)} activeOpacity={0.9}>
              <Text style={styles.confirmButtonText}>Confirm Payment</Text>
            </TouchableOpacity>
          </ScrollView>

          <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Confirm payment</Text>
                <Text style={styles.modalText}>
                  Activate {selectedPlan.title} now. This is a manual confirmation step and will update your profile access.
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalSecondary}
                    onPress={() => setConfirmVisible(false)}
                    disabled={saving}
                  >
                    <Text style={styles.modalSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalPrimary} onPress={handleConfirm} disabled={saving}>
                    {saving ? <ActivityIndicator color="#021417" /> : <Text style={styles.modalPrimaryText}>Confirm</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(6,10,20,0.86)' },
  content: { padding: 20, paddingBottom: 28 },
  hero: { marginTop: 20, marginBottom: 18 },
  kicker: { color: Colors.primary, fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  title: { color: '#fff', fontSize: 30, fontFamily: 'Inter_700Bold', marginTop: 8 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 10 },
  cardsWrap: { gap: 14 },
  card: {
    backgroundColor: 'rgba(8,16,28,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  currentCard: { backgroundColor: 'rgba(9,22,36,1)' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  popularText: { color: '#021417', fontSize: 11, fontFamily: 'Inter_700Bold' },
  cardTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 16 },
  cardDescription: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8, fontFamily: 'Inter_400Regular' },
  price: { fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 16 },
  featureList: { gap: 10, marginTop: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  selectPill: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(0,240,208,0.08)',
  },
  selectText: { color: Colors.primary, fontSize: 13, fontFamily: 'Inter_700Bold' },
  selectTextActive: { color: '#021417' },
  summaryCard: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  summaryLabel: { color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.2 },
  summaryTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 6 },
  summaryText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 6 },
  confirmButton: {
    marginTop: 18,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: { color: '#031417', fontSize: 15, fontFamily: 'Inter_700Bold' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { color: Colors.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0C1322',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
  },
  modalTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  modalText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 10 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  modalSecondary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  modalSecondaryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  modalPrimary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  modalPrimaryText: { color: '#031417', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
