import { Decimal } from "decimal.js";
import { calculationEngine, type InvoiceCalculationInput, type LineItemInput, type FeeInput, type DiscountDefinition, type CalculatedLineItem, type CalculatedFee, computeTaxBreakdown } from "../domain/calculation.js";
import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, BusinessLogicError, ConflictError } from "../domain/errors.js";
import { invoiceNumberService, creditNoteNumberService } from "../services/invoice-number-service.js";
import { pdfService } from "../services/pdf/pdf-service.js";
import { emailService } from "../services/email/email-service.js";
import { buildTemplateData, buildCreditNoteData, type TemplateLineItem, type TemplateFee, type TemplateBusiness, type TemplateCustomer, type TemplatePaymentInstructions, templateRenderer, DEFAULT_CREDIT_NOTE_TEMPLATE } from "../services/templates/template-renderer.js";
import { getCurrencyMetadata, type CurrencyCode } from "../domain/value-objects/currency.js";
import type { Address } from "../domain/value-objects/address.js";
import Handlebars from "handlebars";
import crypto from "node:crypto";

export interface InvoiceItemInput {
  description: string;
  quantity: string | number;
  unit: string;
  unitPrice: string | number;
  discount?: string | number;
  discountType?: "fixed" | "percentage";
  taxRate: string | number;
  taxName?: string | null;
  isTaxInclusive?: boolean;
  productId?: string | null;
  sortOrder?: number;
}

export interface InvoiceFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  taxName?: string | null;
  sortOrder?: number;
}

export interface CreateInvoiceInput {
  customerId?: string | null;
  currency: string;
  issueDate?: string | null;
  dueDate?: string | null;
  poNumber?: string | null;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  templateId?: string | null;
  invoiceDiscount?: string | number;
  invoiceDiscountType?: "fixed" | "percentage";
  shippingDescription?: string | null;
  shippingAmount?: string | number;
  shippingTaxRate?: string | number;
  items: InvoiceItemInput[];
  fees?: InvoiceFeeInput[];
}

export interface UpdateInvoiceInput extends Partial<CreateInvoiceInput> {
  version?: number;
}

export interface FinalizeInvoiceResult {
  invoice: Record<string, unknown>;
  invoiceNumber: string;
  status: string;
}

export interface SendInvoiceResult {
  ok: boolean;
  success: boolean;
  messageId: string;
  status: string;
}

export interface PaymentRecord {
  id: string;
  amount: string;
  currency: string;
  status: string;
  method?: string | null;
  provider?: string;
  providerPaymentId?: string | null;
  paidAt?: string | null;
  idempotencyKey?: string | null;
}

const ALLOWED_STATE_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled", "void"],
  sent: ["viewed", "partially_paid", "paid", "overdue", "cancelled", "void"],
  viewed: ["partially_paid", "paid", "overdue", "cancelled", "void"],
  partially_paid: ["paid", "overdue", "cancelled", "void"],
  overdue: ["paid", "partially_paid", "cancelled", "void"],
  paid: [],
  cancelled: [],
  void: [],
};

export const TERMINAL_STATUSES = new Set<string>(["paid", "cancelled", "void"]);

export function canTransition(currentStatus: string, nextStatus: string): boolean {
  const allowed = ALLOWED_STATE_TRANSITIONS[currentStatus] ?? [];
  return allowed.includes(nextStatus);
}

export function isOverdueStatus(status: string, dueDate?: string | null): boolean {
  if (status === "overdue") return true;
  if (TERMINAL_STATUSES.has(status)) return false;
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export function computeEffectiveStatus(
  status: string,
  dueDate: string | null | undefined,
  amountDue: string | number | Decimal.Value
): string {
  const due = new Decimal(amountDue ?? 0);
  if (isOverdueStatus(status, dueDate) && due.gt(0)) {
    return "overdue";
  }
  return status;
}

export class InvoiceService {
  private toCalcInput(input: CreateInvoiceInput): InvoiceCalculationInput {
    const items: LineItemInput[] = (input.items ?? []).map((item, idx) => ({
      description: item.description,
      quantity: new Decimal(item.quantity ?? 1),
      unit: item.unit ?? "each",
      unitPrice: new Decimal(item.unitPrice ?? 0),
      discount: item.discount !== undefined
        ? { type: item.discountType ?? "fixed", value: new Decimal(item.discount) }
        : undefined,
      taxRate: new Decimal(item.taxRate ?? 0),
      tax_name: item.taxName ?? null,
      isTaxInclusive: item.isTaxInclusive ?? false,
      sortOrder: item.sortOrder ?? idx,
    }));

    const fees: FeeInput[] = (input.fees ?? []).map((fee, idx) => ({
      description: fee.description,
      amount: new Decimal(fee.amount ?? 0),
      taxRate: fee.taxRate !== undefined ? new Decimal(fee.taxRate) : new Decimal(0),
      tax_name: fee.taxName ?? null,
      sortOrder: fee.sortOrder ?? idx,
    }));

    const invoiceDiscount: DiscountDefinition | undefined =
      input.invoiceDiscount !== undefined && new Decimal(input.invoiceDiscount ?? 0).gt(0)
        ? {
            type: input.invoiceDiscountType ?? "fixed",
            value: new Decimal(input.invoiceDiscount!),
          }
        : undefined;

    return {
      currency: input.currency as CurrencyCode,
      lineItems: items,
      fees: fees.length > 0 ? fees : undefined,
      invoiceDiscount,
      amountPaid: undefined,
    };
  }

  async create(businessId: string, input: CreateInvoiceInput, userId?: string): Promise<Record<string, unknown>> {
    const calcInput = this.toCalcInput(input);
    const result = calculationEngine.calculate(calcInput);

    const client = await getClient();
    try {
      await client.query("BEGIN");

      const invRes = await client.query(
        `INSERT INTO invoices (
          business_id, customer_id, currency, issue_date, due_date, po_number,
          notes, terms, payment_instructions, template_id,
          subtotal, discount_total, tax_total, fee_total, total,
          amount_paid, amount_due, version,
          invoice_discount_value, invoice_discount_type,
          shipping_description, shipping_amount, shipping_tax_rate
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,1,$18,$19,$20,$21,$22)
        RETURNING *`,
        [
          businessId,
          input.customerId ?? null,
          input.currency,
          input.issueDate ?? null,
          input.dueDate ?? null,
          input.poNumber ?? null,
          input.notes ?? null,
          input.terms ?? null,
          input.paymentInstructions ?? null,
          input.templateId ?? null,
          result.subtotal.toFixed(),
          result.discountTotal.toFixed(),
          result.taxTotal.toFixed(),
          result.feeTotal.toFixed(),
          result.total.toFixed(),
          "0",
          result.amountDue.toFixed(),
          input.invoiceDiscount ?? 0,
          input.invoiceDiscountType ?? "fixed",
          input.shippingDescription ?? null,
          input.shippingAmount ?? 0,
          input.shippingTaxRate ?? 0,
        ]
      );

      const invoiceId = invRes.rows[0].id;

      for (const item of input.items) {
        await client.query(
          `INSERT INTO invoice_items (
            invoice_id, product_id, description, quantity, unit, unit_price,
            discount, discount_type, tax_rate, tax_name, tax_amount,
            line_subtotal, line_total, sort_order, is_tax_inclusive
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            invoiceId,
            item.productId ?? null,
            item.description,
            item.quantity ?? 1,
            item.unit ?? "each",
            item.unitPrice ?? 0,
            item.discount ?? 0,
            item.discountType ?? "fixed",
            item.taxRate ?? 0,
            item.taxName ?? null,
            result.lineItems.find((li) => li.description === item.description)?.taxAmount.toFixed() ?? "0",
            result.lineItems.find((li) => li.description === item.description)?.lineSubtotal.toFixed() ?? "0",
            result.lineItems.find((li) => li.description === item.description)?.lineTotal.toFixed() ?? "0",
            item.sortOrder ?? 0,
            item.isTaxInclusive ?? false,
          ]
        );
      }

      for (const fee of input.fees ?? []) {
        await client.query(
          `INSERT INTO invoice_fees (invoice_id, description, amount, tax_rate, tax_name, tax_amount, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            invoiceId,
            fee.description,
            fee.amount,
            fee.taxRate ?? 0,
            fee.taxName ?? null,
            result.fees.find((f) => f.description === fee.description)?.taxAmount.toFixed() ?? "0",
            fee.sortOrder ?? 0,
          ]
        );
      }

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'created', $2, 'user', $3::jsonb)`,
        [invoiceId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");

      const invoice = await this.findById(businessId, invoiceId);
      logger.info(`Created invoice ${invoiceId} for business ${businessId}`);
      return invoice!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to create invoice for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async update(
    businessId: string,
    invoiceId: string,
    input: UpdateInvoiceInput,
    userId?: string
  ): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM invoices WHERE id = $1 AND business_id = $2`,
        [invoiceId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Invoice ${invoiceId} not found`);
      }

      const invoice = existing.rows[0];
      if (invoice.is_finalized) {
        throw new BusinessLogicError(
          "Finalized invoices cannot be edited. Issue a credit note or void instead.",
          "INVOICE_FINALIZED"
        );
      }

      if (input.version !== undefined && Number(invoice.version) !== Number(input.version)) {
        throw new ConflictError("Invoice was modified by another user. Please refresh and try again.", {
          currentVersion: invoice.version,
        });
      }

      const updates: string[] = [];
      const values: unknown[] = [businessId, invoiceId];
      let i = 3;

      const fieldMap: Record<string, string> = {
        customerId: "customer_id",
        currency: "currency",
        issueDate: "issue_date",
        dueDate: "due_date",
        poNumber: "po_number",
        notes: "notes",
        terms: "terms",
        paymentInstructions: "payment_instructions",
        templateId: "template_id",
      };

      for (const [key, val] of Object.entries(input)) {
        if (key === "version" || key === "items" || key === "fees") continue;
        const col = fieldMap[key] ?? key;
        updates.push(`${col} = $${i++}`);
        values.push(val);
      }

      if (input.invoiceDiscount !== undefined) {
        updates.push(`invoice_discount_value = $${i++}`);
        values.push(new Decimal(input.invoiceDiscount ?? 0).toFixed());
      }
      if (input.invoiceDiscountType !== undefined) {
        updates.push(`invoice_discount_type = $${i++}`);
        values.push(input.invoiceDiscountType);
      }

      if (updates.length > 0) {
        updates.push(`version = version + 1`, `updated_at = NOW()`);
        await client.query(
          `UPDATE invoices SET ${updates.join(", ")} WHERE id = $2 AND business_id = $1`,
          values
        );
      }

      if (input.items !== undefined) {
        await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [invoiceId]);
        const calcInput = this.toCalcInput({
          customerId: input.customerId ?? invoice.customer_id,
          currency: input.currency ?? invoice.currency,
          items: input.items,
          fees: input.fees,
          invoiceDiscount: input.invoiceDiscount ?? invoice.invoice_discount_value,
          invoiceDiscountType: input.invoiceDiscountType ?? invoice.invoice_discount_type,
        });
        const result = calculationEngine.calculate(calcInput);
        for (let idx = 0; idx < input.items.length; idx++) {
          const item = input.items[idx];
          const calcItem = result.lineItems[idx];
          await client.query(
            `INSERT INTO invoice_items (
              invoice_id, product_id, description, quantity, unit, unit_price,
              discount, discount_type, tax_rate, tax_name, tax_amount,
              line_subtotal, line_total, sort_order, is_tax_inclusive
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [
              invoiceId,
              item.productId ?? null,
              item.description,
              item.quantity ?? 1,
              item.unit ?? "each",
              item.unitPrice ?? 0,
              item.discount ?? 0,
              item.discountType ?? "fixed",
              item.taxRate ?? 0,
              item.taxName ?? null,
              calcItem?.taxAmount.toFixed() ?? "0",
              calcItem?.lineSubtotal.toFixed() ?? "0",
              calcItem?.lineTotal.toFixed() ?? "0",
              item.sortOrder ?? idx,
              item.isTaxInclusive ?? false,
            ]
          );
        }

        await client.query(
          `UPDATE invoices SET
            subtotal = $1, discount_total = $2, tax_total = $3,
            fee_total = $4, total = $5, amount_due = $6,
            version = version + 1, updated_at = NOW()
           WHERE id = $7 AND business_id = $8`,
          [
            result.subtotal.toFixed(),
            result.discountTotal.toFixed(),
            result.taxTotal.toFixed(),
            result.feeTotal.toFixed(),
            result.total.toFixed(),
            result.total.minus(result.amountPaid ?? 0).toFixed(),
            invoiceId,
            businessId,
          ]
        );
      }

      if (input.fees !== undefined) {
        await client.query(`DELETE FROM invoice_fees WHERE invoice_id = $1`, [invoiceId]);
        for (let idx = 0; idx < input.fees.length; idx++) {
          const fee = input.fees[idx];
          await client.query(
            `INSERT INTO invoice_fees (invoice_id, description, amount, tax_rate, tax_name, tax_amount, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [invoiceId, fee.description, fee.amount, fee.taxRate ?? 0, fee.taxName ?? null, "0", fee.sortOrder ?? idx]
          );
        }
      }

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'updated', $2, 'user', $3::jsonb)`,
        [invoiceId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");

      const updated = await this.findById(businessId, invoiceId);
      logger.info(`Updated invoice ${invoiceId} for business ${businessId}`);
      return updated!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to update invoice ${invoiceId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async finalize(
    businessId: string,
    invoiceId: string,
    userId?: string
  ): Promise<FinalizeInvoiceResult> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM invoices WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [invoiceId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Invoice ${invoiceId} not found`);
      }

      const invoice = existing.rows[0];
      if (invoice.is_finalized) {
        throw new BusinessLogicError("Invoice is already finalized", "ALREADY_FINALIZED");
      }

      const calcInput = await this.buildCalculationInput(businessId, invoiceId, invoice.currency);
      const result = calculationEngine.calculate(calcInput);

      const subtotal = new Decimal(invoice.subtotal);
      const taxTotal = new Decimal(invoice.tax_total);
      const feeTotal = new Decimal(invoice.fee_total);
      const total = new Decimal(invoice.total);

      if (
        !subtotal.eq(result.subtotal) ||
        !taxTotal.eq(result.taxTotal) ||
        !feeTotal.eq(result.feeTotal) ||
        !total.eq(result.total)
      ) {
        throw new BusinessLogicError(
          "Invoice calculations do not match. Please refresh and try again.",
          "CALCULATION_MISMATCH",
          {
            expected: { subtotal: result.subtotal.toFixed(), taxTotal: result.taxTotal.toFixed(), feeTotal: result.feeTotal.toFixed(), total: result.total.toFixed() },
            actual: { subtotal: subtotal.toFixed(), taxTotal: taxTotal.toFixed(), feeTotal: feeTotal.toFixed(), total: total.toFixed() },
          }
        );
      }

      const invoiceNumber = await invoiceNumberService.generate(businessId);

      await client.query(
        `UPDATE invoices SET
          invoice_number = $1,
          is_finalized = TRUE,
          finalized_at = NOW(),
          status = 'sent',
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [invoiceNumber, invoiceId, businessId]
      );

      const snapshot = await this.buildSnapshot(businessId, invoiceId);
      const snapshotJson = JSON.stringify(snapshot);
      const snapshotHash = crypto.createHash("sha256").update(snapshotJson).digest("hex");

      await client.query(
        `INSERT INTO invoice_snapshots (invoice_id, snapshot, snapshot_hash, pdf_stored, pdf_hash, created_by, created_at)
         VALUES ($1, $2::jsonb, $3, FALSE, NULL, $4, NOW())
         ON CONFLICT (invoice_id) DO UPDATE SET
           snapshot = $2::jsonb, snapshot_hash = $3, created_by = $4, created_at = NOW()`,
        [invoiceId, snapshotJson, snapshotHash, userId ?? null]
      );

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'finalized', $2, 'user', $3::jsonb)`,
        [invoiceId, userId ?? null, JSON.stringify({ invoice_number: invoiceNumber })]
      );

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'number_assigned', $2, 'user', $3::jsonb)`,
        [invoiceId, userId ?? null, JSON.stringify({ invoice_number: invoiceNumber })]
      );

      await client.query("COMMIT");

      const finalizedInvoice = await this.findById(businessId, invoiceId);
      logger.info(`Finalized invoice ${invoiceId} with number ${invoiceNumber}`);

      return { invoice: finalizedInvoice!, invoiceNumber, status: (finalizedInvoice as any)?.status ?? "sent" };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to finalize invoice ${invoiceId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async send(
    businessId: string,
    invoiceId: string,
    data: {
      to: string;
      cc?: string[];
      bcc?: string[];
      subject?: string;
      message?: string;
    },
    userId?: string
  ): Promise<SendInvoiceResult> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM invoices WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [invoiceId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Invoice ${invoiceId} not found`);
      }

      const invoice = existing.rows[0];
      if (!invoice.is_finalized) {
        throw new BusinessLogicError("Invoice must be finalized before sending", "NOT_FINALIZED");
      }

      const fullInvoice = await this.findById(businessId, invoiceId);
      if (!fullInvoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);
      const pdf = await this.generatePdf(businessId, invoiceId, fullInvoice);
      const html = await this.renderInvoiceEmail(businessId, invoiceId, fullInvoice as any, data.message);

      const idempotencyKey = `invoice-send:${invoiceId}:${crypto.randomUUID()}`;
      const result = await emailService.sendInvoiceEmail({
        invoiceId,
        businessId,
        recipient: { email: data.to, name: invoice.customer_name ?? undefined },
        subject: data.subject ?? `Invoice ${invoice.invoice_number ?? ""} from {{business_name}}`,
        htmlBody: html,
        attachments: [{ filename: `Invoice-${invoice.invoice_number ?? invoiceId}.pdf`, content: pdf }],
        idempotencyKey,
      });

      await client.query(
        `UPDATE invoices SET sent_at = NOW(), status = 'sent', version = version + 1
         WHERE id = $1 AND business_id = $2`,
        [invoiceId, businessId]
      );

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'sent', $2, 'user', $3::jsonb)`,
        [invoiceId, userId ?? null, JSON.stringify({ email: data.to, message_id: result.messageId })]
      );

      await client.query("COMMIT");
      logger.info(`Sent invoice ${invoiceId} to ${data.to}`);
      return { ok: true, success: true, messageId: result.messageId, status: result.status };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to send invoice ${invoiceId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async sendCreditNote(
    businessId: string,
    creditNoteId: string,
    data: {
      to: string;
      cc?: string[];
      bcc?: string[];
      subject?: string;
      message?: string;
    },
    userId?: string
  ): Promise<{ ok: boolean; messageId: string; status: string }> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM credit_notes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [creditNoteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Credit note ${creditNoteId} not found`);
      }

      const creditNote = existing.rows[0];

      await client.query(
        `UPDATE credit_notes SET status = 'sent', sent_at = NOW(), version = version + 1
         WHERE id = $1 AND business_id = $2`,
        [creditNoteId, businessId]
      );

      await client.query("COMMIT");
      logger.info(`Sent credit note ${creditNoteId} to ${data.to}`);
      return { ok: true, messageId: crypto.randomUUID(), status: "sent" };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to send credit note ${creditNoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async recordPayment(
    businessId: string,
    invoiceId: string,
    data: {
      amount: string | number;
      currency: string;
      provider?: string;
      providerPaymentId?: string | null;
      method?: string | null;
      idempotencyKey?: string | null;
      paidAt?: string | null;
    },
    userId?: string
  ): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM invoices WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [invoiceId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Invoice ${invoiceId} not found`);
      }

      const invoice = existing.rows[0];

      if (data.idempotencyKey) {
        const dupe = await client.query(
          `SELECT p.* FROM payments p WHERE idempotency_key = $1`,
          [data.idempotencyKey]
        );
        if (dupe.rows.length) {
          await client.query("ROLLBACK");
          logger.info(`Payment already recorded (idempotent): ${data.idempotencyKey}`);
          return this.findById(businessId, invoiceId) as any;
        }
      }

      const paymentAmount = new Decimal(data.amount);
      if (paymentAmount.lte(0)) {
        throw new BusinessLogicError("Payment amount must be greater than 0", "INVALID_PAYMENT");
      }

      await client.query(
        `INSERT INTO payments (
          invoice_id, business_id, provider, provider_payment_id,
          amount, currency, status, paid_at, method, idempotency_key
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          invoiceId,
          businessId,
          data.provider ?? "manual",
          data.providerPaymentId ?? null,
          paymentAmount.toFixed(),
          data.currency,
          "succeeded",
          data.paidAt ? new Date(data.paidAt) : new Date(),
          data.method ?? null,
          data.idempotencyKey ?? null,
        ]
      );

      const newAmountPaid = new Decimal(invoice.amount_paid ?? 0).plus(paymentAmount);
      const total = new Decimal(invoice.total ?? 0);
      const amountDue = total.minus(newAmountPaid);

      let newStatus: string;
      if (amountDue.lte(0)) {
        newStatus = "paid";
        await client.query(
          `UPDATE invoices SET amount_paid = $1, amount_due = $2, status = 'paid', paid_at = NOW(), version = version + 1, updated_at = NOW()
           WHERE id = $3 AND business_id = $4`,
          [newAmountPaid.toFixed(), "0", invoiceId, businessId]
        );
      } else if (newAmountPaid.gt(0)) {
        newStatus = "partially_paid";
        await client.query(
          `UPDATE invoices SET amount_paid = $1, amount_due = $2, status = 'partially_paid', version = version + 1, updated_at = NOW()
           WHERE id = $3 AND business_id = $4`,
          [newAmountPaid.toFixed(), amountDue.toFixed(), invoiceId, businessId]
        );
      } else {
        newStatus = invoice.status;
      }

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'payment_recorded', $2, 'user', $3::jsonb)`,
        [invoiceId, userId ?? null, JSON.stringify({ amount: paymentAmount.toFixed(), method: data.method, provider: data.provider })]
      );

      await client.query("COMMIT");

      const updated = await this.findById(businessId, invoiceId);
      logger.info(`Recorded payment of ${paymentAmount.toFixed()} for invoice ${invoiceId}, status → ${newStatus}`);
      return updated!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to record payment for invoice ${invoiceId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async cancel(
    businessId: string,
    invoiceId: string,
    reason: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    return this.transitionStatus(businessId, invoiceId, "cancelled", { reason }, userId);
  }

  async sendReminder(
    businessId: string,
    invoiceId: string,
    data: {
      to?: string;
      cc?: string[];
      bcc?: string[];
      subject?: string;
      message?: string;
    },
    userId?: string
  ): Promise<SendInvoiceResult> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM invoices WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [invoiceId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Invoice ${invoiceId} not found`);
      }

      const invoice = existing.rows[0];
      if (!invoice.is_finalized) {
        throw new BusinessLogicError("Invoice must be finalized before sending a reminder", "NOT_FINALIZED");
      }

      const fullInvoice = await this.findById(businessId, invoiceId);
      if (!fullInvoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);
      const pdf = await this.generatePdf(businessId, invoiceId, fullInvoice);
      const html = await this.renderInvoiceEmail(businessId, invoiceId, fullInvoice as any, data.message, { isReminder: true });

      const idempotencyKey = `invoice-reminder:${invoiceId}:${crypto.randomUUID()}`;
      const recipient = data.to ?? invoice.customer_email ?? "";
      const result = await emailService.sendInvoiceEmail({
        invoiceId,
        businessId,
        recipient: { email: recipient, name: invoice.customer_name ?? undefined },
        subject: data.subject ?? `Payment Reminder: Invoice ${invoice.invoice_number ?? ""} from {{business_name}}`,
        htmlBody: html,
        attachments: [{ filename: `Invoice-${invoice.invoice_number ?? invoiceId}.pdf`, content: pdf }],
        idempotencyKey,
      });

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'reminder_sent', $2, 'user', $3::jsonb)`,
        [invoiceId, userId ?? null, JSON.stringify({ email: recipient, message_id: result.messageId })]
      );

      await client.query("COMMIT");
      logger.info(`Sent reminder for invoice ${invoiceId} to ${recipient}`);
      return { ok: true, success: true, messageId: result.messageId, status: result.status };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to send reminder for invoice ${invoiceId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async duplicate(
    businessId: string,
    invoiceId: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    const existing = await this.findById(businessId, invoiceId);
    if (!existing) throw new NotFoundError(`Invoice ${invoiceId} not found`);

    const source = existing as Record<string, unknown>;

    const dupInput: CreateInvoiceInput = {
      customerId: (source.customer_id as string) ?? null,
      currency: source.currency as string,
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: source.due_date as string | null,
      poNumber: source.po_number as string | null,
      notes: source.notes as string | null,
      terms: source.terms as string | null,
      paymentInstructions: source.payment_instructions as string | null,
      templateId: source.template_id as string | null,
      invoiceDiscount: source.invoice_discount_value as string | undefined,
      invoiceDiscountType: source.invoice_discount_type as "fixed" | "percentage" | undefined,
      shippingDescription: source.shipping_description as string | null | undefined,
      shippingAmount: source.shipping_amount as string | undefined,
      shippingTaxRate: source.shipping_tax_rate as string | undefined,
      items: (source.items as Record<string, unknown>[]).map((item): InvoiceItemInput => ({
        description: item.description as string,
        quantity: item.quantity as string,
        unit: item.unit as string,
        unitPrice: item.unit_price as string,
        discount: item.discount as string,
        discountType: item.discount_type as "fixed" | "percentage" | undefined,
        taxRate: item.tax_rate as string,
        taxName: item.tax_name as string | null,
        isTaxInclusive: Boolean(item.is_tax_inclusive),
        productId: item.product_id as string | null | undefined,
        sortOrder: Number(item.sort_order),
      })),
      fees: (source.fees as Record<string, unknown>[]).map((fee): InvoiceFeeInput => ({
        description: fee.description as string,
        amount: fee.amount as string,
        taxRate: fee.tax_rate as string | undefined,
        taxName: fee.tax_name as string | null,
        sortOrder: Number(fee.sort_order),
      })),
    };

    const dup = await this.create(businessId, dupInput, userId);
    logger.info(`Duplicated invoice ${invoiceId} for business ${businessId}`);
    return dup;
  }

  async void(
    businessId: string,
    invoiceId: string,
    reason: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    const invoice = await this.findById(businessId, invoiceId);
    if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);
    if (TERMINAL_STATUSES.has(invoice.status as string)) {
      throw new BusinessLogicError(
        `Cannot void invoice in ${invoice.status} status`,
        "INVALID_STATE"
      );
    }

    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE invoices SET
          status = 'void',
          amount_due = 0,
          cancelled_at = NOW(),
          cancelled_reason = $1,
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [reason, invoiceId, businessId]
      );

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'voided', $2, 'user', $3::jsonb)`,
        [invoiceId, userId ?? null, JSON.stringify({ reason })]
      );

      await client.query("COMMIT");
      const updated = await this.findById(businessId, invoiceId);
      logger.info(`Voided invoice ${invoiceId}: ${reason}`);
      return updated!;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  private async transitionStatus(
    businessId: string,
    invoiceId: string,
    nextStatus: string,
    metadata: Record<string, unknown> = {},
    userId?: string
  ): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM invoices WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [invoiceId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Invoice ${invoiceId} not found`);
      }

      const invoice = existing.rows[0];
      if (!canTransition(invoice.status, nextStatus)) {
        throw new BusinessLogicError(
          `Cannot transition invoice from ${invoice.status} to ${nextStatus}`,
          "INVALID_STATE",
          { from: invoice.status, to: nextStatus }
        );
      }

      const updateFields: string[] = ["status = $3", "version = version + 1", "updated_at = NOW()"];
      const updateValues: unknown[] = [businessId, invoiceId, nextStatus];

      if (nextStatus === "cancelled") {
        updateFields.splice(0, 1, "status = $3", "cancelled_at = NOW()", `cancelled_reason = $${updateValues.length + 1}`);
        updateValues.push(metadata.reason);
      }

      await client.query(
        `UPDATE invoices SET ${updateFields.join(", ")} WHERE id = $2 AND business_id = $1`,
        updateValues
      );

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, $3, 'user', $4::jsonb)`,
        [invoiceId, nextStatus === "cancelled" ? "cancelled" : nextStatus, userId ?? null, JSON.stringify(metadata)]
      );

      await client.query("COMMIT");
      const updated = await this.findById(businessId, invoiceId);
      logger.info(`Invoice ${invoiceId} status → ${nextStatus}`);
      return updated!;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async findById(businessId: string, invoiceId: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT i.*,
              i.subtotal as "subtotal",
              i.discount_total as "discount_total",
              i.tax_total as "tax_total",
              i.fee_total as "fee_total",
              i.total as "total",
              i.amount_paid as "amount_paid",
              i.amount_due as "amount_due"
       FROM invoices i
       WHERE i.id = $1 AND i.business_id = $2`,
      [invoiceId, businessId]
    );

    if (!result.rows.length) return null;

    const invoice = result.rows[0] as Record<string, unknown>;
    const itemsRes = await query(
      `SELECT *, discount_type as "discount_type", is_tax_inclusive as "is_tax_inclusive"
       FROM invoice_items
       WHERE invoice_id = $1
       ORDER BY sort_order, created_at`,
      [invoiceId]
    );
    const feesRes = await query(
      `SELECT * FROM invoice_fees WHERE invoice_id = $1 ORDER BY sort_order`,
      [invoiceId]
    );
    const paymentsRes = await query(
      `SELECT id, amount, currency, status, method, provider, provider_payment_id, paid_at, created_at
       FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC`,
      [invoiceId]
    );
    const eventsRes = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM invoice_events WHERE invoice_id = $1 ORDER BY created_at ASC`,
      [invoiceId]
    );

    const effectiveStatus = computeEffectiveStatus(
      invoice.status as string,
      invoice.due_date as string,
      invoice.amount_due as string
    );

    return {
      ...invoice,
      status: effectiveStatus,
      items: itemsRes.rows,
      fees: feesRes.rows,
      payments: paymentsRes.rows,
      events: eventsRes.rows,
    };
  }

  async findByPublicToken(token: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT i.*,
              i.subtotal as "subtotal",
              i.discount_total as "discount_total",
              i.tax_total as "tax_total",
              i.fee_total as "fee_total",
              i.total as "total",
              i.amount_paid as "amount_paid",
              i.amount_due as "amount_due",
              b.name as "business_name",
              b.address as "business_address",
              b.country_code as "business_country_code",
              b.default_currency as "business_currency"
       FROM invoices i
       LEFT JOIN businesses b ON b.id = i.business_id
       WHERE i.public_token = $1 AND i.public_token_expires_at > NOW()`,
      [token]
    );

    if (!result.rows.length) return null;

    const invoice = result.rows[0] as Record<string, unknown>;
    const business = {
      id: invoice.business_id,
      name: invoice.business_name,
      address: invoice.business_address,
      countryCode: invoice.business_country_code,
      defaultCurrency: invoice.business_currency,
    };

    const itemsRes = await query(
      `SELECT * FROM invoice_items
       WHERE invoice_id = $1 ORDER BY sort_order`,
      [invoice.id]
    );
    const feesRes = await query(
      `SELECT * FROM invoice_fees WHERE invoice_id = $1 ORDER BY sort_order`,
      [invoice.id]
    );

    return {
      ...invoice,
      business,
      items: itemsRes.rows,
      fees: feesRes.rows,
      payments: [],
      events: [],
    };
  }

  async getInvoiceEvents(businessId: string, invoiceId: string): Promise<Record<string, unknown>[]> {
    await this.findById(businessId, invoiceId);
    const result = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM invoice_events WHERE invoice_id = $1 ORDER BY created_at ASC`,
      [invoiceId]
    );
    return result.rows;
  }

  async findMany(businessId: string, filters: Record<string, unknown>): Promise<{
    invoices: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(Math.max(Number(filters.limit ?? 50), 1), 200);
    const offset = Math.max(Number(filters.offset ?? 0), 0);

    const where: string[] = ["business_id = $1"];
    const values: unknown[] = [businessId];
    let i = 2;

    if (filters.status) {
      where.push(`status = $${i++}`);
      values.push(filters.status);
    }
    if (filters.search) {
      const search = `%${filters.search}%`;
      where.push(`(invoice_number ILIKE $${i} OR customer_name ILIKE $${i} OR customer_email ILIKE $${i})`);
      values.push(search, search, search);
      i++;
    }
    if (filters.customerId) {
      where.push(`customer_id = $${i++}`);
      values.push(filters.customerId);
    }
    if (filters.dateFrom) {
      where.push(`created_at >= $${i++}`);
      values.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.push(`created_at <= $${i++}`);
      values.push(filters.dateTo);
    }

    const sortBy = filters.sortBy as string ?? "created_at";
    const sortOrder = (filters.sortOrder as string) ?? "desc";

    const listRes = await query(
      `SELECT id, invoice_number, status, customer_id, customer_name, customer_email,
              issue_date, due_date, currency, total, amount_paid, amount_due,
              is_finalized, finalized_at, sent_at, viewed_at, paid_at,
              created_at, updated_at, version
       FROM invoices
       WHERE ${where.join(" AND ")}
       ORDER BY ${sortBy} ${sortOrder === "asc" ? "ASC" : "DESC"}
       LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM invoices WHERE ${where.join(" AND ")}`,
      values
    );

    const now = new Date();
    const invoices = listRes.rows.map((row: Record<string, unknown>) => {
      const amountDue = new Decimal(row.amount_due as string);
      let effectiveStatus = row.status as string;
      if (!TERMINAL_STATUSES.has(effectiveStatus)) {
        const dueDate = row.due_date as string;
        if (dueDate && new Date(dueDate) < now && amountDue.gt(0)) {
          effectiveStatus = "overdue";
        }
      }
      return { ...row, status: effectiveStatus };
    });

    return {
      invoices,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  private async buildCalculationInput(
    businessId: string,
    invoiceId: string,
    currency: string
  ): Promise<InvoiceCalculationInput> {
    const itemsRes = await query(
      `SELECT description, quantity, unit, unit_price, discount, discount_type,
              tax_rate, tax_name, is_tax_inclusive, sort_order
       FROM invoice_items
       WHERE invoice_id = $1 ORDER BY sort_order`,
      [invoiceId]
    );
    const feesRes = await query(
      `SELECT description, amount, tax_rate, tax_name, sort_order
       FROM invoice_fees WHERE invoice_id = $1 ORDER BY sort_order`,
      [invoiceId]
    );

    const lineItems: LineItemInput[] = itemsRes.rows.map((row: Record<string, unknown>) => ({
      description: row.description as string,
      quantity: new Decimal(row.quantity as string),
      unit: row.unit as string,
      unitPrice: new Decimal(row.unit_price as string),
      discount: Number(row.discount) > 0
        ? { type: row.discount_type as "fixed" | "percentage", value: new Decimal(row.discount as string) }
        : undefined,
      taxRate: new Decimal(row.tax_rate as string),
      tax_name: row.tax_name as string | null | undefined,
      isTaxInclusive: Boolean(row.is_tax_inclusive),
      sortOrder: Number(row.sort_order),
    }));

    const fees: FeeInput[] = feesRes.rows.map((row: Record<string, unknown>) => ({
      description: row.description as string,
      amount: new Decimal(row.amount as string),
      taxRate: new Decimal(row.tax_rate as string),
      tax_name: row.tax_name as string | null | undefined,
      sortOrder: Number(row.sort_order),
    }));

    const invoiceRes = await query(
      `SELECT invoice_discount_value, invoice_discount_type, amount_paid
       FROM invoices WHERE id = $1 AND business_id = $2`,
      [invoiceId, businessId]
    );

    const inv = invoiceRes.rows[0];
    const discountValue = new Decimal(inv?.invoice_discount_value ?? 0);
    const invoiceDiscount: DiscountDefinition | undefined = discountValue.gt(0)
      ? { type: (inv?.invoice_discount_type ?? "fixed") as "fixed" | "percentage", value: discountValue }
      : undefined;

    return {
      currency: currency as CurrencyCode,
      lineItems,
      fees: fees.length > 0 ? fees : undefined,
      invoiceDiscount,
      amountPaid: inv ? new Decimal(inv.amount_paid ?? 0) : undefined,
    };
  }

  private async buildSnapshot(businessId: string, invoiceId: string): Promise<Record<string, unknown>> {
    const invoice = await this.findById(businessId, invoiceId);
    if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);
    return {
      id: invoice.id,
      business_id: invoice.business_id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      customer_id: invoice.customer_id,
      customer_name: invoice.customer_name,
      customer_email: invoice.customer_email,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      discount_total: invoice.discount_total,
      tax_total: invoice.tax_total,
      fee_total: invoice.fee_total,
      total: invoice.total,
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
      items: invoice.items,
      fees: invoice.fees,
      created_at: invoice.created_at,
      finalized_at: invoice.finalized_at,
      version: invoice.version,
    };
  }

  private async buildCreditNoteSnapshot(businessId: string, creditNoteId: string): Promise<Record<string, unknown>> {
    const cn = await this.getCreditNoteById(businessId, creditNoteId);
    if (!cn) throw new NotFoundError(`Credit note ${creditNoteId} not found`);
    return {
      id: cn.id,
      business_id: cn.business_id,
      credit_note_number: cn.credit_note_number,
      status: cn.status,
      customer_id: cn.customer_id,
      reference_invoice_id: cn.reference_invoice_id,
      issue_date: cn.issue_date,
      currency: cn.currency,
      reason: cn.reason,
      notes: cn.notes,
      terms: cn.terms,
      subtotal: cn.subtotal,
      discount_total: cn.discount_total,
      tax_total: cn.tax_total,
      fee_total: cn.fee_total,
      total: cn.total,
      applied_total: cn.applied_total,
      amount_due: cn.amount_due,
      items: cn.items,
      fees: cn.fees,
      applications: cn.applications,
      created_at: cn.created_at,
      finalized_at: cn.finalized_at,
      version: cn.version,
    };
  }

  async generatePdf(
    businessId: string,
    invoiceId: string,
    invoice: Record<string, unknown>
  ): Promise<Buffer> {
    const cached = await query(
      `SELECT pdf_stored, pdf_hash FROM invoice_snapshots WHERE invoice_id = $1`,
      [invoiceId]
    );

    if (cached.rows.length && cached.rows[0].pdf_stored) {
      return Buffer.from(`Cached PDF placeholder for invoice ${invoiceId}`);
    }

    const business = await this.fetchBusiness(businessId);
    const customer = invoice.customer_id
      ? await this.fetchCustomer(businessId, invoice.customer_id as string)
      : null;

    // Derive payment terms from customer
    const paymentTerms = customer?.paymentTerms ? `Net ${customer.paymentTerms}` : undefined;

    // Build payment instructions if available
    const paymentInstructions: TemplatePaymentInstructions | null = invoice.payment_instructions
      ? {
          methods: [],
          bankDetails: null,
          paymentLink: null,
          lateFeeType: invoice.late_fee_type as "none" | "fixed" | "percentage" | null,
          lateFeeValue: invoice.late_fee_value?.toString() ?? null,
          lateFeePeriodDays: null, // Not stored on invoice, could be added later
          taxExemption: null,
          deliveryDetails: null,
          warrantyInfo: null,
          returnPolicy: null,
          customFields: [],
        }
      : null;

    const data = buildTemplateData(
      {
        id: invoice.id as string,
        invoiceNumber: invoice.invoice_number as string | null,
        status: invoice.status as string,
        issueDate: invoice.issue_date ? new Date(invoice.issue_date as string) : null,
        dueDate: invoice.due_date ? new Date(invoice.due_date as string) : null,
        currency: invoice.currency as CurrencyCode,
        poNumber: invoice.po_number as string | null | undefined,
        notes: invoice.notes as string | null | undefined,
        terms: invoice.terms as string | null | undefined,
        paymentInstructions: invoice.payment_instructions as string | null | undefined,
        language: undefined,
        title: undefined,
        depositType: invoice.deposit_type as "none" | "fixed" | "percentage" | string | null | undefined,
        depositValue: null,
        depositDueDate: invoice.deposit_due_date as string | null | undefined,
        depositPaid: invoice.deposit_paid as boolean | null | undefined,
        isFinalized: true,
        depositAmount: invoice.deposit_amount?.toString() ?? null,
        projectId: invoice.project_id as string | null | undefined,
        projectName: null,
        paymentTerms,
      },
      business,
      customer,
      (invoice.items as Record<string, unknown>[]).map((item): TemplateLineItem => ({
        description: item.description as string,
        quantity: new Decimal(item.quantity as string),
        unit: item.unit as string,
        unitPrice: new Decimal(item.unit_price as string),
        discount: new Decimal(item.discount as string),
        taxRate: new Decimal(item.tax_rate as string),
        taxName: item.tax_name as string | null | undefined,
        taxAmount: new Decimal(item.tax_amount as string),
        lineSubtotal: new Decimal(item.line_subtotal as string),
        lineTotal: new Decimal(item.line_total as string),
        isTaxInclusive: Boolean(item.is_tax_inclusive),
        catalogName: item.catalog_name as string | null | undefined,
        catalogSku: item.catalog_sku as string | null | undefined,
        catalogTaxCategory: item.catalog_tax_category as string | null | undefined,
        catalogUnitPrice: item.catalog_unit_price as string | null | undefined,
        catalogTaxRate: item.catalog_tax_rate as string | null | undefined,
      })),
      (invoice.fees as Record<string, unknown>[]).map((fee): TemplateFee => ({
        description: fee.description as string,
        amount: new Decimal(fee.amount as string),
        taxRate: new Decimal(fee.tax_rate as string),
        taxName: fee.tax_name as string | null | undefined,
        taxAmount: new Decimal(fee.tax_amount as string),
      })),
      {
        subtotal: new Decimal(invoice.subtotal as string),
        discountTotal: new Decimal(invoice.discount_total as string),
        taxTotal: new Decimal(invoice.tax_total as string),
        feeTotal: new Decimal(invoice.fee_total as string),
        total: new Decimal(invoice.total as string),
        amountPaid: new Decimal(invoice.amount_paid as string),
        amountDue: new Decimal(invoice.amount_due as string),
        taxByRate: computeTaxBreakdown(
          (invoice.items as Record<string, unknown>[]).map((item): CalculatedLineItem => ({
            description: item.description as string,
            quantity: new Decimal(item.quantity as string),
            unit: item.unit as string,
            unitPrice: new Decimal(item.unit_price as string),
            discountAmount: new Decimal(item.discount as string),
            taxRate: new Decimal(item.tax_rate as string),
            taxName: item.tax_name as string | null | undefined,
            isTaxInclusive: Boolean(item.is_tax_inclusive),
            lineSubtotal: new Decimal(item.line_subtotal as string),
            taxableAmount: new Decimal(item.line_subtotal as string),
            taxAmount: new Decimal(item.tax_amount as string),
            lineTotal: new Decimal(item.line_total as string),
          })),
          (invoice.fees as Record<string, unknown>[]).map((fee): CalculatedFee => ({
            description: fee.description as string,
            amount: new Decimal(fee.amount as string),
            taxRate: new Decimal(fee.tax_rate as string),
            taxName: fee.tax_name as string | null | undefined,
            taxAmount: new Decimal(fee.tax_amount as string),
            feeTotal: new Decimal(fee.amount as string),
          })),
          getCurrencyMetadata(invoice.currency as CurrencyCode).decimalPlaces
        ),
      },
      paymentInstructions,
      {
        htmlTemplate: await this.getInvoiceTemplateHtml(businessId, invoice.template_id as string | null),
      }
    );

    const html = await templateRenderer.render(data);
    const pdf = await pdfService.generatePdfFromHtml(html, data);

    await query(
      `UPDATE invoice_snapshots SET pdf_stored = TRUE, pdf_hash = $1 WHERE invoice_id = $2`,
      [crypto.createHash("sha256").update(pdf).digest("hex"), invoiceId]
    );

    return pdf;
  }

  async generateCreditNotePdf(
    businessId: string,
    creditNoteId: string,
    creditNote: Record<string, unknown>
  ): Promise<Buffer> {
    const cached = await query(
      `SELECT pdf_stored, pdf_hash FROM credit_note_snapshots WHERE credit_note_id = $1`,
      [creditNoteId]
    );

    if (cached.rows.length && cached.rows[0].pdf_stored) {
      return Buffer.from(`Cached PDF placeholder for credit note ${creditNoteId}`);
    }

    const business = await this.fetchBusiness(businessId);
    const customer = creditNote.customer_id
      ? await this.fetchCustomer(businessId, creditNote.customer_id as string)
      : null;

    const paymentInstructions: TemplatePaymentInstructions | null = creditNote.payment_instructions
      ? {
          methods: [],
          bankDetails: null,
          paymentLink: null,
          lateFeeType: creditNote.late_fee_type as "none" | "fixed" | "percentage" | null,
          lateFeeValue: creditNote.late_fee_value?.toString() ?? null,
          lateFeePeriodDays: null,
          taxExemption: null,
          deliveryDetails: null,
          warrantyInfo: null,
          returnPolicy: null,
          customFields: [],
        }
      : null;

    const refInvoiceRes = await query(
      `SELECT invoice_number FROM invoices WHERE id = $1 AND business_id = $2`,
      [creditNote.reference_invoice_id, businessId]
    );
    const referenceInvoiceNumber = refInvoiceRes.rows.length
      ? refInvoiceRes.rows[0].invoice_number
      : null;

    const appsRes = await query(
      `SELECT ca.invoice_id, i.invoice_number, ca.amount, ca.applied_at
       FROM credit_note_applications ca
       JOIN invoices i ON i.id = ca.invoice_id
       WHERE ca.credit_note_id = $1
       ORDER BY ca.applied_at`,
      [creditNoteId]
    );
    const applications = appsRes.rows.map((row) => ({
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      amount: row.amount,
      appliedAt: row.applied_at,
    }));

    const data = buildCreditNoteData(
      {
        id: creditNote.id as string,
        creditNoteNumber: creditNote.credit_note_number as string | null,
        status: creditNote.status as string,
        issueDate: creditNote.issue_date ? new Date(creditNote.issue_date as string) : null,
        currency: creditNote.currency as CurrencyCode,
        referenceInvoiceNumber: referenceInvoiceNumber,
        referenceInvoiceId: creditNote.reference_invoice_id as string | null,
        reason: creditNote.reason as string | null | undefined,
        notes: creditNote.notes as string | null | undefined,
        terms: creditNote.terms as string | null | undefined,
        language: undefined,
        isFinalized: Boolean(creditNote.is_finalized),
        appliedTotal: creditNote.applied_total?.toString() ?? null,
        amountDue: creditNote.amount_due?.toString() ?? null,
      },
      business,
      customer,
      (creditNote.items as Record<string, unknown>[]).map((item): TemplateLineItem => ({
        description: item.description as string,
        quantity: new Decimal(item.quantity as string),
        unit: item.unit as string,
        unitPrice: new Decimal(item.unit_price as string),
        discount: new Decimal(item.discount as string),
        taxRate: new Decimal(item.tax_rate as string),
        taxName: item.tax_name as string | null | undefined,
        taxAmount: new Decimal(item.tax_amount as string),
        lineSubtotal: new Decimal(item.line_subtotal as string),
        lineTotal: new Decimal(item.line_total as string),
        isTaxInclusive: Boolean(item.is_tax_inclusive),
        catalogName: item.catalog_name as string | null | undefined,
        catalogSku: item.catalog_sku as string | null | undefined,
        catalogTaxCategory: item.catalog_tax_category as string | null | undefined,
        catalogUnitPrice: item.catalog_unit_price as string | null | undefined,
        catalogTaxRate: item.catalog_tax_rate as string | null | undefined,
      })),
      (creditNote.fees as Record<string, unknown>[]).map((fee): TemplateFee => ({
        description: fee.description as string,
        amount: new Decimal(fee.amount as string),
        taxRate: new Decimal(fee.tax_rate as string),
        taxName: fee.tax_name as string | null | undefined,
        taxAmount: new Decimal(fee.tax_amount as string),
      })),
      {
        subtotal: new Decimal(creditNote.subtotal as string),
        discountTotal: new Decimal(creditNote.discount_total as string),
        taxTotal: new Decimal(creditNote.tax_total as string),
        feeTotal: new Decimal(creditNote.fee_total as string),
        total: new Decimal(creditNote.total as string),
        amountPaid: new Decimal(0),
        amountDue: new Decimal(creditNote.amount_due as string),
        taxByRate: computeTaxBreakdown(
          (creditNote.items as Record<string, unknown>[]).map((item): CalculatedLineItem => ({
            description: item.description as string,
            quantity: new Decimal(item.quantity as string),
            unit: item.unit as string,
            unitPrice: new Decimal(item.unit_price as string),
            discountAmount: new Decimal(item.discount as string),
            taxRate: new Decimal(item.tax_rate as string),
            taxName: item.tax_name as string | null | undefined,
            isTaxInclusive: Boolean(item.is_tax_inclusive),
            lineSubtotal: new Decimal(item.line_subtotal as string),
            taxableAmount: new Decimal(item.line_subtotal as string),
            taxAmount: new Decimal(item.tax_amount as string),
            lineTotal: new Decimal(item.line_total as string),
          })),
          (creditNote.fees as Record<string, unknown>[]).map((fee): CalculatedFee => ({
            description: fee.description as string,
            amount: new Decimal(fee.amount as string),
            taxRate: new Decimal(fee.tax_rate as string),
            taxName: fee.tax_name as string | null | undefined,
            taxAmount: new Decimal(fee.tax_amount as string),
            feeTotal: new Decimal(fee.amount as string),
          })),
          getCurrencyMetadata(creditNote.currency as CurrencyCode).decimalPlaces
        ),
      },
      applications,
      {
        htmlTemplate: await this.getCreditNoteTemplateHtml(businessId, creditNote.template_id as string | null),
      }
    );

    const html = await templateRenderer.renderCreditNote(data);
    const pdf = await pdfService.generatePdfFromHtml(html, data);

    await query(
      `UPDATE credit_note_snapshots SET pdf_stored = TRUE, pdf_hash = $1 WHERE credit_note_id = $2`,
      [crypto.createHash("sha256").update(pdf).digest("hex"), creditNoteId]
    );

    return pdf;
  }

  private async getCreditNoteTemplateHtml(businessId: string, templateId: string | null): Promise<string> {
    if (templateId) {
      const res = await query(
        `SELECT html_template FROM templates WHERE id = $1 AND business_id = $2`,
        [templateId, businessId]
      );
      if (res.rows.length) {
        return res.rows[0].html_template;
      }
    }

    const settingsRes = await query(
      `SELECT pdf_template_id FROM business_settings WHERE business_id = $1`,
      [businessId]
    );
    if (settingsRes.rows.length && settingsRes.rows[0].pdf_template_id) {
      const res = await query(
        `SELECT html_template FROM templates WHERE id = $1 AND business_id = $2`,
        [settingsRes.rows[0].pdf_template_id, businessId]
      );
      if (res.rows.length) {
        return res.rows[0].html_template;
      }
    }

    return DEFAULT_CREDIT_NOTE_TEMPLATE;
  }

  private async renderInvoiceEmail(
    businessId: string,
    invoiceId: string,
    invoice: Record<string, unknown>,
    customMessage?: string,
    options?: { isReminder?: boolean }
  ): Promise<string> {
    const business = await this.fetchBusiness(businessId);
    const customer = invoice.customer_id
      ? await this.fetchCustomer(businessId, invoice.customer_id as string)
      : null;

    const template = await this.getInvoiceEmailTemplate();
    return template({
      business,
      customer,
      invoice,
      customMessage: customMessage ?? "",
      businessName: business.name as string,
      isReminder: options?.isReminder ?? false,
    });
  }

  private async fetchBusiness(businessId: string): Promise<TemplateBusiness> {
    const res = await query(
      `SELECT id, name, legal_name, email, phone, website, tax_id, registration_number,
              address_line_1, address_line_2, city, state_or_region, postal_code, country_code,
              default_currency, logo_url
       FROM businesses WHERE id = $1`,
      [businessId]
    );
    const r = res.rows[0];
    if (!r) throw new NotFoundError(`Business ${businessId} not found`);
    return {
      id: r.id,
      name: r.name,
      legalName: r.legal_name,
      email: r.email,
      phone: r.phone,
      website: r.website,
      taxId: r.tax_id,
      registrationNumber: r.registration_number,
      address: r.address_line_1 ? {
        addressLine1: r.address_line_1,
        addressLine2: r.address_line_2,
        city: r.city,
        stateOrRegion: r.state_or_region,
        postalCode: r.postal_code,
        countryCode: r.country_code,
      } : { addressLine1: "", addressLine2: null, city: "", stateOrRegion: "", postalCode: "", countryCode: "US" },
      countryCode: r.country_code,
      defaultCurrency: r.default_currency,
      logoUrl: r.logo_url,
    };
  }

  private async fetchCustomer(businessId: string, customerId: string): Promise<TemplateCustomer | null> {
    const res = await query(
      `SELECT id, name, company_name, email, phone, tax_id,
              address_line_1, address_line_2, city, state_or_region, postal_code, country_code,
              default_currency, notes, payment_terms, shipping_address_id
       FROM customers WHERE id = $1`,
      [customerId]
    );
    if (!res.rows.length) return null;
    const r = res.rows[0];
    const customer: TemplateCustomer = {
      id: r.id,
      name: r.name,
      companyName: r.company_name,
      email: r.email,
      phone: r.phone,
      taxId: r.tax_id,
      address: r.address_line_1 ? {
        addressLine1: r.address_line_1,
        addressLine2: r.address_line_2,
        city: r.city,
        stateOrRegion: r.state_or_region,
        postalCode: r.postal_code,
        countryCode: r.country_code,
      } : { addressLine1: "", addressLine2: null, city: "", stateOrRegion: "", postalCode: "", countryCode: "US" },
      countryCode: r.country_code,
      notes: r.notes,
      paymentTerms: r.payment_terms,
    };
    // Fetch shipping address if available
    if (r.shipping_address_id) {
      const addrRes = await query(
        `SELECT address_line_1, address_line_2, city, state_or_region, postal_code, country_code
         FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
        [r.shipping_address_id, customerId]
      );
      if (addrRes.rows.length) {
        const a = addrRes.rows[0];
        customer.shippingAddress = {
          addressLine1: a.address_line_1,
          addressLine2: a.address_line_2,
          city: a.city,
          stateOrRegion: a.state_or_region,
          postalCode: a.postal_code,
          countryCode: a.country_code,
        };
      }
    }
    return customer;
  }

  private async getInvoiceTemplate(businessId: string, templateId: string | null): Promise<Handlebars.TemplateDelegate> {
    const html = await this.getInvoiceTemplateHtml(businessId, templateId);
    return Handlebars.compile(html);
  }

  private async getInvoiceTemplateHtml(businessId: string, templateId: string | null): Promise<string> {
    if (templateId) {
      const res = await query(
        `SELECT html_template FROM templates WHERE id = $1 AND business_id = $2`,
        [templateId, businessId]
      );
      if (res.rows.length) {
        return res.rows[0].html_template;
      }
    }

    const settingsRes = await query(
      `SELECT pdf_template_id FROM business_settings WHERE business_id = $1`,
      [businessId]
    );
    if (settingsRes.rows.length && settingsRes.rows[0].pdf_template_id) {
      const res = await query(
        `SELECT html_template FROM templates WHERE id = $1 AND business_id = $2`,
        [settingsRes.rows[0].pdf_template_id, businessId]
      );
      if (res.rows.length) {
        return res.rows[0].html_template;
      }
    }

    return INVOICE_DEFAULT_TEMPLATE;
  }

  private async getInvoiceEmailTemplate(): Promise<Handlebars.TemplateDelegate> {
    return Handlebars.compile(INVOICE_EMAIL_TEMPLATE);
  }

  async createCreditNote(
    businessId: string,
    input: {
      invoiceId: string;
      reason?: string | null;
      notes?: string | null;
      terms?: string | null;
      items?: Array<{
        description: string;
        quantity: string | number;
        unit: string;
        unitPrice: string | number;
        taxRate?: string | number;
        taxName?: string | null;
        isTaxInclusive?: boolean;
      }>;
    },
    userId?: string
  ): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const refInvoice = await client.query(
        `SELECT id, customer_id, invoice_number, currency FROM invoices WHERE id = $1 AND business_id = $2`,
        [input.invoiceId, businessId]
      );
      if (!refInvoice.rows.length) {
        throw new NotFoundError(`Reference invoice ${input.invoiceId} not found`);
      }

      const items = input.items ?? [];
      const lineItems: CalcInputItem[] = items.map((item, idx) => ({
        description: item.description,
        quantity: new Decimal(item.quantity),
        unit: item.unit ?? "each",
        unitPrice: new Decimal(item.unitPrice),
        taxRate: new Decimal(item.taxRate ?? 0),
        tax_name: item.taxName ?? null,
        isTaxInclusive: item.isTaxInclusive ?? false,
        sortOrder: idx,
      }));

      const calcResult = calculationEngine.calculate({
        currency: refInvoice.rows[0].currency as CurrencyCode,
        lineItems: lineItems as any,
        fees: [],
        invoiceDiscount: undefined,
        amountPaid: undefined,
      });

      const creditNoteNumber = await creditNoteNumberService.generate(businessId);
      const issueDate = new Date();

      const res = await client.query(
        `INSERT INTO credit_notes (
          business_id, customer_id, reference_invoice_id, credit_note_number, reason, notes, terms,
          currency, issue_date, subtotal, discount_total, tax_total, fee_total, total,
          applied_total, amount_due, is_finalized, finalized_at, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE,NOW(),'finalized')
        RETURNING *`,
        [
          businessId,
          refInvoice.rows[0].customer_id,
          input.invoiceId,
          creditNoteNumber,
          input.reason ?? null,
          input.notes ?? null,
          input.terms ?? null,
          refInvoice.rows[0].currency,
          issueDate.toISOString().split("T")[0],
          calcResult.subtotal.toFixed(),
          calcResult.discountTotal.toFixed(),
          calcResult.taxTotal.toFixed(),
          calcResult.feeTotal.toFixed(),
          calcResult.total.toFixed(),
          "0",
          calcResult.total.toFixed(),
        ]
      );

      const cnId = res.rows[0].id;

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const calcItem = calcResult.lineItems[idx];
        await client.query(
          `INSERT INTO credit_note_items (
            credit_note_id, product_id, description, quantity, unit, unit_price,
            discount, discount_type, tax_rate, tax_name, tax_amount,
            line_subtotal, line_total, sort_order, is_tax_inclusive
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            cnId, null, item.description, item.quantity, item.unit ?? "each",
            item.unitPrice, 0, "fixed", item.taxRate ?? 0, item.taxName ?? null,
            calcItem?.taxAmount.toFixed() ?? "0",
            calcItem?.lineSubtotal.toFixed() ?? "0",
            calcItem?.lineTotal.toFixed() ?? "0",
            idx, item.isTaxInclusive ?? false,
          ]
        );
      }

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'credit_note_applied', $2, 'user', $3::jsonb)`,
        [input.invoiceId, userId ?? null, JSON.stringify({ credit_note_id: cnId })]
      );

      const cnSnapshot = await this.buildCreditNoteSnapshot(businessId, cnId);
      const cnSnapshotJson = JSON.stringify(cnSnapshot);
      const cnSnapshotHash = crypto.createHash("sha256").update(cnSnapshotJson).digest("hex");
      await client.query(
        `INSERT INTO credit_note_snapshots (credit_note_id, snapshot, snapshot_hash, pdf_stored, pdf_hash, created_by, created_at)
         VALUES ($1, $2::jsonb, $3, FALSE, NULL, $4, NOW())
         ON CONFLICT (credit_note_id) DO UPDATE SET
           snapshot = $2::jsonb, snapshot_hash = $3, created_by = $4, created_at = NOW()`,
        [cnId, cnSnapshotJson, cnSnapshotHash, userId ?? null]
      );

      await client.query("COMMIT");
      logger.info(`Created credit note ${res.rows[0].credit_note_number} for invoice ${input.invoiceId}`);
      return res.rows[0];
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async getCreditNoteById(businessId: string, creditNoteId: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT * FROM credit_notes WHERE id = $1 AND business_id = $2`,
      [creditNoteId, businessId]
    );
    if (!result.rows.length) return null;
    const cn = result.rows[0] as Record<string, unknown>;

    const itemsRes = await query(
      `SELECT * FROM credit_note_items WHERE credit_note_id = $1 ORDER BY sort_order`,
      [creditNoteId]
    );
    const feesRes = await query(
      `SELECT * FROM credit_note_fees WHERE credit_note_id = $1 ORDER BY sort_order`,
      [creditNoteId]
    );
    const appsRes = await query(
      `SELECT * FROM credit_note_applications WHERE credit_note_id = $1 ORDER BY created_at`,
      [creditNoteId]
    );

    return {
      ...cn,
      items: itemsRes.rows,
      fees: feesRes.rows,
      applications: appsRes.rows,
    };
  }

  async listCreditNotes(
    businessId: string,
    filters: { invoiceId?: string; limit?: string | number; offset?: string | number }
  ): Promise<{ creditNotes: Record<string, unknown>[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(Math.max(Number(filters.limit ?? 50), 1), 200);
    const offset = Math.max(Number(filters.offset ?? 0), 0);
    const values: unknown[] = [businessId];
    const where: string[] = ["business_id = $1"];
    let i = 2;

    if (filters.invoiceId) {
      where.push(`reference_invoice_id = $${i++}`);
      values.push(filters.invoiceId);
    }

    const listRes = await query(
      `SELECT * FROM credit_notes WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );
    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM credit_notes WHERE ${where.join(" AND ")}`,
      values
    );

    const applications = await query(
      `SELECT credit_note_id, amount FROM credit_note_applications WHERE credit_note_id = ANY($1)`,
      [listRes.rows.map((r: Record<string, unknown>) => r.id)]
    );

    return {
      creditNotes: listRes.rows.map((cn: Record<string, unknown>) => {
        const applied = applications.rows
          .filter((a: Record<string, unknown>) => a.credit_note_id === cn.id)
          .reduce((sum: Decimal, a: Record<string, unknown>) => sum.plus(new Decimal(a.amount as string)), new Decimal(0));
        return { ...cn, applied_amount: applied.toFixed() };
      }),
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  async applyCreditNote(
    businessId: string,
    creditNoteId: string,
    data: { invoiceId: string; amount: string | number }
  ): Promise<{ ok: boolean; remaining: string }> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const cnRes = await client.query(
        `SELECT * FROM credit_notes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [creditNoteId, businessId]
      );
      if (!cnRes.rows.length) {
        throw new NotFoundError(`Credit note ${creditNoteId} not found`);
      }
      const cn = cnRes.rows[0];

      if (cn.status !== "finalized" && cn.status !== "sent") {
        throw new BusinessLogicError(
          `Cannot apply credit note in ${cn.status} status`,
          "INVALID_STATE"
        );
      }

      const invRes = await client.query(
        `SELECT * FROM invoices WHERE id = $1 AND business_id = $2 AND customer_id = $3 FOR UPDATE`,
        [data.invoiceId, businessId, cn.customer_id]
      );
      if (!invRes.rows.length) {
        throw new NotFoundError(`Invoice ${data.invoiceId} not found or customer mismatch`);
      }
      const invoice = invRes.rows[0];

      const cnTotal = new Decimal(cn.total);
      const appliedSoFar = new Decimal(cn.applied_total ?? 0);
      const alreadyApplied = appliedSoFar;
      const amountToApply = new Decimal(data.amount);

      if (amountToApply.lte(0)) {
        throw new BusinessLogicError("Application amount must be greater than 0", "INVALID_AMOUNT");
      }

      const remainingCredit = cnTotal.minus(alreadyApplied);
      if (amountToApply.gt(remainingCredit)) {
        throw new BusinessLogicError(
          `Cannot apply more than the remaining credit (${remainingCredit.toFixed()})`,
          "EXCEEDS_CREDIT"
        );
      }

      const invoiceAmountDue = new Decimal(invoice.amount_due ?? 0);
      const applyAmount = amountToApply.gt(invoiceAmountDue) ? invoiceAmountDue : amountToApply;

      await client.query(
        `INSERT INTO credit_note_applications (credit_note_id, invoice_id, business_id, amount, idempotency_key)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [creditNoteId, data.invoiceId, businessId, applyAmount.toFixed(), crypto.randomUUID()]
      );

      const newAppliedTotal = alreadyApplied.plus(applyAmount);
      await client.query(
        `UPDATE credit_notes SET
          applied_total = $1,
          amount_due = GREATEST(total - $1, 0),
          status = CASE
            WHEN $1 >= total THEN 'applied'
            WHEN $1 > 0 THEN 'partially_applied'
            ELSE status
          END,
          updated_at = NOW()
         WHERE id = $2`,
        [newAppliedTotal.toFixed(), creditNoteId]
      );

      const newAmountDue = invoiceAmountDue.minus(applyAmount);
      const newAmountPaid = invoiceAmountDue.minus(newAmountDue);
      await client.query(
        `UPDATE invoices SET
          amount_due = $1,
          amount_paid = $2,
          status = CASE
            WHEN $1 <= 0 THEN 'paid'
            WHEN amount_paid > 0 THEN 'partially_paid'
            ELSE status
          END,
          version = version + 1,
          updated_at = NOW()
         WHERE id = $3`,
        [newAmountDue.toFixed(), newAmountPaid.toFixed(), data.invoiceId]
      );

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'credit_note_applied', $2, 'user', $3::jsonb)`,
        [data.invoiceId, null, JSON.stringify({ credit_note_id: creditNoteId, amount: applyAmount.toFixed() })]
      );

      await client.query("COMMIT");
      logger.info(`Applied credit note ${creditNoteId} (${applyAmount.toFixed()}) to invoice ${data.invoiceId}`);
      return { ok: true, remaining: newAmountDue.toFixed() };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}

interface CalcInputItem {
  description: string;
  quantity: Decimal;
  unit: string;
  unitPrice: Decimal;
  taxRate: Decimal;
  tax_name?: string | null;
  isTaxInclusive: boolean;
  sortOrder: number;
}

const INVOICE_DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice {{invoice.invoiceNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 48px; color: #222; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .logo { max-height: 60px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    th { color: #666; font-weight: 600; }
    td.amount { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 16px; }
    .totals td { font-weight: 600; }
    .big-total { font-size: 20px; }
    .badge { display:inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-sent { background: #dbeafe; color: #1e40af; }
    .status-paid { background: #dcfce7; color: #15803d; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0 0 4px;">Invoice</h1>
      <h2 style="margin:0; font-size: 22px;">{{invoice.invoiceNumber}}</h2>
    </div>
    <div style="text-align:right">
      <h2 style="margin:0">{{business.name}}</h2>
      <p class="muted">{{business.email}}</p>
      <p class="muted">{{business.phone}}</p>
    </div>
  </div>

  {{#if customer}}
  <table style="margin-bottom: 0;">
    <tr><td><span class="muted">Billed to</span></td>
        <td>{{customer.name}}{{#if customer.companyName}} ({{customer.companyName}}){{/if}}</td></tr>
    <tr><td></td><td>{{customer.email}}</td></tr>
    {{#if customer.addressLine1}}
    <tr><td></td><td>{{customer.addressLine1}}</td></tr>
    {{/if}}
    {{#if customer.addressLine2}}
    <tr><td></td><td>{{customer.addressLine2}}</td></tr>
    {{/if}}
    <tr><td></td><td>{{customer.city}}{{#if customer.stateOrRegion}}, {{customer.stateOrRegion}}{{/if}} {{customer.postalCode}}</td></tr>
  </table>
  {{/if}}

  <table>
    <tr>
      <th>#</th><th>Description</th><th style="text-align:right">Qty</th>
      <th style="text-align:right">Rate</th><th style="text-align:right">Tax</th>
      <th style="text-align:right">Amount</th>
    </tr>
    {{#each lineItems}}
    <tr>
      <td>{{@index}}</td><td>{{description}}</td>
      <td class="amount">{{quantity}}</td>
      <td class="amount">{{formatMoney unitPrice}}</td>
      <td class="amount">{{formatRate taxRate}}</td>
      <td class="amount">{{formatMoney lineTotal}}</td>
    </tr>
    {{/each}}
  </table>

  <div class="totals">
    <table style="max-width:320px; margin-left:auto">
      <tr><td>Subtotal</td><td class="amount">{{formatMoney totals.subtotal}}</td></tr>
      {{#if (gt totals.discountTotal 0)}}
      <tr><td>Discount</td><td class="amount">−{{formatMoney totals.discountTotal}}</td></tr>
      {{/if}}
      <tr><td>Tax</td><td class="amount">{{formatMoney totals.taxTotal}}</td></tr>
      {{#if (gt totals.feeTotal 0)}}
      <tr><td>Fees</td><td class="amount">{{formatMoney totals.feeTotal}}</td></tr>
      {{/if}}
      <tr class="big-total"><td>Total</td><td class="amount">{{formatMoney totals.total}}</td></tr>
      {{#if (gt totals.amountPaid 0)}}
      <tr><td>Paid</td><td class="amount">−{{formatMoney totals.amountPaid}}</td></tr>
      {{/if}}
      <tr class="big-total" style="border-top:2px solid #e0e0e0">
        <td>Balance Due</td><td class="amount">{{formatMoney totals.amountDue}}</td>
      </tr>
    </table>
  </div>

  {{#if invoice.notes}}
  <p class="muted">{{invoice.notes}}</p>
  {{/if}}
  {{#if invoice.terms}}
  <p class="muted">{{invoice.terms}}</p>
  {{/if}}
</body>
</html>`;

const INVOICE_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{subject}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; background: #f8fafc; color: #333; }
    .container { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .button { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; }
    .muted { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <h1 style="margin:0 0 16px;">{{businessName}}</h1>
    <p>You have received invoice <strong>{{invoice.invoiceNumber}}</strong> for {{formatMoney totals.total}} {{invoice.currency}}.</p>
    {{#if customMessage}}
    <p>{{customMessage}}</p>
    {{/if}}
    <p style="text-align:center; margin: 24px 0;">
      <a href="#" class="button">View Invoice</a>
    </p>
    <p class="muted">This invoice is attached as a PDF. Thank you for your business.</p>
  </div>
</body>
</html>`;

Handlebars.registerHelper("formatMoney", function (v: Decimal.Value, currency?: string): string {
  const cur = currency ?? "USD";
  return new Decimal(v ?? 0).times(new Decimal(1)).toFixed(2);
});

Handlebars.registerHelper("formatRate", function (v: Decimal.Value): string {
  return `${new Decimal(v ?? 0).mul(100).toFixed(2)}%`;
});

Handlebars.registerHelper("gt", function (a: unknown, b: number): boolean {
  return new Decimal(a as string).gt(b);
});

Handlebars.registerHelper("sub", function (a: Decimal.Value, b: Decimal.Value): Decimal {
  return new Decimal(a).minus(new Decimal(b));
});

export const invoiceService = new InvoiceService();
