import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import {
  clearAuthTokens,
  fetchOnboardingContent,
  fetchCurrentUser,
  getValidAuthTokens,
  updateCurrentUserProfile,
} from '../lib/api';
import { getPostAuthRoute } from '../lib/access';
import { replaceRoute } from '../lib/navigation';

const TEAL = '#18E2D2';
const BG = '#0D0D0D';

const performanceImg = require('../assets/images/onboarding/performance-first.png') as ImageSourcePropType;
const precisionImg = require('../assets/images/onboarding/precision-tracking.png') as ImageSourcePropType;
const communityImg = require('../assets/images/onboarding/stronger-together.png') as ImageSourcePropType;

// Actual pixel dimensions of each image
// performance-first: 390x883, precision-tracking: 390x818, stronger-together: 390x841
// Each image has text/buttons drawn at the bottom — we crop those away and render natively.
type SlideConfig = {
  image: ImageSourcePropType;
  imgNativeW: number;
  imgNativeH: number;
  imgTopSkip: number;  // pixels to hide from the top (e.g. drawn header on slide 1)
  imgCropH: number;    // pixels of content to actually display
  badge?: string;
  titleLines: string[];
  titleAccentIndex?: number; // which line index gets teal colour
  description: string;
  showSkip: boolean;
  buttonLabel: string;
  buttonArrow: string;
  hasSecondary: boolean;
  secondaryLabel?: string;
  hasFooter: boolean;
  footerText?: string;
};

const FALLBACK_SLIDES: SlideConfig[] = [
  {
    image: performanceImg,
    imgNativeW: 390,
    imgNativeH: 883,
    imgTopSkip: 68,   // slide 1 has its own drawn header — skip those pixels
    imgCropH: 430,    // show y=68..498 of the image (dark athletic photo only)
    badge: 'PERFORMANCE FIRST',
    titleLines: ['UNLEASH YOUR', 'POTENTIAL'],
    titleAccentIndex: 1,
    description:
      'Elite discipline meets data-driven precision. Track every rep, optimize your recovery, and transcend your limits with our high-octane performance ecosystem.',
    showSkip: false,
    buttonLabel: 'NEXT',
    buttonArrow: '→',
    hasSecondary: false,
    hasFooter: false,
  },
  {
    image: precisionImg,
    imgNativeW: 390,
    imgNativeH: 818,
    imgTopSkip: 0,
    imgCropH: 400,    // show y=0..400 — analytics card only
    titleLines: ['PRECISION', 'TRACKING'],
    description:
      'Experience real-time analytics fueled by proprietary algorithms. Every rep, breath, and heartbeat becomes actionable data.',
    showSkip: false,
    buttonLabel: 'NEXT',
    buttonArrow: '→',
    hasSecondary: false,
    hasFooter: false,
  },
  {
    image: communityImg,
    imgNativeW: 390,
    imgNativeH: 841,
    imgTopSkip: 0,
    imgCropH: 420,    // show y=0..420 — athletes photo + community cards
    titleLines: ['STRONGER', 'TOGETHER'],
    description:
      'Unlock your full potential by training with a global network of elite athletes. Share data, compete in challenges, and never train alone.',
    showSkip: false,
    buttonLabel: 'GET STARTED',
    buttonArrow: '>',
    hasSecondary: false,
    secondaryLabel: 'SIGN IN TO EXISTING ACCOUNT',
    hasFooter: true,
    footerText: 'VICTORY FITNESS OS V2.0',
  },
];

const ONBOARDING_ASSETS: Record<string, Pick<SlideConfig, 'image' | 'imgNativeW' | 'imgNativeH' | 'imgTopSkip' | 'imgCropH'>> = {
  'performance-first': {
    image: performanceImg,
    imgNativeW: 390,
    imgNativeH: 883,
    imgTopSkip: 68,
    imgCropH: 430,
  },
  'precision-tracking': {
    image: precisionImg,
    imgNativeW: 390,
    imgNativeH: 818,
    imgTopSkip: 0,
    imgCropH: 400,
  },
  'stronger-together': {
    image: communityImg,
    imgNativeW: 390,
    imgNativeH: 841,
    imgTopSkip: 0,
    imgCropH: 420,
  },
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [activeStep, setActiveStep] = useState(0);
  const [slides, setSlides] = useState<SlideConfig[]>(FALLBACK_SLIDES);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      const tokens = await getValidAuthTokens();
      if (cancelled) return;

      setHasAuthSession(Boolean(tokens));

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
          if (!cancelled) setHasAuthSession(false);
        }
      }

      if (!cancelled) setCheckingAuth(false);
    };

    void redirectIfAuthenticated();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeStep, fadeAnim]);

  useEffect(() => {
    let cancelled = false;

    const loadSlides = async () => {
      try {
        const response = await fetchOnboardingContent();
        if (cancelled || !Array.isArray(response?.slides) || response.slides.length === 0) {
          return;
        }

        const nextSlides = response.slides.reduce<SlideConfig[]>((acc, slide) => {
            const asset = ONBOARDING_ASSETS[String(slide.id || '').trim()];
            if (!asset) {
              return acc;
            }

            acc.push({
              ...asset,
              badge: String(slide.badge || '').trim(),
              titleLines: Array.isArray(slide.title_lines) ? slide.title_lines.map((line) => String(line || '').trim()).filter(Boolean) : [],
              titleAccentIndex: typeof slide.title_accent_index === 'number' ? slide.title_accent_index : undefined,
              description: String(slide.description || '').trim(),
              showSkip: Boolean(slide.show_skip),
              buttonLabel: String(slide.button_label || '').trim(),
              buttonArrow: String(slide.button_arrow || '').trim(),
              hasSecondary: Boolean(slide.has_secondary),
              secondaryLabel: String(slide.secondary_label || '').trim(),
              hasFooter: Boolean(slide.has_footer),
              footerText: String(slide.footer_text || '').trim(),
            });
            return acc;
          }, []);

        if (!cancelled && nextSlides.length > 0) {
          setSlides(nextSlides);
        }
      } catch {
        // Keep fallback slide content when the backend content endpoint is unavailable.
      }
    };

    void loadSlides();
    return () => {
      cancelled = true;
    };
  }, []);

  const finishOnboarding = async () => {
    const tokens = await getValidAuthTokens();
    if (!tokens) {
      replaceRoute(router, '/login');
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

  const handleNext = async () => {
    if (activeStep < slides.length - 1) {
      setActiveStep((s) => s + 1);
      return;
    }
    await finishOnboarding();
  };

  const handleSkip = () => void finishOnboarding();

  const handleSecondary = () => {
    if (hasAuthSession) {
      void finishOnboarding();
      return;
    }
    replaceRoute(router, '/login');
  };

  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={TEAL} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const slide = slides[activeStep] || FALLBACK_SLIDES[Math.min(activeStep, FALLBACK_SLIDES.length - 1)];

  const layoutWidth = windowWidth;
  const compactHeight = windowHeight < 760;
  const narrowWidth = layoutWidth < 360;
  const horizontalPadding = layoutWidth >= 480 ? 28 : 20;
  const displayW = layoutWidth;
  const imgScale = displayW / slide.imgNativeW;
  const imgFullH = slide.imgNativeH * imgScale;
  const imgCropH = slide.imgCropH * imgScale;
  const imgSkipH = slide.imgTopSkip * imgScale;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.screen}>
        <View style={[styles.screenInner, { width: layoutWidth }]}>
        {/* ── Header ── */}
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: horizontalPadding,
              paddingVertical: compactHeight ? 10 : 14,
            },
          ]}
        >
          <View style={styles.logoRow}>
            <Text style={styles.logoBolt}>⚡</Text>
            <Text style={styles.logoText}> VICTORY FITNESS</Text>
          </View>
          {slide.showSkip && (
            <Pressable
              onPress={handleSkip}
              disabled={completing}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
            >
              <Text style={styles.skipText}>SKIP</Text>
            </Pressable>
          )}
        </View>

        {/* ── Illustration (cropped image) ── */}
        <Animated.View style={{ opacity: fadeAnim, alignSelf: 'center', width: displayW }}>
          <View style={[styles.imageClip, { height: imgCropH, width: displayW }]}>
            <Image
              source={slide.image}
              style={{ width: displayW, height: imgFullH, marginTop: -imgSkipH }}
              resizeMode="stretch"
            />
          </View>
        </Animated.View>

        {/* ── Text content ── */}
        <Animated.View
          style={[
            styles.textContent,
            {
              opacity: fadeAnim,
              paddingHorizontal: narrowWidth ? 18 : horizontalPadding + 4,
              paddingTop: compactHeight ? 14 : 18,
            },
          ]}
        >
          {slide.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{slide.badge}</Text>
            </View>
          ) : null}

          <View style={styles.titleBlock}>
            {slide.titleLines.map((line, i) => (
              <Text
                key={i}
                style={[
                  styles.titleLine,
                  narrowWidth && styles.titleLineNarrow,
                  i === slide.titleAccentIndex && styles.titleLineAccent,
                ]}
              >
                {line}
              </Text>
            ))}
          </View>

          <Text style={[styles.description, narrowWidth && styles.descriptionNarrow]}>
            {slide.description}
          </Text>
        </Animated.View>

        {/* ── Bottom controls ── */}
        <View
          style={[
            styles.bottomControls,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: compactHeight ? 8 : 12,
            },
          ]}
        >
          {/* Pagination dots */}
          <View style={styles.dotsRow}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeStep && styles.dotActive]}
              />
            ))}
          </View>

          {/* Primary action button */}
          <Pressable
            style={[styles.primaryBtn, completing && styles.primaryBtnDisabled]}
            onPress={() => void handleNext()}
            disabled={completing}
            accessibilityRole="button"
            accessibilityLabel={slide.buttonLabel}
          >
            <Text style={[styles.primaryBtnText, narrowWidth && styles.primaryBtnTextNarrow]}>
              {slide.buttonArrow}
            </Text>
          </Pressable>

          {/* Secondary link (last slide) */}
          {slide.hasSecondary ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={handleSecondary}
              disabled={completing}
              accessibilityRole="button"
              accessibilityLabel={slide.secondaryLabel}
            >
              <Text style={styles.secondaryBtnText}>{slide.secondaryLabel}</Text>
            </Pressable>
          ) : null}

          {/* Footer (last slide) */}
          {slide.hasFooter ? (
            <Text style={styles.footerText}>{slide.footerText}</Text>
          ) : null}
        </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
    width: '100%',
    position: 'relative',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 0,
  },
  screenInner: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBolt: {
    fontSize: 16,
    color: TEAL,
  },
  logoText: {
    fontSize: 13,
    color: TEAL,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: 'Inter_700Bold',
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter_400Regular',
  },

  // Image crop container — hides the drawn text/button portions of the PNGs
  imageClip: {
    overflow: 'hidden',
  },

  // Text content
  textContent: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    color: TEAL,
    fontWeight: '600',
    letterSpacing: 1.5,
    fontFamily: 'Inter_600SemiBold',
  },
  titleBlock: {
    marginBottom: 14,
  },
  titleLine: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 40,
    fontFamily: 'Inter_700Bold',
  },
  titleLineNarrow: {
    fontSize: 30,
    lineHeight: 36,
  },
  titleLineAccent: {
    color: TEAL,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  descriptionNarrow: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Bottom controls
  bottomControls: {
    width: '100%',
    paddingBottom: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  dot: {
    width: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dotActive: {
    width: 26,
    backgroundColor: TEAL,
  },
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 8,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D0D0D',
    letterSpacing: 2,
    fontFamily: 'Inter_700Bold',
  },
  primaryBtnTextNarrow: {
    fontSize: 14,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    letterSpacing: 1.5,
    fontFamily: 'Inter_600SemiBold',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 2,
    marginTop: 10,
    fontFamily: 'Inter_400Regular',
  },
});
