import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import {
  clearAuthTokens,
  fetchCurrentUser,
  fetchOnboardingContent,
  getValidAuthTokens,
  updateCurrentUserProfile,
} from '../lib/api';
import { getPostAuthRoute } from '../lib/access';
import { replaceRoute } from '../lib/navigation';

const TEAL = '#00F5D4';
const BG = '#070909';
const CARD = '#111514';
const WHITE = '#F5F5F5';
const MUTED = '#B8B8B8';

type SlideVisual = 'hero' | 'analytics' | 'community';

type SlideConfig = {
  id: string;
  tag: string;
  titleLines: string[];
  description: string;
  showSkip: boolean;
  buttonLabel: string;
  buttonArrow: string;
  hasFooter: boolean;
  footerText?: string;
  visual: SlideVisual;
};

const FALLBACK_SLIDES: SlideConfig[] = [
  {
    id: 'performance-first',
    tag: 'PERFORMANCE FIRST',
    titleLines: ['UNLEASH YOUR', 'POTENTIAL'],
    description:
      'Elite discipline meets data-driven precision. Track every rep, optimize your recovery, and transcend your limits with our high-octane performance ecosystem.',
    showSkip: false,
    buttonLabel: 'NEXT',
    buttonArrow: '>',
    hasFooter: false,
    visual: 'hero',
  },
  {
    id: 'precision-tracking',
    tag: 'VO2 MAX GAIN',
    titleLines: ['PRECISION', 'TRACKING'],
    description:
      'Experience real-time analytics fueled by proprietary algorithms. Every rep, breath, and heartbeat becomes actionable data.',
    showSkip: false,
    buttonLabel: 'NEXT',
    buttonArrow: '>',
    hasFooter: false,
    visual: 'analytics',
  },
  {
    id: 'stronger-together',
    tag: 'GLOBAL FEED',
    titleLines: ['STRONGER', 'TOGETHER'],
    description:
      'Unlock your full potential by training with a global network of elite athletes. Share data, compete in challenges, and never train alone.',
    showSkip: false,
    buttonLabel: 'GET STARTED',
    buttonArrow: '>',
    hasFooter: true,
    footerText: 'VICTORY FITNESS OS V2.0',
    visual: 'community',
  },
];

const VISUAL_BY_ID: Record<string, SlideVisual> = {
  'performance-first': 'hero',
  'precision-tracking': 'analytics',
  'stronger-together': 'community',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState<SlideConfig[]>(FALLBACK_SLIDES);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [completing, setCompleting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      const tokens = await getValidAuthTokens();
      if (cancelled) {
        return;
      }

      if (tokens) {
        try {
          const user = await fetchCurrentUser();
          const target = getPostAuthRoute(user);
          if (target !== '/onboarding') {
            replaceRoute(router, target);
            return;
          }
        } catch {
          await clearAuthTokens();
        }
      }

      if (!cancelled) {
        setCheckingAuth(false);
      }
    };

    void redirectIfAuthenticated();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const loadSlides = async () => {
      try {
        const response = await fetchOnboardingContent();
        if (cancelled || !Array.isArray(response?.slides) || response.slides.length === 0) {
          return;
        }

        const nextSlides = response.slides.reduce<SlideConfig[]>((acc, slide) => {
          const id = String(slide.id || '').trim();
          const titleLines = Array.isArray(slide.title_lines)
            ? slide.title_lines.map((line) => String(line || '').trim()).filter(Boolean)
            : [];

          if (!id) {
            return acc;
          }

          acc.push({
            id,
            tag: String(slide.badge || '').trim() || 'VICTORY FITNESS',
            titleLines: titleLines.length > 0 ? titleLines : ['VICTORY', 'FITNESS'],
            description: String(slide.description || '').trim(),
            showSkip: Boolean(slide.show_skip),
            buttonLabel: String(slide.button_label || '').trim() || 'NEXT',
            buttonArrow: String(slide.button_arrow || '').trim() || '>',
            hasFooter: Boolean(slide.has_footer),
            footerText: String(slide.footer_text || '').trim() || undefined,
            visual: VISUAL_BY_ID[id] || 'hero',
          });
          return acc;
        }, []);

        if (!cancelled && nextSlides.length > 0) {
          setSlides(nextSlides);
          setIndex((current) => Math.min(current, nextSlides.length - 1));
        }
      } catch {
        // Keep fallback slides when backend content is unavailable.
      }
    };

    void loadSlides();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, index]);

  const slide = slides[index] || FALLBACK_SLIDES[Math.min(index, FALLBACK_SLIDES.length - 1)];
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const next = async () => {
    if (index < slides.length - 1) {
      setIndex((current) => current + 1);
      return;
    }

    const tokens = await getValidAuthTokens();
    if (!tokens) {
      replaceRoute(router, '/register');
      return;
    }

    setCompleting(true);
    try {
      const user = await updateCurrentUserProfile({ onboarding_completed: true });
      replaceRoute(router, getPostAuthRoute(user));
    } catch {
      replaceRoute(router, '/plan');
    } finally {
      setCompleting(false);
    }
  };

  const handleSkip = async () => {
    const tokens = await getValidAuthTokens();
    if (!tokens) {
      replaceRoute(router, '/register');
      return;
    }
    await next();
  };

  const content = (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      {isDesktop ? (
        <DesktopScreen slide={slide} index={index} total={slides.length} next={next} onSkip={handleSkip} completing={completing} />
      ) : isTablet ? (
        <TabletScreen slide={slide} index={index} total={slides.length} next={next} onSkip={handleSkip} completing={completing} />
      ) : (
        <MobileScreen slide={slide} index={index} total={slides.length} next={next} onSkip={handleSkip} completing={completing} />
      )}
    </Animated.View>
  );

  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={TEAL} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {content}
    </SafeAreaView>
  );
}

type LayoutProps = {
  slide: SlideConfig;
  index: number;
  total: number;
  next: () => void;
  onSkip: () => void;
  completing: boolean;
};

function MobileScreen({ slide, index, total, next, onSkip, completing }: LayoutProps) {
  return (
    <View style={styles.mobileContainer}>
      <Header showSkip={slide.showSkip} onSkip={onSkip} />
      <View style={styles.mobileHero}>
        <SlideVisual visual={slide.visual} />
      </View>
      <View style={styles.mobileText}>
        <Tag text={slide.tag} />
        <Title lines={slide.titleLines} style={styles.mobileTitle} />
        <Text style={styles.mobileDesc}>{slide.description}</Text>
      </View>
      <Pagination index={index} total={total} />
      <Button
        label={index === total - 1 ? slide.buttonLabel : 'NEXT'}
        arrow={slide.buttonArrow}
        onPress={next}
        disabled={completing}
      />
      {slide.hasFooter && slide.footerText ? <Text style={styles.footerText}>{slide.footerText}</Text> : null}
    </View>
  );
}

function TabletScreen({ slide, index, total, next, onSkip, completing }: LayoutProps) {
  return (
    <ScrollView contentContainerStyle={styles.tabletPage}>
      <View style={styles.tabletContainer}>
        <Header showSkip={slide.showSkip} onSkip={onSkip} />
        <View style={styles.tabletHero}>
          <SlideVisual visual={slide.visual} large />
        </View>
        <View style={styles.tabletText}>
          <Tag text={slide.tag} />
          <Title lines={slide.titleLines} style={styles.tabletTitle} centered />
          <Text style={styles.tabletDesc}>{slide.description}</Text>
        </View>
        <Pagination index={index} total={total} />
        <Button
          label={index === total - 1 ? slide.buttonLabel : 'NEXT'}
          arrow={slide.buttonArrow}
          onPress={next}
          disabled={completing}
        />
        {slide.hasFooter && slide.footerText ? <Text style={styles.footerText}>{slide.footerText}</Text> : null}
      </View>
    </ScrollView>
  );
}

function DesktopScreen({ slide, index, total, next, onSkip, completing }: LayoutProps) {
  return (
    <View style={styles.desktopPage}>
      <View style={styles.desktopContainer}>
        <Header showSkip={slide.showSkip} onSkip={onSkip} />
        <View style={styles.desktopContent}>
          <View style={styles.desktopVisual}>
            <SlideVisual visual={slide.visual} large />
          </View>
          <View style={styles.desktopText}>
            <Tag text={slide.tag} />
            <Title lines={slide.titleLines} style={styles.desktopTitle} />
            <Text style={styles.desktopDesc}>{slide.description}</Text>
            <Pagination index={index} total={total} />
            <Button
              label={index === total - 1 ? slide.buttonLabel : 'NEXT'}
              arrow={slide.buttonArrow}
              onPress={next}
              disabled={completing}
            />
            {slide.hasFooter && slide.footerText ? <Text style={styles.footerTextDesktop}>{slide.footerText}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function Header({ showSkip, onSkip }: { showSkip: boolean; onSkip: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.logo}>V VICTORY FITNESS</Text>
      {showSkip ? (
        <Pressable onPress={onSkip} hitSlop={12}>
          <Text style={styles.skip}>SKIP</Text>
        </Pressable>
      ) : (
        <View style={styles.skipPlaceholder} />
      )}
    </View>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <Text style={styles.tag}>
      {text}
    </Text>
  );
}

function Title({ lines, style, centered }: { lines: string[]; style: object; centered?: boolean }) {
  return (
    <View style={centered ? styles.centeredTitle : undefined}>
      {lines.map((line, idx) => (
        <Text key={`${line}-${idx}`} style={[style, centered && styles.centeredText]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function Button({ label, arrow, onPress, disabled }: { label: string; arrow: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.button, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.buttonText}>
        {`${label} ${arrow}`.trim()}
      </Text>
    </Pressable>
  );
}

function Pagination({ index, total }: { index: number; total: number }) {
  return (
    <View style={styles.pagination}>
      {Array.from({ length: total }).map((_, item) => (
        <View key={item} style={[styles.dot, index === item && styles.activeDot]} />
      ))}
    </View>
  );
}

function SlideVisual({ visual, large }: { visual: SlideVisual; large?: boolean }) {
  if (visual === 'analytics') {
    return <AnalyticsCard large={large} />;
  }

  if (visual === 'community') {
    return <CommunityCard large={large} />;
  }

  return <HeroMock large={large} />;
}

function HeroMock({ large }: { large?: boolean }) {
  return (
    <View style={styles.heroMock}>
      <View style={[styles.bodyCircle, large && styles.bodyCircleLarge]} />
      <View style={styles.heroGrid} />
      <Text style={styles.heroText}>VICTORY FITNESS</Text>
    </View>
  );
}

function AnalyticsCard({ large }: { large?: boolean }) {
  return (
    <View style={[styles.analyticsCard, large && styles.analyticsCardLarge]}>
      <Text style={styles.analyticsLabel}>VO2 MAX GAIN</Text>
      <Text style={styles.analyticsValue}>+12.4%</Text>

      <View style={styles.analyticsGraph}>
        <View style={[styles.graphBar, { height: 42 }]} />
        <View style={[styles.graphBar, { height: 74 }]} />
        <View style={[styles.graphBar, { height: 58 }]} />
        <View style={[styles.graphBar, { height: 98 }]} />
        <View style={[styles.graphBar, { height: 124 }]} />
        <View style={[styles.graphBar, { height: 82 }]} />
      </View>

      <View style={styles.wattBox}>
        <Text style={styles.wattSmall}>PEAK OUTPUT</Text>
        <Text style={styles.wattText}>342 WATTS</Text>
      </View>

      <View style={styles.days}>
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
          <Text key={day} style={[styles.day, day === 'THU' && styles.activeDay]}>
            {day}
          </Text>
        ))}
      </View>
    </View>
  );
}

function CommunityCard({ large }: { large?: boolean }) {
  return (
    <View style={[styles.communityCard, large && styles.communityCardLarge]}>
      <View style={styles.communityRow}>
        <MiniProfile name="Miskat" accent />
        <MiniProfile name="Victor" />
      </View>
      <View style={styles.communityCenter}>
        <Text style={styles.communityBadge}>GLOBAL FEED</Text>
        <Text style={styles.communityTitle}>24 ATHLETES LIVE</Text>
        <Text style={styles.communitySub}>Challenges, progress and accountability in one place.</Text>
      </View>
      <View style={styles.communityMetrics}>
        <MetricPill label="Wins" value="182" />
        <MetricPill label="Teams" value="12" />
        <MetricPill label="Streak" value="31d" />
      </View>
    </View>
  );
}

function MiniProfile({ name, accent }: { name: string; accent?: boolean }) {
  return (
    <View style={[styles.profileCard, accent && styles.profileCardAccent]}>
      <View style={styles.profileAvatar} />
      <Text style={styles.profileName}>{name}</Text>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 64,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    color: TEAL,
    fontSize: 18,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  skip: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '800',
  },
  skipPlaceholder: {
    width: 44,
  },
  mobileContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  mobileHero: {
    height: 360,
    marginTop: 20,
  },
  mobileText: {
    marginTop: 18,
  },
  mobileTitle: {
    color: WHITE,
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '900',
  },
  mobileDesc: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  tabletPage: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
    paddingVertical: 32,
  },
  tabletContainer: {
    width: '86%',
    maxWidth: 720,
    minHeight: 900,
    paddingHorizontal: 32,
    paddingBottom: 36,
  },
  tabletHero: {
    height: 460,
    marginTop: 30,
  },
  tabletText: {
    marginTop: 32,
    alignItems: 'center',
  },
  tabletTitle: {
    color: WHITE,
    fontSize: 52,
    lineHeight: 54,
    fontWeight: '900',
  },
  tabletDesc: {
    color: MUTED,
    fontSize: 19,
    lineHeight: 30,
    marginTop: 16,
    textAlign: 'center',
    maxWidth: 560,
  },
  desktopPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
    paddingHorizontal: 24,
  },
  desktopContainer: {
    width: '92%',
    maxWidth: 1200,
    minHeight: 720,
  },
  desktopContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 70,
  },
  desktopVisual: {
    flex: 1.1,
    height: 560,
  },
  desktopText: {
    flex: 0.9,
  },
  desktopTitle: {
    color: WHITE,
    fontSize: 68,
    lineHeight: 70,
    fontWeight: '900',
  },
  desktopDesc: {
    color: MUTED,
    fontSize: 21,
    lineHeight: 34,
    marginTop: 18,
    maxWidth: 520,
  },
  centeredTitle: {
    alignItems: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  tag: {
    alignSelf: 'flex-start',
    color: TEAL,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
  },
  heroMock: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#0D1211',
    borderWidth: 1,
    borderColor: '#1B3A36',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroGrid: {
    position: 'absolute',
    inset: 0,
    borderColor: 'rgba(0,245,212,0.08)',
    borderWidth: 1,
  },
  bodyCircle: {
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: '#1C2725',
    borderWidth: 1,
    borderColor: TEAL,
    opacity: 0.4,
  },
  bodyCircleLarge: {
    width: 320,
    height: 320,
  },
  heroText: {
    position: 'absolute',
    color: TEAL,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  analyticsCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#16423D',
    backgroundColor: CARD,
    padding: 24,
    justifyContent: 'space-between',
  },
  analyticsCardLarge: {
    padding: 36,
  },
  analyticsLabel: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  analyticsValue: {
    color: TEAL,
    fontSize: 44,
    fontWeight: '900',
  },
  analyticsGraph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 132,
    marginVertical: 12,
  },
  graphBar: {
    width: '12%',
    borderRadius: 999,
    backgroundColor: 'rgba(0,245,212,0.7)',
  },
  wattBox: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1C8178',
    borderRadius: 6,
    paddingHorizontal: 28,
    paddingVertical: 12,
    alignItems: 'center',
  },
  wattSmall: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
  },
  wattText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    color: MUTED,
    fontSize: 11,
  },
  activeDay: {
    color: TEAL,
  },
  communityCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1B3A36',
    backgroundColor: CARD,
    padding: 24,
    justifyContent: 'space-between',
  },
  communityCardLarge: {
    padding: 36,
  },
  communityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  profileCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0D1211',
    borderWidth: 1,
    borderColor: '#203230',
    padding: 16,
    alignItems: 'center',
  },
  profileCardAccent: {
    borderColor: '#1C8178',
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22312E',
    marginBottom: 10,
  },
  profileName: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  communityCenter: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  communityBadge: {
    color: TEAL,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  communityTitle: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 10,
  },
  communitySub: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
  },
  communityMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  metricPill: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0D1211',
    borderWidth: 1,
    borderColor: '#203230',
    paddingVertical: 14,
    alignItems: 'center',
  },
  metricValue: {
    color: TEAL,
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    color: MUTED,
    fontSize: 11,
    marginTop: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 22,
  },
  dot: {
    width: 28,
    height: 4,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  activeDot: {
    width: 36,
    backgroundColor: TEAL,
  },
  button: {
    height: 64,
    width: '100%',
    backgroundColor: TEAL,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#020202',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  footerText: {
    marginTop: 12,
    textAlign: 'center',
    color: 'rgba(245,245,245,0.35)',
    fontSize: 11,
    letterSpacing: 2,
  },
  footerTextDesktop: {
    marginTop: 14,
    color: 'rgba(245,245,245,0.35)',
    fontSize: 11,
    letterSpacing: 2,
  },
});
