import { createHash } from "node:crypto";
import { query, getClient } from "../db/pool.js";
import { Decimal } from "decimal.js";
import type { CreditNote, CreditNoteLineItem, CreditNoteApplication } from "../domain/models/index.js";
import { NotFoundError } from "../domain/errors.js";
import { rowToDate } from "./helpers.js";
import type { CurrencyCode } from "../domain/value-objects/currency.js";

export interface CreditNoteItemInput {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: string | number;
  unit?: string;
  unitPrice: string | number;
  discount?: string | number;
  discountType?: "fixed" | "percentage";
  taxRate?: string | number;
  isTaxInclusive?: boolean;
  sortOrder?: number;
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
}

export interface CreditNoteFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
}

export interface CreditNoteFeeRow {
  id: string;
  creditNoteId: string;
  description: string;
  amount: string;
  taxRate: string;
  taxAmount: string;
  sortOrder: number;
  createdAt: Date;
}

export interface CreditNoteWithDetails extends CreditNote {
  items: CreditNoteLineItem[];
  fees: CreditNoteFeeRow[];
  applications: CreditNoteApplication[];
  customerName?: string | null;
  customerEmail?: string | null;
}

export interface CreditNoteListItem {
  id: string;
  businessId: string;
  customerId: string | null;
  creditNoteNumber: string | null;
  status: string;
  issueDate: Date | null;
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  feeTotal: string;
  total: string;
  appliedTotal: string;
  amountDue: string;
  reason: string | null;
  notes: string | null;
  isFinalized: boolean;
  finalizedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customerName: string | null;
  customerEmail: string | null;
}

export interface CreditNoteListOptions {
  status?: string;
  customerId?: string;
  search?: string;
  currency?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export class CreditNoteRepository {
  /**
   * Fetch a single credit note with its line items, fees, and applications.
   * Tenant-isolated: scoped to businessId.
   */
  async findById(businessId: string, id: string): Promise<CreditNoteWithDetails> {
    const res = await query(
      `SELECT cn.*, c.name as customer_name, c.email as customer_email
       FROM credit_notes cn
       LEFT JOIN customers c ON c.id = cn.customer_id
       WHERE cn.id = $1 AND cn.business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Credit note ${id} not found`);
    const r = res.rows[0];
    const creditNote = this.rowToModel(r);

    const items = await this.findItems(id);
    const fees = await this.findFees(id);
    const applications = await this.findApplications(id, businessId);

    return {
      ...creditNote,
      items,
      fees,
      applications,
      customerName: r.customer_name ?? null,
      customerEmail: r.customer_email ?? null,
    };
  }

  /**
   * Paginated + filtered list of credit notes for a business.
   */
  async findManyPage(
    businessId: string,
    opts: CreditNoteListOptions = {}
  ): Promise<{ data: CreditNoteListItem[]; total: number; limit: number; offset: number }> {
    const conditions: string[] = ["cn.business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (opts.status) { conditions.push(`cn.status = $${i++}`); vals.push(opts.status); }
    if (opts.customerId) { conditions.push(`cn.customer_id = $${i++}`); vals.push(opts.customerId); }
    if (opts.currency) { conditions.push(`cn.currency = $${i++}`); vals.push(opts.currency.toUpperCase()); }
    if (opts.search) {
      const term = `%${opts.search}%`;
      conditions.push(`(cn.credit_note_number ILIKE $${i} OR c.name ILIKE $${i} OR c.email ILIKE $${i})`);
      vals.push(term, term, term);
      i++;
    }

    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);

    const sortMap: Record<string, string> = {
      credit_number: "cn.credit_note_number",
      customer_name: "c.name",
      total: "cn.total",
      applied_total: "cn.applied_total",
      amount_remaining: "cn.amount_due",
      issue_date: "cn.issue_date",
      created_at: "cn.created_at",
    };
    const sortColumn = sortMap[opts.sortBy ?? "created_at"] ?? "cn.created_at";
    const direction = opts.sortOrder === "asc" ? "ASC" : "DESC";

    const res = await query(
      `SELECT cn.*, c.name AS customer_name, c.email AS customer_email,
              COUNT(*) OVER() AS total_count
       FROM credit_notes cn
       LEFT JOIN customers c ON c.id = cn.customer_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${sortColumn} ${direction}, cn.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, offset]
    );

    const total = res.rows.length ? Number(res.rows[0]?.total_count ?? 0) : 0;
    return {
      data: res.rows.map((r) => this.listRowToModel(r)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Fetch all line items for a credit note.
   */
  async findItems(creditNoteId: string): Promise<CreditNoteLineItem[]> {
    const res = await query(
      `SELECT id, credit_note_id, product_id, description,
              quantity::text AS quantity, unit, unit_price::text AS unit_price,
              discount::text AS discount, discount_type, tax_rate::text AS tax_rate,
              tax_amount::text AS tax_amount, line_subtotal::text AS line_subtotal,
              line_total::text AS line_total, sort_order, is_tax_inclusive,
              catalog_name, catalog_sku, catalog_tax_category,
              catalog_unit_price::text AS catalog_unit_price,
              catalog_tax_rate::text AS catalog_tax_rate, created_at
       FROM credit_note_items
       WHERE credit_note_id = $1
       ORDER BY sort_order, created_at`,
      [creditNoteId]
    );
    return res.rows.map((r) => this.itemRowToModel(r));
  }

  /**
   * Fetch all fees for a credit note.
   */
  async findFees(creditNoteId: string): Promise<CreditNoteFeeRow[]> {
    const res = await query(
      `SELECT id, credit_note_id, description,
              amount::text AS amount, tax_rate::text AS tax_rate,
              tax_amount::text AS tax_amount, sort_order, created_at
       FROM credit_note_fees
       WHERE credit_note_id = $1
       ORDER BY sort_order, created_at`,
      [creditNoteId]
    );
    return res.rows.map((r) => this.feeRowToModel(r));
  }

  /**
   * Fetch all applications (which invoices this credit note was applied to).
   */
  async findApplications(creditNoteId: string, businessId: string): Promise<CreditNoteApplication[]> {
    const res = await query(
      `SELECT id, credit_note_id, invoice_id, business_id,
              amount::text AS amount, applied_at, idempotency_key, metadata
       FROM credit_note_applications
       WHERE credit_note_id = $1 AND business_id = $2
       ORDER BY applied_at DESC`,
      [creditNoteId, businessId]
    );
    return res.rows.map((r) => ({
      id: r.id as string,
      creditNoteId: r.credit_note_id as string,
      invoiceId: r.invoice_id as string,
      businessId: r.business_id as string,
      amount: r.amount as string,
      appliedAt: new Date(r.applied_at as string),
      idempotencyKey: r.idempotency_key as string,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    }));
  }

  /**
   * Find a single credit note item by id, scoped to the business.
   */
  async findItemById(businessId: string, creditNoteId: string, itemId: string): Promise<CreditNoteLineItem> {
    const res = await query(
      `SELECT ci.*, cn.business_id
       FROM credit_note_items ci
       JOIN credit_notes cn ON cn.id = ci.credit_note_id
       WHERE ci.id = $1 AND ci.credit_note_id = $2 AND cn.business_id = $3`,
      [itemId, creditNoteId, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Credit note item ${itemId} not found`);
    return this.itemRowToModel(res.rows[0]);
  }

  /**
   * Persist line items for a credit note (insert or replace).
   */
  async setItems(creditNoteId: string, items: CreditNoteItemInput[]): Promise<void> {
    const client = await getClient();
    const now = new Date().toISOString();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM credit_note_items WHERE credit_note_id = $1", [creditNoteId]);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO credit_note_items (
             id, credit_note_id, product_id, description, quantity, unit, unit_price,
             discount, discount_type, tax_rate, tax_amount, line_subtotal, line_total,
             sort_order, is_tax_inclusive,
             catalog_name, catalog_sku, catalog_tax_category,
             catalog_unit_price, catalog_tax_rate, created_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
             $14, $15, $16, $17, $18, $19, $20, $21
           )`,
          [
            it.id ?? crypto.randomUUID(), creditNoteId, it.productId, it.description,
            it.quantity, it.unit ?? "each", it.unitPrice,
            it.discount ?? 0, it.discountType ?? "fixed",
            it.taxRate ?? 0, 0, 0, 0,
            it.sortOrder ?? i, it.isTaxInclusive ?? false,
            it.catalogName ?? null, it.catalogSku ?? null, it.catalogTaxCategory ?? null,
            it.catalogUnitPrice ?? null, it.catalogTaxRate ?? null, now,
          ]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Persist fees for a credit note (replace all existing).
   */
  async setFees(creditNoteId: string, fees: CreditNoteFeeInput[]): Promise<void> {
    const client = await getClient();
    const now = new Date().toISOString();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM credit_note_fees WHERE credit_note_id = $1", [creditNoteId]);

      for (let i = 0; i < fees.length; i++) {
        const f = fees[i];
        const taxRate = new Decimal(f.taxRate ?? 0);
        const amount = new Decimal(f.amount);
        const taxAmount = amount.mul(taxRate);
        await client.query(
          `INSERT INTO credit_note_fees (id, credit_note_id, description, amount, tax_rate, tax_amount, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [crypto.randomUUID(), creditNoteId, f.description, f.amount, f.taxRate ?? 0, taxAmount.toFixed(6), i, now]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Persist totals columns on the credit_notes row.
   */
  async updateTotals(
    creditNoteId: string,
    totals: {
      subtotal: string | number;
      discountTotal: string | number;
      taxTotal: string | number;
      feeTotal: string | number;
      total: string | number;
      appliedTotal: string | number;
      amountDue: string | number;
    }
  ): Promise<void> {
    await query(
      `UPDATE credit_notes
       SET subtotal = $2, discount_total = $3, tax_total = $4, fee_total = $5,
           total = $6, applied_total = $7, amount_due = $8, updated_at = NOW()
       WHERE id = $1`,
      [
        creditNoteId, totals.subtotal, totals.discountTotal, totals.taxTotal,
        totals.feeTotal, totals.total, totals.appliedTotal, totals.amountDue,
      ]
    );
  }

  /**
   * Assign or regenerate the credit note number.
   */
  async assignNumber(creditNoteId: string, creditNoteNumber: string): Promise<void> {
    const res = await query(
      `UPDATE credit_notes SET credit_note_number = $1 WHERE id = $2 RETURNING id`,
      [creditNoteNumber, creditNoteId]
    );
    if (!res.rows.length) throw new NotFoundError(`Credit note ${creditNoteId} not found`);
  }

  /**
   * Mark the credit note as finalized in the DB.
   */
  async finalize(creditNoteId: string, businessId: string, finalizedAt: Date): Promise<void> {
    const res = await query(
      `UPDATE credit_notes
       SET is_finalized = TRUE, finalized_at = $1, updated_at = NOW()
       WHERE id = $2 AND business_id = $3
       RETURNING id`,
      [finalizedAt, creditNoteId, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Credit note ${creditNoteId} not found`);
  }

  /**
   * Persist a credit note application (applying credit to an invoice).
   */
  async recordApplication(
    creditNoteId: string,
    invoiceId: string,
    businessId: string,
    amount: string | number,
    idempotencyKey: string,
    metadata: Record<string, unknown> = {}
  ): Promise<CreditNoteApplication> {
    const res = await query(
      `INSERT INTO credit_note_applications
         (credit_note_id, invoice_id, business_id, amount, idempotency_key, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING id, credit_note_id, invoice_id, business_id, amount::text AS amount, applied_at, idempotency_key, metadata`,
      [creditNoteId, invoiceId, businessId, amount, idempotencyKey, JSON.stringify(metadata)]
    );
    if (res.rows.length) return this.applicationRowToModel(res.rows[0]);

    const existing = await query(
      `SELECT id, credit_note_id, invoice_id, business_id, amount::text AS amount, applied_at, idempotency_key, metadata
       FROM credit_note_applications
       WHERE business_id = $1 AND idempotency_key = $2`,
      [businessId, idempotencyKey]
    );
    if (existing.rows.length) return this.applicationRowToModel(existing.rows[0]);
    throw new Error("Failed to record credit note application");
  }

  /**
   * Update totals after an application is recorded.
   */
  async recordApplicationTotals(
    creditNoteId: string,
    appliedTotal: string | number,
    amountDue: string | number
  ): Promise<void> {
    await query(
      `UPDATE credit_notes
       SET applied_total = $2, amount_due = $3, updated_at = NOW()
       WHERE id = $1`,
      [creditNoteId, appliedTotal, amountDue]
    );
  }

  /**
   * Cancel a credit note (set status, cancelled_at, cancelled_reason).
   */
  async cancel(
    creditNoteId: string,
    businessId: string,
    cancelledAt: Date,
    reason: string
  ): Promise<void> {
    const res = await query(
      `UPDATE credit_notes
       SET status = 'cancelled', cancelled_at = $1, cancelled_reason = $2, updated_at = NOW()
       WHERE id = $3 AND business_id = $4
       RETURNING id`,
      [cancelledAt, reason, creditNoteId, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Credit note ${creditNoteId} not found`);
  }

  /**
   * Delete a credit note (only drafts can be deleted).
   */
  async delete(businessId: string, id: string): Promise<void> {
    const res = await query(
      `DELETE FROM credit_notes WHERE id = $1 AND business_id = $2 AND status = 'draft' RETURNING id`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Credit note ${id} not found or cannot be deleted`);
  }

  /**
   * Compute a SHA-256 hash of the credit note's current state for PDF cache invalidation.
   */
  computePdfCacheHash(cn: CreditNoteWithDetails): string {
    const parts = [
      cn.id,
      cn.version,
      cn.creditNoteNumber,
      cn.status,
      cn.issueDate instanceof Date ? cn.issueDate.toISOString() : cn.issueDate,
      cn.currency,
      cn.reason,
      cn.notes,
      cn.terms,
      cn.subtotal,
      cn.discountTotal,
      cn.taxTotal,
      cn.feeTotal,
      cn.total,
      cn.appliedTotal,
      cn.amountDue,
      JSON.stringify(cn.items),
      JSON.stringify(cn.fees),
      JSON.stringify(cn.applications),
    ];
    return createHash("sha256").update(parts.join("|")).digest("hex");
  }

  private rowToModel(r: Record<string, unknown>): CreditNote {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      customerId: r.customer_id as string,
      referenceInvoiceId: r.reference_invoice_id as string | null,
      creditNoteNumber: r.credit_note_number as string | null,
      status: (r.status as CreditNote["status"]) ?? "draft",
      issueDate: rowToDate(r.issue_date),
      currency: (r.currency as CurrencyCode) ?? "USD",
      reason: r.reason as string | null,
      notes: r.notes as string | null,
      terms: r.terms as string | null,
      templateId: r.template_id as string | null,
      subtotal: r.subtotal as string,
      discountTotal: r.discount_total as string,
      taxTotal: r.tax_total as string,
      feeTotal: r.fee_total as string,
      total: r.total as string,
      appliedTotal: r.applied_total as string,
      amountDue: r.amount_due as string,
      isFinalized: Boolean(r.is_finalized),
      finalizedAt: rowToDate(r.finalized_at),
      cancelledAt: rowToDate(r.cancelled_at),
      cancelledReason: r.cancelled_reason as string | null,
      voidedAt: rowToDate(r.voided_at),
      voidReason: r.void_reason as string | null,
      publicToken: r.public_token as string | null,
      version: Number(r.version ?? 1),
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
      createdBy: r.created_by as string | null,
      updatedBy: r.updated_by as string | null,
    };
  }

  private listRowToModel(r: Record<string, unknown>): CreditNoteListItem {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      customerId: r.customer_id as string | null,
      creditNoteNumber: r.credit_note_number as string | null,
      status: r.status as string,
      issueDate: rowToDate(r.issue_date),
      currency: r.currency as string,
      subtotal: r.subtotal as string,
      discountTotal: r.discount_total as string,
      taxTotal: r.tax_total as string,
      feeTotal: r.fee_total as string,
      total: r.total as string,
      appliedTotal: r.applied_total as string,
      amountDue: r.amount_due as string,
      reason: r.reason as string | null,
      notes: r.notes as string | null,
      isFinalized: Boolean(r.is_finalized),
      finalizedAt: rowToDate(r.finalized_at),
      cancelledAt: rowToDate(r.cancelled_at),
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
      customerName: r.customer_name as string | null,
      customerEmail: r.customer_email as string | null,
    };
  }

  private itemRowToModel(r: Record<string, unknown>): CreditNoteLineItem {
    return {
      id: r.id as string,
      creditNoteId: r.credit_note_id as string,
      productId: r.product_id as string | null,
      description: r.description as string,
      quantity: r.quantity as string,
      unit: r.unit as string,
      unitPrice: r.unit_price as string,
      discount: r.discount as string,
      discountType: (r.discount_type as string) as "fixed" | "percentage",
      taxRate: r.tax_rate as string,
      taxAmount: r.tax_amount as string,
      lineSubtotal: r.line_subtotal as string,
      lineTotal: r.line_total as string,
      sortOrder: Number(r.sort_order),
      isTaxInclusive: Boolean(r.is_tax_inclusive),
      catalogName: r.catalog_name as string | null,
      catalogSku: r.catalog_sku as string | null,
      catalogTaxCategory: r.catalog_tax_category as string | null,
      catalogUnitPrice: r.catalog_unit_price as string | null,
      catalogTaxRate: r.catalog_tax_rate as string | null,
    };
  }

  private feeRowToModel(r: Record<string, unknown>): CreditNoteFeeRow {
    return {
      id: r.id as string,
      creditNoteId: r.credit_note_id as string,
      description: r.description as string,
      amount: r.amount as string,
      taxRate: r.tax_rate as string,
      taxAmount: r.tax_amount as string,
      sortOrder: Number(r.sort_order),
      createdAt: new Date(r.created_at as string),
    };
  }

  private applicationRowToModel(r: Record<string, unknown>): CreditNoteApplication {
    return {
      id: r.id as string,
      creditNoteId: r.credit_note_id as string,
      invoiceId: r.invoice_id as string,
      businessId: r.business_id as string,
      amount: r.amount as string,
      appliedAt: new Date(r.applied_at as string),
      idempotencyKey: r.idempotency_key as string,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    };
  }
}

export const creditNoteRepository = new CreditNoteRepository();
