import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, createStripeCheckoutSession, fetchCurrentUser, fetchSubscriptionPlans, SubscriptionPlan } from '../lib/api';
import { AppPlanCard, BillingCycle, getSubscriptionCard, PLAN_CARDS, SubscriptionTier } from '../lib/access';
import { useLanguage } from '../lib/i18n';
import { goBackOrReplace, replaceRoute } from '../lib/navigation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.84, 340);
const CARD_GAP = 14;
const HORIZONTAL_PADDING = Math.max((SCREEN_WIDTH - CARD_WIDTH) / 2, 16);

type AppPlanViewModel = AppPlanCard & {
  planId: string;
  description: string;
  features: string[];
  priceMonthly: number | null;
  priceYearly: number | null;
  discountedPriceMonthly: number | null;
  discountedPriceYearly: number | null;
  discountPercentage: number | null;
  discountStartDate: string | null;
  discountEndDate: string | null;
  isDiscountActive: boolean;
  isApplicationOnly: boolean;
  isMostPopular: boolean;
  iconType: string;
  isDashboardConfigured: boolean;
};

function formatPrice(value: number | null, cycle: BillingCycle) {
  if (value == null) {
    return 'Application Only';
  }
  return `EUR ${value} / ${cycle === 'monthly' ? 'month' : 'year'}`;
}

function formatEuroAmount(value: number | null) {
  if (value == null) {
    return 'Application Only';
  }
  return `EUR ${value}`;
}

function getPlanPricing(plan: AppPlanViewModel, cycle: BillingCycle) {
  if (plan.isApplicationOnly) {
    return {
      originalPrice: null,
      finalPrice: null,
      hasActiveDiscount: false,
      savings: null,
      cycleLabel: cycle === 'monthly' ? 'month' : 'year',
    };
  }

  const originalPrice = cycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
  const finalPrice = cycle === 'monthly' ? plan.discountedPriceMonthly : plan.discountedPriceYearly;
  const hasActiveDiscount =
    Boolean(plan.isDiscountActive) &&
    plan.discountPercentage != null &&
    originalPrice != null &&
    finalPrice != null &&
    finalPrice !== originalPrice;

  return {
    originalPrice,
    finalPrice,
    hasActiveDiscount,
    savings: hasActiveDiscount && originalPrice != null && finalPrice != null ? originalPrice - finalPrice : null,
    cycleLabel: cycle === 'monthly' ? 'month' : 'year',
  };
}

function getTierDesign(tier: SubscriptionTier) {
  switch (tier) {
    case 'SILVER':
      return {
        bg: '#0F172A',
        accentColor: '#94A3B8',
        badgeBg: 'rgba(148, 163, 184, 0.16)',
        borderColor: '#334155',
        activeBorderColor: '#94A3B8',
        glowColor: 'rgba(148, 163, 184, 0.25)',
        iconName: 'medal-outline' as const,
        tag: 'ESSENTIALS',
        pillBg: 'rgba(148, 163, 184, 0.15)',
        pillText: '#CBD5E1',
      };
    case 'GOLD':
      return {
        bg: '#1C1917',
        accentColor: '#F59E0B',
        badgeBg: 'rgba(245, 158, 11, 0.18)',
        borderColor: '#44403C',
        activeBorderColor: '#F59E0B',
        glowColor: 'rgba(245, 158, 11, 0.35)',
        iconName: 'ribbon-outline' as const,
        tag: 'MOST POPULAR',
        pillBg: '#F59E0B',
        pillText: '#000000',
      };
    case 'PLATINUM':
      return {
        bg: '#0B132B',
        accentColor: '#38BDF8',
        badgeBg: 'rgba(56, 189, 248, 0.18)',
        borderColor: '#1E293B',
        activeBorderColor: '#38BDF8',
        glowColor: 'rgba(56, 189, 248, 0.4)',
        iconName: 'diamond-outline' as const,
        tag: 'RECOMMENDED',
        pillBg: '#38BDF8',
        pillText: '#021417',
      };
    case 'INNER_CIRCLE':
      return {
        bg: '#1F1122',
        accentColor: '#FB7185',
        badgeBg: 'rgba(251, 113, 133, 0.18)',
        borderColor: '#4C1D24',
        activeBorderColor: '#FB7185',
        glowColor: 'rgba(251, 113, 133, 0.35)',
        iconName: 'sparkles-outline' as const,
        tag: 'EXCLUSIVE',
        pillBg: '#FB7185',
        pillText: '#1F1122',
      };
    default:
      return {
        bg: '#0F172A',
        accentColor: '#64748B',
        badgeBg: 'rgba(100, 116, 139, 0.16)',
        borderColor: '#334155',
        activeBorderColor: '#64748B',
        glowColor: 'rgba(100, 116, 139, 0.2)',
        iconName: 'key-outline' as const,
        tag: 'BASIC',
        pillBg: 'rgba(100, 116, 139, 0.15)',
        pillText: '#94A3B8',
      };
  }
}

export default function PlanSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string }>();
  const { t } = useLanguage();
  const flatListRef = useRef<FlatList>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('SILVER');
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('NONE');
  const [userName, setUserName] = useState('Member');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [planItems, setPlanItems] = useState<SubscriptionPlan[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadSubscriptionState = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const [user, plansResponse] = await Promise.all([
        fetchCurrentUser(),
        fetchSubscriptionPlans(),
      ]);
      const tier = String(user.subscription_tier ?? 'NONE').toUpperCase().replace(/\s+/g, '_') as SubscriptionTier;
      const normalizedTier = tier === 'NONE' ? 'NONE' : tier;
      setCurrentTier(normalizedTier);
      setSelectedTier(normalizedTier === 'NONE' ? 'SILVER' : normalizedTier);
      setUserName(String(user.name || 'Member'));
      setPlanItems(Array.isArray(plansResponse?.items) ? plansResponse.items : []);
      return user;
    } catch {
      Alert.alert(t('Access error'), t('Unable to load your subscription state right now.'));
      return null;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    void loadSubscriptionState(true);
  }, [loadSubscriptionState]);

  useEffect(() => {
    let cancelled = false;
    const checkoutStatus = String(params.checkout ?? '').toLowerCase();

    if (checkoutStatus === 'cancelled' || checkoutStatus === 'canceled') {
      Alert.alert('Checkout cancelled', 'Your subscription was not changed.');
      replaceRoute(router, '/plan');
      return;
    }

    if (checkoutStatus !== 'success') {
      return;
    }

    const waitForActivation = async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const user = await loadSubscriptionState(false);
        if (cancelled) {
          return;
        }
        const tier = String(user?.subscription_tier ?? 'NONE').toUpperCase().replace(/\s+/g, '_');
        const status = String(user?.subscription_status ?? '').toUpperCase();
        if (tier !== 'NONE' && status === 'ACTIVE') {
          Alert.alert('Subscription active', 'Your plan is active and your included features are unlocked.');
          replaceRoute(router, '/(tabs)');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (!cancelled) {
        Alert.alert(
          'Payment received',
          'Stripe completed checkout. We are still waiting for the webhook to activate your plan. Refresh this page in a moment.',
        );
        replaceRoute(router, '/plan');
      }
    };

    void waitForActivation();

    return () => {
      cancelled = true;
    };
  }, [loadSubscriptionState, params.checkout, router]);

  const plans = useMemo<AppPlanViewModel[]>(() => {
    return PLAN_CARDS.map((card) => {
      const apiPlan = planItems.find((item) => item.subscriptionTier === card.tier);
      return {
        ...card,
        planId: apiPlan?.id ?? card.tier,
        title: apiPlan?.title ?? card.title,
        description: apiPlan?.description ?? card.description,
        features: Array.isArray(apiPlan?.features) && apiPlan.features.length > 0 ? apiPlan.features : card.features,
        featureAccess: Array.isArray(apiPlan?.featureAccess) && apiPlan.featureAccess.length > 0 ? apiPlan.featureAccess : card.featureAccess,
        priceMonthly: apiPlan?.priceMonthly ?? null,
        priceYearly: apiPlan?.priceYearly ?? null,
        discountedPriceMonthly: apiPlan?.discountedPriceMonthly ?? apiPlan?.priceMonthly ?? null,
        discountedPriceYearly: apiPlan?.discountedPriceYearly ?? apiPlan?.priceYearly ?? null,
        discountPercentage: apiPlan?.discountPercentage ?? null,
        discountStartDate: apiPlan?.discountStartDate ?? null,
        discountEndDate: apiPlan?.discountEndDate ?? null,
        isDiscountActive: Boolean(apiPlan?.isDiscountActive),
        isApplicationOnly: Boolean(apiPlan?.isApplicationOnly ?? card.tier === 'INNER_CIRCLE'),
        isMostPopular: Boolean(apiPlan?.isMostPopular ?? card.badge),
        iconType: apiPlan?.iconType ?? '',
        isDashboardConfigured: Boolean(apiPlan),
      };
    });
  }, [planItems]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.tier === selectedTier) ?? plans[0] ?? { ...getSubscriptionCard('SILVER'), planId: 'SILVER', priceMonthly: null, priceYearly: null, discountedPriceMonthly: null, discountedPriceYearly: null, discountPercentage: null, discountStartDate: null, discountEndDate: null, isDiscountActive: false, isApplicationOnly: false, isMostPopular: false, iconType: '', isDashboardConfigured: false },
    [plans, selectedTier]
  );
  const selectedPlanPricing = useMemo(() => getPlanPricing(selectedPlan, billingCycle), [selectedPlan, billingCycle]);
  const selectedTierDesign = useMemo(() => getTierDesign(selectedTier), [selectedTier]);

  const scrollToPlanIndex = (index: number) => {
    if (index >= 0 && index < plans.length) {
      setActiveIndex(index);
      setSelectedTier(plans[index].tier);
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
    if (index >= 0 && index < plans.length && index !== activeIndex) {
      setActiveIndex(index);
      setSelectedTier(plans[index].tier);
    }
  };

  const handleConfirm = async () => {
    if (saving) {
      return;
    }

    if (currentTier === selectedTier && currentTier !== 'NONE') {
      Alert.alert('Subscription active', 'This is already your active plan.');
      setConfirmVisible(false);
      return;
    }

    if (selectedPlan.isApplicationOnly || selectedPlanPricing.finalPrice == null) {
      Alert.alert(
        'Application required',
        'This plan is application-only. Please submit an application or contact the Victory Fitness team.',
      );
      setConfirmVisible(false);
      return;
    }

    setSaving(true);
    try {
      const checkout = await createStripeCheckoutSession({
        subscription_tier: selectedTier,
        billing_cycle: billingCycle,
        plan_id: selectedPlan.planId,
      });
      await Linking.openURL(checkout.checkout_url);
    } catch (error) {
      const message = error instanceof ApiError && error.status === 404
        ? 'The backend route for Stripe checkout was not found. Restart or redeploy the backend that serves this app, then try again.'
        : error instanceof Error
          ? error.message
          : 'Unable to start Stripe checkout.';
      Alert.alert('Checkout failed', message);
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
          <Text style={styles.loadingText}>{t('Loading your access plans...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Top Navigation Bar with Back & Close buttons */}
          <View style={styles.topNavBar}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.topNavBtn}
              onPress={() => goBackOrReplace(router, '/(tabs)')}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.topNavBtn}
              onPress={() => goBackOrReplace(router, '/(tabs)')}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Header / Hero */}
          <View style={styles.hero}>
            <View style={styles.kickerBadge}>
              <Ionicons name="sparkles" size={12} color="#18D2EF" />
              <Text style={styles.kicker}>{t('VICTORY FITNESS MEMBERSHIP')}</Text>
            </View>
            <Text style={styles.title}>{t('Choose the plan that fits your goal')}</Text>
            <Text style={styles.subtitle}>
              {`${userName}, ${t('review your access level and update it when you want to unlock more sections. Changes apply immediately after confirmation.')}`}
            </Text>
          </View>

          {/* Master Segmented Billing Toggle */}
          <View style={styles.billingContainer}>
            <View style={styles.billingSegmentTrack}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.billingSegmentBtn, billingCycle === 'monthly' && styles.billingSegmentBtnActive]}
                onPress={() => setBillingCycle('monthly')}
              >
                <Text style={[styles.billingSegmentText, billingCycle === 'monthly' && styles.billingSegmentTextActive]}>
                  {t('MONTHLY')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.billingSegmentBtn, billingCycle === 'yearly' && styles.billingSegmentBtnActive]}
                onPress={() => setBillingCycle('yearly')}
              >
                <Text style={[styles.billingSegmentText, billingCycle === 'yearly' && styles.billingSegmentTextActive]}>
                  {t('YEARLY')}
                </Text>
                <View style={styles.yearlySaveBadge}>
                  <Text style={styles.yearlySaveBadgeText}>{t('SAVE UP TO 33%')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cards Carousel */}
          <View style={styles.carouselSection}>
            <FlatList
              ref={flatListRef}
              data={plans}
              keyExtractor={(item) => item.tier}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              snapToAlignment="center"
              decelerationRate="fast"
              onScroll={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={[styles.cardsRow, { paddingHorizontal: HORIZONTAL_PADDING }]}
              renderItem={({ item: card, index }) => {
                const active = selectedTier === card.tier;
                const current = currentTier === card.tier;
                const design = getTierDesign(card.tier);
                const pricing = getPlanPricing(card, billingCycle);

                const actionLabel = current
                  ? t('CURRENT PLAN')
                  : card.isApplicationOnly
                    ? t('APPLY NOW')
                    : active
                      ? t('CHOOSE PLAN')
                      : t('SELECT PLAN');

                return (
                  <TouchableOpacity
                    activeOpacity={0.92}
                    style={[
                      styles.card,
                      {
                        width: CARD_WIDTH,
                        backgroundColor: design.bg,
                        borderColor: active ? design.activeBorderColor : design.borderColor,
                        borderWidth: active ? 2 : 1,
                        shadowColor: active ? design.accentColor : '#000000',
                        shadowOpacity: active ? 0.35 : 0.15,
                        shadowRadius: active ? 18 : 8,
                        transform: [{ scale: active ? 1 : 0.98 }],
                      },
                    ]}
                    onPress={() => scrollToPlanIndex(index)}
                  >
                    {/* Top Tag / Pill */}
                    {card.isMostPopular ? (
                      <View style={[styles.topTagPill, { backgroundColor: design.pillBg }]}>
                        <Ionicons name="flame" size={12} color={design.pillText} />
                        <Text style={[styles.topTagText, { color: design.pillText }]}>{t('MOST POPULAR')}</Text>
                      </View>
                    ) : card.tier === 'PLATINUM' ? (
                      <View style={[styles.topTagPill, { backgroundColor: design.pillBg }]}>
                        <Ionicons name="star" size={12} color={design.pillText} />
                        <Text style={[styles.topTagText, { color: design.pillText }]}>{t('RECOMMENDED')}</Text>
                      </View>
                    ) : null}

                    {/* Card Header Row */}
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: design.badgeBg, borderColor: design.accentColor }]}>
                        <Ionicons name={design.iconName} size={22} color={design.accentColor} />
                      </View>
                      <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>{`${index + 1} / ${plans.length}`}</Text>
                      </View>
                    </View>

                    {/* Title & Description */}
                    <Text style={styles.cardTitle}>{card.title.toUpperCase()}</Text>
                    <Text style={styles.cardDescription}>{t(card.description)}</Text>

                    {/* Pricing Block */}
                    {card.isApplicationOnly ? (
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceMainText}>{t('Application Only')}</Text>
                        <Text style={styles.priceSubText}>{t('Direct VIP coaching evaluation')}</Text>
                      </View>
                    ) : (
                      <View style={styles.priceContainer}>
                        {pricing.hasActiveDiscount ? (
                          <View style={styles.discountRow}>
                            <View style={styles.discountBadge}>
                              <Text style={styles.discountBadgeText}>{`OFFER -${card.discountPercentage}%`}</Text>
                            </View>
                            <Text style={styles.originalPriceText}>{formatEuroAmount(pricing.originalPrice)}</Text>
                          </View>
                        ) : null}

                        <View style={styles.priceMainRow}>
                          <Text style={styles.priceNumber}>{formatEuroAmount(pricing.finalPrice)}</Text>
                          <Text style={styles.pricePeriod}>
                            {billingCycle === 'monthly' ? t('/ month') : t('/ year')}
                          </Text>
                        </View>

                        {pricing.hasActiveDiscount ? (
                          <Text style={styles.savingsText}>
                            {`${t('Save')} ${formatEuroAmount(pricing.savings)} ${t('per')} ${pricing.cycleLabel}`}
                          </Text>
                        ) : card.tier !== 'INNER_CIRCLE' && billingCycle === 'yearly' ? (
                          <Text style={styles.bestValueText}>{t('BEST VALUE BUNDLE')}</Text>
                        ) : null}
                      </View>
                    )}

                    {/* Features List */}
                    <View style={styles.divider} />
                    <View style={styles.featuresList}>
                      {card.features.map((feature: string) => (
                        <View key={feature} style={styles.featureRow}>
                          <View style={[styles.checkCircle, { backgroundColor: design.badgeBg }]}>
                            <Ionicons name="checkmark-sharp" size={12} color={design.accentColor} />
                          </View>
                          <Text style={styles.featureText}>{t(feature)}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Active Status & Card Action CTA */}
                    <View style={styles.cardFooter}>
                      {current ? (
                        <View style={styles.currentActivePill}>
                          <Ionicons name="checkmark-circle-sharp" size={14} color="#38BDF8" />
                          <Text style={styles.currentActiveText}>{t('Active on your profile')}</Text>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[
                          styles.cardBtn,
                          active && !current && { backgroundColor: '#18D2EF' },
                          current && { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderWidth: 1, borderColor: '#38BDF8' },
                          !active && !current && { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
                        ]}
                        onPress={() => scrollToPlanIndex(index)}
                      >
                        <Text
                          style={[
                            styles.cardBtnText,
                            active && !current && { color: '#021417', fontFamily: 'Inter_700Bold' },
                            current && { color: '#38BDF8', fontFamily: 'Inter_700Bold' },
                            !active && !current && { color: '#E2E8F0', fontFamily: 'Inter_600SemiBold' },
                          ]}
                        >
                          {actionLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Pagination Dots */}
            <View style={styles.paginationRow}>
              {plans.map((p, idx) => (
                <TouchableOpacity
                  key={p.tier}
                  activeOpacity={0.7}
                  onPress={() => scrollToPlanIndex(idx)}
                  style={[
                    styles.paginationDot,
                    activeIndex === idx && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.swipeHintRow}>
              <Ionicons name="swap-horizontal" size={14} color="#64748B" />
              <Text style={styles.swipeHintText}>{t('Swipe to compare all access plans')}</Text>
            </View>
          </View>

          {/* Selected Plan Summary Card */}
          <View style={[styles.summaryCard, { borderColor: selectedTierDesign.activeBorderColor }]}>
            <View style={styles.summaryTopRow}>
              <View style={styles.summaryBadgeRow}>
                <Ionicons name={selectedTierDesign.iconName} size={18} color={selectedTierDesign.accentColor} />
                <Text style={styles.summaryLabel}>{t('SELECTED PLAN')}</Text>
              </View>
              <Text style={[styles.summaryTierTitle, { color: selectedTierDesign.accentColor }]}>
                {selectedPlan.title}
              </Text>
            </View>

            {selectedPlanPricing.hasActiveDiscount ? (
              <View style={styles.summaryOfferBanner}>
                <Ionicons name="pricetag" size={14} color="#047857" />
                <Text style={styles.summaryOfferText}>
                  {`Special Offer Applied: Save ${formatEuroAmount(selectedPlanPricing.savings)} ${t('per')} ${selectedPlanPricing.cycleLabel}`}
                </Text>
              </View>
            ) : null}

            <Text style={styles.summaryPriceText}>
              {formatPrice(selectedPlanPricing.finalPrice, billingCycle)}
            </Text>
            <Text style={styles.summaryAccessText}>
              <Text style={styles.summaryBold}>{t('Access Included: ')}</Text>
              {selectedPlan.features.join(' • ')}
            </Text>
          </View>

          {/* Bottom Action Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmButton, currentTier === selectedTier && currentTier !== 'NONE' && styles.confirmButtonDisabled]}
            onPress={() => {
              if (currentTier === selectedTier && currentTier !== 'NONE') {
                Alert.alert('Subscription active', 'This is already your active plan.');
                return;
              }
              setConfirmVisible(true);
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.confirmButtonText}>
              {currentTier === selectedTier
                ? currentTier === 'NONE'
                  ? t('CONFIRM PAYMENT')
                  : t('CURRENT ACTIVE PLAN')
                : currentTier === 'NONE'
                  ? t('CONFIRM PAYMENT')
                  : `${t('UPGRADE TO')} ${selectedPlan.title.toUpperCase()}`}
            </Text>
            <Ionicons name="arrow-forward-sharp" size={18} color="#021417" />
          </TouchableOpacity>
        </ScrollView>

        {/* Confirmation Modal */}
        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { borderColor: selectedTierDesign.activeBorderColor }]}>
              <View style={styles.modalHeaderRow}>
                <View style={[styles.iconCircle, { backgroundColor: selectedTierDesign.badgeBg, borderColor: selectedTierDesign.accentColor }]}>
                  <Ionicons name={selectedTierDesign.iconName} size={24} color={selectedTierDesign.accentColor} />
                </View>
                <Text style={styles.modalTitle}>{t('Confirm Membership')}</Text>
              </View>

              <Text style={styles.modalText}>
                {selectedPlanPricing.hasActiveDiscount
                  ? `Activate ${selectedPlan.title} now at ${formatPrice(selectedPlanPricing.finalPrice, billingCycle)} instead of ${formatPrice(selectedPlanPricing.originalPrice, billingCycle)}. This dashboard offer is applied immediately after confirmation and unlocks all allowed features.`
                  : `Activate ${selectedPlan.title} now at ${formatPrice(selectedPlanPricing.finalPrice, billingCycle)}. Your membership will be updated immediately upon confirmation.`}
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondary}
                  onPress={() => setConfirmVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.modalSecondaryText}>{t('Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalPrimary} onPress={handleConfirm} disabled={saving}>
                  {saving ? <ActivityIndicator color="#021417" /> : <Text style={styles.modalPrimaryText}>{t('Confirm Now')}</Text>}
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
  screen: { flex: 1, backgroundColor: '#090D16' },
  page: { flex: 1, backgroundColor: '#090D16' },
  content: { paddingTop: 16, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, backgroundColor: '#090D16' },
  loadingText: { color: '#94A3B8', fontSize: 14, fontFamily: 'Inter_400Regular' },

  /* Top Navigation Bar */
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 4,
  },
  topNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hero Section */
  hero: { paddingHorizontal: 22, alignItems: 'center', marginBottom: 20 },
  kickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(24, 210, 239, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(24, 210, 239, 0.25)',
  },
  kicker: { color: '#18D2EF', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  title: { color: '#FFFFFF', fontSize: 26, fontFamily: 'Inter_700Bold', marginTop: 12, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { color: '#94A3B8', fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 8, textAlign: 'center', maxWidth: 640 },

  /* Master Billing Segment Switch */
  billingContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  billingSegmentTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1E293B',
    width: '100%',
    maxWidth: 360,
  },
  billingSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  billingSegmentBtnActive: {
    backgroundColor: '#18D2EF',
    shadowColor: '#18D2EF',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  billingSegmentText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  billingSegmentTextActive: {
    color: '#021417',
  },
  yearlySaveBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  yearlySaveBadgeText: {
    color: '#022C22',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },

  /* Carousel Section */
  carouselSection: {
    marginBottom: 10,
  },
  cardsRow: {
    paddingVertical: 10,
  },
  card: {
    borderRadius: 24,
    padding: 22,
    marginRight: CARD_GAP,
    minHeight: 520,
    justifyContent: 'space-between',
    position: 'relative',
  },

  /* Top Tag Pill */
  topTagPill: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 10,
  },
  topTagText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },

  /* Card Header */
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  stepBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  stepBadgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },

  /* Title & Subtitle */
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
  },
  cardDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    minHeight: 56,
  },

  /* Price Block */
  priceContainer: {
    marginTop: 14,
    minHeight: 70,
    justifyContent: 'center',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  discountBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  discountBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  originalPriceText: {
    color: '#64748B',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'line-through',
  },
  priceMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  priceNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  pricePeriod: {
    color: '#94A3B8',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  priceMainText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  priceSubText: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  savingsText: {
    color: '#34D399',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
  },
  bestValueText: {
    color: '#18D2EF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
    letterSpacing: 1,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 14,
  },

  /* Feature List */
  featuresList: {
    gap: 10,
    flex: 1,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
    lineHeight: 19,
  },

  /* Card Footer & Action Button */
  cardFooter: {
    marginTop: 18,
    gap: 10,
  },
  currentActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingVertical: 6,
    borderRadius: 999,
  },
  currentActiveText: {
    color: '#38BDF8',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  cardBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtnText: {
    fontSize: 13,
    letterSpacing: 0.8,
  },

  /* Pagination Dots */
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#18D2EF',
  },

  /* Swipe Hint */
  swipeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  swipeHintText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },

  /* Summary Card */
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    padding: 18,
    gap: 8,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  summaryTierTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  summaryOfferBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  summaryOfferText: {
    color: '#34D399',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  summaryPriceText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  summaryAccessText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  summaryBold: {
    color: '#E2E8F0',
    fontFamily: 'Inter_600SemiBold',
  },

  /* Bottom Confirm Button */
  confirmButton: {
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: '#18D2EF',
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#18D2EF',
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    shadowOpacity: 0,
  },
  confirmButtonText: {
    color: '#021417',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 22,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontFamily: 'Inter_700Bold' },
  modalText: { color: '#94A3B8', fontSize: 14, lineHeight: 22, fontFamily: 'Inter_400Regular', marginTop: 14 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalSecondary: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalSecondaryText: { color: '#E2E8F0', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  modalPrimary: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#18D2EF',
  },
  modalPrimaryText: { color: '#021417', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
