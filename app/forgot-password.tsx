import React, { useState } from 'react';
import { ActivityIndicator, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthButton } from '../components/AuthButton';
import { AuthInput } from '../components/AuthInput';
import { ErrorPopupModal } from '../components/ErrorPopupModal';
import { Colors } from '../constants/Colors';
import { apiRequest } from '../lib/api';
import { formatAppError } from '../lib/error';
import { replaceRoute } from '../lib/navigation';

type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const showError = (error: unknown, fallback?: string) => setErrorDialog(formatAppError(error, fallback));

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorDialog({ title: 'Email required', message: 'Enter the email address used for your Victory Fitness account.' });
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/auth/forgot-password', { method: 'POST', body: { email: normalizedEmail } });
      setEmail(normalizedEmail);
      setStep('code');
    } catch (error) {
      showError(error, 'Unable to send the reset code right now.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const cleanCode = code.trim();
    if (!/^\d{4}$/.test(cleanCode)) {
      setErrorDialog({ title: 'Invalid code', message: 'Enter the 4-digit code from your email.' });
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest<{ reset_token: string }>('/auth/verify-reset-code', { method: 'POST', body: { email, code: cleanCode } });
      setResetToken(response.reset_token);
      setStep('password');
    } catch (error) {
      showError(error, 'That reset code is not valid.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (newPassword.length < 8) {
      setErrorDialog({ title: 'Password too short', message: 'Your new password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorDialog({ title: 'Passwords do not match', message: 'Enter the same new password in both fields.' });
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/auth/reset-password', { method: 'POST', body: { reset_token: resetToken, new_password: newPassword } });
      setSuccess(true);
    } catch (error) {
      showError(error, 'Unable to reset your password right now.');
    } finally {
      setLoading(false);
    }
  };

  const title = success ? 'PASSWORD UPDATED' : step === 'email' ? 'RESET PASSWORD' : step === 'code' ? 'CHECK YOUR EMAIL' : 'CREATE A NEW PASSWORD';
  const subtitle = success ? 'Your password has been updated. You can now sign in with your new password.' : step === 'email' ? 'Enter your account email and we will send you a reset code.' : step === 'code' ? `Enter the 4-digit code sent to ${email}.` : 'Choose a secure password with at least 8 characters.';

  return (
    <ImageBackground source={require('../assets/w4.jpg')} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <ErrorPopupModal visible={Boolean(errorDialog)} title={errorDialog?.title ?? 'Error'} message={errorDialog?.message ?? ''} onClose={() => setErrorDialog(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.brandingContainer}>
              <Text style={styles.brand}>V I C T O R Y</Text>
              <Text style={styles.brandSub}>F I T N E S S</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              {!success && step === 'email' ? (
                <AuthInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  allowedType="both"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCapitalize="none"
                  icon="mail-outline"
                />
              ) : null}
              {!success && step === 'code' ? (
                <AuthInput
                  placeholder="4-digit reset code"
                  value={code}
                  onChangeText={setCode}
                  allowedType="number"
                  keyboardType="number-pad"
                  maxLength={4}
                  icon="key-outline"
                />
              ) : null}
              {!success && step === 'password' ? (
                <>
                  <AuthInput
                    placeholder="New password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    allowedType="both"
                    secureTextEntry
                    autoComplete="new-password"
                    icon="lock-closed-outline"
                  />
                  <AuthInput
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    allowedType="both"
                    secureTextEntry
                    autoComplete="new-password"
                    icon="lock-closed-outline"
                  />
                </>
              ) : null}
              {!success ? (
                <AuthButton
                  title={step === 'email' ? 'Send Reset Code' : step === 'code' ? 'Verify Code' : 'Update Password'}
                  onPress={step === 'email' ? requestCode : step === 'code' ? verifyCode : resetPassword}
                  disabled={loading}
                  loading={loading}
                />
              ) : (
                <AuthButton title="Back to Login" onPress={() => replaceRoute(router, '/login')} />
              )}
              {!success && step === 'code' ? (
                <TouchableOpacity style={styles.secondaryAction} onPress={requestCode} disabled={loading}>
                  <Text style={styles.secondaryText}>Resend code</Text>
                </TouchableOpacity>
              ) : null}
              {!success ? (
                <TouchableOpacity style={styles.secondaryAction} onPress={() => (step === 'email' ? router.back() : setStep(step === 'password' ? 'code' : 'email'))} disabled={loading}>
                  <Text style={styles.secondaryText}>Back</Text>
                </TouchableOpacity>
              ) : null}
              {loading ? <ActivityIndicator style={styles.loader} color={Colors.primary} /> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(7, 10, 15, 0.78)' },
  keyboardView: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  brandingContainer: { alignItems: 'center', marginBottom: 20 },
  brand: { color: Colors.primary, fontSize: 26, letterSpacing: 8, fontFamily: 'Inter_700Bold' },
  brandSub: { color: Colors.text, fontSize: 13, letterSpacing: 6, marginTop: 4, fontFamily: 'Inter_600SemiBold' },
  formCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(18, 22, 34, 0.82)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    alignItems: 'center',
  },
  title: { color: Colors.primary, fontSize: 24, textAlign: 'center', letterSpacing: 1.5, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4, marginBottom: 24, maxWidth: 360, fontFamily: 'Inter_400Regular' },
  secondaryAction: { padding: 12, marginTop: 4 },
  secondaryText: { color: Colors.textMuted, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  loader: { marginTop: 8 },
});
