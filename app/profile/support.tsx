import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { submitSupportMessage } from '../../lib/api';

export default function ContactUsScreen() {
  const router = useRouter();
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleEmail = () => {
    Linking.openURL('mailto:office@victorakko.com');
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing details', 'Please enter both a subject and a message.');
      return;
    }

    setSubmitting(true);
    try {
      await submitSupportMessage({
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubject('');
      setMessage('');
      Alert.alert('Message sent', 'Your support message has been sent successfully.');
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unable to send your support message right now.';
      Alert.alert('Send failed', details);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        headerShown: true,
        title: 'CONTACT US',
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
        <View style={styles.header}>
          <Text style={styles.title}>GET IN TOUCH</Text>
          <Text style={styles.subtitle}>
            Have a question or feedback? We'd love to hear from you. Our team and AI coach are ready to help.
          </Text>
        </View>

        <View style={styles.contactGrid}>
          <TouchableOpacity style={styles.contactCard} activeOpacity={0.8} onPress={handleEmail}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(6,182,212,0.1)' }]}>
              <Ionicons name="mail-outline" size={28} color={Colors.accentBlue} />
            </View>
            <Text style={styles.cardTitle}>EMAIL US</Text>
            <Text style={styles.cardValue}>office@victorakko.com</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactCard}
            activeOpacity={0.8}
            onPress={() => router.push('/chat')}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
              <Ionicons name="chatbubbles-outline" size={28} color={Colors.accentPurple} />
            </View>
            <Text style={styles.cardTitle}>AI COACH</Text>
            <Text style={styles.cardValue}>Chat with Victor</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>SEND US A MESSAGE</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>SUBJECT</Text>
            <TextInput
              style={styles.input}
              placeholder="What can we help you with?"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={subject}
              onChangeText={setSubject}
              editable={!submitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>MESSAGE</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write your message here..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
              editable={!submitting}
            />
          </View>

          <TouchableOpacity style={[styles.sendBtn, submitting && styles.sendBtnDisabled]} activeOpacity={0.8} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.sendBtnText}>SEND MESSAGE</Text>}
          </TouchableOpacity>
        </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    maxWidth: '90%',
  },
  contactGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  cardValue: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    outlineStyle: 'none' as any,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: Colors.accentBlue,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  sendBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
  socialSection: {
    alignItems: 'center',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 24,
  },
  socialIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
});

