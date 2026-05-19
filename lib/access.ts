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

const SILVER_ROUTE_ACCESS = ['/', '/workout', '/challenge', '/challenges', '/profile'] as const;
const GOLD_ROUTE_ACCESS = [...SILVER_ROUTE_ACCESS, '/mealPlan'] as const;
const PLATINUM_ROUTE_ACCESS = [...GOLD_ROUTE_ACCESS, '/workoutplan', '/profile/longevity-os'] as const;
const INNER_CIRCLE_ROUTE_ACCESS = [...PLATINUM_ROUTE_ACCESS, '/profile/application', '/community', '/chat'] as const;

export const PLAN_CARDS: AppPlanCard[] = [
  {
    tier: 'SILVER',
    title: 'Victory Silver',
    monthlyPrice: 'EUR 19 / month',
    yearlyPrice: 'EUR 199 / year',
    description: 'Good start, with core training access and basic accountability.',
    features: ['Workout Library', 'Basic Programs', 'Limited Challenges'],
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
];

const ALLOWED_PUBLIC_PATHS = ['/login', '/register', '/verification', '/onboarding', '/splash'];
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

export function getPlanPrice(card: AppPlanCard, cycle: BillingCycle): string {
  if (card.tier === 'INNER_CIRCLE') {
    return card.yearlyPrice;
  }

  if (cycle === 'monthly' && card.monthlyPrice) {
    return card.monthlyPrice;
  }

  return card.yearlyPrice;
}

export function getAllowedTabNames(user?: Pick<AuthUser, 'is_admin' | 'subscription_tier' | 'subscription_status'> | null): string[] {
  if (!isSubscriptionActive(user)) {
    return [];
  }

  if (user?.is_admin) {
    return ['index', 'workout', 'challenge', 'mealPlan', 'profile'];
  }

  const tier = normalizeSubscriptionTier(user?.subscription_tier);
  return getSubscriptionCard(tier).tabAccess;
}

export function isPlanSelectionRoute(pathname: string): boolean {
  return pathname === PLAN_PATH;
}

export function isPublicRoute(pathname: string): boolean {
  return ALLOWED_PUBLIC_PATHS.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function getPostAuthRoute(user?: Pick<AuthUser, 'is_admin' | 'subscription_tier' | 'subscription_status'> | null): string {
  return isSubscriptionActive(user) ? '/(tabs)' : PLAN_PATH;
}

export function isRouteAllowedForPlan(pathname: string, user?: Pick<AuthUser, 'is_admin' | 'subscription_tier' | 'subscription_status'> | null): boolean {
  if (isPublicRoute(pathname) || isPlanSelectionRoute(pathname)) {
    return true;
  }

  if (isSubscriptionActive(user)) {
    if (user?.is_admin) {
      return true;
    }

    const tier = normalizeSubscriptionTier(user?.subscription_tier);
    const card = getSubscriptionCard(tier);
    return card.routeAccess.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }

  return false;
}

export function canAccessPlanRoute(pathname: string, user?: Pick<AuthUser, 'is_admin' | 'subscription_tier' | 'subscription_status'> | null): boolean {
  if (!user) {
    return false;
  }

  return isRouteAllowedForPlan(pathname, user);
}

export function canAccessFeature(
  feature: string,
  user?: Pick<AuthUser, 'is_admin' | 'subscription_tier' | 'subscription_status'> | null,
): boolean {
  if (!isSubscriptionActive(user)) {
    return false;
  }

  if (user?.is_admin) {
    return true;
  }

  const tier = normalizeSubscriptionTier(user?.subscription_tier);
  const card = getSubscriptionCard(tier);
  return card.featureAccess.includes(feature);
}
