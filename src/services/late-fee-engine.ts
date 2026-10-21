import { logger } from "../utils/logger.js";
import { query, getClient } from "../db/pool.js";
import { Decimal } from "decimal.js";
import { getCurrencyMetadata } from "../domain/value-objects/currency.js";
import type { CurrencyCode } from "../domain/value-objects/currency.js";
import { isSchedulerAvailable, registerHandler, scheduleRepeatableJob } from "./scheduler.js";
import { invalidateDashboardCache } from "./reports-service.js";

const LATE_FEE_QUEUE = "late-fees";

interface LateFeeInvoiceRow {
  id: string;
  business_id: string;
  customer_id: string | null;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  due_date: string | null;
  total: string;
  amount_due: string;
  amount_paid: string;
  currency: string;
  late_fee_type: string | null;
  late_fee_value: string | null;
  late_fee_applied: boolean | null;
  late_fee_applied_amount: string | null;
  terms: string | null;
}

export class LateFeeEngineService {
  async applyLateFees(): Promise<{ processed: number; applied: number; errors: number }> {
    if (!isSchedulerAvailable()) {
      logger.info("Scheduler not available — skipping late fee processing");
      return { processed: 0, applied: 0, errors: 0 };
    }

    const now = new Date();
    const invoices = await this.findOverdueInvoices(now);

    let applied = 0;
    let errors = 0;

    for (const invoice of invoices.rows) {
      try {
        const success = await this.applyLateFee(invoice);
        if (success) applied++;
      } catch (err) {
        errors++;
        logger.error({ err, invoiceId: invoice.id }, "Failed to apply late fee");
      }
    }

    if (applied > 0) {
      void invalidateDashboardCache(invoices.rows[0]?.business_id ?? "");
    }

    return { processed: invoices.rows.length, applied, errors };
  }

  private async findOverdueInvoices(now: Date): Promise<{ rows: LateFeeInvoiceRow[] }> {
    const nowIso = now.toISOString();

    return query(
      `SELECT i.*, bs.late_fee_type, bs.late_fee_value, bs.late_fee_period_days
       FROM invoices i
       JOIN business_settings bs ON bs.business_id = i.business_id
       WHERE i.is_finalized = TRUE
         AND i.amount_due > 0
         AND i.status NOT IN ('draft', 'cancelled', 'void', 'paid')
         AND i.late_fee_applied = FALSE
         AND bs.late_fee_type IN ('fixed', 'percentage')
         AND bs.late_fee_value > 0
         AND (
           (i.due_date IS NOT NULL AND i.due_date <= NOW() - INTERVAL '1 day' * bs.late_fee_period_days)
           OR (i.due_date IS NOT NULL AND i.due_date + INTERVAL '1 day' * COALESCE(bs.late_fee_period_days, 0) <= NOW())
         )
       ORDER BY i.created_at ASC
       LIMIT 100`,
      [nowIso],
    );
  }

  private async applyLateFee(invoice: LateFeeInvoiceRow): Promise<boolean> {
    const feeType = (invoice.late_fee_type ?? "percentage") as "fixed" | "percentage";
    const feeValue = new Decimal(invoice.late_fee_value ?? "0");
    const amountDue = new Decimal(invoice.amount_due ?? "0");

    if (feeValue.lte(0)) return false;
    if (amountDue.lte(0)) return false;

    const meta = getCurrencyMetadata(invoice.currency as CurrencyCode);
    const dp = meta.decimalPlaces;

    let lateFeeAmount: Decimal;
    if (feeType === "percentage") {
      lateFeeAmount = amountDue.mul(feeValue.div(100)).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
    } else {
      lateFeeAmount = feeValue.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
    }

    if (lateFeeAmount.isZero()) return false;

    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO invoice_fees
         (invoice_id, description, amount, tax_rate, tax_name, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          invoice.id,
          `Late Payment Fee (${feeType === "percentage" ? `${feeValue.toFixed()}%` : "fixed"})`,
          lateFeeAmount.toFixed(),
          "0",
          null,
          999,
        ],
      );

      const newAmountDue = new Decimal(invoice.amount_due ?? "0").plus(lateFeeAmount);
      const newTotal = new Decimal(invoice.total ?? "0").plus(lateFeeAmount);

      await client.query(
        `UPDATE invoices
         SET fee_total = COALESCE(fee_total, 0) + $1,
             total = $2,
             amount_due = $3,
             late_fee_applied = TRUE,
             late_fee_applied_amount = $4,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $5 AND business_id = $6`,
        [
          lateFeeAmount.toFixed(),
          newTotal.toFixed(),
          newAmountDue.toFixed(),
          lateFeeAmount.toFixed(),
          invoice.id,
          invoice.business_id,
        ],
      );

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'late_fee_applied', NULL, 'system', $2::jsonb)`,
        [
          invoice.id,
          JSON.stringify({
            type: feeType,
            value: feeValue.toFixed(),
            appliedAmount: lateFeeAmount.toFixed(),
            amountDueBefore: invoice.amount_due,
          }),
        ],
      );

      await client.query("COMMIT");

      void invalidateDashboardCache(invoice.business_id);

      logger.info({
        invoiceId: invoice.id,
        businessId: invoice.business_id,
        amount: lateFeeAmount.toFixed(),
        type: feeType,
      }, "Late fee applied to invoice");

      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async scheduleLateFeeJob(): Promise<void> {
    await scheduleRepeatableJob(LATE_FEE_QUEUE, "apply-late-fees", {}, { cron: "0 2 * * *" });
  }
}

registerHandler(LATE_FEE_QUEUE, async (_job) => {
  const service = new LateFeeEngineService();
  await service.applyLateFees();
});

export const lateFeeEngineService = new LateFeeEngineService();
