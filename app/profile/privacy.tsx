import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { apiRequest } from '../../lib/api';

type PrivacyPolicyPayload = {
  title: string;
  plain_text: string;
  updated_at: string;
};

export default function PrivacyScreen() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [policy, setPolicy] = React.useState<PrivacyPolicyPayload | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const loadPrivacyPolicy = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<PrivacyPolicyPayload>('/content/privacy-policy');
        if (!cancelled) {
          setPolicy(response);
        }
      } catch {
        if (!cancelled) {
          setPolicy(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPrivacyPolicy();

    return () => {
      cancelled = true;
    };
  }, []);

  const sections = (policy?.plain_text || '')
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);
  const updatedLabel = policy?.updated_at
    ? new Date(policy.updated_at).toLocaleDateString()
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        headerShown: true,
        title: 'PRIVACY POLICY',
        headerTransparent: true,
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: 2 } as any,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={Colors.accentBlue} size="large" />
            <Text style={styles.loadingText}>Loading privacy policy...</Text>
          </View>
        ) : (
          <View style={styles.textSection}>
            <Text style={styles.lastUpdated}>
              {updatedLabel ? `Last Updated: ${updatedLabel}` : 'Latest privacy policy'}
            </Text>
            <Text style={styles.pageTitle}>{policy?.title || 'Privacy Policy'}</Text>
            {sections.map((section, index) => {
              const lines = section.split('\n').map((line) => line.trim()).filter(Boolean);
              const [firstLine, ...restLines] = lines;
              const firstIsHeading = /^\d+\./.test(firstLine || '');

              return (
                <View key={`${index}-${firstLine || 'section'}`} style={styles.sectionBlock}>
                  {firstLine ? (
                    <Text style={firstIsHeading ? styles.heading : styles.bodyText}>{firstLine}</Text>
                  ) : null}
                  {restLines.map((line, lineIndex) => (
                    <Text
                      key={`${index}-${lineIndex}`}
                      style={line.startsWith('- ') ? styles.bulletItem : styles.bodyText}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  scrollContent: {
    paddingTop: 100,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  textSection: {
    paddingBottom: 20,
  },
  loadingBlock: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  lastUpdated: {
    color: Colors.accentBlue,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  pageTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  sectionBlock: {
    marginBottom: 8,
  },
  heading: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
    marginTop: 24,
    marginBottom: 12,
  },
  bodyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  bulletItem: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
});
