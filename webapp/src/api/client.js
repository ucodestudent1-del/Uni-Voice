import axios from "axios";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const responseCache = new Map();
function cacheKey(url, params) {
    if (!params)
        return url;
    const entries = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0)
        return url;
    const qs = entries.map(([k, v]) => `${k}=${String(v)}`).join("&");
    return `${url}?${qs}`;
}
export function getCacheKey(url, params) {
    return cacheKey(url, params);
}
export function invalidateCache(pattern) {
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
export function invalidateCacheByKey(url) {
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
api.interceptors.response.use((response) => {
    const contentType = response.headers["content-type"];
    const responseType = response.config?.responseType;
    if (responseType !== "blob" &&
        responseType !== "arraybuffer" &&
        typeof contentType === "string" &&
        !contentType.includes("application/json") &&
        !contentType.includes("text/")) {
        return Promise.reject(new Error("Unexpected response format"));
    }
    return response;
}, (error) => {
    const status = error.response?.status;
    const skipRedirect = error.config?.skipAuthRedirect === true;
    if (status === 401 && !skipRedirect) {
        localStorage.removeItem("token");
        window.location.href = "/login";
    }
    return Promise.reject(error);
});
export async function cachedGet(url, params, options) {
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
export async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    return res.data;
}
export async function verifyTwoFactor(email, code) {
    const res = await api.post("/auth/2fa/verify", { email, code }, { skipAuthRedirect: true });
    return res.data;
}
export async function getTwoFactorStatus() {
    const res = await api.get("/auth/2fa/status");
    return res.data;
}
export async function setupTwoFactor() {
    const res = await api.post("/auth/2fa/setup");
    return res.data;
}
export async function enableTwoFactor(code) {
    const res = await api.post("/auth/2fa/enable", { code });
    return res.data;
}
export async function disableTwoFactor() {
    const res = await api.delete("/auth/2fa");
    return res.data;
}
export async function regenerateRecoveryCodes() {
    const res = await api.post("/auth/2fa/recovery-codes/regenerate");
    return res.data;
}
export async function register(email, password, name, countryCode, defaultCurrency) {
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
export async function upgradeSubscription(planCode) {
    const res = await api.post("/subscription/upgrade", { planCode });
    return res.data;
}
export async function downgradeSubscription(planCode) {
    const res = await api.post("/subscription/downgrade", { planCode });
    return res.data;
}
export async function getStripeConfig() {
    const res = await api.get("/stripe/config");
    return res.data;
}
export async function getInvoices(params) {
    const res = await cachedGet("/invoices", params, { ttlMs: 30 * 1000 });
    return res;
}
export async function getInvoice(id) {
    const res = await cachedGet(`/invoices/${id}`, undefined, { ttlMs: 15 * 1000 });
    return res;
}
export async function createInvoice(data) {
    const res = await api.post("/invoices", data);
    invalidateCache("/invoices?");
    invalidateCacheByKey("/invoices/");
    return res.data;
}
export async function updateInvoice(id, data) {
    const res = await api.patch(`/invoices/${id}`, data);
    invalidateCacheByKey("/invoices");
    return res.data;
}
export async function setInvoiceAttachments(id, attachments) {
    const res = await api.put(`/invoices/${id}/attachments`, { attachments });
    invalidateCacheByKey(`/invoices/${id}`);
    return res.data;
}
export async function sendInvoiceSms(id, to) {
    const res = await api.post(`/invoices/${id}/sms`, to ? { to } : {});
    return res.data;
}
export async function finalizeInvoice(id) {
    const res = await api.post(`/invoices/${id}/finalize`);
    invalidateCacheByKey(`/invoices/${id}`);
    invalidateCache("/invoices?");
    return res.data;
}
export async function sendInvoice(id) {
    const res = await api.post(`/invoices/${id}/send`);
    invalidateCacheByKey(`/invoices/${id}`);
    invalidateCache("/invoices?");
    return res.data;
}
export async function duplicateInvoice(id) {
    const res = await api.post(`/invoices/${id}/duplicate`);
    invalidateCache("/invoices?");
    return res.data;
}
export async function getInvoicePdf(id) {
    const res = await api.post(`/invoices/${id}/pdf`, {}, { responseType: "blob" });
    return res.data;
}
export async function getInvoiceEvents(id) {
    const res = await api.get(`/invoices/${id}/events`);
    return res.data;
}
export async function getInvoicePayments(id) {
    const res = await api.get(`/invoices/${id}/payments`);
    return res.data;
}
export async function sendReminder(id) {
    const res = await api.post(`/invoices/${id}/send-reminder`);
    return res.data;
}
export async function cancelInvoice(id, data) {
    const res = await api.post(`/invoices/${id}/cancel`, data ?? {});
    return res.data;
}
export async function voidInvoice(id, data) {
    const res = await api.post(`/invoices/${id}/void`, data ?? {});
    return res.data;
}
export async function deleteInvoice(id) {
    const res = await api.delete(`/invoices/${id}`);
    invalidateCache("/invoices?");
    invalidateCacheByKey(`/invoices/${id}`);
    return res.data;
}
export async function createPaymentIntent(id) {
    const res = await api.post(`/invoices/${id}/payment-intent`);
    return res.data;
}
export async function getDashboardData() {
    const res = await cachedGet("/dashboard", undefined, { ttlMs: 60 * 1000 });
    return res;
}
export async function payInvoicePublic(token, data) {
    const res = await api.post(`/public/invoices/${token}/pay`, data);
    return res.data;
}
export async function createPaymentIntentPublic(token) {
    const res = await api.post(`/public/invoices/${token}/payment-intent`);
    return res.data;
}
export async function getCustomers(params) {
    const res = await cachedGet("/customers", params, { ttlMs: 60 * 1000 });
    return res;
}
export async function createCustomer(data) {
    const res = await api.post("/customers", data);
    return res.data;
}
export async function updateCustomer(id, data) {
    const res = await api.patch(`/customers/${id}`, data);
    return res.data;
}
export async function archiveCustomer(id) {
    const res = await api.post(`/customers/${id}/archive`);
    return res.data;
}
export async function restoreCustomer(id) {
    const res = await api.post(`/customers/${id}/restore`);
    return res.data;
}
export async function deleteCustomer(id) {
    const res = await api.delete(`/customers/${id}`);
    return res.data;
}
export async function getCustomer(id) {
    const res = await api.get(`/customers/${id}`);
    return res.data;
}
export async function importCustomers(csv) {
    const res = await api.post(`/customers/import`, { csv });
    return res.data;
}
export async function getCustomerInvoices(customerId, params) {
    const res = await api.get(`/customers/${customerId}/invoices`, { params });
    return res.data;
}
export async function getCustomerSummary(customerId) {
    const res = await api.get(`/customers/${customerId}/summary`);
    return res.data;
}
export async function getCustomerBalance(customerId) {
    const res = await api.get(`/customers/${customerId}/balance`);
    return res.data;
}
export async function getCustomerEvents(customerId, params) {
    const res = await api.get(`/customers/${customerId}/events`, { params });
    return res.data;
}
export async function exportCustomersCsv() {
    const res = await api.get("/customers/export", { responseType: "blob" });
    return res.data;
}
export function buildCustomerSearchParams(params) {
    const result = {};
    if (params.limit !== undefined)
        result.limit = params.limit;
    if (params.offset !== undefined)
        result.offset = params.offset;
    if (params.search !== undefined)
        result.search = params.search;
    if (params.status !== undefined)
        result.status = params.status;
    if (params.includeArchived !== undefined)
        result.includeArchived = params.includeArchived;
    if (params.sortBy !== undefined)
        result.sortBy = params.sortBy;
    if (params.sortOrder !== undefined)
        result.sortOrder = params.sortOrder;
    return result;
}
export async function getProducts(params) {
    const res = await cachedGet("/products", params, { ttlMs: 60 * 1000 });
    return res;
}
export async function createProduct(data) {
    const res = await api.post("/products", data);
    return res.data;
}
export async function updateProduct(id, data) {
    const res = await api.patch(`/products/${id}`, data);
    return res.data;
}
export async function deleteProduct(id) {
    const res = await api.delete(`/products/${id}`);
    return res.data;
}
export async function createInvoiceFromProduct(productId) {
    const res = await api.post(`/products/${productId}/use-as-line-item?type=invoice`);
    return res.data;
}
export async function createQuoteFromProduct(productId) {
    const res = await api.post(`/products/${productId}/use-as-line-item?type=quote`);
    return res.data;
}
export async function createCreditNoteFromProduct(productId) {
    const res = await api.post(`/products/${productId}/use-as-line-item?type=credit-note`);
    return res.data;
}
export async function getBusiness() {
    const res = await api.get("/businesses/current");
    return res.data;
}
export async function updateBusiness(data) {
    const res = await api.patch("/businesses/current", data);
    return res.data;
}
export async function createQuote(data) {
    const res = await api.post("/quotes", data);
    return res.data;
}
export async function convertQuote(id) {
    const res = await api.post(`/quotes/${id}/convert`);
    return res.data;
}
export async function convertAndSendQuote(id) {
    const res = await api.post(`/quotes/${id}/convert-and-send`);
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
export async function getTemplates(params) {
    const res = await api.get("/templates", { params });
    return res.data;
}
export async function getTemplate(id) {
    const res = await api.get(`/templates/${id}`);
    return res.data;
}
export async function createTemplate(data) {
    const res = await api.post("/templates", data);
    return res.data;
}
export async function updateTemplate(id, data) {
    const res = await api.patch(`/templates/${id}`, data);
    return res.data;
}
export async function deleteTemplate(id) {
    const res = await api.delete(`/templates/${id}`);
    return res.data;
}
export async function getDocumentTemplates(params) {
    const res = await api.get("/document-templates", { params });
    return res.data;
}
export async function createDocumentTemplate(data) {
    const res = await api.post("/document-templates", data);
    return res.data;
}
export async function getDocumentTemplate(id) {
    const res = await api.get(`/document-templates/${id}`);
    return res.data;
}
export async function updateDocumentTemplate(id, data) {
    const res = await api.patch(`/document-templates/${id}`, data);
    return res.data;
}
export async function deleteDocumentTemplate(id) {
    const res = await api.delete(`/document-templates/${id}`);
    return res.data;
}
export async function duplicateDocumentTemplate(id) {
    const res = await api.post(`/document-templates/${id}/duplicate`);
    return res.data;
}
export async function setDefaultDocumentTemplate(id) {
    const res = await api.post(`/document-templates/${id}/set-default`);
    return res.data;
}
export async function getNumberingConfig() {
    const res = await api.get("/businesses/current/numbering");
    return res.data;
}
export async function updateNumberingConfig(data) {
    const res = await api.patch("/businesses/current/numbering", data);
    return res.data;
}
export async function getPayments(invoiceId) {
    const res = await api.get(`/invoices/${invoiceId}/payments`);
    return res.data;
}
export async function recordPayment(invoiceId, data) {
    const res = await api.post(`/invoices/${invoiceId}/payments`, data);
    return res.data;
}
export async function getPaymentsByBusiness(params) {
    const res = await api.get("/payments", { params });
    return res.data;
}
export async function getPaymentSummary() {
    const res = await api.get("/payments/summary");
    return res.data;
}
export async function getPayment(id) {
    const res = await api.get(`/payments/${id}`);
    return res.data;
}
export async function refundPayment(paymentId, data) {
    const res = await api.post(`/payments/${paymentId}/refund`, data);
    return res.data;
}
export async function recordPaymentManually(data) {
    const res = await api.post(`/payments/record`, data);
    return res.data;
}
export async function getPublicInvoice(token) {
    const res = await api.get(`/public/invoices/${token}`);
    return res.data;
}
export async function recordPublicView(token) {
    const res = await api.post(`/public/invoices/${token}/view`);
    return res.data;
}
export async function getPublicInvoicePdf(token) {
    const res = await api.get(`/public/invoices/${token}/pdf`, { responseType: "blob" });
    return res.data;
}
export async function getOnboarding() {
    const res = await api.get("/onboarding");
    return res.data;
}
export async function completeOnboardingStep(step) {
    const res = await api.post(`/onboarding/step/${step}/complete`);
    return res.data;
}
export async function startOnboardingStep(step) {
    const res = await api.post(`/onboarding/step/${step}/start`);
    return res.data;
}
export async function skipOnboardingStep(step) {
    const res = await api.post(`/onboarding/step/${step}/skip`);
    return res.data;
}
export async function finishOnboarding() {
    const res = await api.post("/onboarding/complete");
    return res.data;
}
export async function getInvoiceTemplates(params) {
    const res = await api.get("/invoice-templates", { params });
    return res.data;
}
export async function getInvoiceTemplate(id) {
    const res = await api.get(`/invoice-templates/${id}`);
    return res.data;
}
export async function createInvoiceTemplate(data) {
    const res = await api.post("/invoice-templates", data);
    return res.data;
}
export async function updateInvoiceTemplate(id, data) {
    const res = await api.patch(`/invoice-templates/${id}`, data);
    return res.data;
}
export async function deleteInvoiceTemplate(id) {
    const res = await api.delete(`/invoice-templates/${id}`);
    return res.data;
}
export async function duplicateInvoiceTemplate(id) {
    const res = await api.post(`/invoice-templates/${id}/duplicate`);
    return res.data;
}
export async function setDefaultInvoiceTemplate(id) {
    const res = await api.post(`/invoice-templates/${id}/set-default`);
    return res.data;
}
export async function publishInvoiceTemplate(id, data) {
    const res = await api.post(`/invoice-templates/${id}/publish`, data ?? {});
    return res.data;
}
export async function archiveInvoiceTemplate(id) {
    const res = await api.post(`/invoice-templates/${id}/archive`);
    return res.data;
}
export async function unarchiveInvoiceTemplate(id) {
    const res = await api.post(`/invoice-templates/${id}/unarchive`);
    return res.data;
}
export async function getInvoiceTemplateRevisions(id) {
    const res = await api.get(`/invoice-templates/${id}/revisions`);
    return res.data;
}
export async function getInvoiceTemplateRevision(id, revision) {
    const res = await api.get(`/invoice-templates/${id}/revisions/${revision}`);
    return res.data;
}
export async function restoreInvoiceTemplateRevision(id, revision) {
    const res = await api.post(`/invoice-templates/${id}/revisions/${revision}/restore`);
    return res.data;
}
export async function getInvoiceTemplateWithRevisions(id) {
    const res = await api.get(`/invoice-templates/${id}/with-revisions`);
    return res.data;
}
export async function migrateInvoiceTemplate(id, targetVersion) {
    const res = await api.post(`/invoice-templates/${id}/migrate`, targetVersion ? { targetVersion } : {});
    return res.data;
}
export async function renderInvoiceTemplateHtml(id, data) {
    const res = await api.post(`/invoice-templates/${id}/render`, data);
    return res.data;
}
export async function getInvoiceTemplateUsage(id) {
    const res = await api.get(`/invoice-templates/${id}/usage`);
    return res.data;
}
export async function setInvoiceTemplatePermission(templateId, userId, permission) {
    const res = await api.post(`/invoice-templates/${templateId}/permissions`, { userId, permission });
    return res.data;
}
export async function getInvoiceTemplatePermissions(templateId) {
    const res = await api.get(`/invoice-templates/${templateId}/permissions`);
    return res.data;
}
export async function recordInvoiceTemplateUsage(templateId, invoiceId) {
    const res = await api.post(`/invoice-templates/${templateId}/usage`, invoiceId ? { invoiceId } : {});
    return res.data;
}
export async function getBusinessSettings() {
    const res = await api.get("/businesses/current/settings");
    return res.data;
}
export async function updateBusinessSettings(data) {
    const res = await api.patch("/businesses/current/settings", data);
    return res.data;
}
export async function getTaxRates() {
    const res = await api.get("/tax-rates");
    return res.data;
}
export async function createTaxRate(data) {
    const res = await api.post("/tax-rates", data);
    return res.data;
}
export async function updateTaxRate(id, data) {
    const res = await api.patch(`/tax-rates/${id}`, data);
    return res.data;
}
export async function deleteTaxRate(id) {
    const res = await api.delete(`/tax-rates/${id}`);
    return res.data;
}
export async function updateUserProfile(data) {
    const res = await api.patch("/auth/profile", data);
    return res.data;
}
export async function changePassword(data) {
    const res = await api.post("/auth/change-password", data);
    return res.data;
}
export async function getUserSessions() {
    const res = await api.get("/auth/sessions");
    return res.data;
}
export async function revokeUserSession(sessionId) {
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
export async function getProjects(params) {
    const res = await api.get("/projects", { params });
    return res.data;
}
export async function searchProjects(query) {
    const res = await api.get("/projects/search", { params: { q: query } });
    return res.data;
}
export async function getProject(id) {
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
export async function createProject(data) {
    const res = await api.post("/projects", data);
    return res.data;
}
export async function updateProject(id, data) {
    const res = await api.patch(`/projects/${id}`, data);
    return res.data;
}
export async function archiveProject(id) {
    const res = await api.post(`/projects/${id}/archive`);
    return res.data;
}
export async function restoreProject(id) {
    const res = await api.post(`/projects/${id}/restore`);
    return res.data;
}
export async function updateProjectStatus(id, status) {
    const res = await api.post(`/projects/${id}/status`, { status });
    return res.data;
}
export async function deleteProject(id) {
    const res = await api.delete(`/projects/${id}`);
    return res.data;
}
export async function createInvoiceFromProject(projectId, data) {
    const res = await api.post(`/projects/${projectId}/invoice`, data ?? {});
    return res.data;
}
export async function getProjectInvoices(projectId, params) {
    const res = await api.get(`/projects/${projectId}/invoices`, { params });
    return res.data;
}
export async function getProjectFinancialSummary(projectId) {
    const res = await api.get(`/projects/${projectId}/financial-summary`);
    return res.data;
}
export async function getProjectEvents(projectId, params) {
    const res = await api.get(`/projects/${projectId}/events`, { params });
    return res.data;
}
export async function addProjectTag(projectId, name, color) {
    const res = await api.post(`/projects/${projectId}/tags`, { name, color });
    return res.data;
}
export async function removeProjectTag(projectId, tagId) {
    const res = await api.delete(`/projects/${projectId}/tags/${tagId}`);
    return res.data;
}
export async function getProjectTags() {
    const res = await api.get("/projects/tags");
    return res.data;
}
export async function getProjectTeam(projectId) {
    const res = await api.get(`/projects/${projectId}/team`);
    return res.data;
}
export async function addProjectTeamMember(projectId, userId, role) {
    const res = await api.post(`/projects/${projectId}/team`, { userId, role });
    return res.data;
}
export async function removeProjectTeamMember(projectId, userId) {
    const res = await api.delete(`/projects/${projectId}/team/${userId}`);
    return res.data;
}
// ============================================================================
// PROJECT TIME TRACKING
// ============================================================================
export async function createTimeEntry(projectId, data) {
    const res = await api.post(`/projects/${projectId}/time-entries`, data);
    return res.data;
}
export async function getTimeEntries(projectId, params) {
    const res = await api.get(`/projects/${projectId}/time-entries`, { params });
    return res.data;
}
export async function updateTimeEntry(entryId, data) {
    const res = await api.patch(`/time-entries/${entryId}`, data);
    return res.data;
}
export async function deleteTimeEntry(entryId) {
    const res = await api.delete(`/time-entries/${entryId}`);
    return res.data;
}
export async function startTimer(projectId, data) {
    const res = await api.post(`/time-entries/timer/start`, { projectId, ...data });
    return res.data;
}
export async function stopTimer(entryId) {
    const res = await api.post(`/time-entries/${entryId}/stop`);
    return res.data;
}
export async function getTimeEntrySummary(projectId, currency) {
    const res = await api.get(`/projects/${projectId}/time-entries/summary`, { params: { currency } });
    return res.data;
}
// Project Notes
export async function addProjectNote(projectId, data) {
    const res = await api.post(`/projects/${projectId}/notes`, data);
    return res.data;
}
export async function getProjectNotes(projectId, params) {
    const res = await api.get(`/projects/${projectId}/notes`, { params });
    return res.data;
}
export async function deleteProjectNote(projectId, noteId) {
    const res = await api.delete(`/projects/${projectId}/notes/${noteId}`);
    return res.data;
}
export function formatDuration(minutes) {
    if (!minutes || minutes === 0)
        return "0h 0m";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}
export function buildProjectSearchParams(params) {
    const result = {};
    if (params.limit !== undefined)
        result.limit = params.limit;
    if (params.offset !== undefined)
        result.offset = params.offset;
    if (params.search !== undefined)
        result.search = params.search;
    if (params.status !== undefined)
        result.status = params.status;
    if (params.customerId !== undefined)
        result.customerId = params.customerId;
    if (params.tagId !== undefined)
        result.tagId = params.tagId;
    if (params.includeArchived !== undefined)
        result.includeArchived = params.includeArchived;
    if (params.sortBy !== undefined)
        result.sortBy = params.sortBy;
    if (params.sortOrder !== undefined)
        result.sortOrder = params.sortOrder;
    return result;
}
// ============================================================================
// INVOICE SEARCH (Enhanced)
// ============================================================================
export async function getInvoicesEnhanced(params) {
    const res = await api.get("/invoices", { params });
    return res.data;
}
export function buildInvoiceSearchParams(params) {
    const result = {};
    if (params.limit !== undefined)
        result.limit = params.limit;
    if (params.offset !== undefined)
        result.offset = params.offset;
    if (params.status !== undefined)
        result.status = params.status;
    if (params.paymentState !== undefined)
        result.payment_state = params.paymentState;
    if (params.customerId !== undefined)
        result.customer_id = params.customerId;
    if (params.customerName !== undefined)
        result.customer_name = params.customerName;
    if (params.search !== undefined)
        result.search = params.search;
    if (params.currency !== undefined)
        result.currency = params.currency;
    if (params.minAmount !== undefined)
        result.min_amount = params.minAmount;
    if (params.maxAmount !== undefined)
        result.max_amount = params.maxAmount;
    if (params.issueDateFrom !== undefined)
        result.issue_date_from = params.issueDateFrom;
    if (params.issueDateTo !== undefined)
        result.issue_date_to = params.issueDateTo;
    if (params.dueDateFrom !== undefined)
        result.due_date_from = params.dueDateFrom;
    if (params.dueDateTo !== undefined)
        result.due_date_to = params.dueDateTo;
    if (params.sortBy !== undefined)
        result.sort_by = params.sortBy;
    if (params.sortOrder !== undefined)
        result.sort_order = params.sortOrder;
    return result;
}
// ============================================================================
// CREDIT NOTES
// ============================================================================
export async function getCreditNotes(params) {
    const res = await api.get("/credit-notes", { params });
    return res.data;
}
export async function getCreditNote(id) {
    const res = await api.get(`/credit-notes/${id}`);
    return res.data;
}
export async function createCreditNote(data) {
    const res = await api.post("/credit-notes", data);
    return res.data;
}
export async function updateCreditNote(id, data) {
    const res = await api.patch(`/credit-notes/${id}`, data);
    return res.data;
}
export async function finalizeCreditNote(id) {
    const res = await api.post(`/credit-notes/${id}/finalize`);
    return res.data;
}
export async function cancelCreditNote(id, data) {
    const res = await api.post(`/credit-notes/${id}/cancel`, data ?? {});
    return res.data;
}
export async function applyCreditNote(id, invoiceId, amount, applicationMethod) {
    const res = await api.post(`/credit-notes/${id}/apply`, { invoiceId, amount, application_method: applicationMethod });
    return res.data;
}
export async function sendCreditNote(id) {
    const res = await api.post(`/credit-notes/${id}/send`);
    return res.data;
}
export async function getCreditNotePdf(id) {
    const res = await api.get(`/credit-notes/${id}/pdf`, { responseType: "blob" });
    return res.data;
}
export async function getCreditNoteEvents(id) {
    const res = await api.get(`/credit-notes/${id}/events`);
    return res.data;
}
export function buildCreditNoteSearchParams(params) {
    const result = {};
    if (params.limit !== undefined)
        result.limit = params.limit;
    if (params.offset !== undefined)
        result.offset = params.offset;
    if (params.status !== undefined)
        result.status = params.status;
    if (params.customerId !== undefined)
        result.customer_id = params.customerId;
    if (params.search !== undefined)
        result.search = params.search;
    if (params.currency !== undefined)
        result.currency = params.currency;
    if (params.sortBy !== undefined)
        result.sort_by = params.sortBy;
    if (params.sortOrder !== undefined)
        result.sort_order = params.sortOrder;
    return result;
}
// ============================================================================
// REMINDERS
// ============================================================================
export async function getReminderConfig() {
    const res = await api.get("/businesses/current/settings");
    return res.data;
}
export async function updateReminderConfig(data) {
    const res = await api.patch("/businesses/current/settings", { reminders: data });
    return res.data;
}
export async function getReminderTemplates() {
    const res = await api.get("/reminder-templates");
    return res.data;
}
export async function createReminderTemplate(data) {
    const res = await api.post("/reminder-templates", data);
    return res.data;
}
export async function updateReminderTemplate(id, data) {
    const res = await api.patch(`/reminder-templates/${id}`, data);
    return res.data;
}
export async function deleteReminderTemplate(id) {
    const res = await api.delete(`/reminder-templates/${id}`);
    return res.data;
}
// ============================================================================
// DEPOSITS
// ============================================================================
export async function setInvoiceDeposit(id, data) {
    const res = await api.patch(`/invoices/${id}/deposit`, data);
    return res.data;
}
export async function recordDepositPayment(id, data) {
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
export async function getPaymentMetricsReport() {
    try {
        const res = await api.get("/reports/payment-metrics");
        return res.data;
    }
    catch (err) {
        if (err instanceof Error && err.message.includes("404")) {
            console.warn("Payment metrics report endpoint not available");
        }
        else {
            console.error("Failed to load payment metrics:", err);
        }
        return null;
    }
}
export async function getVolumeTrendReport(params) {
    const res = await api.get("/reports/volume-trend", { params });
    return res.data;
}
export async function exportInvoicesJson() {
    const res = await api.get("/export/invoices/json", { responseType: "blob" });
    return res.data;
}
export async function getReceipts(params) {
    const res = await api.get("/receipts", { params });
    return res.data;
}
export async function getReceiptSummary() {
    const res = await api.get("/receipts/summary");
    return res.data;
}
export async function getReceiptById(id) {
    const res = await api.get(`/receipts/${id}`);
    return res.data;
}
export async function getReceiptPdf(id) {
    const res = await api.get(`/receipts/${id}/pdf`, { responseType: "blob" });
    return res.data;
}
export async function getReceiptDetail(id) {
    const res = await api.get(`/receipts/${id}/detail`);
    return res.data;
}
export async function emailReceipt(receiptId, data) {
    const res = await api.post(`/receipts/${receiptId}/email`, data);
    return res.data;
}
export async function refundReceipt(receiptId, data) {
    const res = await api.post(`/receipts/${receiptId}/refund`, data);
    return res.data;
}
export async function generateInvoiceReceipt(invoiceId, data) {
    const res = await api.post(`/invoices/${invoiceId}/receipts`, data ?? {});
    return res.data;
}
export async function getQuotes(params) {
    const res = await api.get("/quotes", { params });
    return res.data;
}
export async function getQuoteById(id) {
    const res = await api.get(`/quotes/${id}`);
    return res.data;
}
export async function updateQuote(id, data) {
    const res = await api.patch(`/quotes/${id}`, data);
    return res.data;
}
export async function sendQuote(id) {
    const res = await api.post(`/quotes/${id}/send`);
    return res.data;
}
export async function finalizeQuote(id) {
    const res = await api.post(`/quotes/${id}/finalize`);
    return res.data;
}
export async function getQuotePdf(id) {
    const res = await api.get(`/quotes/${id}/pdf`, { responseType: "blob" });
    return res.data;
}
export async function deleteQuote(id) {
    const res = await api.delete(`/quotes/${id}`);
    return res.data;
}
export async function acceptQuote(id) {
    const res = await api.post(`/quotes/${id}/accept`);
    return res.data;
}
export async function rejectQuote(id) {
    const res = await api.post(`/quotes/${id}/reject`);
    return res.data;
}
export async function getQuoteEvents(id) {
    const res = await api.get(`/quotes/${id}/events`);
    return res.data;
}
export async function recordQuoteDeposit(id, amount, provider = "stub", idempotencyKey) {
    const res = await api.post(`/quotes/${id}/deposit`, { amount, provider, idempotencyKey });
    return res.data;
}
export async function getPublicQuote(token) {
    const res = await api.get(`/public/quotes/${token}`);
    return res.data;
}
export async function recordPublicQuoteView(token) {
    const res = await api.post(`/public/quotes/${token}/view`);
    return res.data;
}
export async function acceptPublicQuote(token) {
    const res = await api.post(`/public/quotes/${token}/accept`);
    return res.data;
}
export async function rejectPublicQuote(token) {
    const res = await api.post(`/public/quotes/${token}/reject`);
    return res.data;
}
export async function getPublicQuotePdf(token) {
    const res = await api.get(`/public/quotes/${token}/pdf`, { responseType: "blob" });
    return res.data;
}
export async function getTeam() {
    const res = await api.get("/businesses/current/team");
    return res.data;
}
export async function inviteTeamMember(data) {
    const res = await api.post("/businesses/current/team", { ...data, action: "invite" });
    return res.data;
}
export async function updateTeamMember(memberId, data) {
    const res = await api.patch(`/businesses/current/team/${memberId}`, data);
    return res.data;
}
export async function removeTeamMember(memberId) {
    const res = await api.delete(`/businesses/current/team/${memberId}`);
    return res.data;
}
export async function resendTeamInvite(memberId) {
    const res = await api.post(`/businesses/current/team/${memberId}/resend`);
    return res.data;
}
export async function getStripeConfigTyped() {
    const res = await api.get("/stripe/config");
    return res.data;
}
// ============================================================================
// ENHANCED REPORTS — dashboard, revenue, invoices, payments,
// clients, tax summary, profit & loss, aging
// ============================================================================
export async function getDashboardSummary() {
    const res = await api.get("/reports/dashboard");
    return res.data.summary;
}
export async function getRevenueReport(params) {
    const res = await api.get("/reports/revenue", { params: buildReportParams(params) });
    return res.data;
}
export async function getInvoicesReport(params) {
    const res = await api.get("/reports/invoices", { params: buildReportParams(params) });
    return res.data;
}
export async function getPaymentsReport(params) {
    const res = await api.get("/reports/payments", { params: buildReportParams(params) });
    return res.data;
}
export async function getClientsReport(params) {
    const res = await api.get("/reports/clients", { params: buildReportParams(params) });
    return res.data;
}
export async function getTaxSummaryReport(params) {
    const res = await api.get("/reports/tax-summary", { params: buildReportParams(params) });
    return res.data;
}
export async function getProfitLossReport(params) {
    const res = await api.get("/reports/profit-loss", { params: buildReportParams(params) });
    return res.data;
}
export async function getAgingReport() {
    const res = await api.get("/reports/aging");
    return res.data;
}
export async function exportReportCsv(reportType, params) {
    const res = await api.get(`/reports/${reportType}/csv`, {
        params: buildReportParams(params),
        responseType: "blob",
    });
    return res.data;
}
function buildReportParams(params) {
    if (!params)
        return {};
    const result = {};
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null)
            continue;
        if (Array.isArray(value)) {
            result[key] = value;
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
export async function parseDocument(text, documentType) {
    const res = await api.post("/ai/parse-document", { text, documentType });
    return res.data;
}
export async function getSuggestedActions() {
    const res = await cachedGet("/suggested-actions", undefined, { ttlMs: 15 * 1000 });
    return res;
}
export async function parseCommandLineItem(input) {
    const res = await api.post("/parse-command-line", { input });
    return res.data;
}
export async function getProgressiveAutofill(customerId) {
    const res = await cachedGet("/progressive-autofill", customerId ? { customerId } : undefined, { ttlMs: 10 * 1000 });
    return res;
}
export async function getFrequentlyInvoiced(limit = 12) {
    const res = await cachedGet("/frequently-invoiced", { limit }, { ttlMs: 60 * 1000 });
    return res;
}
export async function getLastInvoice(customerId) {
    const params = customerId ? { customerId } : undefined;
    const res = await cachedGet("/last-invoice", params, { ttlMs: 15 * 1000 });
    return res;
}
export async function recordSpeedMetrics(data) {
    const res = await api.post("/speed-metrics", data);
    return res.data;
}
export async function logInteraction(data) {
    const res = await api.post("/interaction-log", data);
    return res.data;
}
export async function createCreditNoteFromItems(invoiceId, itemIds, reason) {
    const res = await api.post(`/invoices/${invoiceId}/credit-notes`, { itemIds, reason });
    return res.data;
}
export async function getInvoiceItemsForCredit(invoiceId) {
    const invoice = await getInvoice(invoiceId);
    return invoice.items.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit || "each",
        unitPrice: it.unit_price,
        taxRate: it.tax_rate,
        lineTotal: it.line_total,
    }));
}
export async function getPaymentRiskInvoices(limit = 50) {
    const res = await api.get(`/reports/payment-risk?limit=${limit}`);
    return res.data;
}
export async function scoreInvoiceRisk(invoiceId) {
    const res = await api.post(`/reports/payment-risk/score/${invoiceId}`);
    return res.data;
}
export async function batchScorePaymentRisk() {
    const res = await api.post(`/reports/payment-risk/batch`);
    return res.data;
}
