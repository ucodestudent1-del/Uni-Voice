import type { ApiInvoiceItem, ApiInvoiceFee } from "@/types/api";
import type { ApiQuoteItem, ApiQuoteFee } from "@/types/api";

export type DocumentType = "invoice" | "quote" | "credit-note" | "debit-note" | "payment-voucher" | "receipt" | "purchase-order";

export interface DocumentLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  taxName: string;
  isTaxInclusive: boolean;
  discount: string;
  discountType: "fixed" | "percentage";
  productId: string | null;
  isOptional?: boolean;
}

export function initialLineItem(): DocumentLineItem {
  return {
    description: "",
    quantity: "1",
    unit: "each",
    unitPrice: "0.00",
    taxRate: "0",
    taxName: "",
    isTaxInclusive: false,
    discount: "0",
    discountType: "percentage",
    productId: null,
    isOptional: false,
  };
}

export interface DocumentFee {
  description: string;
  amount: string;
  taxRate: string;
  taxName: string;
}

export interface DocumentState {
  customerId: string;
  currency: string;
  issueDate: string;
  notes: string;
  terms: string;
  paymentInstructions: string;
  items: DocumentLineItem[];
  fees: DocumentFee[];
  invoiceDiscount: string;
  invoiceDiscountType: "fixed" | "percentage";

  dueDate?: string;
  poNumber?: string;
  paymentTerms?: string;

  expiryDate?: string;
  scopeOfWork?: string;
  internalNotes?: string;
  quoteDiscount?: string;
  quoteDiscountType?: "fixed" | "percentage";

  referenceInvoiceId?: string;
  reason?: string;
  customReason?: string;

  shippingDescription?: string;
  shippingAmount?: string;
  shippingTaxRate?: string;

   /** Debit-note-specific fields */
   referenceInvoiceNumber?: string;

  /** Payment-voucher-specific fields */
  payeeName?: string;
  payeeEmail?: string;
  payeePhone?: string;
  payeeAddressLine1?: string;
  payeeAddressLine2?: string;
  payeeCity?: string;
  payeeStateOrRegion?: string;
  payeePostalCode?: string;
  payeeCountryCode?: string;
  payeeTaxId?: string;
  voucherDate?: string;
  referenceNumber?: string;
   paymentMethod?: string;
   paymentProvider?: string;

   /** Receipt-specific fields */
   receiptAmount?: string;
   receiptPaymentMethod?: string;
   receiptPaymentProvider?: string;
   receiptProviderPaymentId?: string;
   receiptIssuedAt?: string;

   /** Purchase-order-specific fields */
   supplierName?: string;
   supplierEmail?: string;
   supplierPhone?: string;
   supplierTaxId?: string;
   supplierAddressLine1?: string;
   supplierAddressLine2?: string;
   supplierCity?: string;
   supplierStateOrRegion?: string;
   supplierPostalCode?: string;
   supplierCountryCode?: string;
   deliveryDate?: string;
   shippingAddressLine1?: string;
   shippingAddressLine2?: string;
   shippingCity?: string;
   shippingStateOrRegion?: string;
   shippingPostalCode?: string;
   shippingCountryCode?: string;
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  field?: string;
}

export interface TaxRateOption {
  value: string;
  label: string;
  taxId: string;
  rate: string;
  name: string;
}

export interface DocumentApiResult {
  id: string;
  invoice_number?: string | null;
  quote_number?: string | null;
  credit_note_number?: string | null;
  debit_note_number?: string | null;
  payment_voucher_number?: string | null;
  status: string;
  is_finalized: boolean;
  customer_id?: string | null;
  currency: string;
  issue_date?: string | null;
  due_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  terms?: string | null;
  payment_instructions?: string | null;
  po_number?: string | null;
  payment_terms?: string | null;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  fee_total: string;
  total: string;
  amount_paid?: string;
  amount_due?: string;
  scope_of_work?: string | null;
  internal_notes?: string | null;
  quote_discount_value?: string | null;
  quote_discount_type?: "fixed" | "percentage" | null;
  reference_invoice_id?: string | null;
  reference_invoice_number?: string | null;
  reason?: string | null;

  invoice_discount?: string | null;
  invoice_discount_type?: "fixed" | "percentage" | null;
  shipping_description?: string | null;
  shipping_amount?: string | null;
  shipping_tax_rate?: string | null;

  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;

  /** Payment voucher fields */
  voucher_date?: string | null;
  payee_name?: string | null;
  payee_email?: string | null;
  payee_phone?: string | null;
   payment_method?: string | null;
   payment_provider?: string | null;
   reference_number?: string | null;

   /** Receipt fields */
   receipt_number?: string | null;
   receipt_amount?: string | null;
   receipt_payment_method?: string | null;
   receipt_payment_provider?: string | null;
   receipt_provider_payment_id?: string | null;
   issued_at?: string | null;

   /** Purchase-order fields */
   purchase_order_number?: string | null;
   supplier_name?: string | null;
   supplier_email?: string | null;
   supplier_phone?: string | null;
   supplier_tax_id?: string | null;
   supplier_address_line_1?: string | null;
   supplier_address_line_2?: string | null;
   supplier_city?: string | null;
   supplier_state_or_region?: string | null;
   supplier_postal_code?: string | null;
   supplier_country_code?: string | null;
   delivery_date?: string | null;
   shipping_address_line_1?: string | null;
   shipping_address_line_2?: string | null;
   shipping_city?: string | null;
   shipping_state_or_region?: string | null;
   shipping_postal_code?: string | null;
   shipping_country_code?: string | null;

   items: Array<ApiInvoiceItem | ApiInvoiceFee | ApiQuoteItem | ApiQuoteFee>;
   fees: DocumentFee[];
   payments?: unknown[];
   events?: unknown[];
}
