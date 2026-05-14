import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import VictoryHeader from '../../components/VictoryHeader';
import { apiRequest } from '../../lib/api';
import { formatAppError } from '../../lib/error';
import {
  createNutritionPlan,
  NutritionPlanApiResponse,
  analyzeMealImage,
  getMealAnalysisHistory,
  MealImageAnalysisResponse,
  updateNutritionMealCompletion,
} from '../../lib/nutrition';

const TOTAL_STEPS = 8;
const PLAN_SUCCESS_SOUND = require('../../assets/sounds/plan-saved.wav');
const PLAN_SUCCESS_HOLD_MS = 2500;

const PLAN_LOADING_MESSAGES = [
  'Reviewing your goal, food preferences, and activity profile.',
  'Calculating a weekly calorie target aligned with your objective.',
  'Balancing protein, carbs, and fats across the full plan.',
  'Selecting meals that fit your chosen diet style.',
  'Adjusting portions to better match your daily energy needs.',
  'Filtering ingredients around your stated allergies and restrictions.',
  'Organizing breakfast, lunch, and dinner for each day.',
  'Checking meal variety to keep the plan practical through the week.',
  'Aligning meal choices with your preferred cuisine.',
  'Building a shopping list from the planned ingredients.',
  'Refining macro distribution for more consistent daily totals.',
  'Shaping meals to support training, recovery, and routine.',
  'Improving ingredient coverage across the weekly menu.',
  'Structuring the plan for easier day-by-day follow-through.',
  'Reviewing the plan for clarity and consistency.',
  'Preparing a cleaner saved result for your account.',
  'Validating the final nutrition data and meal structure.',
  'Assembling your weekly plan into a reusable format.',
  'Finalizing meals, macros, and shopping details.',
  'Saving your generated nutrition plan.',
];

const GOALS = [
  { id: 'g1', emoji: '🔥', label: 'Weight Loss & Fat Burn' },
  { id: 'g2', emoji: '💪', label: 'Build & Strengthen Muscles' },
  { id: 'g3', emoji: '⚡', label: 'Maintain Weight & Feel Fit' },
  { id: 'g4', emoji: '🧘', label: 'Improve Flexibility & Mobility' },
  { id: 'g5', emoji: '❤️', label: 'Boost Energy & Endurance' },
];

const DIET_PREFS = [
  { id: 'd1', emoji: '🌎', label: 'Everything' },
  { id: 'd2', emoji: '🌱', label: 'Vegetarian' },
  { id: 'd3', emoji: '🍎', label: 'Vegan' },
  { id: 'd4', emoji: '🥩', label: 'Keto / Low-Carb' },
  { id: 'd5', emoji: '🌾', label: 'Gluten-Free' },
  { id: 'd6', emoji: '🥜', label: 'Nut-Free' },
];

const ACTIVITY_LEVELS = [
  { id: 'a1', emoji: '🖥️', label: 'Sedentary (Office job)' },
  { id: 'a2', emoji: '🚶', label: 'Lightly active (Occasional walking)' },
  { id: 'a3', emoji: '🏃', label: 'Active (Regular movement)' },
  { id: 'a4', emoji: '🔧', label: 'Very active (Physical labor)' },
];

const GENDERS = ['Please select...', 'Male', 'Female', 'Non-binary', 'Prefer not to say'];

const HEALTH_CONDITIONS = [
  { id: 'h1', emoji: '❤️', label: 'High Blood Pressure' },
  { id: 'h2', emoji: '🩸', label: 'Diabetes' },
  { id: 'h3', emoji: '🍔', label: 'High Cholesterol' },
  { id: 'h4', emoji: '🔥', label: 'Inflammation' },
  { id: 'h5', emoji: '🛡️', label: 'Low Immunity' },
  { id: 'h6', emoji: '😵', label: 'Digestive Issues' },
];

function OptionList({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; emoji: string; label: string; sub?: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.optionList}>
      {items.map((item) => {
        const active = selected === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.optionCard, active && styles.optionCardActive]}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.optionEmoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{item.label}</Text>
              {item.sub ? <Text style={styles.optionSub}>{item.sub}</Text> : null}
            </View>
            {active && (
              <View style={styles.optionCheck}>
                <Ionicons name="checkmark" size={13} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Meal Plan Data ── */
const PLAN_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PLAN_TABS = ['My Plan', 'Tracker', 'Meal Analysis', 'Plan JSON'];

function getCurrentPlanDay() {
  const dayIndex = new Date().getDay();
  return PLAN_DAYS[(dayIndex + 6) % 7];
}

type MealEntry = { name: string; desc: string; kcal: number; p: number; c: number; f: number; ingredients: string[]; instructions?: string[]; };
type DayPlan = { breakfast: MealEntry; lunch: MealEntry; dinner: MealEntry; };
type NutritionProfile = {
  goal: string | null;
  cuisine: string;
  favoriteMeal: string;
  selectedDiet: string | null;
  allergies: string;
  selectedActivity: string | null;
  age: string;
  gender: string;
  height: string;
  weight: string;
  healthConditions: string[];
};

function mapPlanProfile(plan: NutritionPlanApiResponse | null): NutritionProfile | null {
  const rawProfile = plan?.profile;
  if (!rawProfile) {
    return null;
  }

  const healthConditions = Array.isArray(rawProfile.health_conditions)
    ? rawProfile.health_conditions.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    goal: typeof rawProfile.goal === 'string' ? rawProfile.goal : null,
    cuisine: typeof rawProfile.cuisine === 'string' ? rawProfile.cuisine : '',
    favoriteMeal: typeof rawProfile.favorite_meal === 'string' ? rawProfile.favorite_meal : '',
    selectedDiet: typeof rawProfile.diet === 'string' ? rawProfile.diet : null,
    allergies: typeof rawProfile.allergies === 'string' ? rawProfile.allergies : '',
    selectedActivity: typeof rawProfile.activity_level === 'string' ? rawProfile.activity_level : null,
    age: typeof rawProfile.age === 'string' ? rawProfile.age : '',
    gender: typeof rawProfile.gender === 'string' ? rawProfile.gender : 'Please select...',
    height: typeof rawProfile.height === 'string' ? rawProfile.height : '',
    weight: typeof rawProfile.weight === 'string' ? rawProfile.weight : '',
    healthConditions,
  };
}

const MEAL_PLAN: Record<string, DayPlan> = {
  Mon: {
    breakfast: { name: 'Oatmeal with Mashed Banana', desc: 'A small, comforting bowl of oats naturally sweetened.', kcal: 250, p: 4, c: 45, f: 5, ingredients: ['½ cup rolled oats', '1 ripe banana', '1 cup water', 'Pinch of cinnamon'] },
    lunch: { name: 'Rice and Mild Lentil Stew', desc: 'A balanced portion of complex carbs and plant protein.', kcal: 300, p: 8, c: 50, f: 5, ingredients: ['½ cup white rice', '½ cup red lentils', '1 tomato', '1 onion', 'Spices'], instructions: ['Rinse lentils and boil until soft.', 'Sauté onion and tomato, add lentils.', 'Serve over cooked rice.'] },
    dinner: { name: 'Chicken and Sweet Potato Mash', desc: 'Lean protein paired with vitamin-rich sweet potatoes.', kcal: 250, p: 8, c: 30, f: 6, ingredients: ['100g chicken breast', '1 medium sweet potato', '1 tsp olive oil', 'Salt, pepper, garlic'], instructions: ['Boil and mash sweet potato.', 'Grill chicken with spices.', 'Serve alongside mash.'] },
  },
  Tue: {
    breakfast: { name: 'Scrambled Eggs & Toast', desc: 'Classic protein-rich morning fuel.', kcal: 280, p: 14, c: 30, f: 10, ingredients: ['2 eggs', '1 slice whole-grain bread', '1 tsp butter', 'Salt & pepper'] },
    lunch: { name: 'Grilled Chicken Salad', desc: 'Fresh greens with grilled protein.', kcal: 320, p: 26, c: 15, f: 12, ingredients: ['120g chicken breast', 'Mixed greens', 'Cherry tomatoes', 'Cucumber', 'Olive oil dressing'], instructions: ['Grill chicken and slice.', 'Toss vegetables with dressing.', 'Top with chicken.'] },
    dinner: { name: 'Vegetable Stir Fry & Brown Rice', desc: 'Colorful vegetables with whole grain.', kcal: 270, p: 7, c: 48, f: 6, ingredients: ['½ cup brown rice', 'Bell peppers', 'Broccoli', 'Soy sauce', 'Garlic'], instructions: ['Cook brown rice.', 'Stir-fry vegetables in light oil.', 'Season and serve over rice.'] },
  },
  Wed: {
    breakfast: { name: 'Greek Yogurt & Berries', desc: 'Probiotic-rich with antioxidants.', kcal: 180, p: 12, c: 22, f: 4, ingredients: ['200g Greek yogurt', '½ cup mixed berries', '1 tsp honey'] },
    lunch: { name: 'Lentil Soup & Bread', desc: 'Hearty legume-based soup.', kcal: 310, p: 14, c: 52, f: 4, ingredients: ['1 cup lentils', 'Carrots', 'Celery', 'Onion', '1 slice bread'], instructions: ['Sauté vegetables.', 'Add lentils and broth.', 'Simmer 25 minutes.'] },
    dinner: { name: 'Baked Salmon & Veggies', desc: 'Omega-rich fish with roasted vegetables.', kcal: 340, p: 28, c: 18, f: 14, ingredients: ['120g salmon', 'Zucchini', 'Bell pepper', 'Olive oil', 'Lemon'], instructions: ['Preheat oven to 200°C.', 'Season salmon and vegetables.', 'Bake 20 mins together.'] },
  },
  Thu: {
    breakfast: { name: 'Smoothie Bowl', desc: 'Blended fruits with crunchy toppings.', kcal: 220, p: 6, c: 40, f: 5, ingredients: ['1 banana', '½ cup frozen berries', 'Almond milk', 'Granola', 'Chia seeds'] },
    lunch: { name: 'Tuna Wrap', desc: 'Protein-packed whole wheat wrap.', kcal: 350, p: 24, c: 38, f: 8, ingredients: ['1 can tuna', 'Whole wheat wrap', 'Lettuce', 'Tomato', 'Light mayo'], instructions: ['Mix tuna with light mayo.', 'Layer vegetables on wrap.', 'Roll tightly and serve.'] },
    dinner: { name: 'Beef & Vegetable Soup', desc: 'Lean beef in a hearty broth.', kcal: 290, p: 20, c: 28, f: 9, ingredients: ['100g lean beef', 'Potatoes', 'Carrots', 'Onion', 'Beef broth'], instructions: ['Brown beef cubes.', 'Add broth and vegetables.', 'Simmer 30 minutes.'] },
  },
  Fri: {
    breakfast: { name: 'Avocado Toast', desc: 'Healthy fats on whole grain bread.', kcal: 260, p: 7, c: 28, f: 14, ingredients: ['1 avocado', '2 slices bread', 'Lemon juice', 'Red pepper flakes'] },
    lunch: { name: 'Chickpea Curry', desc: 'Plant protein in aromatic spices.', kcal: 330, p: 12, c: 50, f: 8, ingredients: ['1 can chickpeas', 'Tomatoes', 'Coconut milk', 'Curry powder', 'Rice'], instructions: ['Saute spices.', 'Add chickpeas and tomatoes.', 'Simmer with coconut milk 15 mins.'] },
    dinner: { name: 'Shrimp & Quinoa Bowl', desc: 'Light seafood with complete protein grain.', kcal: 310, p: 22, c: 35, f: 8, ingredients: ['150g shrimp', '½ cup quinoa', 'Spinach', 'Garlic', 'Olive oil'], instructions: ['Cook quinoa.', 'Saute garlic and shrimp.', 'Serve over quinoa with spinach.'] },
  },
  Sat: {
    breakfast: { name: 'Pancakes with Fruit', desc: 'Whole grain pancakes with fresh fruit.', kcal: 320, p: 9, c: 55, f: 7, ingredients: ['1 cup whole wheat flour', '1 egg', 'Milk', 'Baking powder', 'Mixed berries'] },
    lunch: { name: 'Turkey & Vegetable Sandwich', desc: 'Lean turkey on seeded bread.', kcal: 340, p: 22, c: 38, f: 9, ingredients: ['100g turkey breast', 'Seeded bread', 'Lettuce', 'Tomato', 'Mustard'], instructions: ['Layer turkey and vegetables.', 'Add condiments.', 'Serve with salad.'] },
    dinner: { name: 'Pasta Primavera', desc: 'Whole grain pasta with garden vegetables.', kcal: 380, p: 12, c: 65, f: 8, ingredients: ['80g whole grain pasta', 'Zucchini', 'Cherry tomatoes', 'Basil', 'Parmesan'], instructions: ['Cook pasta al dente.', 'Saute vegetables in olive oil.', 'Toss together with basil.'] },
  },
  Sun: {
    breakfast: { name: 'French Toast', desc: 'Egg-soaked bread with cinnamon.', kcal: 290, p: 10, c: 42, f: 9, ingredients: ['2 slices bread', '2 eggs', 'Milk', 'Cinnamon', 'Maple syrup'] },
    lunch: { name: 'Bean & Vegetable Burrito', desc: 'Fibre-rich bean burrito.', kcal: 360, p: 14, c: 58, f: 8, ingredients: ['1 whole wheat tortilla', '½ cup black beans', 'Brown rice', 'Peppers', 'Salsa'], instructions: ['Warm beans and rice.', 'Layer in tortilla with peppers.', 'Roll and enjoy.'] },
    dinner: { name: 'Roast Chicken & Steamed Broc', desc: 'Simple roasted protein with greens.', kcal: 300, p: 26, c: 12, f: 11, ingredients: ['120g chicken thigh', 'Broccoli', 'Garlic', 'Olive oil', 'Herbs'], instructions: ['Roast chicken at 200C 30 mins.', 'Steam broccoli 5-7 mins.', 'Serve with lemon juice.'] },
  },
};

/* ── MealPlanResult Component ── */
function MealPlanResult({
  profile,
  initialPlan,
  onCreateNewPlan,
}: {
  profile: NutritionProfile;
  initialPlan?: NutritionPlanApiResponse | null;
  onCreateNewPlan: () => void;
}) {
  const [planTab, setPlanTab] = useState('My Plan');
  const [activeDay, setActiveDay] = useState(() => getCurrentPlanDay());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showShopping, setShowShopping] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [generatedPlan, setGeneratedPlan] = useState<NutritionPlanApiResponse | null>(initialPlan ?? null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [nutritionAdvice, setNutritionAdvice] = useState('');
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [mealCompletions, setMealCompletions] = useState<Record<string, boolean>>({});
  const [selectedMeal, setSelectedMeal] = useState<{ day: string; mealLabel: string; mealKey: string; meal: MealEntry; expandKey: string } | null>(null);
  const [mealModalActionState, setMealModalActionState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [mealModalActionMode, setMealModalActionMode] = useState<'complete' | 'unmark'>('complete');
  const [analysisImage, setAnalysisImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MealImageAnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisHistory, setAnalysisHistory] = useState<MealImageAnalysisResponse[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<MealImageAnalysisResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      setActiveDay(getCurrentPlanDay());
    }, [])
  );

  const normalizeMealCompletions = (plan: NutritionPlanApiResponse | null | undefined) => {
    const entries = plan?.meal_completions ?? {};
    const flat: Record<string, boolean> = {};

    Object.entries(entries).forEach(([day, meals]) => {
      if (!meals || typeof meals !== 'object') {
        return;
      }

      Object.entries(meals).forEach(([mealKey, completed]) => {
        flat[mealCompletionKey(day, mealKey)] = Boolean(completed);
      });
    });

    return flat;
  };

  useEffect(() => {
    let cancelled = false;

    if (initialPlan) {
      setGeneratedPlan(initialPlan);
      setMealCompletions(normalizeMealCompletions(initialPlan));
      setLoadingPlan(false);
      return () => {
        cancelled = true;
      };
    }

    const loadPlan = async () => {
      setLoadingPlan(true);
      try {
        const response = await apiRequest<NutritionPlanApiResponse>('/ai/nutrition/plan/latest');
        if (!cancelled) {
          setGeneratedPlan(response);
          setMealCompletions(normalizeMealCompletions(response));
        }
      } catch {
        if (!cancelled) {
          setGeneratedPlan(null);
          setMealCompletions({});
        }
      } finally {
        if (!cancelled) {
          setLoadingPlan(false);
        }
      }
    };

    loadPlan();

    return () => {
      cancelled = true;
    };
  }, [
    initialPlan,
    profile.goal,
    profile.cuisine,
    profile.favoriteMeal,
    profile.selectedDiet,
    profile.allergies,
    profile.selectedActivity,
    profile.age,
    profile.gender,
    profile.height,
    profile.weight,
    profile.healthConditions.join(','),
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadMealAnalysisHistory = async () => {
      try {
        const response = await getMealAnalysisHistory();
        if (!cancelled) {
          setAnalysisHistory(Array.isArray(response.analyses) ? response.analyses : []);
        }
      } catch {
        if (!cancelled) {
          setAnalysisHistory([]);
        }
      }
    };

    loadMealAnalysisHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCheck = (key: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleExpand = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  const mealCompletionKey = (day: string, mealKey: string) => `${day}-${mealKey}`;
  const isMealComplete = (day: string, mealKey: string) => Boolean(mealCompletions[mealCompletionKey(day, mealKey)]);
  const setMealCompletion = async (day: string, mealKey: string, completed: boolean) => {
    try {
      const updatedPlan = await updateNutritionMealCompletion({
        day,
        meal_key: mealKey,
        completed,
      });
      setGeneratedPlan(updatedPlan);
      setMealCompletions(normalizeMealCompletions(updatedPlan));
    } catch {
      setMealCompletions((prev) => ({
        ...prev,
        [mealCompletionKey(day, mealKey)]: completed,
      }));
    }
  };
  const openMealModal = (day: string, mealKey: string, mealLabel: string, meal: MealEntry, expandKey: string) => {
    const cardKey = mealCompletionKey(day, mealKey);
    setMealModalActionState('idle');
    setMealModalActionMode(isMealComplete(day, mealKey) ? 'unmark' : 'complete');
    setSelectedMeal((prev) =>
      prev && mealCompletionKey(prev.day, prev.mealKey) === cardKey ? null : { day, mealLabel, mealKey, meal, expandKey }
    );
  };
  const closeMealModal = () => {
    setSelectedMeal(null);
    setMealModalActionState('idle');
    setMealModalActionMode('complete');
  };
  const confirmMealCompletion = async (nextCompleted: boolean) => {
    if (!selectedMeal || mealModalActionState !== 'idle') {
      return;
    }

    setMealModalActionState('loading');
    await setMealCompletion(selectedMeal.day, selectedMeal.mealKey, nextCompleted);
    setMealModalActionState('done');

    setTimeout(() => {
      closeMealModal();
    }, 650);
  };

  const generatedDays = Array.isArray(generatedPlan?.days) ? generatedPlan.days : [];
  const activePlan = generatedDays.length > 0
    ? generatedDays.reduce<Record<string, DayPlan>>((acc, day) => {
        if (!day?.day || !day.breakfast || !day.lunch || !day.dinner) {
          return acc;
        }

        acc[day.day] = {
          breakfast: day.breakfast,
          lunch: day.lunch,
          dinner: day.dinner,
        };
        return acc;
      }, {})
    : MEAL_PLAN;
  const activeShoppingList = Array.isArray(generatedPlan?.shopping_list) ? generatedPlan.shopping_list : [];
  const day = activePlan[activeDay] ?? MEAL_PLAN[activeDay];
  const dayMealStatuses = [
    { key: 'breakfast', label: 'Breakfast', meal: day.breakfast, completed: isMealComplete(activeDay, 'breakfast') },
    { key: 'lunch', label: 'Lunch', meal: day.lunch, completed: isMealComplete(activeDay, 'lunch') },
    { key: 'dinner', label: 'Dinner', meal: day.dinner, completed: isMealComplete(activeDay, 'dinner') },
  ];
  const completedMealsCount = dayMealStatuses.filter((item) => item.completed).length;
  const completedDayTotals = dayMealStatuses
    .filter((item) => item.completed)
    .reduce(
      (acc, item) => ({
        kcal: acc.kcal + item.meal.kcal,
        p: acc.p + item.meal.p,
        c: acc.c + item.meal.c,
        f: acc.f + item.meal.f,
      }),
      { kcal: 0, p: 0, c: 0, f: 0 }
    );
  const totalKcal = day.breakfast.kcal + day.lunch.kcal + day.dinner.kcal;
  const totalP = day.breakfast.p + day.lunch.p + day.dinner.p;
  const totalC = day.breakfast.c + day.lunch.c + day.dinner.c;
  const totalF = day.breakfast.f + day.lunch.f + day.dinner.f;
  const adviceItems = nutritionAdvice
    .split(/\r?\n+/)
    .map((item) => item.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  const goalLabel = generatedPlan?.goal_label ?? (profile.goal === 'g1' ? 'Weight Loss'
    : profile.goal === 'g2' ? 'Muscle Building'
      : profile.goal === 'g3' ? 'Weight Maintenance'
        : profile.goal === 'g4' ? 'Flexibility'
          : 'Endurance');
  const planJson = generatedPlan
    ? JSON.stringify(generatedPlan, null, 2)
    : JSON.stringify(
        {
          summary: 'No generated plan is loaded yet.',
          goal_label: goalLabel,
          days: PLAN_DAYS.map((planDay) => ({
            day: planDay,
            ...MEAL_PLAN[planDay],
          })),
          shopping_list: [],
        },
        null,
        2
      );

  const handleGetSuggestions = async () => {
    setLoadingAdvice(true);
    try {
      const response = await apiRequest<{ reply: string }>('/ai/nutrition/advice', {
        method: 'POST',
        body: {
          goal: profile.goal,
          meal_query: '',
          daily_calories: totalKcal,
          daily_protein: totalP,
          daily_carbs: totalC,
          daily_fat: totalF,
          cuisine: profile.cuisine,
          favorite_meal: profile.favoriteMeal,
          allergies: profile.allergies,
        },
      });
      setNutritionAdvice(response.reply);
    } catch (error) {
      setNutritionAdvice(error instanceof Error ? error.message : 'Unable to load nutrition suggestions right now.');
    } finally {
      setLoadingAdvice(false);
    }
  };
  const handleStartAnalysis = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow camera access to take a meal photo for analysis.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.35,
        cameraType: ImagePicker.CameraType.back,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setAnalysisImage(asset);
        setAnalysisError('');
        setAnalysisResult(null);

        if (!asset.base64) {
          throw new Error('The selected image could not be read for analysis.');
        }

        setAnalysisLoading(true);
        try {
          const response = await analyzeMealImage({
            image_base64: asset.base64,
            mime_type: asset.mimeType ?? 'image/jpeg',
            file_name: asset.fileName ?? null,
          });
          setAnalysisResult(response);
          setAnalysisHistory((prev) => [response, ...prev.filter((item) => item.analysis_id !== response.analysis_id)]);
        } catch (analysisErr) {
          setAnalysisError(formatAppError(analysisErr).message);
        } finally {
          setAnalysisLoading(false);
        }
      }
    } catch (error) {
      Alert.alert('Camera error', error instanceof Error ? error.message : 'Unable to open the camera right now.');
      setAnalysisLoading(false);
    }
  };

  const MealCard = ({
    dayLabel,
    mealKey,
    label,
    meal,
    expandKey,
  }: {
    dayLabel: string;
    mealKey: string;
    label: string;
    meal: MealEntry;
    expandKey: string;
  }) => {
    const completed = isMealComplete(dayLabel, mealKey);

    return (
      <View style={styles.mealCardWrap}>
        <TouchableOpacity
          style={styles.mealCard}
          onPress={() => openMealModal(dayLabel, mealKey, label, meal, expandKey)}
          activeOpacity={0.9}
        >
          <Text style={styles.mealLabel}>{label}</Text>
          {completed ? <Text style={styles.mealCompleteBadge}>COMPLETED</Text> : null}
          <Text style={styles.mealName}>{meal.name}</Text>
          <Text style={styles.mealDesc}>{meal.desc}</Text>
          <View style={styles.mealMacroRow}>
            <View style={styles.macroChip}><Text>🔥</Text><Text style={[styles.macroChipText, { color: '#F97316' }]}>{meal.kcal} kcal</Text></View>
            <View style={styles.macroChip}><Text>💪</Text><Text style={[styles.macroChipText, { color: '#4F8EF7' }]}>{meal.p}g P</Text></View>
            <View style={styles.macroChip}><Text>🌾</Text><Text style={[styles.macroChipText, { color: '#22C55E' }]}>{meal.c}g C</Text></View>
            <View style={styles.macroChip}><Text>🥑</Text><Text style={[styles.macroChipText, { color: '#F59E0B' }]}>{meal.f}g F</Text></View>
          </View>
          <View style={styles.mealHintRow}>
            <Text style={styles.mealHintText}>Tap card for actions</Text>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  /* Shopping List Screen */
  if (showShopping) {
    const totalItems = activeShoppingList.reduce((s, cat) => s + cat.items.length, 0);
    const checkedCount = checkedItems.size;
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.slHeader}>
          <TouchableOpacity onPress={() => setShowShopping(false)} style={styles.slBackBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.slTitle}>Weekly Shopping List</Text>
            <Text style={styles.slSubtitle}>{checkedCount} of {totalItems} items checked</Text>
          </View>
          <TouchableOpacity onPress={() => setCheckedItems(new Set())} style={styles.slClearBtn}>
            <Text style={styles.slClearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={styles.slProgressBg}>
          <View style={[styles.slProgressFill, { width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%`, backgroundColor: Colors.accentPurple }]} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.slScroll}>
          {activeShoppingList.length > 0 ? activeShoppingList.map((section) => (
            <View key={section.category}>
              <Text style={styles.slCategoryHeader}>{section.category}</Text>
              <View style={styles.slSection}>
                {section.items.map((item, i) => {
                  const key = `${section.category}-${item.name}`;
                  const checked = checkedItems.has(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.slRow, i !== section.items.length - 1 && styles.slRowBorder]}
                      onPress={() => toggleCheck(key)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.slCheckBox, checked && styles.slCheckBoxActive]}>
                        {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <Text style={[styles.slItemName, checked && styles.slItemNameChecked]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.slItemQty, checked && styles.slItemQtyChecked]}>
                        {item.qty}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )) : (
            <View style={styles.analysisEmptyCard}>
              <Ionicons name="basket-outline" size={32} color="rgba(255,255,255,0.35)" />
              <Text style={styles.analysisEmptyText}>No shopping list yet</Text>
              <Text style={styles.analysisEmptySub}>
                Generate a nutrition plan to load the shopping list from the saved plan data.
              </Text>
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Fixed Copy List Button */}
        <View style={styles.slBottomBar}>
          <TouchableOpacity
            style={styles.slCopyBtn}
            activeOpacity={0.85}
            onPress={() => { }}
          >
            <View style={[styles.slCopyBtnGrad, { backgroundColor: Colors.accentPurple }]}>
              <Ionicons name="copy-outline" size={18} color="#fff" />
              <Text style={styles.slCopyBtnText}>Copy List</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <VictoryHeader />

        {loadingPlan && (
          <View style={styles.planLoading}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.planLoadingText}>Building your nutrition plan...</Text>
          </View>
        )}

        {/* Tab Bar */}
        <View style={styles.planTabRow}>
          {PLAN_TABS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.planTabBtn, planTab === t && styles.planTabBtnActive]}
              onPress={() => setPlanTab(t)}
            >
              <Text style={[styles.planTabText, planTab === t && styles.planTabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── MY PLAN ── */}
        {planTab === 'My Plan' && !loadingPlan && (
          <View style={styles.planContent}>
            <Text style={styles.planTitle}>7-DAY TAILORED {goalLabel.toUpperCase()} PLAN</Text>
            <Text style={styles.planDesc}>
              {generatedPlan?.summary ?? 'A carefully portion-controlled nutrition plan designed for you, with practical meals that match your goal.'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
              {PLAN_DAYS.map((d) => (
                <TouchableOpacity key={d} style={[styles.dayBtn, activeDay === d && styles.dayBtnActive]} onPress={() => setActiveDay(d)}>
                  <Text style={[styles.dayBtnText, activeDay === d && styles.dayBtnTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.dayUnderline} />
            <View style={styles.totalsCard}>
              <Text style={styles.totalsTitle}>Daily Totals</Text>
              <View style={styles.totalsGrid}>
                <View style={styles.totalsItem}><Text style={styles.totalsIcon}>🔥</Text><Text style={styles.totalsVal}>{totalKcal} kcal</Text></View>
                <View style={styles.totalsItem}><Text style={styles.totalsIcon}>💪</Text><Text style={styles.totalsVal}>{totalP}g P</Text></View>
                <View style={styles.totalsItem}><Text style={styles.totalsIcon}>🌾</Text><Text style={styles.totalsVal}>{totalC}g C</Text></View>
                <View style={styles.totalsItem}><Text style={styles.totalsIcon}>🫒</Text><Text style={styles.totalsVal}>{totalF}g F</Text></View>
              </View>
            </View>
            <MealCard dayLabel={activeDay} mealKey="breakfast" label="Breakfast" meal={day.breakfast} expandKey={`${activeDay}-b`} />
            <MealCard dayLabel={activeDay} mealKey="lunch" label="Lunch" meal={day.lunch} expandKey={`${activeDay}-l`} />
            <MealCard dayLabel={activeDay} mealKey="dinner" label="Dinner" meal={day.dinner} expandKey={`${activeDay}-d`} />
            <TouchableOpacity style={styles.shoppingBtn} activeOpacity={0.85} onPress={() => setShowShopping(true)}>
              <View style={[styles.shoppingBtnGrad, { backgroundColor: Colors.accentPurple }]}>
                <Text style={styles.shoppingBtnText}>Weekly Shopping List</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.newPlanBtn} activeOpacity={0.7} onPress={onCreateNewPlan}>
              <Text style={styles.newPlanBtnText}>Create New Plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TRACKER ── */}
        {planTab === 'Tracker' && (
          <View style={styles.planContent}>
            {/* Daily Summary */}
            <View style={styles.trackerSection}>
              <View style={styles.trackerSectionHeader}>
                <Text style={styles.trackerSectionIcon}>📊</Text>
                <Text style={styles.trackerSectionTitle}>DAILY SUMMARY</Text>
              </View>
              <View style={styles.dailyMetricGrid}>
                <View style={styles.dailyMetricCard}>
                  <Text style={styles.dailyMetricEmoji}>🔥</Text>
                  <Text style={styles.dailyMetricLabel}>Calories</Text>
                  <Text style={styles.dailyMetricValue}>{completedDayTotals.kcal} / {totalKcal} kcal</Text>
                </View>
                <View style={styles.dailyMetricCard}>
                  <Text style={styles.dailyMetricEmoji}>💪</Text>
                  <Text style={styles.dailyMetricLabel}>Protein</Text>
                  <Text style={styles.dailyMetricValue}>{completedDayTotals.p} / {totalP}g P</Text>
                </View>
                <View style={styles.dailyMetricCard}>
                  <Text style={styles.dailyMetricEmoji}>🌾</Text>
                  <Text style={styles.dailyMetricLabel}>Carbs</Text>
                  <Text style={styles.dailyMetricValue}>{completedDayTotals.c} / {totalC}g C</Text>
                </View>
                <View style={styles.dailyMetricCard}>
                  <Text style={styles.dailyMetricEmoji}>🥑</Text>
                  <Text style={styles.dailyMetricLabel}>Fat</Text>
                  <Text style={styles.dailyMetricValue}>{completedDayTotals.f} / {totalF}g F</Text>
                </View>
              </View>
              <Text style={styles.trackerProgressText}>
                {completedMealsCount} of {dayMealStatuses.length} meals complete for {activeDay}.
              </Text>
            </View>

            {/* AI Suggestions */}
            <View style={styles.trackerSection}>
              <View style={styles.trackerSectionHeader}>
                <Text style={styles.trackerSectionIcon}>✨</Text>
                <Text style={styles.trackerSectionTitle}>AI SUGGESTIONS</Text>
              </View>
              <TouchableOpacity style={styles.getSuggestionsBtn} activeOpacity={0.85} onPress={handleGetSuggestions} disabled={loadingAdvice}>
                {loadingAdvice ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.getSuggestionsBtnText}>GET SUGGESTIONS</Text>
                )}
              </TouchableOpacity>
              {nutritionAdvice ? (
                <View style={styles.advicePanel}>
                  <View style={styles.advicePanelHeader}>
                    <View>
                      <Text style={styles.advicePanelEyebrow}>TODAY'S COACHING</Text>
                      <Text style={styles.advicePanelTitle}>Practical actions for {activeDay}</Text>
                    </View>
                    <View style={styles.advicePanelPill}>
                      <Text style={styles.advicePanelPillText}>{adviceItems.length || 1} tips</Text>
                    </View>
                  </View>
                  {adviceItems.length > 0 ? (
                    <View style={styles.adviceList}>
                      {adviceItems.map((item, index) => (
                        <View key={`${item}-${index}`} style={styles.adviceItem}>
                          <View style={styles.adviceBullet}>
                            <Text style={styles.adviceBulletText}>{index + 1}</Text>
                          </View>
                          <Text style={styles.adviceItemText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.adviceFallbackText}>{nutritionAdvice}</Text>
                  )}
                </View>
              ) : null}
            </View>

          </View>
        )}

        {/* ── MEAL ANALYSIS ── */}
        {planTab === 'Meal Analysis' && (
          <View style={styles.planContent}>
            <View style={[styles.analysisCard, { backgroundColor: Colors.accentPurple }]}>
              <Ionicons name="analytics-outline" size={40} color="#fff" style={{ opacity: 0.3, marginBottom: 12 }} />
              <Text style={styles.analysisTitle}>AI MEAL ANALYSIS</Text>
              <Text style={styles.analysisDesc}>Take a photo of your meal to get instant macro tracking and health feedback.</Text>
              <TouchableOpacity style={styles.analysisBtn} onPress={handleStartAnalysis} activeOpacity={0.85}>
                <Text style={styles.analysisBtnText}>Start Analysis</Text>
              </TouchableOpacity>
            </View>

            {analysisImage ? (
              <View style={styles.analysisPreviewCard}>
                <Image source={{ uri: analysisImage.uri }} style={styles.analysisPreviewImage} />
                <View style={styles.analysisPreviewMeta}>
                  <Text style={styles.analysisPreviewLabel}>Selected image</Text>
                  <Text style={styles.analysisPreviewText} numberOfLines={1}>
                    {analysisImage.fileName ?? 'Meal photo'}
                  </Text>
                </View>
              </View>
            ) : null}

            {analysisImage ? (
              <View style={styles.analysisResultCard}>
                {analysisLoading ? (
                  <View style={styles.analysisLoadingRow}>
                    <ActivityIndicator color={Colors.primary} />
                    <Text style={styles.analysisLoadingText}>Analyzing your meal photo...</Text>
                  </View>
                ) : analysisResult ? (
                  <>
                    <View style={styles.analysisResultHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.analysisResultLabel}>Meal analysis</Text>
                        <Text style={styles.analysisResultTitle}>{analysisResult.meal_name_guess}</Text>
                      </View>
                      <View style={styles.analysisConfidencePill}>
                        <Text style={styles.analysisConfidenceText}>{analysisResult.confidence}</Text>
                      </View>
                    </View>
                    <Text style={styles.analysisResultSummary}>{analysisResult.summary}</Text>
                    <View style={styles.analysisResultGrid}>
                      <View style={styles.analysisResultMetric}>
                        <Text style={styles.analysisResultMetricLabel}>Calories</Text>
                        <Text style={styles.analysisResultMetricValue}>{analysisResult.estimated_calories}</Text>
                      </View>
                      <View style={styles.analysisResultMetric}>
                        <Text style={styles.analysisResultMetricLabel}>Protein</Text>
                        <Text style={styles.analysisResultMetricValue}>{analysisResult.estimated_protein}g</Text>
                      </View>
                      <View style={styles.analysisResultMetric}>
                        <Text style={styles.analysisResultMetricLabel}>Carbs</Text>
                        <Text style={styles.analysisResultMetricValue}>{analysisResult.estimated_carbs}g</Text>
                      </View>
                      <View style={styles.analysisResultMetric}>
                        <Text style={styles.analysisResultMetricLabel}>Fat</Text>
                        <Text style={styles.analysisResultMetricValue}>{analysisResult.estimated_fat}g</Text>
                      </View>
                    </View>
                    {analysisResult.notes.length > 0 ? (
                      <View style={styles.analysisNotesBlock}>
                        {analysisResult.notes.map((note, index) => (
                          <Text key={`${note}-${index}`} style={styles.analysisNoteItem}>
                            • {note}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : analysisError ? (
                  <Text style={styles.analysisErrorText}>{analysisError}</Text>
                ) : (
                  <Text style={styles.analysisEmptySub}>
                    Capture a meal image to see the analysis here.
                  </Text>
                )}
              </View>
            ) : null}

            <View style={styles.analysisHistoryCard}>
              <View style={styles.analysisHistoryHeader}>
                <Text style={styles.analysisHistoryTitle}>Saved Analyses</Text>
                <Text style={styles.analysisHistoryCount}>{analysisHistory.length}</Text>
              </View>
              {analysisHistory.length > 0 ? (
                analysisHistory.map((item, index) => (
                  <TouchableOpacity
                    key={item.analysis_id ?? `${item.meal_name_guess}-${index}`}
                    style={styles.analysisHistoryRow}
                    activeOpacity={0.85}
                    onPress={() => setSelectedAnalysis(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.analysisHistoryRowTitle}>{item.meal_name_guess}</Text>
                      <Text style={styles.analysisHistoryRowMeta} numberOfLines={1}>
                        {item.created_at ? new Date(item.created_at).toLocaleString() : item.file_name ?? 'Saved analysis'}
                      </Text>
                    </View>
                    <View style={styles.analysisHistoryRowPill}>
                      <Text style={styles.analysisHistoryRowPillText}>{item.estimated_calories} kcal</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.analysisEmptySub}>
                  Your saved meal analyses will appear here after you run them.
                </Text>
              )}
            </View>

            {!analysisImage ? (
              <View style={styles.analysisEmptyCard}>
                <Ionicons name="camera-outline" size={40} color="rgba(255,255,255,0.2)" />
                <Text style={styles.analysisEmptyText}>No analysis yet</Text>
                <Text style={styles.analysisEmptySub}>
                  Upload a photo of your meal and our AI will break down the calories, protein, carbs and fats.
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {planTab === 'Plan JSON' && (
          <View style={styles.planContent}>
            <Text style={styles.planTitle}>Generated Plan JSON</Text>
            <Text style={styles.planDesc}>
              Complete nutrition plan data received by the app, including every day, meal, macro, ingredient, instruction, and shopping list item.
            </Text>
            <View style={styles.jsonCard}>
              <Text selectable style={styles.jsonText}>{planJson}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal
        visible={Boolean(selectedMeal)}
        animationType="slide"
        transparent
        onRequestClose={closeMealModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {mealModalActionState !== 'idle' && (
              <View style={styles.modalActionOverlay}>
                <View style={styles.modalActionOverlayCard}>
                  {mealModalActionState === 'loading' ? (
                    <ActivityIndicator color={Colors.primary} size="large" />
                  ) : (
                    <Ionicons name="checkmark-circle" size={44} color="#22C55E" />
                  )}
                  <Text style={styles.modalActionOverlayText}>
                    {mealModalActionState === 'loading' ? 'Updating meal...' : 'Saved'}
                  </Text>
                </View>
              </View>
            )}
            <Text style={styles.modalEyebrow}>MEAL DETAILS</Text>
            <Text style={styles.modalTitle}>{selectedMeal?.mealLabel ?? 'Meal'}</Text>
            <Text style={styles.modalSubtitle}>
              Tap complete after you finish this meal. The daily summary updates automatically.
            </Text>

            {selectedMeal ? (
              <View style={styles.modalMealCard}>
                <Text style={styles.modalMealName}>{selectedMeal.meal.name}</Text>
                <Text style={styles.modalMealDesc}>{selectedMeal.meal.desc}</Text>
                <View style={styles.mealMacroRow}>
                  <View style={styles.macroChip}><Text>🔥</Text><Text style={[styles.macroChipText, { color: '#F97316' }]}>{selectedMeal.meal.kcal} kcal</Text></View>
                  <View style={styles.macroChip}><Text>💪</Text><Text style={[styles.macroChipText, { color: '#4F8EF7' }]}>{selectedMeal.meal.p}g P</Text></View>
                  <View style={styles.macroChip}><Text>🌾</Text><Text style={[styles.macroChipText, { color: '#22C55E' }]}>{selectedMeal.meal.c}g C</Text></View>
                  <View style={styles.macroChip}><Text>🥑</Text><Text style={[styles.macroChipText, { color: '#F59E0B' }]}>{selectedMeal.meal.f}g F</Text></View>
                </View>
                <TouchableOpacity style={styles.expandRow} onPress={() => toggleExpand(`${selectedMeal.expandKey}-ing`)}>
                  <Text style={styles.expandLabel}>Ingredients</Text>
                  <Ionicons name={expanded[`${selectedMeal.expandKey}-ing`] ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
                {expanded[`${selectedMeal.expandKey}-ing`] && (
                  <View style={styles.expandContent}>
                    {selectedMeal.meal.ingredients.map((ing, i) => <Text key={i} style={styles.expandItem}>• {ing}</Text>)}
                  </View>
                )}
                {selectedMeal.meal.instructions && selectedMeal.meal.instructions.length > 0 && (
                  <>
                    <View style={styles.expandDivider} />
                    <TouchableOpacity style={styles.expandRow} onPress={() => toggleExpand(`${selectedMeal.expandKey}-inst`)}>
                      <Text style={styles.expandLabel}>Instructions</Text>
                      <Ionicons name={expanded[`${selectedMeal.expandKey}-inst`] ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                    {expanded[`${selectedMeal.expandKey}-inst`] && (
                      <View style={styles.expandContent}>
                        {selectedMeal.meal.instructions.map((inst, i) => <Text key={i} style={styles.expandItem}>{i + 1}. {inst}</Text>)}
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : null}

            {selectedMeal && isMealComplete(selectedMeal.day, selectedMeal.mealKey) ? (
              <>
                <TouchableOpacity
                  style={[styles.modalCompleteBtn, styles.modalCompleteBtnDone]}
                  activeOpacity={0.9}
                  disabled
                >
                  <Ionicons name="checkmark-circle" size={18} color="#050816" />
                  <Text style={[styles.modalCompleteBtnText, styles.modalCompleteBtnTextDone]}>
                    Already complete
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSecondaryActionBtn}
                  activeOpacity={0.85}
                  onPress={() => confirmMealCompletion(false)}
                  disabled={mealModalActionState !== 'idle'}
                >
                  {mealModalActionState === 'loading' && mealModalActionMode === 'unmark' ? (
                    <ActivityIndicator color={Colors.textMuted} />
                  ) : mealModalActionState === 'done' && mealModalActionMode === 'unmark' ? (
                    <Ionicons name="checkmark" size={18} color="#22C55E" />
                  ) : (
                    <Text style={styles.modalSecondaryActionText}>Unmark meal</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.modalCompleteBtn}
                activeOpacity={0.9}
                onPress={() => confirmMealCompletion(true)}
                disabled={mealModalActionState !== 'idle'}
              >
                {mealModalActionState === 'loading' && mealModalActionMode === 'complete' ? (
                  <ActivityIndicator color="#050816" />
                ) : mealModalActionState === 'done' && mealModalActionMode === 'complete' ? (
                  <Ionicons name="checkmark" size={20} color="#050816" />
                ) : (
                  <Text style={styles.modalCompleteBtnText}>Mark complete</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalCancelBtn} activeOpacity={0.8} onPress={closeMealModal}>
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedAnalysis)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedAnalysis(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>MEAL ANALYSIS</Text>
            <Text style={styles.modalTitle}>{selectedAnalysis?.meal_name_guess ?? 'Saved Analysis'}</Text>
            <Text style={styles.modalSubtitle}>
              {selectedAnalysis?.created_at ? new Date(selectedAnalysis.created_at).toLocaleString() : 'Saved meal analysis'}
            </Text>
            {selectedAnalysis ? (
              <View style={styles.modalMealCard}>
                <View style={styles.analysisResultHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.analysisResultLabel}>Summary</Text>
                    <Text style={styles.analysisResultTitle}>{selectedAnalysis.meal_name_guess}</Text>
                  </View>
                  <View style={styles.analysisConfidencePill}>
                    <Text style={styles.analysisConfidenceText}>{selectedAnalysis.confidence}</Text>
                  </View>
                </View>
                <Text style={styles.analysisResultSummary}>{selectedAnalysis.summary}</Text>
                <View style={styles.analysisResultGrid}>
                  <View style={styles.analysisResultMetric}>
                    <Text style={styles.analysisResultMetricLabel}>Calories</Text>
                    <Text style={styles.analysisResultMetricValue}>{selectedAnalysis.estimated_calories}</Text>
                  </View>
                  <View style={styles.analysisResultMetric}>
                    <Text style={styles.analysisResultMetricLabel}>Protein</Text>
                    <Text style={styles.analysisResultMetricValue}>{selectedAnalysis.estimated_protein}g</Text>
                  </View>
                  <View style={styles.analysisResultMetric}>
                    <Text style={styles.analysisResultMetricLabel}>Carbs</Text>
                    <Text style={styles.analysisResultMetricValue}>{selectedAnalysis.estimated_carbs}g</Text>
                  </View>
                  <View style={styles.analysisResultMetric}>
                    <Text style={styles.analysisResultMetricLabel}>Fat</Text>
                    <Text style={styles.analysisResultMetricValue}>{selectedAnalysis.estimated_fat}g</Text>
                  </View>
                </View>
                {selectedAnalysis.notes.length > 0 ? (
                  <View style={styles.analysisNotesBlock}>
                    {selectedAnalysis.notes.map((note, index) => (
                      <Text key={`${note}-${index}`} style={styles.analysisNoteItem}>
                        • {note}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <TouchableOpacity style={styles.modalCancelBtn} activeOpacity={0.8} onPress={() => setSelectedAnalysis(null)}>
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

/* ── Main Wizard Screen ── */
export default function JournalScreen() {
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const [generationStage, setGenerationStage] = useState<'queued' | 'processing' | null>(null);
  const [done, setDone] = useState(false);
  const [hasSavedPlan, setHasSavedPlan] = useState(false);
  const [creatingNewPlan, setCreatingNewPlan] = useState(false);
  const [loadingSavedPlan, setLoadingSavedPlan] = useState(true);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const successScale = useState(new Animated.Value(0))[0];
  const [generatedPlan, setGeneratedPlan] = useState<NutritionPlanApiResponse | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const successPlayer = useAudioPlayer(PLAN_SUCCESS_SOUND);

  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [cuisine, setCuisine] = useState('');
  const [favoriteMeal, setFavoriteMeal] = useState('');
  const [selectedDiet, setSelectedDiet] = useState<string | null>(null);
  const [allergies, setAllergies] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Please select...');
  const [genderOpen, setGenderOpen] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [healthConditions, setHealthConditions] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const loadLatestPlan = async () => {
      setLoadingSavedPlan(true);
      try {
        const latestPlan = await apiRequest<NutritionPlanApiResponse>('/ai/nutrition/plan/latest');
        if (cancelled) {
          return;
        }

        setGeneratedPlan(latestPlan);
        setHasSavedPlan(true);
        const mappedProfile = mapPlanProfile(latestPlan);
        if (mappedProfile) {
          setSelectedGoal(mappedProfile.goal);
          setCuisine(mappedProfile.cuisine);
          setFavoriteMeal(mappedProfile.favoriteMeal);
          setSelectedDiet(mappedProfile.selectedDiet);
          setAllergies(mappedProfile.allergies);
          setSelectedActivity(mappedProfile.selectedActivity);
          setAge(mappedProfile.age);
          setGender(mappedProfile.gender);
          setHeight(mappedProfile.height);
          setWeight(mappedProfile.weight);
          setHealthConditions(new Set(mappedProfile.healthConditions));
        }
        setDone(true);
      } catch {
        if (!cancelled) {
          setDone(false);
          setHasSavedPlan(false);
          setGeneratedPlan(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingSavedPlan(false);
        }
      }
    };

    void loadLatestPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!generating) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % PLAN_LOADING_MESSAGES.length);
    }, 2400);

    return () => clearInterval(interval);
  }, [generating]);

  useEffect(() => {
    if (!generationSuccess) {
      return;
    }

    successScale.setValue(0);
    Animated.timing(successScale, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();

    const playSuccessSound = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
        });
        successPlayer.seekTo(0);
        successPlayer.play();
      } catch {
        return;
      }
    };

    void playSuccessSound();

    const timer = setTimeout(() => {
      setGenerationSuccess(false);
      setCreatingNewPlan(false);
      setHasSavedPlan(true);
      setDone(true);
    }, PLAN_SUCCESS_HOLD_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [generationSuccess, successPlayer, successScale]);

  const toggleHealth = (id: string) => {
    setHealthConditions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canNext = () => {
    if (step === 1) return selectedGoal !== null;
    if (step === 2) return cuisine.trim().length > 0;
    if (step === 3) return favoriteMeal.trim().length > 0;
    if (step === 4) return selectedDiet !== null;
    if (step === 5) return true;
    if (step === 6) return selectedActivity !== null;
    if (step === 7) return age.trim().length > 0 && gender !== 'Please select...' && height.trim().length > 0 && weight.trim().length > 0;
    return true;
  };

  const goNext = () => { if (step < TOTAL_STEPS) setStep(step + 1); };
  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
      return;
    }

    if (hasSavedPlan) {
      setCreatingNewPlan(false);
      setDone(true);
      setGenerationStage(null);
      setErrorDialog(null);
    }
  };

  const generatePlan = async () => {
    if (generating) {
      return;
    }

    setGenerating(true);
    setGenerationSuccess(false);
    setGenerationStage('processing');
    setCreatingNewPlan(true);
    setErrorDialog(null);

    try {
      const response = await createNutritionPlan({
        goal: selectedGoal,
        cuisine,
        favorite_meal: favoriteMeal,
        diet: selectedDiet,
        allergies,
        activity_level: selectedActivity,
        age,
        gender,
        height,
        weight,
        health_conditions: Array.from(healthConditions),
      });
      const savedPlan = response.plan ?? null;

      if (!savedPlan) {
        throw new Error('Nutrition plan generation did not return a plan');
      }

      setGeneratedPlan(savedPlan);

      setGenerating(false);
      setGenerationStage(null);
      setGenerationSuccess(true);
    } catch (error) {
      setGenerating(false);
      setGenerationStage(null);
      setGenerationSuccess(false);
      setErrorDialog(formatNutritionPlanError(error));
    }
  };

  const formatNutritionPlanError = (error: unknown) => {
    const formatted = formatAppError(error, 'Unable to generate a nutrition plan right now.');
    if (formatted.message.toLowerCase().includes('nutrition plan refused')) {
      return {
        title: 'Nutrition Error',
        message: 'The nutrition request was refused. Adjust your inputs and try again.',
      };
    }
    if (formatted.message.toLowerCase().includes('did not return valid plan json')) {
      return {
        title: 'Nutrition JSON Error',
        message: 'The AI response was not valid plan JSON. Try again and the system will request a cleaner structured plan.',
      };
    }
    if (formatted.message.toLowerCase().includes('nutrition plan unavailable')) {
      return {
        title: 'Nutrition Service Error',
        message: 'The nutrition service is unavailable right now. Try again in a moment.',
      };
    }
    return formatted;
  };

  const progressFraction = (step - 1) / (TOTAL_STEPS - 1);

  if (generating) {
    const isQueued = generationStage === 'queued';
    const progressWidth = isQueued ? '28%' : '66%';
    const stageLabel = isQueued ? 'Queued' : 'Processing';
    const stageMessage = isQueued
      ? 'Your plan request is waiting for the generation worker.'
      : 'The backend is building your meal plan now.';

    return (
      <View style={styles.loadingScreen}>
        <View style={styles.jobCard}>
          <Text style={styles.jobStage}>{stageLabel}</Text>
          <Text style={styles.quoteText}>Generating your plan</Text>
          <Text style={styles.loadingDetailText}>{stageMessage}</Text>
          <View style={styles.jobProgressTrack}>
            <View style={[styles.jobProgressFill, { width: progressWidth }]} />
          </View>
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 18 }} />
          <Text style={styles.loadingDetailText}>{PLAN_LOADING_MESSAGES[loadingMessageIndex]}</Text>
        </View>
      </View>
    );
  }

  if (generationSuccess) {
    return (
      <View style={styles.loadingScreen}>
        <Animated.View style={[styles.successRing, { transform: [{ scale: successScale }] }]}>
          <Ionicons name="checkmark" size={42} color="#fff" />
        </Animated.View>
        <Text style={styles.quoteText}>Plan saved</Text>
      </View>
    );
  }

  if (loadingSavedPlan) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 40 }} />
        <Text style={styles.quoteText}>Loading your saved plan...</Text>
      </View>
    );
  }

  if ((hasSavedPlan || done) && !creatingNewPlan) {
    return (
      <MealPlanResult
        profile={{
          goal: selectedGoal,
          cuisine,
          favoriteMeal,
          selectedDiet,
          allergies,
          selectedActivity,
          age,
          gender,
          height,
          weight,
          healthConditions: Array.from(healthConditions),
        }}
        initialPlan={generatedPlan}
        onCreateNewPlan={() => {
          setCreatingNewPlan(true);
          setStep(1);
          setErrorDialog(null);
          setGenerationStage(null);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ErrorPopupModal
        visible={Boolean(errorDialog)}
        title={errorDialog?.title ?? 'Error'}
        message={errorDialog?.message ?? ''}
        onClose={() => setErrorDialog(null)}
        onRetry={errorDialog ? generatePlan : undefined}
        retryLabel="Try Again"
      />
      <VictoryHeader />

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View
          style={[styles.progressBarFill, { width: `${progressFraction * 100}%`, backgroundColor: Colors.accentPurple }]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepCounter}>Step {step} of {TOTAL_STEPS}</Text>

        {step === 1 && (
          <View>
            <Text style={styles.bigQuestion}>What is your primary goal?</Text>
            <Text style={styles.bigSub}>Choose the goal that motivates you the most.</Text>
            <OptionList items={GOALS} selected={selectedGoal} onSelect={setSelectedGoal} />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.bigQuestion}>What country's dishes do you cook or enjoy most?</Text>
            <Text style={styles.bigSub}>We'll adapt the plan to your taste preferences and available ingredients.</Text>
            <View style={styles.textInputCard}>
              <TextInput style={styles.textInput} placeholder="e.g. Italian, Ghanaian, Mediterranean..." placeholderTextColor="rgba(255,255,255,0.3)" value={cuisine} onChangeText={setCuisine} multiline textAlignVertical="top" />
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.bigQuestion}>What is your absolute favorite meal?</Text>
            <Text style={styles.bigSub}>We'll schedule it 2x a week—guilt-free!</Text>
            <View style={styles.textInputCard}>
              <TextInput style={styles.textInput} placeholder="e.g. Pizza, Jollof Rice, Burger..." placeholderTextColor="rgba(255,255,255,0.3)" value={favoriteMeal} onChangeText={setFavoriteMeal} multiline textAlignVertical="top" />
            </View>
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={styles.bigQuestion}>Do you have any dietary preferences?</Text>
            <Text style={styles.bigSub}>We'll make sure your plan fits you perfectly.</Text>
            <OptionList items={DIET_PREFS} selected={selectedDiet} onSelect={setSelectedDiet} />
          </View>
        )}

        {step === 5 && (
          <View>
            <Text style={styles.bigQuestion}>Allergies or dislikes?</Text>
            <Text style={[styles.bigSub, { textAlign: 'center' }]}>Tell us any foods to avoid (comma-separated).</Text>
            <View style={styles.textInputCard}>
              <TextInput style={styles.textInput} placeholder="e.g., Nuts, lactose, dislike cilantro..." placeholderTextColor="rgba(255,255,255,0.3)" value={allergies} onChangeText={setAllergies} multiline textAlignVertical="top" />
            </View>
          </View>
        )}

        {step === 6 && (
          <View>
            <Text style={styles.bigQuestion}>How active are you in daily life?</Text>
            <Text style={styles.bigSub}>Not including your training with us.</Text>
            <OptionList items={ACTIVITY_LEVELS} selected={selectedActivity} onSelect={setSelectedActivity} />
          </View>
        )}

        {step === 7 && (
          <View>
            <Text style={styles.bigQuestion}>Review your details</Text>
            <Text style={[styles.bigSub, { textAlign: 'center' }]}>We've pulled this data from your profile. You can adjust it for this plan if needed.</Text>

            <Text style={styles.fieldLabel}>Age</Text>
            <View style={styles.textInputCard}>
              <TextInput style={[styles.textInput, styles.textInputSingle]} placeholder="e.g., 28" placeholderTextColor="rgba(255,255,255,0.3)" value={age} onChangeText={setAge} keyboardType="numeric" />
            </View>

            <Text style={styles.fieldLabel}>Gender</Text>
            <TouchableOpacity style={[styles.textInputCard, styles.genderSelector]} onPress={() => setGenderOpen(!genderOpen)} activeOpacity={0.85}>
              <Text style={[styles.textInput, styles.textInputSingle, { flex: 1 }]}>{gender}</Text>
              <Ionicons name={genderOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
            {genderOpen && (
              <View style={styles.genderDropdown}>
                {GENDERS.filter(g => g !== 'Please select...').map((g) => (
                  <TouchableOpacity key={g} style={[styles.genderOption, gender === g && styles.genderOptionActive]} onPress={() => { setGender(g); setGenderOpen(false); }}>
                    <Text style={[styles.genderOptionText, gender === g && styles.genderOptionTextActive]}>{g}</Text>
                    {gender === g && <Ionicons name="checkmark" size={14} color="#A855F7" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.fieldLabel}>Height (in cm)</Text>
            <View style={styles.textInputCard}>
              <TextInput style={[styles.textInput, styles.textInputSingle]} placeholder="e.g., 175" placeholderTextColor="rgba(255,255,255,0.3)" value={height} onChangeText={setHeight} keyboardType="numeric" />
            </View>

            <Text style={styles.fieldLabel}>Weight (in kg)</Text>
            <View style={styles.textInputCard}>
              <TextInput style={[styles.textInput, styles.textInputSingle]} placeholder="e.g., 70" placeholderTextColor="rgba(255,255,255,0.3)" value={weight} onChangeText={setWeight} keyboardType="numeric" />
            </View>
          </View>
        )}

        {step === 8 && (
          <View>
            <Text style={styles.bigQuestion}>Do you have any health conditions?</Text>
            <Text style={[styles.bigSub, { textAlign: 'center' }]}>We use this to provide tailored recommendations in the 'Heal with Food' section.</Text>
            <View style={styles.optionList}>
              {HEALTH_CONDITIONS.map((item) => {
                const active = healthConditions.has(item.id);
                return (
                  <TouchableOpacity key={item.id} style={[styles.optionCard, active && styles.optionCardActive]} onPress={() => toggleHealth(item.id)} activeOpacity={0.85}>
                    <Text style={styles.optionEmoji}>{item.emoji}</Text>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive, { flex: 1 }]}>{item.label}</Text>
                    {active && <View style={styles.optionCheck}><Ionicons name="checkmark" size={13} color="#fff" /></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} disabled={step === 1 && !hasSavedPlan}>
          <Text style={[styles.backBtnText, step === 1 && !hasSavedPlan && styles.backBtnDisabled]}>Back</Text>
        </TouchableOpacity>
        {step < TOTAL_STEPS ? (
          <TouchableOpacity onPress={goNext} disabled={!canNext()} activeOpacity={0.85}>
            <View style={[styles.nextBtn, { backgroundColor: canNext() ? Colors.accentPurple : '#2A2A40' }]}>
              <Text style={[styles.nextBtnText, !canNext() && styles.nextBtnDisabled]}>Next</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={generatePlan} activeOpacity={0.85}>
            <View style={[styles.generateBtn, { backgroundColor: Colors.accentPurple }]}>
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.generateBtnText}>Curate Your Plan</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  /* Progress Bar */
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%' },
  progressBarFill: { height: '100%' },

  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  stepCounter: { color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 24, letterSpacing: 0.5 },

  bigQuestion: { fontSize: 28, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold', lineHeight: 38, marginBottom: 12 },
  bigSub: { fontSize: 14, color: Colors.textMuted, fontFamily: 'Inter_400Regular', lineHeight: 21, marginBottom: 32 },

  optionList: { gap: 10 },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#13132A', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, borderWidth: 1.5, borderColor: '#1E1E38', gap: 16 },
  optionCardActive: { borderColor: '#A855F7', backgroundColor: 'rgba(168,85,247,0.10)' },
  optionEmoji: { fontSize: 24, width: 32, textAlign: 'center' },
  optionLabel: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_700Bold' },
  optionLabelActive: { color: '#fff' },
  optionSub: { fontSize: 12, color: Colors.textMuted, fontFamily: 'Inter_400Regular', marginTop: 2 },
  optionCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#A855F7', justifyContent: 'center', alignItems: 'center' },

  textInputCard: { backgroundColor: '#13132A', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: '#1E1E38' },
  textInput: { color: '#fff', fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 24, minHeight: 90 },
  textInputSingle: { minHeight: 0 },

  fieldLabel: { color: Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 8, marginTop: 4, letterSpacing: 0.2 },
  genderSelector: { flexDirection: 'row', alignItems: 'center' },
  genderDropdown: { backgroundColor: '#1E1E38', borderRadius: 12, overflow: 'hidden', marginTop: -12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  genderOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  genderOptionActive: { backgroundColor: 'rgba(168,85,247,0.1)' },
  genderOptionText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Inter_400Regular' },
  genderOptionTextActive: { color: '#A855F7', fontWeight: '700', fontFamily: 'Inter_700Bold' },

  loadingScreen: { flex: 1, backgroundColor: '#0D1220', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  jobCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#13132A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
  },
  jobStage: {
    alignSelf: 'flex-start',
    color: Colors.primary,
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  quoteText: { color: '#fff', fontSize: 20, fontWeight: '800', fontFamily: 'Inter_700Bold', textAlign: 'center', lineHeight: 30, letterSpacing: 0.5 },
  loadingDetailText: { color: Colors.textMuted, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, marginTop: 14, maxWidth: 300, alignSelf: 'center' },
  jobProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 20,
  },
  jobProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  successRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.accentPurple, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  planLoading: { paddingVertical: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  planLoadingText: { color: Colors.textMuted, fontSize: 14, fontFamily: 'Inter_400Regular' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, paddingBottom: Platform.OS === 'ios' ? 32 : 20, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  backBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  backBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontFamily: 'Inter_400Regular' },
  backBtnDisabled: { color: 'rgba(255,255,255,0.2)' },
  nextBtn: { paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14 },
  generateBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  nextBtnDisabled: { color: 'rgba(255,255,255,0.35)' },
  /* Wizard Header */
  wizardHeader: { alignItems: 'center', paddingTop: 52, paddingBottom: 16, backgroundColor: Colors.background },
  wizardBrandTitle: { fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: 8, fontFamily: 'Inter_700Bold' },
  wizardBrandSub: { fontSize: 12, fontWeight: '600', color: '#fff', letterSpacing: 6, marginTop: 4, fontFamily: 'Inter_600SemiBold' },

  /* ── MealPlanResult ── */
  planBrand: { alignItems: 'center', paddingTop: 52, paddingBottom: 8 },
  planBrandTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 6, fontFamily: 'Inter_700Bold' },
  planBrandSub: { fontSize: 11, fontWeight: '600', color: '#fff', letterSpacing: 5, marginTop: 2 },

  planTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  planTabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  planTabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#A855F7' },
  planTabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  planTabTextActive: { color: '#A855F7' },

  planContent: { paddingHorizontal: 18, paddingTop: 20 },
  planTitle: { fontSize: 22, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold', lineHeight: 30, marginBottom: 10 },
  planDesc: { fontSize: 13, color: Colors.textMuted, fontFamily: 'Inter_400Regular', lineHeight: 20, marginBottom: 20 },

  dayScroll: { marginBottom: 0 },
  dayBtn: { paddingHorizontal: 16, paddingVertical: 10, marginRight: 4 },
  dayBtnActive: { borderBottomWidth: 2, borderBottomColor: '#A855F7' },
  dayBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  dayBtnTextActive: { color: '#A855F7', fontWeight: '700' },
  dayUnderline: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },

  totalsCard: { backgroundColor: '#13132A', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  totalsTitle: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  totalsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  totalsItem: { alignItems: 'center', gap: 4 },
  totalsIcon: { fontSize: 18 },
  totalsVal: { fontSize: 13, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },

  dailyMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  dailyMetricCard: {
    width: '47%',
    backgroundColor: '#0D0D1E',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 6,
  },
  dailyMetricEmoji: {
    fontSize: 20,
  },
  dailyMetricLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontFamily: 'Inter_700Bold',
  },
  dailyMetricValue: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  trackerProgressText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 10,
  },

  summaryCard: {
    backgroundColor: '#0D0D1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 14,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  summaryPill: {
    backgroundColor: 'rgba(168,85,247,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  summaryPillText: {
    color: '#D8B4FE',
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily: 'Inter_700Bold',
  },
  summaryMealList: {
    gap: 10,
  },
  summaryMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  summaryMealLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  summaryMealName: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    maxWidth: 210,
  },
  summaryStatusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryStatusChipDone: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.26)',
  },
  summaryStatusText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryStatusTextDone: {
    color: '#22C55E',
  },

  mealCardWrap: {
    marginBottom: 14,
  },
  mealCard: { backgroundColor: '#13132A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  mealCardActive: {
    borderColor: 'rgba(168,85,247,0.45)',
    backgroundColor: '#171733',
  },
  mealLabel: { fontSize: 13, fontWeight: '700', color: '#A855F7', fontFamily: 'Inter_700Bold', marginBottom: 6, letterSpacing: 0.3 },
  mealCompleteBadge: {
    alignSelf: 'flex-start',
    color: '#22C55E',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  mealName: { fontSize: 16, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold', marginBottom: 4 },
  mealDesc: { fontSize: 13, color: Colors.textMuted, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 12 },
  mealMacroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  macroChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  macroChipText: { fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  mealHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  mealHintText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  mealActionPanel: {
    marginTop: -4,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  mealActionTitle: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  mealActionSub: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },

  expandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  expandLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  expandContent: { paddingBottom: 8, paddingLeft: 4 },
  expandItem: { color: Colors.textMuted, fontSize: 13, lineHeight: 22 },
  expandDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 2 },
  completeMealBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  completeMealBtnDone: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  completeMealBtnText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  completeMealBtnTextDone: {
    color: '#22C55E',
  },
  mealActionSecondary: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  mealActionSecondaryText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,8,22,0.82)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#13132A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  modalActionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalActionOverlayCard: {
    minWidth: 160,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(5,8,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 12,
  },
  modalActionOverlayText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 16,
  },
  modalEyebrow: {
    color: Colors.primary,
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  modalMealCard: {
    backgroundColor: '#0D0D1E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    marginBottom: 16,
  },
  modalMealName: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  modalMealDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    marginBottom: 14,
  },
  modalMealSection: {
    color: Colors.primary,
    fontSize: 12,
    letterSpacing: 1.1,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalMealItem: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
  },
  modalCompleteBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modalCompleteBtnDone: {
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  modalCompleteBtnText: {
    color: '#050816',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  modalCompleteBtnTextDone: {
    color: '#22C55E',
  },
  modalSecondaryActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  modalSecondaryActionText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },

  shoppingBtn: { marginTop: 8, marginBottom: 12 },
  shoppingBtnGrad: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  shoppingBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  newPlanBtn: { alignItems: 'center', paddingVertical: 12 },
  newPlanBtnText: { color: '#A855F7', fontSize: 14, fontWeight: '600' },

  /* Tracker */
  trackerSection: { backgroundColor: '#13132A', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  trackerSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  trackerSectionIcon: { fontSize: 20 },
  trackerSectionTitle: { fontSize: 15, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  macroGridCell: { width: '47%', backgroundColor: '#0D0D1E', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  macroGridLabel: { fontSize: 10, color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Inter_400Regular' },
  macroGridValRow: { flexDirection: 'row', alignItems: 'baseline' },
  macroGridVal: { fontSize: 32, fontWeight: '800', color: Colors.primary, fontFamily: 'Inter_700Bold' },
  macroGridUnit: { fontSize: 13, color: Colors.textMuted, fontFamily: 'Inter_400Regular' },
  getSuggestionsBtn: { backgroundColor: '#0D0D1E', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  getSuggestionsBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  advicePanel: {
    marginTop: 12,
    backgroundColor: '#0B0B18',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  advicePanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  advicePanelEyebrow: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  advicePanelTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    lineHeight: 22,
  },
  advicePanelPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168,85,247,0.14)',
    borderColor: 'rgba(168,85,247,0.25)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  advicePanelPillText: {
    color: '#C084FC',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  adviceList: {
    gap: 10,
  },
  adviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
  },
  adviceBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  adviceBulletText: {
    color: '#050816',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  adviceItemText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  adviceFallbackText: { color: '#fff', fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  mealSearchRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  mealSearchInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    outlineStyle: 'none' as any,
  },
  mealSearchBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  mealSearchBtnText: { color: '#000', fontSize: 12, fontWeight: '800', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  todayLogsLabel: { fontSize: 10, color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Inter_400Regular' },
  todayLogsEmpty: { color: Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 20 },

  /* Meal Analysis */
  analysisCard: { backgroundColor: '#13132A', borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  analysisTitle: { fontSize: 22, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold', lineHeight: 30, marginBottom: 10 },
  analysisDesc: { fontSize: 14, color: Colors.textMuted, fontFamily: 'Inter_400Regular', lineHeight: 21, marginBottom: 20 },
  analysisPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  analysisPreviewImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  analysisPreviewMeta: {
    flex: 1,
  },
  analysisPreviewLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  analysisPreviewText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  analysisResultCard: {
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 14,
  },
  analysisLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  analysisLoadingText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  analysisResultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  analysisResultLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  analysisResultTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  analysisConfidencePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168,85,247,0.14)',
    borderColor: 'rgba(168,85,247,0.28)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  analysisConfidenceText: {
    color: '#D8B4FE',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter_700Bold',
  },
  analysisResultSummary: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  analysisResultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analysisResultMetric: {
    width: '47%',
    backgroundColor: '#0D0D1E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  analysisResultMetricLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  analysisResultMetricValue: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  analysisNotesBlock: {
    gap: 6,
  },
  analysisNoteItem: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  analysisErrorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  analysisHistoryCard: {
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  analysisHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  analysisHistoryTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  analysisHistoryCount: {
    minWidth: 28,
    textAlign: 'center',
    color: '#D8B4FE',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    backgroundColor: 'rgba(168,85,247,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.28)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  analysisHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0D0D1E',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  analysisHistoryRowTitle: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  analysisHistoryRowMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  analysisHistoryRowPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.24)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  analysisHistoryRowPillText: {
    color: '#86EFAC',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  analysisUploadGrad: { borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  analysisUploadText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  analysisEmptyCard: { backgroundColor: '#13132A', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  analysisEmptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold', marginTop: 14, marginBottom: 8 },
  analysisEmptySub: { color: Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },

  /* ── Shopping List ── */
  jsonCard: {
    backgroundColor: '#0D0D1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginBottom: 20,
  },
  jsonText: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  slHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 56, paddingBottom: 16, backgroundColor: Colors.background },
  slBackBtn: { padding: 4 },
  slTitle: { fontSize: 16, fontWeight: '800', color: '#fff', fontFamily: 'Inter_700Bold' },
  slSubtitle: { fontSize: 12, color: Colors.textMuted, fontFamily: 'Inter_400Regular', marginTop: 2 },
  slClearBtn: { padding: 8 },
  slClearText: { color: '#A855F7', fontSize: 13, fontFamily: 'Inter_400Regular' },
  slProgressBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%' },
  slProgressFill: { height: '100%', backgroundColor: '#A855F7' },
  slScroll: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },
  slCategoryHeader: { fontSize: 14, fontWeight: '800', color: '#A855F7', fontFamily: 'Inter_700Bold', letterSpacing: 0.3, marginTop: 20, marginBottom: 4 },
  slSection: { backgroundColor: '#13132A', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 4 },
  slRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  slRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  slCheckBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  slCheckBoxActive: { backgroundColor: '#A855F7', borderColor: '#A855F7' },
  slItemName: { flex: 1, fontSize: 14, color: '#fff', fontFamily: 'Inter_400Regular' },
  slItemNameChecked: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  slItemQty: { fontSize: 13, color: Colors.textMuted, fontFamily: 'Inter_400Regular', textAlign: 'right', maxWidth: 130 },
  slItemQtyChecked: { color: 'rgba(255,255,255,0.2)' },

  slBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    paddingTop: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  slCopyBtn: {
    shadowColor: '#D946EF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  slCopyBtnGrad: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slCopyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  analysisBtn: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
  },
  analysisBtnText: {
    color: Colors.accentPurple,
    fontWeight: '700',
    fontSize: 14,
  },
});



