import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import VictoryHeader from '../../components/VictoryHeader';
import { fetchWorkoutLibrary, WorkoutLibraryCategory, WorkoutLibraryItem } from '../../lib/workouts';
import { formatAppError } from '../../lib/error';

const { width } = Dimensions.get('window');

function pairCategories(categories: WorkoutLibraryCategory[]) {
  const rows: WorkoutLibraryCategory[][] = [];
  for (let index = 0; index < categories.length; index += 2) {
    rows.push(categories.slice(index, index + 2));
  }
  return rows;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [library, setLibrary] = useState<{
    featuredWorkout: WorkoutLibraryItem | null;
    workouts: WorkoutLibraryItem[];
    categories: WorkoutLibraryCategory[];
  }>({
    featuredWorkout: null,
    workouts: [],
    categories: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadLibrary = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchWorkoutLibrary(searchQuery);
        if (!isMounted) {
          return;
        }
        setLibrary(response);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(formatAppError(loadError).message);
        setLibrary({
          featuredWorkout: null,
          workouts: [],
          categories: [],
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadLibrary();

    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      const response = await fetchWorkoutLibrary(searchQuery);
      setLibrary(response);
    } catch (refreshError) {
      setError(formatAppError(refreshError).message);
    } finally {
      setRefreshing(false);
    }
  };

  const featuredWorkout = library.featuredWorkout;
  const newAndPopular = useMemo(() => library.workouts.slice(0, 8), [library.workouts]);
  const categoryRows = useMemo(() => pairCategories(library.categories), [library.categories]);

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

  const openCategory = (category: WorkoutLibraryCategory) => {
    router.push({
      pathname: '/workout-library/category/[name]',
      params: {
        name: category.name,
      },
    });
  };

  const openAllCategories = () => {
    router.push('/workout-library/categories');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <VictoryHeader />

        <Text style={styles.pageTitle}>WORKOUTS</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search workouts..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.searchActions}>
            <TouchableOpacity style={styles.searchActionBtn} onPress={handleRefresh} disabled={refreshing}>
              {refreshing ? (
                <ActivityIndicator size="small" color={Colors.textMuted} />
              ) : (
                <Ionicons name="refresh-outline" size={20} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.searchActionBtn}
                onPress={() => setSearchQuery('')}
              >
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading workout library...</Text>
          </View>
        ) : (
          <>
            {featuredWorkout ? (
              <TouchableOpacity style={styles.heroCard} activeOpacity={0.9} onPress={() => openWorkout(featuredWorkout)}>
                <Image source={{ uri: featuredWorkout.thumbnail }} style={styles.heroImage} />
                <View style={styles.heroOverlay} />
                <View style={styles.heroContent}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>FEATURED WORKOUT</Text>
                  </View>
                  <Text style={styles.heroTitle}>{featuredWorkout.title}</Text>
                  <Text style={styles.heroMeta}>{featuredWorkout.tag} · Vimeo {featuredWorkout.vimeoId}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.emptyHero}>
                <Text style={styles.emptyHeroTitle}>No published workouts yet</Text>
                <Text style={styles.emptyHeroText}>Add and publish workouts from the dashboard to show them here.</Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, styles.popularSectionTitle]}>NEW &amp; POPULAR</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.popularScroll}
            >
              {newAndPopular.map((workout) => (
                <TouchableOpacity
                  key={workout.id}
                  style={styles.popularCard}
                  activeOpacity={0.88}
                  onPress={() => openWorkout(workout)}
                >
                  <Image source={{ uri: workout.thumbnail }} style={styles.popularImage} />
                  <View style={styles.popularOverlay} />
                  <View style={styles.popularContent}>
                    <Text style={styles.popularTitle} numberOfLines={2}>{workout.title}</Text>
                    <Text style={styles.popularMeta}>{workout.tag} · Vimeo {workout.vimeoId}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Pressable onPress={openAllCategories} style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { marginTop: 28 }]}>CATEGORIES</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
            <View style={styles.categoryGrid}>
              {categoryRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.categoryRow}>
                  {row.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={styles.categoryCard}
                      activeOpacity={0.85}
                      onPress={() => openCategory(category)}
                    >
                      <Image source={{ uri: category.image }} style={styles.categoryImage} />
                      <View style={styles.categoryOverlay} />
                      <View style={styles.categoryContent}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <Text style={styles.categoryCount}>{category.count} Workouts</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {row.length === 1 ? <View style={styles.categoryCardSpacer} /> : null}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 3,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    outlineStyle: 'none' as never,
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchActionBtn: {
    padding: 4,
  },
  errorCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    padding: 14,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    lineHeight: 19,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    height: 240,
    marginBottom: 28,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: 'Inter_700Bold',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  emptyHero: {
    marginHorizontal: 16,
    marginBottom: 28,
    borderRadius: 20,
    padding: 24,
    backgroundColor: '#10182B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyHeroTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  emptyHeroText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  popularSectionTitle: {
    paddingLeft: 16,
    marginBottom: 10,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popularScroll: {
    paddingLeft: 16,
    paddingRight: 6,
    gap: 14,
  },
  popularCard: {
    width: width * 0.62,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1A1A2E',
  },
  popularImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  popularOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  popularContent: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  popularTitle: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  popularMeta: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  categoryGrid: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    height: 130,
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
