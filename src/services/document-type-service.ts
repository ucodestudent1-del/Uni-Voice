import type { DocumentTypeKey } from "./templates/template-renderer.js";
import { invoiceService } from "./invoice-service.js";
import { quoteService } from "./quote-service.js";
import { debitNoteService } from "./debit-note-service.js";
import { paymentVoucherService } from "./payment-voucher-service.js";
import { receiptService } from "./receipt-service.js";
import { purchaseOrderService } from "./purchase-order-service.js";
import { genericDocumentService } from "./generic-document-service.js";

export class DocumentTypeService {
  async fetchDocumentById(
    docType: DocumentTypeKey,
    businessId: string,
    docId: string,
  ): Promise<Record<string, unknown> | null> {
    switch (docType) {
      case "invoice":
        return await invoiceService.findById(businessId, docId);
      case "quote":
        return await quoteService.findById(businessId, docId);
      case "credit-note":
        return await invoiceService.getCreditNoteById(businessId, docId);
      case "debit-note":
        return await debitNoteService.findById(businessId, docId);
      case "payment-voucher":
        return await paymentVoucherService.findById(businessId, docId);
      case "receipt":
        return (await receiptService.getById(businessId, docId)) as unknown as Record<string, unknown> | null;
      case "purchase-order":
        return await purchaseOrderService.findById(businessId, docId);
      case "recurring-invoice":
        return await genericDocumentService.findById(businessId, docId, "recurring-invoice");
      case "delivery-note":
        return await genericDocumentService.findById(businessId, docId, "delivery-note");
      case "packing-slip":
        return await genericDocumentService.findById(businessId, docId, "packing-slip");
      case "pro-forma-invoice":
        return await genericDocumentService.findById(businessId, docId, "pro-forma-invoice");
      case "estimate":
        return await genericDocumentService.findById(businessId, docId, "estimate");
      default:
        throw new Error(`Unknown document type: ${docType}`);
    }
  }

  async createDocument(
    businessId: string,
    docType: DocumentTypeKey,
    input: Record<string, unknown>,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    switch (docType) {
      case "invoice":
        return await invoiceService.create(businessId, input as any, userId);
      case "quote":
        return await quoteService.create(businessId, input as any, userId);
      case "credit-note":
        return await invoiceService.createCreditNote(businessId, input as any, userId);
      case "debit-note":
        return await debitNoteService.create(businessId, input as any, userId);
      case "payment-voucher":
        return await paymentVoucherService.create(businessId, input as any, userId);
      case "receipt":
        return (await receiptService.issueReceipt(
          businessId,
          input.invoiceId as string,
          input as any,
        )) as unknown as Record<string, unknown>;
      case "purchase-order":
        return await purchaseOrderService.create(businessId, input as any, userId);
      case "recurring-invoice":
        return await genericDocumentService.create(businessId, "recurring-invoice", input as any, userId);
      case "delivery-note":
        return await genericDocumentService.create(businessId, "delivery-note", input as any, userId);
      case "packing-slip":
        return await genericDocumentService.create(businessId, "packing-slip", input as any, userId);
      case "pro-forma-invoice":
        return await genericDocumentService.create(businessId, "pro-forma-invoice", input as any, userId);
      case "estimate":
        return await genericDocumentService.create(businessId, "estimate", input as any, userId);
      default:
        throw new Error(`Unknown document type: ${docType}`);
    }
  }

  async finalizeDocument(
    businessId: string,
    docType: DocumentTypeKey,
    docId: string,
    userId?: string,
  ): Promise<unknown> {
    switch (docType) {
      case "invoice":
        return await invoiceService.finalize(businessId, docId, userId);
      case "quote":
        return await quoteService.finalize(businessId, docId, userId);
      case "credit-note":
        return await invoiceService.finalizeCreditNote(businessId, docId, userId ?? null);
      case "debit-note":
        return await debitNoteService.finalize(businessId, docId, userId);
      case "payment-voucher":
        return await paymentVoucherService.finalize(businessId, docId, userId);
      case "purchase-order":
        return await purchaseOrderService.finalize(businessId, docId, userId);
      case "receipt":
        throw new Error("Receipts cannot be finalized via this method");
      case "recurring-invoice":
        return await genericDocumentService.findById(businessId, docId, "recurring-invoice");
      case "delivery-note":
        return await genericDocumentService.findById(businessId, docId, "delivery-note");
      case "packing-slip":
        return await genericDocumentService.findById(businessId, docId, "packing-slip");
      case "pro-forma-invoice":
        return await genericDocumentService.findById(businessId, docId, "pro-forma-invoice");
      case "estimate":
        return await genericDocumentService.findById(businessId, docId, "estimate");
      default:
        throw new Error(`Unknown document type: ${docType}`);
    }
  }

  async sendDocument(
    businessId: string,
    docType: DocumentTypeKey,
    docId: string,
    payload: {
      to?: string | null;
      cc?: string[] | null;
      bcc?: string[] | null;
      subject?: string | null;
      message?: string | null;
    },
    userId?: string,
  ): Promise<unknown> {
    const typedPayload = {
      to: payload.to ?? null,
      cc: payload.cc ?? null,
      bcc: payload.bcc ?? null,
      subject: payload.subject ?? null,
      message: payload.message ?? null,
    };

    switch (docType) {
      case "invoice":
        return await invoiceService.send(businessId, docId, typedPayload as any, userId);
      case "quote":
        return await quoteService.send(businessId, docId, typedPayload as any, userId);
      case "credit-note":
        return await invoiceService.sendCreditNote(businessId, docId, typedPayload as any, userId);
      case "debit-note":
        return await debitNoteService.send(businessId, docId, typedPayload as any, userId);
      case "payment-voucher":
        throw new Error("Payment vouchers do not support sending");
      case "purchase-order":
        return await purchaseOrderService.send(businessId, docId, typedPayload as any, userId);
      case "receipt":
        return await receiptService.sendReceiptEmail(
          docId,
          businessId,
          {
            email: payload.to ?? "",
            subject: payload.subject ?? undefined,
            message: payload.message ?? undefined,
          },
        );
      case "recurring-invoice":
        throw new Error("Recurring invoices do not support sending directly");
      case "delivery-note":
        return await genericDocumentService.generatePdf(businessId, docId, "delivery-note");
      case "packing-slip":
        return await genericDocumentService.generatePdf(businessId, docId, "packing-slip");
      case "pro-forma-invoice":
        return await genericDocumentService.generatePdf(businessId, docId, "pro-forma-invoice");
      case "estimate":
        return await genericDocumentService.generatePdf(businessId, docId, "estimate");
      default:
        throw new Error(`Unknown document type: ${docType}`);
    }
  }
}

export const documentTypeService = new DocumentTypeService();
