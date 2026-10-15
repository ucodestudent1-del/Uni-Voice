import { DistributedCache } from "../utils/distributed-cache.js";

export const reportsCache = new DistributedCache<any>(60 * 1000);

export async function invalidateReportsCache(businessId: string): Promise<void> {
  const prefixes = [
    `revenue:${businessId}:`,
    `tax-summary:${businessId}`,
    `volume-trend:${businessId}`,
    `dashboard:${businessId}`,
    `dashboard-summary:${businessId}`,
    `aging:${businessId}`,
    `payment-metrics:${businessId}`,
    `revenue-report:${businessId}:`,
    `invoices-report:${businessId}:`,
    `payments-report:${businessId}:`,
    `clients-report:${businessId}:`,
    `tax-summary-report:${businessId}:`,
    `profit-loss:${businessId}:`,
  ];
  for (const prefix of prefixes) {
    await reportsCache.deleteByPattern(prefix + "*");
  }
}

export async function invalidateReportsCacheByKey(key: string): Promise<void> {
  await reportsCache.delete(key);
}
