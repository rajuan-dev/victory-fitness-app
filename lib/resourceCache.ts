import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEnvelope<T> = {
  data: T;
  updatedAt: number;
};

const STORAGE_PREFIX = 'victory-resource-cache:';
const memoryCache = new Map<string, CacheEnvelope<unknown>>();
const hydrationPromises = new Map<string, Promise<unknown | null>>();
const requestPromises = new Map<string, Promise<unknown>>();

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function getCachedResourceSnapshot<T>(key: string): T | undefined {
  const entry = memoryCache.get(key);
  return entry ? (entry.data as T) : undefined;
}

export async function hydrateCachedResource<T>(key: string): Promise<T | null> {
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!.data as T;
  }

  const existingPromise = hydrationPromises.get(key);
  if (existingPromise) {
    return (await existingPromise) as T | null;
  }

  const nextPromise = AsyncStorage.getItem(getStorageKey(key))
    .then((raw) => {
      if (!raw) {
        return null;
      }

      const envelope = JSON.parse(raw) as CacheEnvelope<T>;
      if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) {
        return null;
      }

      memoryCache.set(key, envelope as CacheEnvelope<unknown>);
      return envelope.data;
    })
    .catch(() => null)
    .finally(() => {
      hydrationPromises.delete(key);
    });

  hydrationPromises.set(key, nextPromise);
  return (await nextPromise) as T | null;
}

export async function primeCachedResource<T>(key: string, data: T, persist = true) {
  const envelope: CacheEnvelope<T> = {
    data,
    updatedAt: Date.now(),
  };

  memoryCache.set(key, envelope as CacheEnvelope<unknown>);

  if (!persist) {
    return data;
  }

  await AsyncStorage.setItem(getStorageKey(key), JSON.stringify(envelope));
  return data;
}

export async function clearCachedResource(key: string) {
  memoryCache.delete(key);
  hydrationPromises.delete(key);
  requestPromises.delete(key);
  await AsyncStorage.removeItem(getStorageKey(key));
}

export async function clearAllCachedResources() {
  const keys = await AsyncStorage.getAllKeys();
  const resourceKeys = keys.filter((key) => key.startsWith(STORAGE_PREFIX));
  memoryCache.clear();
  hydrationPromises.clear();
  requestPromises.clear();
  if (resourceKeys.length > 0) {
    await AsyncStorage.multiRemove(resourceKeys);
  }
}

export async function fetchCachedResource<T>(
  key: string,
  load: () => Promise<T>,
  options?: { persist?: boolean }
): Promise<T> {
  const existingPromise = requestPromises.get(key);
  if (existingPromise) {
    return (await existingPromise) as T;
  }

  const nextPromise = load()
    .then(async (data) => {
      await primeCachedResource(key, data, options?.persist !== false);
      return data;
    })
    .finally(() => {
      requestPromises.delete(key);
    });

  requestPromises.set(key, nextPromise);
  return (await nextPromise) as T;
}

export async function prefetchCachedResources(
  resources: Array<{
    key: string;
    load: () => Promise<unknown>;
    persist?: boolean;
  }>
) {
  await Promise.allSettled(
    resources.map((resource) =>
      fetchCachedResource(resource.key, resource.load, { persist: resource.persist })
    )
  );
}
