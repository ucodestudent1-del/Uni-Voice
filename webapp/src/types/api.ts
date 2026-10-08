export interface ApiUser {
  id: string;
  businessId?: string;
  email?: string;
  role?: string;
}

export interface ApiUserProfile {
  id: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiBusinessSettings {
  business_id: string;
  default_currency: string;
  default_tax_rate: string;
  default_terms?: string | null;
  default_notes?: string | null;
  time_zone: string;
  locale: string;
  pdf_template_id?: string | null;
  payment_provider: string;
  payment_provider_config?: Record<string, unknown>;
  reminders_enabled: boolean;
  overdue_reminder_days: number;
  late_fee_type?: "none" | "fixed" | "percentage" | null;
  late_fee_value?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApiTaxRate {
  id: string;
  business_id: string;
  name: string;
  code?: string | null;
  rate: string;
  type: string;
  country_code?: string | null;
  region?: string | null;
  is_compound: boolean;
  enabled: boolean;
  created_at?: string;
}

export interface ApiNotificationSettings {
  emailNotifications: boolean;
  paymentConfirmations: boolean;
  invoiceReminders: boolean;
  overdueReminders: boolean;
  reminderDays: number[];
  invoiceSent: boolean;
  invoiceViewed: boolean;
}

export interface ApiBillingInvoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  invoiceNumber?: string;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
}

export interface ApiPaymentMethod {
  id: string;
  type: string;
  card?: { brand: string; last4: string; expMonth: number; expYear: number };
  isDefault: boolean;
}

export interface ApiBusiness {
  id: string;
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  defaultCurrency: string;
  defaultQuoteValidityDays?: number;
  countryCode?: string;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateOrRegion?: string | null;
  postalCode?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
}

export interface ApiPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  is_active: boolean;
  sort_order?: number;
}

export interface ApiSubscription {
  id: string;
  business_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  cancelled_at?: string | null;
  stripe_subscription_id?: string | null;
}

export interface ApiInvoiceItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  discount: string;
  discount_type: "fixed" | "percentage";
  tax_rate: string;
  tax_name?: string | null;
  tax_amount: string;
  line_subtotal: string;
  line_total: string;
  is_tax_inclusive: boolean;
  product_id?: string | null;
  sort_order: number;
  catalog_name?: string | null;
  catalog_sku?: string | null;
  catalog_tax_category?: string | null;
  catalog_unit_price?: string | null;
  catalog_tax_rate?: string | null;
}

export interface ApiInvoiceFee {
  id: string;
  description: string;
  amount: string;
  tax_rate: string;
  tax_name?: string | null;
  tax_amount: string;
  sort_order: number;
}

export interface ApiInvoiceAttachment {
  id: string;
  business_id: string;
  invoice_id: string;
  category: "attachment" | "before" | "after";
  name: string;
  size: number;
  mime_type?: string | null;
  data_url?: string | null;
  created_at: string;
}

export interface ApiInvoice {
  id: string;
  business_id: string;
  customer_id?: string | null;
  project_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_company_name?: string | null;
  customer_address_line_1?: string | null;
  customer_address_line_2?: string | null;
  customer_city?: string | null;
  customer_state_or_region?: string | null;
  customer_postal_code?: string | null;
  customer_country_code?: string | null;
  customer_tax_id?: string | null;
  invoice_number?: string | null;
  status: string;
  issue_date?: string | null;
  due_date?: string | null;
  po_number?: string | null;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  fee_total: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  deposit_type?: "fixed" | "percentage" | "none" | null;
  deposit_value?: string | null;
  deposit_due_date?: string | null;
  deposit_paid?: string | null;
  deposit_due?: string | null;
  deposit_payment_purpose?: string | null;
  late_fee_type?: "none" | "fixed" | "percentage" | null;
  late_fee_value?: string | null;
  late_fee_due_date?: string | null;
   late_fee_applied?: boolean | null;
  late_fee_applied_amount?: string | null;
  invoice_discount?: string | null;
  invoice_discount_type?: "fixed" | "percentage" | null;
  shipping_description?: string | null;
  shipping_amount?: string | null;
  shipping_tax_rate?: string | null;
  notes?: string | null;
  terms?: string | null;
  template_id?: string | null;
  payment_instructions?: string | null;
  is_finalized: boolean;
  finalized_at?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  paid_at?: string | null;
  cancelled_at?: string | null;
  cancelled_reason?: string | null;
  public_token?: string | null;
  public_token_expires_at?: string | null;
  created_at: string;
  updated_at: string;
  items: ApiInvoiceItem[];
  fees: ApiInvoiceFee[];
  attachments?: ApiInvoiceAttachment[];
}

export interface ApiTaxIdentifier {
  id: string;
  customerId: string;
  type: string;
  value: string;
  isDefault: boolean;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCustomer {
  id: string;
  businessId: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address: {
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    stateOrRegion?: string | null;
    postalCode?: string | null;
    countryCode: string;
    taxId?: string | null;
  };
  countryCode?: string | null;
  defaultCurrency?: string | null;
  notes?: string | null;
  status: "active" | "inactive" | "archived";
  paymentTerms?: number | null;
  taxIdentifiers?: ApiTaxIdentifier[];
  billingAddressId?: string | null;
  shippingAddressId?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  updatedBy?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  invoiceCount?: number;
  totalOutstanding?: string;
  totalOverdue?: string;
  mostRecentInvoiceDate?: string | null;
}

export interface ApiCustomerInvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  status: string;
  currency: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  issueDate: string | null;
  dueDate: string | null;
  finalizedAt: string | null;
  createdAt: string;
}

export interface ApiCustomerSummary {
  customer: ApiCustomer;
  invoices: ApiCustomerInvoiceSummary[];
  totalInvoiceCount: number;
  finalizedInvoiceCount: number;
  totalBilled: string;
  totalPaid: string;
  totalOutstanding: string;
  totalOverdue: string;
  averagePaymentDays?: number | null;
}

export interface ApiProduct {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  defaultUnitPrice: string;
  defaultTaxRate: string;
  unit: string;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTemplate {
  id: string;
  business_id: string;
  name: string;
  is_default: boolean;
  config: Record<string, unknown>;
  html_template: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlag {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  is_premium: boolean;
  requires_plan?: string;
  metadata: Record<string, unknown>;
}

export interface DraftLineItem {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  discount?: string;
  discount_type?: "fixed" | "percentage";
  tax_rate?: string;
  is_tax_inclusive?: boolean;
  product_id?: string | null;
  catalog_name?: string | null;
  catalog_sku?: string | null;
  catalog_tax_category?: string | null;
  catalog_unit_price?: string | null;
  catalog_tax_rate?: string | null;
}

export interface InvoiceTotals {
  subtotal: string;
  discount_total: string;
  tax_total: string;
  fee_total: string;
  total: string;
  amount_paid: string;
  amount_due: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  method: string;
  confirmedAt: string | null;
}

export interface TwoFactorSetupResult {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
}

export interface TwoFactorVerifyResult {
  token: string;
  user: ApiUser;
  usedRecoveryCode: boolean;
}

export interface RecoveryCodeSummary {
  total: number;
  used: number;
  remaining: number;
  usedAt: (string | null)[];
}

export interface OnboardingStep {
  id: string;
  step: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "skipped";
  completedAt: string | null;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  isComplete: boolean;
}

export interface InvoiceTemplateDTO {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  industry?: string | null;
  schemaVersion: string;
  revision: number;
  version: number;
  document: Record<string, unknown>;
  htmlTemplate?: string | null;
  config: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
  documentType: "invoice" | "quote";
  lifecycle: "draft" | "published" | "archived";
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface InvoiceTemplateRevisionDTO {
  id: string;
  templateId: string;
  businessId: string;
  revision: number;
  schemaVersion: string;
  document: Record<string, unknown>;
  htmlTemplate?: string | null;
  config: Record<string, unknown>;
  changeSummary?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export interface ApiPayment {
  id: string;
  invoice_id: string;
  business_id: string;
  provider: string;
  provider_payment_id?: string | null;
  amount: string;
  currency: string;
  status: string;
  method?: string | null;
  paid_at?: string | null;
  idempotency_key?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApiPaymentWithInvoice extends ApiPayment {
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
}

export interface ApiPaymentSummary {
  totalPayments: string;
  paymentsThisMonth: string;
  pendingPayments: string;
  failedPayments: string;
  refunds: string;
  totalPaymentCount: number;
  pendingCount: number;
  failedCount: number;
  refundCount: number;
  currency: string;
}

export interface ApiPaymentEvent {
  event_type: string;
  status: string | null;
  amount: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ApiPaymentDetail {
  id: string;
  invoice_id: string;
  business_id: string;
  provider: string;
  provider_payment_id?: string | null;
  amount: string;
  currency: string;
  status: string;
  method?: string | null;
  paid_at?: string | null;
  idempotency_key?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  invoice_number?: string | null;
  invoice_status?: string | null;
  invoice_total?: string | null;
  invoice_amount_due?: string | null;
  invoice_amount_paid?: string | null;
  invoice_currency?: string | null;
  invoice_due_date?: string | null;
  invoice_issue_date?: string | null;
  invoice_sent_at?: string | null;
  invoice_paid_at?: string | null;
  invoice_notes?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_address_line_1?: string | null;
  customer_address_line_2?: string | null;
  customer_city?: string | null;
  customer_state?: string | null;
  customer_postal_code?: string | null;
  customer_country_code?: string | null;
  business_name?: string | null;
  business_email?: string | null;
  business_phone?: string | null;
}

export interface ApiInvoiceEvent {
  id: string;
  invoice_id: string;
  event_type: string;
  actor_id?: string | null;
  actor_type?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ApiPaymentIntent {
  clientSecret: string | null;
  provider: string;
}

export interface ApiDashboardSummary {
  totalRevenue: string;
  totalOutstanding: string;
  totalOverdue: string;
  paymentsReceived: string;
  netIncome: string;
  totalPaidThisMonth: string;
  draftCount: number;
  overdueCount: number;
  sentCount: number;
  paidCount: number;
  totalInvoices: number;
  currency: string;
}

export interface ApiInvoiceListItem {
  id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_id?: string | null;
  status: string;
  payment_state?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  currency: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  deposit_total?: string | null;
  deposit_paid?: string | null;
  deposit_due?: string | null;
  payment_risk_score?: number | null;
  payment_risk_factors?: Record<string, unknown> | null;
  payment_risk_scored_at?: string | null;
  created_at: string;
  sent_at?: string | null;
  paid_at?: string | null;
}

export interface ApiUpcomingInvoice {
  id: string;
  invoiceNumber?: string | null;
  customerName?: string | null;
  amountDue: string;
  total: string;
  dueDate?: string | null;
  currency: string;
  status: string;
}

export interface ApiMoneyIn {
  total: string;
  count: number;
  currency: string;
}

export interface ApiDashboardData {
  summary: ApiDashboardSummary;
  recentlyPaid: ApiInvoiceListItem[];
  requiringAttention: ApiInvoiceListItem[];
  upcoming: ApiUpcomingInvoice[];
  moneyIn: ApiMoneyIn;
}

export interface InvoiceSearchParams {
  limit?: number;
  offset?: number;
  status?: string;
  paymentState?: string;
  customerId?: string;
  customerName?: string;
  search?: string;
  currency?: string;
  minAmount?: string;
  maxAmount?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ApiCreditNote {
  id: string;
  business_id: string;
  reference_invoice_id?: string | null;
  reference_invoice_number?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  credit_note_number?: string | null;
  status: string;
  issue_date?: string | null;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  fee_total: string;
  total: string;
  applied_total: string;
  amount_due: string;
  amount_applied: string;
  amount_remaining: string;
  notes?: string | null;
  internal_notes?: string | null;
  terms?: string | null;
  reason?: string | null;
  template_id?: string | null;
  is_finalized: boolean;
  finalized_at?: string | null;
  cancelled_at?: string | null;
  cancelled_reason?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  public_token?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  items: ApiCreditNoteItem[];
  fees: ApiCreditNoteFee[];
  applications: ApiCreditNoteApplication[];
}

export interface ApiCreditNoteItem {
  id: string;
  credit_note_id: string;
  product_id?: string | null;
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
  sort_order: number;
  is_tax_inclusive: boolean;
  catalog_name?: string | null;
  catalog_sku?: string | null;
  catalog_tax_category?: string | null;
  catalog_unit_price?: string | null;
  catalog_tax_rate?: string | null;
}

export interface ApiCreditNoteFee {
  id: string;
  credit_note_id: string;
  description: string;
  amount: string;
  tax_rate: string;
  tax_amount: string;
  sort_order: number;
  created_at: string;
}

export interface ApiCreditNoteApplication {
  id: string;
  credit_note_id: string;
  invoice_id: string;
  business_id?: string;
  amount: string;
  applied_at: string;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * How the credit was consumed. Stored in metadata.
   * - "invoice_offset" — applied to reduce an invoice's balance
   * - "balance_credit" — held on the customer's account for future invoices
   * - "refund" — returned to the customer's original payment method
   */
  application_method?: "invoice_offset" | "balance_credit" | "refund" | null;
}

export interface ApiCreditNoteListItem {
  id: string;
  business_id: string;
  customer_id: string | null;
  reference_invoice_id?: string | null;
  reference_invoice_number?: string | null;
  credit_note_number?: string | null;
  status: string;
  issue_date?: string | null;
  currency: string;
  total: string;
  applied_total: string;
  amount_due: string;
  amount_applied: string;
  amount_remaining: string;
  reason?: string | null;
  notes?: string | null;
  is_finalized: boolean;
  finalized_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  customer_email: string | null;
}

export interface CreditNoteSearchParams {
  limit?: number;
  offset?: number;
  status?: string;
  customerId?: string;
  search?: string;
  currency?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ApiReminderConfig {
  enabled: boolean;
  beforeDue: ReminderSequence[];
  afterDue: ReminderSequence[];
}

export interface ReminderSequence {
  id: string;
  offsetDays: number;
  subject?: string | null;
  message?: string | null;
  maxSends: number;
  enabled: boolean;
}

export interface ApiReminderTemplate {
  id: string;
  business_id: string;
  name: string;
  subject: string;
  message: string;
  is_default: boolean;
  created_at: string;
}

export interface ApiDepositInfo {
  deposit_type: "fixed" | "percentage" | "none";
  deposit_value: string;
  deposit_due_date?: string | null;
  deposit_paid: string;
  deposit_due: string;
}

export interface ApiEnhancedDashboard {
  summary: ApiDashboardSummary;
  agingBuckets: ApiAgingBucket[];
  paymentMetrics: ApiPaymentMetrics;
  volumeTrend: ApiVolumeTrend[];
}

export interface ApiAgingBucket {
  bucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
  count: number;
  amount: string;
}

export interface ApiPaymentMetrics {
  averagePaymentTimeDays: number;
  collectionRate: number;
  totalInvoiced: string;
  totalPaid: string;
  totalOutstanding: string;
  totalOverdue: string;
}

export interface ApiVolumeTrend {
  period: string;
  invoiced: string;
  paid: string;
  count: number;
}

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";

export interface ApiProjectTag {
  id: string;
  business_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ApiProjectTeamMember {
  id: string;
  project_id: string;
  business_id: string;
  user_id: string;
  role: string;
  assigned_at: string;
  assigned_by?: string | null;
}

export interface ApiProjectEvent {
  id: string;
  project_id: string;
  business_id: string;
  event_type: string;
  actor_id?: string | null;
  actor_type?: string | null;
  description?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ApiProjectInvoice {
  id: string;
  business_id: string;
  project_id?: string | null;
  invoice_number?: string | null;
  status: string;
  date?: string | null;
  total: string;
  currency: string;
}

export interface ApiProject {
  id: string;
  business_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  start_date?: string | null;
  due_date?: string | null;
  budget: string;
  currency: string;
  amount_invoiced: string;
  amount_paid: string;
  remaining_billable: string;
  version: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  tag_count?: number;
  team_member_count?: number;
  tags?: ApiProjectTag[];
  financial_summary?: ApiProjectFinancialSummary;
  customer?: ApiCustomer | null;
}

export interface ApiProjectFinancialSummary {
  budget: string;
  amount_invoiced: string;
  amount_paid: string;
  remaining_billable: string;
  outstanding: string;
  budget_utilization: string;
}

export interface ApiProjectDetail {
  project: ApiProject;
  customer?: ApiCustomer | null;
  tags: ApiProjectTag[];
  team_members: ApiProjectTeamMember[];
  financial_summary: ApiProjectFinancialSummary;
}

export interface ApiProjectTimeEntry {
  id: string;
  project_id: string;
  business_id: string;
  user_id?: string | null;
  catalog_service_id?: string | null;
  description: string;
  billable: boolean;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  billable_rate: string;
  billable_amount: string;
  is_invoiced: boolean;
  invoice_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiProjectTimeEntrySummary {
  total_minutes: number;
  billable_minutes: number;
  non_billable_minutes: number;
  unbilled_billable_minutes: number;
  invoiced_billable_minutes: number;
  total_billable_amount: string;
  unbilled_billable_amount: string;
  currency: string;
}

export interface ApiProjectNote {
  id: string;
  project_id: string;
  business_id: string;
  user_id?: string | null;
  title?: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// REPORTS
// ============================================================================

export interface ReportFiltersParams {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  projectId?: string;
  status?: string | string[];
  category?: string;
  search?: string;
  provider?: string;
  paymentStatus?: string | string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ApiRevenueByPeriod {
  period: string;
  invoiced: string;
  paid: string;
  count: number;
  currency: string;
}

export interface ApiRevenueByStatus {
  status: string;
  count: number;
  total_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  currency: string;
}

export interface ApiRevenueByCustomer {
  customerId: string;
  customerName: string | null;
  invoiceCount: number;
  invoiced: string;
  paid: string;
  outstanding: string;
  currency: string;
}

export interface ApiRevenueReport {
  summary: ApiDashboardSummary;
  byStatus: ApiRevenueByStatus[];
  byPeriod: ApiRevenueByPeriod[];
  byCustomer: ApiRevenueByCustomer[];
}

export interface ApiInvoiceReportItem {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  currency: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  days_overdue: number;
  created_at: string;
}

export interface ApiInvoiceReportSummary {
  totalInvoices: number;
  totalInvoiced: string;
  totalPaid: string;
  totalOutstanding: string;
  totalOverdue: string;
  currency: string;
  statusBreakdown: Array<{ status: string; count: number; amount: string }>;
  byPeriod: ApiRevenueByPeriod[];
}

export interface ApiInvoicesReport {
  summary: ApiInvoiceReportSummary;
  invoices: ApiInvoiceReportItem[];
}

export interface ApiPaymentReportItem {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  customer_name: string | null;
  amount: string;
  currency: string;
  status: string;
  method: string | null;
  provider: string;
  paid_at: string | null;
  created_at: string;
}

export interface ApiPaymentReportSummary {
  totalPayments: number;
  totalAmount: string;
  totalPaid: string;
  totalPending: string;
  totalFailed: string;
  totalRefunded: string;
  paymentsThisMonth: string;
  currency: string;
  providerBreakdown: Array<{ provider: string; count: number; amount: string }>;
  methodBreakdown: Array<{ method: string; count: number; amount: string }>;
  dailyTrend: Array<{ date: string; amount: string; count: number }>;
}

export interface ApiPaymentsReport {
  summary: ApiPaymentReportSummary;
  payments: ApiPaymentReportItem[];
}

export interface ApiClientReportItem {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  invoice_count: number;
  total_invoiced: string;
  total_paid: string;
  total_outstanding: string;
  last_invoice_date: string | null;
  currency: string;
}

export interface ApiClientReportSummary {
  totalClients: number;
  totalInvoiced: string;
  totalPaid: string;
  totalOutstanding: string;
  averageInvoiceValue: string;
  currency: string;
}

export interface ApiClientsReport {
  summary: ApiClientReportSummary;
  clients: ApiClientReportItem[];
}

export interface ApiTaxSummaryItem {
  period: string;
  tax_collected: string;
  taxable_amount: string;
  invoice_count: number;
  currency: string;
}

export interface ApiTaxSummaryBreakdown {
  rate: string;
  name: string;
  taxable_basis: string;
  tax_collected: string;
  invoice_count: number;
  currency: string;
}

export interface ApiTaxSummaryReport {
  summary: {
    totalTaxCollected: string;
    totalTaxableAmount: string;
    periodStart: string | null;
    periodEnd: string | null;
    currency: string;
  };
  byPeriod: ApiTaxSummaryItem[];
  byRate: ApiTaxSummaryBreakdown[];
}

export interface ApiProfitLossReport {
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  revenue: {
    total: string;
    count: number;
    byMonth: Array<{ period: string; amount: string; count: number }>;
  };
  expenses: {
    total: string;
    count: number;
    byMonth: Array<{ period: string; amount: string; count: number }>;
  };
  netIncome: string;
  grossMargin: number;
}

export interface ApiAgingReport {
  buckets: ApiAgingBucket[];
  summary: {
    totalOutstanding: string;
    totalOverdue: string;
    currency: string;
  };
}
