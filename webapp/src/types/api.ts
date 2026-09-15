export interface ApiUser {
  id: string;
  businessId?: string;
  email?: string;
  role?: string;
}

export interface ApiBusiness {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  default_currency: string;
  country_code?: string;
  logo_url?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state_or_region?: string | null;
  postal_code?: string | null;
  tax_id?: string | null;
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
  tax_amount: string;
  sort_order: number;
}

export interface ApiInvoice {
  id: string;
  business_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  invoice_number?: string | null;
  status: string;
  issue_date?: string | null;
  due_date?: string | null;
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
   paid_at?: string | null;
   cancelled_at?: string | null;
   cancelled_reason?: string | null;
   public_token?: string | null;
   public_token_expires_at?: string | null;
   created_at: string;
  updated_at: string;
  items: ApiInvoiceItem[];
  fees: ApiInvoiceFee[];
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
}

export interface ApiProduct {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  default_unit_price: string;
  default_tax_rate: string;
  unit: string;
  default_currency: string;
  created_at: string;
  updated_at: string;
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
  totalOutstanding: string;
  totalOverdue: string;
  totalPaidThisMonth: string;
  totalRevenue: string;
  draftCount: number;
  overdueCount: number;
  sentCount: number;
  paidCount: number;
  totalInvoices: number;
}

export interface ApiInvoiceListItem {
  id: string;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  status: string;
  issue_date?: string | null;
  due_date?: string | null;
  currency: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  created_at: string;
  sent_at?: string | null;
  paid_at?: string | null;
}

export interface ApiDashboardData {
  summary: ApiDashboardSummary;
  recentlyPaid: ApiInvoiceListItem[];
  requiringAttention: ApiInvoiceListItem[];
}
