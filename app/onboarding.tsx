import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Platform,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import {
  AuthUser,
  clearAuthTokens,
  fetchCurrentUser,
  fetchOnboardingContent,
  getAuthTokens,
  getValidAuthTokens,
  updateCurrentUserProfile,
} from '../lib/api';
import { getPostAuthRoute } from '../lib/access';
import { replaceRoute } from '../lib/navigation';
import PostLoginOnboardingFlow from '../components/onboarding/PostLoginOnboardingFlow';

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

const ONBOARDING_IMAGES = {
  hero: require('../assets/images/onboarding/performance-first.png'),
  analytics: require('../assets/images/onboarding/precision-tracking.png'),
  community: require('../assets/images/onboarding/stronger-together.png'),
};

const FALLBACK_SLIDES: SlideConfig[] = [
  {
    id: 'performance-first',
    tag: 'PERFORMANCE FIRST',
    titleLines: ['UNLEASH YOUR', 'POTENTIAL'],
    description:
      'Elite discipline meets data-driven precision. Track every rep, optimize your recovery, and transcend your limits with our high-octane performance ecosystem.',
    showSkip: true,
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
    showSkip: true,
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
    footerText: 'VICTORY KINETIC OS V2.0',
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
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      const tokens = await getAuthTokens();
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
          setAuthenticatedUser(user);
          setCheckingAuth(false);
          return;
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
      useNativeDriver,
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
      {authenticatedUser ? <PostLoginOnboardingFlow user={authenticatedUser} /> : content}
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
  const isHero = slide.visual === 'hero';

  const bodyContent = (
    <View style={styles.mobileContentWrapper}>
      <Header showSkip={slide.showSkip} onSkip={onSkip} />
      
      {isHero ? (
        <View style={{ flex: 1 }} />
      ) : (
        <View style={styles.mobileHero}>
          <SlideVisual visual={slide.visual} />
        </View>
      )}

      <View style={[styles.mobileText, isHero && styles.mobileTextHero]}>
        <Tag text={slide.tag} />
        <Title lines={slide.titleLines} style={styles.mobileTitle} />
        <Text style={styles.mobileDesc}>{slide.description}</Text>
      </View>
      
      <Pagination index={index} total={total} />
      
      <Button
        label={index === total - 1 ? slide.buttonLabel : 'NEXT'}
        onPress={next}
        disabled={completing}
      />
      
      {slide.hasFooter && slide.footerText ? (
        <Text style={styles.footerText}>{slide.footerText}</Text>
      ) : null}
    </View>
  );

  if (isHero) {
    return (
      <ImageBackground
        source={ONBOARDING_IMAGES.hero}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(7,9,9,0.3)', 'rgba(7,9,9,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        {bodyContent}
      </ImageBackground>
    );
  }

  return <View style={styles.mobileContainer}>{bodyContent}</View>;
}

function TabletScreen({ slide, index, total, next, onSkip, completing }: LayoutProps) {
  const isHero = slide.visual === 'hero';

  const bodyContent = (
    <View style={styles.tabletContainer}>
      <Header showSkip={slide.showSkip} onSkip={onSkip} />
      
      {isHero ? (
        <View style={{ height: 260 }} />
      ) : (
        <View style={styles.tabletHero}>
          <SlideVisual visual={slide.visual} large />
        </View>
      )}

      <View style={[styles.tabletText, isHero && styles.tabletTextHero]}>
        <Tag text={slide.tag} />
        <Title lines={slide.titleLines} style={styles.tabletTitle} centered />
        <Text style={styles.tabletDesc}>{slide.description}</Text>
      </View>
      
      <Pagination index={index} total={total} />
      
      <Button
        label={index === total - 1 ? slide.buttonLabel : 'NEXT'}
        onPress={next}
        disabled={completing}
      />
      
      {slide.hasFooter && slide.footerText ? (
        <Text style={styles.footerText}>{slide.footerText}</Text>
      ) : null}
    </View>
  );

  if (isHero) {
    return (
      <ImageBackground
        source={ONBOARDING_IMAGES.hero}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(7,9,9,0.3)', 'rgba(7,9,9,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView contentContainerStyle={styles.tabletPage}>
          {bodyContent}
        </ScrollView>
      </ImageBackground>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.tabletPage}>
      {bodyContent}
    </ScrollView>
  );
}

function DesktopScreen({ slide, index, total, next, onSkip, completing }: LayoutProps) {
  const isHero = slide.visual === 'hero';

  return (
    <View style={styles.desktopPage}>
      <View style={styles.desktopContainer}>
        <Header showSkip={slide.showSkip} onSkip={onSkip} />
        <View style={styles.desktopContent}>
          <View style={styles.desktopVisual}>
            {isHero ? (
              <View style={styles.desktopHeroImageWrapper}>
                <Image
                  source={ONBOARDING_IMAGES.hero}
                  style={styles.desktopHeroImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(7,9,9,0.8)']}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ) : (
              <SlideVisual visual={slide.visual} large />
            )}
          </View>
          <View style={styles.desktopText}>
            <Tag text={slide.tag} />
            <Title lines={slide.titleLines} style={styles.desktopTitle} />
            <Text style={styles.desktopDesc}>{slide.description}</Text>
            <Pagination index={index} total={total} />
            <Button
              label={index === total - 1 ? slide.buttonLabel : 'NEXT'}
              onPress={next}
              disabled={completing}
            />
            {slide.hasFooter && slide.footerText ? (
              <Text style={styles.footerTextDesktop}>{slide.footerText}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function Header({ showSkip, onSkip }: { showSkip: boolean; onSkip: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        <Ionicons name="flash-sharp" size={20} color={TEAL} style={styles.logoIcon} />
        <Text style={styles.logo}>VICTORY FITNESS</Text>
      </View>
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
    <View style={styles.tagContainer}>
      <Text style={styles.tag}>{text}</Text>
    </View>
  );
}

function Title({ lines, style, centered }: { lines: string[]; style: any; centered?: boolean }) {
  return (
    <View style={centered ? styles.centeredTitle : undefined}>
      {lines.map((line, idx) => {
        const isHighlighted = line === 'POTENTIAL' || line === 'TRACKING';
        return (
          <Text
            key={`${line}-${idx}`}
            style={[
              style,
              centered && styles.centeredText,
              isHighlighted && { color: TEAL },
            ]}
          >
            {line}
          </Text>
        );
      })}
    </View>
  );
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.button, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled}>
      <View style={styles.buttonContent}>
        <Text style={styles.buttonText}>{label}</Text>
        <Ionicons name="arrow-forward-sharp" size={18} color="#020202" style={styles.buttonIcon} />
      </View>
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

  return null;
}

function AnalyticsCard({ large }: { large?: boolean }) {
  return (
    <View style={[styles.imageCard, large && styles.imageCardLarge]}>
      <Image
        source={ONBOARDING_IMAGES.analytics}
        style={styles.imageCardImg}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(7,9,9,0.8)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.imageCardBadge}>
        <Text style={styles.imageCardBadgeText}>VO2 MAX GAIN</Text>
      </View>
    </View>
  );
}

function CommunityCard({ large }: { large?: boolean }) {
  return (
    <View style={[styles.dashboardContainer, large && styles.dashboardContainerLarge]}>
      {/* Top Image Card */}
      <View style={styles.dbImageCard}>
        <Image
          source={ONBOARDING_IMAGES.community}
          style={styles.dbImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(7,9,9,0.7)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.dbImageTag}>
          <Text style={styles.dbImageTagText}>GLOBAL FEED</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.dbStatsRow}>
        <View style={styles.dbStatCard}>
          <Ionicons name="people-sharp" size={16} color={TEAL} style={styles.dbStatIcon} />
          <Text style={styles.dbStatValue}>12K+ ACTIVE</Text>
        </View>
        <View style={styles.dbStatCard}>
          <Ionicons name="trophy-sharp" size={16} color={TEAL} style={styles.dbStatIcon} />
          <Text style={styles.dbStatValue}>RANKINGS</Text>
        </View>
      </View>

      {/* Bottom Wide Card */}
      <View style={styles.dbWideCard}>
        <View style={styles.dbAvatarGroup}>
          <View style={[styles.dbAvatar, { backgroundColor: '#1C8178', zIndex: 4 }]} />
          <View style={[styles.dbAvatar, { backgroundColor: '#165D56', marginLeft: -12, zIndex: 3 }]} />
          <View style={[styles.dbAvatar, { backgroundColor: '#103F3B', marginLeft: -12, zIndex: 2 }]} />
          <View style={[styles.dbAvatar, styles.dbAvatarBadge, { marginLeft: -12, zIndex: 1 }]}>
            <Text style={styles.dbAvatarBadgeText}>+85</Text>
          </View>
        </View>
        <View style={styles.dbWideText}>
          <Text style={styles.dbWideTitle}>JOINED IN YOUR AREA</Text>
          <Text style={styles.dbWideSub}>Training for "Peak Week"</Text>
        </View>
      </View>
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
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mobileContentWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  header: {
    height: 64,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    marginRight: 6,
  },
  logo: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
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
    backgroundColor: BG,
  },
  mobileHero: {
    flex: 1.1,
    minHeight: 280,
    maxHeight: 380,
    justifyContent: 'center',
    marginTop: 10,
  },
  mobileText: {
    marginTop: 12,
  },
  mobileTextHero: {
    marginTop: 0,
    paddingBottom: 16,
  },
  mobileTitle: {
    color: WHITE,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    marginTop: 8,
  },
  mobileDesc: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  tabletPage: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
    paddingVertical: 24,
  },
  tabletContainer: {
    width: '86%',
    maxWidth: 680,
    minHeight: 800,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  tabletHero: {
    height: 380,
    marginTop: 20,
    justifyContent: 'center',
  },
  tabletText: {
    marginTop: 24,
    alignItems: 'center',
  },
  tabletTextHero: {
    marginTop: 0,
    paddingBottom: 24,
  },
  tabletTitle: {
    color: WHITE,
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '900',
    marginTop: 12,
  },
  tabletDesc: {
    color: MUTED,
    fontSize: 18,
    lineHeight: 26,
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 500,
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
    maxWidth: 1100,
    minHeight: 680,
  },
  desktopContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 60,
    marginTop: 20,
  },
  desktopVisual: {
    flex: 1.1,
    height: 520,
    justifyContent: 'center',
  },
  desktopHeroImageWrapper: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1B3A36',
  },
  desktopHeroImage: {
    width: '100%',
    height: '100%',
  },
  desktopText: {
    flex: 0.9,
  },
  desktopTitle: {
    color: WHITE,
    fontSize: 60,
    lineHeight: 64,
    fontWeight: '900',
    marginTop: 16,
  },
  desktopDesc: {
    color: MUTED,
    fontSize: 19,
    lineHeight: 28,
    marginTop: 16,
    maxWidth: 480,
  },
  centeredTitle: {
    alignItems: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  tagContainer: {
    alignSelf: 'flex-start',
  },
  tag: {
    color: TEAL,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(0, 245, 212, 0.08)',
  },
  button: {
    height: 58,
    width: '100%',
    backgroundColor: TEAL,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#020202',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  buttonIcon: {
    marginLeft: 6,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333333',
  },
  activeDot: {
    width: 32,
    height: 6,
    borderRadius: 3,
    backgroundColor: TEAL,
  },
  footerText: {
    marginTop: 12,
    textAlign: 'center',
    color: 'rgba(245,245,245,0.3)',
    fontSize: 10,
    letterSpacing: 2,
  },
  footerTextDesktop: {
    marginTop: 14,
    color: 'rgba(245,245,245,0.3)',
    fontSize: 10,
    letterSpacing: 2,
  },

  // Custom visual components style
  imageCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1B3A36',
    backgroundColor: CARD,
  },
  imageCardLarge: {
    maxHeight: 520,
  },
  imageCardImg: {
    width: '100%',
    height: '100%',
  },
  imageCardBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    borderWidth: 1,
    borderColor: TEAL,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  imageCardBadgeText: {
    color: TEAL,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Dashboard styled layout
  dashboardContainer: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 12,
  },
  dashboardContainerLarge: {
    maxHeight: 520,
  },
  dbImageCard: {
    flex: 1.2,
    minHeight: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1B3A36',
    backgroundColor: CARD,
  },
  dbImage: {
    width: '100%',
    height: '100%',
  },
  dbImageTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 245, 212, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.4)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dbImageTagText: {
    color: TEAL,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dbStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dbStatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#203230',
    paddingVertical: 14,
  },
  dbStatIcon: {
    marginRight: 6,
  },
  dbStatValue: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dbWideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#203230',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dbAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 68,
  },
  dbAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: CARD,
  },
  dbAvatarBadge: {
    backgroundColor: '#1E2322',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dbAvatarBadgeText: {
    color: TEAL,
    fontSize: 9,
    fontWeight: '800',
  },
  dbWideText: {
    marginLeft: 12,
  },
  dbWideTitle: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dbWideSub: {
    color: MUTED,
    fontSize: 10,
    marginTop: 2,
  },
});
