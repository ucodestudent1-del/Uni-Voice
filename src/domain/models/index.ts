import type { Decimal } from "decimal.js";
import type { CurrencyCode } from "../value-objects/currency.js";
import type { Address } from "../value-objects/address.js";

export type Status =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "void";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled";

export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled" | "refunded" | "partially_refunded";

export interface Business {
  id: string;
  ownerId?: string;
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  address: Address;
  countryCode: string;
  defaultCurrency: CurrencyCode;
  logoUrl?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerStatus = "active" | "inactive" | "archived";

export interface CustomerAddress {
  id: string;
  customerId: string;
  label?: string | null;
  type: "billing" | "shipping";
  isDefault: boolean;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateOrRegion?: string | null;
  postalCode?: string | null;
  countryCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxIdentifier {
  id: string;
  customerId: string;
  type: string;
  value: string;
  isDefault: boolean;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address: Address;
  countryCode?: string | null;
  defaultCurrency?: CurrencyCode | null;
  notes?: string | null;
  status: CustomerStatus;
  paymentTerms?: number | null;
  taxIdentifiers?: TaxIdentifier[];
  billingAddressId?: string | null;
  shippingAddressId?: string | null;
  archivedAt?: Date | null;
  archivedBy?: string | null;
  updatedBy?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  defaultUnitPrice: Decimal.Value;
  defaultTaxRate: Decimal.Value;
  unit: string;
  defaultCurrency: CurrencyCode;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  productId?: string | null;
  description: string;
  quantity: Decimal.Value;
  unit: string;
  unitPrice: Decimal.Value;
  discount: Decimal.Value;
  discountType: "fixed" | "percentage";
  taxRate: Decimal.Value;
  taxAmount: Decimal.Value;
  lineSubtotal: Decimal.Value;
  lineTotal: Decimal.Value;
  sortOrder: number;
  isTaxInclusive: boolean;
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
}

export interface InvoiceFee {
  id: string;
  invoiceId: string;
  description: string;
  amount: Decimal.Value;
  taxRate: Decimal.Value;
  taxAmount: Decimal.Value;
  sortOrder: number;
}

export interface Invoice {
  id: string;
  businessId: string;
  customerId?: string | null;
  invoiceNumber?: string | null;
  status: Status;
  issueDate?: Date | null;
  dueDate?: Date | null;
  currency: CurrencyCode;
  exchangeRate?: Decimal.Value | null;
  subtotal: Decimal.Value;
  discountTotal: Decimal.Value;
  taxTotal: Decimal.Value;
  feeTotal: Decimal.Value;
  total: Decimal.Value;
  amountPaid: Decimal.Value;
  amountDue: Decimal.Value;
  notes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  templateSchemaVersion?: string | null;
  templateRevision?: number | null;
  version: number;
  publicToken?: string | null;
  publicTokenExpiresAt?: Date | null;
  paymentInstructions?: string | null;
  isFinalized: boolean;
  finalizedAt?: Date | null;
  sentAt?: Date | null;
  viewedAt?: Date | null;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
  cancelledReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface InvoiceSnapshot {
  id: string;
  invoiceId: string;
  snapshot: Record<string, unknown>;
  snapshotHash: string;
  revision?: number;
  templateId?: string | null;
  templateSchemaVersion?: string | null;
  templateRevision?: number | null;
  renderedHtml?: string | null;
  pdfStored: boolean;
  pdfHash?: string | null;
  createdAt: Date;
  createdBy?: string | null;
}

export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  eventType: string;
  actorId?: string | null;
  actorType?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Payment {
  id: string;
  invoiceId: string;
  businessId: string;
  provider: string;
  providerPaymentId?: string | null;
  amount: Decimal.Value;
  currency: CurrencyCode;
  status: PaymentStatus;
  paidAt?: Date | null;
  method?: string | null;
  idempotencyKey?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringInvoice {
  id: string;
  businessId: string;
  customerId?: string | null;
  name: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  intervalCount: number;
  nextGenerationAt: Date;
  endDate?: Date | null;
  currency: CurrencyCode;
  notes?: string | null;
  terms?: string | null;
  isActive: boolean;
  lastGeneratedInvoiceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quote {
  id: string;
  businessId: string;
  customerId?: string | null;
  quoteNumber?: string | null;
  status: QuoteStatus;
  issueDate?: Date | null;
  dueDate?: Date | null;
  currency: CurrencyCode;
  subtotal: Decimal.Value;
  discountTotal: Decimal.Value;
  taxTotal: Decimal.Value;
  feeTotal: Decimal.Value;
  total: Decimal.Value;
  notes?: string | null;
  terms?: string | null;
  publicToken?: string | null;
  isAccepted: boolean;
  acceptedAt?: Date | null;
  convertedInvoiceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Template {
  id: string;
  businessId: string;
  name: string;
  isDefault: boolean;
  config: Record<string, unknown>;
  htmlTemplate: string;
  schemaVersion: string;
  revision: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentTemplateSchemaVersionRecord {
  version: string;
  name: string;
  description?: string | null;
  schema: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
}

export interface DocumentTemplate {
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
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface InvoiceTemplate {
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
  lifecycle: string;
  publishedAt?: Date | null;
  publishedRevision?: number | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface InvoiceTemplateRevision {
  id: string;
  templateId: string;
  businessId: string;
  revision: number;
  schemaVersion: string;
  document: Record<string, unknown>;
  htmlTemplate?: string | null;
  config: Record<string, unknown>;
  changeSummary?: string | null;
  createdAt: Date;
  createdBy?: string | null;
}

export interface InvoiceTemplateWithRevisions extends InvoiceTemplate {
  revisions: InvoiceTemplateRevision[];
}

export {
  type ProductService,
  type ProductServiceType,
  type ProductServiceStatus,
  type ProductServiceSnapshot,
  type InvoiceLineItemSnapshot,
  PRODUCT_SERVICE_STATUSES,
  PRODUCT_SERVICE_TYPES,
} from "./product-service.js";
