import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
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
import { ApiError, fetchCurrentUser, updateCurrentUserSubscription } from '../lib/api';
import { BillingCycle, getPlanPrice, getPostAuthRoute, getSubscriptionCard, isSubscriptionActive, PLAN_CARDS, SubscriptionTier } from '../lib/access';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 92, 320);

export default function PlanSelectionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('SILVER');
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('NONE');
  const [userName, setUserName] = useState('Member');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');

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
        billing_cycle: billingCycle,
        confirm_payment: true,
      });
      setCurrentTier(selectedTier);
      router.replace('/(tabs)');
    } catch (error) {
      const message = error instanceof ApiError && error.status === 404
        ? 'The backend route for subscription purchase was not found. Restart or redeploy the backend that serves this app, then try again.'
        : error instanceof Error
          ? error.message
          : 'Unable to activate the selected plan.';
      Alert.alert('Payment confirmation failed', message);
    } finally {
      setSaving(false);
      setConfirmVisible(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#18D2EF" size="large" />
          <Text style={styles.loadingText}>Loading your access plans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>VICTORY FITNESS</Text>
            <Text style={styles.title}>Choose the plan that fits your goal</Text>
            <Text style={styles.subtitle}>
              {userName}, pick your access level. After payment confirmation the profile and app access update immediately.
            </Text>
          </View>

          <View style={styles.billingRow}>
            <View style={styles.billingSwitch}>
              <Text style={[styles.billingSideText, billingCycle === 'monthly' && styles.billingSideTextActive]}>MONTHLY</Text>
              <View style={styles.billingTrack}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.billingThumb, billingCycle === 'yearly' && styles.billingThumbYearly]}
                  onPress={() => setBillingCycle('monthly')}
                />
                <TouchableOpacity style={styles.billingTouchLeft} activeOpacity={1} onPress={() => setBillingCycle('monthly')} />
                <TouchableOpacity style={styles.billingTouchRight} activeOpacity={1} onPress={() => setBillingCycle('yearly')} />
              </View>
              <Text style={[styles.billingSideText, billingCycle === 'yearly' && styles.billingSideTextActive]}>YEARLY</Text>
            </View>
            <View style={styles.savePill}>
              <Text style={styles.savePillText}>SAVE UP TO 33%</Text>
            </View>
          </View>

          <FlatList
            data={PLAN_CARDS}
            keyExtractor={(item) => item.tier}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 18}
            decelerationRate="fast"
            contentContainerStyle={styles.cardsRow}
            renderItem={({ item: card }) => {
              const active = selectedTier === card.tier;
              const current = currentTier === card.tier;
              const actionLabel = current
                ? 'CURRENT PLAN'
                : card.tier === 'INNER_CIRCLE'
                  ? 'APPLY NOW'
                  : 'CHOOSE PLAN';

              return (
                <TouchableOpacity
                  activeOpacity={0.95}
                  style={[
                    styles.card,
                    { width: CARD_WIDTH },
                    active && styles.cardActive,
                    active && { borderColor: card.accent, shadowColor: card.accent },
                  ]}
                  onPress={() => setSelectedTier(card.tier)}
                >
                  {card.badge ? (
                    <View style={styles.popularPill}>
                      <Text style={styles.popularText}>{card.badge}</Text>
                    </View>
                  ) : null}

                  <View style={styles.cardTopRow}>
                    <View style={[styles.badge, { backgroundColor: card.tier === 'PLATINUM' ? 'transparent' : current ? card.accent : '#E5E7EB' }]}>
                      <Ionicons
                        name={card.tier === 'PLATINUM' ? 'diamond-outline' : card.tier === 'INNER_CIRCLE' ? 'ellipse-outline' : 'medal-outline'}
                        color={card.tier === 'PLATINUM' ? card.accent : '#111827'}
                        size={18}
                      />
                    </View>
                    <View style={styles.stepBubble}>
                      <Text style={styles.stepBubbleText}>{PLAN_CARDS.findIndex((item) => item.tier === card.tier) + 1}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>{card.title.toUpperCase()}</Text>
                  <Text style={styles.cardDescription}>{card.description}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{getPlanPrice(card, billingCycle).split(' / ')[0].replace('EUR ', 'EUR ')}</Text>
                    {card.tier !== 'INNER_CIRCLE' ? (
                      <Text style={styles.priceSuffix}>{billingCycle === 'monthly' ? 'per month' : 'per year'}</Text>
                    ) : null}
                  </View>
                  {card.tier !== 'INNER_CIRCLE' && billingCycle === 'yearly' ? (
                    <Text style={styles.valueText}>BEST VALUE</Text>
                  ) : null}

                  <View style={styles.featureList}>
                    {card.features.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#19D6F3" />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  {current ? <Text style={styles.currentPlanText}>Active on your profile</Text> : null}

                  <View style={[styles.selectPill, active && !current && styles.selectPillActive, current && styles.selectPillCurrent]}>
                    <Text style={[styles.selectText, (active || current) && styles.selectTextActive]}>
                      {actionLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Selected plan</Text>
            <Text style={styles.summaryTitle}>{selectedPlan.title}</Text>
            <Text style={styles.summaryText}>
              {getPlanPrice(selectedPlan, billingCycle)}. Access: {selectedPlan.tabAccess.join(', ')}.
            </Text>
          </View>

          <TouchableOpacity style={styles.confirmButton} onPress={() => setConfirmVisible(true)} activeOpacity={0.9}>
            <Text style={styles.confirmButtonText}>
              {currentTier === selectedTier ? 'Continue with current plan' : 'Confirm Payment'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Confirm payment</Text>
              <Text style={styles.modalText}>
                Activate {selectedPlan.title} now. This will update the user profile subscription immediately and unlock the allowed sections.
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7FB' },
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { paddingTop: 18, paddingBottom: 32 },
  hero: { paddingHorizontal: 22, alignItems: 'center', marginBottom: 18 },
  kicker: { color: '#6B7280', fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2.6 },
  title: { color: '#0F172A', fontSize: 30, fontFamily: 'Inter_700Bold', marginTop: 10, textAlign: 'center' },
  subtitle: { color: '#64748B', fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 10, textAlign: 'center', maxWidth: 720 },
  billingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
    paddingHorizontal: 20,
  },
  billingSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billingSideText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  billingSideTextActive: {
    color: '#0F172A',
  },
  billingTrack: {
    width: 46,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    padding: 3,
    position: 'relative',
  },
  billingThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#18D2EF',
  },
  billingThumbYearly: {
    alignSelf: 'flex-end',
  },
  billingTouchLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  billingTouchRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  savePill: {
    backgroundColor: '#16D7F3',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  savePillText: {
    color: '#08212B',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  cardsRow: { paddingLeft: 22, paddingRight: 4 },
  card: {
    backgroundColor: '#141C33',
    borderWidth: 2,
    borderColor: '#141C33',
    borderRadius: 18,
    padding: 22,
    marginRight: 18,
    minHeight: 460,
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  cardActive: {
    shadowOpacity: 0.24,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBubble: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#24314F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  stepBubbleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  popularPill: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#16D7F3',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  popularText: { color: '#07222B', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 18 },
  cardDescription: { color: '#7F8BA6', fontSize: 13, lineHeight: 20, marginTop: 10, fontFamily: 'Inter_400Regular', minHeight: 56 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 18,
  },
  price: { color: '#FFFFFF', fontSize: 22, fontFamily: 'Inter_700Bold' },
  priceSuffix: { color: '#A3B1C7', fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  valueText: { color: '#16D7F3', fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: 8, letterSpacing: 0.7 },
  featureList: { gap: 10, marginTop: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: '#F8FAFC', fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1, lineHeight: 20 },
  currentPlanText: {
    color: '#16D7F3',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    marginTop: 'auto',
    marginBottom: 12,
    letterSpacing: 0.6,
  },
  selectPill: {
    marginTop: 'auto',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  selectPillActive: {
    backgroundColor: '#18D2EF',
  },
  selectPillCurrent: {
    backgroundColor: '#E2E8F0',
  },
  selectText: { color: '#0F172A', fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  selectTextActive: { color: '#031417' },
  summaryCard: {
    marginTop: 20,
    marginHorizontal: 22,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  summaryLabel: { color: '#64748B', fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.2 },
  summaryTitle: { color: '#0F172A', fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 6 },
  summaryText: { color: '#475569', fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 6 },
  confirmButton: {
    marginTop: 18,
    marginHorizontal: 22,
    backgroundColor: '#18D2EF',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: { color: '#031417', fontSize: 15, fontFamily: 'Inter_700Bold' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { color: '#64748B', fontSize: 14, fontFamily: 'Inter_400Regular' },
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
  modalText: { color: '#94A3B8', fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 10 },
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
    backgroundColor: '#18D2EF',
  },
  modalPrimaryText: { color: '#031417', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
