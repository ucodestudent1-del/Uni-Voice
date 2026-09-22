import { Decimal } from "decimal.js";
import { logger } from "../../utils/logger.js";
import { query } from "../../db/pool.js";
import { invoiceService } from "../invoice-service.js";
import { receiptService } from "../receipt-service.js";
import { receiptRepository } from "../../repositories/receipt.repo.js";
import { BusinessLogicError } from "../../domain/errors.js";

export type StripeEventType =
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed"
  | "charge.refunded"
  | "charge.reversed"
  | string;

export interface StripeEvent {
  id: string;
  type: StripeEventType;
  data: {
    object: Record<string, unknown>;
  };
}

const INVOICE_PAYMENT_EVENT_TYPES = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.reversed",
]);

export class InvoicePaymentService {
  /**
   * Records a Stripe webhook event in the stripe_webhook_events table for
   * deduplication. Returns true if the event was newly recorded, false if it
   * was already processed (duplicate).
   */
  async recordWebhookEvent(event: StripeEvent, opts: {
    businessId?: string;
    invoiceId?: string;
  }): Promise<boolean> {
    const res = await query(
      `INSERT INTO stripe_webhook_events (stripe_event_id, event_type, business_id, invoice_id, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING id`,
      [
        event.id,
        event.type,
        opts.businessId ?? null,
        opts.invoiceId ?? null,
        JSON.stringify(event.data.object),
      ]
    );
    if (!res.rows.length) {
      logger.info(`Stripe webhook event ${event.id} already processed (duplicate)`);
      return false;
    }
    return true;
  }

  /**
   * Resolves the business_id and invoice_id from a Stripe event. Uses metadata
   * as the primary source, falling back to lookups by provider intent id.
   */
  async resolveContext(event: StripeEvent): Promise<{ businessId: string; invoiceId: string | null }> {
    const obj = event.data.object;
    const metadata = (obj.metadata as Record<string, unknown> | undefined) ?? {};

    const metaBusinessId = metadata.businessId as string | undefined;
    const metaInvoiceId = metadata.invoiceId as string | undefined;

    if (metaBusinessId && metaInvoiceId) {
      return { businessId: metaBusinessId, invoiceId: metaInvoiceId };
    }

    const providerIntentId = obj.id as string | undefined ?? obj.payment_intent as string | undefined;
    if (providerIntentId) {
      const piRes = await query(
        `SELECT business_id, invoice_id FROM payment_intents
         WHERE provider_intent_id = $1 LIMIT 1`,
        [providerIntentId]
      );
      if (piRes.rows.length) {
        return {
          businessId: piRes.rows[0].business_id,
          invoiceId: piRes.rows[0].invoice_id,
        };
      }
    }

    const chargeId = obj.id as string | undefined;
    if (chargeId && (event.type === "charge.refunded" || event.type === "charge.reversed")) {
      const payRes = await query(
        `SELECT p.business_id, p.invoice_id
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         WHERE p.provider_payment_id = $1 OR p.provider = 'stripe' LIMIT 1`,
        [chargeId]
      );
      if (payRes.rows.length) {
        return {
          businessId: payRes.rows[0].business_id,
          invoiceId: payRes.rows[0].invoice_id,
        };
      }
    }

    if (metaBusinessId) {
      return { businessId: metaBusinessId, invoiceId: null };
    }

    throw new BusinessLogicError(
      `Cannot resolve business/invoice context from Stripe event ${event.id}`,
      "STRIPE_EVENT_CONTEXT_MISSING"
    );
  }

  async reconcileStripeEvent(event: StripeEvent): Promise<void> {
    if (!INVOICE_PAYMENT_EVENT_TYPES.has(event.type)) {
      logger.info(`Ignoring non-invoice-payment Stripe event type: ${event.type}`);
      return;
    }

    let ctx: { businessId: string; invoiceId: string | null };
    try {
      ctx = await this.resolveContext(event);
    } catch (e) {
      logger.warn({ err: e, eventId: event.id }, "Could not resolve context for Stripe event; recording and skipping");
      await this.recordWebhookEvent(event, {});
      return;
    }

    const wasRecorded = await this.recordWebhookEvent(event, {
      businessId: ctx.businessId,
      invoiceId: ctx.invoiceId ?? undefined,
    });
    if (!wasRecorded) {
      return;
    }

    logger.info(`Reconciling Stripe event ${event.type} (${event.id}) for business ${ctx.businessId} invoice ${ctx.invoiceId ?? "unknown"}`);

    switch (event.type) {
      case "payment_intent.succeeded":
        await this.handlePaymentIntentSucceeded(event, ctx);
        break;
      case "payment_intent.payment_failed":
        await this.handlePaymentIntentFailed(event, ctx);
        break;
      case "charge.refunded":
        await this.handleChargeRefunded(event, ctx);
        break;
      case "charge.reversed":
        await this.handleChargeReversed(event, ctx);
        break;
      default:
        logger.info(`Unhandled invoice-payment Stripe event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(event: StripeEvent, ctx: { businessId: string; invoiceId: string | null }): Promise<void> {
    const obj = event.data.object;
    const amount = new Decimal((obj.amount as number) ?? 0).div(100);
    const currency = (obj.currency as string ?? "usd").toUpperCase();
    const providerPaymentId = obj.id as string;

    if (!ctx.invoiceId) {
      logger.warn(`payment_intent.succeeded for event ${event.id} has no invoiceId; skipping`);
      return;
    }

    const idempotencyKey = `stripe:${providerPaymentId}`;
    await invoiceService.recordProviderPayment(
      ctx.businessId,
      ctx.invoiceId,
      amount.toFixed(6),
      currency,
      "stripe",
      providerPaymentId,
      idempotencyKey
    );

    await this.issueReceiptIfNeeded(ctx.businessId, ctx.invoiceId, providerPaymentId);
  }

  private async handlePaymentIntentFailed(event: StripeEvent, ctx: { businessId: string; invoiceId: string | null }): Promise<void> {
    const obj = event.data.object;
    const providerPaymentId = obj.id as string;
    const lastPaymentError = obj.last_payment_error as Record<string, unknown> | undefined;

    logger.warn({ error: lastPaymentError, eventId: event.id, providerPaymentId, businessId: ctx.businessId, invoiceId: ctx.invoiceId }, "PaymentIntent failed");

    if (!ctx.invoiceId) return;

    await query(
      `INSERT INTO payment_events (payment_id, event_type, status, amount, metadata, created_at)
       SELECT id, 'payment_failed', 'failed', amount, $1, NOW()
       FROM payments
       WHERE invoice_id = $2 AND business_id = $3 AND provider_payment_id = $4
       LIMIT 1`,
      [
        JSON.stringify({ stripeEventId: event.id, errorMessage: lastPaymentError?.message ?? null }),
        ctx.invoiceId,
        ctx.businessId,
        providerPaymentId,
      ]
    );
  }

  private async handleChargeRefunded(event: StripeEvent, ctx: { businessId: string; invoiceId: string | null }): Promise<void> {
    const obj = event.data.object;
    const amountRefunded = new Decimal((obj.amount_refunded as number) ?? 0).div(100);
    const currency = (obj.currency as string ?? "usd").toUpperCase();
    const providerRefundId = obj.id as string;

    if (!ctx.invoiceId) {
      logger.warn(`charge.refunded for event ${event.id} has no invoiceId; skipping`);
      return;
    }

    const payRes = await query(
      `SELECT id, amount FROM payments
       WHERE invoice_id = $1 AND business_id = $2 AND provider = 'stripe'
       ORDER BY created_at DESC LIMIT 1`,
      [ctx.invoiceId, ctx.businessId]
    );
    if (!payRes.rows.length) {
      logger.warn(`No stripe payment found for invoice ${ctx.invoiceId} on charge.refunded`);
      return;
    }

    const paymentId = payRes.rows[0].id;
    const idempotencyKey = `stripe-refund:${providerRefundId}`;
    await invoiceService.refundPayment(
      ctx.businessId,
      ctx.invoiceId,
      paymentId,
      amountRefunded.toFixed(6),
      currency,
      "stripe",
      providerRefundId,
      idempotencyKey
    );
  }

  private async handleChargeReversed(event: StripeEvent, ctx: { businessId: string; invoiceId: string | null }): Promise<void> {
    logger.info(`charge.reversed event ${event.id} for business ${ctx.businessId} invoice ${ctx.invoiceId ?? "unknown"}`);
    await this.handleChargeRefunded(event, ctx);
  }

  private async issueReceiptIfNeeded(businessId: string, invoiceId: string, providerPaymentId: string): Promise<void> {
    const payRes = await query(
      `SELECT id, amount, currency FROM payments
       WHERE invoice_id = $1 AND business_id = $2 AND provider_payment_id = $3
       ORDER BY created_at DESC LIMIT 1`,
      [invoiceId, businessId, providerPaymentId]
    );
    if (!payRes.rows.length) {
      logger.warn(`Cannot find payment for receipt issuance: invoice ${invoiceId} providerPaymentId ${providerPaymentId}`);
      return;
    }

    const payment = {
      id: payRes.rows[0].id,
      invoiceId,
      businessId,
      provider: "stripe",
      providerPaymentId,
      amount: payRes.rows[0].amount,
      currency: payRes.rows[0].currency,
      status: "succeeded" as const,
      paidAt: new Date(),
      method: "card",
      idempotencyKey: null,
      metadata: { provider: "stripe", providerPaymentId },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existing = await receiptRepository.findByPayment(businessId, payment.id);
    if (existing) {
      logger.info(`Receipt already exists for payment ${payment.id}; skipping`);
      return;
    }

    try {
      await receiptService.issueReceipt(businessId, invoiceId, payment);
    } catch (e) {
      logger.error({ err: e, invoiceId, paymentId: payment.id }, "Failed to issue receipt after payment");
    }
  }
}

export const invoicePaymentService = new InvoicePaymentService();
