import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import {
  AdminChallengeItem,
  AdminChallengePayload,
  createAdminChallenge,
  fetchAdminChallenges,
  fetchCurrentUser,
} from '../../lib/api';

const DURATION_OPTIONS = [3, 5, 7, 14, 21];
const INITIAL_FORM: AdminChallengePayload = {
  title: '',
  description: '',
  category: 'FAMILY HEALTH',
  durationDays: 3,
  points: 75,
  difficulty: 'BEGINNER',
  status: 'ACTIVE',
  thumbnail: '',
  planText: '',
  planDays: [],
};

export default function AdminChallengesScreen() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selectedDuration, setSelectedDuration] = React.useState<number>(DURATION_OPTIONS[0]);
  const [challenges, setChallenges] = React.useState<AdminChallengeItem[]>([]);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [form, setForm] = React.useState<AdminChallengePayload>(INITIAL_FORM);

  const loadChallenges = React.useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setError('');
    try {
      const currentUser = await fetchCurrentUser();
      if (!currentUser?.is_admin) {
        router.replace('/profile');
        return;
      }
      const response = await fetchAdminChallenges();
      setChallenges(Array.isArray(response.challenges) ? response.challenges : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load admin challenges.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [router]);

  useFocusEffect(
    React.useCallback(() => {
      void loadChallenges(true);
    }, [loadChallenges]),
  );

  const filteredChallenges = React.useMemo(
    () => challenges.filter((item) => item.durationDays === selectedDuration),
    [challenges, selectedDuration],
  );

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadChallenges(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadChallenges]);

  const updateForm = <K extends keyof AdminChallengePayload>(key: K, value: AdminChallengePayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCreateChallenge = async () => {
    if (saving) {
      return;
    }
    if (!form.title.trim() || !form.description.trim() || !form.category.trim()) {
      Alert.alert('Missing fields', 'Please enter title, description, and category.');
      return;
    }

    setSaving(true);
    try {
      const created = await createAdminChallenge({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        durationDays: selectedDuration,
        thumbnail: String(form.thumbnail || '').trim(),
        planText: String(form.planText || '').trim(),
      });
      setChallenges((current) => [created, ...current]);
      setSelectedDuration(created.durationDays || form.durationDays);
      setShowCreateModal(false);
      setForm(INITIAL_FORM);
      Alert.alert('Challenge added', 'The challenge has been added to the dashboard.');
    } catch (saveError) {
      Alert.alert('Create failed', saveError instanceof Error ? saveError.message : 'Unable to create challenge.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.88} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Challenges Dashboard</Text>
          <Text style={styles.headerSubtitle}>Create and manage challenge cards by duration.</Text>
        </View>
        <TouchableOpacity style={styles.addButton} activeOpacity={0.88} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={20} color="#04111F" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <Text style={styles.leadText}>Add title, description, and thumbnail. Cards are grouped exactly by duration for the dashboard.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationTabsRow}>
          {DURATION_OPTIONS.map((days) => (
            <TouchableOpacity
              key={days}
              style={[styles.durationTabPill, selectedDuration === days && styles.durationTabPillActive]}
              activeOpacity={0.88}
              onPress={() => setSelectedDuration(days)}
            >
              <Text style={[styles.durationTabText, selectedDuration === days && styles.durationTabTextActive]}>
                {days} Days
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading challenges...</Text>
          </View>
        ) : filteredChallenges.length > 0 ? (
          filteredChallenges.map((challenge) => (
            <View key={challenge.id} style={styles.challengeCard}>
              {challenge.thumbnail ? <Image source={{ uri: challenge.thumbnail }} style={styles.challengeImage} /> : null}
              <View style={styles.challengeCardHeader}>
                <View style={styles.challengeTitleWrap}>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  <Text style={styles.challengeCategory}>{challenge.category}</Text>
                </View>
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsText}>+{challenge.points} Points</Text>
                </View>
              </View>
              <Text style={styles.challengeDescription}>{challenge.description}</Text>
              <View style={styles.challengeMetaRow}>
                <Text style={styles.challengeMetaText}>{challenge.status}</Text>
                <Text style={styles.challengeMetaText}>{challenge.participantCount} joined</Text>
                <Text style={styles.challengeMetaText}>{challenge.completionCount} completed</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No {selectedDuration}-day challenges</Text>
            <Text style={styles.emptyText}>Use Add to create a new challenge for this duration.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Challenge</Text>
              <TouchableOpacity activeOpacity={0.88} onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                placeholder="Title"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={form.title}
                onChangeText={(value) => updateForm('title', value)}
              />
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Description"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={form.description}
                onChangeText={(value) => updateForm('description', value)}
                multiline
              />
              <TextInput
                style={styles.input}
                placeholder="Category"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={form.category}
                onChangeText={(value) => updateForm('category', value)}
              />
              <TextInput
                style={styles.input}
                placeholder="Thumbnail URL"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={String(form.thumbnail || '')}
                onChangeText={(value) => updateForm('thumbnail', value)}
              />
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>Duration comes from the selected top tab: {selectedDuration} Days.</Text>
                <Text style={styles.infoText}>Dashboard defaults: {form.points} points, {form.difficulty}, {form.status}.</Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              activeOpacity={0.88}
              onPress={() => void handleCreateChallenge()}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#04111F" /> : <Text style={styles.saveButtonText}>Create Challenge</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#081C47',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16233C',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    color: '#A8B4CC',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#22D3EE',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#04111F',
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  leadText: {
    color: '#D5DEF0',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  durationTabsRow: {
    gap: 10,
    paddingBottom: 8,
    marginBottom: 18,
  },
  durationTabPill: {
    minWidth: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#1F2940',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  durationTabPillActive: {
    backgroundColor: '#FF6A55',
    borderColor: '#FF8A75',
  },
  durationTabText: {
    color: '#C7D2E5',
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  durationTabTextActive: {
    color: '#fff',
  },
  challengeCard: {
    backgroundColor: '#343B4D',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  challengeImage: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#1F2937',
  },
  challengeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  challengeTitleWrap: {
    flex: 1,
  },
  challengeTitle: {
    color: '#fff',
    fontSize: 17,
    lineHeight: 23,
    fontFamily: 'Inter_700Bold',
  },
  challengeCategory: {
    marginTop: 4,
    color: '#F5A43C',
    fontSize: 12,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  pointsBadge: {
    backgroundColor: '#FFC233',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pointsText: {
    color: '#4C2A00',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  challengeDescription: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  challengeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  challengeMetaText: {
    color: '#D5DEF0',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 18,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  emptyText: {
    color: '#A8B4CC',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    fontFamily: 'Inter_400Regular',
  },
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  loadingText: {
    color: '#D5DEF0',
    fontFamily: 'Inter_500Medium',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,7,18,0.76)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  input: {
    borderRadius: 14,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  infoCard: {
    borderRadius: 14,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  infoText: {
    color: '#D5DEF0',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_500Medium',
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    color: '#D5DEF0',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 4,
    fontFamily: 'Inter_700Bold',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  optionPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#172033',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionPillActive: {
    backgroundColor: '#22D3EE',
    borderColor: '#22D3EE',
  },
  optionPillText: {
    color: '#D5DEF0',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  optionPillTextActive: {
    color: '#04111F',
  },
  saveButton: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: '#22D3EE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#04111F',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});
