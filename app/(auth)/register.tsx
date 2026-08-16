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
  Pressable,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { AuthInput } from '../../components/AuthInput';
import { AuthButton } from '../../components/AuthButton';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { apiRequest } from '../../lib/api';
import { formatAppError } from '../../lib/error';

const { height } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = 'Please enter your name.';
    if (!surname.trim()) errors.surname = 'Please enter your surname.';
    if (!normalizedEmail) errors.email = 'Please enter your email.';
    if (!mobile.trim()) errors.mobile = 'Please enter your mobile number.';
    if (!password) errors.password = 'Please enter your password.';
    if (!marketingConsent) errors.marketingConsent = 'You must check the agreement box to register.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorDialog({
        title: 'Agreement & Information Required',
        message: !marketingConsent && Object.keys(errors).length === 1
          ? 'Please check the box to agree to terms before registering.'
          : 'Please complete all required fields and agree to the terms to continue.',
      });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          name: name.trim(),
          surname: surname.trim(),
          email: normalizedEmail,
          mobile: mobile.trim(),
          password,
          marketing_consent: marketingConsent,
          signup_source: String(source || 'organic').trim().slice(0, 120) || 'organic',
        },
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
            {/* Branding Header */}
            <View style={styles.brandingContainer}>
              <Text style={styles.brandTitle}>V I C T O R Y</Text>
              <Text style={styles.brandSubtitle}>F I T N E S S</Text>
            </View>

            {/* Heading */}
            <Text style={styles.heading}>CREATE ACCOUNT</Text>
            <Text style={styles.subheading}>Start your fitness journey</Text>

            {/* Glassmorphic Form Card */}
            <View style={styles.formCard}>
              <AuthInput
                placeholder="Name"
                value={name}
                onChangeText={(val) => {
                  setName(val);
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
                }}
                allowedType="string"
                autoCapitalize="words"
                autoComplete="name"
                icon="person-outline"
                error={fieldErrors.name}
              />
              <AuthInput
                placeholder="Surname"
                value={surname}
                onChangeText={(val) => {
                  setSurname(val);
                  if (fieldErrors.surname) setFieldErrors((prev) => ({ ...prev, surname: '' }));
                }}
                allowedType="string"
                autoCapitalize="words"
                autoComplete="name-family"
                icon="person-outline"
                error={fieldErrors.surname}
              />
              <AuthInput
                placeholder="Email"
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
                placeholder="Mobile"
                value={mobile}
                onChangeText={(val) => {
                  setMobile(val);
                  if (fieldErrors.mobile) setFieldErrors((prev) => ({ ...prev, mobile: '' }));
                }}
                allowedType="number"
                keyboardType="phone-pad"
                autoComplete="tel"
                icon="call-outline"
                error={fieldErrors.mobile}
              />
              <AuthInput
                placeholder="Password"
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                allowedType="both"
                secureTextEntry
                autoComplete="password-new"
                icon="lock-closed-outline"
                error={fieldErrors.password}
              />

              {/* Marketing Consent Option */}
              <View style={styles.consentWrapper}>
                <Pressable
                  style={styles.consentRow}
                  onPress={() => {
                    setMarketingConsent((value) => {
                      const next = !value;
                      if (next && fieldErrors.marketingConsent) {
                        setFieldErrors((prev) => ({ ...prev, marketingConsent: '' }));
                      }
                      return next;
                    });
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marketingConsent }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      marketingConsent && styles.checkboxChecked,
                      Boolean(fieldErrors.marketingConsent) && styles.checkboxError,
                    ]}
                  >
                    {marketingConsent ? (
                      <Ionicons name="checkmark-sharp" size={14} color="#051614" />
                    ) : null}
                  </View>
                  <Text style={[styles.consentText, Boolean(fieldErrors.marketingConsent) && styles.consentTextError]}>
                    I agree to receive occasional email or SMS messages about my trial, useful tips, and future offers. I can opt out anytime.
                  </Text>
                </Pressable>

                {fieldErrors.marketingConsent ? (
                  <View style={styles.consentErrorRow}>
                    <Ionicons name="alert-circle-outline" size={14} color="#EF4444" style={styles.errorIcon} />
                    <Text style={styles.consentErrorText}>{fieldErrors.marketingConsent}</Text>
                  </View>
                ) : null}
              </View>

              <AuthButton title="Register" onPress={handleRegister} disabled={loading} loading={loading} />
            </View>

            {/* Login Link */}
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7}>
                <Text style={styles.linkHighlight}>Log In</Text>
              </TouchableOpacity>
            </View>

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
    backgroundColor: 'rgba(7, 10, 15, 0.78)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: height * 0.06,
    paddingBottom: 36,
    alignItems: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 24,
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
  consentWrapper: {
    width: '100%',
    marginTop: 4,
    marginBottom: 20,
  },
  consentRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 12,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  checkboxError: {
    borderColor: '#EF4444',
    borderWidth: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  consentText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  consentTextError: {
    color: '#F87171',
  },
  consentErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingLeft: 34,
  },
  errorIcon: {
    marginRight: 4,
  },
  consentErrorText: {
    fontSize: 12,
    color: '#EF4444',
    fontFamily: 'Inter_600SemiBold',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 16,
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
    marginTop: 24,
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
