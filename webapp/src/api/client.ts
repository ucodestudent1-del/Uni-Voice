import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import type {
  TwoFactorSetupResult,
  TwoFactorVerifyResult,
  TwoFactorStatus,
  RecoveryCodeSummary,
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

export async function getInvoices(params?: { status?: string; customerId?: string; limit?: number; offset?: number }) {
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

export async function getCustomers(params?: { limit?: number; offset?: number }) {
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

export async function deleteCustomer(id: string) {
  const res = await api.delete(`/customers/${id}`);
  return res.data;
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

export async function getTaxRates() {
  const res = await api.get("/tax-rates");
  return res.data;
}
