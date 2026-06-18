import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  fetchCurrentUser,
  fetchOnboardingContent,
  getValidAuthTokens,
  updateCurrentUserProfile,
} from '../lib/api';
import { getPostAuthRoute } from '../lib/access';
import { replaceRoute } from '../lib/navigation';

const TEAL = '#18E2D2';
const BG = '#0D0D0D';
const CONTENT_MAX_WIDTH = 560;

const performanceImg = require('../assets/images/onboarding/performance-first.png') as ImageSourcePropType;
const precisionImg = require('../assets/images/onboarding/precision-tracking.png') as ImageSourcePropType;
const communityImg = require('../assets/images/onboarding/stronger-together.png') as ImageSourcePropType;

type SlideConfig = {
  image: ImageSourcePropType;
  imgNativeW: number;
  imgNativeH: number;
  imgTopSkip: number;
  imgCropH: number;
  badge?: string;
  titleLines: string[];
  titleAccentIndex?: number;
  description: string;
  showSkip: boolean;
  buttonLabel: string;
  buttonArrow: string;
  hasFooter: boolean;
  footerText?: string;
};

const FALLBACK_SLIDES: SlideConfig[] = [
  {
    image: performanceImg,
    imgNativeW: 390,
    imgNativeH: 883,
    imgTopSkip: 68,
    imgCropH: 430,
    badge: 'PERFORMANCE FIRST',
    titleLines: ['UNLEASH YOUR', 'POTENTIAL'],
    titleAccentIndex: 1,
    description:
      'Elite discipline meets data-driven precision. Track every rep, optimize your recovery, and transcend your limits with our high-performance training ecosystem.',
    showSkip: false,
    buttonLabel: 'Next',
    buttonArrow: '>',
    hasFooter: false,
  },
  {
    image: precisionImg,
    imgNativeW: 390,
    imgNativeH: 818,
    imgTopSkip: 0,
    imgCropH: 400,
    titleLines: ['PRECISION', 'TRACKING'],
    description:
      'Experience real-time analytics fueled by smart coaching systems. Every rep, breath, and heartbeat becomes useful training data.',
    showSkip: false,
    buttonLabel: 'Next',
    buttonArrow: '>',
    hasFooter: false,
  },
  {
    image: communityImg,
    imgNativeW: 390,
    imgNativeH: 841,
    imgTopSkip: 0,
    imgCropH: 420,
    titleLines: ['STRONGER', 'TOGETHER'],
    description:
      'Train with a connected community, stay accountable, and move into your plan with a cleaner onboarding flow.',
    showSkip: false,
    buttonLabel: 'Get Started',
    buttonArrow: '>',
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

          const titleLines = Array.isArray(slide.title_lines)
            ? slide.title_lines.map((line) => String(line || '').trim()).filter(Boolean)
            : [];

          acc.push({
            ...asset,
            badge: String(slide.badge || '').trim() || undefined,
            titleLines: titleLines.length > 0 ? titleLines : ['VICTORY'],
            titleAccentIndex: typeof slide.title_accent_index === 'number' ? slide.title_accent_index : undefined,
            description: String(slide.description || '').trim(),
            showSkip: Boolean(slide.show_skip),
            buttonLabel: String(slide.button_label || '').trim() || 'Next',
            buttonArrow: String(slide.button_arrow || '').trim() || '>',
            hasFooter: Boolean(slide.has_footer),
            footerText: String(slide.footer_text || '').trim() || undefined,
          });
          return acc;
        }, []);

        if (!cancelled && nextSlides.length > 0) {
          setSlides(nextSlides);
        }
      } catch {
        // Keep fallback content if the backend content endpoint is unavailable.
      }
    };

    void loadSlides();
    return () => {
      cancelled = true;
    };
  }, []);

  const slide = slides[activeStep] || FALLBACK_SLIDES[Math.min(activeStep, FALLBACK_SLIDES.length - 1)];

  const layout = useMemo(() => {
    const compactHeight = windowHeight < 760;
    const narrowWidth = windowWidth < 360;
    const horizontalPadding = windowWidth >= 480 ? 28 : 20;
    const contentWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH);
    const contentPadding = Math.max(horizontalPadding, (windowWidth - contentWidth) / 2 + horizontalPadding);
    const imageScale = windowWidth / slide.imgNativeW;

    return {
      compactHeight,
      narrowWidth,
      contentPadding,
      displayW: windowWidth,
      imgFullH: slide.imgNativeH * imageScale,
      imgCropH: slide.imgCropH * imageScale,
      imgSkipH: slide.imgTopSkip * imageScale,
    };
  }, [slide, windowHeight, windowWidth]);

  const finishOnboarding = async () => {
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

  const handleNext = async () => {
    if (activeStep < slides.length - 1) {
      setActiveStep((step) => step + 1);
      return;
    }
    await finishOnboarding();
  };

  const handleSkip = () => {
    void finishOnboarding();
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.screen}>
        <View style={styles.screenInner}>
          <View
            style={[
              styles.header,
              {
                paddingHorizontal: layout.contentPadding,
                paddingVertical: layout.compactHeight ? 10 : 14,
              },
            ]}
          >
            <View style={styles.logoRow}>
              <Text style={styles.logoMark}>V</Text>
              <Text style={styles.logoText}> VICTORY FITNESS</Text>
            </View>
            {slide.showSkip ? (
              <Pressable
                onPress={handleSkip}
                disabled={completing}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel="Skip onboarding"
              >
                <Text style={styles.skipText}>SKIP</Text>
              </Pressable>
            ) : (
              <View style={styles.skipSpacer} />
            )}
          </View>

          <Animated.View style={{ opacity: fadeAnim, width: layout.displayW }}>
            <View style={[styles.imageClip, { height: layout.imgCropH, width: layout.displayW }]}>
              <Image
                source={slide.image}
                style={{
                  width: layout.displayW,
                  height: layout.imgFullH,
                  marginTop: -layout.imgSkipH,
                }}
                resizeMode="cover"
              />
              <View style={styles.imageShade} />
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.textContent,
              {
                opacity: fadeAnim,
                paddingHorizontal: layout.narrowWidth ? 18 : layout.contentPadding,
                paddingTop: layout.compactHeight ? 16 : 22,
              },
            ]}
          >
            {slide.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{slide.badge}</Text>
              </View>
            ) : null}

            <View style={styles.titleBlock}>
              {slide.titleLines.map((line, index) => (
                <Text
                  key={`${line}-${index}`}
                  style={[
                    styles.titleLine,
                    layout.narrowWidth && styles.titleLineNarrow,
                    index === slide.titleAccentIndex && styles.titleLineAccent,
                  ]}
                >
                  {line}
                </Text>
              ))}
            </View>

            <Text style={[styles.description, layout.narrowWidth && styles.descriptionNarrow]}>
              {slide.description}
            </Text>
          </Animated.View>

          <View
            style={[
              styles.bottomControls,
              {
                paddingHorizontal: layout.contentPadding,
                paddingBottom: layout.compactHeight ? 8 : 16,
              },
            ]}
          >
            <View style={styles.dotsRow}>
              {slides.map((_, index) => (
                <View key={index} style={[styles.dot, index === activeStep && styles.dotActive]} />
              ))}
            </View>

            <Pressable
              style={[styles.primaryBtn, completing && styles.primaryBtnDisabled]}
              onPress={() => void handleNext()}
              disabled={completing}
              accessibilityRole="button"
              accessibilityLabel={slide.buttonLabel}
            >
              <Text style={[styles.primaryBtnText, layout.narrowWidth && styles.primaryBtnTextNarrow]}>
                {slide.buttonArrow}
              </Text>
            </Pressable>

            {slide.hasFooter && slide.footerText ? (
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
    justifyContent: 'flex-start',
  },
  screenInner: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoMark: {
    fontSize: 15,
    color: TEAL,
    fontFamily: 'Inter_700Bold',
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
  skipSpacer: {
    width: 40,
  },
  imageClip: {
    overflow: 'hidden',
    position: 'relative',
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,13,0.08)',
  },
  textContent: {
    flex: 1,
    width: '100%',
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
    color: '#FFFFFF',
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
    color: 'rgba(255,255,255,0.68)',
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
    maxWidth: 540,
  },
  descriptionNarrow: {
    fontSize: 14,
    lineHeight: 22,
  },
  bottomControls: {
    width: '100%',
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
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D0D0D',
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
  },
  primaryBtnTextNarrow: {
    fontSize: 16,
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
