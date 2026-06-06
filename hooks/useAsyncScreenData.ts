import { useCallback, useEffect, useRef, useState } from 'react';

type UseAsyncScreenDataOptions<T> = {
  initialData: T;
  load: () => Promise<T>;
  getErrorMessage?: (error: unknown) => string;
  onSuccess?: (data: T) => void;
  skipInitialLoad?: boolean;
};

export function useAsyncScreenData<T>({
  initialData,
  load,
  getErrorMessage,
  onSuccess,
  skipInitialLoad = false,
}: UseAsyncScreenDataOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(!skipInitialLoad);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);
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
    async (isRefresh = false) => {
      if (!mountedRef.current) {
        return initialData;
      }

      if (isRefresh && hasLoadedRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const nextData = await loadRef.current();
        if (!mountedRef.current) {
          return nextData;
        }

        hasLoadedRef.current = true;
        setData(nextData);
        onSuccessRef.current?.(nextData);
        return nextData;
      } catch (loadError) {
        if (mountedRef.current) {
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
    [initialData]
  );

  useEffect(() => {
    if (skipInitialLoad) {
      return;
    }

    void run().catch(() => {
      // The hook already stores the error in state; swallow the effect-level rejection.
    });
  }, [run, skipInitialLoad]);

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
