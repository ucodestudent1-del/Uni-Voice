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
  ApiReminderConfig,
  ApiReminderTemplate,
  ApiEnhancedDashboard,
} from "../types/api";

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
  (response) => response,
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
  const res = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
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

export async function getQuotes() {
  const res = await api.get("/quotes");
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

export async function createInvoiceFromProject(projectId: string, data?: any) {
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

export async function getRecurringInvoices() {
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
