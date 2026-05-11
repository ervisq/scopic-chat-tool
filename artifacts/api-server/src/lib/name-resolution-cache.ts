interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

function buildKey(tool: string, userId: number, term: string): string {
  return `${tool}:${userId}:${normalizeTerm(term)}`;
}

export function getCachedNameResolution<T>(tool: string, userId: number, term: string): T | null {
  const normalized = normalizeTerm(term);
  if (!normalized) return null;
  const key = buildKey(tool, userId, normalized);
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedNameResolution<T>(tool: string, userId: number, term: string, value: T): void {
  const normalized = normalizeTerm(term);
  if (!normalized) return;
  const key = buildKey(tool, userId, normalized);
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function invalidateNameResolutionCache(userId: number, tool?: string): void {
  const prefix = tool ? `${tool}:${userId}:` : `:${userId}:`;
  for (const key of cache.keys()) {
    if (tool) {
      if (key.startsWith(prefix)) cache.delete(key);
    } else {
      const parts = key.split(":");
      if (parts.length >= 2 && parts[1] === String(userId)) cache.delete(key);
    }
  }
}

export function _clearNameResolutionCacheForTests(): void {
  cache.clear();
}
