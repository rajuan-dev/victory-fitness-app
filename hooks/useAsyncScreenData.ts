import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCachedResource, getCachedResourceSnapshot, hydrateCachedResource } from '../lib/resourceCache';

type UseAsyncScreenDataOptions<T> = {
  initialData: T;
  load: () => Promise<T>;
  getErrorMessage?: (error: unknown) => string;
  onSuccess?: (data: T) => void;
  skipInitialLoad?: boolean;
  cacheKey?: string;
  persistCachedData?: boolean;
};

export function useAsyncScreenData<T>({
  initialData,
  load,
  getErrorMessage,
  onSuccess,
  skipInitialLoad = false,
  cacheKey,
  persistCachedData = true,
}: UseAsyncScreenDataOptions<T>) {
  const cachedSnapshot = cacheKey ? getCachedResourceSnapshot<T>(cacheKey) : undefined;
  const [data, setData] = useState<T>(cachedSnapshot ?? initialData);
  const [loading, setLoading] = useState(!skipInitialLoad && !cachedSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(Boolean(cachedSnapshot));
  const mountedRef = useRef(true);
  const loadRef = useRef(load);
  const getErrorMessageRef = useRef(getErrorMessage);
  const onSuccessRef = useRef(onSuccess);

  loadRef.current = load;
  getErrorMessageRef.current = getErrorMessage;
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (isRefresh = false, silent = false) => {
      if (!mountedRef.current) {
        return initialData;
      }

      if (!silent && isRefresh && hasLoadedRef.current) {
        setRefreshing(true);
      } else if (!silent) {
        setLoading(true);
      }
      setError('');

      try {
        const nextData = cacheKey
          ? await fetchCachedResource(cacheKey, loadRef.current, { persist: persistCachedData })
          : await loadRef.current();
        if (!mountedRef.current) {
          return nextData;
        }

        hasLoadedRef.current = true;
        setData(nextData);
        onSuccessRef.current?.(nextData);
        return nextData;
      } catch (loadError) {
        if (mountedRef.current && !silent) {
          setError(
            getErrorMessageRef.current
              ? getErrorMessageRef.current(loadError)
              : loadError instanceof Error
                ? loadError.message
                : 'Something went wrong.'
          );
        }
        throw loadError;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [cacheKey, initialData, persistCachedData]
  );

  useEffect(() => {
    if (skipInitialLoad) {
      return;
    }

    let cancelled = false;

    void (async () => {
      let hasHydratedCache = false;

      if (cacheKey) {
        const hydratedData = await hydrateCachedResource<T>(cacheKey);
        if (cancelled || !mountedRef.current) {
          return;
        }

        if (hydratedData !== null) {
          hasHydratedCache = true;
          hasLoadedRef.current = true;
          setData(hydratedData);
          setLoading(false);
          onSuccessRef.current?.(hydratedData);
        }
      }

      void run(false, Boolean(cachedSnapshot) || hasHydratedCache).catch(() => {
        // The hook already stores the error in state; swallow the effect-level rejection.
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, cachedSnapshot, run, skipInitialLoad]);

  return {
    data,
    error,
    loading,
    refreshing,
    hasLoaded: hasLoadedRef.current,
    reload: useCallback(() => run(true), [run]),
    setData,
    setError,
  };
}
