import { Decimal } from "decimal.js";
import { getClient, query } from "../db/pool.js";
import type { Invoice, InvoiceLineItem, InvoiceFee, InvoiceSnapshot, InvoiceEvent } from "../domain/models/index.js";
import { NotFoundError, ConflictError } from "../domain/errors.js";
import { rowToDate, type PagedResult, asSqlDate } from "./helpers.js";

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
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
}

export interface InvoiceFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  sortOrder?: number;
}

export interface CreateInvoiceInput {
  customerId?: string | null;
  projectId?: string | null;
  currency: string;
  issueDate?: Date | null;
  dueDate?: Date | null;
  notes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  paymentInstructions?: string | null;
  depositAmount?: string | number;
  depositType?: "none" | "fixed" | "percentage";
  depositDueDate?: Date | string | null;
  depositPaymentPurpose?: string | null;
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

export interface InvoiceListOptions {
  status?: string;
  customerId?: string;
  projectId?: string;
  invoiceNumber?: string;
  currency?: string;
  minAmount?: string | number;
  maxAmount?: string | number;
  issueDateFrom?: string;
  issueDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  paymentState?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export type InvoiceListItem = Invoice & {
  customer_name: string | null;
  customer_email: string | null;
};

const INVOICE_SORT_COLUMNS: Record<string, string> = {
  id: "i.id",
  invoice_number: "i.invoice_number",
  customer_name: "c.name",
  customer_email: "c.email",
  status: "i.status",
  total: "i.total",
  amount_due: "i.amount_due",
  amount_paid: "i.amount_paid",
  issue_date: "i.issue_date",
  due_date: "i.due_date",
  created_at: "i.created_at",
  updated_at: "i.updated_at",
  finalized_at: "i.finalized_at",
  sent_at: "i.sent_at",
  paid_at: "i.paid_at",
};

const INVOICE_ALLOWED_COLUMNS = new Set([
  "customer_id", "project_id", "invoice_number", "status", "issue_date", "due_date", "currency",
  "exchange_rate", "subtotal", "discount_total", "tax_total", "fee_total", "total",
  "amount_paid", "amount_due", "credit_applied", "deposit_amount", "deposit_type",
  "deposit_due_date", "deposit_payment_purpose", "notes", "terms", "template_id", "public_token",
  "public_token_expires_at", "payment_instructions", "is_finalized", "finalized_at",
  "sent_at", "viewed_at", "paid_at", "cancelled_at", "cancelled_reason", "created_by", "updated_by",
]);

export class InvoiceRepository {
  async createDraft(businessId: string, input: CreateInvoiceInput): Promise<string> {
    const client = await getClient();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO invoices (id, business_id, customer_id, project_id, currency, issue_date, due_date, notes, terms,
          template_id, payment_instructions, deposit_amount, deposit_type, deposit_due_date, deposit_payment_purpose,
          created_at, updated_at, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,$17,$17)`,
        [
          id, businessId, input.customerId, input.projectId, input.currency,
          input.issueDate instanceof Date ? input.issueDate.toISOString() : input.issueDate,
          input.dueDate instanceof Date ? input.dueDate.toISOString() : input.dueDate,
          input.notes, input.terms, input.templateId, input.paymentInstructions,
          input.depositAmount ?? 0, input.depositType ?? "none",
          input.depositDueDate instanceof Date ? input.depositDueDate.toISOString() : input.depositDueDate,
          input.depositPaymentPurpose, now, input.createdBy,
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
    if (!items || items.length === 0) return;
    const values: unknown[] = [];
    const rows: string[] = [];
    let paramIdx = 1;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const placeholders = Array.from({ length: 21 }, (_, j) => `$${paramIdx + j}`);
      rows.push(`(${placeholders.join(", ")})`);
      values.push(
        crypto.randomUUID(), invoiceId, it.productId, it.description, it.quantity,
        it.unit ?? "each", it.unitPrice, it.discount ?? 0, it.discountType ?? "fixed",
        it.taxRate ?? 0, 0, 0, 0, it.sortOrder ?? i, it.isTaxInclusive ?? false,
        it.catalogName ?? null, it.catalogSku ?? null, it.catalogTaxCategory ?? null,
        it.catalogUnitPrice ?? null, it.catalogTaxRate ?? null, now,
      );
      paramIdx += 21;
    }
    await client.query(
      `INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit, unit_price,
        discount, discount_type, tax_rate, tax_amount, line_subtotal, line_total, sort_order, is_tax_inclusive,
        catalog_name, catalog_sku, catalog_tax_category, catalog_unit_price, catalog_tax_rate, created_at)
       VALUES ${rows.join(", ")}`,
      values
    );
  }

  private async insertFees(client: any, invoiceId: string, fees: InvoiceFeeInput[] | undefined, now: string): Promise<void> {
    if (!fees || fees.length === 0) return;
    const values: unknown[] = [];
    const rows: string[] = [];
    let paramIdx = 1;
    for (let i = 0; i < fees.length; i++) {
      const f = fees[i];
      const placeholders = Array.from({ length: 8 }, (_, j) => `$${paramIdx + j}`);
      rows.push(`(${placeholders.join(", ")})`);
      values.push(crypto.randomUUID(), invoiceId, f.description, f.amount, f.taxRate ?? 0, 0, f.sortOrder ?? i, now);
      paramIdx += 8;
    }
    await client.query(
      `INSERT INTO invoice_fees (id, invoice_id, description, amount, tax_rate, tax_amount, sort_order, created_at)
       VALUES ${rows.join(", ")}`,
      values
    );
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
      if (!INVOICE_ALLOWED_COLUMNS.has(key)) continue;
      set.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }
    if (set.length === 0) {
      const current = await this.findById(businessId, id);
      return current;
    }
    set.push(`version = version + 1`);
    set.push(`updated_at = NOW()`);
    const res = await query(
      `UPDATE invoices SET ${set.join(", ")} WHERE id = $2 AND business_id = $1 RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new NotFoundError(`Invoice ${id} not found`);
    return this.rowToModel(res.rows[0]);
  }

  async updateOptimistic(businessId: string, id: string, input: Partial<Record<string, unknown>>, expectedVersion: number): Promise<Invoice> {
    const set: string[] = [];
    const vals: unknown[] = [businessId, id, expectedVersion];
    let i = 4;
    for (const [key, val] of Object.entries(input)) {
      if (!INVOICE_ALLOWED_COLUMNS.has(key)) continue;
      set.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }
    if (set.length === 0) {
      const current = await this.findById(businessId, id);
      return current;
    }
    set.push(`version = version + 1`);
    set.push(`updated_at = NOW()`);
    const res = await query(
      `UPDATE invoices SET ${set.join(", ")} WHERE id = $2 AND business_id = $1 AND version = $3 RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new ConflictError(`Invoice ${id} not found or stale version (expected ${expectedVersion})`);
    return this.rowToModel(res.rows[0]);
  }

  async updateTotals(invoiceId: string, totals: InvoiceTotals, client?: any): Promise<void> {
    const exec = client ? client.query.bind(client) : query;
    await exec(
      `UPDATE invoices SET subtotal = $2, discount_total = $3, tax_total = $4, fee_total = $5,
       total = $6, amount_paid = $7, amount_due = $8, updated_at = NOW()
       WHERE id = $1`,
      [invoiceId, totals.subtotal, totals.discountTotal, totals.taxTotal, totals.feeTotal, totals.total, totals.amountPaid, totals.amountDue]
    );
  }

  async findById(businessId: string, id: string): Promise<InvoiceWithDetails> {
    // Use a single query with JSON subqueries instead of 3 separate round-trips.
    // Numeric columns are cast to ::text so row_to_json preserves the PostgreSQL
    // decimal representation (trailing zeros) instead of coercing to JSON numbers.
    const res = await query(
      `SELECT i.*,
              COALESCE((SELECT json_agg(row_to_json(items)) FROM (
                SELECT id, invoice_id, product_id, description,
                       quantity::text AS quantity, unit, unit_price::text AS unit_price,
                       discount::text AS discount, discount_type, tax_rate::text AS tax_rate,
                       tax_amount::text AS tax_amount, line_subtotal::text AS line_subtotal,
                       line_total::text AS line_total, sort_order, is_tax_inclusive, created_at,
                       catalog_name, catalog_sku, catalog_tax_category,
                       catalog_unit_price::text AS catalog_unit_price, catalog_tax_rate::text AS catalog_tax_rate
                  FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order
              ) items), '[]'::json) AS items_json,
              COALESCE((SELECT json_agg(row_to_json(fees)) FROM (
                SELECT id, invoice_id, description,
                       amount::text AS amount, tax_rate::text AS tax_rate,
                       tax_amount::text AS tax_amount, sort_order, created_at
                  FROM invoice_fees WHERE invoice_id = $1 ORDER BY sort_order
              ) fees), '[]'::json) AS fees_json
       FROM invoices i
       WHERE i.id = $1 AND i.business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Invoice ${id} not found`);
    const r = res.rows[0];
    const invoice = this.rowToModel(r);

    // The pg driver parses JSON columns to objects; handle string fallback too.
    const itemsJson: unknown[] = Array.isArray(r.items_json)
      ? r.items_json
      : typeof r.items_json === "string" && r.items_json[0] === "["
        ? JSON.parse(r.items_json)
        : [];
    const feesJson: unknown[] = Array.isArray(r.fees_json)
      ? r.fees_json
      : typeof r.fees_json === "string" && r.fees_json[0] === "["
        ? JSON.parse(r.fees_json)
        : [];

    return {
      ...invoice,
      items: (itemsJson as Record<string, unknown>[]).map((item) => this.itemRowToModel(item)),
      fees: (feesJson as Record<string, unknown>[]).map((fee) => this.feeRowToModel(fee)),
    };
  }

  async findByPublicToken(businessId?: string, token?: string): Promise<InvoiceWithDetails> {
    const where = businessId ? "WHERE public_token = $1 AND business_id = $2" : "WHERE public_token = $1";
    const params = businessId ? [token, businessId] : [token];
    const res = await query(
      `SELECT i.*,
              COALESCE((SELECT json_agg(row_to_json(items)) FROM (
                SELECT id, invoice_id, product_id, description,
                       quantity::text AS quantity, unit, unit_price::text AS unit_price,
                       discount::text AS discount, discount_type, tax_rate::text AS tax_rate,
                       tax_amount::text AS tax_amount, line_subtotal::text AS line_subtotal,
                       line_total::text AS line_total, sort_order, is_tax_inclusive, created_at,
                       catalog_name, catalog_sku, catalog_tax_category,
                       catalog_unit_price::text AS catalog_unit_price, catalog_tax_rate::text AS catalog_tax_rate
                  FROM invoice_items WHERE invoice_id = i.id ORDER BY sort_order
              ) items), '[]'::json) AS items_json,
              COALESCE((SELECT json_agg(row_to_json(fees)) FROM (
                SELECT id, invoice_id, description,
                       amount::text AS amount, tax_rate::text AS tax_rate,
                       tax_amount::text AS tax_amount, sort_order, created_at
                  FROM invoice_fees WHERE invoice_id = i.id ORDER BY sort_order
              ) fees), '[]'::json) AS fees_json
       FROM invoices i
       ${where}`,
      params
    );
    if (!res.rows.length) throw new NotFoundError("Invoice not found");
    const r = res.rows[0];
    const invoice = this.rowToModel(r);

    const itemsJson: unknown[] = Array.isArray(r.items_json)
      ? r.items_json
      : typeof r.items_json === "string" && r.items_json[0] === "["
        ? JSON.parse(r.items_json)
        : [];
    const feesJson: unknown[] = Array.isArray(r.fees_json)
      ? r.fees_json
      : typeof r.fees_json === "string" && r.fees_json[0] === "["
        ? JSON.parse(r.fees_json)
        : [];

    return {
      ...invoice,
      items: (itemsJson as Record<string, unknown>[]).map((item) => this.itemRowToModel(item)),
      fees: (feesJson as Record<string, unknown>[]).map((fee) => this.feeRowToModel(fee)),
    };
  }

  async assignNumber(businessId: string, invoiceId: string, invoiceNumber: string, client?: any): Promise<void> {
    const exec = client ? client.query.bind(client) : query;
    const res = await exec(
      `UPDATE invoices SET invoice_number = $1 WHERE id = $2 AND business_id = $3 RETURNING id`,
      [invoiceNumber, invoiceId, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Invoice ${invoiceId} not found`);
  }

  async finalize(businessId: string, invoiceId: string, opts: { finalizedAt: Date }, client?: any): Promise<void> {
    const exec = client ? client.query.bind(client) : query;
    const res = await exec(
      `UPDATE invoices SET is_finalized = TRUE, finalized_at = $1, updated_at = NOW()
       WHERE id = $2 AND business_id = $3 RETURNING id`,
      [opts.finalizedAt.toISOString(), invoiceId, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Invoice ${invoiceId} not found`);
  }

  async setStatus(invoiceId: string, status: string, fields?: Record<string, unknown>, client?: any): Promise<void> {
    const ALLOWED_COLUMNS: Record<string, string> = {
      sentAt: "sent_at", viewedAt: "viewed_at", paidAt: "paid_at", cancelledAt: "cancelled_at",
    };
    const set: string[] = [`status = $2`];
    const vals: unknown[] = [invoiceId, status];
    let i = 3;
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        const col = ALLOWED_COLUMNS[k];
        if (!col) continue;
        set.push(`${col} = $${i++}`);
        vals.push(v);
      }
    }
    set.push(`updated_at = NOW()`);
    const exec = client ? client.query.bind(client) : query;
    await exec(`UPDATE invoices SET ${set.join(", ")} WHERE id = $1`, vals);
  }

  async recordEvent(invoiceId: string, event: { eventType: string; actorId?: string; actorType?: string; metadata?: Record<string, unknown>; createdAt?: Date }, client?: any): Promise<InvoiceEvent> {
    const exec = client ? client.query.bind(client) : query;
    const res = await exec(
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

  async findPayments(invoiceId: string, businessId: string, limit = 100): Promise<any[]> {
    const res = await query(
      `SELECT p.*, i.invoice_number, i.currency as invoice_currency
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.invoice_id = $1 AND p.business_id = $2
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [invoiceId, businessId, limit]
    );
    return res.rows;
  }

  async sumPaidSince(businessId: string, since: Date): Promise<string> {
    const res = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payments
       WHERE business_id = $1 AND status = 'succeeded' AND paid_at >= $2`,
      [businessId, since.toISOString()]
    );
    return String(res.rows[0]?.total ?? 0);
  }

  async hasReminderIdempotencyKey(businessId: string, idempotencyKey: string): Promise<boolean> {
    const res = await query(
      `SELECT 1 FROM invoice_reminders
       WHERE business_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [businessId, idempotencyKey]
    );
    return res.rows.length > 0;
  }

  async findManyPage(businessId: string, opts: InvoiceListOptions = {}): Promise<PagedResult<InvoiceListItem>> {
    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;
    if (opts.status) { conditions.push(`status = $${i++}`); vals.push(opts.status); }
    if (opts.customerId) { conditions.push(`customer_id = $${i++}`); vals.push(opts.customerId); }
    if (opts.projectId) { conditions.push(`project_id = $${i++}`); vals.push(opts.projectId); }
    if (opts.invoiceNumber) { conditions.push(`invoice_number ILIKE $${i++}`); vals.push(`%${opts.invoiceNumber}%`); }
    if (opts.currency) { conditions.push(`currency = $${i++}`); vals.push(opts.currency.toUpperCase()); }
    if (opts.minAmount !== undefined) { conditions.push(`total >= $${i++}`); vals.push(opts.minAmount); }
    if (opts.maxAmount !== undefined) { conditions.push(`total <= $${i++}`); vals.push(opts.maxAmount); }
    if (asSqlDate(opts.issueDateFrom)) { conditions.push(`issue_date >= $${i++}`); vals.push(asSqlDate(opts.issueDateFrom)); }
    if (asSqlDate(opts.issueDateTo)) { conditions.push(`issue_date <= $${i++}`); vals.push(asSqlDate(opts.issueDateTo)); }
    if (asSqlDate(opts.dueDateFrom)) { conditions.push(`due_date >= $${i++}`); vals.push(asSqlDate(opts.dueDateFrom)); }
    if (asSqlDate(opts.dueDateTo)) { conditions.push(`due_date <= $${i++}`); vals.push(asSqlDate(opts.dueDateTo)); }
    if (opts.search) {
      const term = `%${opts.search}%`;
      conditions.push(`(i.invoice_number ILIKE $${i} OR c.name ILIKE $${i} OR c.email ILIKE $${i} OR c.company_name ILIKE $${i})`);
      vals.push(term, term, term, term);
      i++;
    }
    if (opts.paymentState) {
      const paymentState = opts.paymentState.toLowerCase();
      if (paymentState === "paid") {
        conditions.push(`(status = 'paid' OR amount_due <= 0)`);
      } else if (paymentState === "partial" || paymentState === "partially_paid") {
        conditions.push(`(status = 'partially_paid' OR (amount_paid > 0 AND amount_due > 0))`);
      } else if (paymentState === "overdue") {
        conditions.push(`(status = 'overdue' OR (due_date < CURRENT_DATE AND amount_due > 0 AND status NOT IN ('paid', 'cancelled', 'void', 'draft')))`);
      } else if (paymentState === "unpaid" || paymentState === "open") {
        conditions.push(`(amount_due > 0 AND status NOT IN ('paid', 'cancelled', 'void'))`);
      } else if (paymentState === "pending") {
        conditions.push(`status = 'draft'`);
      }
    }

    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    const sortColumn = INVOICE_SORT_COLUMNS[opts.sortBy ?? "created_at"] ?? INVOICE_SORT_COLUMNS.created_at;
    const direction = opts.sortOrder === "asc" ? "ASC" : "DESC";
    const from = `FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id WHERE ${conditions.join(" AND ")}`;
    const dataRes = await query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email, COUNT(*) OVER() AS total_count ${from}
       ORDER BY ${sortColumn} ${direction}, i.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, offset]
    );
    const total = dataRes.rows.length ? Number(dataRes.rows[0]?.total_count ?? 0) : 0;
    return {
      data: dataRes.rows.map((r) => {
        const model = this.rowToModel(r);
        return { ...model, customer_name: r.customer_name ?? null, customer_email: r.customer_email ?? null };
      }),
      total,
      limit,
      offset,
    };
  }
  async findMany(businessId: string, opts: { status?: string; customerId?: string; projectId?: string; search?: string; limit?: number; offset?: number } = {}): Promise<any[]> {
    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;
    if (opts.status) { conditions.push(`status = $${i++}`); vals.push(opts.status); }
    if (opts.customerId) { conditions.push(`customer_id = $${i++}`); vals.push(opts.customerId); }
    if (opts.projectId) { conditions.push(`project_id = $${i++}`); vals.push(opts.projectId); }
    if (opts.search) {
      const term = `%${opts.search}%`;
      conditions.push(`(invoice_number ILIKE $${i} OR customer_id::text ILIKE $${i} OR c.name ILIKE $${i})`);
      vals.push(term, term, term);
      i++;
    }
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const res = await query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY i.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, offset]
    );
    return res.rows;
  }

  async getAgingBuckets(businessId: string, now: Date): Promise<Array<{
    bucket: string;
    count: number;
    amount: string;
  }>> {
    const res = await query(
      `SELECT
         bucket,
         COUNT(*)::int AS count,
         COALESCE(SUM(amount_due), 0) AS amount
       FROM (
         SELECT
           i.amount_due,
           CASE
             WHEN i.due_date IS NULL THEN 'current'
             WHEN EXTRACT(EPOCH FROM ($1::timestamptz - i.due_date)) / 86400 <= 0 THEN 'current'
             WHEN EXTRACT(EPOCH FROM ($1::timestamptz - i.due_date)) / 86400 <= 30 THEN '1-30'
             WHEN EXTRACT(EPOCH FROM ($1::timestamptz - i.due_date)) / 86400 <= 60 THEN '31-60'
             WHEN EXTRACT(EPOCH FROM ($1::timestamptz - i.due_date)) / 86400 <= 90 THEN '61-90'
             ELSE '90+'
           END AS bucket
         FROM invoices i
         WHERE i.business_id = $2
           AND i.amount_due > 0
           AND i.status NOT IN ('draft', 'cancelled', 'void')
       ) sub
       GROUP BY bucket
       ORDER BY
         CASE bucket
           WHEN 'current' THEN 0
           WHEN '1-30' THEN 1
           WHEN '31-60' THEN 2
           WHEN '61-90' THEN 3
           WHEN '90+' THEN 4
         END`,
      [now.toISOString(), businessId]
    );

    const buckets: Array<{ bucket: string; count: number; amount: string }> = [
      { bucket: "current", count: 0, amount: "0" },
      { bucket: "1-30", count: 0, amount: "0" },
      { bucket: "31-60", count: 0, amount: "0" },
      { bucket: "61-90", count: 0, amount: "0" },
      { bucket: "90+", count: 0, amount: "0" },
    ];
    for (const row of res.rows) {
      const idx = buckets.findIndex((b) => b.bucket === row.bucket);
      if (idx >= 0) {
        buckets[idx].count = Number(row.count ?? 0);
        buckets[idx].amount = String(row.amount ?? "0");
      }
    }
    return buckets;
  }

  async getVolumeTrend(businessId: string, months: number): Promise<Array<{
    period: string;
    invoiced: string;
    paid: string;
    count: number;
  }>> {
    const cutoff = new Date();
    cutoff.setDate(1);
    cutoff.setMonth(cutoff.getMonth() - months + 1);
    cutoff.setHours(0, 0, 0, 0);

    const res = await query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', COALESCE(i.issue_date, i.created_at)), 'YYYY-MM') AS period,
         COUNT(*)::int AS count,
         COALESCE(SUM(i.total), 0) AS invoiced,
         COALESCE(SUM(i.amount_paid), 0) AS paid
       FROM invoices i
       WHERE i.business_id = $1
         AND (i.issue_date IS NULL OR i.issue_date >= $2 OR i.created_at >= $2)
       GROUP BY DATE_TRUNC('month', COALESCE(i.issue_date, i.created_at))
       ORDER BY period ASC`,
      [businessId, cutoff.toISOString()]
    );

    return res.rows.map((r) => ({
      period: r.period as string,
      invoiced: String(r.invoiced ?? "0"),
      paid: String(r.paid ?? "0"),
      count: Number(r.count ?? 0),
    }));
  }

  async getPaymentMetrics(businessId: string, monthStart: Date): Promise<{
    totalInvoiced: string;
    totalPaid: string;
    totalOutstanding: string;
    totalOverdue: string;
    averagePaymentTimeDays: number;
    collectionRate: number;
    paidInvoiceCount: number;
  }> {
    const res = await query(
      `SELECT
         COALESCE(SUM(total), 0) AS total_invoiced,
         COALESCE(SUM(amount_paid), 0) AS total_paid,
         COALESCE(SUM(CASE WHEN amount_due > 0 AND status NOT IN ('draft','cancelled','void') THEN amount_due ELSE 0 END), 0) AS total_outstanding,
         COALESCE(SUM(CASE WHEN (status = 'overdue' OR (due_date < NOW() AND amount_due > 0)) AND amount_due > 0 AND status NOT IN ('draft','cancelled','void') THEN amount_due ELSE 0 END), 0) AS total_overdue,
         COUNT(CASE WHEN status = 'paid' AND paid_at IS NOT NULL AND created_at IS NOT NULL THEN 1 END) AS paid_invoice_count,
         COALESCE(SUM(CASE WHEN status = 'paid' AND paid_at IS NOT NULL AND created_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (paid_at - created_at)) / 86400 ELSE 0 END), 0) AS total_payment_days
       FROM invoices
       WHERE business_id = $1`,
      [businessId]
    );

    const row = res.rows[0];
    const totalInvoiced = String(row.total_invoiced ?? "0");
    const totalPaid = String(row.total_paid ?? "0");
    const totalOutstanding = String(row.total_outstanding ?? "0");
    const totalOverdue = String(row.total_overdue ?? "0");
    const paidInvoiceCount = Number(row.paid_invoice_count ?? 0);
    const totalPaymentDays = Number(row.total_payment_days ?? 0);
    const averagePaymentTimeDays = paidInvoiceCount > 0 ? Math.round(totalPaymentDays / paidInvoiceCount) : 0;
    const totalInvoicedNum = Number(totalInvoiced);
    const collectionRate = totalInvoicedNum > 0 ? Math.round((Number(totalPaid) / totalInvoicedNum) * 100) : 0;

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      totalOverdue,
      averagePaymentTimeDays,
      collectionRate,
      paidInvoiceCount,
    };
  }

  async getDashboardSummary(businessId: string): Promise<{
    totalOutstanding: string;
    totalOverdue: string;
    totalPaidThisMonth: string;
    totalRevenue: string;
    draftCount: number;
    overdueCount: number;
    sentCount: number;
    paidCount: number;
    totalInvoices: number;
  }> {
    const monthStart = new Date();
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setDate(1);

    const res = await query(
      `SELECT
         COUNT(*) AS total_invoices,
         SUM(total) AS total_revenue,
         SUM(CASE WHEN amount_due > 0 AND status NOT IN ('draft','cancelled','void') THEN amount_due ELSE 0 END) AS total_outstanding,
         SUM(CASE WHEN (status = 'overdue' OR (due_date < NOW() AND amount_due > 0)) AND amount_due > 0 AND status NOT IN ('draft','cancelled','void') THEN amount_due ELSE 0 END) AS total_overdue,
         SUM(CASE WHEN amount_paid > 0 AND paid_at >= $2 THEN amount_paid ELSE 0 END) AS total_paid_this_month,
         COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft_count,
         COUNT(CASE WHEN status = 'sent' THEN 1 END) AS sent_count,
         COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
         COUNT(CASE WHEN (status = 'overdue' OR (due_date < NOW() AND amount_due > 0)) AND amount_due > 0 AND status NOT IN ('draft','cancelled','void','paid') THEN 1 END) AS overdue_count
       FROM invoices WHERE business_id = $1`,
      [businessId, monthStart.toISOString()]
    );

    const row = res.rows[0];
    return {
      totalOutstanding: row.total_outstanding ?? "0",
      totalOverdue: row.total_overdue ?? "0",
      totalPaidThisMonth: row.total_paid_this_month ?? "0",
      totalRevenue: row.total_revenue ?? "0",
      draftCount: Number(row.draft_count ?? 0),
      overdueCount: Number(row.overdue_count ?? 0),
      sentCount: Number(row.sent_count ?? 0),
      paidCount: Number(row.paid_count ?? 0),
      totalInvoices: Number(row.total_invoices ?? 0),
    };
  }

  /**
   * Invoices that are still open (outstanding balance) and due within the
   * next `days` days. Powers the cash-flow "Upcoming" stream on the dashboard.
   */
  async findUpcomingInvoices(businessId: string, days: number): Promise<any[]> {
    const res = await query(
      `SELECT i.id, i.invoice_number, i.status, i.currency, i.total, i.amount_due, i.due_date, i.sent_at, i.paid_at,
              c.name as customer_name, c.email as customer_email
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.business_id = $1
         AND i.amount_due > 0
         AND i.status IN ('sent','viewed','partially_paid','overdue')
         AND i.due_date IS NOT NULL
         AND i.due_date <= (NOW() + $2 * interval '1 day')
       ORDER BY i.due_date ASC
       LIMIT 20`,
      [businessId, days]
    );
    return res.rows;
  }

  async findOverdueCandidates(now: Date): Promise<any[]> {
    const res = await query(
      `SELECT id, business_id, due_date, amount_due, status
       FROM invoices
       WHERE due_date < $1
         AND amount_due > 0
         AND status IN ('sent', 'viewed', 'partially_paid')`,
      [now]
    );
    return res.rows;
  }

  async findInvoicesNeedingReminders(businessId: string, now: Date): Promise<Array<{
    id: string;
    invoiceNumber: string | null;
    status: string;
    dueDate: Date | null;
    issueDate: Date | null;
    customerId: string | null;
    amountDue: string;
    customerEmail: string | null;
    customerName: string | null;
  }>> {
    const res = await query(
      `SELECT i.id, i.invoice_number, i.status, i.due_date, i.issue_date, i.customer_id,
              i.amount_due, c.email as customer_email, c.name as customer_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.business_id = $1
         AND i.amount_due > 0
         AND i.is_finalized = TRUE
         AND i.status IN ('sent', 'viewed', 'partially_paid', 'overdue')`,
      [businessId]
    );
    return res.rows.map(r => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      status: r.status,
      dueDate: r.due_date ? new Date(r.due_date) : null,
      issueDate: r.issue_date ? new Date(r.issue_date) : null,
      customerId: r.customer_id,
      amountDue: r.amount_due,
      customerEmail: r.customer_email,
      customerName: r.customer_name,
    }));
  }

  /**
   * Fetches recently paid invoices and invoices requiring attention in a single
   * query each, avoiding the need to load 500 rows and filter client-side.
   */
  async findRecentlyPaid(businessId: string, limit = 10): Promise<any[]> {
    const res = await query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.business_id = $1 AND i.status IN ('paid', 'partially_paid')
       ORDER BY COALESCE(i.paid_at, i.updated_at) DESC
       LIMIT $2`,
      [businessId, limit]
    );
    return res.rows;
  }

  async findRequiringAttention(businessId: string, now: Date, limit = 10): Promise<any[]> {
    const res = await query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.business_id = $1
         AND (i.status IN ('draft', 'sent', 'viewed')
              OR (i.amount_due > 0 AND i.due_date < $2 AND i.status NOT IN ('paid', 'cancelled', 'void')))
       ORDER BY COALESCE(i.due_date, i.created_at) ASC
       LIMIT $3`,
      [businessId, now.toISOString(), limit]
    );
    return res.rows;
  }

  async getReminderRules(businessId: string): Promise<Array<{
    id: string;
    name: string;
    triggerType: 'before_due' | 'after_due' | 'manual';
    offsetDays: number;
    minStatus: string;
    maxSendCount: number;
    subjectTemplate: string;
    messageTemplate: string;
    isActive: boolean;
  }>> {
    const res = await query(
      `SELECT id, name, trigger_type, offset_days, min_status, max_send_count,
              subject_template, message_template, is_active
       FROM invoice_reminder_rules
       WHERE business_id = $1 AND is_active = TRUE
       ORDER BY trigger_type, offset_days`,
      [businessId]
    );
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      triggerType: r.trigger_type,
      offsetDays: r.offset_days,
      minStatus: r.min_status,
      maxSendCount: r.max_send_count,
      subjectTemplate: r.subject_template,
      messageTemplate: r.message_template,
      isActive: r.is_active,
    }));
  }

  async getReminderSendCount(invoiceId: string, ruleId: string): Promise<number> {
    const res = await query(
      `SELECT COALESCE(SUM(send_count), 0)::int as total
       FROM invoice_reminders
       WHERE invoice_id = $1 AND rule_id = $2`,
      [invoiceId, ruleId]
    );
    return res.rows[0]?.total ?? 0;
  }

  async markOverdue(invoiceId: string, timestamp: Date): Promise<boolean> {
    const res = await query(
      `UPDATE invoices SET status = 'overdue', updated_at = NOW()
       WHERE id = $1 AND status IN ('sent','viewed','partially_paid')
       RETURNING id`,
      [invoiceId]
    );
    if (!res.rows.length) return false;
    await this.recordEvent(invoiceId, {
      eventType: "overdue", actorType: "system", metadata: { detectedAt: timestamp.toISOString() },
    });
    return true;
  }

  async recordReminder(invoiceId: string, businessId: string, ruleId: string | null, emailLogId: string | null, recipientEmail: string, subject: string, sendCount: number, idempotencyKey?: string | null): Promise<string> {
    const res = await query(
      `INSERT INTO invoice_reminders (invoice_id, business_id, rule_id, email_log_id, recipient_email, subject, send_count, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING RETURNING id`,
      [invoiceId, businessId, ruleId, emailLogId, recipientEmail, subject, sendCount, idempotencyKey ?? null]
    );
    if (res.rows[0]?.id) return res.rows[0].id as string;
    const existing = await query(
      `SELECT id FROM invoice_reminders
       WHERE business_id = $1 AND idempotency_key = $2
       LIMIT 1`,
      [businessId, idempotencyKey ?? ""]
    );
    return (existing.rows[0]?.id as string) ?? "";
  }

  async getReminderCount(invoiceId: string): Promise<number> {
    const res = await query(
      `SELECT COUNT(*)::int FROM invoice_reminders WHERE invoice_id = $1`,
      [invoiceId]
    );
    return res.rows[0]?.count ?? 0;
  }

  async getEvents(invoiceId: string, businessId: string, limit = 100): Promise<InvoiceEvent[]> {
    const res = await query(
      `SELECT e.* FROM invoice_events e JOIN invoices i ON i.id = e.invoice_id
       WHERE e.invoice_id = $1 AND i.business_id = $2 ORDER BY e.created_at DESC LIMIT $3`,
      [invoiceId, businessId, limit]
    );
    return res.rows.map((r) => this.eventRowToModel(r));
  }

  async createSnapshot(invoiceId: string, snapshot: Record<string, unknown>, hash: string, opts?: {
    revision?: number;
    templateId?: string | null;
    templateSchemaVersion?: string | null;
    templateRevision?: number;
    renderedHtml?: string | null;
    pdfStored?: boolean;
    pdfHash?: string;
    createdBy?: string;
    client?: any;
  }): Promise<InvoiceSnapshot> {
    const revision = opts?.revision ?? 1;
    const exec = opts?.client ? opts.client.query.bind(opts.client) : query;
    const res = await exec(
      `INSERT INTO invoice_snapshots (invoice_id, snapshot, snapshot_hash, revision, template_id, template_schema_version, template_revision, rendered_html, pdf_stored, pdf_hash, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11) RETURNING *`,
      [invoiceId, JSON.stringify(snapshot), hash, revision, opts?.templateId ?? null, opts?.templateSchemaVersion ?? 1, opts?.templateRevision ?? 1, opts?.renderedHtml ?? null, opts?.pdfStored ?? false, opts?.pdfHash ?? null, opts?.createdBy ?? null]
    );
    const r = res.rows[0];
    return {
      id: r.id as string, invoiceId: r.invoice_id as string, revision: Number(r.revision ?? 1),
      snapshot: r.snapshot as Record<string, unknown>,
      snapshotHash: r.snapshot_hash as string,
      templateId: r.template_id as string | null,
      templateSchemaVersion: r.template_schema_version as string | null,
      templateRevision: Number(r.template_revision ?? 1),
      renderedHtml: r.rendered_html as string | null,
      pdfStored: Boolean(r.pdf_stored), pdfHash: r.pdf_hash as string | null,
      createdAt: new Date(r.created_at as string), createdBy: r.created_by as string | null,
    };
  }

  async getSnapshot(invoiceId: string, revision?: number | null): Promise<Record<string, unknown> | null> {
    let res;
    if (revision != null) {
      res = await query(
        `SELECT snapshot, snapshot_hash, revision, template_id, template_schema_version, template_revision, rendered_html, pdf_stored, pdf_hash
         FROM invoice_snapshots WHERE invoice_id = $1 AND revision = $2 ORDER BY revision DESC LIMIT 1`,
        [invoiceId, revision]
      );
    } else {
      res = await query(
        `SELECT snapshot, snapshot_hash, revision, template_id, template_schema_version, template_revision, rendered_html, pdf_stored, pdf_hash
         FROM invoice_snapshots WHERE invoice_id = $1 ORDER BY revision DESC LIMIT 1`,
        [invoiceId]
      );
    }
    if (!res.rows.length) return null;
    return res.rows[0] as Record<string, unknown>;
  }

  async getSnapshots(invoiceId: string): Promise<InvoiceSnapshot[]> {
    const res = await query(
      `SELECT * FROM invoice_snapshots WHERE invoice_id = $1 ORDER BY revision ASC`,
      [invoiceId]
    );
    return res.rows.map((r) => ({
      id: r.id as string, invoiceId: r.invoice_id as string, revision: Number(r.revision ?? 1),
      snapshot: r.snapshot as Record<string, unknown>,
      snapshotHash: r.snapshot_hash as string,
      templateId: r.template_id as string | null,
      templateSchemaVersion: r.template_schema_version as string | null,
      templateRevision: Number(r.template_revision ?? 1),
      renderedHtml: r.rendered_html as string | null,
      pdfStored: Boolean(r.pdf_stored), pdfHash: r.pdf_hash as string | null,
      createdAt: new Date(r.created_at as string), createdBy: r.created_by as string | null,
    }));
  }

  async getLatestSnapshotRevision(invoiceId: string): Promise<number> {
    const res = await query(
      `SELECT COALESCE(MAX(revision), 0) as revision FROM invoice_snapshots WHERE invoice_id = $1`,
      [invoiceId]
    );
    return Number(res.rows[0]?.revision ?? 0);
  }

  async getSnapshotHash(invoiceId: string): Promise<string | null> {
    const res = await query(`SELECT snapshot_hash FROM invoice_snapshots WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1`, [invoiceId]);
    return res.rows.length ? (res.rows[0].snapshot_hash as string) : null;
  }

  async updateLineItemComputed(invoiceId: string, itemId: string, fields: {
    taxAmount: Decimal.Value;
    lineSubtotal: Decimal.Value;
    lineTotal: Decimal.Value;
  }, client?: any): Promise<void> {
    const exec = client ? client.query.bind(client) : query;
    await exec(
      `UPDATE invoice_items SET tax_amount = $1, line_subtotal = $2, line_total = $3
       WHERE id = $4 AND invoice_id = $5`,
      [fields.taxAmount, fields.lineSubtotal, fields.lineTotal, itemId, invoiceId]
    );
  }

   private rowToModel(r: Record<string, unknown>): Invoice {
    return {
      id: r.id as string, businessId: r.business_id as string, customerId: r.customer_id as string | null,
      projectId: r.project_id as string | null,
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
      version: Number(r.version ?? 1),
      templateSchemaVersion: r.template_schema_version as string | null,
      templateRevision: Number(r.template_revision ?? 1),
      createdAt: rowToDate(r.created_at)!, updatedAt: rowToDate(r.updated_at)!,
      createdBy: r.created_by as string | null, updatedBy: r.updated_by as string | null,
      depositAmount: r.deposit_amount as string,
      depositType: (r.deposit_type as "none" | "fixed" | "percentage") ?? "none",
      depositDueDate: rowToDate(r.deposit_due_date),
      depositPaymentPurpose: r.deposit_payment_purpose as string | null ?? null,
      creditApplied: r.credit_applied as string ?? "0",
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
      catalogName: r.catalog_name as string | null,
      catalogSku: r.catalog_sku as string | null,
      catalogTaxCategory: r.catalog_tax_category as string | null,
      catalogUnitPrice: r.catalog_unit_price as string | null,
      catalogTaxRate: r.catalog_tax_rate as string | null,
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
