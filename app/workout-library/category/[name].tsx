import React, { useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { formatAppError } from '../../../lib/error';
import { fetchWorkoutLibrary, WorkoutLibraryItem } from '../../../lib/workouts';
import { useLanguage } from '../../../lib/i18n';
import { ScreenState } from '../../../components/ScreenState';
import { useAsyncScreenData } from '../../../hooks/useAsyncScreenData';

const FALLBACK_WORKOUT_IMAGE = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80';

function safeImageUri(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  return normalized || FALLBACK_WORKOUT_IMAGE;
}

export default function WorkoutCategoryScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ name?: string }>();
  const categoryName = typeof params.name === 'string' ? params.name : t('CATEGORY');
  const {
    data: workouts,
    loading,
    error,
    reload,
  } = useAsyncScreenData<WorkoutLibraryItem[]>({
    initialData: [],
    load: async () => {
      const response = await fetchWorkoutLibrary(categoryName);
      const normalizedCategory = categoryName.trim().toLowerCase();
      return response.workouts.filter((workout) => workout.tag.trim().toLowerCase() === normalizedCategory);
    },
    getErrorMessage: (loadError) => formatAppError(loadError).message,
  });

  const title = useMemo(() => categoryName.toUpperCase(), [categoryName]);

  const openWorkout = (workout: WorkoutLibraryItem) => {
    router.push({
      pathname: '/workout-library/[id]',
      params: {
        id: workout.id,
        title: workout.title,
        vimeoId: workout.vimeoId,
        tag: workout.tag,
        thumbnail: workout.thumbnail,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>{t('CATEGORY')}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.headerMetaText}>{workouts.length}</Text>
          <Text style={styles.headerMetaLabel}>{t('VIDEOS')}</Text>
        </View>
      </View>

      {loading ? (
        <ScreenState mode="loading" message={t('Loading category workouts...')} spinnerColor={Colors.primary} />
      ) : error ? (
        <ScreenState mode="error" message={error} actionLabel={t('Try Again')} onAction={() => void reload()} />
      ) : workouts.length === 0 ? (
        <ScreenState
          mode="empty"
          iconName="videocam-off-outline"
          title={t('No videos in this category yet')}
          message={t('Add and publish workouts with the {categoryName} tag from the dashboard.', { categoryName })}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {workouts.map((workout) => (
            <TouchableOpacity
              key={workout.id}
              style={styles.workoutCard}
              activeOpacity={0.88}
              onPress={() => openWorkout(workout)}
            >
              <Image source={{ uri: safeImageUri(workout.thumbnail) }} style={styles.workoutImage} />
              <View style={styles.workoutOverlay} />
              <View style={styles.workoutContent}>
                <View style={styles.playBadge}>
                  <Ionicons name="play" size={12} color="#fff" />
                  <Text style={styles.playBadgeText}>{t('WATCH')}</Text>
                </View>
                <Text style={styles.workoutTitle} numberOfLines={2}>
                  {workout.title}
                </Text>
                <Text style={styles.workoutMeta}>{workout.tag} | {t('Video ready')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    color: Colors.primary,
    fontSize: 11,
    letterSpacing: 1.8,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  headerMeta: {
    minWidth: 64,
    alignItems: 'flex-end',
  },
  headerMetaText: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    lineHeight: 24,
  },
  headerMetaLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 16,
  },
  workoutCard: {
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#11182A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  workoutImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  workoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  workoutContent: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  playBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  playBadgeText: {
    color: '#fff',
    fontSize: 11,
    letterSpacing: 1.1,
    fontFamily: 'Inter_700Bold',
  },
  workoutTitle: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  workoutMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
