import { Decimal } from "decimal.js";
import { calculationEngine, type InvoiceCalculationInput, type LineItemInput, type FeeInput, type DiscountDefinition } from "../domain/calculation.js";
import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, BusinessLogicError, ConflictError } from "../domain/errors.js";
import { quoteNumberService } from "../services/quote-number-service.js";
import { invoiceNumberService } from "../services/invoice-number-service.js";
import { pdfService } from "../services/pdf/pdf-service.js";
import { emailService, type EmailRecipient } from "../services/email/email-service.js";
import { buildTemplateData, type TemplateLineItem, type TemplateFee, DEFAULT_QUOTE_TEMPLATE, templateRenderer } from "../services/templates/template-renderer.js";
import Handlebars from "handlebars";
import crypto from "node:crypto";
import { type CurrencyCode } from "../domain/value-objects/currency.js";

export interface QuoteItemInput {
  description: string;
  quantity: string | number;
  unit: string;
  unitPrice: string | number;
  discount?: string | number;
  discountType?: "fixed" | "percentage";
  taxRate: string | number;
  taxName?: string | null;
  isTaxInclusive?: boolean;
  isOptional?: boolean;
  productId?: string | null;
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
  sortOrder?: number;
}

export interface QuoteFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  taxName?: string | null;
  isTaxInclusive?: boolean;
  sortOrder?: number;
}

export interface CreateQuoteInput {
  customerId?: string | null;
  currency: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  terms?: string | null;
  notes?: string | null;
  scopeOfWork?: string | null;
  internalNotes?: string | null;
  paymentInstructions?: string | null;
  templateId?: string | null;
  depositType?: "none" | "percentage" | "fixed";
  depositValue?: string | number;
  depositDueDate?: string | null;
  items: QuoteItemInput[];
  fees?: QuoteFeeInput[];
  quoteDiscount?: string | number;
  quoteDiscountType?: "fixed" | "percentage";
}

export interface UpdateQuoteInput extends Partial<CreateQuoteInput> {
  version?: number;
}

export interface FinalizeQuoteResult {
  quote: Record<string, unknown>;
  quoteNumber: string;
  status: string;
}

export interface SendQuoteResult {
  ok: boolean;
  messageId: string;
  status: string;
  quote: Record<string, unknown>;
}

export const QUOTE_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["viewed", "accepted", "rejected", "expired", "cancelled"],
  viewed: ["accepted", "rejected", "expired", "cancelled"],
  accepted: ["converted", "cancelled"],
  rejected: ["cancelled"],
  expired: ["cancelled"],
  converted: ["cancelled"],
};

export const QUOTE_TERMINAL_STATUSES = new Set<string>(["cancelled"]);

export function canTransitionQuote(currentStatus: string, nextStatus: string): boolean {
  const allowed = QUOTE_ALLOWED_TRANSITIONS[currentStatus] ?? [];
  return allowed.includes(nextStatus);
}

export function isQuoteExpired(status: string, expiryDate?: string | null): boolean {
  if (status === "expired") return true;
  if (QUOTE_TERMINAL_STATUSES.has(status)) return false;
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

export function computeQuoteEffectiveStatus(
  status: string,
  expiryDate: string | null | undefined
): string {
  if (isQuoteExpired(status, expiryDate)) {
    if (status === "sent" || status === "viewed") {
      return "expired";
    }
  }
  return status;
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export class QuoteService {
  private toCalcInput(input: CreateQuoteInput | UpdateQuoteInput): InvoiceCalculationInput {
    const items: LineItemInput[] = (input.items ?? []).map((item, idx) => ({
      description: item.description,
      quantity: new Decimal(item.quantity ?? 1),
      unit: item.unit ?? "each",
      unitPrice: new Decimal(item.unitPrice ?? 0),
      discount: item.discount !== undefined && Number(item.discount) > 0
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
      input.quoteDiscount !== undefined && Number(input.quoteDiscount) > 0
        ? { type: input.quoteDiscountType ?? "fixed", value: new Decimal(input.quoteDiscount) }
        : undefined;

    return {
      currency: (input.currency ?? "USD") as CurrencyCode,
      lineItems: items,
      fees: fees.length > 0 ? fees : undefined,
      invoiceDiscount,
      amountPaid: undefined,
    };
  }

  async create(businessId: string, input: CreateQuoteInput, userId?: string): Promise<Record<string, unknown>> {
    const calcInput = this.toCalcInput(input);
    const result = calculationEngine.calculate(calcInput);

    const client = await getClient();
    try {
      await client.query("BEGIN");

      const issueDate = input.issueDate ?? new Date().toISOString().split("T")[0];
      let expiryDate = input.expiryDate;
      if (!expiryDate) {
        const validityDays = await this.getDefaultValidityDays(businessId);
        expiryDate = addDaysISO(issueDate, validityDays);
      }

      const res = await client.query(
        `INSERT INTO quotes (
           business_id, customer_id, currency, issue_date, expiry_date,
           notes, terms, payment_instructions, scope_of_work, internal_notes,
           template_id, deposit_type, deposit_value, deposit_due_date,
           subtotal, discount_total, tax_total, fee_total, total,
           amount_paid, amount_due, quote_discount_value, quote_discount_type,
           version, created_by, updated_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,1,$24,$24)
         RETURNING *`,
        [
          businessId,
          input.customerId ?? null,
          input.currency,
          issueDate,
          expiryDate,
          input.notes ?? null,
          input.terms ?? null,
          input.paymentInstructions ?? null,
          input.scopeOfWork ?? null,
          input.internalNotes ?? null,
          input.templateId ?? null,
          input.depositType ?? "none",
          input.depositValue ?? 0,
          input.depositDueDate ?? null,
          result.subtotal.toFixed(),
          result.discountTotal.toFixed(),
          result.taxTotal.toFixed(),
          result.feeTotal.toFixed(),
          result.total.toFixed(),
          "0",
          result.total.toFixed(),
          input.quoteDiscount ?? 0,
          input.quoteDiscountType ?? "fixed",
          userId ?? null,
        ]
      );

      const quoteId = res.rows[0].id;

      for (let idx = 0; idx < input.items.length; idx++) {
        const item = input.items[idx];
        const calcItem = result.lineItems[idx];
        await client.query(
          `INSERT INTO quote_items (
             quote_id, product_id, description, quantity, unit, unit_price,
             discount, discount_type, tax_rate, tax_name, tax_amount,
             line_subtotal, line_total, sort_order, is_tax_inclusive, is_optional,
             catalog_name, catalog_sku, catalog_tax_category, catalog_unit_price, catalog_tax_rate
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
          [
            quoteId,
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
            item.isOptional ?? false,
            item.catalogName ?? null,
            item.catalogSku ?? null,
            item.catalogTaxCategory ?? null,
            item.catalogUnitPrice ?? null,
            item.catalogTaxRate ?? null,
          ]
        );
      }

      for (let idx = 0; idx < (input.fees?.length ?? 0); idx++) {
        const fee = input.fees![idx];
        await client.query(
          `INSERT INTO quote_fees (
             quote_id, description, amount, tax_rate, tax_name, tax_amount, sort_order, is_tax_inclusive
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            quoteId,
            fee.description,
            fee.amount,
            fee.taxRate ?? 0,
            fee.taxName ?? null,
            "0",
            fee.sortOrder ?? idx,
            fee.isTaxInclusive ?? false,
          ]
        );
      }

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'created', $2, 'user', $3::jsonb)`,
        [quoteId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");

      const quote = await this.findById(businessId, quoteId);
      logger.info(`Created quote ${quoteId} for business ${businessId}`);
      return quote!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to create quote for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async update(
    businessId: string,
    quoteId: string,
    input: UpdateQuoteInput,
    userId?: string
  ): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM quotes WHERE id = $1 AND business_id = $2`,
        [quoteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }

      const quote = existing.rows[0];
      if (quote.is_finalized) {
        throw new BusinessLogicError(
          "Finalized quotes cannot be edited. Cancel and create a new quote instead.",
          "QUOTE_FINALIZED"
        );
      }

      if (input.version !== undefined && Number(quote.version) !== Number(input.version)) {
        throw new ConflictError("Quote was modified by another user. Please refresh and try again.", {
          currentVersion: quote.version,
        });
      }

      const updates: string[] = [];
      const values: unknown[] = [businessId, quoteId];
      let i = 3;

      const fieldMap: Record<string, string> = {
        customerId: "customer_id",
        currency: "currency",
        issueDate: "issue_date",
        expiryDate: "expiry_date",
        notes: "notes",
        terms: "terms",
        paymentInstructions: "payment_instructions",
        scopeOfWork: "scope_of_work",
        internalNotes: "internal_notes",
        templateId: "template_id",
        depositType: "deposit_type",
        depositValue: "deposit_value",
        depositDueDate: "deposit_due_date",
      };

      for (const [key, val] of Object.entries(input)) {
        if (key === "version" || key === "items" || key === "fees") continue;
        const col = fieldMap[key] ?? key;
        updates.push(`${col} = $${i++}`);
        values.push(val);
      }

      if (input.quoteDiscount !== undefined) {
        updates.push(`quote_discount_value = $${i++}`);
        values.push(new Decimal(input.quoteDiscount ?? 0).toFixed());
      }
      if (input.quoteDiscountType !== undefined) {
        updates.push(`quote_discount_type = $${i++}`);
        values.push(input.quoteDiscountType);
      }

      if (updates.length > 0) {
        updates.push(`version = version + 1`, `updated_at = NOW()`);
        await client.query(
          `UPDATE quotes SET ${updates.join(", ")} WHERE id = $2 AND business_id = $1`,
          values
        );
      }

      if (input.items !== undefined) {
        await client.query(`DELETE FROM quote_items WHERE quote_id = $1`, [quoteId]);
        const calcInput = await this.buildCalculationInput(quoteId, quote.currency as string, input);
        const result = calculationEngine.calculate(calcInput);

        for (let idx = 0; idx < input.items.length; idx++) {
          const item = input.items[idx];
          const calcItem = result.lineItems[idx];
          await client.query(
            `INSERT INTO quote_items (
               quote_id, product_id, description, quantity, unit, unit_price,
               discount, discount_type, tax_rate, tax_name, tax_amount,
               line_subtotal, line_total, sort_order, is_tax_inclusive, is_optional,
               catalog_name, catalog_sku, catalog_tax_category, catalog_unit_price, catalog_tax_rate
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
            [
              quoteId,
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
              item.isOptional ?? false,
              item.catalogName ?? null,
              item.catalogSku ?? null,
              item.catalogTaxCategory ?? null,
              item.catalogUnitPrice ?? null,
              item.catalogTaxRate ?? null,
            ]
          );
        }

        if (input.fees !== undefined) {
          await client.query(`DELETE FROM quote_fees WHERE quote_id = $1`, [quoteId]);
          for (let idx = 0; idx < input.fees.length; idx++) {
            const fee = input.fees[idx];
            await client.query(
              `INSERT INTO quote_fees (quote_id, description, amount, tax_rate, tax_name, tax_amount, sort_order, is_tax_inclusive)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [quoteId, fee.description, fee.amount, fee.taxRate ?? 0, fee.taxName ?? null, "0", fee.sortOrder ?? idx, fee.isTaxInclusive ?? false]
            );
          }
        }

        await client.query(
          `UPDATE quotes SET
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
            quoteId,
            businessId,
          ]
        );
      }

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'updated', $2, 'user', $3::jsonb)`,
        [quoteId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");

      const updated = await this.findById(businessId, quoteId);
      logger.info(`Updated quote ${quoteId} for business ${businessId}`);
      return updated!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to update quote ${quoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async finalize(
    businessId: string,
    quoteId: string,
    userId?: string
  ): Promise<FinalizeQuoteResult> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM quotes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [quoteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }

      const quote = existing.rows[0];
      if (quote.is_finalized) {
        throw new BusinessLogicError("Quote is already finalized", "ALREADY_FINALIZED");
      }

      // Validate minimum requirements
      if (!quote.customer_id) {
        throw new BusinessLogicError("Quote must have a customer before finalizing", "NO_CUSTOMER");
      }

      const calcInput = await this.buildCalculationInput(quoteId, quote.currency as string);
      const result = calculationEngine.calculate(calcInput);

      const subtotal = new Decimal(quote.subtotal);
      const taxTotal = new Decimal(quote.tax_total);
      const feeTotal = new Decimal(quote.fee_total);
      const total = new Decimal(quote.total);

      if (
        !subtotal.eq(result.subtotal) ||
        !taxTotal.eq(result.taxTotal) ||
        !feeTotal.eq(result.feeTotal) ||
        !total.eq(result.total)
      ) {
        throw new BusinessLogicError(
          "Quote calculations do not match. Please refresh and try again.",
          "CALCULATION_MISMATCH",
          {
            expected: { subtotal: result.subtotal.toFixed(), taxTotal: result.taxTotal.toFixed(), feeTotal: result.feeTotal.toFixed(), total: result.total.toFixed() },
            actual: { subtotal: subtotal.toFixed(), taxTotal: taxTotal.toFixed(), feeTotal: feeTotal.toFixed(), total: total.toFixed() },
          }
        );
      }

      const quoteNumber = await quoteNumberService.generate(businessId);

      const publicToken = crypto.randomUUID().slice(0, 32);
      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await client.query(
        `UPDATE quotes SET
           quote_number = $1,
           is_finalized = TRUE,
           finalized_at = NOW(),
           status = 'sent',
           public_token = $2,
           public_token_expires_at = $3,
           version = version + 1,
           updated_at = NOW()
         WHERE id = $4 AND business_id = $5`,
        [quoteNumber, publicToken, tokenExpiresAt, quoteId, businessId]
      );

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'finalized', $2, 'user', $3::jsonb)`,
        [quoteId, userId ?? null, JSON.stringify({ quote_number: quoteNumber })]
      );

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'number_assigned', $2, 'user', $3::jsonb)`,
        [quoteId, userId ?? null, JSON.stringify({ quote_number: quoteNumber })]
      );

      await client.query("COMMIT");

      const finalizedQuote = await this.findById(businessId, quoteId);
      logger.info(`Finalized quote ${quoteId} with number ${quoteNumber}`);

      return { quote: finalizedQuote!, quoteNumber, status: "sent" };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to finalize quote ${quoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async send(
    businessId: string,
    quoteId: string,
    data: {
      to: string;
      cc?: string[];
      bcc?: string[];
      subject?: string;
      message?: string;
    },
    userId?: string
  ): Promise<SendQuoteResult> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM quotes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [quoteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }

      const quote = existing.rows[0];
      if (!quote.is_finalized) {
        throw new BusinessLogicError("Quote must be finalized before sending", "NOT_FINALIZED");
      }

      const fullQuote = await this.findById(businessId, quoteId);
      if (!fullQuote) throw new NotFoundError(`Quote ${quoteId} not found`);

      const pdf = await this.generatePdf(businessId, quoteId, fullQuote as any);
      const html = await this.renderQuoteEmail(businessId, quoteId, fullQuote as any, data.message);

      const idempotencyKey = `quote-send:${quoteId}:${crypto.randomUUID()}`;
      const result = await emailService.sendInvoiceEmail({
        invoiceId: quoteId,
        businessId,
        recipient: { email: data.to, name: quote.customer_name ?? undefined },
        subject: data.subject ?? `Quote ${quote.quote_number ?? ""} from {{business_name}}`,
        htmlBody: html,
        attachments: [{ filename: `Quote-${quote.quote_number ?? quoteId}.pdf`, content: pdf }],
        idempotencyKey,
      });

      await client.query(
        `UPDATE quotes SET sent_at = NOW(), status = 'sent', version = version + 1, updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [quoteId, businessId]
      );

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'sent', $2, 'user', $3::jsonb)`,
        [quoteId, userId ?? null, JSON.stringify({ email: data.to, message_id: result.messageId })]
      );

      await client.query("COMMIT");
      logger.info(`Sent quote ${quoteId} to ${data.to}`);

      const updated = await this.findById(businessId, quoteId);
      return { ok: true, messageId: result.messageId, status: result.status, quote: updated! };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to send quote ${quoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async duplicate(
    businessId: string,
    quoteId: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    const existing = await this.findById(businessId, quoteId);
    if (!existing) throw new NotFoundError(`Quote ${quoteId} not found`);

    const source = existing as Record<string, unknown>;

    const dupInput: CreateQuoteInput = {
      customerId: (source.customer_id as string) ?? null,
      currency: source.currency as string,
      issueDate: new Date().toISOString().split("T")[0],
      expiryDate: null,
      terms: source.terms as string | null | undefined,
      notes: source.notes as string | null | undefined,
      internalNotes: source.internal_notes as string | null
        ? `[Copy of quote ${source.quote_number ?? quoteId}] ${source.internal_notes as string}`
        : null,
      scopeOfWork: source.scope_of_work as string | null | undefined,
      paymentInstructions: source.payment_instructions as string | null | undefined,
      templateId: source.template_id as string | null | undefined,
      depositType: source.deposit_type as "none" | "percentage" | "fixed" | undefined,
      depositValue: source.deposit_value as string | undefined,
      depositDueDate: source.deposit_due_date as string | null | undefined,
      items: (source.items as Record<string, unknown>[]).map((item): QuoteItemInput => ({
        description: item.description as string,
        quantity: item.quantity as string,
        unit: item.unit as string,
        unitPrice: item.unit_price as string,
        discount: item.discount as string,
        discountType: item.discount_type as "fixed" | "percentage" | undefined,
        taxRate: item.tax_rate as string,
        taxName: item.tax_name as string | null | undefined,
        isTaxInclusive: Boolean(item.is_tax_inclusive),
        isOptional: Boolean(item.is_optional),
        productId: item.product_id as string | null | undefined,
        sortOrder: Number(item.sort_order),
      })),
      fees: (source.fees as Record<string, unknown>[]).map((fee): QuoteFeeInput => ({
        description: fee.description as string,
        amount: fee.amount as string,
        taxRate: fee.tax_rate as string,
        taxName: fee.tax_name as string | null | undefined,
        isTaxInclusive: Boolean(fee.is_tax_inclusive),
        sortOrder: Number(fee.sort_order),
      })),
      quoteDiscount: source.quote_discount_value as string | undefined,
      quoteDiscountType: source.quote_discount_type as "fixed" | "percentage" | undefined,
    };

    const dup = await this.create(businessId, dupInput, userId);
    logger.info(`Duplicated quote ${quoteId} for business ${businessId}`);
    return dup;
  }

  async findById(businessId: string, quoteId: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT q.*,
              q.subtotal as "subtotal",
              q.discount_total as "discount_total",
              q.tax_total as "tax_total",
              q.fee_total as "fee_total",
              q.total as "total",
              q.amount_paid as "amount_paid",
              q.amount_due as "amount_due",
              c.name as "customer_name",
              c.email as "customer_email",
              c.company_name as "customer_company_name",
              c.phone as "customer_phone",
              c.tax_id as "customer_tax_id",
              c.address_line_1 as "customer_address_line_1",
              c.address_line_2 as "customer_address_line_2",
              c.city as "customer_city",
              c.state_or_region as "customer_state_or_region",
              c.postal_code as "customer_postal_code",
              c.country_code as "customer_country_code"
       FROM quotes q
       LEFT JOIN customers c ON c.id = q.customer_id
       WHERE q.id = $1 AND q.business_id = $2`,
      [quoteId, businessId]
    );

    if (!result.rows.length) return null;

    const quote = result.rows[0] as Record<string, unknown>;
    const itemsRes = await query(
      `SELECT *, discount_type as "discount_type", is_tax_inclusive as "is_tax_inclusive", is_optional as "is_optional"
       FROM quote_items WHERE quote_id = $1 ORDER BY sort_order, created_at`,
      [quoteId]
    );
    const feesRes = await query(
      `SELECT *, is_tax_inclusive as "is_tax_inclusive"
       FROM quote_fees WHERE quote_id = $1 ORDER BY sort_order`,
      [quoteId]
    );
    const eventsRes = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM quote_events WHERE quote_id = $1 ORDER BY created_at ASC`,
      [quoteId]
    );

    const effectiveStatus = computeQuoteEffectiveStatus(
      quote.status as string,
      quote.expiry_date as string | null | undefined
    );

    return {
      ...quote,
      status: effectiveStatus,
      items: itemsRes.rows,
      fees: feesRes.rows,
      events: eventsRes.rows,
    };
  }

  async findMany(businessId: string, filters: Record<string, unknown>): Promise<{
    quotes: Record<string, unknown>[];
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
      where.push(`(quote_number ILIKE $${i} OR customer_name ILIKE $${i} OR customer_email ILIKE $${i})`);
      values.push(search, search, search);
      i++;
    }
    if (filters.customerId) {
      where.push(`customer_id = $${i++}`);
      values.push(filters.customerId);
    }
    if (filters.dateFrom) {
      where.push(`issue_date >= $${i++}`);
      values.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.push(`issue_date <= $${i++}`);
      values.push(filters.dateTo);
    }

    const sortBy = (filters.sortBy as string) ?? "created_at";
    const sortOrder = (filters.sortOrder as string) ?? "desc";

    const listRes = await query(
      `SELECT id, quote_number, status, customer_id, customer_name, customer_email,
              issue_date, expiry_date, currency, total, amount_paid, amount_due,
              is_finalized, finalized_at, sent_at, viewed_at, accepted_at, rejected_at,
              deposit_paid, created_at, updated_at, version
       FROM quotes
       WHERE ${where.join(" AND ")}
       ORDER BY ${sortBy} ${sortOrder === "asc" ? "ASC" : "DESC"}
       LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM quotes WHERE ${where.join(" AND ")}`,
      values
    );

    const now = new Date();
    const quotes = listRes.rows.map((row: Record<string, unknown>) => {
      const effectiveStatus = computeQuoteEffectiveStatus(
        row.status as string,
        row.expiry_date as string | null | undefined
      );
      return { ...row, status: effectiveStatus };
    });

    return {
      quotes,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  async findByPublicToken(token: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT q.*,
              q.subtotal as "subtotal",
              q.discount_total as "discount_total",
              q.tax_total as "tax_total",
              q.fee_total as "fee_total",
              q.total as "total",
              q.amount_paid as "amount_paid",
              q.amount_due as "amount_due",
              b.name as "business_name",
              b.legal_name as "business_legal_name",
              b.email as "business_email",
              b.phone as "business_phone",
              b.website as "business_website",
              b.address_line_1 as "business_address_line_1",
              b.address_line_2 as "business_address_line_2",
              b.city as "business_city",
              b.state_or_region as "business_state_or_region",
              b.postal_code as "business_postal_code",
              b.country_code as "business_country_code",
              b.default_currency as "business_default_currency",
              b.logo_url as "business_logo_url"
       FROM quotes q
       LEFT JOIN businesses b ON b.id = q.business_id
       WHERE q.public_token = $1 AND q.public_token_expires_at > NOW()`,
      [token]
    );

    if (!result.rows.length) return null;

    const quote = result.rows[0] as Record<string, unknown>;
    const business = {
      id: quote.business_id,
      name: quote.business_name,
      legalName: quote.business_legal_name,
      email: quote.business_email,
      phone: quote.business_phone,
      website: quote.business_website,
      address: quote.business_address_line_1
        ? {
            addressLine1: quote.business_address_line_1,
            addressLine2: quote.business_address_line_2,
            city: quote.business_city,
            stateOrRegion: quote.business_state_or_region,
            postalCode: quote.business_postal_code,
            countryCode: quote.business_country_code,
          }
        : null,
      countryCode: quote.business_country_code,
      defaultCurrency: quote.business_default_currency,
      logoUrl: quote.business_logo_url,
    };

    const itemsRes = await query(
      `SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY sort_order`,
      [quote.id]
    );
    const feesRes = await query(
      `SELECT * FROM quote_fees WHERE quote_id = $1 ORDER BY sort_order`,
      [quote.id]
    );

    const effectiveStatus = computeQuoteEffectiveStatus(
      quote.status as string,
      quote.expiry_date as string | null | undefined
    );

    return {
      ...quote,
      status: effectiveStatus,
      business,
      items: itemsRes.rows,
      fees: feesRes.rows,
      payments: [],
      events: [],
    };
  }

  async recordView(businessId: string, token: string): Promise<void> {
    const quote = await this.findByPublicToken(token);
    if (!quote) return;

    if (quote.status === "sent") {
      await query(
        `UPDATE quotes SET status = 'viewed', viewed_at = NOW(), version = version + 1, updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [quote.id, businessId]
      );
    }

    await query(
      `INSERT INTO quote_view_log (quote_id, business_id) VALUES ($1, $2)`,
      [quote.id, businessId]
    );

    await query(
      `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
       VALUES ($1, 'viewed', NULL, 'customer', $2::jsonb)`,
      [quote.id, JSON.stringify({ source: "public_view" })]
    );

    logger.info(`Quote ${quote.id} viewed by customer`);
  }

  async accept(businessId: string, quoteId: string): Promise<{ status: string; acceptedAt: string }> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM quotes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [quoteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }

      const quote = existing.rows[0];
      const currentStatus = computeQuoteEffectiveStatus(
        quote.status as string,
        quote.expiry_date as string | null | undefined
      );

      if (currentStatus === "expired") {
        throw new BusinessLogicError("Cannot accept an expired quote", "EXPIRED");
      }
      if (currentStatus === "accepted" || currentStatus === "rejected") {
        throw new BusinessLogicError(`Quote is already ${currentStatus}`, "ALREADY_PROCESSED");
      }
      if (currentStatus !== "sent" && currentStatus !== "viewed") {
        throw new BusinessLogicError(
          `Cannot accept quote in ${currentStatus} status`,
          "INVALID_STATE",
          { from: currentStatus, to: "accepted" }
        );
      }

      await client.query(
        `UPDATE quotes SET
           status = 'accepted',
           is_accepted = TRUE,
           accepted_at = NOW(),
           version = version + 1,
           updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [quoteId, businessId]
      );

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'accepted', NULL, 'customer', '{}')`,
        [quoteId]
      );

      await client.query("COMMIT");
      logger.info(`Quote ${quoteId} accepted by customer`);
      return { status: "accepted", acceptedAt: new Date().toISOString() };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to accept quote ${quoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async reject(
    businessId: string,
    quoteId: string,
    comment?: string | null
  ): Promise<{ status: string; rejectedAt: string }> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM quotes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [quoteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }

      const quote = existing.rows[0];
      const currentStatus = computeQuoteEffectiveStatus(
        quote.status as string,
        quote.expiry_date as string | null | undefined
      );

      if (currentStatus === "expired" || currentStatus === "accepted" || currentStatus === "rejected") {
        throw new BusinessLogicError(`Cannot reject quote in ${currentStatus} status`, "INVALID_STATE");
      }
      if (currentStatus !== "sent" && currentStatus !== "viewed") {
        throw new BusinessLogicError(
          `Cannot reject quote in ${currentStatus} status`,
          "INVALID_STATE",
          { from: currentStatus, to: "rejected" }
        );
      }

      await client.query(
        `UPDATE quotes SET
           status = 'rejected',
           rejected_at = NOW(),
           version = version + 1,
           updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [quoteId, businessId]
      );

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'rejected', NULL, 'customer', $2::jsonb)`,
        [quoteId, JSON.stringify({ comment: comment ?? null })]
      );

      await client.query("COMMIT");
      logger.info(`Quote ${quoteId} rejected by customer`);
      return { status: "rejected", rejectedAt: new Date().toISOString() };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to reject quote ${quoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async requestChanges(businessId: string, quoteId: string, comment: string): Promise<void> {
    const quote = await this.findById(businessId, quoteId);
    if (!quote) throw new NotFoundError(`Quote ${quoteId} not found`);

    await query(
      `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
       VALUES ($1, 'change_requested', NULL, 'customer', $2::jsonb)`,
      [quoteId, JSON.stringify({ comment })]
    );

    logger.info(`Quote ${quoteId} change request recorded`);
  }

  async convertToInvoice(businessId: string, quoteId: string, userId?: string): Promise<{
    quote: Record<string, unknown>;
    invoice: Record<string, unknown>;
    invoiceId: string;
  }> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM quotes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [quoteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }

      const quote = existing.rows[0];
      if (!quote.is_accepted) {
        throw new BusinessLogicError("Only accepted quotes can be converted to invoices", "NOT_ACCEPTED");
      }

      // Build invoice create input from quote
      const itemsRes = await client.query(
        `SELECT description, quantity, unit, unit_price, discount, discount_type,
                tax_rate, tax_name, is_tax_inclusive, sort_order
         FROM quote_items WHERE quote_id = $1 ORDER BY sort_order`,
        [quoteId]
      );
      const feesRes = await client.query(
        `SELECT description, amount, tax_rate, tax_name, sort_order
         FROM quote_fees WHERE quote_id = $1 ORDER BY sort_order`,
        [quoteId]
      );

      // Insert invoice
      const invRes = await client.query(
        `INSERT INTO invoices (
           business_id, customer_id, currency, issue_date, due_date,
           notes, terms, payment_instructions, template_id,
           subtotal, discount_total, tax_total, fee_total, total,
           amount_paid, amount_due, invoice_discount_value, invoice_discount_type,
           reference_quote_id, version
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,1)
         RETURNING *`,
        [
          businessId,
          quote.customer_id,
          quote.currency,
          quote.issue_date,
          quote.due_date ?? null,
          quote.notes,
          quote.terms,
          quote.payment_instructions,
          quote.template_id,
          quote.subtotal,
          quote.discount_total,
          quote.tax_total,
          quote.fee_total,
          quote.total,
          "0",
          quote.total,
          quote.quote_discount_value ?? 0,
          quote.quote_discount_type ?? "fixed",
          quoteId,
        ]
      );

      const invoiceId = invRes.rows[0].id;

      for (let idx = 0; idx < itemsRes.rows.length; idx++) {
        const item = itemsRes.rows[idx];
        await client.query(
          `INSERT INTO invoice_items (
             invoice_id, product_id, description, quantity, unit, unit_price,
             discount, discount_type, tax_rate, tax_name, tax_amount,
             line_subtotal, line_total, sort_order, is_tax_inclusive, tax_name
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            invoiceId, null, item.description, item.quantity, item.unit,
            item.unit_price, item.discount, item.discount_type, item.tax_rate,
            item.tax_name ?? null, item.tax_amount, item.line_subtotal, item.line_total,
            item.sort_order, item.is_tax_inclusive, item.tax_name ?? null,
          ]
        );
      }

      for (let idx = 0; idx < feesRes.rows.length; idx++) {
        const fee = feesRes.rows[idx];
        await client.query(
          `INSERT INTO invoice_fees (invoice_id, description, amount, tax_rate, tax_name, tax_amount, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [invoiceId, fee.description, fee.amount, fee.tax_rate, fee.tax_name ?? null, fee.tax_amount, fee.sort_order]
        );
      }

      await client.query(
        `INSERT INTO invoice_events (invoice_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'created_from_quote', $2, 'user', $3::jsonb)`,
        [invoiceId, userId ?? null, JSON.stringify({ quote_id: quoteId })]
      );

      // Update quote to point to the new invoice
      await client.query(
        `UPDATE quotes SET
           status = 'converted',
           converted_invoice_id = $1,
           version = version + 1,
           updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [invoiceId, quoteId, businessId]
      );

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'converted', $2, 'user', $3::jsonb)`,
        [quoteId, userId ?? null, JSON.stringify({ invoice_id: invoiceId })]
      );

      await client.query("COMMIT");

      const updatedQuote = await this.findById(businessId, quoteId);
      const updatedInvoice = await query(
        `SELECT * FROM invoices WHERE id = $1 AND business_id = $2`,
        [invoiceId, businessId]
      );

      logger.info(`Converted quote ${quoteId} to invoice ${invoiceId} for business ${businessId}`);
      return {
        quote: updatedQuote!,
        invoice: updatedInvoice.rows[0],
        invoiceId,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to convert quote ${quoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async cancel(
    businessId: string,
    quoteId: string,
    reason: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    return this.transitionStatus(businessId, quoteId, "cancelled", { reason }, userId);
  }

  async recordDepositPayment(
    businessId: string,
    quoteId: string,
    data: {
      amount: string | number;
      provider?: string;
      providerPaymentId?: string | null;
      idempotencyKey?: string | null;
    },
    userId?: string
  ): Promise<{ ok: boolean; depositPaid: boolean; amountPaid: string; amountRemaining: string }> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM quotes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [quoteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }

      const quote = existing.rows[0];

      if (data.idempotencyKey) {
        const dupe = await client.query(
          `SELECT id FROM quote_deposit_payments WHERE idempotency_key = $1 AND quote_id = $2`,
          [data.idempotencyKey, quoteId]
        );
        if (dupe.rows.length) {
          await client.query("ROLLBACK");
          logger.info(`Deposit payment already recorded (idempotent): ${data.idempotencyKey}`);
          return {
            ok: true,
            depositPaid: quote.deposit_paid,
            amountPaid: quote.amount_paid?.toFixed() ?? "0",
            amountRemaining: (new Decimal(quote.total ?? 0).minus(quote.amount_paid ?? 0)).toFixed(),
          };
        }
      }

      const paymentAmount = new Decimal(data.amount);
      if (paymentAmount.lte(0)) {
        throw new BusinessLogicError("Payment amount must be greater than 0", "INVALID_PAYMENT");
      }

      await client.query(
        `INSERT INTO quote_deposit_payments (quote_id, business_id, amount, provider, idempotency_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [quoteId, businessId, paymentAmount.toFixed(), data.provider ?? "stub", data.idempotencyKey ?? crypto.randomUUID()]
      );

      const newAmountPaid = new Decimal(quote.amount_paid ?? 0).plus(paymentAmount);
      const depositPaid = newAmountPaid.gte(new Decimal(quote.deposit_due ?? quote.deposit_value ?? 0));

      await client.query(
        `UPDATE quotes SET
           amount_paid = $1,
           deposit_paid = $2,
           version = version + 1,
           updated_at = NOW()
         WHERE id = $3 AND business_id = $4`,
        [newAmountPaid.toFixed(), depositPaid, quoteId, businessId]
      );

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'deposit_paid', $2, 'user', $3::jsonb)`,
        [quoteId, userId ?? null, JSON.stringify({ amount: paymentAmount.toFixed(), provider: data.provider ?? "stub" })]
      );

      await client.query("COMMIT");
      logger.info(`Recorded deposit payment of ${paymentAmount.toFixed()} for quote ${quoteId}`);

      return {
        ok: true,
        depositPaid,
        amountPaid: newAmountPaid.toFixed(),
        amountRemaining: (new Decimal(quote.total ?? 0).minus(newAmountPaid)).toFixed(),
      };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to record deposit payment for quote ${quoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async getQuoteEvents(businessId: string, quoteId: string): Promise<Record<string, unknown>[]> {
    await this.findById(businessId, quoteId);
    const result = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM quote_events WHERE quote_id = $1 ORDER BY created_at ASC`,
      [quoteId]
    );
    return result.rows;
  }

  private async buildCalculationInput(
    quoteId: string,
    currency: string,
    input?: CreateQuoteInput | UpdateQuoteInput
  ): Promise<InvoiceCalculationInput> {
    let itemsRes: Record<string, unknown>[];
    let feesRes: Record<string, unknown>[];
    let quoteDiscount: Decimal | undefined;
    let quoteDiscountType: "fixed" | "percentage" | undefined;
    let amountPaid: Decimal | undefined;

    if (input && input.items !== undefined) {
      // From update input
      const calcInput = this.toCalcInput(input);
      return calcInput;
    } else {
      // From database
      itemsRes = await query(
        `SELECT description, quantity, unit, unit_price, discount, discount_type,
                tax_rate, tax_name, is_tax_inclusive, sort_order
         FROM quote_items WHERE quote_id = $1 ORDER BY sort_order`,
        [quoteId]
      ).then(r => r.rows);

      feesRes = await query(
        `SELECT description, amount, tax_rate, tax_name, sort_order
         FROM quote_fees WHERE quote_id = $1 ORDER BY sort_order`,
        [quoteId]
      ).then(r => r.rows);

      const quoteRes = await query(
        `SELECT quote_discount_value, quote_discount_type, amount_paid
         FROM quotes WHERE id = $1`,
        [quoteId]
      );
      const q = quoteRes.rows[0];
      const discountValue = new Decimal(q?.quote_discount_value ?? 0);
      quoteDiscount = discountValue.gt(0)
        ? discountValue
        : undefined;
      quoteDiscountType = q?.quote_discount_type as "fixed" | "percentage" | undefined;
      amountPaid = q ? new Decimal(q.amount_paid ?? 0) : undefined;
    }

    const lineItems: LineItemInput[] = itemsRes.map((row: Record<string, unknown>) => ({
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

    const fees: FeeInput[] = feesRes.map((row: Record<string, unknown>) => ({
      description: row.description as string,
      amount: new Decimal(row.amount as string),
      taxRate: new Decimal(row.tax_rate as string),
      tax_name: row.tax_name as string | null | undefined,
      sortOrder: Number(row.sort_order),
    }));

    const discountDef: DiscountDefinition | undefined = quoteDiscount
      ? { type: quoteDiscountType ?? "fixed", value: quoteDiscount }
      : undefined;

    return {
      currency: currency as CurrencyCode,
      lineItems,
      fees: fees.length > 0 ? fees : undefined,
      invoiceDiscount: discountDef,
      amountPaid,
    };
  }

  private async transitionStatus(
    businessId: string,
    quoteId: string,
    nextStatus: string,
    metadata: Record<string, unknown> = {},
    userId?: string
  ): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM quotes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [quoteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Quote ${quoteId} not found`);
      }

      const quote = existing.rows[0];
      const currentStatus = computeQuoteEffectiveStatus(
        quote.status as string,
        quote.expiry_date as string | null | undefined
      );

      if (!canTransitionQuote(currentStatus, nextStatus) && currentStatus !== nextStatus) {
        throw new BusinessLogicError(
          `Cannot transition quote from ${currentStatus} to ${nextStatus}`,
          "INVALID_STATE",
          { from: currentStatus, to: nextStatus }
        );
      }

      if (!canTransitionQuote(currentStatus, nextStatus)) {
        throw new BusinessLogicError(
          `Cannot transition quote from ${currentStatus} to ${nextStatus}`,
          "INVALID_STATE",
          { from: currentStatus, to: nextStatus }
        );
      }

      const updateFields: string[] = ["status = $3", "version = version + 1", "updated_at = NOW()"];
      const updateValues: unknown[] = [businessId, quoteId, nextStatus];

      if (nextStatus === "cancelled") {
        updateFields.splice(0, 1, "status = $3", "cancelled_at = NOW()", `cancelled_reason = $${updateValues.length + 1}`);
        updateValues.push(metadata.reason);
      }

      await client.query(
        `UPDATE quotes SET ${updateFields.join(", ")} WHERE id = $2 AND business_id = $1`,
        updateValues
      );

      await client.query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, $3, 'user', $4::jsonb)`,
        [quoteId, nextStatus, userId ?? null, JSON.stringify(metadata)]
      );

      await client.query("COMMIT");
      const updated = await this.findById(businessId, quoteId);
      logger.info(`Quote ${quoteId} status → ${nextStatus}`);
      return updated!;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  private async fetchBusiness(businessId: string): Promise<Record<string, unknown>> {
    const res = await query(
      `SELECT id, name, legal_name, email, phone, website, tax_id, registration_number,
              address_line_1, address_line_2, city, state_or_region, postal_code, country_code,
              default_currency, logo_url
       FROM businesses WHERE id = $1`,
      [businessId]
    );
    return res.rows[0];
  }

  private async fetchCustomer(businessId: string, customerId: string): Promise<Record<string, unknown> | null> {
    const res = await query(
      `SELECT id, name, company_name, email, phone, tax_id,
              address_line_1, address_line_2, city, state_or_region, postal_code, country_code,
              default_currency, notes
       FROM customers WHERE id = $1`,
      [customerId]
    );
    if (!res.rows.length) return null;
    return res.rows[0];
  }

  private async getDefaultValidityDays(businessId: string): Promise<number> {
    const res = await query(
      `SELECT default_quote_validity_days FROM businesses WHERE id = $1`,
      [businessId]
    );
    if (!res.rows.length) return 30;
    return Number(res.rows[0].default_quote_validity_days ?? 30);
  }

  async generatePdf(
    businessId: string,
    quoteId: string,
    quote: Record<string, unknown>
  ): Promise<Buffer> {
    const business = await this.fetchBusiness(businessId);
    const customer = quote.customer_id
      ? await this.fetchCustomer(businessId, quote.customer_id as string)
      : null;

    const data = buildTemplateData(
      {
        id: quote.id as string,
        invoiceNumber: quote.quote_number as string | null,
        status: quote.status as string,
        issueDate: quote.issue_date ? new Date(quote.issue_date as string) : null,
        dueDate: quote.expiry_date ? new Date(quote.expiry_date as string) : null,
        currency: quote.currency as CurrencyCode,
        poNumber: quote.po_number as string | null | undefined,
        notes: quote.notes as string | null | undefined,
        terms: quote.terms as string | null | undefined,
        paymentInstructions: quote.payment_instructions as string | null | undefined,
        isFinalized: quote.is_finalized as boolean,
        depositType: quote.deposit_type as string | null | undefined,
        depositValue: quote.deposit_value as string | null | undefined,
        depositDueDate: quote.deposit_due_date as string | null | undefined,
        depositPaid: quote.deposit_paid as boolean | null | undefined,
        depositAmount: quote.deposit_due as string | null | undefined,
        language: quote.language as string | undefined,
        title: quote.title as string | null | undefined,
        paymentTerms: quote.payment_terms as string | null | undefined,
      },
      business as any,
      customer as any,
      (quote.items as Record<string, unknown>[]).map((item): TemplateLineItem => ({
        description: item.description as string,
        quantity: new Decimal(item.quantity as string),
        unit: item.unit as string,
        unitPrice: new Decimal(item.unit_price as string),
        discount: new Decimal(item.discount as string),
        taxRate: new Decimal(item.tax_rate as string),
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
      (quote.fees as Record<string, unknown>[]).map((fee): TemplateFee => ({
        description: fee.description as string,
        amount: new Decimal(fee.amount as string),
        taxRate: new Decimal(fee.tax_rate as string),
        taxName: fee.tax_name as string | null | undefined,
        taxAmount: new Decimal(fee.tax_amount as string),
      })),
      {
        subtotal: new Decimal(quote.subtotal as string),
        discountTotal: new Decimal(quote.discount_total as string),
        taxTotal: new Decimal(quote.tax_total as string),
        feeTotal: new Decimal(quote.fee_total as string),
        total: new Decimal(quote.total as string),
        amountPaid: new Decimal(quote.amount_paid as string),
        amountDue: new Decimal(quote.amount_due as string),
        taxByRate: [],
      },
      null,
      { htmlTemplate: DEFAULT_QUOTE_TEMPLATE } as any
    );

    const html = await templateRenderer.render(data);
    const pdf = await pdfService.generatePdfFromHtml(html, data);
    return pdf;
  }

  private async renderQuoteEmail(
    businessId: string,
    quoteId: string,
    quote: Record<string, unknown>,
    customMessage?: string
  ): Promise<string> {
    const business = await this.fetchBusiness(businessId);
    const customer = quote.customer_id
      ? await this.fetchCustomer(businessId, quote.customer_id as string)
      : null;

    const template = Handlebars.compile(QUOTE_EMAIL_TEMPLATE);
    const quoteNumber = quote.quote_number ?? "";
    const quoteTotal = new Decimal((quote.total as string | number | undefined) ?? 0);
    const currency = quote.currency ?? "USD";

    return template({
      business,
      customer,
      invoice: {
        invoiceNumber: quoteNumber,
        status: quote.status,
        currency,
        ...quote,
      },
      totals: {
        total: quoteTotal,
      },
      customMessage: customMessage ?? "",
      businessName: business.name,
    });
  }

  async expireQuotes(): Promise<number> {
    const now = new Date().toISOString().split("T")[0];
    const result = await query(
      `UPDATE quotes SET status = 'expired', updated_at = NOW(), version = version + 1
       WHERE expiry_date < $1
         AND status IN ('sent', 'viewed')
         AND is_finalized = TRUE
       RETURNING id, business_id`,
      [now]
    );

    for (const row of result.rows) {
      await query(
        `INSERT INTO quote_events (quote_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, 'expired', NULL, 'system', $2::jsonb)`,
        [row.id, JSON.stringify({ reason: "expiry_date_passed" })]
      );
      logger.info(`Quote ${row.id} expired automatically`);
    }

    logger.info(`Expired ${result.rowCount ?? 0} quotes`);
    return result.rowCount ?? 0;
  }
}

const QUOTE_EMAIL_TEMPLATE = `<!DOCTYPE html>
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
    <p>You have received quote <strong>{{invoice.invoiceNumber}}</strong> for {{formatMoney totals.total}} {{invoice.currency}}.</p>
    {{#if customMessage}}
    <p>{{customMessage}}</p>
    {{/if}
    <p style="text-align:center; margin: 24px 0;">
      <a href="#" class="button">View Quote</a>
    </p>
    <p class="muted">This quote is attached as a PDF. Thank you for your business.</p>
  </div>
</body>
</html>`;

Handlebars.registerHelper("formatMoney", function (v: Decimal.Value, currency?: string): string {
  void currency;
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

export const quoteService = new QuoteService();
