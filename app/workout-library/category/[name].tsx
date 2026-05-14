import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

const FALLBACK_WORKOUT_IMAGE = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80';

function safeImageUri(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  return normalized || FALLBACK_WORKOUT_IMAGE;
}

export default function WorkoutCategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const categoryName = typeof params.name === 'string' ? params.name : 'Category';
  const [workouts, setWorkouts] = useState<WorkoutLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadCategoryWorkouts = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchWorkoutLibrary(categoryName);
        if (!isMounted) {
          return;
        }

        const normalizedCategory = categoryName.trim().toLowerCase();
        const categoryWorkouts = response.workouts.filter((workout) => workout.tag.trim().toLowerCase() === normalizedCategory);
        setWorkouts(categoryWorkouts);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(formatAppError(loadError).message);
        setWorkouts([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCategoryWorkouts();

    return () => {
      isMounted = false;
    };
  }, [categoryName]);

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
          <Text style={styles.headerEyebrow}>CATEGORY</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.headerMetaText}>{workouts.length}</Text>
          <Text style={styles.headerMetaLabel}>VIDEOS</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateText}>Loading category workouts...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={34} color="#FCA5A5" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="videocam-off-outline" size={34} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No videos in this category yet</Text>
          <Text style={styles.stateText}>
            Add and publish workouts with the {categoryName} tag from the dashboard.
          </Text>
        </View>
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
                  <Text style={styles.playBadgeText}>WATCH</Text>
                </View>
                <Text style={styles.workoutTitle} numberOfLines={2}>
                  {workout.title}
                </Text>
                <Text style={styles.workoutMeta}>{workout.tag} | Video ready</Text>
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
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  stateText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
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
