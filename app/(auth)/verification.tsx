import React, { useEffect, useRef, useState } from 'react';
import {
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
import { AuthButton } from '../../components/AuthButton';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { Colors } from '../../constants/Colors';
import { apiRequest, AuthResponse, setAuthTokens } from '../../lib/api';
import { getPostAuthRoute } from '../../lib/access';
import { formatAppError } from '../../lib/error';

const { height } = Dimensions.get('window');

export default function VerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const codeInputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(45);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (resendSeconds === 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

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
      router.replace(getPostAuthRoute(auth.user));
    } catch (error) {
      setErrorDialog(formatAppError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (!email) {
      setErrorDialog({
        title: 'Missing Email',
        message: 'Go back and register again to resend the code.',
      });
      return;
    }

    setErrorDialog({
      title: 'Resend Unavailable',
      message: 'Please register again to receive a new code.',
    });
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
            <View style={styles.iconWrap}>
              <View style={styles.iconBadge}>
                <Text style={styles.iconGlyph}>🔒</Text>
              </View>
            </View>

            <Text style={styles.heading}>Verify Email</Text>
            <Text style={styles.subheading}>Enter the 4-digit code sent to your email</Text>

            <View style={styles.formContainer}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => codeInputRef.current?.focus()}
                style={styles.otpRow}
              >
                {[0, 1, 2, 3].map((index) => {
                  const digit = code[index] ?? '';
                  const isActive = index === code.length;

                  return (
                    <View
                      key={index}
                      style={[
                        styles.otpCell,
                        digit ? styles.otpCellFilled : null,
                        isActive ? styles.otpCellActive : null,
                      ]}
                    >
                      <Text style={styles.otpDigit}>{digit}</Text>
                    </View>
                  );
                })}
              </TouchableOpacity>

              <TextInput
                ref={codeInputRef}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                caretHidden
                style={styles.hiddenInput}
              />

              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>Resend code in</Text>
                <Text style={styles.resendTimer}>
                  {resendSeconds === 0 ? 'Now' : `00:${String(resendSeconds).padStart(2, '0')}`}
                </Text>
              </View>

              <AuthButton title="Confirm" onPress={handleVerify} loading={loading} />

              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResend}
                disabled={resendSeconds > 0}
                activeOpacity={0.8}
              >
                <Text style={[styles.resendButtonText, resendSeconds > 0 && styles.resendButtonTextDisabled]}>
                  I didn&apos;t receive a code
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
    backgroundColor: Colors.overlay,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: height * 0.12,
    paddingBottom: 30,
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconBadge: {
    width: 86,
    height: 86,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGlyph: {
    fontSize: 28,
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    fontFamily: 'Inter_700Bold',
  },
  subheading: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 36,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  formContainer: {
    width: '100%',
    alignItems: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 320,
    marginBottom: 14,
  },
  otpCell: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCellFilled: {
    borderColor: Colors.primary,
  },
  otpCellActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.accentSurface,
  },
  otpDigit: {
    fontSize: 24,
    fontWeight: '700',
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
    marginBottom: 18,
  },
  resendLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    marginRight: 10,
  },
  resendTimer: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  resendButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
  },
  resendButtonTextDisabled: {
    opacity: 0.55,
  },
});
