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
  created_at: string;
  updated_at: string;
  items: ApiInvoiceItem[];
  fees: ApiInvoiceFee[];
}

export interface ApiCustomer {
  id: string;
  business_id: string;
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state_or_region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  default_currency?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
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
