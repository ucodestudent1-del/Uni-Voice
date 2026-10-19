import type { SubscriptionCache } from "@/types/app";

const CACHE_TTL = 60 * 1000;
const subscriptionCache = new Map<string, SubscriptionCache>();

export function getCachedSubscription(businessId?: string): SubscriptionCache | null {
  if (!businessId) return null;
  const cached = subscriptionCache.get(businessId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    subscriptionCache.delete(businessId);
    return null;
  }
  return cached;
}

export function setCachedSubscription(businessId: string, data: SubscriptionCache): void {
  subscriptionCache.set(businessId, data);
}

export function clearSubscriptionCache(businessId?: string): void {
  if (businessId) {
    subscriptionCache.delete(businessId);
  } else {
    subscriptionCache.clear();
  }
}
