import React, { useState } from 'react';
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
import { Colors } from '../../constants/Colors';
import { AuthInput } from '../../components/AuthInput';
import { AuthButton } from '../../components/AuthButton';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { apiRequest } from '../../lib/api';
import { formatAppError } from '../../lib/error';

const { height } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const handleRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim() || !normalizedEmail || !password) {
      setErrorDialog({
        title: 'Missing Information',
        message: 'Please enter your name, email, and password.',
      });
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: { name: name.trim(), email: normalizedEmail, password },
      });
      router.push({
        pathname: '/verification',
        params: { email: normalizedEmail },
      });
    } catch (error) {
      setErrorDialog(formatAppError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    // TODO: Implement Google sign-in
    console.log('Google Sign In');
  };

  return (
    <ImageBackground
      source={require('../../assets/w4.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <ErrorPopupModal
          visible={Boolean(errorDialog)}
          title={errorDialog?.title ?? 'Error'}
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
            <Text style={styles.heading}>CREATE ACCOUNT</Text>
            <Text style={styles.subheading}>Start your fitness journey</Text>

            {/* Form */}
            <View style={styles.formContainer}>
              <AuthInput
                placeholder="Your Name"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
              <AuthInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
              />
              <AuthInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password-new"
              />

              <AuthButton title="Register" onPress={handleRegister} disabled={loading} />
            </View>

            {/* Login Link */}
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.linkHighlight}>Log In</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <GoogleSignInButton onPress={handleGoogleSignIn} />

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Information for Developers</Text>
              <Text style={styles.footerContact}>
                Problems? Contact support: office@victorakko.com
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: height * 0.08,
    paddingBottom: 30,
    alignItems: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
    marginBottom: 28,
    fontFamily: 'Inter_400Regular',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
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
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
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
    marginTop: 28,
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
