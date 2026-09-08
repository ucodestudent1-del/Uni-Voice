import { Decimal } from "decimal.js";
import { getClient, query } from "../db/pool.js";
import type { Invoice, InvoiceLineItem, InvoiceFee, InvoiceSnapshot, InvoiceEvent } from "../domain/models/index.js";
import { NotFoundError } from "../domain/errors.js";
import { toDecimal, rowToDate } from "./helpers.js";

export interface InvoiceItemInput {
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
}

export interface InvoiceFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  sortOrder?: number;
}

export interface CreateInvoiceInput {
  customerId?: string | null;
  currency: string;
  issueDate?: Date | null;
  dueDate?: Date | null;
  notes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  paymentInstructions?: string | null;
  items?: InvoiceItemInput[];
  fees?: InvoiceFeeInput[];
  createdBy?: string;
}

export interface InvoiceTotals {
  subtotal: string | number;
  discountTotal: string | number;
  taxTotal: string | number;
  feeTotal: string | number;
  total: string | number;
  amountPaid: string | number;
  amountDue: string | number;
}

export interface InvoiceWithDetails extends Invoice {
  items: InvoiceLineItem[];
  fees: InvoiceFee[];
}

export class InvoiceRepository {
  async createDraft(businessId: string, input: CreateInvoiceInput): Promise<string> {
    const client = await getClient();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO invoices (id, business_id, customer_id, currency, issue_date, due_date, notes, terms,
          template_id, payment_instructions, created_at, updated_at, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$12)`,
        [
          id, businessId, input.customerId, input.currency,
          input.issueDate?.toISOString(), input.dueDate?.toISOString(),
          input.notes, input.terms, input.templateId, input.paymentInstructions, now, input.createdBy,
        ]
      );
      await this.insertItems(client, id, input.items, now);
      await this.insertFees(client, id, input.fees, now);
      await client.query("COMMIT");
      return id;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  private async insertItems(client: any, invoiceId: string, items: InvoiceItemInput[] | undefined, now: string): Promise<void> {
    for (let i = 0; i < (items?.length ?? 0); i++) {
      const it = items![i];
      await client.query(
        `INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit, unit_price,
          discount, discount_type, tax_rate, tax_amount, line_subtotal, line_total, sort_order, is_tax_inclusive, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          crypto.randomUUID(), invoiceId, it.productId, it.description, it.quantity,
          it.unit ?? "each", it.unitPrice, it.discount ?? 0, it.discountType ?? "fixed",
          it.taxRate ?? 0, 0, 0, 0, it.sortOrder ?? i, it.isTaxInclusive ?? false, now,
        ]
      );
    }
  }

  private async insertFees(client: any, invoiceId: string, fees: InvoiceFeeInput[] | undefined, now: string): Promise<void> {
    for (let i = 0; i < (fees?.length ?? 0); i++) {
      const f = fees![i];
      await client.query(
        `INSERT INTO invoice_fees (id, invoice_id, description, amount, tax_rate, tax_amount, sort_order, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [crypto.randomUUID(), invoiceId, f.description, f.amount, f.taxRate ?? 0, 0, f.sortOrder ?? i, now]
      );
    }
  }

  async setItems(businessId: string, invoiceId: string, items: InvoiceItemInput[]): Promise<void> {
    const client = await getClient();
    const now = new Date().toISOString();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM invoice_items WHERE invoice_id = $1", [invoiceId]);
      await this.insertItems(client, invoiceId, items, now);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async setFees(businessId: string, invoiceId: string, fees: InvoiceFeeInput[]): Promise<void> {
    const client = await getClient();
    const now = new Date().toISOString();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM invoice_fees WHERE invoice_id = $1", [invoiceId]);
      await this.insertFees(client, invoiceId, fees, now);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async update(businessId: string, id: string, input: Partial<Record<string, unknown>>): Promise<Invoice> {
    const set: string[] = [];
    const vals: unknown[] = [businessId, id];
    let i = 3;
    for (const [key, val] of Object.entries(input)) {
      set.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }
    set.push(`updated_at = NOW()`);
    const res = await query(
      `UPDATE invoices SET ${set.join(", ")} WHERE id = $2 AND business_id = $1 RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new NotFoundError(`Invoice ${id} not found`);
    return this.rowToModel(res.rows[0]);
  }

  async updateTotals(invoiceId: string, totals: InvoiceTotals): Promise<void> {
    await query(
      `UPDATE invoices SET subtotal = $2, discount_total = $3, tax_total = $4, fee_total = $5,
       total = $6, amount_paid = $7, amount_due = $8, updated_at = NOW()
       WHERE id = $1`,
      [invoiceId, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.feeTotal, totals.total, totals.amountPaid, totals.amountDue]
    );
  }

  async findById(businessId: string, id: string): Promise<InvoiceWithDetails> {
    const invRes = await query(`SELECT * FROM invoices WHERE id = $1 AND business_id = $2`, [id, businessId]);
    if (!invRes.rows.length) throw new NotFoundError(`Invoice ${id} not found`);
    const invoice = this.rowToModel(invRes.rows[0]);
    const itemRes = await query(`SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order`, [id]);
    const feeRes = await query(`SELECT * FROM invoice_fees WHERE invoice_id = $1 ORDER BY sort_order`, [id]);
    return { ...invoice, items: itemRes.rows.map((r) => this.itemRowToModel(r)), fees: feeRes.rows.map((r) => this.feeRowToModel(r)) };
  }

  async findMany(businessId: string, opts: { status?: string; customerId?: string; limit?: number; offset?: number } = {}): Promise<Invoice[]> {
    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;
    if (opts.status) { conditions.push(`status = $${i++}`); vals.push(opts.status); }
    if (opts.customerId) { conditions.push(`customer_id = $${i++}`); vals.push(opts.customerId); }
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const res = await query(
      `SELECT * FROM invoices WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, offset]
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async findByPublicToken(token: string): Promise<InvoiceWithDetails> {
    const invRes = await query(`SELECT * FROM invoices WHERE public_token = $1`, [token]);
    if (!invRes.rows.length) throw new NotFoundError("Invoice not found");
    const invoice = this.rowToModel(invRes.rows[0]);
    const itemRes = await query(`SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order`, [invoice.id]);
    const feeRes = await query(`SELECT * FROM invoice_fees WHERE invoice_id = $1 ORDER BY sort_order`, [invoice.id]);
    return { ...invoice, items: itemRes.rows.map((r) => this.itemRowToModel(r)), fees: feeRes.rows.map((r) => this.feeRowToModel(r)) };
  }

  async assignNumber(businessId: string, invoiceId: string, invoiceNumber: string): Promise<void> {
    const res = await query(
      `UPDATE invoices SET invoice_number = $1 WHERE id = $2 AND business_id = $3 RETURNING id`,
      [invoiceNumber, invoiceId, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Invoice ${invoiceId} not found`);
  }

  async finalize(businessId: string, invoiceId: string, opts: { finalizedAt: Date }): Promise<void> {
    const res = await query(
      `UPDATE invoices SET is_finalized = TRUE, finalized_at = $1, updated_at = NOW()
       WHERE id = $2 AND business_id = $3 RETURNING id`,
      [opts.finalizedAt.toISOString(), invoiceId, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Invoice ${invoiceId} not found`);
  }

  async setStatus(invoiceId: string, status: string, fields?: Record<string, unknown>): Promise<void> {
    const set: string[] = [`status = $2`];
    const vals: unknown[] = [invoiceId, status];
    let i = 3;
    const colMap: Record<string, string> = {
      sentAt: "sent_at", viewedAt: "viewed_at", paidAt: "paid_at", cancelledAt: "cancelled_at",
    };
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        set.push(`${colMap[k] ?? k} = $${i++}`);
        vals.push(v);
      }
    }
    set.push(`updated_at = NOW()`);
    await query(`UPDATE invoices SET ${set.join(", ")} WHERE id = $1`, vals);
  }

  async recordEvent(invoiceId: string, event: { eventType: string; actorId?: string; actorType?: string; metadata?: Record<string, unknown>; createdAt?: Date }): Promise<InvoiceEvent> {
    const res = await query(
      `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [invoiceId, event.eventType, event.actorId, event.actorType, event.metadata ?? {}, event.createdAt?.toISOString() ?? new Date().toISOString()]
    );
    return this.eventRowToModel(res.rows[0]);
  }

  async setPublicToken(invoiceId: string, token: string, expiresAt?: Date | null): Promise<void> {
    await query(`UPDATE invoices SET public_token = $1, public_token_expires_at = $2 WHERE id = $3`, [token, expiresAt?.toISOString() ?? null, invoiceId]);
  }

  async recordPayment(invoiceId: string, amountPaid: string | number, amountDue: string | number): Promise<void> {
    await query(`UPDATE invoices SET amount_paid = $1, amount_due = $2, updated_at = NOW() WHERE id = $3`, [amountPaid, amountDue, invoiceId]);
  }

  async getEvents(invoiceId: string, businessId: string, limit = 100): Promise<InvoiceEvent[]> {
    const res = await query(
      `SELECT e.* FROM invoice_events e JOIN invoices i ON i.id = e.invoice_id
       WHERE e.invoice_id = $1 AND i.business_id = $2 ORDER BY e.created_at DESC LIMIT $3`,
      [invoiceId, businessId, limit]
    );
    return res.rows.map((r) => this.eventRowToModel(r));
  }

  async createSnapshot(invoiceId: string, snapshot: Record<string, unknown>, hash: string, opts?: { pdfStored?: boolean; pdfHash?: string; createdBy?: string }): Promise<InvoiceSnapshot> {
    const res = await query(
      `INSERT INTO invoice_snapshots (invoice_id, snapshot, snapshot_hash, pdf_stored, pdf_hash, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING *`,
      [invoiceId, JSON.stringify(snapshot), hash, opts?.pdfStored ?? false, opts?.pdfHash ?? null, opts?.createdBy ?? null]
    );
    const r = res.rows[0];
    return {
      id: r.id as string, invoiceId: r.invoice_id as string, snapshot: r.snapshot as Record<string, unknown>,
      snapshotHash: r.snapshot_hash as string, pdfStored: Boolean(r.pdf_stored), pdfHash: r.pdf_hash as string | null,
      createdAt: new Date(r.created_at as string), createdBy: r.created_by as string | null,
    };
  }

  async getSnapshot(invoiceId: string): Promise<Record<string, unknown> | null> {
    const res = await query(
      `SELECT snapshot, snapshot_hash, created_at, pdf_stored, pdf_hash FROM invoice_snapshots WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [invoiceId]
    );
    if (!res.rows.length) return null;
    return res.rows[0].snapshot as Record<string, unknown>;
  }

  async getSnapshotHash(invoiceId: string): Promise<string | null> {
    const res = await query(`SELECT snapshot_hash FROM invoice_snapshots WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1`, [invoiceId]);
    return res.rows.length ? (res.rows[0].snapshot_hash as string) : null;
  }

  async updateLineItemComputed(invoiceId: string, itemId: string, fields: {
    taxAmount: Decimal.Value;
    lineSubtotal: Decimal.Value;
    lineTotal: Decimal.Value;
  }): Promise<void> {
    await query(
      `UPDATE invoice_items SET tax_amount = $1, line_subtotal = $2, line_total = $3
       WHERE id = $4 AND invoice_id = $5`,
      [fields.taxAmount, fields.lineSubtotal, fields.lineTotal, itemId, invoiceId]
    );
  }

  private rowToModel(r: Record<string, unknown>): Invoice {
    return {
      id: r.id as string, businessId: r.business_id as string, customerId: r.customer_id as string | null,
      invoiceNumber: r.invoice_number as string | null, status: r.status as Invoice["status"],
      issueDate: rowToDate(r.issue_date), dueDate: rowToDate(r.due_date),
      currency: r.currency as Invoice["currency"], exchangeRate: r.exchange_rate as string | null,
      subtotal: r.subtotal as string, discountTotal: r.discount_total as string, taxTotal: r.tax_total as string,
      feeTotal: r.fee_total as string, total: r.total as string, amountPaid: r.amount_paid as string,
      amountDue: r.amount_due as string, notes: r.notes as string | null, terms: r.terms as string | null,
      templateId: r.template_id as string | null, publicToken: r.public_token as string | null,
      publicTokenExpiresAt: rowToDate(r.public_token_expires_at), paymentInstructions: r.payment_instructions as string | null,
      isFinalized: Boolean(r.is_finalized), finalizedAt: rowToDate(r.finalized_at),
      sentAt: rowToDate(r.sent_at), viewedAt: rowToDate(r.viewed_at), paidAt: rowToDate(r.paid_at),
      cancelledAt: rowToDate(r.cancelled_at), cancelledReason: r.cancelled_reason as string | null,
      createdAt: rowToDate(r.created_at)!, updatedAt: rowToDate(r.updated_at)!,
      createdBy: r.created_by as string | null, updatedBy: r.updated_by as string | null,
    };
  }

  private itemRowToModel(r: Record<string, unknown>): InvoiceLineItem {
    return {
      id: r.id as string, invoiceId: r.invoice_id as string, productId: r.product_id as string | null,
      description: r.description as string, quantity: r.quantity as string, unit: r.unit as string,
      unitPrice: r.unit_price as string, discount: r.discount as string,
      discountType: r.discount_type as "fixed" | "percentage", taxRate: r.tax_rate as string,
      taxAmount: r.tax_amount as string, lineSubtotal: r.line_subtotal as string, lineTotal: r.line_total as string,
      sortOrder: Number(r.sort_order), isTaxInclusive: Boolean(r.is_tax_inclusive),
    };
  }

  private feeRowToModel(r: Record<string, unknown>): InvoiceFee {
    return {
      id: r.id as string, invoiceId: r.invoice_id as string, description: r.description as string,
      amount: r.amount as string, taxRate: r.tax_rate as string, taxAmount: r.tax_amount as string,
      sortOrder: Number(r.sort_order),
    };
  }

  private eventRowToModel(r: Record<string, unknown>): InvoiceEvent {
    return {
      id: r.id as string, invoiceId: r.invoice_id as string, eventType: r.event_type as string,
      actorId: r.actor_id as string | null, actorType: r.actor_type as string | null,
      metadata: (r.metadata as Record<string, unknown>) ?? {}, createdAt: new Date(r.created_at as string),
    };
  }
}

export const invoiceRepository = new InvoiceRepository();
