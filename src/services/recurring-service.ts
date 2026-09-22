import { Decimal } from "decimal.js";
import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { invoiceService } from "../services/invoice-service.js";
import type { DraftLineItem, DraftFee } from "../services/invoice-service.js";

export interface RecurringGenerationResult {
  recurringInvoiceId: string;
  invoiceId: string;
  scheduledFor: string;
  status: string;
}

export class RecurringService {
  /**
   * Generates invoices for all due, active recurring invoices. The job is
   * designed to be invoked by the in-process scheduler (and could be wired to
   * a real cron/queue in production).
   */
  async processDue(now: Date = new Date()): Promise<{ generated: number; results: RecurringGenerationResult[]; skipped: number }> {
    const today = now.toISOString().slice(0, 10);
    const res = await query(
      `SELECT id, business_id, customer_id, currency, notes, terms,
              issue_offset_days, due_offset_days, auto_send, delivery_method,
              payment_instructions, deposit_amount, deposit_type, deposit_due_offset_days
       FROM recurring_invoices
       WHERE is_active = TRUE
         AND next_generation_at <= $1::date
         AND (end_date IS NULL OR end_date >= $1::date)`,
      [today]
    );

    const results: RecurringGenerationResult[] = [];
    let skipped = 0;
    for (const ri of res.rows) {
      try {
        const invoiceId = await this.generateForRecurring(ri);
        results.push({
          recurringInvoiceId: ri.id,
          invoiceId,
          scheduledFor: today,
          status: "generated",
        });
      } catch (e) {
        skipped++;
        logger.error({ err: e, recurringInvoiceId: ri.id }, "Failed to generate recurring invoice");
        await this.recordRun(ri.id, ri.business_id, today, null, "failed", (e as Error).message);
      }
    }
    logger.info(`Recurring generation: ${results.length} generated, ${skipped} skipped/failed`);
    return { generated: results.length, results, skipped };
  }

  private async generateForRecurring(recurring: Record<string, unknown>): Promise<string> {
    const recurringInvoiceId = recurring.id as string;
    const businessId = recurring.business_id as string;
    const scheduledFor = (recurring.next_generation_at as string | undefined) ?? new Date().toISOString().slice(0, 10);

    const idempotencyKey = `recurring:${recurringInvoiceId}:${scheduledFor}`;

    const client = await getClient();
    let runId: string | undefined;
    try {
      await client.query("BEGIN");

      const existingRun = await client.query(
        `SELECT id, invoice_id, status FROM recurring_generation_runs
         WHERE recurring_invoice_id = $1 AND scheduled_for = $2::date LIMIT 1`,
        [recurringInvoiceId, scheduledFor]
      );
      if (existingRun.rows.length) {
        await client.query("ROLLBACK");
        logger.info(`Recurring run already exists for ${recurringInvoiceId} on ${scheduledFor}`);
        return existingRun.rows[0].invoice_id;
      }

      const runRes = await client.query(
        `INSERT INTO recurring_generation_runs (recurring_invoice_id, business_id, scheduled_for, idempotency_key, status)
         VALUES ($1, $2, $3, $4, 'processing') RETURNING id`,
        [recurringInvoiceId, businessId, scheduledFor, idempotencyKey]
      );
      runId = runRes.rows[0].id;

      const items = await this.getItems(recurringInvoiceId);
      const fees = await this.getFees(recurringInvoiceId);

      const issueOffset = Number(recurring.issue_offset_days ?? 0);
      const dueOffset = Number(recurring.due_offset_days ?? 0);
      const issueDate = new Date(scheduledFor);
      issueDate.setDate(issueDate.getDate() + issueOffset);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + dueOffset);

      const depositAmount = Number(recurring.deposit_amount ?? 0) > 0 ? new Decimal(recurring.deposit_amount as string | number) : undefined;
      const invoiceId = await invoiceService.createDraft({
        customerId: (recurring.customer_id as string | null | undefined) ?? undefined,
        currency: (recurring.currency as string) ?? "USD",
        issueDate: issueDate,
        dueDate: dueDate,
        notes: (recurring.notes as string | null | undefined) ?? undefined,
        terms: (recurring.terms as string | null | undefined) ?? undefined,
        paymentInstructions: (recurring.payment_instructions as string | null | undefined) ?? undefined,
        depositAmount: depositAmount?.toFixed(6),
        depositType: (recurring.deposit_type as "none" | "fixed" | "percentage" | undefined) ?? "none",
        depositDueDate: recurring.deposit_due_offset_days
          ? new Date(new Date(scheduledFor).getTime() + Number(recurring.deposit_due_offset_days) * 24 * 60 * 60 * 1000)
          : undefined,
        depositPaymentPurpose: (recurring.deposit_payment_purpose as string | null | undefined) ?? undefined,
        items: items.length ? items : undefined,
        fees: fees.length ? fees : undefined,
      }, businessId);

      await client.query(
        `UPDATE recurring_generation_runs SET invoice_id = $1, status = 'completed', completed_at = NOW()
         WHERE id = $2`,
        [invoiceId, runId]
      );

      if (recurring.auto_send && recurring.delivery_method !== "none") {
        try {
          await invoiceService.finalize(businessId, invoiceId);
          await invoiceService.send(businessId, invoiceId);
        } catch (e) {
          logger.warn({ err: e, invoiceId, recurringInvoiceId }, "Recurring invoice auto-send failed");
        }
      }

      await client.query(
        `UPDATE recurring_invoices
         SET next_generation_at = $1::date, last_generation_at = NOW(), last_generated_invoice_id = $2, generation_version = (COALESCE(generation_version,1)+1), updated_at = NOW()
         WHERE id = $3`,
        [this.nextGenerationDate(recurring, scheduledFor), invoiceId, recurringInvoiceId]
      );

      await client.query("COMMIT");
      logger.info(`Generated invoice ${invoiceId} from recurring ${recurringInvoiceId}`);
      return invoiceId;
    } catch (e) {
      await client.query("ROLLBACK");
      await this.recordRun(recurringInvoiceId, businessId, scheduledFor, null, "failed", (e as Error).message);
      throw e;
    } finally {
      client.release();
    }
  }

  private async getItems(recurringInvoiceId: string): Promise<DraftLineItem[]> {
    const res = await query(
      `SELECT id, product_id, description, quantity, unit, unit_price, discount, tax_rate, sort_order
       FROM recurring_invoice_items WHERE recurring_invoice_id = $1 ORDER BY sort_order, created_at`,
      [recurringInvoiceId]
    );
    return res.rows.map((r) => ({
      id: r.id as string,
      productId: r.product_id as string | null,
      description: r.description as string,
      quantity: r.quantity as string | number,
      unit: r.unit as string,
      unitPrice: r.unit_price as string | number,
      discount: Number(r.discount) > 0 ? String(r.discount) : undefined,
      discountType: "fixed" as const,
      taxRate: r.tax_rate as string | number,
      isTaxInclusive: false,
      sortOrder: Number(r.sort_order),
    }));
  }

  private async getFees(recurringInvoiceId: string): Promise<DraftFee[]> {
    const res = await query(
      `SELECT description, amount, tax_rate, sort_order
       FROM recurring_invoice_fees WHERE recurring_invoice_id = $1 ORDER BY sort_order, created_at`,
      [recurringInvoiceId]
    );
    return res.rows.map((r) => ({
      description: r.description as string,
      amount: r.amount as string | number,
      taxRate: r.tax_rate as string | number,
      sortOrder: Number(r.sort_order),
    }));
  }

  private async recordRun(
    recurringInvoiceId: string,
    businessId: string,
    scheduledFor: string,
    invoiceId: string | null,
    status: string,
    error?: string,
  ): Promise<void> {
    const idempotencyKey = `recurring:${recurringInvoiceId}:${scheduledFor}`;
    await query(
      `INSERT INTO recurring_generation_runs (recurring_invoice_id, business_id, scheduled_for, idempotency_key, invoice_id, status, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (recurring_invoice_id, scheduled_for) DO UPDATE
       SET invoice_id = $5, status = $6, error = $7, completed_at = NOW()`,
      [recurringInvoiceId, businessId, scheduledFor, idempotencyKey, invoiceId, status, error ?? null]
    );
  }

  private nextGenerationDate(recurring: Record<string, unknown>, scheduledFor: string): string {
    const frequency = (recurring.frequency as string) ?? "monthly";
    const interval = Number(recurring.interval_count ?? 1);
    const date = new Date(scheduledFor);
    switch (frequency) {
      case "daily":
        date.setDate(date.getDate() + interval);
        break;
      case "weekly":
        date.setDate(date.getDate() + 7 * interval);
        break;
      case "yearly":
        date.setFullYear(date.getFullYear() + interval);
        break;
      case "monthly":
      default:
        date.setMonth(date.getMonth() + interval);
        break;
    }
    return date.toISOString().slice(0, 10);
  }
}

export const recurringService = new RecurringService();
