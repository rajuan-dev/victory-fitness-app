import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../../constants/Colors';
import { fetchCurrentUser, fetchLongevityDashboard, type LongevityDashboard, type LongevityWeeklyPlanSection } from '../../../lib/api';
import { canAccessFeature } from '../../../lib/access';
import { useLanguage } from '../../../lib/i18n';
import { replaceRoute } from '../../../lib/navigation';

const FALLBACK_CARD_IMAGE = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=80';

function safeImageUri(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  return normalized || FALLBACK_CARD_IMAGE;
}

function getSectionIdForHealCard(value: string) {
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

type SectionVisualTheme = {
  accent: string;
  accentSoft: string;
  accentStrong: string;
  gradient: [string, string, string];
  badge: string;
};

function getSectionVisualTheme(value: string): SectionVisualTheme {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.includes('heart')) {
    return {
      accent: '#F97316',
      accentSoft: 'rgba(249, 115, 22, 0.18)',
      accentStrong: 'rgba(249, 115, 22, 0.42)',
      gradient: ['rgba(249, 115, 22, 0.24)', 'rgba(18, 24, 43, 0.94)', 'rgba(10, 14, 27, 0.98)'],
      badge: 'rgba(249, 115, 22, 0.16)',
    };
  }

  if (normalized.includes('recover') || normalized.includes('workout')) {
    return {
      accent: '#38BDF8',
      accentSoft: 'rgba(56, 189, 248, 0.18)',
      accentStrong: 'rgba(56, 189, 248, 0.42)',
      gradient: ['rgba(56, 189, 248, 0.22)', 'rgba(18, 24, 43, 0.94)', 'rgba(10, 14, 27, 0.98)'],
      badge: 'rgba(56, 189, 248, 0.16)',
    };
  }

  if (normalized.includes('mental') || normalized.includes('anxiety')) {
    return {
      accent: '#A78BFA',
      accentSoft: 'rgba(167, 139, 250, 0.18)',
      accentStrong: 'rgba(167, 139, 250, 0.42)',
      gradient: ['rgba(167, 139, 250, 0.22)', 'rgba(18, 24, 43, 0.94)', 'rgba(10, 14, 27, 0.98)'],
      badge: 'rgba(167, 139, 250, 0.16)',
    };
  }

  if (normalized.includes('immunity') || normalized.includes('infection')) {
    return {
      accent: '#34D399',
      accentSoft: 'rgba(52, 211, 153, 0.18)',
      accentStrong: 'rgba(52, 211, 153, 0.42)',
      gradient: ['rgba(52, 211, 153, 0.22)', 'rgba(18, 24, 43, 0.94)', 'rgba(10, 14, 27, 0.98)'],
      badge: 'rgba(52, 211, 153, 0.16)',
    };
  }

  return {
    accent: Colors.primary,
    accentSoft: 'rgba(79, 142, 247, 0.18)',
    accentStrong: 'rgba(79, 142, 247, 0.42)',
    gradient: ['rgba(79, 142, 247, 0.22)', 'rgba(18, 24, 43, 0.94)', 'rgba(10, 14, 27, 0.98)'],
    badge: 'rgba(79, 142, 247, 0.16)',
  };
}

function LoadingState() {
  const { t } = useLanguage();
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>{t('Loading plan...')}</Text>
    </View>
  );
}

function LockedState({ onUpdatePlan, onBackHome }: { onUpdatePlan: () => void; onBackHome: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.centerState}>
      <View style={styles.lockCard}>
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={26} color={Colors.accentGold} />
        </View>
        <Text style={styles.lockTitle}>{t('Access Restricted')}</Text>
        <Text style={styles.lockText}>{t('Heal lock message')}</Text>
        <View style={styles.lockActions}>
          <TouchableOpacity style={styles.lockPrimaryButton} activeOpacity={0.88} onPress={onUpdatePlan}>
            <Text style={styles.lockPrimaryButtonText}>{t('Update Plan')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.lockSecondaryButton} activeOpacity={0.88} onPress={onBackHome}>
            <Text style={styles.lockSecondaryButtonText}>{t('Back Home')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function HealPlanDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ id?: string }>();
  const healCardId = String(params.id || '').trim();
  const [canAccessHeal, setCanAccessHeal] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dashboard, setDashboard] = React.useState<LongevityDashboard | null>(null);
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) {
          const allowed = canAccessFeature('longevity_plan', user);
          setCanAccessHeal(allowed);
          if (!allowed) {
            setLoading(false);
          }
        }
      } catch {
        if (!cancelled) {
          setCanAccessHeal(false);
          setLoading(false);
        }
      }
    };

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadDashboard = React.useCallback(async () => {
    if (canAccessHeal !== true) {
      if (canAccessHeal === false) {
        setLoading(false);
        setDashboard(null);
        setError('');
      }
      return;
    }
    setLoading(true);
    try {
      const response = await fetchLongevityDashboard();
      setDashboard(response);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Unable to load weekly plan.'));
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [canAccessHeal, t]);

  useFocusEffect(
    React.useCallback(() => {
      if (canAccessHeal === false) {
        setLoading(false);
        return;
      }
      if (canAccessHeal === null) {
        return;
      }
      void loadDashboard();
    }, [canAccessHeal, loadDashboard]),
  );

  const healCategory = React.useMemo(
    () => dashboard?.heal_categories.find((item) => item.id === healCardId) ?? null,
    [dashboard?.heal_categories, healCardId],
  );

  const matchedSection = React.useMemo(() => {
    if (!dashboard?.weekly_plan?.plan_sections?.length) {
      return null;
    }
    const preferredSectionId = getSectionIdForHealCard(healCardId || healCategory?.label || '');
    return dashboard.weekly_plan.plan_sections.find((section) => section.id === preferredSectionId) ?? dashboard.weekly_plan.plan_sections[0] ?? null;
  }, [dashboard?.weekly_plan, healCardId, healCategory?.label]);

  const heroTheme = React.useMemo(
    () => getSectionVisualTheme(matchedSection?.id || healCardId || healCategory?.label || ''),
    [healCardId, healCategory?.label, matchedSection?.id],
  );

  if (canAccessHeal === null || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!canAccessHeal) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LockedState
          onUpdatePlan={() => router.push('/plan')}
          onBackHome={() => replaceRoute(router, '/(tabs)')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.86}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {healCategory?.label || t('Health Card')}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {dashboard?.weekly_plan ? (
          <>
            <LinearGradient
              colors={
                [
                'rgba(255,255,255,0.03)',
                'rgba(18, 24, 43, 0.95)',
                'rgba(11, 16, 32, 0.98)',
                ] as [string, string, string]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.planHero}
            >
              <View style={styles.planHeroRow}>
                <View style={styles.planHeroCopy}>
                  <Text style={styles.planEyebrow}>{t('Weekly plan')}</Text>
                  <Text style={styles.planHeroTitle}>{healCategory?.label || t('Heal plan')}</Text>
                </View>
                <View style={styles.planHeroBadge}>
                  <Ionicons name="sparkles" size={14} color={heroTheme.accent} />
                  <Text style={styles.planHeroBadgeText}>{matchedSection ? 'Matched' : 'Unavailable'}</Text>
                </View>
              </View>
              <Text style={styles.planHeroDescription}>
                Built from your latest syncs, recovery trends, and history for this card.
              </Text>
            </LinearGradient>

            {matchedSection ? (() => {
              const theme = getSectionVisualTheme(matchedSection.id);
              return (
                <LinearGradient
                  colors={theme.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sectionCard}
                >
                  <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderCopy}>
                      <View style={styles.sectionLabelRow}>
                        <View style={[styles.sectionNumberPill, { borderColor: theme.accentStrong, backgroundColor: theme.badge }]}>
                          <Text style={[styles.sectionIndex, { color: theme.accent }]}>01</Text>
                        </View>
                        <View style={[styles.sectionBadge, { backgroundColor: theme.badge }]}>
                          <Text style={styles.sectionBadgeText}>{t('Selected')}</Text>
                        </View>
                      </View>
                      <Text style={styles.sectionTitle}>{matchedSection.title}</Text>
                      <Text style={styles.sectionSubtitle}>Recommended guidance for this category</Text>
                    </View>
                    <View style={[styles.sectionArrow, { borderColor: theme.accentStrong }]}>
                      <Ionicons name="star" size={14} color={theme.accent} />
                    </View>
                  </View>
                  <View style={styles.sectionMetaRow}>
                    <View style={styles.sectionMetaPill}>
                      <Ionicons name="pulse" size={12} color={theme.accent} />
                      <Text style={styles.sectionMetaText}>Primary focus</Text>
                    </View>
                    <View style={styles.sectionMetaPill}>
                      <Ionicons name="document-text-outline" size={12} color={theme.accent} />
                      <Text style={styles.sectionMetaText}>{matchedSection.actions.length} actions</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionSummary}>{matchedSection.summary}</Text>
                  <View style={styles.sectionDivider} />
                  <View style={styles.sectionActions}>
                    {matchedSection.actions.map((action) => (
                      <View key={action} style={[styles.actionPill, { borderColor: theme.accentStrong, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                        <View style={[styles.actionDot, { backgroundColor: theme.accent }]} />
                        <Text style={styles.actionText}>{action}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              );
            })() : (
              <View style={styles.emptyCard}>
                <Ionicons name="restaurant-outline" size={40} color="rgba(255,255,255,0.32)" />
                <Text style={styles.emptyTitle}>No matching section yet</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="restaurant-outline" size={40} color="rgba(255,255,255,0.32)" />
            <Text style={styles.emptyTitle}>{t('No weekly plan yet')}</Text>
          </View>
        )}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginTop: 2,
  },
  headerSpacer: {
    width: 42,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 36,
    gap: 18,
  },
  sectionList: {
    gap: 14,
  },
  planHero: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  planHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  planHeroCopy: {
    flex: 1,
    gap: 5,
  },
  planEyebrow: {
    color: 'rgba(216, 232, 255, 0.6)',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  planHeroTitle: {
    color: '#fff',
    fontSize: 24,
    lineHeight: 29,
    fontFamily: 'Inter_700Bold',
  },
  planHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  planHeroBadgeText: {
    color: '#D8E8FF',
    fontSize: 11,
    letterSpacing: 0.2,
    fontFamily: 'Inter_600SemiBold',
  },
  planHeroDescription: {
    marginTop: 12,
    color: 'rgba(241, 246, 255, 0.72)',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  sectionCardActive: {
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 5,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Inter_700Bold',
  },
  sectionSubtitle: {
    color: 'rgba(216, 232, 255, 0.58)',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
  },
  sectionIndex: {
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
  },
  sectionNumberPill: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  sectionBadgeActive: {
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: 'Inter_700Bold',
  },
  sectionArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionAccent: {
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  sectionMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionMetaText: {
    color: 'rgba(241, 246, 255, 0.9)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  sectionSummary: {
    marginTop: 12,
    color: '#DCE7F5',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  sectionDivider: {
    height: 1,
    marginTop: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sectionActions: {
    marginTop: 8,
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: Colors.primary,
  },
  actionText: {
    flex: 1,
    color: '#F1F6FF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
  },
  emptyCard: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#12182B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  lockCard: {
    width: '100%',
    maxWidth: 420,
    padding: 22,
    borderRadius: 26,
    backgroundColor: '#12182B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 14,
  },
  lockBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.26)',
  },
  lockTitle: {
    color: '#fff',
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  lockText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  lockActions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  lockPrimaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  lockPrimaryButtonText: {
    color: '#031417',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  lockSecondaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lockSecondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  errorCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.22)',
  },
  errorText: {
    color: '#FFD7D7',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
});
