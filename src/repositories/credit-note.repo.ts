import { createHash, randomUUID } from "node:crypto";
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
  referenceInvoiceNumber?: string | null;
}

export interface CreditNoteListItem {
  id: string;
  businessId: string;
  customerId: string | null;
  referenceInvoiceId: string | null;
  referenceInvoiceNumber: string | null;
  creditNoteNumber: string | null;
  status: string;
  issueDate: Date | null;
  currency: string;
  total: string;
  appliedTotal: string;
  amountDue: string;
  reason: string | null;
  notes: string | null;
  internalNotes: string | null;
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
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface CreditNoteEvent {
  id?: string;
  creditNoteId?: string;
  eventType: string;
  actorType?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreditNoteCreateInput {
  customerId?: string | null;
  referenceInvoiceId?: string | null;
  currency?: string;
  issueDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  items?: CreditNoteItemInput[];
  fees?: CreditNoteFeeInput[];
}

export class CreditNoteRepository {
  /**
   * Create a new draft credit note row, scoped to the business.
   * Returns the new credit note's UUID.
   */
  async create(businessId: string, input: CreditNoteCreateInput, userId?: string): Promise<string> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await query(
      `INSERT INTO credit_notes
         (id, business_id, customer_id, reference_invoice_id, currency, status,
          issue_date, reason, notes, internal_notes, terms, template_id, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
      [
        id, businessId, input.customerId ?? null, input.referenceInvoiceId ?? null,
        input.currency ?? "USD", input.issueDate ?? null, input.reason ?? null,
        input.notes ?? null, input.internalNotes ?? null, input.terms ?? null,
        input.templateId ?? null, userId ?? null, now,
      ]
    );
    return id;
  }

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

    let referenceInvoiceNumber: string | null = null;
    if (creditNote.referenceInvoiceId) {
      const refRes = await query(
        `SELECT invoice_number FROM invoices WHERE id = $1 AND business_id = $2`,
        [creditNote.referenceInvoiceId, businessId]
      );
      referenceInvoiceNumber = refRes.rows[0]?.invoice_number ?? null;
    }

    return {
      ...creditNote,
      items,
      fees,
      applications,
      customerName: r.customer_name ?? null,
      customerEmail: r.customer_email ?? null,
      referenceInvoiceNumber,
    };
  }

  /**
   * Update editable fields of a draft credit note (non-finalized).
   * Accepts partial fields and optional new items/fees.
   */
  async update(businessId: string, id: string, input: Partial<CreditNoteCreateInput>): Promise<void> {
    const fields: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (input.customerId !== undefined) { fields.push(`customer_id = $${i++}`); vals.push(input.customerId ?? null); }
    if (input.referenceInvoiceId !== undefined) { fields.push(`reference_invoice_id = $${i++}`); vals.push(input.referenceInvoiceId ?? null); }
    if (input.currency !== undefined) { fields.push(`currency = $${i++}`); vals.push(input.currency); }
    if (input.issueDate !== undefined) { fields.push(`issue_date = $${i++}`); vals.push(input.issueDate ?? null); }
    if (input.reason !== undefined) { fields.push(`reason = $${i++}`); vals.push(input.reason ?? null); }
    if (input.notes !== undefined) { fields.push(`notes = $${i++}`); vals.push(input.notes ?? null); }
    if (input.internalNotes !== undefined) { fields.push(`internal_notes = $${i++}`); vals.push(input.internalNotes ?? null); }
    if (input.terms !== undefined) { fields.push(`terms = $${i++}`); vals.push(input.terms ?? null); }
    if (input.templateId !== undefined) { fields.push(`template_id = $${i++}`); vals.push(input.templateId ?? null); }
    vals.push(id, businessId);
    if (fields.length) {
      await query(`UPDATE credit_notes SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i} AND business_id = $${i + 1}`, vals);
    }
    if (input.items !== undefined || input.fees !== undefined) {
      const client = await getClient();
      try {
        await client.query("BEGIN");
        if (input.items !== undefined) {
          await this.setItems(id, input.items, client);
        }
        if (input.fees !== undefined) {
          await this.setFees(id, input.fees, client);
        }
        await this.persistTotals(id, client);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } else {
      await this.persistTotals(id);
    }
  }

  /**
   * Retrieve a timeline of events for a credit note, derived from audit timestamps
   * and application records. No dedicated events table exists, so we synthesize
   * events from the row's history.
   */
  async getEvents(creditNoteId: string, businessId: string): Promise<CreditNoteEvent[]> {
    const creditNote = await this.findById(businessId, creditNoteId);
    const events: CreditNoteEvent[] = [];
    if (creditNote.createdAt) events.push({ eventType: "created", createdAt: creditNote.createdAt, actorType: "system" });
    if (creditNote.finalizedAt) events.push({ eventType: "finalized", createdAt: creditNote.finalizedAt, actorType: "system" });
    if (creditNote.cancelledAt) events.push({ eventType: "cancelled", createdAt: creditNote.cancelledAt, actorType: "system", metadata: { reason: creditNote.cancelledReason } });
    if (creditNote.voidedAt) events.push({ eventType: "voided", createdAt: creditNote.voidedAt, actorType: "system", metadata: { reason: creditNote.voidReason } });
    for (const app of creditNote.applications) {
      events.push({ eventType: "applied", createdAt: app.appliedAt, actorType: "system", metadata: { invoiceId: app.invoiceId, amount: app.amount } });
    }
    events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return events;
  }

  /**
   * Persist totals columns on the credit_notes row from items + fees.
   */
  async persistTotals(creditNoteId: string, client?: any): Promise<void> {
    const exec = client ? client.query.bind(client) : query;
    const res = await exec(
      `SELECT COALESCE(SUM(line_subtotal),0) AS subtotal,
              COALESCE(SUM(discount),0) AS discount_total,
              COALESCE(SUM(tax_amount),0) AS tax_total,
              COALESCE(SUM(line_total),0) AS total
       FROM credit_note_items WHERE credit_note_id = $1`,
      [creditNoteId]
    );
    const feesRes = await exec(
      `SELECT COALESCE(SUM(amount),0) AS fee_total FROM credit_note_fees WHERE credit_note_id = $1`,
      [creditNoteId]
    );
    const subtotal = new Decimal(res.rows[0]?.subtotal ?? 0);
    const discountTotal = new Decimal(res.rows[0]?.discount_total ?? 0);
    const taxTotal = new Decimal(res.rows[0]?.tax_amount ?? 0);
    const lineTotal = new Decimal(res.rows[0]?.total ?? 0);
    const feeTotal = new Decimal(feesRes.rows[0]?.fee_total ?? 0);
    const calcTotal = lineTotal.plus(feeTotal);
    await exec(
      `UPDATE credit_notes
       SET subtotal = $1, discount_total = $2, tax_total = $3, fee_total = $4,
           total = $5, updated_at = NOW()
       WHERE id = $6`,
      [subtotal.toFixed(6), discountTotal.toFixed(6), taxTotal.toFixed(6), feeTotal.toFixed(6), calcTotal.toFixed(6), creditNoteId]
    );
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
    if (opts.dateFrom) {
      conditions.push(`cn.issue_date >= $${i++}`);
      vals.push(opts.dateFrom);
    }
    if (opts.dateTo) {
      conditions.push(`cn.issue_date <= $${i++}`);
      vals.push(opts.dateTo);
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
              i.invoice_number AS reference_invoice_number,
              COUNT(*) OVER() AS total_count
        FROM credit_notes cn
        LEFT JOIN customers c ON c.id = cn.customer_id
        LEFT JOIN invoices i ON i.id = cn.reference_invoice_id AND i.business_id = cn.business_id
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
  async setItems(creditNoteId: string, items: CreditNoteItemInput[], client?: any): Promise<void> {
    const now = new Date().toISOString();
    if (!client) {
      const cl = await getClient();
      try {
        await cl.query("BEGIN");
        await this._setItems(creditNoteId, items, cl, now);
        await cl.query("COMMIT");
      } catch (e) {
        await cl.query("ROLLBACK");
        throw e;
      } finally {
        cl.release();
      }
    } else {
      await this._setItems(creditNoteId, items, client, now);
    }
  }

  private async _setItems(creditNoteId: string, items: CreditNoteItemInput[], client: any, now: string): Promise<void> {
    await client.query("DELETE FROM credit_note_items WHERE credit_note_id = $1", [creditNoteId]);

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = new Decimal(it.quantity);
      const unitPrice = new Decimal(it.unitPrice);
      const lineSubtotal = qty.mul(unitPrice);

      let discountAmount = new Decimal(0);
      if (it.discount && Number(it.discount) > 0) {
        if (it.discountType === "percentage") {
          discountAmount = lineSubtotal.mul(new Decimal(it.discount).div(100));
        } else {
          discountAmount = new Decimal(it.discount);
        }
      }

      const taxRate = new Decimal(it.taxRate ?? 0);
      const taxableAmount = it.isTaxInclusive
        ? lineSubtotal.minus(discountAmount)
        : lineSubtotal.minus(discountAmount);
      const taxAmount = it.isTaxInclusive
        ? lineSubtotal.mul(taxRate.div(taxRate.plus(1)))
        : taxableAmount.mul(taxRate);
      const lineTotal = it.isTaxInclusive
        ? lineSubtotal
        : taxableAmount.plus(taxAmount);

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
          it.id ?? randomUUID(), creditNoteId, it.productId, it.description,
          it.quantity, it.unit ?? "each", it.unitPrice,
          discountAmount.toFixed(6), it.discountType ?? "fixed",
          it.taxRate ?? 0, taxAmount.toFixed(6), lineSubtotal.toFixed(6), lineTotal.toFixed(6),
          it.sortOrder ?? i, it.isTaxInclusive ?? false,
          it.catalogName ?? null, it.catalogSku ?? null, it.catalogTaxCategory ?? null,
          it.catalogUnitPrice ?? null, it.catalogTaxRate ?? null, now,
        ]
      );
    }
  }

  /**
   * Persist fees for a credit note (replace all existing).
   */
  async setFees(creditNoteId: string, fees: CreditNoteFeeInput[], client?: any): Promise<void> {
    const now = new Date().toISOString();
    if (!client) {
      const cl = await getClient();
      try {
        await cl.query("BEGIN");
        await this._setFees(creditNoteId, fees, cl, now);
        await cl.query("COMMIT");
      } catch (e) {
        await cl.query("ROLLBACK");
        throw e;
      } finally {
        cl.release();
      }
    } else {
      await this._setFees(creditNoteId, fees, client, now);
    }
  }

  private async _setFees(creditNoteId: string, fees: CreditNoteFeeInput[], client: any, now: string): Promise<void> {
    await client.query("DELETE FROM credit_note_fees WHERE credit_note_id = $1", [creditNoteId]);

    for (let i = 0; i < fees.length; i++) {
      const f = fees[i];
      const taxRate = new Decimal(f.taxRate ?? 0);
      const amount = new Decimal(f.amount);
      const taxAmount = amount.mul(taxRate);
        await client.query(
          `INSERT INTO credit_note_fees (id, credit_note_id, description, amount, tax_rate, tax_amount, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [randomUUID(), creditNoteId, f.description, f.amount, f.taxRate ?? 0, taxAmount.toFixed(6), i, now]
        );
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
   * Void a credit note (mark as invalid through authorized workflow).
   */
  async void(creditNoteId: string, businessId: string, voidedAt: Date, reason: string): Promise<void> {
    const res = await query(
      `UPDATE credit_notes
       SET status = 'void', voided_at = $1, void_reason = $2, updated_at = NOW()
       WHERE id = $3 AND business_id = $4
       RETURNING id`,
      [voidedAt, reason, creditNoteId, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Credit note ${creditNoteId} not found`);
  }
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
      internalNotes: r.internal_notes as string | null,
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
       sentAt: rowToDate(r.sent_at),
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
      referenceInvoiceId: r.reference_invoice_id as string | null,
      referenceInvoiceNumber: r.reference_invoice_number as string | null,
      creditNoteNumber: r.credit_note_number as string | null,
      status: r.status as string,
      issueDate: rowToDate(r.issue_date),
      currency: r.currency as string,
      total: r.total as string,
      appliedTotal: r.applied_total as string,
      amountDue: r.amount_due as string,
      reason: r.reason as string | null,
      notes: r.notes as string | null,
      internalNotes: r.internal_notes as string | null,
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
