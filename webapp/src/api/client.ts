import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import type {
  TwoFactorSetupResult,
  TwoFactorVerifyResult,
  TwoFactorStatus,
  RecoveryCodeSummary,
  InvoiceSearchParams,
  ApiReminderConfig,
  ApiReminderTemplate,
  ApiEnhancedDashboard,
  ApiPaymentWithInvoice,
  ApiPaymentSummary,
  ApiPaymentDetail,
  ApiPaymentEvent,
  ReportFiltersParams,
  ApiDashboardSummary,
  ApiRevenueReport,
  ApiInvoicesReport,
  ApiPaymentsReport,
  ApiClientsReport,
  ApiTaxSummaryReport,
  ApiProfitLossReport,
  ApiAgingReport,
  ApiPaymentMetrics,
} from "../types/api";

// Re-export types from types/api
export type {
  InvoiceSearchParams,
  ApiReminderConfig,
  ApiReminderTemplate,
  ApiEnhancedDashboard,
  ApiPaymentWithInvoice,
  ApiPaymentSummary,
  ApiPaymentDetail,
  ApiPaymentEvent,
  ReportFiltersParams,
  ApiDashboardSummary,
  ApiRevenueReport,
  ApiInvoicesReport,
  ApiPaymentsReport,
  ApiClientsReport,
  ApiTaxSummaryReport,
  ApiProfitLossReport,
  ApiAgingReport,
};

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const responseCache = new Map<string, CacheEntry>();

function cacheKey(url: string, params: Record<string, unknown> | undefined): string {
  if (!params) return url;
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return url;
  const qs = entries.map(([k, v]) => `${k}=${String(v)}`).join("&");
  return `${url}?${qs}`;
}

export function getCacheKey(url: string, params?: Record<string, unknown>): string {
  return cacheKey(url, params);
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    responseCache.clear();
    return;
  }
  const prefix = pattern.replace(/\*$/, "");
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}

export function invalidateCacheByKey(url: string): void {
  for (const key of responseCache.keys()) {
    if (key.startsWith(url)) {
      responseCache.delete(key);
    }
  }
}

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const contentType = response.headers["content-type"];
    const responseType = response.config?.responseType;
    if (
      responseType !== "blob" &&
      responseType !== "arraybuffer" &&
      typeof contentType === "string" &&
      !contentType.includes("application/json") &&
      !contentType.includes("text/")
    ) {
      return Promise.reject(new Error("Unexpected response format"));
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const skipRedirect = error.config?.skipAuthRedirect === true;
    if (status === 401 && !skipRedirect) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
  return Promise.reject(error);
}
);

interface CachedGetOptions {
  ttlMs?: number;
  skipCache?: boolean;
}

export async function cachedGet(
  url: string,
  params?: Record<string, unknown>,
  options?: CachedGetOptions
): Promise<any> {
  const key = cacheKey(url, params);
  const ttl = options?.ttlMs ?? CACHE_TTL_MS;
  if (!options?.skipCache) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }
  const res = await api.get(url, { params });
  responseCache.set(key, { data: res.data, expiresAt: Date.now() + ttl });
  return res.data;
}

export async function login(email: string, password: string) {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}

export async function verifyTwoFactor(email: string, code: string): Promise<TwoFactorVerifyResult> {
  const res = await api.post<TwoFactorVerifyResult>(
    "/auth/2fa/verify",
    { email, code },
    { skipAuthRedirect: true } as AxiosRequestConfig
  );
  return res.data;
}

export async function getTwoFactorStatus(): Promise<{
  status: TwoFactorStatus;
  recoveryCodes: RecoveryCodeSummary;
}> {
  const res = await api.get("/auth/2fa/status");
  return res.data;
}

export async function setupTwoFactor(): Promise<TwoFactorSetupResult> {
  const res = await api.post("/auth/2fa/setup");
  return res.data;
}

export async function enableTwoFactor(code: string): Promise<{ enabled: boolean }> {
  const res = await api.post("/auth/2fa/enable", { code });
  return res.data;
}

export async function disableTwoFactor(): Promise<{ disabled: boolean }> {
  const res = await api.delete("/auth/2fa");
  return res.data;
}

export async function regenerateRecoveryCodes(): Promise<{ recoveryCodes: string[] }> {
  const res = await api.post("/auth/2fa/recovery-codes/regenerate");
  return res.data;
}

export async function register(email: string, password: string, name: string, countryCode?: string, defaultCurrency?: string) {
  const res = await api.post("/auth/register", { email, password, name, countryCode, defaultCurrency });
  return res.data;
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function getPlans() {
  const res = await api.get("/plans");
  return res.data;
}

export async function getSubscription() {
  const res = await api.get("/subscription/current");
  return res.data;
}

export async function upgradeSubscription(planCode: string) {
  const res = await api.post("/subscription/upgrade", { planCode });
  return res.data;
}

export async function downgradeSubscription(planCode: string) {
  const res = await api.post("/subscription/downgrade", { planCode });
  return res.data;
}

export async function getStripeConfig() {
  const res = await api.get("/stripe/config");
  return res.data;
}

export async function getInvoices(params?: { status?: string; customerId?: string; search?: string; limit?: number; offset?: number }) {
  const res = await cachedGet("/invoices", params as Record<string, unknown> | undefined, { ttlMs: 30 * 1000 });
  return res;
}

export async function getInvoice(id: string) {
  const res = await cachedGet(`/invoices/${id}`, undefined, { ttlMs: 15 * 1000 });
  return res;
}

export async function createInvoice(data: any) {
  const res = await api.post("/invoices", data);
  invalidateCache("/invoices?");
  invalidateCacheByKey("/invoices/");
  return res.data;
}

export async function updateInvoice(id: string, data: any) {
  const res = await api.patch(`/invoices/${id}`, data);
  invalidateCacheByKey("/invoices");
  return res.data;
}

export interface InvoiceAttachmentPayload {
  name: string;
  size: number;
  type?: string | null;
  category: "attachment" | "before" | "after";
  dataUrl?: string | null;
}

export async function setInvoiceAttachments(id: string, attachments: InvoiceAttachmentPayload[]) {
  const res = await api.put(`/invoices/${id}/attachments`, { attachments });
  invalidateCacheByKey(`/invoices/${id}`);
  return res.data;
}

export async function sendInvoiceSms(id: string, to?: string) {
  const res = await api.post(`/invoices/${id}/sms`, to ? { to } : {});
  return res.data;
}

export interface FinalizeInvoiceResult {
  invoiceNumber: string;
  publicToken?: string | null;
}

export async function finalizeInvoice(id: string): Promise<FinalizeInvoiceResult> {
  const res = await api.post(`/invoices/${id}/finalize`);
  invalidateCacheByKey(`/invoices/${id}`);
  invalidateCache("/invoices?");
  return res.data;
}

export interface SendInvoiceResult {
  publicToken: string;
  status: string;
}

export async function sendInvoice(id: string): Promise<SendInvoiceResult> {
  const res = await api.post(`/invoices/${id}/send`);
  invalidateCacheByKey(`/invoices/${id}`);
  invalidateCache("/invoices?");
  return res.data;
}

export async function duplicateInvoice(id: string) {
  const res = await api.post(`/invoices/${id}/duplicate`);
  invalidateCache("/invoices?");
  return res.data;
}

export async function getInvoicePdf(id: string) {
  const res = await api.post(`/invoices/${id}/pdf`, {}, { responseType: "blob" });
  return res.data;
}

export async function getInvoiceEvents(id: string) {
  const res = await api.get(`/invoices/${id}/events`);
  return res.data;
}

export async function getInvoicePayments(id: string) {
  const res = await api.get(`/invoices/${id}/payments`);
  return res.data;
}

export async function sendReminder(id: string) {
  const res = await api.post(`/invoices/${id}/send-reminder`);
  return res.data;
}

export async function cancelInvoice(id: string, data?: { reason?: string }) {
  const res = await api.post(`/invoices/${id}/cancel`, data ?? {});
  return res.data;
}

export async function voidInvoice(id: string, data?: { reason?: string }) {
  const res = await api.post(`/invoices/${id}/void`, data ?? {});
  return res.data;
}

export async function deleteInvoice(id: string) {
  const res = await api.delete(`/invoices/${id}`);
  invalidateCache("/invoices?");
  invalidateCacheByKey(`/invoices/${id}`);
  return res.data;
}

export async function createPaymentIntent(id: string) {
  const res = await api.post(`/invoices/${id}/payment-intent`);
  return res.data;
}

export async function getDashboardData() {
  const res = await cachedGet("/dashboard", undefined, { ttlMs: 60 * 1000 });
  return res;
}

export async function payInvoicePublic(token: string, data: { amount: number; provider?: string; idempotencyKey?: string }) {
  const res = await api.post(`/public/invoices/${token}/pay`, data);
  return res.data;
}

export async function createPaymentIntentPublic(token: string) {
  const res = await api.post(`/public/invoices/${token}/payment-intent`);
  return res.data;
}

export interface CustomerSearchParams {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  includeArchived?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  enrich?: boolean;
}

export async function getCustomers(params?: CustomerSearchParams) {
  const res = await cachedGet("/customers", params as Record<string, unknown> | undefined, { ttlMs: 60 * 1000 });
  return res;
}

export async function createCustomer(data: any) {
  const res = await api.post("/customers", data);
  return res.data;
}

export async function updateCustomer(id: string, data: any) {
  const res = await api.patch(`/customers/${id}`, data);
  return res.data;
}

export async function archiveCustomer(id: string) {
  const res = await api.post(`/customers/${id}/archive`);
  return res.data;
}

export async function restoreCustomer(id: string) {
  const res = await api.post(`/customers/${id}/restore`);
  return res.data;
}

export async function deleteCustomer(id: string) {
  const res = await api.delete(`/customers/${id}`);
  return res.data;
}

export async function getCustomer(id: string) {
  const res = await api.get(`/customers/${id}`);
  return res.data;
}

export async function importCustomers(csv: string) {
  const res = await api.post(`/customers/import`, { csv });
  return res.data;
}

export async function getCustomerInvoices(customerId: string, params?: { limit?: number; offset?: number; status?: string }) {
  const res = await api.get(`/customers/${customerId}/invoices`, { params });
  return res.data;
}

export async function getCustomerSummary(customerId: string) {
  const res = await api.get(`/customers/${customerId}/summary`);
  return res.data;
}

export async function getCustomerBalance(customerId: string) {
  const res = await api.get(`/customers/${customerId}/balance`);
  return res.data;
}

export async function getCustomerEvents(customerId: string, params?: { limit?: number }) {
  const res = await api.get(`/customers/${customerId}/events`, { params });
  return res.data;
}

export async function exportCustomersCsv() {
  const res = await api.get("/customers/export", { responseType: "blob" });
  return res.data;
}

export function buildCustomerSearchParams(params: CustomerSearchParams): Record<string, any> {
  const result: Record<string, any> = {};
  if (params.limit !== undefined) result.limit = params.limit;
  if (params.offset !== undefined) result.offset = params.offset;
  if (params.search !== undefined) result.search = params.search;
  if (params.status !== undefined) result.status = params.status;
  if (params.includeArchived !== undefined) result.includeArchived = params.includeArchived;
  if (params.sortBy !== undefined) result.sortBy = params.sortBy;
  if (params.sortOrder !== undefined) result.sortOrder = params.sortOrder;
  return result;
}

export async function getProducts(params?: { limit?: number; offset?: number }) {
  const res = await cachedGet("/products", params as Record<string, unknown> | undefined, { ttlMs: 60 * 1000 });
  return res;
}

export async function createProduct(data: any) {
  const res = await api.post("/products", data);
  return res.data;
}

export async function updateProduct(id: string, data: any) {
  const res = await api.patch(`/products/${id}`, data);
  return res.data;
}

export async function deleteProduct(id: string) {
  const res = await api.delete(`/products/${id}`);
  return res.data;
}

export async function createInvoiceFromProduct(productId: string): Promise<{ invoiceId: string }> {
  const res = await api.post(`/products/${productId}/use-as-line-item?type=invoice`);
  return res.data;
}

export async function getBusiness() {
  const res = await api.get("/businesses/current");
  return res.data;
}

export async function updateBusiness(data: any) {
  const res = await api.patch("/businesses/current", data);
  return res.data;
}

export async function exportInvoicesCsv() {
  const res = await api.get("/export/invoices/csv", { responseType: "blob" });
  return res.data;
}

export async function getFeatures() {
  const res = await api.get("/features");
  return res.data;
}

export async function getTemplates(params?: { limit?: number; offset?: number }) {
  const res = await api.get("/templates", { params });
  return res.data;
}

export async function getTemplate(id: string) {
  const res = await api.get(`/templates/${id}`);
  return res.data;
}

export async function createTemplate(data: any) {
  const res = await api.post("/templates", data);
  return res.data;
}

export async function updateTemplate(id: string, data: any) {
  const res = await api.patch(`/templates/${id}`, data);
  return res.data;
}

export async function deleteTemplate(id: string) {
  const res = await api.delete(`/templates/${id}`);
  return res.data;
}

export async function getDocumentTemplates(params?: {
  limit?: number;
  offset?: number;
  industry?: string;
  isDefault?: boolean;
}) {
  const res = await api.get("/document-templates", { params });
  return res.data;
}

export async function createDocumentTemplate(data: any) {
  const res = await api.post("/document-templates", data);
  return res.data;
}

export async function getDocumentTemplate(id: string) {
  const res = await api.get(`/document-templates/${id}`);
  return res.data;
}

export async function updateDocumentTemplate(id: string, data: any) {
  const res = await api.patch(`/document-templates/${id}`, data);
  return res.data;
}

export async function deleteDocumentTemplate(id: string) {
  const res = await api.delete(`/document-templates/${id}`);
  return res.data;
}

export async function duplicateDocumentTemplate(id: string) {
  const res = await api.post(`/document-templates/${id}/duplicate`);
  return res.data;
}

export async function setDefaultDocumentTemplate(id: string) {
  const res = await api.post(`/document-templates/${id}/set-default`);
  return res.data;
}

export async function getNumberingConfig() {
  const res = await api.get("/businesses/current/numbering");
  return res.data;
}

export async function updateNumberingConfig(data: any) {
  const res = await api.patch("/businesses/current/numbering", data);
  return res.data;
}

export async function getPayments(invoiceId: string) {
  const res = await api.get(`/invoices/${invoiceId}/payments`);
  return res.data;
}

export async function recordPayment(invoiceId: string, data: { amount: number; provider?: string; providerPaymentId?: string; idempotencyKey?: string }) {
  const res = await api.post(`/invoices/${invoiceId}/payments`, data);
  return res.data;
}

export async function getPaymentsByBusiness(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  provider?: string;
  search?: string;
}) {
  const res = await api.get("/payments", { params });
  return res.data;
}

export async function getPaymentSummary() {
  const res = await api.get("/payments/summary");
  return res.data;
}

export async function getPayment(id: string) {
  const res = await api.get(`/payments/${id}`);
  return res.data;
}

export async function refundPayment(paymentId: string, data: { amount: number; reason?: string }) {
  const res = await api.post(`/payments/${paymentId}/refund`, data);
  return res.data;
}

export async function recordPaymentManually(data: {
  invoiceId: string;
  amount: number;
  provider?: string;
  providerPaymentId?: string;
  idempotencyKey?: string;
}) {
  const res = await api.post(`/payments/record`, data);
  return res.data;
}

export async function getPublicInvoice(token: string) {
  const res = await api.get(`/public/invoices/${token}`);
  return res.data;
}

export async function recordPublicView(token: string) {
  const res = await api.post(`/public/invoices/${token}/view`);
  return res.data;
}

export async function getPublicInvoicePdf(token: string) {
  const res = await api.get(`/public/invoices/${token}/pdf`, { responseType: "blob" });
  return res.data;
}

export async function getOnboarding() {
  const res = await api.get("/onboarding");
  return res.data;
}

export async function completeOnboardingStep(step: string) {
  const res = await api.post(`/onboarding/step/${step}/complete`);
  return res.data;
}

export async function startOnboardingStep(step: string) {
  const res = await api.post(`/onboarding/step/${step}/start`);
  return res.data;
}

export async function skipOnboardingStep(step: string) {
  const res = await api.post(`/onboarding/step/${step}/skip`);
  return res.data;
}

export async function finishOnboarding() {
  const res = await api.post("/onboarding/complete");
  return res.data;
}

export interface InvoiceTemplateListParams {
  limit?: number;
  offset?: number;
  industry?: string;
  documentType?: string;
  isDefault?: boolean;
  lifecycle?: string;
}

export async function getInvoiceTemplates(params?: InvoiceTemplateListParams) {
  const res = await api.get("/invoice-templates", { params });
  return res.data;
}

export async function getInvoiceTemplate(id: string) {
  const res = await api.get(`/invoice-templates/${id}`);
  return res.data;
}

export async function createInvoiceTemplate(data: any) {
  const res = await api.post("/invoice-templates", data);
  return res.data;
}

export async function updateInvoiceTemplate(id: string, data: any) {
  const res = await api.patch(`/invoice-templates/${id}`, data);
  return res.data;
}

export async function deleteInvoiceTemplate(id: string) {
  const res = await api.delete(`/invoice-templates/${id}`);
  return res.data;
}

export async function duplicateInvoiceTemplate(id: string) {
  const res = await api.post(`/invoice-templates/${id}/duplicate`);
  return res.data;
}

export async function setDefaultInvoiceTemplate(id: string) {
  const res = await api.post(`/invoice-templates/${id}/set-default`);
  return res.data;
}

export async function publishInvoiceTemplate(id: string, data?: { changeSummary?: string }) {
  const res = await api.post(`/invoice-templates/${id}/publish`, data ?? {});
  return res.data;
}

export async function archiveInvoiceTemplate(id: string) {
  const res = await api.post(`/invoice-templates/${id}/archive`);
  return res.data;
}

export async function unarchiveInvoiceTemplate(id: string) {
  const res = await api.post(`/invoice-templates/${id}/unarchive`);
  return res.data;
}

export async function getInvoiceTemplateRevisions(id: string) {
  const res = await api.get(`/invoice-templates/${id}/revisions`);
  return res.data;
}

export async function getInvoiceTemplateRevision(id: string, revision: number) {
  const res = await api.get(`/invoice-templates/${id}/revisions/${revision}`);
  return res.data;
}

export async function restoreInvoiceTemplateRevision(id: string, revision: number) {
  const res = await api.post(`/invoice-templates/${id}/revisions/${revision}/restore`);
  return res.data;
}

export async function getInvoiceTemplateWithRevisions(id: string) {
  const res = await api.get(`/invoice-templates/${id}/with-revisions`);
  return res.data;
}

export async function migrateInvoiceTemplate(id: string, targetVersion?: string) {
  const res = await api.post(`/invoice-templates/${id}/migrate`, targetVersion ? { targetVersion } : {});
  return res.data;
}

export async function renderInvoiceTemplateHtml(id: string, data: any) {
  const res = await api.post(`/invoice-templates/${id}/render`, data);
  return res.data;
}

export async function getInvoiceTemplateUsage(id: string) {
  const res = await api.get(`/invoice-templates/${id}/usage`);
  return res.data;
}

export async function setInvoiceTemplatePermission(templateId: string, userId: string, permission: string) {
  const res = await api.post(`/invoice-templates/${templateId}/permissions`, { userId, permission });
  return res.data;
}

export async function getInvoiceTemplatePermissions(templateId: string) {
  const res = await api.get(`/invoice-templates/${templateId}/permissions`);
  return res.data;
}

export async function recordInvoiceTemplateUsage(templateId: string, invoiceId?: string) {
  const res = await api.post(`/invoice-templates/${templateId}/usage`, invoiceId ? { invoiceId } : {});
  return res.data;
}

export async function getBusinessSettings() {
  const res = await api.get("/businesses/current/settings");
  return res.data;
}

export async function updateBusinessSettings(data: Record<string, unknown>) {
  const res = await api.patch("/businesses/current/settings", data);
  return res.data;
}

export async function getTaxRates() {
  const res = await api.get("/tax-rates");
  return res.data;
}

export async function createTaxRate(data: Record<string, unknown>) {
  const res = await api.post("/tax-rates", data);
  return res.data;
}

export async function updateTaxRate(id: string, data: Record<string, unknown>) {
  const res = await api.patch(`/tax-rates/${id}`, data);
  return res.data;
}

export async function deleteTaxRate(id: string) {
  const res = await api.delete(`/tax-rates/${id}`);
  return res.data;
}

export async function updateUserProfile(data: { email?: string }) {
  const res = await api.patch("/auth/profile", data);
  return res.data;
}

export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  const res = await api.post("/auth/change-password", data);
  return res.data;
}

export async function getUserSessions() {
  const res = await api.get("/auth/sessions");
  return res.data;
}

export async function revokeUserSession(sessionId: string) {
  const res = await api.delete(`/auth/sessions/${sessionId}`);
  return res.data;
}

export async function cancelSubscription() {
  const res = await api.post("/subscription/cancel");
  return res.data;
}

export async function getBillingInvoices() {
  const res = await api.get("/subscription/invoices");
  return res.data;
}

export async function getPaymentMethods() {
  const res = await api.get("/subscription/payment-methods");
  return res.data;
}

// ============================================================================
// PROJECTS
// ============================================================================

export interface ProjectSearchParams {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  customerId?: string;
  tagId?: string;
  includeArchived?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getProjects(params?: ProjectSearchParams) {
  const res = await api.get("/projects", { params });
  return res.data;
}

export async function searchProjects(query?: string) {
  const res = await api.get("/projects/search", { params: { q: query } });
  return res.data;
}

export async function getProject(id: string) {
  const res = await api.get(`/projects/${id}`);
  const data = res.data;
  if (data.project) {
    return {
      ...data.project,
      customer: data.customer ?? null,
      tags: data.tags ?? [],
      teamMembers: data.teamMembers ?? [],
      financial_summary: data.financialSummary ?? null,
    };
  }
  return data;
}

export async function createProject(data: any) {
  const res = await api.post("/projects", data);
  return res.data;
}

export async function updateProject(id: string, data: any) {
  const res = await api.patch(`/projects/${id}`, data);
  return res.data;
}

export async function archiveProject(id: string) {
  const res = await api.post(`/projects/${id}/archive`);
  return res.data;
}

export async function restoreProject(id: string) {
  const res = await api.post(`/projects/${id}/restore`);
  return res.data;
}

export async function updateProjectStatus(id: string, status: string) {
  const res = await api.post(`/projects/${id}/status`, { status });
  return res.data;
}

export async function deleteProject(id: string) {
  const res = await api.delete(`/projects/${id}`);
  return res.data;
}

export async function createInvoiceFromProject(projectId: string, data?: { includeUnbilledTime?: boolean; items?: any[]; fees?: any[] }) {
  const res = await api.post(`/projects/${projectId}/invoice`, data ?? {});
  return res.data;
}

export async function getProjectInvoices(projectId: string, params?: { limit?: number; offset?: number; status?: string }) {
  const res = await api.get(`/projects/${projectId}/invoices`, { params });
  return res.data;
}

export async function getProjectFinancialSummary(projectId: string) {
  const res = await api.get(`/projects/${projectId}/financial-summary`);
  return res.data;
}

export async function getProjectEvents(projectId: string, params?: { limit?: number }) {
  const res = await api.get(`/projects/${projectId}/events`, { params });
  return res.data;
}

export async function addProjectTag(projectId: string, name: string, color?: string) {
  const res = await api.post(`/projects/${projectId}/tags`, { name, color });
  return res.data;
}

export async function removeProjectTag(projectId: string, tagId: string) {
  const res = await api.delete(`/projects/${projectId}/tags/${tagId}`);
  return res.data;
}

export async function getProjectTags() {
  const res = await api.get("/projects/tags");
  return res.data;
}

export async function getProjectTeam(projectId: string) {
  const res = await api.get(`/projects/${projectId}/team`);
  return res.data;
}

export async function addProjectTeamMember(projectId: string, userId: string, role?: string) {
  const res = await api.post(`/projects/${projectId}/team`, { userId, role });
  return res.data;
}

export async function removeProjectTeamMember(projectId: string, userId: string) {
  const res = await api.delete(`/projects/${projectId}/team/${userId}`);
  return res.data;
}

// ============================================================================
// PROJECT TIME TRACKING
// ============================================================================

export async function createTimeEntry(projectId: string, data: any) {
  const res = await api.post(`/projects/${projectId}/time-entries`, data);
  return res.data;
}

export async function getTimeEntries(projectId: string, params?: {
  limit?: number;
  offset?: number;
  billable?: boolean;
  isInvoiced?: boolean;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const res = await api.get(`/projects/${projectId}/time-entries`, { params });
  return res.data;
}

export async function updateTimeEntry(entryId: string, data: any) {
  const res = await api.patch(`/time-entries/${entryId}`, data);
  return res.data;
}

export async function deleteTimeEntry(entryId: string) {
  const res = await api.delete(`/time-entries/${entryId}`);
  return res.data;
}

export async function startTimer(projectId: string, data: any) {
  const res = await api.post(`/time-entries/timer/start`, { projectId, ...data });
  return res.data;
}

export async function stopTimer(entryId: string) {
  const res = await api.post(`/time-entries/${entryId}/stop`);
  return res.data;
}

export async function getTimeEntrySummary(projectId: string, currency?: string) {
  const res = await api.get(`/projects/${projectId}/time-entries/summary`, { params: { currency } });
  return res.data;
}

// Project Notes
export async function addProjectNote(projectId: string, data: { title?: string; content: string }) {
  const res = await api.post(`/projects/${projectId}/notes`, data);
  return res.data;
}

export async function getProjectNotes(projectId: string, params?: { limit?: number; offset?: number }) {
  const res = await api.get(`/projects/${projectId}/notes`, { params });
  return res.data;
}

export async function deleteProjectNote(projectId: string, noteId: string) {
  const res = await api.delete(`/projects/${projectId}/notes/${noteId}`);
  return res.data;
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes === 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function buildProjectSearchParams(params: ProjectSearchParams): Record<string, any> {
  const result: Record<string, any> = {};
  if (params.limit !== undefined) result.limit = params.limit;
  if (params.offset !== undefined) result.offset = params.offset;
  if (params.search !== undefined) result.search = params.search;
  if (params.status !== undefined) result.status = params.status;
  if (params.customerId !== undefined) result.customerId = params.customerId;
  if (params.tagId !== undefined) result.tagId = params.tagId;
  if (params.includeArchived !== undefined) result.includeArchived = params.includeArchived;
  if (params.sortBy !== undefined) result.sortBy = params.sortBy;
  if (params.sortOrder !== undefined) result.sortOrder = params.sortOrder;
  return result;
}

// ============================================================================
// INVOICE SEARCH (Enhanced)
// ============================================================================

export async function getInvoicesEnhanced(params?: InvoiceSearchParams) {
  const res = await api.get("/invoices", { params });
  return res.data;
}

export function buildInvoiceSearchParams(params: InvoiceSearchParams): Record<string, any> {
  const result: Record<string, any> = {};
  if (params.limit !== undefined) result.limit = params.limit;
  if (params.offset !== undefined) result.offset = params.offset;
  if (params.status !== undefined) result.status = params.status;
  if (params.paymentState !== undefined) result.payment_state = params.paymentState;
  if (params.customerId !== undefined) result.customer_id = params.customerId;
  if (params.customerName !== undefined) result.customer_name = params.customerName;
  if (params.search !== undefined) result.search = params.search;
  if (params.currency !== undefined) result.currency = params.currency;
  if (params.minAmount !== undefined) result.min_amount = params.minAmount;
  if (params.maxAmount !== undefined) result.max_amount = params.maxAmount;
  if (params.issueDateFrom !== undefined) result.issue_date_from = params.issueDateFrom;
  if (params.issueDateTo !== undefined) result.issue_date_to = params.issueDateTo;
  if (params.dueDateFrom !== undefined) result.due_date_from = params.dueDateFrom;
  if (params.dueDateTo !== undefined) result.due_date_to = params.dueDateTo;
  if (params.sortBy !== undefined) result.sort_by = params.sortBy;
  if (params.sortOrder !== undefined) result.sort_order = params.sortOrder;
  return result;
}

// ============================================================================
// REMINDERS
// ============================================================================

export async function getReminderConfig() {
  const res = await api.get("/businesses/current/settings");
  return res.data;
}

export async function updateReminderConfig(data: Partial<ApiReminderConfig>) {
  const res = await api.patch("/businesses/current/settings", { reminders: data });
  return res.data;
}

export async function getReminderTemplates() {
  const res = await api.get("/reminder-templates");
  return res.data;
}

export async function createReminderTemplate(data: { name: string; subject: string; message: string }) {
  const res = await api.post("/reminder-templates", data);
  return res.data;
}

export async function updateReminderTemplate(id: string, data: Partial<ApiReminderTemplate>) {
  const res = await api.patch(`/reminder-templates/${id}`, data);
  return res.data;
}

export async function deleteReminderTemplate(id: string) {
  const res = await api.delete(`/reminder-templates/${id}`);
  return res.data;
}

// ============================================================================
// DEPOSITS
// ============================================================================

export async function setInvoiceDeposit(id: string, data: { depositType: "fixed" | "percentage" | "none"; depositValue: string; depositDueDate?: string }) {
  const res = await api.patch(`/invoices/${id}/deposit`, data);
  return res.data;
}

export async function recordDepositPayment(id: string, data: { amount: number; provider?: string; idempotencyKey?: string }) {
  const res = await api.post(`/invoices/${id}/deposit/pay`, data);
  return res.data;
}

// ============================================================================
// ENHANCED REPORTS / DASHBOARD
// ============================================================================

export async function getEnhancedDashboard() {
  const res = await cachedGet("/reports/dashboard", undefined, { ttlMs: 45 * 1000 });
  return res;
}

export async function getPaymentMetricsReport(): Promise<ApiPaymentMetrics | null> {
  try {
    const res = await api.get("/reports/payment-metrics");
    return res.data;
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) {
      console.warn("Payment metrics report endpoint not available");
    } else {
      console.error("Failed to load payment metrics:", err);
    }
    return null;
  }
}

export async function getVolumeTrendReport(params?: { period?: "day" | "week" | "month"; months?: number }) {
  const res = await api.get("/reports/volume-trend", { params });
  return res.data;
}

export async function exportInvoicesJson() {
  const res = await api.get("/export/invoices/json", { responseType: "blob" });
  return res.data;
}

// ============================================================================
// RECEIPTS
// ============================================================================

export interface ReceiptSearchParams {
  limit?: number;
  offset?: number;
  status?: string;
  provider?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ApiReceipt {
  id: string;
  invoice_id: string;
  business_id: string;
  payment_id?: string | null;
  receipt_number?: string | null;
  amount: string;
  currency: string;
  status: string;
  provider: string;
  provider_receipt_url?: string | null;
  sent_to?: string | null;
  issued_at?: string | null;
  created_at: string;
  updated_at: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  business_name?: string | null;
}

export interface ApiReceiptSummary {
  totalReceipts: string;
  receiptsThisMonth: string;
  issuedAmount: string;
  sentAmount: string;
  failedAmount: string;
  totalCount: number;
  issuedCount: number;
  sentCount: number;
  failedCount: number;
  currency: string;
}

export async function getReceipts(params?: ReceiptSearchParams): Promise<{ receipts: ApiReceipt[]; total: number; limit: number; offset: number }> {
  const res = await api.get("/receipts", { params });
  return res.data;
}

export async function getReceiptSummary(): Promise<ApiReceiptSummary> {
  const res = await api.get("/receipts/summary");
  return res.data;
}

export async function getReceiptById(id: string): Promise<{ receipt: ApiReceipt }> {
  const res = await api.get(`/receipts/${id}`);
  return res.data;
}

export async function getReceiptPdf(id: string) {
  const res = await api.get(`/receipts/${id}/pdf`, { responseType: "blob" });
  return res.data;
}

export interface ApiReceiptItem {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  tax_rate: string;
  tax_amount: string;
  line_total: string;
  is_tax_inclusive: boolean;
}

export interface ApiReceiptPayment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  method?: string | null;
  provider: string;
  provider_payment_id?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApiReceiptDetail extends ApiReceipt {
  invoice_status?: string | null;
  invoice_due_date?: string | null;
  invoice_issue_date?: string | null;
  invoice_total?: string;
  invoice_subtotal?: string;
  invoice_discount_total?: string;
  invoice_tax_total?: string;
  invoice_fee_total?: string;
  invoice_amount_paid?: string;
  invoice_amount_due?: string;
  invoice_notes?: string | null;
  payment?: ApiReceiptPayment | null;
  items?: ApiReceiptItem[];
}

export async function getReceiptDetail(id: string): Promise<{ receipt: ApiReceiptDetail }> {
  const res = await api.get(`/receipts/${id}/detail`);
  return res.data;
}

export async function emailReceipt(
  receiptId: string,
  data: {
    email: string;
    name?: string;
    subject?: string;
    message?: string;
  }
): Promise<{ ok: boolean; messageId: string; status: string }> {
  const res = await api.post(`/receipts/${receiptId}/email`, data);
  return res.data;
}

export async function refundReceipt(
  receiptId: string,
  data: {
    amount: string;
    reason?: string;
  }
): Promise<{ status: string; refundId?: string }> {
  const res = await api.post(`/receipts/${receiptId}/refund`, data);
  return res.data;
}

export async function generateInvoiceReceipt(invoiceId: string, data?: { sentTo?: string; provider?: string }) {
  const res = await api.post(`/invoices/${invoiceId}/receipts`, data ?? {});
  return res.data;
}

// ============================================================================
// TEAM / RBAC
// ============================================================================

export type TeamRole = "owner" | "admin" | "member" | "viewer";

export interface ApiTeamMember {
  id: string;
  business_id: string;
  user_id: string;
  email?: string | null;
  name?: string | null;
  role: TeamRole;
  status: "active" | "pending" | "invited";
  invited_by?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getTeam(): Promise<{ team: ApiTeamMember[] }> {
  const res = await api.get("/businesses/current/team");
  return res.data;
}

export async function inviteTeamMember(data: {
  email: string;
  role: TeamRole;
  message?: string;
}): Promise<{ member: ApiTeamMember }> {
  const res = await api.post("/businesses/current/team", { ...data, action: "invite" });
  return res.data;
}

export async function updateTeamMember(memberId: string, data: { role?: TeamRole }): Promise<{ member: ApiTeamMember }> {
  const res = await api.patch(`/businesses/current/team/${memberId}`, data);
  return res.data;
}

export async function removeTeamMember(memberId: string): Promise<{ removed: boolean }> {
  const res = await api.delete(`/businesses/current/team/${memberId}`);
  return res.data;
}

export async function resendTeamInvite(memberId: string): Promise<{ member: ApiTeamMember }> {
  const res = await api.post(`/businesses/current/team/${memberId}/resend`);
  return res.data;
}

// ============================================================================
// STRIPE CONFIG (typed)
// ============================================================================

export interface StripeConfig {
  publishableKey: string | null;
}

export async function getStripeConfigTyped(): Promise<StripeConfig> {
  const res = await api.get("/stripe/config");
  return res.data;
}

// ============================================================================
// ENHANCED REPORTS — dashboard, revenue, invoices, payments,
// clients, tax summary, profit & loss, aging
// ============================================================================

export async function getDashboardSummary(): Promise<ApiDashboardSummary> {
  const res = await api.get("/reports/dashboard");
  return res.data.summary;
}

export async function getRevenueReport(params?: ReportFiltersParams): Promise<ApiRevenueReport> {
  const res = await api.get("/reports/revenue", { params: buildReportParams(params) });
  return res.data;
}

export async function getInvoicesReport(params?: ReportFiltersParams): Promise<ApiInvoicesReport> {
  const res = await api.get("/reports/invoices", { params: buildReportParams(params) });
  return res.data;
}

export async function getPaymentsReport(params?: ReportFiltersParams): Promise<ApiPaymentsReport> {
  const res = await api.get("/reports/payments", { params: buildReportParams(params) });
  return res.data;
}

export async function getClientsReport(params?: ReportFiltersParams): Promise<ApiClientsReport> {
  const res = await api.get("/reports/clients", { params: buildReportParams(params) });
  return res.data;
}

export async function getTaxSummaryReport(params?: ReportFiltersParams): Promise<ApiTaxSummaryReport> {
  const res = await api.get("/reports/tax-summary", { params: buildReportParams(params) });
  return res.data;
}

export async function getProfitLossReport(params?: ReportFiltersParams): Promise<ApiProfitLossReport> {
  const res = await api.get("/reports/profit-loss", { params: buildReportParams(params) });
  return res.data;
}

export async function getAgingReport(): Promise<ApiAgingReport | null> {
  try {
    const res = await api.get("/reports/aging");
    return res.data;
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) {
      console.warn("Aging report endpoint not available");
    } else {
      console.error("Failed to load aging report:", err);
    }
    return null;
  }
}

export async function exportReportCsv(reportType: string, params?: ReportFiltersParams): Promise<Blob> {
  const res = await api.get(`/reports/${reportType}/csv`, {
    params: buildReportParams(params),
    responseType: "blob",
  });
  return res.data;
}

function buildReportParams(params?: ReportFiltersParams): Record<string, any> {
  if (!params) return {};
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      result[key] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================================
// AI DOCUMENT PARSING (natural-language to structured fields)
// ============================================================================

export interface ApiParsedLineItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  taxRate?: number;
  isTaxInclusive?: boolean;
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
}

export interface ApiParsedFee {
  description: string;
  amount: number;
  taxRate?: number;
}

export interface ApiParsedDocumentFields {
  customerId?: string | null;
  currency?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  items: ApiParsedLineItem[];
  fees: ApiParsedFee[];
  taxRate?: number;
}

export interface ApiParsedDocumentResult {
  fields: ApiParsedDocumentFields;
  confidence: number;
  matchedCustomer: { id: string; name: string; email: string | null } | null;
  matchedProducts: { id: string; name: string; sku: string | null }[];
  suggestions: string[];
}

export async function parseDocument(text: string, documentType?: string): Promise<ApiParsedDocumentResult> {
  const res = await api.post("/ai/parse-document", { text, documentType });
  return res.data;
}

// ============================================================================
// Speed Optimization API (Predictive UX)
// ============================================================================

export interface ApiCommandLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  productId?: string | null;
  catalogMatch?: {
    name: string;
    unitPrice: string;
    taxRate: string;
    confidence: number;
  } | null;
}

export interface ApiQuickActions {
  lastInvoice: ApiLastInvoice | null;
  frequentlyInvoiced: ApiFrequentlyInvoicedItem[];
  recentCustomers: ApiRecentCustomer[];
  hasDraft: boolean;
  draftInfo: { id: string; customerId?: string | null; itemCount: number } | null;
}

export interface ApiLastInvoice {
  invoiceId: string;
  invoiceNumber?: string | null;
  customer: { id: string; name: string; email?: string | null };
  items: Array<{
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    taxRate: string;
    productId?: string | null;
    catalogName?: string | null;
  }>;
  currency: string;
  terms?: string | null;
  notes?: string | null;
  paymentInstructions?: string | null;
  templateId?: string | null;
  total: string;
  sentAt?: string | null;
  isDraft: boolean;
}

export interface ApiFrequentlyInvoicedItem {
  id: string | null;
  name: string;
  description: string | null;
  unitPrice: string;
  unit: string;
  taxRate: string;
  frequencyScore: number;
  lastUsed: Date | null;
}

export interface ApiRecentCustomer {
  id: string;
  name: string;
  email?: string | null;
}

export interface ApiProgressiveAutofill {
  customerId?: string | null;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  templateId?: string | null;
  taxRate?: string;
  depositType?: "none" | "fixed" | "percentage";
  depositValue?: string;
  depositDueDate?: string | null;
  depositPaymentPurpose?: string | null;
  lateFeeType?: "none" | "fixed" | "percentage";
  lateFeeValue?: string;
  lateFeeDueDate?: string | null;
  poNumber?: string | null;
}

export async function getSuggestedActions(): Promise<ApiQuickActions> {
  const res = await cachedGet("/suggested-actions", undefined, { ttlMs: 15 * 1000 });
  return res;
}

export async function parseCommandLineItem(input: string): Promise<{ parsed: ApiCommandLineItem }> {
  const res = await api.post("/parse-command-line", { input });
  return res.data;
}

export async function getProgressiveAutofill(customerId?: string): Promise<ApiProgressiveAutofill> {
  const res = await cachedGet("/progressive-autofill", customerId ? { customerId } : undefined, { ttlMs: 10 * 1000 });
  return res;
}

export async function getFrequentlyInvoiced(limit = 12): Promise<{ items: ApiFrequentlyInvoicedItem[] }> {
  const res = await cachedGet("/frequently-invoiced", { limit }, { ttlMs: 60 * 1000 });
  return res;
}

export async function getLastInvoice(customerId?: string): Promise<ApiLastInvoice | null> {
  const params = customerId ? { customerId } : undefined;
  const res = await cachedGet("/last-invoice", params, { ttlMs: 15 * 1000 });
  return res;
}

export async function recordSpeedMetrics(data: {
  invoiceId: string;
  creationSeconds: number;
  customerSelectedVia: string;
  usedLastInvoice: boolean;
  commandBarItems: number;
  catalogChipItems: number;
  manualItems: number;
  itemsCount: number;
  isReturningCustomer: boolean;
  isMobile: boolean;
  sessionId?: string;
}): Promise<{ ok: boolean }> {
  const res = await api.post("/speed-metrics", data);
  return res.data;
}

export async function logInteraction(data: {
  actionType: string;
  targetField?: string;
  invoiceId?: string;
  durationMs?: number;
  valueFrom?: string;
  valueTo?: string;
  sessionId?: string;
}): Promise<{ ok: boolean }> {
  const res = await api.post("/interaction-log", data);
  return res.data;
}

// ===========================================================================
// Payment Risk Scoring API
// ============================================================================

export interface ApiPaymentRiskInvoice {
  id: string;
  invoiceNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  total: string;
  amountDue: string;
  dueDate: string | null;
  sentAt: string | null;
  status: string;
  paymentRiskScore: number | null;
  paymentRiskFactors: Record<string, unknown> | null;
}

export interface ApiRiskScoreResult {
  score: number;
  factors: Record<string, unknown>;
  confidence: number;
  modelVersion: string;
}

export async function getPaymentRiskInvoices(limit = 50): Promise<{ invoices: ApiPaymentRiskInvoice[] }> {
  const res = await api.get(`/reports/payment-risk?limit=${limit}`);
  return res.data;
}

export async function scoreInvoiceRisk(invoiceId: string): Promise<ApiRiskScoreResult> {
  const res = await api.post(`/reports/payment-risk/score/${invoiceId}`);
  return res.data;
}

export async function batchScorePaymentRisk(): Promise<{ scored: number; failed: number }> {
  const res = await api.post(`/reports/payment-risk/batch`);
  return res.data;
}

// ===========================================================================
// Quotes API
// ============================================================================

export interface QuoteItemInput {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: string | number;
  unit?: string;
  unitPrice: string | number;
  discount?: string | number;
  discountType?: "fixed" | "percentage";
  taxRate?: string | number;
  taxName?: string | null;
  isTaxInclusive?: boolean;
  sortOrder?: number;
}

export interface QuoteFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  taxName?: string | null;
  sortOrder?: number;
}

export interface QuoteCreateInput {
  customerId?: string | null;
  currency?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  scopeOfWork?: string | null;
  items?: QuoteItemInput[];
  fees?: QuoteFeeInput[];
  depositType?: "none" | "percentage" | "fixed";
  depositValue?: string | number;
  depositDueDate?: string | null;
}

export interface QuoteSearchParam {
  status?: string;
  customerId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FinalizeQuoteResult {
  quoteNumber: string;
}

export interface SendQuoteResult {
  sent: boolean;
  publicToken: string;
}

export async function getQuotes(params?: QuoteSearchParam) {
  const res = await cachedGet("/quotes", params as Record<string, unknown> | undefined, { ttlMs: 30 * 1000 });
  return res;
}

export async function getQuote(id: string) {
  const res = await cachedGet(`/quotes/${id}`, undefined, { ttlMs: 15 * 1000 });
  return res;
}

export async function createQuote(data: QuoteCreateInput) {
  const res = await api.post("/quotes", data);
  invalidateCache("/quotes?");
  return res.data;
}

export async function updateQuote(id: string, data: Partial<QuoteCreateInput>) {
  const res = await api.patch(`/quotes/${id}`, data);
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

export async function finalizeQuote(id: string): Promise<FinalizeQuoteResult> {
  const res = await api.post(`/quotes/${id}/finalize`);
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

export async function sendQuote(id: string): Promise<SendQuoteResult> {
  const res = await api.post(`/quotes/${id}/send`);
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

export async function acceptQuote(id: string) {
  const res = await api.post(`/quotes/${id}/accept`);
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

export async function rejectQuote(id: string) {
  const res = await api.post(`/quotes/${id}/reject`);
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

export async function deleteQuote(id: string) {
  const res = await api.delete(`/quotes/${id}`);
  invalidateCache("/quotes?");
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

export async function cancelQuote(id: string, reason?: string) {
  const res = await api.post(`/quotes/${id}/cancel`, reason ? { reason } : {});
  invalidateCache("/quotes?");
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

export async function getQuotePdf(id: string) {
  const res = await api.post(`/quotes/${id}/pdf`, {}, { responseType: "blob" });
  return res.data;
}

export async function getQuoteEvents(id: string) {
  const res = await api.get(`/quotes/${id}/events`);
  return res.data;
}

export interface ConvertQuoteResult {
  invoiceId: string;
  quoteNumber: string;
  invoiceNumber?: string | null;
}

export async function convertQuote(id: string): Promise<ConvertQuoteResult> {
  const res = await api.post(`/quotes/${id}/convert`);
  invalidateCache("/quotes?");
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

export async function convertAndSendQuote(id: string): Promise<ConvertQuoteResult> {
  const res = await api.post(`/quotes/${id}/convert-and-send`);
  invalidateCache("/quotes?");
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

export async function recordQuoteDepositPayment(
  id: string,
  amount: string | number,
  provider?: string,
  idempotencyKey?: string
) {
  const res = await api.post(`/quotes/${id}/deposit`, { amount, provider, idempotencyKey });
  invalidateCacheByKey(`/quotes/${id}`);
  return res.data;
}

// Public quote view (for client-facing acceptance)
export async function getPublicQuote(token: string) {
  const res = await api.get(`/public/quotes/${token}`);
  return res.data;
}

export async function recordQuoteView(token: string) {
  const res = await api.post(`/public/quotes/${token}/view`);
  return res.data;
}

export async function acceptPublicQuote(token: string) {
  const res = await api.post(`/public/quotes/${token}/accept`);
  return res.data;
}

export async function getPublicQuotePdf(token: string) {
  const res = await api.get(`/public/quotes/${token}/pdf`, { responseType: "blob" });
  return res.data;
}

export async function rejectPublicQuote(token: string) {
  const res = await api.post(`/public/quotes/${token}/reject`);
  return res.data;
}

export async function payQuoteDepositPublic(
  token: string,
  amount: string | number,
  provider?: string,
  idempotencyKey?: string
) {
  const res = await api.post(`/public/quotes/${token}/deposit`, { amount, provider, idempotencyKey });
  return res.data;
}

// === Credit Notes ===

export interface CreditNoteSearchParams {
  status?: string;
  customerId?: string;
  search?: string;
  currency?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export async function getCreditNotes(params?: CreditNoteSearchParams) {
  const res = await cachedGet("/credit-notes", params as Record<string, unknown> | undefined, {
    ttlMs: 30 * 1000,
  });
  return res;
}

export async function getCreditNote(id: string) {
  const res = await cachedGet(`/credit-notes/${id}`, undefined, { ttlMs: 15 * 1000 });
  return res;
}

export async function getCreditNotePdf(id: string) {
  const res = await api.post(`/credit-notes/${id}/pdf`, {}, { responseType: "blob" });
  return res.data;
}

export async function getCreditNoteEvents(id: string) {
  const res = await api.get(`/credit-notes/${id}/events`);
  return res.data;
}

export async function finalizeCreditNote(id: string) {
  const res = await api.post(`/credit-notes/${id}/finalize`);
  invalidateCacheByKey(`/credit-notes/${id}`);
  return res.data;
}

export async function cancelCreditNote(id: string, reason?: string) {
  const res = await api.post(`/credit-notes/${id}/cancel`, { reason });
  invalidateCacheByKey(`/credit-notes/${id}`);
  return res.data;
}

export async function sendCreditNote(id: string) {
  const res = await api.post(`/credit-notes/${id}/send`);
  invalidateCacheByKey(`/credit-notes/${id}`);
  return res.data;
}

export async function applyCreditNote(id: string, invoiceId: string, amount?: string, applicationMethod?: "invoice_offset" | "balance_credit" | "refund") {
  const res = await api.post(`/credit-notes/${id}/apply`, { invoiceId, amount, application_method: applicationMethod });
  invalidateCacheByKey(`/credit-notes/${id}`);
  return res.data;
}

export async function deleteCreditNote(id: string) {
  const res = await api.delete(`/credit-notes/${id}`);
  invalidateCache("/credit-notes?");
  invalidateCacheByKey(`/credit-notes/${id}`);
  return res.data;
}

export interface CreditNoteItemInput {
  description: string;
  quantity: string | number;
  unit?: string;
  unitPrice: string | number;
  discount?: string | number;
  discountType?: "fixed" | "percentage";
  taxRate?: string | number;
  isTaxInclusive?: boolean;
  sortOrder?: number;
}

export interface CreditNoteFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
}

export interface CreateCreditNoteInput {
  customerId?: string | null;
  referenceInvoiceId?: string | null;
  currency?: string;
  issueDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  items?: CreditNoteItemInput[];
  fees?: CreditNoteFeeInput[];
}

export interface CreateCreditNoteResult {
  id: string;
}

export interface UpdateCreditNoteInput {
  issueDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  terms?: string | null;
  items?: CreditNoteItemInput[];
  fees?: CreditNoteFeeInput[];
}

export async function createCreditNote(data: CreateCreditNoteInput): Promise<CreateCreditNoteResult> {
  const res = await api.post("/credit-notes", data);
  invalidateCache("/credit-notes?");
  return res.data;
}

export async function createCreditNoteFromInvoice(
  invoiceId: string,
  data: {
    reason?: string | null;
    items: Array<{
      id: string;
      description: string;
      quantity: string | number;
      unit: string;
      unitPrice: string | number;
      discount: string | number;
      discountType: "fixed" | "percentage";
      isTaxInclusive?: boolean;
      taxRate?: string | number;
      productId?: string | null;
    }>;
  }
): Promise<CreateCreditNoteResult> {
  const res = await api.post(`/invoices/${invoiceId}/credit-notes`, data);
  invalidateCache("/credit-notes?");
  return res.data;
}

export async function updateCreditNote(id: string, data: UpdateCreditNoteInput): Promise<void> {
  await api.patch(`/credit-notes/${id}`, data);
  invalidateCacheByKey(`/credit-notes/${id}`);
}

export interface GetEligibleInvoicesParams {
  customerId?: string;
  currency?: string;
}

export async function getEligibleInvoicesForCredit(params?: GetEligibleInvoicesParams) {
  const res = await api.get("/credit-notes/eligible-invoices", { params });
  return res.data;
}

export async function getCreditNoteApplications(id: string) {
  const res = await api.get(`/credit-notes/${id}/applications`);
  return res.data;
}

export async function voidCreditNote(id: string, reason: string) {
  const res = await api.post(`/credit-notes/${id}/void`, { reason });
  invalidateCacheByKey(`/credit-notes/${id}`);
  return res.data;
}

