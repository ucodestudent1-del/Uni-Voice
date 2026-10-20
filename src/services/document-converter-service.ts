import { Decimal } from "decimal.js";
import { query } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { DocumentService } from "./document-service.js";
import type { DocumentTypeKey } from "./templates/template-renderer.js";
import { documentTypeService } from "./document-type-service.js";
import { documentStateMachine } from "./state-machine/document-state-machine.js";
import { documentSnapshotService } from "./snapshot/document-snapshot-service.js";

export interface ConversionOptions {
  sourceId: string;
  sourceType: DocumentTypeKey;
  targetType: DocumentTypeKey;
  copyItems?: boolean;
  copyCustomer?: boolean;
  overrideFields?: Record<string, unknown>;
  userId?: string;
}

export interface ConversionResult {
  conversionId: string;
  targetDocumentId: string;
  targetDocumentType: DocumentTypeKey;
  sourceDocumentId: string;
  sourceDocumentType: DocumentTypeKey;
  status: "draft" | "finalized";
  auditTrail: ConversionAuditEntry[];
}

export interface ConversionAuditEntry {
  timestamp: string;
  action: string;
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
}

export type ConversionMap = Record<DocumentTypeKey, DocumentTypeKey[]>;

export const AVAILABLE_CONVERSIONS: ConversionMap = {
  invoice: ["purchase-order", "credit-note", "debit-note"],
  quote: ["invoice", "purchase-order", "credit-note", "debit-note"],
  "credit-note": ["invoice"],
  "debit-note": ["invoice"],
  "payment-voucher": ["receipt"],
  receipt: [],
  "purchase-order": ["invoice", "debit-note"],
};

export class DocumentConverterService {
  private documentService: DocumentService;

  constructor(documentService: DocumentService) {
    this.documentService = documentService;
  }

  getAvailableConversions(sourceType: DocumentTypeKey): DocumentTypeKey[] {
    return AVAILABLE_CONVERSIONS[sourceType] ?? [];
  }

  canConvert(sourceType: DocumentTypeKey, targetType: DocumentTypeKey): boolean {
    const targets = AVAILABLE_CONVERSIONS[sourceType];
    return targets ? targets.includes(targetType) : false;
  }

  async convert(
    businessId: string,
    opts: ConversionOptions,
  ): Promise<ConversionResult> {
    if (!this.canConvert(opts.sourceType, opts.targetType)) {
      throw new Error(
        `Cannot convert from ${opts.sourceType} to ${opts.targetType}`,
      );
    }

    const sourceDoc = await this.fetchSourceDocument(
      businessId,
      opts.sourceType,
      opts.sourceId,
    );

    const templateData = await this.documentService.generateOutput(
      opts.sourceType,
      businessId,
      opts.sourceId,
      "pdf",
    );

    void templateData;

    const convertedInput = this.mapFields(
      opts.sourceType,
      opts.targetType,
      sourceDoc,
      opts,
    );

    const targetDoc = await documentTypeService.createDocument(
      businessId,
      opts.targetType,
      convertedInput,
      opts.userId,
    );

    const auditTrail = this.buildAuditTrail(
      opts.sourceType,
      opts.targetType,
      sourceDoc,
      targetDoc,
    );

    const conversionId = await this.recordConversion(
      businessId,
      opts.sourceType,
      opts.sourceId,
      opts.targetType,
      targetDoc.id as string,
      opts.userId,
    );

    const sourceFinalized = documentStateMachine.isTerminalStatus(
      opts.sourceType,
      (sourceDoc.status as string) ?? "draft",
    );

    return {
      conversionId,
      targetDocumentId: targetDoc.id as string,
      targetDocumentType: opts.targetType,
      sourceDocumentId: opts.sourceId,
      sourceDocumentType: opts.sourceType,
      status: sourceFinalized ? "finalized" : "draft",
      auditTrail,
    };
  }

  async convertFromSnapshot(
    businessId: string,
    snapshotId: string,
    targetType: DocumentTypeKey,
    userId?: string,
  ): Promise<ConversionResult> {
    const snapshot = await documentSnapshotService.findById(snapshotId, businessId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const sourceType = snapshot.documentType as DocumentTypeKey;

    if (!this.canConvert(sourceType, targetType)) {
      throw new Error(
        `Cannot convert from ${sourceType} (snapshot) to ${targetType}`,
      );
    }

    const sourceDoc = snapshot.snapshot;

    const convertedInput = this.mapFields(
      sourceType,
      targetType,
      sourceDoc as Record<string, unknown>,
      { sourceId: snapshot.documentId, sourceType, targetType, userId },
    );

    const targetDoc = await documentTypeService.createDocument(
      businessId,
      targetType,
      convertedInput,
      userId,
    );

    const auditTrail = this.buildAuditTrail(
      sourceType,
      targetType,
      sourceDoc as Record<string, unknown>,
      targetDoc,
    );

    const conversionId = await this.recordConversion(
      businessId,
      sourceType,
      snapshot.documentId,
      targetType,
      targetDoc.id as string,
      userId,
    );

    return {
      conversionId,
      targetDocumentId: targetDoc.id as string,
      targetDocumentType: targetType,
      sourceDocumentId: snapshot.documentId,
      sourceDocumentType: sourceType,
      status: "draft",
      auditTrail,
    };
  }

  private async fetchSourceDocument(
    businessId: string,
    sourceType: DocumentTypeKey,
    sourceId: string,
  ): Promise<Record<string, unknown>> {
    switch (sourceType) {
      case "invoice":
        return (await documentTypeService.fetchDocumentById("invoice", businessId, sourceId)) as Record<string, unknown>;
      case "quote":
        return (await documentTypeService.fetchDocumentById("quote", businessId, sourceId)) as Record<string, unknown>;
      case "credit-note":
        return (await documentTypeService.fetchDocumentById("credit-note", businessId, sourceId)) as Record<string, unknown>;
      case "debit-note":
        return (await documentTypeService.fetchDocumentById("debit-note", businessId, sourceId)) as Record<string, unknown>;
      case "payment-voucher":
        return (await documentTypeService.fetchDocumentById("payment-voucher", businessId, sourceId)) as Record<string, unknown>;
      case "receipt":
        return (await documentTypeService.fetchDocumentById("receipt", businessId, sourceId)) as Record<string, unknown>;
      case "purchase-order":
        return (await documentTypeService.fetchDocumentById("purchase-order", businessId, sourceId)) as Record<string, unknown>;
      default:
        throw new Error(`Unknown source document type: ${sourceType}`);
    }
  }

  private mapFields(
    sourceType: DocumentTypeKey,
    targetType: DocumentTypeKey,
    source: Record<string, unknown>,
    opts: ConversionOptions,
  ): Record<string, unknown> {
    const override = opts.overrideFields ?? {};
    const result: Record<string, unknown> = { ...override };

    const currency = (source.currency as string) ?? "USD";
    result.currency = currency;

    const sourceNotes = this.concatenateNotes(source);
    result.notes = sourceNotes
      ? `${sourceNotes}\n\nConverted from ${sourceType}`
      : `Converted from ${sourceType}`;

    if (opts.copyItems) {
      result.items = this.mapItems(source);
    }

    if (opts.copyCustomer) {
      result.customerId = source.customer_id ?? source.supplier_id ?? null;
    }

    const mappingKey = `${sourceType}->${targetType}`;

    switch (mappingKey) {
      case "invoice->purchase-order":
        Object.assign(result, this.mapInvoiceToPurchaseOrder(source, currency));
        break;
      case "quote->invoice":
        Object.assign(result, this.mapQuoteToInvoice(source, currency));
        break;
      case "quote->purchase-order":
        Object.assign(result, this.mapQuoteToPurchaseOrder(source, currency));
        break;
      case "quote->credit-note":
        Object.assign(result, this.mapQuoteToCreditNote(source, currency));
        break;
      case "quote->debit-note":
        Object.assign(result, this.mapQuoteToDebitNote(source, currency));
        break;
      case "invoice->credit-note":
        Object.assign(result, this.mapInvoiceToCreditNote(source, currency));
        break;
      case "invoice->debit-note":
        Object.assign(result, this.mapInvoiceToDebitNote(source, currency));
        break;
      case "credit-note->invoice":
        Object.assign(result, this.mapCreditNoteToInvoice(source, currency));
        break;
      case "debit-note->invoice":
        Object.assign(result, this.mapDebitNoteToInvoice(source, currency));
        break;
      case "purchase-order->invoice":
        Object.assign(result, this.mapPurchaseOrderToInvoice(source, currency));
        break;
      case "purchase-order->debit-note":
        Object.assign(result, this.mapPurchaseOrderToDebitNote(source, currency));
        break;
      case "payment-voucher->receipt":
        Object.assign(result, this.mapPaymentVoucherToReceipt(source, currency));
        break;
      default:
        result.items = this.mapItems(source);
    }

    return result;
  }

  private mapInvoiceToPurchaseOrder(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    return {
      currency,
      issueDate: source.issue_date ?? null,
      dueDate: source.due_date ?? null,
      supplierId: source.customer_id ?? null,
      supplierName: source.customer_name as string | null,
      supplierEmail: source.customer_email as string | null,
      supplierPhone: source.customer_phone as string | null,
      supplierAddressLine1: source.customer_address_line_1 as string | null,
      supplierAddressLine2: source.customer_address_line_2 as string | null,
      supplierCity: source.customer_city as string | null,
      supplierStateOrRegion: source.customer_state_or_region as string | null,
      supplierPostalCode: source.customer_postal_code as string | null,
      supplierCountryCode: source.customer_country_code as string | null,
      supplierTaxId: source.customer_tax_id as string | null,
      referenceNumber: source.po_number ?? source.invoice_number ?? null,
    };
  }

  private mapQuoteToInvoice(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    return {
      currency,
      customerId: source.customer_id ?? null,
      issueDate: source.issue_date ?? null,
      dueDate: source.expiry_date ?? source.due_date ?? null,
      poNumber: source.po_number ?? null,
      invoiceDiscount: source.quote_discount_value ?? null,
      invoiceDiscountType: source.quote_discount_type ?? "fixed",
    };
  }

  private mapQuoteToPurchaseOrder(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    return {
      currency,
      issueDate: source.issue_date ?? null,
      dueDate: source.expiry_date ?? source.due_date ?? null,
      deliveryDate: source.expiry_date ?? null,
      supplierId: source.customer_id ?? null,
      supplierName: source.customer_name as string | null,
      supplierEmail: source.customer_email as string | null,
      supplierPhone: source.customer_phone as string | null,
      supplierAddressLine1: source.customer_address_line_1 as string | null,
      supplierAddressLine2: source.customer_address_line_2 as string | null,
      supplierCity: source.customer_city as string | null,
      supplierStateOrRegion: source.customer_state_or_region as string | null,
      supplierPostalCode: source.customer_postal_code as string | null,
      supplierCountryCode: source.customer_country_code as string | null,
      supplierTaxId: source.customer_tax_id as string | null,
      referenceNumber: source.quote_number ?? null,
    };
  }

  private mapQuoteToCreditNote(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    return {
      currency,
      customerId: source.customer_id ?? null,
      issueDate: source.issue_date ?? null,
      dueDate: source.expiry_date ?? source.due_date ?? null,
      referenceInvoiceId: null,
      referenceInvoiceNumber: source.quote_number as string | null,
      reason: "Credit for quote",
    };
  }

  private mapQuoteToDebitNote(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    return {
      currency,
      customerId: source.customer_id ?? null,
      issueDate: source.issue_date ?? null,
      dueDate: source.expiry_date ?? source.due_date ?? null,
      reason: "Adjustment for quote",
    };
  }

  private mapInvoiceToCreditNote(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    const taxByRate = (source.tax_by_rate as Record<string, Record<string, unknown>> | undefined);
    let taxTotal = "0";
    if (taxByRate) {
      const rates = Object.values(taxByRate);
      if (rates.length > 0) {
        taxTotal = (rates[0].taxAmount as string) ?? "0";
      }
    }

    const lineItems = (source.items as Record<string, unknown>[] | undefined) ?? [];
    const creditItems: unknown[] = lineItems.map((item) => ({
      description: item.description,
      quantity: new Decimal(item.quantity as string).negated().toString(),
      unit: item.unit,
      unitPrice: item.unit_price,
      taxRate: item.tax_rate,
      taxName: item.tax_name,
      taxAmount: new Decimal(item.tax_amount as string).negated().toString(),
      lineSubtotal: new Decimal(item.line_subtotal as string).negated().toString(),
      lineTotal: new Decimal(item.line_total as string).negated().toString(),
    }));

    return {
      currency,
      customerId: source.customer_id ?? null,
      issueDate: source.issue_date ?? null,
      dueDate: source.due_date ?? null,
      referenceInvoiceId: source.id ?? null,
      referenceInvoiceNumber: source.invoice_number ?? null,
      reason: "Credit note issued",
      items: creditItems,
      taxTotal: new Decimal(taxTotal).negated().toString(),
      total: new Decimal(source.total as string).negated().toString(),
    };
  }

  private mapInvoiceToDebitNote(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    const lineItems = (source.items as Record<string, unknown>[] | undefined) ?? [];

    return {
      currency,
      customerId: source.customer_id ?? null,
      issueDate: source.issue_date ?? null,
      dueDate: source.due_date ?? null,
      referenceInvoiceId: source.id ?? null,
      referenceInvoiceNumber: source.invoice_number ?? null,
      reason: "Debit note issued",
      items: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unit_price,
        taxRate: item.tax_rate,
        taxName: item.tax_name,
        taxAmount: item.tax_amount,
        lineSubtotal: item.line_subtotal,
        lineTotal: item.line_total,
      })),
    };
  }

  private mapCreditNoteToInvoice(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    const lineItems = (source.items as Record<string, unknown>[] | undefined) ?? [];

    return {
      currency,
      customerId: source.customer_id ?? null,
      issueDate: source.issue_date ?? null,
      dueDate: source.due_date ?? null,
      referenceInvoiceId: source.reference_invoice_id ?? null,
      referenceInvoiceNumber: source.reference_invoice_number ?? null,
      items: lineItems.map((item) => ({
        description: item.description,
        quantity: new Decimal(item.quantity as string).abs().toString(),
        unit: item.unit,
        unitPrice: item.unit_price,
        taxRate: item.tax_rate,
        taxName: item.tax_name,
        taxAmount: new Decimal(item.tax_amount as string).abs().toString(),
        lineSubtotal: new Decimal(item.line_subtotal as string).abs().toString(),
        lineTotal: new Decimal(item.line_total as string).abs().toString(),
        isTaxInclusive: Boolean(item.is_tax_inclusive),
      })),
    };
  }

  private mapDebitNoteToInvoice(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    const lineItems = (source.items as Record<string, unknown>[] | undefined) ?? [];

    return {
      currency,
      customerId: source.customer_id ?? null,
      issueDate: source.issue_date ?? null,
      dueDate: source.due_date ?? null,
      notes: source.reason ? `${source.reason}\n\nConverted from debit note` : undefined,
      items: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unit_price,
        taxRate: item.tax_rate,
        taxName: item.tax_name,
        taxAmount: item.tax_amount,
        lineSubtotal: item.line_subtotal,
        lineTotal: item.line_total,
        isTaxInclusive: Boolean(item.is_tax_inclusive),
      })),
    };
  }

  private mapPurchaseOrderToInvoice(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    return {
      currency,
      customerId: source.supplier_id ?? null,
      issueDate: source.issue_date ?? null,
      dueDate: source.due_date ?? null,
      poNumber: source.purchase_order_number ?? null,
    };
  }

  private mapPurchaseOrderToDebitNote(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    return {
      currency,
      customerId: source.supplier_id ?? null,
      issueDate: source.issue_date ?? null,
      dueDate: source.due_date ?? null,
      reason: "Adjustment for purchase order",
    };
  }

  private mapPaymentVoucherToReceipt(
    source: Record<string, unknown>,
    currency: string,
  ): Record<string, unknown> {
    return {
      currency,
      amount: source.total ?? "0",
      paymentMethod: source.payment_method ?? null,
      paymentProvider: source.payment_provider ?? null,
      referenceNumber: source.payment_voucher_number ?? null,
      notes: source.notes ?? null,
    };
  }

  private mapItems(source: Record<string, unknown>): Record<string, unknown>[] {
    const items = (source.items as Record<string, unknown>[] | undefined) ?? [];
    return items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unit_price,
      taxRate: item.tax_rate ?? 0,
      taxName: item.tax_name ?? null,
      isTaxInclusive: Boolean(item.is_tax_inclusive),
    }));
  }

  private concatenateNotes(source: Record<string, unknown>): string | null {
    const parts: string[] = [];
    if (source.notes) parts.push(source.notes as string);
    if (source.terms) parts.push(source.terms as string);
    if (source.reason) parts.push(source.reason as string);
    return parts.length > 0 ? parts.join("\n\n") : null;
  }

  private buildAuditTrail(
    sourceType: DocumentTypeKey,
    targetType: DocumentTypeKey,
    source: Record<string, unknown>,
    target: Record<string, unknown>,
  ): ConversionAuditEntry[] {
    const entries: ConversionAuditEntry[] = [
      {
        timestamp: new Date().toISOString(),
        action: "convert",
        field: "documentType",
        sourceValue: sourceType,
        targetValue: targetType,
      },
    ];

    const fieldMappings: Array<[string, string]> = [
      ["currency", "currency"],
      ["customer_id", "customerId"],
      ["issue_date", "issueDate"],
      ["due_date", "dueDate"],
      ["notes", "notes"],
      ["terms", "terms"],
    ];

    for (const [sourceField, targetField] of fieldMappings) {
      const sourceValue = source[sourceField];
      const targetValue = target[targetField];
      if (sourceValue !== undefined || targetValue !== undefined) {
        entries.push({
          timestamp: new Date().toISOString(),
          action: "field_mapped",
          field: `${sourceField} -> ${targetField}`,
          sourceValue,
          targetValue,
        });
      }
    }

    return entries;
  }

  private async recordConversion(
    businessId: string,
    sourceType: DocumentTypeKey,
    sourceId: string,
    targetType: DocumentTypeKey,
    targetId: string,
    userId?: string,
  ): Promise<string> {
    const result = await query(
      `INSERT INTO document_conversions
       (business_id, source_document_type, source_document_id, target_document_type, target_document_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [
        businessId,
        sourceType,
        sourceId,
        targetType,
        targetId,
        userId ?? null,
      ],
    );

    const conversionId = result.rows[0].id;
    logger.info(
      `Document converted: ${sourceType}(${sourceId}) -> ${targetType}(${targetId}) [conversion:${conversionId}]`,
    );
    return conversionId;
  }
}
