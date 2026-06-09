import React, { useEffect, useState } from 'react';
import {
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
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { Colors } from '../../constants/Colors';
import { AuthInput } from '../../components/AuthInput';
import { AuthButton } from '../../components/AuthButton';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { apiRequest, AuthResponse, fetchCurrentUser, getValidAuthTokens, setAuthTokens } from '../../lib/api';
import { canAccessFeature, getPostAuthRoute } from '../../lib/access';
import { formatAppError } from '../../lib/error';
import { useLanguage } from '../../lib/i18n';
import { getFirebaseGoogleConfig, signInWithFirebaseGoogle } from '../../lib/firebaseGoogleAuth';
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
  const firebaseGoogleConfig = getFirebaseGoogleConfig();
  const [googleRequest, , googlePromptAsync] = Google.useAuthRequest({
    clientId: firebaseGoogleConfig.googleClientId || undefined,
    androidClientId: firebaseGoogleConfig.androidClientId || firebaseGoogleConfig.googleClientId || undefined,
    webClientId: firebaseGoogleConfig.googleClientId || undefined,
    redirectUri: makeRedirectUri({ scheme: 'victoryfitness', path: 'auth/google' }),
    scopes: ['openid', 'profile', 'email'],
  });

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
          replaceRoute(router, getPostAuthRoute(user));
        } catch {
          setCheckingAuth(false);
        }
        return;
      }

      setCheckingAuth(false);
    };

    void redirectIfAuthenticated();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setErrorDialog({
        title: t('Missing Information'),
        message: t('Please enter your email and password.'),
      });
      return;
    }

    setLoading(true);
    try {
      const auth = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email: normalizedEmail, password },
      });
      await setAuthTokens(auth);
      replaceRoute(router, getPostAuthRoute(auth.user));
    } catch (error) {
      setErrorDialog(formatAppError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleRequest) {
      setErrorDialog({
        title: t('Sign in unavailable'),
        message: t('Google sign-in is not configured yet.'),
      });
      return;
    }

    setLoading(true);
    try {
      const result = await googlePromptAsync();
      if (result.type !== 'success') {
        return;
      }

      const auth = await signInWithFirebaseGoogle({
        idToken: result.authentication?.idToken || result.params?.id_token || null,
        accessToken: result.authentication?.accessToken || result.params?.access_token || null,
      });
      await setAuthTokens(auth);
      replaceRoute(router, getPostAuthRoute(auth.user));
    } catch (error) {
      setErrorDialog(formatAppError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // TODO: Implement forgot password
    console.log('Forgot Password');
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
            {/* Branding */}
            <View style={styles.brandingContainer}>
              <Text style={styles.brandTitle}>V I C T O R Y</Text>
              <Text style={styles.brandSubtitle}>F I T N E S S</Text>
            </View>

            {/* Heading */}
            <Text style={styles.heading}>{t('WELCOME BACK')}</Text>
            <Text style={styles.subheading}>{t('Log in to continue')}</Text>

            {/* Form */}
            <View style={styles.formContainer}>
              <AuthInput
                placeholder={t('Email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
              />
              <AuthInput
                placeholder={t('Password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={handleForgotPassword}
              >
                <Text style={styles.forgotPasswordText}>{t('Forgot Password?')}</Text>
              </TouchableOpacity>

              <AuthButton title={t('Log In')} onPress={handleLogin} disabled={loading} />
            </View>

            {/* Register Link */}
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>{t("Don't have an account? ")}</Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
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
    paddingHorizontal: 28,
    paddingTop: height * 0.1,
    paddingBottom: 30,
    alignItems: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 8,
    fontFamily: 'Inter_700Bold',
  },
  brandSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 6,
    marginTop: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
  },
  subheading: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 32,
    fontFamily: 'Inter_400Regular',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  linkText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  linkHighlight: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 6,
    fontFamily: 'Inter_400Regular',
  },
  footerContact: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
});
