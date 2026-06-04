import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { fetchCurrentUser, getValidAuthTokens } from './api';
import { getPostAuthRoute, isRouteAllowedForPlan } from './access';
import { appendRunLog } from './runLog';
import { replaceRoute } from './navigation';

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
          void appendRunLog({
            level: 'warning',
            title: 'Access guard redirect',
            message: `No valid session for ${routePath}; redirecting to /login.`,
            route: routePath,
            context: 'ModuleGuard',
          });
          replaceRoute(router, '/login');
          return;
        }

        const user = await fetchCurrentUser();
        if (cancelled) {
          return;
        }

        if (!isRouteAllowedForPlan(routePath, user)) {
          void appendRunLog({
            level: 'warning',
            title: 'Access guard redirect',
            message: `Plan access blocked for ${routePath}; redirecting to ${getPostAuthRoute(user)}.`,
            route: routePath,
            context: 'ModuleGuard',
          });
          replaceRoute(router, getPostAuthRoute(user));
          return;
        }
      } catch {
        if (!cancelled) {
          void appendRunLog({
            level: 'error',
            title: 'Access guard failure',
            message: `Failed to validate access for ${routePath}; redirecting to /login.`,
            route: routePath,
            context: 'ModuleGuard',
          });
          replaceRoute(router, '/login');
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
