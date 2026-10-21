import { query, getClient } from "../db/pool.js";
import { NotFoundError } from "../domain/errors.js";
import { documentNumberingService } from "./numbering/document-numbering-service.js";
import { pdfService } from "./pdf/pdf-service.js";
import { templateRenderer, type DocumentTemplateData, type DocumentTypeKey } from "./templates/template-renderer.js";
import type { TemplateBusiness, TemplateCustomer } from "./templates/template-renderer.js";
import { fetchBusinessSnapshot, fetchCustomerSnapshot } from "./templates/template-renderer.js";

const TABLE_MAP: Record<DocumentTypeKey, string> = {
  invoice: "invoices",
  "credit-note": "credit_notes",
  quote: "quotes",
  "debit-note": "debit_notes",
  "payment-voucher": "payment_vouchers",
  receipt: "receipts",
  "purchase-order": "purchase_orders",
  "recurring-invoice": "recurring_invoices",
  "delivery-note": "delivery_notes",
  "packing-slip": "packing_slip",
  "pro-forma-invoice": "pro_forma_invoices",
  "estimate": "estimates",
};

const NUMBER_FIELD_MAP: Record<DocumentTypeKey, string> = {
  invoice: "invoice_number",
  "credit-note": "credit_note_number",
  quote: "quote_number",
  "debit-note": "debit_note_number",
  "payment-voucher": "payment_voucher_number",
  receipt: "receipt_number",
  "purchase-order": "purchase_order_number",
  "recurring-invoice": "recurring_invoice_number",
  "delivery-note": "delivery_note_number",
  "packing-slip": "packing_slip_number",
  "pro-forma-invoice": "pro_forma_invoice_number",
  "estimate": "estimate_number",
};

export interface GenericDocument {
  id: string;
  business_id: string;
  [key: string]: string | number | boolean | null | Date | undefined;
}

export interface GenericDocumentCreateInput {
  customerId?: string | null;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  items?: Array<{
    description: string;
    quantity?: string | number;
    unit?: string;
    unitPrice?: string | number;
    taxRate?: string | number;
    taxName?: string | null;
  }>;
  [key: string]: unknown;
}

export class GenericDocumentService {
  async findById(businessId: string, docId: string, docType: DocumentTypeKey): Promise<GenericDocument | null> {
    const table = TABLE_MAP[docType];
    if (!table) throw new Error(`Unsupported document type: ${docType}`);
    const res = await query(
      `SELECT * FROM ${table} WHERE id = $1 AND business_id = $2`,
      [docId, businessId]
    );
    if (!res.rows.length) return null;
    return res.rows[0] as GenericDocument;
  }

  async list(businessId: string, docType: DocumentTypeKey, opts?: { status?: string }): Promise<GenericDocument[]> {
    const table = TABLE_MAP[docType];
    if (!table) throw new Error(`Unsupported document type: ${docType}`);
    let sql = `SELECT * FROM ${table} WHERE business_id = $1`;
    const params: unknown[] = [businessId];
    if (opts?.status) {
      sql += ` AND status = $2`;
      params.push(opts.status);
    }
    sql += " ORDER BY created_at DESC";
    const res = await query(sql, params);
    return res.rows as GenericDocument[];
  }

  async create(
    businessId: string,
    docType: DocumentTypeKey,
    input: GenericDocumentCreateInput,
    userId?: string
  ): Promise<GenericDocument> {
    const table = TABLE_MAP[docType];
    if (!table) throw new Error(`Unsupported document type: ${docType}`);

    const client = await getClient();
    try {
      await client.query("BEGIN");

      const numberField = NUMBER_FIELD_MAP[docType];
      const docNumber = await documentNumberingService.generate(businessId, docType);

      const now = new Date().toISOString();

      const res = await client.query(
        `INSERT INTO ${table}
          (business_id, ${numberField}, customer_id, currency, notes, terms, payment_instructions, status, created_by, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $8, $9, $9)
         RETURNING *`,
        [
          businessId,
          docNumber,
          input.customerId ?? null,
          input.currency ?? "USD",
          input.notes ?? null,
          input.terms ?? null,
          input.paymentInstructions ?? null,
          userId ?? null,
          now,
        ]
      );

      const doc = res.rows[0] as GenericDocument;

      if (input.items && input.items.length > 0) {
        await this.saveItems(client, table, doc.id, input.items);
      }

      await client.query("COMMIT");
      return doc;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  private async saveItems(
    client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
    table: string,
    docId: string,
    items: Array<{ description: string; quantity?: unknown; unit?: string; unitPrice?: unknown; taxRate?: unknown; taxName?: string | null }>
  ): Promise<void> {
    const itemsTable = `${table.replace(/s$/, "_items")}`;
    for (const item of items) {
      await client.query(
        `INSERT INTO ${itemsTable} (document_id, description, quantity, unit, unit_price, tax_rate, tax_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          docId,
          item.description,
          item.quantity ?? 1,
          item.unit ?? "each",
          item.unitPrice ?? 0,
          item.taxRate ?? 0,
          item.taxName ?? null,
        ]
      );
    }
  }

  async update(businessId: string, docId: string, docType: DocumentTypeKey, input: Record<string, unknown>): Promise<GenericDocument> {
    const table = TABLE_MAP[docType];
    if (!table) throw new Error(`Unsupported document type: ${docType}`);

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (key === "id" || key === "business_id" || key === "created_at") continue;
      updates.push(`${key} = $${idx++}`);
      values.push(value);
    }

    if (updates.length === 0) return this.findById(businessId, docId, docType) as never;

    values.push(docId, businessId);
    const res = await query(
      `UPDATE ${table} SET ${updates.join(", ")} WHERE id = $${idx++} AND business_id = $${idx} RETURNING *`,
      values
    );
    if (!res.rows.length) throw new NotFoundError(`${docType} ${docId} not found`);
    return res.rows[0] as GenericDocument;
  }

  async delete(businessId: string, docId: string, docType: DocumentTypeKey): Promise<void> {
    const table = TABLE_MAP[docType];
    if (!table) throw new Error(`Unsupported document type: ${docType}`);
    await query(`DELETE FROM ${table} WHERE id = $1 AND business_id = $2`, [docId, businessId]);
  }

  async generatePdf(businessId: string, docId: string, docType: DocumentTypeKey): Promise<Buffer> {
    const doc = await this.findById(businessId, docId, docType);
    if (!doc) throw new NotFoundError(`${docType} ${docId} not found`);
    const business = await fetchBusinessSnapshot(businessId);
    const customer = doc.customer_id ? await fetchCustomerSnapshot(businessId, doc.customer_id as string) : undefined;
    const data = await this.buildTemplateData(docType, doc, business, customer);
    const html = await templateRenderer.renderUnified(docType, data);
    return pdfService.generatePdfFromHtml(html, data);
  }

  private async buildTemplateData(
    docType: DocumentTypeKey,
    doc: GenericDocument,
    business: TemplateBusiness | null,
    customer?: TemplateCustomer | null,
  ): Promise<DocumentTemplateData> {
    const common = {
      business: business ?? undefined,
      customer: customer ?? undefined,
    };
    const docData: Record<string, unknown> = { ...doc };
    const base = {
      ...common,
      lineItems: [],
      fees: [],
      totals: {},
      config: {},
    };
    switch (docType) {
      case "recurring-invoice":
        return { ...base, recurringInvoice: docData } as unknown as DocumentTemplateData;
      case "delivery-note":
        return { ...base, deliveryNote: docData } as unknown as DocumentTemplateData;
      case "packing-slip":
        return { ...base, supplier: customer ?? undefined, packingSlip: docData } as unknown as DocumentTemplateData;
      case "pro-forma-invoice":
        return { ...base, proFormaInvoice: docData } as unknown as DocumentTemplateData;
      case "estimate":
        return { ...base, estimate: docData } as unknown as DocumentTemplateData;
      default:
        return { ...base } as unknown as DocumentTemplateData;
    }
  }
}

export const genericDocumentService = new GenericDocumentService();
