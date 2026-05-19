import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions,
  Animated,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { StatusBar } from 'expo-status-bar';
import { clearAuthTokens, fetchCurrentUser, getValidAuthTokens } from '../lib/api';
import { getPostAuthRoute } from '../lib/access';

const { width } = Dimensions.get('window');

const ONBOARDING_DATA = [
  {
    title: 'THE FUTURE OF FITNESS',
    subtitle: 'Unlock your potential with our elite training protocols and high-performance methodology.',
    icon: 'fitness-outline',
    color: '#06B6D4',
  },
  {
    title: 'LONGEVITY OS',
    subtitle: 'Track your biological age and optimize your healthspan with data-driven longevity insights.',
    icon: 'pulse-outline',
    color: '#06B6D4',
  },
  {
    title: 'AI PRECISION',
    subtitle: 'Experience personalized nutrition and workout plans tailored precisely to your unique biology.',
    icon: 'sparkles-outline',
    color: '#06B6D4',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);

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
          router.replace(getPostAuthRoute(user));
        } catch {
          router.replace('/login');
        }
      } else {
        await clearAuthTokens();
        router.replace('/login');
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

  const handleNext = () => {
    if (activeStep < ONBOARDING_DATA.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      router.replace('/login');
    }
  };

  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.checkingAuthWrap}>
          <ActivityIndicator color="#06B6D4" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const currentData = ONBOARDING_DATA[activeStep];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Skip Button */}
        {activeStep < 2 && (
          <TouchableOpacity 
            style={styles.skipBtn} 
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.skipText}>SKIP</Text>
          </TouchableOpacity>
        )}

      <View style={styles.content}>
        {/* Animated Icon Section */}
        <View style={styles.iconContainer}>
          <View style={styles.iconBg}>
            <Ionicons name={currentData.icon as any} size={80} color={currentData.color} />
          </View>
          <View style={styles.glowEffect} />
        </View>

        {/* Text Content */}
        <View style={styles.textStack}>
          <Text style={styles.title}>{currentData.title}</Text>
          <Text style={styles.subtitle}>{currentData.subtitle}</Text>
        </View>

        {/* Indicators */}
        <View style={styles.indicatorContainer}>
          {ONBOARDING_DATA.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.indicator, 
                i === activeStep && styles.activeIndicator
              ]} 
            />
          ))}
        </View>
      </View>

      {/* Footer Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.nextBtn, activeStep === 2 && styles.getStartedBtn]} 
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>
            {activeStep === 2 ? 'GET STARTED' : 'CONTINUE'}
          </Text>
          <Ionicons 
            name={activeStep === 2 ? 'rocket-outline' : 'arrow-forward'} 
            size={20} 
            color="#000" 
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBg: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  glowEffect: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(6,182,212,0.1)',
    zIndex: 1,
  },
  textStack: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  indicatorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 60,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  activeIndicator: {
    width: 24,
    backgroundColor: '#06B6D4',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  checkingAuthWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtn: {
    backgroundColor: '#fff',
    height: 64,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  getStartedBtn: {
    backgroundColor: '#06B6D4',
  },
  nextBtnText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1,
  },
});

