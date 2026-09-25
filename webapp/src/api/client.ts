import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import type {
  TwoFactorSetupResult,
  TwoFactorVerifyResult,
  TwoFactorStatus,
  RecoveryCodeSummary,
  InvoiceSearchParams,
  CreditNoteSearchParams,
  RecurringInvoiceCreateInput,
  RecurringInvoiceUpdateInput,
  ApiRecurringInvoice,
  ApiReminderConfig,
  ApiReminderTemplate,
  ApiEnhancedDashboard,
  ApiExpense,
  ApiExpenseSummary,
  ExpenseSearchParams,
  ExpenseCategory,
  ApiExpenseCategoryBreakdown,
  ApiExpenseMonthlyTrend,
  ApiExpenseBudgetSettings,
} from "../types/api";

export type {
  InvoiceSearchParams,
  CreditNoteSearchParams,
  RecurringInvoiceCreateInput,
  RecurringInvoiceUpdateInput,
  ApiRecurringInvoice,
  ApiReminderConfig,
  ApiReminderTemplate,
  ApiEnhancedDashboard,
  ApiExpense,
  ApiExpenseSummary,
  ExpenseSearchParams,
  ExpenseCategory,
  ApiExpenseCategoryBreakdown,
  ApiExpenseMonthlyTrend,
  ApiExpenseBudgetSettings,
};

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

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
      typeof contentType === "string" &&
      !contentType.includes("application/json")
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
  const res = await api.get("/invoices", { params });
  return res.data;
}

export async function getInvoice(id: string) {
  const res = await api.get(`/invoices/${id}`);
  return res.data;
}

export async function createInvoice(data: any) {
  const res = await api.post("/invoices", data);
  return res.data;
}

export async function updateInvoice(id: string, data: any) {
  const res = await api.patch(`/invoices/${id}`, data);
  return res.data;
}

export async function setInvoiceItems(id: string, items: any[]) {
  const res = await api.put(`/invoices/${id}/items`, items);
  return res.data;
}

export async function setInvoiceFees(id: string, fees: any[]) {
  const res = await api.put(`/invoices/${id}/fees`, fees);
  return res.data;
}

export async function finalizeInvoice(id: string) {
  const res = await api.post(`/invoices/${id}/finalize`);
  return res.data;
}

export async function sendInvoice(id: string) {
  const res = await api.post(`/invoices/${id}/send`);
  return res.data;
}

export async function duplicateInvoice(id: string) {
  const res = await api.post(`/invoices/${id}/duplicate`);
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
  return res.data;
}

export async function createPaymentIntent(id: string) {
  const res = await api.post(`/invoices/${id}/payment-intent`);
  return res.data;
}

export async function getDashboardData() {
  const res = await api.get("/dashboard");
  return res.data;
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
  const res = await api.get("/customers", { params });
  return res.data;
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
  const res = await api.get("/products", { params });
  return res.data;
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

export async function getBusiness() {
  const res = await api.get("/businesses/current");
  return res.data;
}

export async function updateBusiness(data: any) {
  const res = await api.patch("/businesses/current", data);
  return res.data;
}

export async function createQuote(data: any) {
  const res = await api.post("/quotes", data);
  return res.data;
}

export async function convertQuote(id: string) {
  const res = await api.post(`/quotes/${id}/convert`);
  return res.data;
}

export async function getRecurring() {
  const res = await api.get("/recurring");
  return res.data;
}

export async function createRecurring(data: any) {
  const res = await api.post("/recurring", data);
  return res.data;
}

export async function getRevenueReport() {
  const res = await api.get("/reports/revenue");
  return res.data;
}

export async function getTaxSummaryReport() {
  const res = await api.get("/reports/tax-summary");
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
// CREDIT NOTES
// ============================================================================

export async function getCreditNotes(params?: CreditNoteSearchParams) {
  const res = await api.get("/credit-notes", { params });
  return res.data;
}

export async function getCreditNote(id: string) {
  const res = await api.get(`/credit-notes/${id}`);
  return res.data;
}

export async function createCreditNote(data: any) {
  const res = await api.post("/credit-notes", data);
  return res.data;
}

export async function updateCreditNote(id: string, data: any) {
  const res = await api.patch(`/credit-notes/${id}`, data);
  return res.data;
}

export async function finalizeCreditNote(id: string) {
  const res = await api.post(`/credit-notes/${id}/finalize`);
  return res.data;
}

export async function cancelCreditNote(id: string, data?: { reason?: string }) {
  const res = await api.post(`/credit-notes/${id}/cancel`, data ?? {});
  return res.data;
}

export async function applyCreditNote(id: string, invoiceId: string, amount?: string) {
  const res = await api.post(`/credit-notes/${id}/apply`, { invoiceId, amount });
  return res.data;
}

export async function getCreditNotePdf(id: string) {
  const res = await api.get(`/credit-notes/${id}/pdf`, { responseType: "blob" });
  return res.data;
}

export async function getCreditNoteEvents(id: string) {
  const res = await api.get(`/credit-notes/${id}/events`);
  return res.data;
}

export function buildCreditNoteSearchParams(params: CreditNoteSearchParams): Record<string, any> {
  const result: Record<string, any> = {};
  if (params.limit !== undefined) result.limit = params.limit;
  if (params.offset !== undefined) result.offset = params.offset;
  if (params.status !== undefined) result.status = params.status;
  if (params.customerId !== undefined) result.customer_id = params.customerId;
  if (params.search !== undefined) result.search = params.search;
  if (params.currency !== undefined) result.currency = params.currency;
  if (params.sortBy !== undefined) result.sort_by = params.sortBy;
  if (params.sortOrder !== undefined) result.sort_order = params.sortOrder;
  return result;
}

// ============================================================================
// RECURRING INVOICES
// ============================================================================

export async function getRecurringInvoices(): Promise<{ recurringInvoices: ApiRecurringInvoice[] | null }> {
  const res = await api.get("/recurring");
  return res.data;
}

export async function getRecurringInvoice(id: string) {
  const res = await api.get(`/recurring/${id}`);
  return res.data;
}

export async function createRecurringInvoice(data: RecurringInvoiceCreateInput) {
  const res = await api.post("/recurring", data);
  return res.data;
}

export async function updateRecurringInvoice(id: string, data: RecurringInvoiceUpdateInput) {
  const res = await api.patch(`/recurring/${id}`, data);
  return res.data;
}

export async function pauseRecurringInvoice(id: string) {
  const res = await api.post(`/recurring/${id}/pause`);
  return res.data;
}

export async function resumeRecurringInvoice(id: string) {
  const res = await api.post(`/recurring/${id}/resume`);
  return res.data;
}

export async function deleteRecurringInvoice(id: string) {
  const res = await api.delete(`/recurring/${id}`);
  return res.data;
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
  const res = await api.get("/dashboard/enhanced");
  return res.data;
}

export async function getAgingReport() {
  const res = await api.get("/reports/aging");
  return res.data;
}

export async function getPaymentMetricsReport() {
  const res = await api.get("/reports/payment-metrics");
  return res.data;
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
// EXPENSE TRACKING (Business plan)
// ============================================================================

export async function getExpenses(params?: {
  limit?: number;
  offset?: number;
  customerId?: string;
  projectId?: string;
  category?: string;
  isBillable?: boolean;
  isReimbursed?: boolean;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<{ expenses: ApiExpense[]; total: number; limit: number; offset: number }> {
  const res = await api.get("/expenses", { params });
  return res.data;
}

export async function getExpense(id: string): Promise<{ expense: ApiExpense }> {
  const res = await api.get(`/expenses/${id}`);
  return res.data;
}

export async function createExpense(data: Partial<ApiExpense>): Promise<{ expense: ApiExpense }> {
  const res = await api.post("/expenses", data);
  return res.data;
}

export async function updateExpense(id: string, data: Partial<ApiExpense>): Promise<{ expense: ApiExpense }> {
  const res = await api.patch(`/expenses/${id}`, data);
  return res.data;
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await api.delete(`/expenses/${id}`);
  return res.data;
}

export async function getExpenseSummary(params?: {
  limit?: number;
  offset?: number;
  customerId?: string;
  projectId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ summary: ApiExpenseSummary }> {
  const res = await api.get("/expenses/summary", { params });
  return res.data;
}

export function buildExpenseSearchParams(params: ExpenseSearchParams): Record<string, any> {
  const result: Record<string, any> = {};
  if (params.limit !== undefined) result.limit = params.limit;
  if (params.offset !== undefined) result.offset = params.offset;
  if (params.customerId !== undefined) result.customerId = params.customerId;
  if (params.projectId !== undefined) result.projectId = params.projectId;
  if (params.category !== undefined) result.category = params.category;
  if (params.isBillable !== undefined) result.isBillable = params.isBillable;
  if (params.isReimbursed !== undefined) result.isReimbursed = params.isReimbursed;
  if (params.dateFrom !== undefined) result.dateFrom = params.dateFrom;
  if (params.dateTo !== undefined) result.dateTo = params.dateTo;
  if (params.minAmount !== undefined) result.minAmount = params.minAmount;
  if (params.maxAmount !== undefined) result.maxAmount = params.maxAmount;
  if (params.search !== undefined) result.search = params.search;
  if (params.sortBy !== undefined) result.sortBy = params.sortBy;
  if (params.sortOrder !== undefined) result.sortOrder = params.sortOrder;
  return result;
}

export async function getExpensesWithSummary(params?: {
  limit?: number;
  offset?: number;
  customerId?: string;
  projectId?: string;
  category?: string;
  isBillable?: boolean;
  isReimbursed?: boolean;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<{ expenses: ApiExpense[]; total: number; limit: number; offset: number; summary: ApiExpenseSummary }> {
  const res = await api.get("/expenses/with-summary", { params });
  return res.data;
}

export async function getExpenseCategoryBreakdown(params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ breakdown: ApiExpenseCategoryBreakdown[] }> {
  const res = await api.get("/expenses/category-breakdown", { params });
  return res.data;
}

export async function getExpenseMonthlyTrend(params?: {
  months?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ trend: ApiExpenseMonthlyTrend[] }> {
  const res = await api.get("/expenses/monthly-trend", { params });
  return res.data;
}

export async function getExpenseBudgetSettings(): Promise<{ budget: ApiExpenseBudgetSettings | null }> {
  const res = await api.get("/businesses/current/expense-settings");
  return res.data;
}

export async function updateExpenseBudgetSettings(data: Partial<ApiExpenseBudgetSettings>): Promise<{ budget: ApiExpenseBudgetSettings }> {
  const res = await api.patch("/businesses/current/expense-settings", data);
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

export async function getReceipts(params?: ReceiptSearchParams): Promise<{ receipts: ApiReceipt[]; total: number; limit: number; offset: number }> {
  const res = await api.get("/receipts", { params });
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
// QUOTE DETAIL
// ==============================================================================

export interface ApiQuoteItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  discount: string;
  discount_type: "fixed" | "percentage";
  tax_rate: string;
  tax_amount: string;
  line_subtotal: string;
  line_total: string;
  is_tax_inclusive: boolean;
  product_id?: string | null;
  sort_order: number;
}

export interface ApiQuoteFee {
  id: string;
  description: string;
  amount: string;
  tax_rate: string;
  tax_amount: string;
  sort_order: number;
}

export interface ApiQuote {
  id: string;
  business_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  quote_number?: string | null;
  status: string;
  issue_date?: string | null;
  due_date?: string | null;
  expiry_date?: string | null;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  fee_total: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  notes?: string | null;
  terms?: string | null;
  template_id?: string | null;
  payment_instructions?: string | null;
  is_finalized: boolean;
  finalized_at?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  converted_invoice_id?: string | null;
  public_token?: string | null;
  public_token_expires_at?: string | null;
  created_at: string;
  updated_at: string;
  items: ApiQuoteItem[];
  fees: ApiQuoteFee[];
}

export interface ApiQuoteListItem {
  id: string;
  quote_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_id?: string | null;
  status: string;
  issue_date?: string | null;
  due_date?: string | null;
  expiry_date?: string | null;
  currency: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  is_finalized: boolean;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  converted_invoice_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteSearchParams {
  limit?: number;
  offset?: number;
  status?: string;
  customerId?: string;
  search?: string;
  currency?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getQuotes(params?: QuoteSearchParams): Promise<{ quotes: ApiQuoteListItem[]; total: number; limit: number; offset: number }> {
  const res = await api.get("/quotes", { params });
  return res.data;
}

export async function getQuoteById(id: string): Promise<{ quote: ApiQuote }> {
  const res = await api.get(`/quotes/${id}`);
  return res.data;
}

export async function updateQuote(id: string, data: any) {
  const res = await api.patch(`/quotes/${id}`, data);
  return res.data;
}

export async function sendQuote(id: string) {
  const res = await api.post(`/quotes/${id}/send`);
  return res.data;
}

export async function finalizeQuote(id: string) {
  const res = await api.post(`/quotes/${id}/finalize`);
  return res.data;
}

export async function getQuotePdf(id: string) {
  const res = await api.get(`/quotes/${id}/pdf`, { responseType: "blob" });
  return res.data;
}

export async function deleteQuote(id: string) {
  const res = await api.delete(`/quotes/${id}`);
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
