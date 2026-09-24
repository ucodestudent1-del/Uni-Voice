import { TtlCache } from "../utils/ttl-cache.js";

export const reportsCache = new TtlCache<any>(60 * 1000);

export function invalidateReportsCache(businessId: string): void {
  reportsCache.delete(`revenue:${businessId}`);
  reportsCache.delete(`tax-summary:${businessId}`);
  reportsCache.delete(`volume-trend:${businessId}`);
  reportsCache.delete(`dashboard:${businessId}`);
}

export function invalidateReportCacheByPattern(pattern: string): void {
  const prefix = pattern.replace(/\*$/, "");
  for (const key of reportsCache["cache"].keys()) {
    if (typeof key === "string" && key.startsWith(prefix)) {
      reportsCache.delete(key);
    }
  }
}
