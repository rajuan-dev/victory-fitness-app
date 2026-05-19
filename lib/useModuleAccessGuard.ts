import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { fetchCurrentUser, getValidAuthTokens } from './api';
import { getPostAuthRoute, isRouteAllowedForPlan } from './access';

export function useModuleAccessGuard(routePath: string) {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const guard = async () => {
      try {
        const tokens = await getValidAuthTokens();
        if (cancelled) {
          return;
        }

        if (!tokens) {
          router.replace('/login');
          return;
        }

        const user = await fetchCurrentUser();
        if (cancelled) {
          return;
        }

        if (!isRouteAllowedForPlan(routePath, user)) {
          router.replace(getPostAuthRoute(user));
          return;
        }
      } catch {
        if (!cancelled) {
          router.replace('/login');
          return;
        }
      } finally {
        if (!cancelled) {
          setCheckingAccess(false);
        }
      }
    };

    void guard();

    return () => {
      cancelled = true;
    };
  }, [routePath, router]);

  return checkingAccess;
}
