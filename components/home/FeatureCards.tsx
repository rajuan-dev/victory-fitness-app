import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../lib/i18n';

const { width } = Dimensions.get('window');

type FeatureCardsProps = {
  canAccessCoachVictor?: boolean;
  canAccessNutrition?: boolean;
  onRestrictedPress?: (sectionName: string) => void;
};

export default function FeatureCards({
  canAccessCoachVictor = true,
  canAccessNutrition = true,
  onRestrictedPress,
}: FeatureCardsProps) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <View style={styles.featureContainer}>
      {/* Coach Victor */}
      <View style={[styles.featureCardFull, { backgroundColor: Colors.accentBlue }, !canAccessCoachVictor && styles.lockedCard]}>
        <View style={styles.featureIconCircle}>
          <Ionicons name="add" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>{t('COACH VICTOR')}</Text>
          <Text style={styles.featureDesc}>
            {t('Your AI companion for motivation, advice, and feedback.')}
          </Text>
          <TouchableOpacity 
            style={styles.featureAction}
            onPress={() => {
              if (!canAccessCoachVictor) {
                onRestrictedPress?.('Coach Victor');
                return;
              }
              router.push('/chat');
            }}
          >
            <Text style={styles.featureLink}>{canAccessCoachVictor ? t('Start Chat +') : t('Unlock Access +')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.featureCardFull, { backgroundColor: Colors.accentPurple, marginTop: 16 }, !canAccessNutrition && styles.lockedCard]}>
          <View style={styles.featureIconCircle}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>{t('NUTRITION')}</Text>
            <Text style={styles.featureDesc}>
              {t('Personalized nutrition plans and recipes for your goals.')}
            </Text>
            <TouchableOpacity
              style={styles.featureAction}
              onPress={() => {
                if (!canAccessNutrition) {
                  onRestrictedPress?.('Nutrition');
                  return;
                }
                router.push('/mealPlan');
              }}
            >
              <Text style={styles.featureLink}>{canAccessNutrition ? t('View Plan +') : t('Unlock Access +')}</Text>
            </TouchableOpacity>
          </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  featureContainer: {
    marginBottom: 20,
  },
  featureCardFull: {
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedCard: {
    opacity: 0.84,
  },
  featureIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: 'Inter_700Bold',
  },
  featureDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 19,
    marginBottom: 12,
    maxWidth: width * 0.6,
    fontFamily: 'Inter_400Regular',
  },
  featureAction: {
    alignSelf: 'flex-start',
  },
  featureLink: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
