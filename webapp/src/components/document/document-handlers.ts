/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createInvoice,
  updateInvoice,
  finalizeInvoice,
  sendInvoice,
  duplicateInvoice,
  getInvoice,
  getInvoicePdf,
  type CreateInvoiceInput,
  createQuote,
  updateQuote,
  finalizeQuote,
  sendQuote,
  duplicateQuote,
  getQuote,
  getQuotePdf,
  type CreateQuoteInput,
  createCreditNoteDraft,
  finalizeCreditNote,
  getCreditNote,
  getCreditNotePdf,
  type CreateCreditNoteInput,
  createDebitNote,
  updateDebitNote,
  finalizeDebitNote,
  sendDebitNote,
  getDebitNote,
  getDebitNotePdf,
  type ApiCreateDebitNoteInput,
  createPaymentVoucher,
  updatePaymentVoucher,
  finalizePaymentVoucher,
  getPaymentVoucher,
  getPaymentVoucherPdf,
  type ApiCreatePaymentVoucherInput,
  getReceiptById,
  getReceiptPdf,
  emailReceipt,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  finalizePurchaseOrder,
  sendPurchaseOrder,
  getPurchaseOrderPdf,
  type ApiCreatePurchaseOrderInput,
} from "@/api/client";
import {
  invoiceStatusConfig,
  quoteStatusConfig,
  creditNoteStatusConfig,
  debitNoteStatusConfig,
  paymentVoucherStatusConfig,
  receiptStatusConfig,
  purchaseOrderStatusConfig,
} from "@/components/ui";
import type { StatusConfig } from "@/types/components";
import type { DocumentType } from "@/components/document/document-types";

export interface FinalizeResult {
  document: any;
  documentNumber: string;
  status: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  status: string;
  sentAt: string;
  document: any;
}

export interface DocumentFormConfig {
  showsDueDate: boolean;
  showsExpiryDate: boolean;
  showsPoNumber: boolean;
  showsShippingFields: boolean;
  showsQuoteDiscount: boolean;
  showsInvoiceDiscount: boolean;
  showsReasonField: boolean;
  showsReferenceInvoice: boolean;
  showsPayeeSection: boolean;
  showsSupplierSection: boolean;
  showsDeliveryDate: boolean;
  showsOptionalItems: boolean;
  discountField: "invoiceDiscount" | "quoteDiscount";
  totalsCardType: "invoice" | "quote" | "credit-note" | "debit-note" | "payment-voucher";
  showSignedAmounts: boolean;
  isPaymentVoucher: boolean;
  isCreditNote: boolean;
  isDebitNote: boolean;
  isQuote: boolean;
  isInvoice: boolean;
  requiresCustomer: boolean;
}

export interface DocumentHandler {
  create: (data: Record<string, unknown>) => Promise<any>;
  update: (id: string, data: Record<string, unknown>) => Promise<any>;
  finalize: (id: string) => Promise<FinalizeResult>;
  send: (
    id: string,
    data?: { to?: string | null; cc?: string | null; bcc?: string | null; subject?: string | null; message?: string | null },
  ) => Promise<SendResult | { success: boolean; messageId: string; status: string }>;
  duplicate: (id: string) => Promise<any>;
  fetchDetail: (id: string) => Promise<any>;
  getPdf: (id: string) => Promise<Blob>;
  getNumberField: (doc: any) => string | undefined;
  statusConfig: { getConfig: (status: string) => StatusConfig; configs: Record<string, StatusConfig> };
  label: string;
  pluralLabel: string;
  routePrefix: string;
  supportsSend: boolean;
  supportsFinalize: boolean;
  supportsDuplicate: boolean;
  requiresCustomer: boolean;
  formConfig: DocumentFormConfig;
}

export const documentHandlers: Record<DocumentType, DocumentHandler> = {
  invoice: {
    create: async (data) => {
      const res = await createInvoice(data as unknown as CreateInvoiceInput);
      return res;
    },
    update: async (id, data) => {
      return updateInvoice(id, data as unknown as Partial<CreateInvoiceInput>);
    },
    finalize: async (id) => {
      const result = await finalizeInvoice(id);
      return {
        document: result.invoice,
        documentNumber: result.invoiceNumber,
        status: result.status,
      };
    },
    send: async (id, data) => {
      const result = await sendInvoice(id, data ?? {});
      return {
        success: result.success,
        messageId: result.messageId,
        status: result.status,
        sentAt: result.sentAt,
        document: result.invoice,
      };
    },
    duplicate: async (id) => {
      return duplicateInvoice(id);
    },
    fetchDetail: async (id) => {
      const res = await getInvoice(id);
      return res.invoice;
    },
    getPdf: async (id) => {
      return getInvoicePdf(id);
    },
    getNumberField: (doc) => doc.invoice_number ?? doc.id?.slice(0, 8),
    statusConfig: invoiceStatusConfig,
    label: "Invoice",
    pluralLabel: "Invoices",
    routePrefix: "invoices",
    supportsSend: true,
    supportsFinalize: true,
    supportsDuplicate: true,
    requiresCustomer: true,
    formConfig: {
      showsDueDate: true,
      showsExpiryDate: false,
      showsPoNumber: true,
      showsShippingFields: true,
      showsQuoteDiscount: false,
      showsInvoiceDiscount: true,
      showsReasonField: false,
      showsReferenceInvoice: false,
      showsPayeeSection: false,
      showsSupplierSection: false,
      showsDeliveryDate: false,
      showsOptionalItems: false,
      discountField: "invoiceDiscount",
      totalsCardType: "invoice",
      showSignedAmounts: false,
      isPaymentVoucher: false,
       isCreditNote: false,
       isDebitNote: false,
       isQuote: false,
        isInvoice: true,
        requiresCustomer: true,
     },
   },

   quote: {
     create: async (data) => {
       return createQuote(data as unknown as CreateQuoteInput);
    },
    update: async (id, data) => {
      return updateQuote(id, data as unknown as Partial<CreateQuoteInput>);
    },
    finalize: async (id) => {
      const result = await finalizeQuote(id);
      return {
        document: result.quote,
        documentNumber: result.quoteNumber,
        status: result.status,
      };
    },
    send: async (id, data) => {
      const result = await sendQuote(id, data ?? {});
      return {
        success: result.success,
        messageId: result.messageId,
        status: result.status,
        sentAt: result.sentAt,
        document: result.quote,
      };
    },
    duplicate: async (id) => {
      return duplicateQuote(id);
    },
    fetchDetail: async (id) => {
      const res = await getQuote(id);
      return res.quote;
    },
    getPdf: async (id) => {
      return getQuotePdf(id);
    },
    getNumberField: (doc) => doc.quote_number ?? doc.id?.slice(0, 8),
    statusConfig: quoteStatusConfig,
    label: "Quotation",
    pluralLabel: "Quotations",
    routePrefix: "quotes",
    supportsSend: true,
    supportsFinalize: true,
    supportsDuplicate: true,
    requiresCustomer: true,
    formConfig: {
      showsDueDate: false,
      showsExpiryDate: true,
      showsPoNumber: false,
      showsShippingFields: false,
      showsQuoteDiscount: true,
      showsInvoiceDiscount: false,
      showsReasonField: false,
      showsReferenceInvoice: false,
      showsPayeeSection: false,
      showsSupplierSection: false,
      showsDeliveryDate: false,
      showsOptionalItems: true,
      discountField: "quoteDiscount",
      totalsCardType: "quote",
      showSignedAmounts: false,
      isPaymentVoucher: false,
       isCreditNote: false,
       isDebitNote: false,
        isQuote: true,
        isInvoice: false,
        requiresCustomer: true,
     },
   },

   "credit-note": {
    create: async (data) => {
      return createCreditNoteDraft(data as unknown as CreateCreditNoteInput);
    },
    update: async () => {
      throw new Error("Credit notes are created from invoices");
    },
    finalize: async (id) => {
      const result = await finalizeCreditNote(id);
      return {
        document: result.creditNote,
        documentNumber: result.creditNoteNumber,
        status: "finalized",
      };
    },
    send: async () => {
      throw new Error("Send for credit notes not yet supported");
    },
    duplicate: async () => {
      throw new Error("Duplicate for credit notes not yet supported");
    },
    fetchDetail: async (id) => {
      const res = await getCreditNote(id);
      return res.creditNote;
    },
    getPdf: async (id) => {
      return getCreditNotePdf(id);
    },
    getNumberField: (doc) => doc.credit_note_number ?? doc.id?.slice(0, 8),
    statusConfig: creditNoteStatusConfig,
    label: "Credit Note",
    pluralLabel: "Credit Notes",
    routePrefix: "credit-notes",
    supportsSend: false,
    supportsFinalize: true,
    supportsDuplicate: false,
    requiresCustomer: true,
    formConfig: {
      showsDueDate: false,
      showsExpiryDate: false,
      showsPoNumber: false,
      showsShippingFields: false,
      showsQuoteDiscount: false,
      showsInvoiceDiscount: false,
      showsReasonField: true,
      showsReferenceInvoice: true,
      showsPayeeSection: false,
      showsSupplierSection: false,
      showsDeliveryDate: false,
      showsOptionalItems: false,
      discountField: "invoiceDiscount",
      totalsCardType: "credit-note",
      showSignedAmounts: true,
      isPaymentVoucher: false,
       isCreditNote: true,
       isDebitNote: false,
       isQuote: false,
        isInvoice: false,
        requiresCustomer: true,
     },
   },

   "debit-note": {
    create: async (data) => {
      return createDebitNote(data as unknown as ApiCreateDebitNoteInput);
    },
    update: async (id, data) => {
      return updateDebitNote(id, data as unknown as Partial<ApiCreateDebitNoteInput>);
    },
    finalize: async (id) => {
      const result = await finalizeDebitNote(id);
      return {
        document: result.debitNote,
        documentNumber: result.debitNoteNumber,
        status: "finalized",
      };
    },
    send: async (id, data) => {
      const result = await sendDebitNote(id, {
        to: data?.to ?? undefined,
        cc: data?.cc ? data.cc.split(",").map((e) => e.trim()).filter(Boolean) : [],
        bcc: data?.bcc ? data.bcc.split(",").map((e) => e.trim()).filter(Boolean) : [],
        subject: data?.subject ?? undefined,
        message: data?.message ?? undefined,
      });
      return {
        success: result.ok,
        messageId: result.messageId,
        status: result.status,
      };
    },
    duplicate: async () => {
      throw new Error("Duplicate for debit notes not yet supported");
    },
    fetchDetail: async (id) => {
      const res = await getDebitNote(id);
      return res.debitNote;
    },
    getPdf: async (id) => {
      return getDebitNotePdf(id);
    },
    getNumberField: (doc) => doc.debit_note_number ?? doc.id?.slice(0, 8),
    statusConfig: debitNoteStatusConfig,
    label: "Debit Note",
    pluralLabel: "Debit Notes",
    routePrefix: "debit-notes",
    supportsSend: true,
    supportsFinalize: true,
    supportsDuplicate: false,
    requiresCustomer: false,
    formConfig: {
      showsDueDate: false,
      showsExpiryDate: false,
      showsPoNumber: false,
      showsShippingFields: false,
      showsQuoteDiscount: false,
      showsInvoiceDiscount: false,
      showsReasonField: true,
      showsReferenceInvoice: true,
      showsPayeeSection: false,
      showsSupplierSection: false,
      showsDeliveryDate: false,
      showsOptionalItems: false,
      discountField: "invoiceDiscount",
      totalsCardType: "debit-note",
      showSignedAmounts: false,
      isPaymentVoucher: false,
      isCreditNote: false,
      isDebitNote: true,
      isQuote: false,
      isInvoice: false,
      requiresCustomer: true,
    },
  },

  "payment-voucher": {
    create: async (data) => {
      return createPaymentVoucher(data as unknown as ApiCreatePaymentVoucherInput);
    },
    update: async (id, data) => {
      return updatePaymentVoucher(id, data as unknown as Partial<ApiCreatePaymentVoucherInput>);
    },
    finalize: async (id) => {
      const result = await finalizePaymentVoucher(id);
      return {
        document: result.voucher,
        documentNumber: result.voucherNumber,
        status: result.voucher?.status ?? "issued",
      };
    },
    send: async () => {
      throw new Error("Send for payment vouchers not yet supported");
    },
    duplicate: async () => {
      throw new Error("Duplicate for payment vouchers not yet supported");
    },
    fetchDetail: async (id) => {
      const res = await getPaymentVoucher(id);
      return res.voucher;
    },
    getPdf: async (id) => {
      return getPaymentVoucherPdf(id);
    },
    getNumberField: (doc) => doc.payment_voucher_number ?? doc.id?.slice(0, 8),
    statusConfig: paymentVoucherStatusConfig,
    label: "Payment Voucher",
    pluralLabel: "Payment Vouchers",
    routePrefix: "payment-vouchers",
    supportsSend: false,
    supportsFinalize: true,
    supportsDuplicate: false,
    requiresCustomer: false,
    formConfig: {
      showsDueDate: false,
      showsExpiryDate: false,
      showsPoNumber: false,
      showsShippingFields: false,
      showsQuoteDiscount: false,
      showsInvoiceDiscount: false,
      showsReasonField: false,
      showsReferenceInvoice: false,
      showsPayeeSection: true,
      showsSupplierSection: false,
      showsDeliveryDate: false,
      showsOptionalItems: false,
      discountField: "invoiceDiscount",
      totalsCardType: "payment-voucher",
      showSignedAmounts: false,
      isPaymentVoucher: true,
      isCreditNote: false,
      isDebitNote: false,
      isQuote: false,
      isInvoice: false,
      requiresCustomer: false,
    },
  },

  receipt: {
    create: async () => {
      throw new Error("Receipts are generated from payments, not created directly");
    },
    update: async () => {
      throw new Error("Receipts cannot be updated");
    },
    finalize: async () => {
      throw new Error("Receipts are already finalized when issued");
    },
    send: async (id, data) => {
      const result = await emailReceipt(id, {
        email: data?.to ?? "",
        name: data?.subject ?? undefined,
        subject: data?.subject ?? undefined,
        message: data?.message ?? undefined,
      });
      return {
        success: result.ok,
        messageId: result.messageId,
        status: result.status,
      };
    },
    duplicate: async () => {
      throw new Error("Receipts cannot be duplicated");
    },
    fetchDetail: async (id) => {
      const res = await getReceiptById(id);
      return res.receipt;
    },
    getPdf: async (id) => {
      return getReceiptPdf(id);
    },
    getNumberField: (doc) => doc.receipt_number ?? doc.id?.slice(0, 8),
    statusConfig: receiptStatusConfig,
    label: "Receipt",
    pluralLabel: "Receipts",
    routePrefix: "receipts",
    supportsSend: true,
    supportsFinalize: false,
    supportsDuplicate: false,
    requiresCustomer: false,
    formConfig: {
      showsDueDate: false,
      showsExpiryDate: false,
      showsPoNumber: false,
      showsShippingFields: false,
      showsQuoteDiscount: false,
      showsInvoiceDiscount: false,
      showsReasonField: false,
      showsReferenceInvoice: false,
      showsPayeeSection: false,
      showsSupplierSection: false,
      showsDeliveryDate: false,
      showsOptionalItems: false,
      discountField: "invoiceDiscount",
      totalsCardType: "payment-voucher",
      showSignedAmounts: false,
      isPaymentVoucher: false,
      isCreditNote: false,
      isDebitNote: false,
      isQuote: false,
      isInvoice: false,
      requiresCustomer: false,
    },
  },

  "purchase-order": {
    create: async (data) => {
      return createPurchaseOrder(data as unknown as ApiCreatePurchaseOrderInput);
    },
    update: async (id, data) => {
      return updatePurchaseOrder(id, data as Partial<ApiCreatePurchaseOrderInput>);
    },
    finalize: async (id) => {
      const result = await finalizePurchaseOrder(id);
      return {
        document: result.purchaseOrder,
        documentNumber: result.purchaseOrderNumber,
        status: result.purchaseOrder?.status ?? "finalized",
      };
    },
    send: async (id, data) => {
      const result = await sendPurchaseOrder(id, data ?? {});
      return {
        success: result.success,
        messageId: result.messageId,
        status: result.status,
        sentAt: new Date().toISOString(),
        document: result.purchaseOrder,
      };
    },
    duplicate: async () => {
      throw new Error("Duplicate for purchase orders not yet supported");
    },
    fetchDetail: async (id) => {
      const res = await getPurchaseOrder(id);
      return res.purchaseOrder;
    },
    getPdf: async (id) => {
      return getPurchaseOrderPdf(id);
    },
    getNumberField: (doc) => doc.purchase_order_number ?? doc.id?.slice(0, 8),
    statusConfig: purchaseOrderStatusConfig,
    label: "Purchase Order",
    pluralLabel: "Purchase Orders",
    routePrefix: "purchase-orders",
    supportsSend: true,
    supportsFinalize: true,
    supportsDuplicate: false,
    requiresCustomer: false,
    formConfig: {
      showsDueDate: false,
      showsExpiryDate: false,
      showsPoNumber: false,
      showsShippingFields: false,
      showsQuoteDiscount: false,
      showsInvoiceDiscount: false,
      showsReasonField: false,
      showsReferenceInvoice: false,
      showsPayeeSection: false,
      showsSupplierSection: true,
      showsDeliveryDate: true,
      showsOptionalItems: false,
      discountField: "invoiceDiscount",
      totalsCardType: "invoice",
      showSignedAmounts: false,
      isPaymentVoucher: false,
      isCreditNote: false,
      isDebitNote: false,
      isQuote: false,
      isInvoice: false,
      requiresCustomer: false,
    },
  },
};

export function getDocumentHandler(docType: DocumentType): DocumentHandler {
  const handler = documentHandlers[docType as keyof typeof documentHandlers];
  if (!handler) {
    throw new Error(`No document handler registered for type: ${docType}`);
  }
  return handler;
}

export function getDocumentLabel(docType: DocumentType): string {
  return getDocumentHandler(docType).label;
}

export function getDocumentPluralLabel(docType: DocumentType): string {
  return getDocumentHandler(docType).pluralLabel;
}

export function getDocumentRoutePrefix(docType: DocumentType): string {
  return getDocumentHandler(docType).routePrefix;
}

export function docTypeLabel(type: DocumentType): string {
  const labels: Record<string, string> = {
    invoice: "Invoice",
    quote: "Quotation",
    "credit-note": "Credit Note",
    "debit-note": "Debit Note",
    "payment-voucher": "Payment Voucher",
    receipt: "Receipt",
    "purchase-order": "Purchase Order",
  };
  return labels[type] ?? "Document";
}
