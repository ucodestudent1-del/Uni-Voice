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
  projectId?: string | null;
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
  depositAmount: Decimal.Value;
  depositType: "none" | "fixed" | "percentage";
  depositDueDate?: Date | null;
  depositPaymentPurpose?: string | null;
  creditApplied: Decimal.Value;
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
  pdfCache?: Buffer | null;
  pdfCacheHash?: string | null;
  pdfCachedAt?: Date | null;
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

export interface CreditNoteLineItem {
  id: string;
  creditNoteId: string;
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

export interface CreditNote {
  id: string;
  businessId: string;
  customerId: string;
  referenceInvoiceId?: string | null;
  creditNoteNumber?: string | null;
  status: "draft" | "finalized" | "cancelled" | "void";
  issueDate?: Date | null;
  currency: CurrencyCode;
  reason?: string | null;
  notes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  subtotal: Decimal.Value;
  discountTotal: Decimal.Value;
  taxTotal: Decimal.Value;
  feeTotal: Decimal.Value;
  total: Decimal.Value;
  appliedTotal: Decimal.Value;
  amountDue: Decimal.Value;
  isFinalized: boolean;
  finalizedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelledReason?: string | null;
  voidedAt?: Date | null;
  voidReason?: string | null;
  publicToken?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface CreditNoteApplication {
  id: string;
  creditNoteId: string;
  invoiceId: string;
  businessId: string;
  amount: Decimal.Value;
  appliedAt: Date;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
}

export interface ReminderRule {
  id: string;
  businessId: string;
  name: string;
  triggerType: "before_due" | "after_due" | "manual";
  offsetDays: number;
  minStatus: string;
  maxSendCount: number;
  subjectTemplate: string;
  messageTemplate: string;
  includePdf: boolean;
  emailTemplateId?: string | null;
  repeatEveryDays: number;
  isActive: boolean;
  lastRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplate {
  id: string;
  businessId: string;
  name: string;
  templateType: string;
  locale: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface ScheduledEmail {
  id: string;
  businessId: string;
  invoiceId?: string | null;
  creditNoteId?: string | null;
  emailTemplateId?: string | null;
  recipient: string;
  recipientName?: string | null;
  subject: string;
  bodyHtml: string;
  attachmentType?: string | null;
  attachmentFilename?: string | null;
  idempotencyKey: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  attempts: number;
  availableAt: Date;
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Receipt {
  id: string;
  businessId: string;
  invoiceId: string;
  paymentId: string;
  receiptNumber: string;
  amount: Decimal.Value;
  currency: CurrencyCode;
  paymentMethod?: string | null;
  paymentPurpose?: string | null;
  status: "pending" | "issued" | "sent" | "failed";
  issuedAt?: Date | null;
  emailLogId?: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
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
  templateId?: string | null;
  issueOffsetDays: number;
  dueOffsetDays: number;
  autoSend: boolean;
  deliveryMethod: string;
  emailTemplateId?: string | null;
  paymentInstructions?: string | null;
  depositAmount: Decimal.Value;
  depositType: "none" | "fixed" | "percentage";
  depositDueOffsetDays?: number | null;
  depositPaymentPurpose?: string | null;
  lastGenerationAt?: Date | null;
  pausedAt?: Date | null;
  generationVersion: number;
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
  documentType: string;
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
  documentType: "invoice" | "quote" | "recurring_invoice";
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

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";

export interface ProjectTag {
  id: string;
  businessId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface ProjectTeamMember {
  id: string;
  projectId: string;
  businessId: string;
  userId: string;
  role: string;
  assignedAt: Date;
  assignedBy: string | null;
}

export interface ProjectEvent {
  id: string;
  projectId: string;
  businessId: string;
  eventType: string;
  actorId: string | null;
  actorType: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Project {
  id: string;
  businessId: string;
  customerId: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  dueDate: Date | null;
  budget: string;
  currency: string;
  amountInvoiced: string;
  amountPaid: string;
  remainingBillable: string;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithDetails extends Project {
  customer: Customer | null;
  tags: ProjectTag[];
  teamMembers: ProjectTeamMember[];
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
