import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';

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

  return (
    <View style={styles.featureContainer}>
      {/* Coach Victor */}
      <View style={[styles.featureCardFull, { backgroundColor: Colors.accentBlue }, !canAccessCoachVictor && styles.lockedCard]}>
        <View style={styles.featureIconCircle}>
          <Ionicons name="add" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>COACH VICTOR</Text>
          <Text style={styles.featureDesc}>
            Your AI companion for motivation, advice, and feedback.
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
            <Text style={styles.featureLink}>{canAccessCoachVictor ? 'Start Chat +' : 'Unlock Access +'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.featureCardFull, { backgroundColor: Colors.accentPurple, marginTop: 16 }, !canAccessNutrition && styles.lockedCard]}>
          <View style={styles.featureIconCircle}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>NUTRITION</Text>
            <Text style={styles.featureDesc}>
              Personalized nutrition plans and recipes for your goals.
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
              <Text style={styles.featureLink}>{canAccessNutrition ? 'View Plan +' : 'Unlock Access +'}</Text>
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
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: 'Inter_700Bold',
  },
  featureDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
    marginBottom: 12,
    maxWidth: width * 0.6,
    fontFamily: 'Inter_400Regular',
  },
  featureAction: {
    alignSelf: 'flex-start',
  },
  featureLink: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
