import type { AuthUser } from './api';

export type SubscriptionTier = 'NONE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'INNER_CIRCLE';
export type BillingCycle = 'monthly' | 'yearly';

export type AppPlanCard = {
  tier: SubscriptionTier;
  title: string;
  monthlyPrice?: string;
  yearlyPrice: string;
  badge?: string;
  description: string;
  features: string[];
  accent: string;
  featureAccess: string[];
  tabAccess: string[];
  routeAccess: string[];
};

const SILVER_FEATURE_ACCESS = ['home', 'workout', 'challenge', 'community', 'profile'] as const;
const GOLD_FEATURE_ACCESS = [...SILVER_FEATURE_ACCESS, 'mealPlan'] as const;
const PLATINUM_FEATURE_ACCESS = [...GOLD_FEATURE_ACCESS, 'nutrition_tracker', 'meal_analysis', 'workoutplan', 'longevity'] as const;
const INNER_CIRCLE_FEATURE_ACCESS = [...PLATINUM_FEATURE_ACCESS, 'application', 'coach_victor', 'longevity_plan'] as const;

const SILVER_TAB_ACCESS = ['index', 'workout', 'challenge', 'profile'] as const;
const GOLD_AND_ABOVE_TAB_ACCESS = ['index', 'workout', 'challenge', 'mealPlan', 'profile'] as const;

const SILVER_ROUTE_ACCESS = [
  '/',
  '/workout',
  '/workout-library',
  '/challenge',
  '/challenges',
  '/profile',
  '/journal',
] as const;
const GOLD_ROUTE_ACCESS = [...SILVER_ROUTE_ACCESS, '/mealPlan'] as const;
const PLATINUM_ROUTE_ACCESS = [...GOLD_ROUTE_ACCESS, '/workoutplan', '/profile/longevity-os'] as const;
const INNER_CIRCLE_ROUTE_ACCESS = [...PLATINUM_ROUTE_ACCESS, '/profile/application', '/community', '/chat'] as const;
const NOTIFICATION_ROUTE = '/notifications';
const ALL_TAB_ACCESS = ['index', 'workout', 'challenge', 'mealPlan', 'profile'] as const;

const FEATURE_TAB_ACCESS: Record<string, readonly string[]> = {
  home: ['index'],
  workout: ['workout'],
  challenge: ['challenge'],
  community: ['challenge'],
  mealPlan: ['mealPlan'],
  nutrition_tracker: ['mealPlan'],
  meal_analysis: ['mealPlan'],
  profile: ['profile'],
  workoutplan: ['profile'],
  longevity: ['profile'],
  application: ['profile'],
  coach_victor: ['profile'],
  longevity_plan: ['profile'],
};

const FEATURE_ROUTE_ACCESS: Record<string, readonly string[]> = {
  home: ['/'],
  workout: ['/workout', '/workout-library'],
  challenge: ['/challenge', '/challenges'],
  community: ['/challenge', '/challenges', '/community'],
  mealPlan: ['/mealPlan'],
  nutrition_tracker: ['/mealPlan'],
  meal_analysis: ['/mealPlan'],
  profile: ['/profile'],
  workoutplan: ['/workoutplan'],
  longevity: ['/profile/longevity-os'],
  application: ['/profile/application'],
  coach_victor: ['/chat'],
  longevity_plan: ['/profile/longevity-os'],
};

export const PLAN_CARDS: AppPlanCard[] = [
  {
    tier: 'SILVER',
    title: 'Victory Silver',
    monthlyPrice: 'EUR 19 / month',
    yearlyPrice: 'EUR 199 / year',
    description: 'Good start, with core training access and basic accountability.',
    features: ['Workout Library', 'Basic Programs', 'Community Challenges'],
    accent: '#A3A3A3',
    featureAccess: [...SILVER_FEATURE_ACCESS],
    tabAccess: [...SILVER_TAB_ACCESS],
    routeAccess: [...SILVER_ROUTE_ACCESS],
  },
  {
    tier: 'GOLD',
    title: 'Victory Gold',
    monthlyPrice: 'EUR 29 / month',
    yearlyPrice: 'EUR 299 / year',
    badge: 'Most Popular',
    description: 'Adds nutrition access and more accountability structure.',
    features: ['All Silver features', 'Meal Planning', 'Community Challenges', 'Tracking Reminders'],
    accent: '#FACC15',
    featureAccess: [...GOLD_FEATURE_ACCESS],
    tabAccess: [...GOLD_AND_ABOVE_TAB_ACCESS],
    routeAccess: [...GOLD_ROUTE_ACCESS],
  },
  {
    tier: 'PLATINUM',
    title: 'Victory Platinum',
    monthlyPrice: 'EUR 39 / month',
    yearlyPrice: 'EUR 399 / year',
    description: 'Built for users who want a deeper coaching and tracking experience.',
    features: ['All Gold features', 'Personalized 7-Day Workout Plan', 'Tracker', 'AI Meal Analysis', 'Longevity OS'],
    accent: '#38BDF8',
    featureAccess: [...PLATINUM_FEATURE_ACCESS],
    tabAccess: [...GOLD_AND_ABOVE_TAB_ACCESS],
    routeAccess: [...PLATINUM_ROUTE_ACCESS],
  },
  /*
  {
    tier: 'INNER_CIRCLE',
    title: 'Victory Inner Circle',
    yearlyPrice: 'Application Only',
    description: 'Direct coaching access with the broadest app access set.',
    features: ['All Platinum features', 'Customized Plan', 'Longevity OS Plan', 'Coach Victor', 'Application Access'],
    accent: '#FB7185',
    featureAccess: [...INNER_CIRCLE_FEATURE_ACCESS],
    tabAccess: [...GOLD_AND_ABOVE_TAB_ACCESS],
    routeAccess: [...INNER_CIRCLE_ROUTE_ACCESS],
  },
  */
];

const ALLOWED_PUBLIC_PATHS = ['/login', '/register', '/verification', '/forgot-password', '/onboarding', '/splash'];
const ALLOWED_AUTHENTICATED_PATHS = ['/journal'] as const;
const PLAN_PATH = '/plan';

export function normalizeSubscriptionTier(value?: string | null): SubscriptionTier {
  const tier = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if (tier === 'SILVER' || tier === 'GOLD' || tier === 'PLATINUM' || tier === 'INNER_CIRCLE') {
    return tier;
  }
  return 'NONE';
}

export function isSubscriptionActive(user?: Pick<AuthUser, 'is_admin' | 'subscription_tier' | 'subscription_status'> | null): boolean {
  if (!user) {
    return false;
  }

  if (user.is_admin) {
    return true;
  }

  return normalizeSubscriptionTier(user.subscription_tier) !== 'NONE' && String(user.subscription_status ?? '').toUpperCase() === 'ACTIVE';
}

export function getSubscriptionCard(tier: SubscriptionTier) {
  return PLAN_CARDS.find((card) => card.tier === tier) ?? PLAN_CARDS[0];
}

function getConfiguredFeatureAccess(
  user?: Pick<AuthUser, 'subscription_access' | 'subscription'> | null,
): string[] {
  const topLevelAccess = Array.isArray(user?.subscription_access) ? user.subscription_access : [];
  const nestedAccess = Array.isArray(user?.subscription?.access) ? user.subscription.access : [];
  const access = topLevelAccess.length > 0 ? topLevelAccess : nestedAccess;
  return Array.from(new Set(access.map((item) => String(item).trim()).filter(Boolean)));
}

function getEffectiveFeatureAccess(
  user?: Pick<AuthUser, 'subscription_access' | 'subscription' | 'subscription_tier'> | null,
): string[] {
  const configuredAccess = getConfiguredFeatureAccess(user);
  if (configuredAccess.length > 0) {
    return configuredAccess;
  }

  return getSubscriptionCard(normalizeSubscriptionTier(user?.subscription_tier)).featureAccess;
}

function getTabsForFeatureAccess(featureAccess: string[]): string[] {
  const tabs = new Set<string>();
  featureAccess.forEach((feature) => {
    FEATURE_TAB_ACCESS[feature]?.forEach((tab) => tabs.add(tab));
  });
  return ALL_TAB_ACCESS.filter((tab) => tabs.has(tab));
}

function getRoutesForFeatureAccess(featureAccess: string[]): string[] {
  const routes = new Set<string>();
  featureAccess.forEach((feature) => {
    FEATURE_ROUTE_ACCESS[feature]?.forEach((route) => routes.add(route));
  });
  return Array.from(routes);
}

export function getPlanPrice(card: AppPlanCard, cycle: BillingCycle): string {
  if (card.tier === 'INNER_CIRCLE') {
    return card.yearlyPrice;
  }

  if (cycle === 'monthly' && card.monthlyPrice) {
    return card.monthlyPrice;
  }

  return card.yearlyPrice;
}

export function getAllowedTabNames(user?: Pick<AuthUser, 'is_admin' | 'subscription_tier' | 'subscription_status' | 'subscription_access' | 'subscription'> | null): string[] {
  if (!isSubscriptionActive(user)) {
    return [];
  }

  if (user?.is_admin) {
    return [...ALL_TAB_ACCESS];
  }

  const configuredTabs = getTabsForFeatureAccess(getConfiguredFeatureAccess(user));
  if (configuredTabs.length > 0) {
    return configuredTabs;
  }

  return getSubscriptionCard(normalizeSubscriptionTier(user?.subscription_tier)).tabAccess;
}

export function isPlanSelectionRoute(pathname: string): boolean {
  return pathname === PLAN_PATH;
}

function hasPreviouslySelectedPlan(user?: Pick<AuthUser, 'subscription_tier' | 'subscription_status' | 'subscription_is_purchased'> | null) {
  const tier = normalizeSubscriptionTier(user?.subscription_tier);
  const status = String(user?.subscription_status ?? '').trim().toUpperCase();
  return tier !== 'NONE' && (status === 'ACTIVE' || Boolean(user?.subscription_is_purchased));
}

function hasCompletedSetup(user?: Pick<AuthUser, 'onboarding_completed' | 'subscription_tier' | 'subscription_status' | 'subscription_is_purchased'> | null) {
  return Boolean(user?.onboarding_completed) || hasPreviouslySelectedPlan(user);
}

export function isPublicRoute(pathname: string): boolean {
  return ALLOWED_PUBLIC_PATHS.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isAdminRestrictedFromApp(user?: Pick<AuthUser, 'is_admin'> | null): boolean {
  return Boolean(user?.is_admin);
}

export function getPostAuthRoute(user?: Pick<AuthUser, 'id' | 'is_admin' | 'subscription_tier' | 'subscription_status' | 'subscription_is_purchased' | 'onboarding_completed'> | null): string {
  if (!user) {
    return '/login';
  }
  if (isAdminRestrictedFromApp(user)) {
    return '/login';
  }
  if (!hasCompletedSetup(user)) {
    return '/onboarding';
  }
  return isSubscriptionActive(user) ? '/(tabs)' : PLAN_PATH;
}

export function isRouteAllowedForPlan(pathname: string, user?: Pick<AuthUser, 'id' | 'is_admin' | 'subscription_tier' | 'subscription_status' | 'subscription_is_purchased' | 'onboarding_completed' | 'subscription_access' | 'subscription'> | null): boolean {
  if (user && !hasCompletedSetup(user)) {
    return pathname === '/onboarding' || pathname === '/login' || pathname === '/register' || pathname === '/verification' || pathname === '/forgot-password';
  }

  if (isPublicRoute(pathname) || isPlanSelectionRoute(pathname)) {
    return true;
  }

  if (pathname === NOTIFICATION_ROUTE || pathname.startsWith(`${NOTIFICATION_ROUTE}/`)) {
    return Boolean(user);
  }

  if (user && ALLOWED_AUTHENTICATED_PATHS.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return true;
  }

  if (isSubscriptionActive(user)) {
    if (user?.is_admin) {
      return true;
    }

    const configuredRoutes = getRoutesForFeatureAccess(getConfiguredFeatureAccess(user));
    const routeAccess = configuredRoutes.length > 0
      ? configuredRoutes
      : getSubscriptionCard(normalizeSubscriptionTier(user?.subscription_tier)).routeAccess;
    return routeAccess.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }

  return false;
}

export function canAccessPlanRoute(pathname: string, user?: Pick<AuthUser, 'id' | 'is_admin' | 'subscription_tier' | 'subscription_status' | 'onboarding_completed' | 'subscription_access' | 'subscription'> | null): boolean {
  if (!user) {
    return false;
  }

  return isRouteAllowedForPlan(pathname, user);
}

export function canAccessFeature(
  feature: string,
  user?: Pick<AuthUser, 'is_admin' | 'subscription_tier' | 'subscription_status' | 'subscription_access' | 'subscription'> | null,
): boolean {
  if (!isSubscriptionActive(user)) {
    return false;
  }

  if (user?.is_admin) {
    return true;
  }

  return getEffectiveFeatureAccess(user).includes(feature);
}
