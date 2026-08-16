import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthButton } from '../../components/AuthButton';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { Colors } from '../../constants/Colors';
import { apiRequest, AuthResponse, setAuthTokens } from '../../lib/api';
import { getPostAuthRoute } from '../../lib/access';
import { formatAppError } from '../../lib/error';
import { replaceRoute } from '../../lib/navigation';

const { height } = Dimensions.get('window');
const RESEND_COOLDOWN_SECONDS = 10 * 60;

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function VerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const codeInputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const cursorOpacity = useRef(new Animated.Value(1)).current;

  // Smooth blinking cursor animation for active OTP box
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0.1,
          duration: 450,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [cursorOpacity]);

  useEffect(() => {
    if (resendSeconds === 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleCodeChange = (val: string) => {
    // Strictly numbers only. Strip any letters/strings typed by user.
    const cleanDigits = val.replace(/\D/g, '').slice(0, 4);
    setCode(cleanDigits);
  };

  const handleVerify = async () => {
    if (!email || !/^\d{4}$/.test(code)) {
      setErrorDialog({
        title: 'Verification Error',
        message: 'Enter the 4 digit verification code from your email.',
      });
      return;
    }

    setLoading(true);
    try {
      const auth = await apiRequest<AuthResponse>('/auth/verify-email', {
        method: 'POST',
        body: { email, code },
      });
      await setAuthTokens(auth);
      replaceRoute(router, getPostAuthRoute(auth.user));
    } catch (error) {
      setErrorDialog(formatAppError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setErrorDialog({
        title: 'Missing Email',
        message: 'Go back and register again to resend the code.',
      });
      return;
    }

    if (resendSeconds > 0 || resending) return;

    setResending(true);
    try {
      await apiRequest('/auth/resend-verification', {
        method: 'POST',
        body: { email },
      });
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setErrorDialog(formatAppError(error));
    } finally {
      setResending(false);
    }
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
            {/* Lock Icon Badge Card */}
            <View style={styles.iconWrap}>
              <View style={styles.iconBadge}>
                <Ionicons name="lock-closed-sharp" size={32} color={Colors.primary} />
              </View>
            </View>

            <Text style={styles.heading}>Verify Email</Text>
            <Text style={styles.subheading}>Enter the 4-digit code sent to your email</Text>

            {/* Form Card */}
            <View style={styles.formCard}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => codeInputRef.current?.focus()}
                style={styles.otpRow}
              >
                {[0, 1, 2, 3].map((index) => {
                  const digit = code[index] ?? '';
                  const isActive = isFocused && (index === code.length || (index === 3 && code.length === 4));

                  return (
                    <View
                      key={index}
                      style={[
                        styles.otpCell,
                        digit ? styles.otpCellFilled : null,
                        isActive ? styles.otpCellActive : null,
                      ]}
                    >
                      {digit ? (
                        <Text style={styles.otpDigit}>{digit}</Text>
                      ) : isActive ? (
                        <Animated.View style={[styles.cursorBar, { opacity: cursorOpacity }]} />
                      ) : null}
                    </View>
                  );
                })}
              </TouchableOpacity>

              <TextInput
                ref={codeInputRef}
                value={code}
                onChangeText={handleCodeChange}
                keyboardType="number-pad"
                maxLength={4}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                caretHidden
                style={styles.hiddenInput}
                autoFocus
              />

              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>Resend code in</Text>
                <Text style={styles.resendTimer}>
                  {resendSeconds === 0 ? 'Now' : formatCountdown(resendSeconds)}
                </Text>
              </View>

              <AuthButton title="Confirm" onPress={handleVerify} loading={loading} disabled={loading || code.length < 4} />

              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResend}
                disabled={resendSeconds > 0 || resending}
                activeOpacity={0.8}
              >
                <Text style={[styles.resendButtonText, resendSeconds > 0 && styles.resendButtonTextDisabled]}>
                  {resending ? 'Sending code...' : "I didn't receive a code"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.1,
    paddingBottom: 36,
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBadge: {
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: 'rgba(18, 22, 34, 0.9)',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  subheading: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
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
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 320,
    marginBottom: 20,
  },
  otpCell: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCellFilled: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0, 240, 208, 0.08)',
  },
  otpCellActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0, 240, 208, 0.15)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  cursorBar: {
    width: 2.5,
    height: 26,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  otpDigit: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: 'Inter_700Bold',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  resendLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    marginRight: 8,
  },
  resendTimer: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  resendButtonTextDisabled: {
    opacity: 0.55,
  },
});
