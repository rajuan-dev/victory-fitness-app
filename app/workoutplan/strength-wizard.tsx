import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import { fetchCurrentUser, fetchCurrentUserBodyMetrics } from '../../lib/api';
import { createStrengthWorkoutPlan } from '../../lib/workout-plans';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

const { width } = Dimensions.get('window');

const TOTAL_STEPS = 9;

const GOALS = [
  { id: '1', title: 'HYPERTROPHY', sub: 'Maximize muscle size and volume' },
  { id: '2', title: 'PURE STRENGTH', sub: 'Lifting the heaviest weights possible' },
  { id: '3', title: 'POWER & SPEED', sub: 'Explosive movements and athleticism' },
  { id: '4', title: 'BODY RECOMP', sub: 'Gain muscle while losing fat' },
];

const SPLITS = [
  { id: '1', title: 'FULL BODY', sub: 'Whole body each session (3-4x/week)' },
  { id: '2', title: 'UPPER / LOWER', sub: 'Alternating focus (4x/week)' },
  { id: '3', title: 'PUSH PULL LEGS', sub: 'Specific movement patterns (3-6x/week)' },
];

const EQUIPMENT = [
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'kettlebells', label: 'Kettlebells' },
  { id: 'ropes', label: 'Battle Ropes' },
  { id: 'medball', label: 'Medicine Ball' },
  { id: 'bench', label: 'Bench' },
  { id: 'squat_rack', label: 'Squat Rack' },
  { id: 'pullup_bar', label: 'Pull-up Bar' },
  { id: 'bands', label: 'Resistance Bands' },
  { id: 'cable', label: 'Cable Machine' },
  { id: 'smith', label: 'Smith Machine' },
  { id: 'machines', label: 'Gym Machines' },
  { id: 'crossfit', label: 'Crossfit Box Equipment' },
  { id: 'bodyweight', label: 'Bodyweight Only' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StrengthWizard() {
  useModuleAccessGuard('/workoutplan');
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    equipment: [],
    days: [],
    bench: '',
    squat: '',
    deadlift: '',
    frequency: '4',
  });
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    let cancelled = false;

    const preloadProfileData = async () => {
      try {
        const [user, metrics] = await Promise.all([
          fetchCurrentUser().catch(() => null),
          fetchCurrentUserBodyMetrics().catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setFormData((current: any) => ({
          ...current,
          age: current.age || metrics?.age || '',
          height: current.height || metrics?.height || '',
          weight: current.weight || metrics?.weight || '',
          gender: current.gender || metrics?.gender || '',
          country: current.country || user?.country || '',
        }));
      } catch {
        return;
      }
    };

    void preloadProfileData();

    return () => {
      cancelled = true;
    };
  }, []);

  const resolveGoalLabel = (goalId: string | undefined) => GOALS.find((item) => item.id === goalId)?.title ?? '';
  const resolveSplitLabel = (splitId: string | undefined) => SPLITS.find((item) => item.id === splitId)?.title ?? '';
  const resolveEquipmentLabels = (equipmentIds: string[] | undefined) =>
    (equipmentIds ?? [])
      .map((id) => EQUIPMENT.find((item) => item.id === id)?.label ?? '')
      .filter(Boolean);

  const nextStep = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else generatePlan();
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const generatePlan = async () => {
    setLoading(true);
    try {
      await createStrengthWorkoutPlan({
        goal: resolveGoalLabel(formData.goal),
        level: formData.level,
        split: resolveSplitLabel(formData.split),
        height: formData.height,
        gender: formData.gender,
        bench: formData.bench,
        squat: formData.squat,
        deadlift: formData.deadlift,
        equipment: resolveEquipmentLabels(formData.equipment),
        frequency: formData.frequency,
        days: formData.days,
        age: formData.age,
        weight: formData.weight,
      });
      setLoading(false);
      router.replace('/workoutplan/strength-plan');
    } catch {
      setLoading(false);
      Alert.alert('Generation failed', 'Unable to create your custom strength plan right now.');
    }
  };

  const updateData = (key: string, value: any) => {
    setFormData({ ...formData, [key]: value });
  };

  const toggleListValue = (key: string, value: any) => {
    const current = formData[key] || [];
    if (current.includes(value)) {
      updateData(key, current.filter((v: any) => v !== value));
    } else {
      updateData(key, [...current, value]);
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  const renderStep = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accentBlue} />
          <Text style={styles.loadingText}>Analyzing your strength profile and generating a periodized plan...</Text>
        </View>
      );
    }

    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.title}>What is your primary strength goal?</Text>
            <Text style={styles.subtitle}>Choose the focus area for your periodized plan.</Text>
            <View style={styles.optionGrid}>
              {GOALS.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.wideCard, formData.goal === g.id && styles.activeCard]}
                  onPress={() => updateData('goal', g.id)}
                >
                  <View>
                    <Text style={[styles.cardTitle, formData.goal === g.id && styles.activeCardTitle]}>{g.title}</Text>
                    <Text style={styles.cardSub}>{g.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Level of Experience</Text>
            <Text style={styles.subtitle}>How long have you been strength training?</Text>
            <View style={styles.optionGrid}>
              {['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.wideCard, formData.level === l && styles.activeCard]}
                  onPress={() => updateData('level', l)}
                >
                  <Text style={[styles.cardTitle, formData.level === l && styles.activeCardTitle]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Preferred training split</Text>
            <Text style={styles.subtitle}>Select how you want to organize your sessions.</Text>
            <View style={styles.optionGrid}>
              {SPLITS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.wideCard, formData.split === s.id && styles.activeCard]}
                  onPress={() => updateData('split', s.id)}
                >
                  <View>
                    <Text style={[styles.cardTitle, formData.split === s.id && styles.activeCardTitle]}>{s.title}</Text>
                    <Text style={styles.cardSub}>{s.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.title}>Your Metrics</Text>
            <Text style={styles.subtitle}>These help us estimate your initial intensity levels.</Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.numericInput}
                  placeholder="Your Height (cm)"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="numeric"
                  value={formData.height}
                  onChangeText={(t) => updateData('height', t)}
                />
                <Text style={styles.inputSuffix}>cm</Text>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.numericInput}
                  placeholder="Gender"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={formData.gender}
                  onChangeText={(t) => updateData('gender', t)}
                />
              </View>
            </View>
          </View>
        );
      case 5: // IMAGE 4: STRENGTH VALUES
        return (
          <View style={styles.stepContent}>
            <Text style={styles.title}>YOUR STRENGTH VALUES</Text>
            <Text style={styles.subtitle}>Enter your 1-Rep-Max (1RM) weights. If you don't know them, leave the fields blank.</Text>
            <View style={styles.inputGroup}>
              {['1RM Bench Press', '1RM Squat', '1RM Deadlift'].map((label, idx) => {
                const key = ['bench', 'squat', 'deadlift'][idx];
                return (
                  <View key={key} style={styles.inputRow}>
                    <TextInput
                      style={styles.numericInput}
                      placeholder={`${label} (kg)`}
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      keyboardType="numeric"
                      value={formData[key]}
                      onChangeText={(t) => updateData(key, t)}
                    />
                    <Text style={styles.inputSuffix}>kg</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      case 6: // IMAGE 5: EQUIPMENT
        return (
          <View style={styles.stepContent}>
            <Text style={styles.title}>WHAT EQUIPMENT DO YOU HAVE AVAILABLE?</Text>
            <Text style={styles.subtitle}>We prioritize functional tools like Kettlebells & Ropes if available.</Text>
            <ScrollView style={styles.equipmentScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.equipmentGrid}>
                {EQUIPMENT.map((e) => {
                  const isSelected = formData.equipment.includes(e.id);
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.equipmentCard, isSelected && styles.activeEquipmentCard]}
                      onPress={() => toggleListValue('equipment', e.id)}
                    >
                      <View style={[styles.checkbox, isSelected && styles.activeCheckbox]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
                      </View>
                      <Text style={[styles.equipmentLabel, isSelected && styles.activeEquipmentLabel]}>{e.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );
      case 7: // IMAGE 2: FREQUENCY
        return (
          <View style={styles.stepContent}>
            <Text style={styles.title}>HOW OFTEN DO YOU WANT TO TRAIN PER WEEK?</Text>
            <Text style={styles.subtitle}>A typical strength plan has 3-5 sessions per week.</Text>
            <View style={styles.frequencyGrid}>
              {['3', '4', '5'].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.freqCard, formData.frequency === n && styles.activeFreqCard]}
                  onPress={() => updateData('frequency', n)}
                >
                  <Text style={[styles.freqText, formData.frequency === n && styles.activeFreqText]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 8: // IMAGE 3: PREFERRED DAYS
        return (
          <View style={styles.stepContent}>
            <Text style={styles.title}>WHICH DAYS DO YOU PREFER TO TRAIN?</Text>
            <Text style={styles.subtitle}>Select the days that work best for you.</Text>
            <View style={styles.inputGroup}>
              {DAYS.map((day) => {
                const isSelected = formData.days.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.wideCard, isSelected && styles.activeCard]}
                    onPress={() => toggleListValue('days', day)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.activeCheckbox]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
                    </View>
                    <Text style={[styles.cardTitle, isSelected && styles.activeCardTitle]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      case 9: // IMAGE 1: REVIEW DETAILS
        return (
          <View style={styles.stepContent}>
            <Text style={styles.title}>REVIEW YOUR DETAILS</Text>
            <Text style={styles.subtitle}>We've taken this data from your profile. Adjust it if needed.</Text>
            <View style={styles.inputGroup}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.numericInput}
                  placeholder="Your Age"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="numeric"
                  value={formData.age}
                  onChangeText={(t) => updateData('age', t)}
                />
                <Text style={styles.inputSuffix}>yrs</Text>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.numericInput}
                  placeholder="Your Weight (kg)"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="numeric"
                  value={formData.weight}
                  onChangeText={(t) => updateData('weight', t)}
                />
                <Text style={styles.inputSuffix}>kg</Text>
              </View>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <VictoryHeader />
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Step Header */}
        {!loading && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="add" size={28} color="#fff" style={{ transform: [{ rotate: '45deg' }] }} />
            </TouchableOpacity>
            <View style={styles.progressSection}>
              <View style={styles.progressLabels}>
                <Text style={styles.stepLabel}>STEP {step} OF {TOTAL_STEPS}</Text>
                <Text style={styles.pctLabel}>{Math.round(progress)}%</Text>
              </View>
              <View style={styles.progressBase}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
              </View>
            </View>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {renderStep()}
        </ScrollView>

        {!loading && (
          <View style={styles.footer}>
            <TouchableOpacity onPress={prevStep} disabled={step === 1}>
              <Text style={[styles.footerBtnText, step === 1 && { opacity: 0.3 }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.mainBtn} 
              onPress={nextStep}
              activeOpacity={0.8}
            >
              <Text style={styles.mainBtnText}>
                {step === TOTAL_STEPS ? 'GENERATE PLAN' : 'NEXT'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2124',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    padding: 4,
  },
  progressSection: {
    flex: 1,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  pctLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  progressBase: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.accentBlue,
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  stepContent: {
    marginTop: 32,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontFamily: 'Inter_900Black',
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    marginBottom: 40,
  },
  optionGrid: {
    gap: 12,
  },
  wideCard: {
    backgroundColor: '#2A2E33',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  activeCard: {
    borderColor: Colors.accentBlue,
    backgroundColor: 'rgba(6,182,212,0.05)',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  activeCardTitle: {
    color: Colors.accentBlue,
  },
  cardSub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  inputGroup: {
    gap: 16,
  },
  inputRow: {
    backgroundColor: '#2A2E33',
    borderRadius: 16,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  numericInput: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    height: '100%',
    outlineStyle: 'none',
  } as any,
  inputSuffix: {
    color: Colors.accentBlue,
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
    marginLeft: 12,
  },
  equipmentScroll: {
    maxHeight: 450,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  equipmentCard: {
    width: (width - 60) / 2,
    backgroundColor: '#2A2E33',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 64,
  },
  activeEquipmentCard: {
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  activeCheckbox: {
    backgroundColor: Colors.accentBlue,
    borderColor: Colors.accentBlue,
  },
  equipmentLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  activeEquipmentLabel: {
    color: '#fff',
  },
  frequencyGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 20,
  },
  freqCard: {
    width: 80,
    height: 100,
    backgroundColor: '#2A2E33',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeFreqCard: {
    borderColor: Colors.accentBlue,
  },
  freqText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 32,
    fontFamily: 'Inter_900Black',
  },
  activeFreqText: {
    color: Colors.accentBlue,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
  },
  footerBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  mainBtn: {
    backgroundColor: Colors.accentBlue,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    minWidth: 180,
    alignItems: 'center',
    shadowColor: Colors.accentBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mainBtnText: {
    color: '#000',
    fontSize: 15,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    marginTop: 100,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 24,
  },
});

