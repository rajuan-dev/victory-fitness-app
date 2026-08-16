import React, { useEffect, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { AuthInput } from '../../components/AuthInput';
import { AuthButton } from '../../components/AuthButton';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { apiRequest, AuthResponse, clearAuthTokens, getAuthTokens, getAuthUser, setAuthTokens } from '../../lib/api';
import { getPostAuthRoute, isAdminRestrictedFromApp } from '../../lib/access';
import { formatAppError } from '../../lib/error';
import { useLanguage } from '../../lib/i18n';
import { replaceRoute } from '../../lib/navigation';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      const [tokens, user] = await Promise.all([getAuthTokens(), getAuthUser()]);
      if (cancelled) {
        return;
      }

      if (tokens?.access_token && user) {
        if (isAdminRestrictedFromApp(user)) {
          await clearAuthTokens();
          if (!cancelled) {
            setErrorDialog({
              title: t('App access restricted'),
              message: t('Admin accounts can only sign in to the Victory Fitness dashboard.'),
            });
            setCheckingAuth(false);
          }
          return;
        }

        replaceRoute(router, getPostAuthRoute(user));
        return;
      }

      setCheckingAuth(false);
    };

    void redirectIfAuthenticated();

    return () => {
      cancelled = true;
    };
  }, [router, t]);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const errors: Record<string, string> = {};

    if (!normalizedEmail) errors.email = t('Please enter your email.');
    if (!password) errors.password = t('Please enter your password.');

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorDialog({
        title: t('Missing Information'),
        message: t('Please enter your email and password.'),
      });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const auth = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email: normalizedEmail, password },
      });
      if (isAdminRestrictedFromApp(auth.user)) {
        await clearAuthTokens();
        setErrorDialog({
          title: t('App access restricted'),
          message: t('Admin accounts can only sign in to the Victory Fitness dashboard.'),
        });
        return;
      }
      await setAuthTokens(auth);
      if (auth.returning_user) {
        Alert.alert(
          auth.returning_user.title,
          auth.returning_user.message,
          [{ text: 'Choose your subscription', onPress: () => replaceRoute(router, '/plan') }, { text: 'Continue', style: 'cancel', onPress: () => replaceRoute(router, getPostAuthRoute(auth.user)) }],
        );
        return;
      }
      replaceRoute(router, getPostAuthRoute(auth.user));
    } catch (error) {
      setErrorDialog(formatAppError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  if (checkingAuth) {
    return (
      <ImageBackground
        source={require('../../assets/w4.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <View style={styles.checkingAuthWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/w4.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <ErrorPopupModal
          visible={Boolean(errorDialog)}
          title={errorDialog?.title ?? t('Error')}
          message={errorDialog?.message ?? ''}
          onClose={() => setErrorDialog(null)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Branding Header */}
            <View style={styles.brandingContainer}>
              <Text style={styles.brandTitle}>V I C T O R Y</Text>
              <Text style={styles.brandSubtitle}>F I T N E S S</Text>
            </View>

            {/* Heading */}
            <Text style={styles.heading}>{t('WELCOME BACK')}</Text>
            <Text style={styles.subheading}>{t('Log in to continue')}</Text>

            {/* Glassmorphic Form Card */}
            <View style={styles.formCard}>
              <AuthInput
                placeholder={t('Email')}
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                }}
                allowedType="both"
                keyboardType="email-address"
                autoComplete="email"
                icon="mail-outline"
                error={fieldErrors.email}
              />
              <AuthInput
                placeholder={t('Password')}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                allowedType="both"
                secureTextEntry
                autoComplete="password"
                icon="lock-closed-outline"
                error={fieldErrors.password}
              />

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={handleForgotPassword}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>{t('Forgot Password?')}</Text>
              </TouchableOpacity>

              <AuthButton title={t('Log In')} onPress={handleLogin} disabled={loading} loading={loading} />
            </View>

            {/* Register Link */}
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>{t("Don't have an account? ")}</Text>
              <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.7}>
                <Text style={styles.linkHighlight}>{t('Register')}</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('Information for Developers')}</Text>
              <Text style={styles.footerContact}>
                {`${t('Problems? Contact support:')} office@victorakko.com`}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 15, 0.78)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkingAuthWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.08,
    paddingBottom: 36,
    alignItems: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 8,
    fontFamily: 'Inter_700Bold',
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 6,
    marginTop: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  subheading: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 28,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(18, 22, 34, 0.82)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -2,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  linkText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  linkHighlight: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 4,
    fontFamily: 'Inter_400Regular',
  },
  footerContact: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
});
