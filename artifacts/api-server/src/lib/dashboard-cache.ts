interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const TTL_MS = 60_000;
const cache = new Map<number, CacheEntry>();

export function getCachedDashboard(userId: number): unknown | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(userId);
    return null;
  }
  return entry.data;
}

export function setCachedDashboard(userId: number, data: unknown): void {
  cache.set(userId, { data, expiresAt: Date.now() + TTL_MS });
}

export function invalidateDashboardCache(userId: number): void {
  cache.delete(userId);
}
