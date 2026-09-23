import { query } from "../db/pool.js";
import type { Payment } from "../domain/models/index.js";
import { NotFoundError } from "../domain/errors.js";
import { rowToDate } from "./helpers.js";

export interface ReceiptFilter {
  status?: string;
  invoiceId?: string;
  paymentId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface ReceiptRow {
  id: string;
  businessId: string;
  invoiceId: string;
  paymentId: string;
  receiptNumber: string;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  paymentPurpose: string | null;
  status: string;
  issuedAt: Date | null;
  emailLogId: string | null;
  idempotencyKey: string;
  pdf: Buffer | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class ReceiptRepository {
  async create(input: {
    businessId: string;
    invoiceId: string;
    paymentId: string;
    receiptNumber: string;
    amount: string | number;
    currency: string;
    paymentMethod?: string | null;
    paymentPurpose?: string | null;
    idempotencyKey: string;
    pdf?: Buffer | null;
    metadata?: Record<string, unknown>;
  }): Promise<ReceiptRow> {
    const res = await query(
      `INSERT INTO receipts (business_id, invoice_id, payment_id, receipt_number, amount, currency,
        payment_method, payment_purpose, status, idempotency_key, pdf, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'issued',$9,$10,$11,NOW(),NOW())
       RETURNING *`,
      [
        input.businessId, input.invoiceId, input.paymentId, input.receiptNumber, input.amount,
        input.currency, input.paymentMethod ?? null, input.paymentPurpose ?? null,
        input.idempotencyKey, input.pdf ?? null, JSON.stringify(input.metadata ?? {}),
      ]
    );
    return this.rowToModel(res.rows[0]);
  }

  async findById(businessId: string, id: string): Promise<ReceiptRow> {
    const res = await query(
      `SELECT * FROM receipts WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Receipt ${id} not found`);
    return this.rowToModel(res.rows[0]);
  }

  async findByIdRaw(id: string): Promise<ReceiptRow> {
    const res = await query(`SELECT * FROM receipts WHERE id = $1`, [id]);
    if (!res.rows.length) throw new NotFoundError(`Receipt ${id} not found`);
    return this.rowToModel(res.rows[0]);
  }

  async findByPayment(businessId: string, paymentId: string): Promise<ReceiptRow | null> {
    const res = await query(
      `SELECT * FROM receipts WHERE payment_id = $1 AND business_id = $2 LIMIT 1`,
      [paymentId, businessId]
    );
    if (!res.rows.length) return null;
    return this.rowToModel(res.rows[0]);
  }

  async findByInvoice(businessId: string, invoiceId: string): Promise<ReceiptRow[]> {
    const res = await query(
      `SELECT * FROM receipts WHERE invoice_id = $1 AND business_id = $2 ORDER BY created_at DESC`,
      [invoiceId, businessId]
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async findByIdempotencyKey(businessId: string, idempotencyKey: string): Promise<ReceiptRow | null> {
    const res = await query(
      `SELECT * FROM receipts WHERE idempotency_key = $1 AND business_id = $2 LIMIT 1`,
      [idempotencyKey, businessId]
    );
    if (!res.rows.length) return null;
    return this.rowToModel(res.rows[0]);
  }

  async findMany(businessId: string, filter: ReceiptFilter): Promise<{ data: ReceiptRow[]; total: number; limit: number; offset: number }> {
    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (filter.status) { conditions.push(`status = $${i++}`); vals.push(filter.status); }
    if (filter.invoiceId) { conditions.push(`invoice_id = $${i++}`); vals.push(filter.invoiceId); }
    if (filter.paymentId) { conditions.push(`payment_id = $${i++}`); vals.push(filter.paymentId); }
    if (filter.dateFrom) { conditions.push(`issued_at >= $${i++}`); vals.push(filter.dateFrom); }
    if (filter.dateTo) { conditions.push(`issued_at <= $${i++}`); vals.push(filter.dateTo); }

    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);

    const dataRes = await query(
      `SELECT * FROM receipts WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, offset]
    );
    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM receipts WHERE ${conditions.join(" AND ")}`,
      vals
    );

    return {
      data: dataRes.rows.map((r) => this.rowToModel(r)),
      total: Number(countRes.rows[0]?.total ?? 0),
      limit,
      offset,
    };
  }

  async findManyWithDetails(businessId: string, filter: ReceiptFilter): Promise<Record<string, unknown>[]> {
    const conditions: string[] = ["r.business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (filter.status) { conditions.push(`r.status = $${i++}`); vals.push(filter.status); }
    if (filter.invoiceId) { conditions.push(`r.invoice_id = $${i++}`); vals.push(filter.invoiceId); }
    if (filter.paymentId) { conditions.push(`r.payment_id = $${i++}`); vals.push(filter.paymentId); }
    if (filter.dateFrom) { conditions.push(`r.issued_at >= $${i++}`); vals.push(filter.dateFrom); }
    if (filter.dateTo) { conditions.push(`r.issued_at <= $${i++}`); vals.push(filter.dateTo); }

    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);

    const res = await query(
      `SELECT r.*, i.invoice_number, i.currency,
              i.customer_id, c.name as customer_name, c.email as customer_email,
              b.name as business_name
       FROM receipts r
       JOIN invoices i ON i.id = r.invoice_id
       JOIN businesses b ON b.id = r.business_id
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY r.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, offset]
    );
    return res.rows;
  }

  async findManyWithDetailsAndCount(
    businessId: string,
    filter: ReceiptFilter
  ): Promise<{ data: Record<string, unknown>[]; total: number; limit: number; offset: number }> {
    const conditions: string[] = ["r.business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (filter.status) { conditions.push(`r.status = $${i++}`); vals.push(filter.status); }
    if (filter.invoiceId) { conditions.push(`r.invoice_id = $${i++}`); vals.push(filter.invoiceId); }
    if (filter.paymentId) { conditions.push(`r.payment_id = $${i++}`); vals.push(filter.paymentId); }
    if (filter.dateFrom) { conditions.push(`r.issued_at >= $${i++}`); vals.push(filter.dateFrom); }
    if (filter.dateTo) { conditions.push(`r.issued_at <= $${i++}`); vals.push(filter.dateTo); }

    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);

    const res = await query(
      `SELECT r.*, i.invoice_number, i.currency,
              i.customer_id, c.name as customer_name, c.email as customer_email,
              b.name as business_name,
              COUNT(*) OVER() AS total_count
       FROM receipts r
       JOIN invoices i ON i.id = r.invoice_id
       JOIN businesses b ON b.id = r.business_id
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY r.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, offset]
    );

    const total = res.rows.length ? Number(res.rows[0]?.total_count ?? 0) : 0;
    const data = res.rows.map((row) => {
      const { total_count: _tc, ...rest } = row;
      return rest;
    });

    return { data, total, limit, offset };
  }

  async setStatus(id: string, status: string, opts?: { emailLogId?: string | null }): Promise<void> {
    const sets: string[] = [`status = $2`];
    const vals: unknown[] = [id, status];
    let i = 3;
    if (opts) {
      if (opts.emailLogId !== undefined) {
        sets.push(`email_log_id = $${i++}`);
        vals.push(opts.emailLogId);
      }
    }
    sets.push(`updated_at = NOW()`);
    await query(`UPDATE receipts SET ${sets.join(", ")} WHERE id = $1`, vals);
  }

  async storePdf(id: string, pdf: Buffer): Promise<void> {
    await query(`UPDATE receipts SET pdf = $1, updated_at = NOW() WHERE id = $2`, [pdf, id]);
  }

  async getPayment(invoiceId: string, businessId: string): Promise<Payment | null> {
    const res = await query(
      `SELECT p.id, p.invoice_id, p.business_id, p.provider, p.provider_payment_id,
              p.amount, p.currency, p.status, p.paid_at, p.method, p.idempotency_key,
              p.metadata, p.created_at, p.updated_at
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.invoice_id = $1 AND p.business_id = $2
         AND p.status = 'succeeded'
       ORDER BY p.created_at DESC LIMIT 1`,
      [invoiceId, businessId]
    );
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id, invoiceId: r.invoice_id, businessId: r.business_id, provider: r.provider,
      providerPaymentId: r.provider_payment_id, amount: r.amount, currency: r.currency,
      status: r.status, paidAt: rowToDate(r.paid_at), method: r.method,
      idempotencyKey: r.idempotency_key, metadata: r.metadata ?? {},
      createdAt: rowToDate(r.created_at)!, updatedAt: rowToDate(r.updated_at)!,
    };
  }

  private rowToModel(r: Record<string, unknown>): ReceiptRow {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      invoiceId: r.invoice_id as string,
      paymentId: r.payment_id as string,
      receiptNumber: r.receipt_number as string,
      amount: r.amount as string,
      currency: r.currency as string,
      paymentMethod: r.payment_method as string | null,
      paymentPurpose: r.payment_purpose as string | null,
      status: r.status as string,
      issuedAt: rowToDate(r.issued_at),
      emailLogId: r.email_log_id as string | null,
      idempotencyKey: r.idempotency_key as string,
      pdf: r.pdf as Buffer | null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }
}

export const receiptRepository = new ReceiptRepository();
