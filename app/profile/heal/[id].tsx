import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../../constants/Colors';
import { fetchLongevityDashboard, type LongevityDashboard, type LongevityWeeklyPlanSection } from '../../../lib/api';
import { useModuleAccessGuard } from '../../../lib/useModuleAccessGuard';

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
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>Loading plan...</Text>
    </View>
  );
}

export default function HealPlanDetailScreen() {
  useModuleAccessGuard('/profile/longevity-os');
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const healCardId = String(params.id || '').trim();
  const [loading, setLoading] = React.useState(true);
  const [dashboard, setDashboard] = React.useState<LongevityDashboard | null>(null);
  const [error, setError] = React.useState<string>('');

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchLongevityDashboard();
      setDashboard(response);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load weekly plan.');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
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

  const orderedSections = React.useMemo(() => {
    const sections = dashboard?.weekly_plan?.plan_sections || [];
    if (!sections.length) {
      return [];
    }
    return sections
      .slice()
      .sort((left, right) => {
        if (left.id === matchedSection?.id) {
          return -1;
        }
        if (right.id === matchedSection?.id) {
          return 1;
        }
        return left.title.localeCompare(right.title);
      });
  }, [dashboard?.weekly_plan?.plan_sections, matchedSection?.id]);

  const heroTheme = React.useMemo(
    () => getSectionVisualTheme(matchedSection?.id || healCardId || healCategory?.label || ''),
    [healCardId, healCategory?.label, matchedSection?.id],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState />
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
            {healCategory?.label || 'Health Card'}
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
                heroTheme.accentSoft,
                'rgba(18, 24, 43, 0.92)',
                'rgba(11, 16, 32, 0.96)',
                ] as [string, string, string]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.planHero}
            >
              <View style={styles.planHeroRow}>
                <View style={styles.planHeroCopy}>
                  <Text style={styles.planEyebrow}>Personalized weekly plan</Text>
                  <Text style={styles.planHeroTitle}>{healCategory?.label || 'Heal plan'}</Text>
                </View>
                <View style={styles.planHeroBadge}>
                  <Ionicons name="sparkles" size={14} color={heroTheme.accent} />
                  <Text style={styles.planHeroBadgeText}>{orderedSections.length} sections</Text>
                </View>
              </View>
              <Text style={styles.planHeroDescription}>
                Built from your latest syncs, recovery trends, and history so each section feels more specific.
              </Text>
            </LinearGradient>

            <View style={styles.sectionList}>
            {orderedSections.map((section, index) => {
              const isSelected = section.id === matchedSection?.id;
              const theme = getSectionVisualTheme(section.id);
              return (
                <LinearGradient
                  key={section.id}
                  colors={
                    (isSelected
                      ? theme.gradient
                      : ['rgba(255, 255, 255, 0.05)', 'rgba(18, 24, 43, 0.94)', 'rgba(12, 18, 35, 0.98)']) as [
                      string,
                      string,
                      string,
                    ]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.sectionCard, isSelected && styles.sectionCardActive]}
                >
                  <View style={[styles.sectionAccent, { backgroundColor: isSelected ? theme.accent : 'rgba(255,255,255,0.08)' }]} />
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderCopy}>
                      <View style={styles.sectionLabelRow}>
                        <Text style={styles.sectionIndex}>0{index + 1}</Text>
                        <View
                          style={[
                            styles.sectionBadge,
                            { backgroundColor: isSelected ? theme.badge : 'rgba(255,255,255,0.08)' },
                            isSelected && styles.sectionBadgeActive,
                          ]}
                        >
                          <Text style={styles.sectionBadgeText}>{isSelected ? 'Selected' : 'Plan'}</Text>
                        </View>
                      </View>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      <Text style={styles.sectionSubtitle}>
                        {isSelected ? 'Best match for this card' : 'Supporting guidance'}
                      </Text>
                    </View>
                    <View style={[styles.sectionArrow, { borderColor: isSelected ? theme.accentStrong : 'rgba(255,255,255,0.08)' }]}>
                      <Ionicons name={isSelected ? 'star' : 'arrow-forward'} size={14} color={isSelected ? theme.accent : '#D8E8FF'} />
                    </View>
                  </View>
                  <View style={styles.sectionMetaRow}>
                    <View style={styles.sectionMetaPill}>
                      <Ionicons name="pulse" size={12} color={isSelected ? theme.accent : 'rgba(216, 232, 255, 0.88)'} />
                      <Text style={styles.sectionMetaText}>{isSelected ? 'Primary focus' : 'Secondary focus'}</Text>
                    </View>
                    <View style={styles.sectionMetaPill}>
                      <Ionicons name="document-text-outline" size={12} color={isSelected ? theme.accent : 'rgba(216, 232, 255, 0.88)'} />
                      <Text style={styles.sectionMetaText}>{section.actions.length} actions</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionSummary}>{section.summary}</Text>
                  <View style={styles.sectionActions}>
                    {section.actions.map((action) => (
                      <View key={action} style={[styles.actionPill, isSelected && { borderColor: theme.accentStrong, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                        <View style={[styles.actionDot, { backgroundColor: isSelected ? theme.accent : Colors.primary }]} />
                        <Text style={styles.actionText}>{action}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              );
            })}
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="restaurant-outline" size={40} color="rgba(255,255,255,0.32)" />
            <Text style={styles.emptyTitle}>No weekly plan yet</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 16,
  },
  sectionList: {
    gap: 12,
  },
  planHero: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  planHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  planHeroCopy: {
    flex: 1,
    gap: 4,
  },
  planEyebrow: {
    color: 'rgba(216, 232, 255, 0.7)',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  planHeroTitle: {
    color: '#fff',
    fontSize: 23,
    lineHeight: 28,
    fontFamily: 'Inter_700Bold',
  },
  planHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  planHeroBadgeText: {
    color: '#D8E8FF',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  planHeroDescription: {
    marginTop: 12,
    color: 'rgba(241, 246, 255, 0.82)',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
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
    color: 'rgba(216, 232, 255, 0.68)',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Inter_400Regular',
  },
  sectionIndex: {
    color: '#D8E8FF',
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: 'Inter_700Bold',
  },
  sectionBadge: {
    paddingHorizontal: 10,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionAccent: {
    height: 3,
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
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  sectionActions: {
    marginTop: 10,
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    padding: 18,
    borderRadius: 20,
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
