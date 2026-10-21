import { logger } from "../utils/logger.js";
import { query } from "../db/pool.js";
import { invoiceService } from "./invoice-service.js";
import { isSchedulerAvailable, scheduleRepeatableJob } from "./scheduler.js";
import type { CreateInvoiceInput } from "./invoice-service.js";

const RECURRING_QUEUE = "recurring-invoices";

interface RecurringInvoiceRow {
  id: string;
  business_id: string;
  customer_id: string | null;
  name: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval_count: number;
  next_generation_at: string;
  end_date: string | null;
  currency: string;
  notes: string | null;
  terms: string | null;
  is_active: boolean;
  payment_instructions: string | null;
  issue_offset_days: number;
  due_offset_days: number;
  auto_send: boolean;
  delivery_method: string;
  deposit_amount: string | null;
  deposit_type: string;
  status: string;
  last_generated_invoice_id: string | null;
  generation_version: number;
}

interface RecurringItemRow {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  tax_rate: string | null;
  tax_name: string | null;
  discount: string | null;
  discount_type: string | null;
  sort_order: number;
}

interface RecurringFeeRow {
  description: string;
  amount: string;
  tax_rate: string | null;
  tax_name: string | null;
  sort_order: number;
}

export class RecurringInvoiceService {
  async processDueInvoices(): Promise<{ processed: number; generated: number; errors: number }> {
    if (!isSchedulerAvailable()) {
      logger.info("Scheduler not available — skipping recurring invoice processing");
      return { processed: 0, generated: 0, errors: 0 };
    }

    const result = await query(
      `SELECT * FROM recurring_invoices
       WHERE is_active = TRUE
         AND status IN ('active', 'draft')
         AND next_generation_at <= NOW()
         AND (end_date IS NULL OR end_date >= next_generation_at)
       ORDER BY next_generation_at ASC
       LIMIT 100`,
    );

    let generated = 0;
    let errors = 0;

    for (const recurring of result.rows as RecurringInvoiceRow[]) {
      try {
        const generationRun = await this.createGenerationRun(recurring);
        if (!generationRun) {
          continue;
        }

        const invoice = await this.generateInvoice(recurring, generationRun.id);
        generated++;

        await this.updateNextGenerationAt(recurring, invoice);

        if (recurring.auto_send && invoice) {
          void this.sendGeneratedInvoice(recurring, invoice);
        }
      } catch (err) {
        errors++;
        logger.error({ err, recurringId: recurring.id }, "Failed to generate invoice from recurring schedule");
        await this.markGenerationRunFailed(recurring.id, recurring.next_generation_at, err instanceof Error ? err.message : String(err));
      }
    }

    return { processed: result.rows.length, generated, errors };
  }

  private async createGenerationRun(recurring: RecurringInvoiceRow): Promise<{ id: string } | null> {
    const idempotencyKey = `gen:${recurring.id}:${recurring.next_generation_at}`;
    try {
      const result = await query(
        `INSERT INTO recurring_generation_runs
         (recurring_invoice_id, business_id, scheduled_for, idempotency_key, status)
         VALUES ($1, $2, $3, $4, 'processing')
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [recurring.id, recurring.business_id, recurring.next_generation_at, idempotencyKey],
      );

      if (!result.rows.length) {
        logger.info({ recurringId: recurring.id }, "Generation run already exists (skipping duplicate)");
        return null;
      }
      return { id: result.rows[0].id };
    } catch {
      return null;
    }
  }

  private async generateInvoice(
    recurring: RecurringInvoiceRow,
    runId: string,
  ): Promise<{ id: string; status: string } | null> {
    const itemsResult = await query(
      `SELECT description, quantity, unit, unit_price, tax_rate, tax_name, discount, discount_type, sort_order
       FROM recurring_invoice_items
       WHERE recurring_invoice_id = $1
       ORDER BY sort_order`,
      [recurring.id],
    );
    const items = itemsResult.rows as RecurringItemRow[];

    const feesResult = await query(
      `SELECT description, amount, tax_rate, tax_name, sort_order
       FROM recurring_invoice_fees
       WHERE recurring_invoice_id = $1
       ORDER BY sort_order`,
      [recurring.id],
    );
    const fees = feesResult.rows as RecurringFeeRow[];

    const issueDate = this.calculateIssueDate(recurring);
    const dueDate = this.calculateDueDate(recurring, issueDate);

    const invoiceInput: CreateInvoiceInput = {
      customerId: recurring.customer_id ?? undefined,
      currency: recurring.currency,
      issueDate: issueDate.toISOString().split("T")[0],
      dueDate: dueDate.toISOString().split("T")[0],
      notes: recurring.notes ?? undefined,
      terms: recurring.terms ?? undefined,
      paymentInstructions: recurring.payment_instructions ?? undefined,
      items: items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unit_price),
        taxRate: Number(item.tax_rate ?? 0),
        taxName: item.tax_name ?? null,
        discount: item.discount ? Number(item.discount) : undefined,
        discountType: (item.discount_type as "fixed" | "percentage") ?? "fixed",
        isTaxInclusive: false,
      })),
      fees: fees.map((fee) => ({
        description: fee.description,
        amount: Number(fee.amount),
        taxRate: Number(fee.tax_rate ?? 0),
        taxName: fee.tax_name ?? null,
        sortOrder: fee.sort_order,
      })),
    };

    const invoice = await invoiceService.create(recurring.business_id, invoiceInput, undefined);

    const finalized = await invoiceService.finalize(recurring.business_id, invoice.id as string);

    await query(
      `UPDATE recurring_generation_runs
       SET status = 'completed', invoice_id = $1, completed_at = NOW()
       WHERE id = $2`,
      [invoice.id, runId],
    );

    await query(
      `UPDATE recurring_invoices
       SET last_generated_invoice_id = $1, last_generation_at = NOW(), generation_version = generation_version + 1
       WHERE id = $2`,
      [invoice.id, recurring.id],
    );

    return { id: invoice.id as string, status: finalized.status };
  }

  private calculateIssueDate(recurring: RecurringInvoiceRow): Date {
    const base = new Date(recurring.next_generation_at);
    const offsetMs = (recurring.issue_offset_days ?? 0) * 24 * 60 * 60 * 1000;
    return new Date(base.getTime() - offsetMs);
  }

  private calculateDueDate(recurring: RecurringInvoiceRow, issueDate: Date): Date {
    const dueOffsetDays = recurring.due_offset_days ?? 30;
    const dueMs = dueOffsetDays * 24 * 60 * 60 * 1000;
    return new Date(issueDate.getTime() + dueMs);
  }

  private async updateNextGenerationAt(recurring: RecurringInvoiceRow, _invoice: { id: string; status: string } | null): Promise<void> {
    const next = this.computeNextGenerationDate(recurring.frequency, recurring.interval_count, recurring.next_generation_at);
    if (!next) return;

    await query(
      `UPDATE recurring_invoices
       SET next_generation_at = $1
       WHERE id = $2`,
      [next.toISOString().split("T")[0], recurring.id],
    );
  }

  private computeNextGenerationDate(
    frequency: "daily" | "weekly" | "monthly" | "yearly",
    interval: number,
    fromDate: string,
  ): Date | null {
    const date = new Date(fromDate);
    const normalized = date.getTime();

    switch (frequency) {
      case "daily":
        return new Date(normalized + interval * 24 * 60 * 60 * 1000);
      case "weekly":
        return new Date(normalized + interval * 7 * 24 * 60 * 60 * 1000);
      case "monthly": {
        const newDate = new Date(date);
        newDate.setMonth(newDate.getMonth() + interval);
        return newDate;
      }
      case "yearly": {
        const newDate = new Date(date);
        newDate.setFullYear(newDate.getFullYear() + interval);
        return newDate;
      }
      default:
        return null;
    }
  }

  private async sendGeneratedInvoice(recurring: RecurringInvoiceRow, invoice: { id: string; status: string }): Promise<void> {
    try {
      const successUrl = `${process.env.APP_FRONTEND_URL || process.env.APP_PUBLIC_BASE_URL || "http://localhost:5173"}/invoice/paid?token=recurring:${invoice.id}`;
      const cancelUrl = `${process.env.APP_FRONTEND_URL || process.env.APP_PUBLIC_BASE_URL || "http://localhost:5173"}`;

      await invoiceService.createPaymentSession(
        recurring.business_id,
        invoice.id,
        successUrl,
        cancelUrl,
      );

      logger.info({ recurringId: recurring.id, invoiceId: invoice.id }, "Generated invoice payment session for recurring schedule");
    } catch (err) {
      logger.error({ err, recurringId: recurring.id, invoiceId: invoice.id }, "Failed to create payment session for auto-generated invoice");
    }
  }

  private async markGenerationRunFailed(recurringId: string, scheduledFor: string, error: string): Promise<void> {
    await query(
      `UPDATE recurring_generation_runs
       SET status = 'failed', error = $1
       WHERE recurring_invoice_id = $2 AND scheduled_for = $3 AND status = 'processing'`,
      [error, recurringId, scheduledFor],
    );
  }

  async scheduleRecurringJob(): Promise<void> {
    await scheduleRepeatableJob(RECURRING_QUEUE, "process-due-invoices", {}, { cron: "0 */6 * * *" });
  }
}

export const recurringInvoiceService = new RecurringInvoiceService();
