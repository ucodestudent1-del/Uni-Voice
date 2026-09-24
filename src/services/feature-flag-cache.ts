import { TtlCache } from "../utils/ttl-cache.js";
import type { FeatureFlag } from "../domain/subscription.js";

export const featureFlagCache = new TtlCache<FeatureFlag | null>(10 * 60 * 1000);

export function invalidateFeatureFlagCache(featureCode: string): void {
  featureFlagCache.delete(featureCode);
}

export function clearFeatureFlagCache(): void {
  featureFlagCache.clear();
}
