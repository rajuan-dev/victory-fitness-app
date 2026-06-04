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
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { formatAppError } from '../../lib/error';
import { fetchWorkoutLibrary, WorkoutLibraryCategory } from '../../lib/workouts';
import { useLanguage } from '../../lib/i18n';
import { ScreenState } from '../../components/ScreenState';
import { useAsyncScreenData } from '../../hooks/useAsyncScreenData';

const FALLBACK_WORKOUT_IMAGE = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80';

function safeImageUri(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  return normalized || FALLBACK_WORKOUT_IMAGE;
}

function pairCategories(categories: WorkoutLibraryCategory[]) {
  const rows: WorkoutLibraryCategory[][] = [];
  for (let index = 0; index < categories.length; index += 2) {
    rows.push(categories.slice(index, index + 2));
  }
  return rows;
}

export default function WorkoutCategoriesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    data: categories,
    loading,
    error,
    reload,
  } = useAsyncScreenData<WorkoutLibraryCategory[]>({
    initialData: [],
    load: async () => {
      const response = await fetchWorkoutLibrary();
      return response.categories;
    },
    getErrorMessage: (loadError) => formatAppError(loadError).message,
  });

  const categoryRows = useMemo(() => pairCategories(categories), [categories]);

  const openCategory = (category: WorkoutLibraryCategory) => {
    router.push({
      pathname: '/workout-library/category/[name]',
      params: {
        name: category.name,
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
          <Text style={styles.headerEyebrow}>{t('WORKOUT LIBRARY')}</Text>
          <Text style={styles.headerTitle}>{t('CATEGORIES')}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ScreenState mode="loading" message={t('Loading categories...')} spinnerColor={Colors.primary} />
      ) : error ? (
        <ScreenState mode="error" message={error} actionLabel={t('Try Again')} onAction={() => void reload()} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {categoryRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.categoryRow}>
              {row.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryCard}
                  activeOpacity={0.85}
                  onPress={() => openCategory(category)}
                >
                  <Image source={{ uri: safeImageUri(category.image) }} style={styles.categoryImage} />
                  <View style={styles.categoryOverlay} />
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryCount}>{category.count} {t('Workouts')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {row.length === 1 ? <View style={styles.categoryCardSpacer} /> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  headerSpacer: {
    width: 42,
    height: 42,
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    color: Colors.primary,
    fontSize: 11,
    letterSpacing: 1.6,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
  },
  categoryCardSpacer: {
    flex: 1,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  categoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  categoryContent: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  categoryName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  categoryCount: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
