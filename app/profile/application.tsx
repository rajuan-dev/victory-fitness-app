import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchCurrentUser, submitCoachingApplication } from '../../lib/api';

export default function ApplicationScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Form State
  const [goal, setGoal] = useState<string | null>(null);
  const [obstacle, setObstacle] = useState<string | null>(null);
  const [investment, setInvestment] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<string | null>(null);
  const [injury, setInjury] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<boolean>(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const me = await fetchCurrentUser();
        if (cancelled) {
          return;
        }
        const nameParts = String(me.name || '').trim().split(/\s+/).filter(Boolean);
        setFirstName(nameParts[0] || '');
        setLastName(nameParts.slice(1).join(' '));
        setEmail(me.email || '');
      } catch {
        return;
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Missing details', 'Please complete your name and email before submitting.');
      return;
    }
    if (!goal || !obstacle || !investment || !commitment || !injury) {
      Alert.alert('Incomplete application', 'Please answer all application questions.');
      return;
    }
    if (!agreement) {
      Alert.alert('Agreement required', 'Please confirm the agreement before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await submitCoachingApplication({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone_number: phoneNumber.trim(),
        goal,
        obstacle,
        investment,
        commitment,
        injury,
        additional_notes: additionalNotes.trim(),
        agreement_accepted: true,
      });
      Alert.alert('Application sent', 'Your application has been submitted successfully.');
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit your application right now.';
      Alert.alert('Submission failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const RadioOption = ({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) => (
    <TouchableOpacity
      style={[styles.radioItem, selected && styles.radioItemSelected]}
      activeOpacity={0.7}
      onPress={onSelect}
    >
      <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <Text style={[styles.radioText, selected && styles.radioTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Dynamic Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FACC15" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* Section 1: Hero */}
          <View style={styles.heroSection}>
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>⭐ PREMIUM COACHING</Text>
            </View>
            <Text style={styles.heroTitle}>Work With Me{'\n'}Directly</Text>
            <Text style={styles.heroSub}>Tailored plans to transform your body and mind.</Text>

            <Text style={styles.heroDesc}>
              I create custom fitness and nutrition programs, built specifically to fit your lifestyle and goals.
            </Text>

            <View style={styles.checkList}>
              {['Personalized Workout', 'Custom Nutrition Plan', 'Weekly Check-Ins', '24/7 Support via WhatsApp'].map((item, idx) => (
                <View key={idx} style={styles.checkItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#FACC15" />
                  <Text style={styles.checkText}>{item}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.applyBtnPrimary}>
              <Text style={styles.applyBtnTextPrimary}>Apply Now →</Text>
            </TouchableOpacity>
          </View>

          {/* Section 2: Warning */}
          <View style={styles.warningSection}>
            <View style={[styles.badgeWrap, { borderColor: '#FACC15' }]}>
              <Text style={[styles.badgeText, { color: '#FACC15' }]}>⚠️ A WORD OF WARNING</Text>
            </View>
            <Text style={styles.warningTitle}>This is Not for everyone</Text>

            <Text style={styles.warningDesc}>
              I only work with dedicated individuals who are serious about their goals.
            </Text>
            <Text style={styles.warningDesc}>
              If you are not willing to put in the work, please do not apply. I have limited spots and only want to work with those who are ready to commit.
            </Text>
            <Text style={styles.warningDesc}>
              This program requires hard work, discipline, and consistency.
            </Text>
            <Text style={[styles.warningDesc, { color: '#FACC15', fontWeight: 'bold' }]}>
              If that is you... keep reading.
            </Text>
          </View>

          {/* Section 3: What you Get */}
          <View style={styles.includedSection}>
            <View style={[styles.badgeWrap, { borderColor: '#000' }]}>
              <Text style={[styles.badgeText, { color: '#000' }]}>WHAT'S INCLUDED</Text>
            </View>
            <Text style={styles.includedTitle}>What you Get</Text>

            <View style={styles.includedList}>
              {[
                'Custom Workout Program',
                'Personalized Nutrition Macros',
                'Weekly Adjustment & Check-Ins',
                'Form Check & Video Analysis',
                'Direct Access via WhatsApp'
              ].map((item, idx) => (
                <View key={idx} style={styles.includedCard}>
                  <Ionicons name="checkmark-done" size={20} color="#000" />
                  <Text style={styles.includedCardText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Section 4: Is this for you? */}
          <View style={styles.forYouSection}>
            <View style={[styles.badgeWrap, { borderColor: '#FACC15' }]}>
              <Text style={[styles.badgeText, { color: '#FACC15' }]}>ARE YOU READY?</Text>
            </View>
            <Text style={styles.forYouTitle}>This Is For You If...</Text>

            <View style={styles.forYouList}>
              {[
                'You feel stuck and need expert guidance to break plateaus',
                'You want sustained results, not just a quick fix',
                'You are willing to invest time in self-improvement',
                'You need accountability and want a coach who actually cares'
              ].map((item, idx) => (
                <View key={idx} style={styles.forYouCard}>
                  <Ionicons name="hand-right-outline" size={20} color="#FACC15" />
                  <Text style={styles.forYouCardText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Section 5: Form */}
          <View style={styles.formSection}>
            <View style={[styles.badgeWrap, { borderColor: '#FACC15' }]}>
              <Text style={[styles.badgeText, { color: '#FACC15' }]}>LIMITED SPACES</Text>
            </View>
            <Text style={styles.formSectionTitle}>Apply for the Inner Circle</Text>
            <Text style={styles.formSubTitle}>Fill out the application form below.</Text>

            <View style={styles.formCard}>
              
              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Jane"
                    placeholderTextColor="#9CA3AF"
                    value={firstName}
                    onChangeText={setFirstName}
                    editable={!submitting && !loadingProfile}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Doe"
                    placeholderTextColor="#9CA3AF"
                    value={lastName}
                    onChangeText={setLastName}
                    editable={!submitting && !loadingProfile}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="jane@example.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={!submitting && !loadingProfile}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
                <View style={styles.phoneInputWrap}>
                  <View style={styles.phonePrefix}>
                    <Text>🇩🇪</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, { flex: 1, borderLeftWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                    placeholder="+49 123 4567890"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    editable={!submitting}
                  />
                </View>
              </View>

              <View style={styles.formDivider} />

              <View style={styles.inputGroup}>
                <Text style={styles.formGroupTitle}>What is your main fitness goal?</Text>
                {['Lose Weight', 'Build Muscle', 'Recomp/Both', 'Improve athletic performance', 'Other'].map(opt => (
                  <RadioOption key={opt} label={opt} selected={goal === opt} onSelect={() => setGoal(opt)} />
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.formGroupTitle}>What is holding you back from your goals?</Text>
                {['Lack of consistency', 'Poor nutrition', 'Not sure what to do', 'Motivation / Accountability', 'Injury', 'Other'].map(opt => (
                  <RadioOption key={opt} label={opt} selected={obstacle === opt} onSelect={() => setObstacle(opt)} />
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.formGroupTitle}>Are you willing to invest financially in your health?</Text>
                {['Yes, I am ready', 'I need more information', 'Not at this time'].map(opt => (
                  <RadioOption key={opt} label={opt} selected={investment === opt} onSelect={() => setInvestment(opt)} />
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.formGroupTitle}>How committed are you to following the plan?</Text>
                {['Very committed', 'Somewhat committed', 'Not sure'].map(opt => (
                  <RadioOption key={opt} label={opt} selected={commitment === opt} onSelect={() => setCommitment(opt)} />
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.formGroupTitle}>Do you have any injuries or medical conditions?</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.radioItem, { flex: 1 }, injury === 'Yes' && styles.radioItemSelected]} onPress={() => setInjury('Yes')}>
                    <View style={[styles.radioCircle, injury === 'Yes' && styles.radioCircleSelected]}>
                      {injury === 'Yes' && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.radioText, injury === 'Yes' && styles.radioTextSelected]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.radioItem, { flex: 1 }, injury === 'No' && styles.radioItemSelected]} onPress={() => setInjury('No')}>
                    <View style={[styles.radioCircle, injury === 'No' && styles.radioCircleSelected]}>
                      {injury === 'No' && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.radioText, injury === 'No' && styles.radioTextSelected]}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.formGroupTitle}>Is there anything else you'd like me to know?</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Optional... Let me know anything else that may help"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  value={additionalNotes}
                  onChangeText={setAdditionalNotes}
                  editable={!submitting}
                />
              </View>

              <TouchableOpacity style={styles.agreementWrap} activeOpacity={0.7} onPress={() => setAgreement(!agreement)}>
                <View style={[styles.checkbox, agreement && styles.checkboxActive]}>
                  {agreement && <Ionicons name="checkmark" size={14} color="#000" />}
                </View>
                <Text style={styles.agreementText}>
                  I understand that this is a premium service and selecting yes means I am ready to invest in myself.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
                <Text style={styles.submitBtnText}>Submit Application →</Text>
              </TouchableOpacity>

            </View>
          </View>

          {/* Footer */}
          {/* <View style={styles.footer}>
            <Text style={styles.footerLogo}>Victory Fit</Text>
            <Text style={styles.footerSub}>You showed up.{'\n'}Let us handle everything else.</Text>
            <Text style={styles.footerYellow}>We back drop & runaways</Text>

            <View style={styles.footerLinks}>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
              <Text style={styles.footerLinkText}>•</Text>
              <Text style={styles.footerLinkText}>Terms of Service</Text>
            </View>
            <Text style={styles.footerCopy}>© 2024 Victory Fitness. All rights reserved.</Text>
          </View> */}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backBtn: {
    padding: 5,
  },
  headerLogo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FACC15',
    fontFamily: 'Inter_900Black',
    fontStyle: 'italic',
  },
  
  badgeWrap: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAB308',
    alignSelf: 'center',
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EAB308',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },

  /* Section 1 Hero */
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 60,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Inter_900Black',
    lineHeight: 46,
    marginBottom: 16,
  },
  heroSub: {
    fontSize: 16,
    color: '#EAB308',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  heroDesc: {
    fontSize: 15,
    color: '#D1D5DB',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 10,
    fontFamily: 'Inter_400Regular',
  },
  checkList: {
    width: '100%',
    gap: 12,
    marginBottom: 40,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  checkText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  applyBtnPrimary: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: '#FACC15',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  applyBtnTextPrimary: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },

  /* Section 2 Warning */
  warningSection: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 60,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Inter_900Black',
    marginBottom: 24,
  },
  warningDesc: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
    fontFamily: 'Inter_400Regular',
  },

  /* Section 3 Included */
  includedSection: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 20,
    paddingVertical: 60,
    alignItems: 'center',
  },
  includedTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    fontFamily: 'Inter_900Black',
    marginBottom: 40,
  },
  includedList: {
    width: '100%',
    gap: 12,
  },
  includedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  includedCardText: {
    color: '#000',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },

  /* Section 4 For You */
  forYouSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 60,
    alignItems: 'center',
  },
  forYouTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    fontFamily: 'Inter_900Black',
    marginBottom: 40,
  },
  forYouList: {
    width: '100%',
    gap: 12,
  },
  forYouCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#F3F4F6',
    padding: 18,
    borderRadius: 12,
  },
  forYouCardText: {
    flex: 1,
    color: '#1F2937',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },

  /* Section 5 Form */
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  formSectionTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Inter_900Black',
    marginBottom: 10,
  },
  formSubTitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: 'Inter_400Regular',
  },
  formCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  formRow: {
    flexDirection: 'row',
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000',
    fontFamily: 'Inter_400Regular',
  },
  phoneInputWrap: {
    flexDirection: 'row',
  },
  phonePrefix: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
    marginBottom: 30,
  },
  formGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    fontFamily: 'Inter_700Bold',
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  radioItemSelected: {
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#000',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  radioText: {
    fontSize: 15,
    color: '#4B5563',
    fontFamily: 'Inter_400Regular',
  },
  radioTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  agreementWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 30,
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    padding: 16,
    borderRadius: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    marginTop: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    borderColor: '#FACC15',
  },
  agreementText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  submitBtn: {
    backgroundColor: '#FACC15',
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  footerLogo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Inter_900Black',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  footerSub: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  footerYellow: {
    fontSize: 14,
    color: '#FACC15',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginBottom: 30,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  footerLinkText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  footerCopy: {
    fontSize: 12,
    color: '#4B5563',
    fontFamily: 'Inter_400Regular',
  },
});
