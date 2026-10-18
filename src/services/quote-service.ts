import { Decimal } from "decimal.js";
import crypto from "node:crypto";
import { env } from "../config/index.js";
import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, BusinessLogicError, ConflictError } from "../domain/errors.js";
import { calculationEngine, type InvoiceCalculationInput, type LineItemInput, type FeeInput, type DiscountDefinition, type CalculatedLineItem, type CalculatedFee, computeTaxBreakdown } from "../domain/calculation.js";
import { getCurrencyMetadata, type CurrencyCode } from "../domain/value-objects/currency.js";
import { quoteNumberService } from "./invoice-number-service.js";
import { pdfService } from "./pdf/pdf-service.js";
import { emailService } from "./email/email-service.js";
import {
  templateRenderer,
  buildQuoteData,
  DEFAULT_QUOTE_TEMPLATE,
  type TemplateLineItem,
  type TemplateFee,
  type TemplateBusiness,
  type TemplateCustomer,
  type QuoteTemplateData,
  fetchCustomerSnapshot,
} from "./templates/template-renderer.js";
import type { InvoiceService } from "./invoice-service.js";
import { quoteEmailTemplate } from "./quote-email-template.js";
import Handlebars from "handlebars";

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
  productId?: string | null;
  sortOrder?: number;
  isOptional?: boolean;
}

export interface QuoteFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  taxName?: string | null;
  sortOrder?: number;
  isTaxInclusive?: boolean;
}

export interface CreateQuoteInput {
  customerId?: string | null;
  currency: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  scopeOfWork?: string | null;
  internalNotes?: string | null;
  templateId?: string | null;
  quoteDiscount?: string | number;
  quoteDiscountType?: "fixed" | "percentage";
  items: QuoteItemInput[];
  fees?: QuoteFeeInput[];
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
  success: boolean;
  messageId: string;
  status: string;
  quote?: Record<string, unknown>;
}

const ALLOWED_QUOTE_STATE_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "rejected", "expired", "cancelled"],
  sent: ["accepted", "rejected", "expired", "cancelled"],
  accepted: ["converted", "cancelled"],
  viewed: ["accepted", "rejected", "expired", "cancelled"],
  rejected: ["cancelled"],
  expired: ["cancelled"],
  cancelled: [],
  converted: [],
};

const QUOTE_TERMINAL_STATUSES = new Set<string>(["accepted", "converted", "cancelled"]);

export class QuoteService {
  private invoiceService?: InvoiceService;

  setInvoiceService(service: InvoiceService) {
    this.invoiceService = service;
  }

  private toCalcInput(input: CreateQuoteInput | (UpdateQuoteInput & { currency: string }), existingCurrency?: string): InvoiceCalculationInput {
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

    const quoteDiscount: DiscountDefinition | undefined =
      input.quoteDiscount !== undefined && new Decimal(input.quoteDiscount ?? 0).gt(0)
        ? {
            type: input.quoteDiscountType ?? "fixed",
            value: new Decimal(input.quoteDiscount!),
          }
        : undefined;

    return {
      currency: (existingCurrency ?? input.currency) as CurrencyCode,
      lineItems: items,
      fees: fees.length > 0 ? fees : undefined,
      invoiceDiscount: quoteDiscount,
      amountPaid: undefined,
    };
  }

  async create(
    businessId: string,
    input: CreateQuoteInput,
    userId?: string
  ): Promise<Record<string, unknown>> {
    const calcInput = this.toCalcInput(input);
    const result = calculationEngine.calculate(calcInput);

    const client = await getClient();
    try {
      await client.query("BEGIN");

      const res = await client.query(
        `INSERT INTO quotes (
          business_id, customer_id, currency, issue_date, expiry_date,
          notes, terms, payment_instructions, scope_of_work, internal_notes,
          template_id, quote_discount_value, quote_discount_type,
          subtotal, discount_total, tax_total, fee_total, total,
          amount_paid, amount_due, version, status, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'0',$19,1,'draft',$20)
         RETURNING *`,
        [
          businessId,
          input.customerId ?? null,
          input.currency,
          input.issueDate ?? null,
          input.expiryDate ?? null,
          input.notes ?? null,
          input.terms ?? null,
          input.paymentInstructions ?? null,
          input.scopeOfWork ?? null,
          input.internalNotes ?? null,
          input.templateId ?? null,
          new Decimal(input.quoteDiscount ?? 0).toFixed(),
          input.quoteDiscountType ?? "fixed",
          result.subtotal.toFixed(),
          result.discountTotal.toFixed(),
          result.taxTotal.toFixed(),
          result.feeTotal.toFixed(),
          result.total.toFixed(),
          '0',
          userId ?? null,
        ]
      );

      const quoteId = res.rows[0].id;

      for (let idx = 0; idx < (input.items ?? []).length; idx++) {
        const item = input.items[idx];
        const calcItem = result.lineItems[idx];
        await client.query(
          `INSERT INTO quote_items (
            quote_id, product_id, description, quantity, unit, unit_price,
            discount, discount_type, tax_rate, tax_name, tax_amount,
            line_subtotal, line_total, sort_order, is_tax_inclusive, is_optional
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
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
          ]
        );
      }

      for (let idx = 0; idx < (input.fees ?? []).length; idx++) {
        const fee = input.fees![idx];
        const calcFee = result.fees[idx];
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
            calcFee?.taxAmount.toFixed() ?? "0",
            fee.sortOrder ?? idx,
            fee.isTaxInclusive ?? false,
          ]
        );
      }

      await this.logQuoteEvent(quoteId, businessId, "quote_created", userId ?? null, { status: "draft" }, client);

      await client.query("COMMIT");

      const quote = await this.findById(businessId, quoteId as string);
      logger.info(`Created quote draft for business ${businessId}`);
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
      if (quote.is_finalized || quote.status === "accepted" || quote.status === "converted") {
        throw new BusinessLogicError(
          "Finalized or accepted quotes cannot be edited. Create a new quote or duplicate instead.",
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
      };

      for (const [key, val] of Object.entries(input)) {
        if (key === "version" || key === "items" || key === "fees" || key === "quoteDiscount" || key === "quoteDiscountType") continue;
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
        for (let idx = 0; idx < input.items.length; idx++) {
          const item = input.items[idx];
          const calcInput = this.toCalcInput({
            ...input,
            currency: (quote.currency as string),
          });
          const recalcResult = calculationEngine.calculate(calcInput);
          const calcItem = recalcResult.lineItems[idx];

          await client.query(
            `INSERT INTO quote_items (
              quote_id, product_id, description, quantity, unit, unit_price,
              discount, discount_type, tax_rate, tax_name, tax_amount,
              line_subtotal, line_total, sort_order, is_tax_inclusive, is_optional
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
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
            ]
          );
        }

        const recalcInput = this.toCalcInput({
          ...input,
          currency: (quote.currency as string),
        });
        const recalcResult = calculationEngine.calculate(recalcInput);

        await client.query(
          `UPDATE quotes SET
            subtotal = $1, discount_total = $2, tax_total = $3,
            fee_total = $4, total = $5, amount_due = $6,
            version = version + 1, updated_at = NOW()
           WHERE id = $7 AND business_id = $8`,
          [
            recalcResult.subtotal.toFixed(),
            recalcResult.discountTotal.toFixed(),
            recalcResult.taxTotal.toFixed(),
            recalcResult.feeTotal.toFixed(),
            recalcResult.total.toFixed(),
            '0',
            quoteId,
            businessId,
          ]
        );
      }

      if (input.fees !== undefined) {
        await client.query(`DELETE FROM quote_fees WHERE quote_id = $1`, [quoteId]);
        const calcInput = this.toCalcInput({
          ...input,
          currency: (quote.currency as string),
        });
        const recalcResult = calculationEngine.calculate(calcInput);

        for (let idx = 0; idx < input.fees.length; idx++) {
          const fee = input.fees[idx];
          const calcFee = recalcResult.fees[idx];
          await client.query(
            `INSERT INTO quote_fees (quote_id, description, amount, tax_rate, tax_name, tax_amount, sort_order, is_tax_inclusive)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [quoteId, fee.description, fee.amount, fee.taxRate ?? 0, fee.taxName ?? null, calcFee?.taxAmount.toFixed() ?? "0", fee.sortOrder ?? idx, fee.isTaxInclusive ?? false]
          );
        }
      }

      await this.logQuoteEvent(quoteId, businessId, "quote_updated", userId ?? null, { source: "api" }, client);

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
      if (quote.is_finalized || quote.quote_number) {
        throw new BusinessLogicError("Quote is already finalized", "ALREADY_FINALIZED");
      }

      if (quote.status !== "draft") {
        throw new BusinessLogicError(
          `Only draft quotes can be finalized (current status: ${quote.status})`,
          "INVALID_STATE"
        );
      }

      const quoteNumber = await quoteNumberService.generate(businessId);

      await client.query(
        `UPDATE quotes SET
          quote_number = $1,
          is_finalized = TRUE,
          finalized_at = NOW(),
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [quoteNumber, quoteId, businessId]
      );

      await this.logQuoteEvent(quoteId, businessId, "quote_finalized", userId ?? null, { quote_number: quoteNumber }, client);
      await this.logQuoteEvent(quoteId, businessId, "quote_number_assigned", userId ?? null, { quote_number: quoteNumber }, client);

      await client.query("COMMIT");

      const finalizedQuote = await this.findById(businessId, quoteId);
      logger.info(`Finalized quote ${quoteId} with number ${quoteNumber}`);

      return {
        quote: finalizedQuote!,
        quoteNumber,
        status: (finalizedQuote as any)?.status ?? "draft",
      };
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
      cc?: string;
      bcc?: string;
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

      const fullQuote = await this.findByIdTx(businessId, quoteId, client);
      if (!fullQuote) throw new NotFoundError(`Quote ${quoteId} not found`);

      const pdf = await this.generatePdf(businessId, quoteId, fullQuote);
      const html = await this.renderQuoteEmail(businessId, quoteId, fullQuote as any, data.message);

      await client.query("COMMIT");

      const idempotencyKey = `quote-send:${quoteId}:${crypto.randomUUID()}`;
      const result = await emailService.sendQuoteEmail({
        quoteId,
        businessId,
        recipient: { email: data.to, name: (fullQuote as any).customer_name ?? (fullQuote as any).customer?.name ?? undefined },
        subject: data.subject ?? `Quotation ${quote.quote_number ?? ""} from {{business_name}}`,
        htmlBody: html,
        attachments: [{ filename: `Quote-${quote.quote_number ?? quoteId}.pdf`, content: pdf }],
        idempotencyKey,
      });

      await client.query("BEGIN");
      await client.query(
        `UPDATE quotes SET sent_at = NOW(), status = 'sent', version = version + 1, updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [quoteId, businessId]
      );

      await this.logQuoteEvent(quoteId, businessId, "quote_sent", userId ?? null, { email: data.to, message_id: result.messageId }, client);

      await client.query("COMMIT");
      logger.info(`Sent quote ${quoteId} to ${data.to}`);
      return { ok: true, success: true, messageId: result.messageId, status: "sent", quote: fullQuote };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to send quote ${quoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async accept(businessId: string, quoteId: string, userId?: string): Promise<Record<string, unknown>> {
    return this.transitionStatus(businessId, quoteId, "accepted", {}, userId);
  }

  async reject(businessId: string, quoteId: string, userId?: string): Promise<Record<string, unknown>> {
    return this.transitionStatus(businessId, quoteId, "rejected", {}, userId);
  }

  async expire(businessId: string, quoteId: string): Promise<Record<string, unknown>> {
    return this.transitionStatus(businessId, quoteId, "expired", {}, undefined);
  }

  async cancel(
    businessId: string,
    quoteId: string,
    reason: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    return this.transitionStatus(businessId, quoteId, "cancelled", { reason }, userId);
  }

  async void(
    businessId: string,
    quoteId: string,
    reason: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    return this.transitionStatus(businessId, quoteId, "cancelled", { reason, voided: true }, userId);
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

      if (!ALLOWED_QUOTE_STATE_TRANSITIONS[quote.status as string]?.includes(nextStatus)) {
        throw new BusinessLogicError(
          `Cannot transition quote from ${quote.status} to ${nextStatus}`,
          "INVALID_STATE",
          { from: quote.status, to: nextStatus }
        );
      }

      const timestampFields: Record<string, string> = {
        accepted: "accepted_at",
        rejected: "rejected_at",
        expired: "expired_at",
        cancelled: "cancelled_at",
        converted: "converted_at",
      };

      const updateFields: string[] = ["status = $3"];
      const updateValues: unknown[] = [businessId, quoteId, nextStatus];
      let paramIdx = 4;

      if (timestampFields[nextStatus]) {
        updateFields.push(`${timestampFields[nextStatus]} = NOW()`);
      }

      if (metadata.reason) {
        updateFields.push(`cancelled_reason = $${paramIdx++}`);
        updateValues.push(metadata.reason);
      }

      updateFields.push(`version = version + 1`, `updated_at = NOW()`);

      await client.query(
        `UPDATE quotes SET ${updateFields.join(", ")} WHERE id = $2 AND business_id = $1`,
        updateValues
      );

      const eventType = `quote_${nextStatus}`;
      await this.logQuoteEvent(quoteId, businessId, eventType, userId ?? null, metadata, client);

      await client.query("COMMIT");
      const updatedQuote = await this.findByIdTx(businessId, quoteId, client);
      logger.info(`Quote ${quoteId} status -> ${nextStatus}`);
      return updatedQuote ?? quote;
    } catch (e) {
      await client.query("ROLLBACK");
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
    const issueDate = new Date().toISOString().split("T")[0];
    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const dupInput: CreateQuoteInput = {
      customerId: (source.customer_id as string) ?? null,
      currency: source.currency as string,
      issueDate: issueDate,
      expiryDate: (source.expiry_date as string | null) ?? defaultExpiry,
      notes: source.notes as string | null,
      terms: source.terms as string | null,
      paymentInstructions: source.payment_instructions as string | null,
      scopeOfWork: source.scope_of_work as string | null,
      internalNotes: source.internal_notes as string | null,
      templateId: source.template_id as string | null,
      quoteDiscount: source.quote_discount_value as string | undefined,
      quoteDiscountType: source.quote_discount_type as "fixed" | "percentage" | undefined,
      items: (source.items as Record<string, unknown>[]).map((item): QuoteItemInput => ({
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
        isOptional: Boolean(item.is_optional),
      })),
      fees: (source.fees as Record<string, unknown>[]).map((fee): QuoteFeeInput => ({
        description: fee.description as string,
        amount: fee.amount as string,
        taxRate: fee.tax_rate as string | undefined,
        taxName: fee.tax_name as string | null,
        sortOrder: Number(fee.sort_order),
        isTaxInclusive: Boolean(fee.is_tax_inclusive),
      })),
    };

    const dup = await this.create(businessId, dupInput, userId);
    logger.info(`Duplicated quote ${quoteId} for business ${businessId}`);
    return dup;
  }

  async convertToInvoice(
    businessId: string,
    quoteId: string,
    userId?: string
  ): Promise<{ quote: Record<string, unknown>; invoiceId: string }> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const quote = await this.findByIdTx(businessId, quoteId, client);
      if (!quote) throw new NotFoundError(`Quote ${quoteId} not found`);

      if (quote.status === "converted") {
        throw new BusinessLogicError("Quote has already been converted", "ALREADY_CONVERTED");
      }

      const isFinalized = quote.is_finalized === true || quote.is_finalized === 1;
      if (!isFinalized) {
        throw new BusinessLogicError("Quote must be finalized before converting", "NOT_FINALIZED");
      }

      const allowedFromFinalized: Record<string, string[]> = {
        draft: ["sent", "converted"],
        sent: ["accepted"],
        accepted: ["converted"],
      };
      if (!allowedFromFinalized[quote.status as string]?.includes("converted")) {
        throw new BusinessLogicError(
          `Cannot convert quote from ${quote.status} status`,
          "INVALID_STATE"
        );
      }

      if (!this.invoiceService) {
        throw new BusinessLogicError("Invoice service not configured", "CONFIG_ERROR");
      }

      const invoice = await this.invoiceService.create(businessId, {
        customerId: (quote as any).customer_id,
        currency: (quote as any).currency,
        issueDate: (quote as any).issue_date ?? new Date().toISOString().split("T")[0],
        dueDate: null,
        notes: (quote as any).notes ?? null,
        terms: (quote as any).terms ?? null,
        paymentInstructions: (quote as any).payment_instructions ?? null,
        templateId: (quote as any).template_id ?? null,
        invoiceDiscount: (quote as any).quote_discount_value ?? 0,
        invoiceDiscountType: (quote as any).quote_discount_type ?? "fixed",
        shippingDescription: null,
        shippingAmount: 0,
        shippingTaxRate: 0,
        items: (quote as any).items?.map((item: Record<string, unknown>) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unit_price,
          discount: item.discount,
          discountType: item.discount_type,
          taxRate: item.tax_rate,
          taxName: item.tax_name,
          isTaxInclusive: Boolean(item.is_tax_inclusive),
          productId: item.product_id ?? null,
          sortOrder: Number(item.sort_order),
        })) ?? [],
        fees: (quote as any).fees?.map((fee: Record<string, unknown>) => ({
          description: fee.description,
          amount: fee.amount,
          taxRate: fee.tax_rate,
          taxName: fee.tax_name,
          sortOrder: Number(fee.sort_order),
        })) ?? [],
      }, userId);

      await client.query(
        `UPDATE quotes SET
          status = 'converted',
          converted_invoice_id = $1,
          converted_at = NOW(),
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [invoice.id, quoteId, businessId]
      );

      await this.logQuoteEvent(quoteId, businessId, "quote_converted", userId ?? null, { invoice_id: invoice.id }, client);

      await client.query("COMMIT");
      logger.info(`Converted quote ${quoteId} to invoice ${invoice.id}`);

      const updatedQuote = await this.findById(businessId, quoteId);
      return { quote: updatedQuote!, invoiceId: invoice.id as string };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to convert quote ${quoteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

   private formatMoneyFields(quote: Record<string, unknown>): Record<string, unknown> {
    const moneyFields = [
      "subtotal", "discount_total", "tax_total", "fee_total", "total",
      "amount_paid", "amount_due", "quote_discount_value",
    ];
    const formatted: Record<string, unknown> = { ...quote };
    for (const field of moneyFields) {
      if (formatted[field] !== undefined && formatted[field] !== null) {
        formatted[field] = new Decimal(formatted[field] as Decimal.Value).toFixed(2);
      }
    }
    if (Array.isArray(formatted.items)) {
      formatted.items = formatted.items.map((item: Record<string, unknown>) => {
        const formattedItem: Record<string, unknown> = { ...item };
        for (const field of ["discount", "tax_amount", "line_subtotal", "line_total", "unit_price"]) {
          if (formattedItem[field] !== undefined && formattedItem[field] !== null) {
            formattedItem[field] = new Decimal(formattedItem[field] as Decimal.Value).toFixed(2);
          }
        }
        return formattedItem;
      });
    }
    if (Array.isArray(formatted.fees)) {
      formatted.fees = formatted.fees.map((fee: Record<string, unknown>) => {
        const formattedFee: Record<string, unknown> = { ...fee };
        for (const field of ["amount", "tax_amount"]) {
          if (formattedFee[field] !== undefined && formattedFee[field] !== null) {
            formattedFee[field] = new Decimal(formattedFee[field] as Decimal.Value).toFixed(2);
          }
        }
        return formattedFee;
      });
    }
    return formatted;
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
              q.quote_discount_value as "quote_discount_value",
              q.quote_discount_type as "quote_discount_type",
              c.name as "customer_name",
              c.email as "customer_email"
       FROM quotes q
       LEFT JOIN customers c ON c.id = q.customer_id
       WHERE q.id = $1 AND q.business_id = $2`,
      [quoteId, businessId]
    );

    if (!result.rows.length) return null;

    const quote = result.rows[0] as Record<string, unknown>;
    const itemsRes = await query(
      `SELECT *, discount_type as "discount_type", is_tax_inclusive as "is_tax_inclusive"
       FROM quote_items
       WHERE quote_id = $1
       ORDER BY sort_order, created_at`,
      [quoteId]
    );
    const feesRes = await query(
      `SELECT * FROM quote_fees WHERE quote_id = $1 ORDER BY sort_order`,
      [quoteId]
    );
    const eventsRes = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM quote_events WHERE quote_id = $1 ORDER BY created_at DESC`,
      [quoteId]
    );

    return this.formatMoneyFields({
      ...quote,
      items: itemsRes.rows,
      fees: feesRes.rows,
      events: eventsRes.rows,
    });
  }

  private async findByIdTx(
    businessId: string,
    quoteId: string,
    client: { query: (text: string, params: unknown[]) => Promise<{ rows: unknown[] }> }
  ): Promise<Record<string, unknown> | null> {
    const result = await client.query(
      `SELECT q.*,
              q.subtotal as "subtotal",
              q.discount_total as "discount_total",
              q.tax_total as "tax_total",
              q.fee_total as "fee_total",
              q.total as "total",
              q.amount_paid as "amount_paid",
              q.amount_due as "amount_due",
              q.quote_discount_value as "quote_discount_value",
              q.quote_discount_type as "quote_discount_type",
              c.name as "customer_name",
              c.email as "customer_email"
       FROM quotes q
       LEFT JOIN customers c ON c.id = q.customer_id
       WHERE q.id = $1 AND q.business_id = $2`,
      [quoteId, businessId]
    );

    if (!result.rows.length) return null;

    const quote = result.rows[0] as Record<string, unknown>;
    const itemsRes = await client.query(
      `SELECT *, discount_type as "discount_type", is_tax_inclusive as "is_tax_inclusive"
       FROM quote_items
       WHERE quote_id = $1
       ORDER BY sort_order, created_at`,
      [quoteId]
    );
    const feesRes = await client.query(
      `SELECT * FROM quote_fees WHERE quote_id = $1 ORDER BY sort_order`,
      [quoteId]
    );

    return {
      ...quote,
      items: itemsRes.rows,
      fees: feesRes.rows,
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
              q.quote_discount_value as "quote_discount_value",
              q.quote_discount_type as "quote_discount_type",
              b.name as "business_name",
              b.address_line_1 as "business_address_line_1",
              b.address_line_2 as "business_address_line_2",
              b.city as "business_city",
              b.state_or_region as "business_state_or_region",
              b.postal_code as "business_postal_code",
              b.country_code as "business_country_code",
              b.default_currency as "business_currency",
              b.logo_url as "business_logo_url"
       FROM quotes q
       LEFT JOIN businesses b ON b.id = q.business_id
       LEFT JOIN customers c ON c.id = q.customer_id
       WHERE q.public_token = $1 AND q.public_token_expires_at > NOW()`,
      [token]
    );

    if (!result.rows.length) return null;

    const quote = result.rows[0] as Record<string, unknown>;
    const business = {
      id: quote.business_id,
      name: quote.business_name,
      address: quote.business_address_line_1 ? {
        addressLine1: quote.business_address_line_1,
        addressLine2: quote.business_address_line_2,
        city: quote.business_city,
        stateOrRegion: quote.business_state_or_region,
        postalCode: quote.business_postal_code,
        countryCode: quote.business_country_code,
      } : { addressLine1: "", addressLine2: null, city: "", stateOrRegion: "", postalCode: "", countryCode: "US" },
      countryCode: quote.business_country_code,
      defaultCurrency: quote.business_currency,
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

    return {
      ...quote,
      business,
      items: itemsRes.rows,
      fees: feesRes.rows,
    };
  }

  async findMany(
    businessId: string,
    filters: {
      limit?: string | number;
      offset?: string | number;
      status?: string;
      customerId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ): Promise<{ quotes: Record<string, unknown>[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(Math.max(Number(filters.limit ?? 50), 1), 200);
    const offset = Math.max(Number(filters.offset ?? 0), 0);

    const where: string[] = ["q.business_id = $1"];
    const values: unknown[] = [businessId];
    let i = 2;

    if (filters.status) {
      where.push(`q.status = $${i++}`);
      values.push(filters.status);
    }
    if (filters.customerId) {
      where.push(`q.customer_id = $${i++}`);
      values.push(filters.customerId);
    }
    if (filters.search) {
      const search = `%${filters.search}%`;
      where.push(`(q.quote_number ILIKE $${i} OR c.name ILIKE $${i})`);
      values.push(search);
      i++;
    }
    if (filters.dateFrom) {
      where.push(`q.created_at >= $${i++}`);
      values.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      where.push(`q.created_at <= $${i++}`);
      values.push(filters.dateTo);
    }

    const sortBy = filters.sortBy ?? "created_at";
    const sortOrder = filters.sortOrder ?? "desc";
    const allowedSortColumns = ["created_at", "issue_date", "expiry_date", "total", "status", "quote_number"];
    const sortCol = allowedSortColumns.includes(sortBy) ? `q.${sortBy}` : "q.created_at";

    const listRes = await query(
      `SELECT q.id, q.quote_number, q.status, q.customer_id, c.name as customer_name, c.email as customer_email,
              q.issue_date, q.expiry_date, q.currency, q.total, q.subtotal, q.discount_total,
              q.tax_total, q.fee_total, q.amount_paid, q.amount_due, q.is_finalized, q.finalized_at,
              q.sent_at, q.viewed_at, q.accepted_at, q.expired_at, q.cancelled_at,
              q.converted_at, q.created_at, q.updated_at, q.version
       FROM quotes q
       LEFT JOIN customers c ON c.id = q.customer_id
       WHERE ${where.join(" AND ")}
       ORDER BY ${sortCol} ${sortOrder === "asc" ? "ASC" : "DESC"}
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM quotes q LEFT JOIN customers c ON c.id = q.customer_id WHERE ${where.join(" AND ")}`,
      values
    );

    const now = new Date();
    const quotes = listRes.rows.map((row: Record<string, unknown>) => {
      let effectiveStatus = row.status as string;
      if (!QUOTE_TERMINAL_STATUSES.has(effectiveStatus)) {
        const expiryDate = row.expiry_date as string | null;
        if (expiryDate && new Date(expiryDate) < now) {
          effectiveStatus = "expired";
        }
      }
       return this.formatMoneyFields({ ...row, status: effectiveStatus });
     });

     return {
       quotes,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  async getEvents(
    businessId: string,
    quoteId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ events: Record<string, unknown>[]; total: number }> {
    await this.findById(businessId, quoteId);

    const result = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM quote_events WHERE quote_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [quoteId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM quote_events WHERE quote_id = $1`,
      [quoteId]
    );

    return {
      events: result.rows,
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  async buildTemplateDataForQuote(
    businessId: string,
    quoteId: string,
    quote: Record<string, unknown>,
  ): Promise<QuoteTemplateData> {
    const business = await this.fetchBusiness(businessId);
    const customer = quote.customer_id
      ? await this.fetchCustomer(businessId, quote.customer_id as string)
      : null;

    const lineItems = (quote.items as Record<string, unknown>[]).map((item): TemplateLineItem => ({
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
      isOptional: Boolean(item.is_optional),
    }));

    const fees = (quote.fees as Record<string, unknown>[]).map((fee): TemplateFee => ({
      description: fee.description as string,
      amount: new Decimal(fee.amount as string),
      taxRate: new Decimal(fee.tax_rate as string),
      taxName: fee.tax_name as string | null | undefined,
      taxAmount: new Decimal(fee.tax_amount as string),
    }));

    const calcInput: InvoiceCalculationInput = {
      currency: quote.currency as CurrencyCode,
      lineItems: lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unitPrice: li.unitPrice,
        discount: Number(li.discount as Decimal.Value) > 0
          ? { type: "fixed", value: new Decimal(li.discount as Decimal.Value) }
          : undefined,
        taxRate: li.taxRate,
        tax_name: li.taxName,
        isTaxInclusive: li.isTaxInclusive,
        sortOrder: 0,
      })),
      fees: fees.map((fee) => ({
        description: fee.description,
        amount: fee.amount,
        taxRate: fee.taxRate,
        tax_name: fee.taxName,
        sortOrder: 0,
      })),
      invoiceDiscount: Number(quote.quote_discount_value ?? 0) > 0
        ? {
            type: (quote.quote_discount_type ?? "fixed") as "fixed" | "percentage",
            value: new Decimal(quote.quote_discount_value as string),
          }
        : undefined,
      amountPaid: undefined,
    };

    const calcResult = calculationEngine.calculate(calcInput);

    const totals = {
      subtotal: calcResult.subtotal,
      discountTotal: calcResult.discountTotal,
      taxTotal: calcResult.taxTotal,
      feeTotal: calcResult.feeTotal,
      total: calcResult.total,
      amountPaid: new Decimal(0),
      amountDue: new Decimal(quote.total as string),
      taxByRate: computeTaxBreakdown(
        lineItems.map((li): CalculatedLineItem => ({
          description: li.description,
          quantity: new Decimal(li.quantity as Decimal.Value),
          unit: li.unit,
          unitPrice: new Decimal(li.unitPrice as Decimal.Value),
          discountAmount: new Decimal(li.discount as Decimal.Value),
          taxRate: new Decimal(li.taxRate as Decimal.Value),
          taxName: li.taxName,
          isTaxInclusive: li.isTaxInclusive,
          lineSubtotal: new Decimal(li.lineSubtotal as Decimal.Value),
          taxableAmount: new Decimal(li.lineSubtotal as Decimal.Value),
          taxAmount: new Decimal(li.taxAmount as Decimal.Value),
          lineTotal: new Decimal(li.lineTotal as Decimal.Value),
        })),
        fees.map((fee): CalculatedFee => ({
          description: fee.description,
          amount: new Decimal(fee.amount as Decimal.Value),
          taxRate: new Decimal(fee.taxRate as Decimal.Value),
          taxName: fee.taxName,
          taxAmount: new Decimal(fee.taxAmount as Decimal.Value),
          feeTotal: new Decimal(fee.amount as Decimal.Value),
        })),
        getCurrencyMetadata((quote.currency as CurrencyCode) ?? "USD").decimalPlaces
      ),
    };

    const data: QuoteTemplateData = buildQuoteData(
      {
        id: quote.id as string,
        quoteNumber: quote.quote_number as string | null,
        status: quote.status as string,
        issueDate: quote.issue_date ? new Date(quote.issue_date as string) : null,
        expiryDate: quote.expiry_date ? new Date(quote.expiry_date as string) : null,
        currency: quote.currency as CurrencyCode,
        scopeOfWork: quote.scope_of_work as string | null | undefined,
        notes: quote.notes as string | null | undefined,
        terms: quote.terms as string | null | undefined,
        paymentInstructions: quote.payment_instructions as string | null | undefined,
        language: undefined,
        isFinalized: Boolean(quote.is_finalized),
      },
      business,
      customer,
      lineItems,
      fees,
      totals,
      {
        htmlTemplate: await this.getQuoteTemplateHtml(businessId, quote.template_id as string | null),
      }
    );

    return data;
  }

  async generatePdf(
    businessId: string,
    quoteId: string,
    quote: Record<string, unknown>
  ): Promise<Buffer> {
    const data = await this.buildTemplateDataForQuote(businessId, quoteId, quote);

    const html = await templateRenderer.renderQuote(data);
    const pdf = await pdfService.generatePdfFromHtml(html, data);
    return pdf;
  }

  private async getQuoteTemplateHtml(businessId: string, templateId: string | null): Promise<string | undefined> {
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

    return DEFAULT_QUOTE_TEMPLATE;
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

    const template = Handlebars.compile(quoteEmailTemplate);
    return template({
      business,
      customer,
      quote,
      customMessage: customMessage ?? "",
      businessName: business.name as string,
      currency: quote.currency as string,
      appBaseUrl: env.APP_PUBLIC_BASE_URL,
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
    return fetchCustomerSnapshot(businessId, customerId);
  }

  private async logQuoteEvent(
    quoteId: string,
    businessId: string,
    eventType: string,
    actorId: string | null,
    metadata: Record<string, unknown> = {},
    client?: { query: (text: string, params: unknown[]) => Promise<{ rows: unknown[] }> }
  ): Promise<void> {
    const executor = client ?? { query };
    await executor.query(
      `INSERT INTO quote_events (quote_id, business_id, event_type, actor_id, actor_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        quoteId,
        businessId,
        eventType,
        actorId,
        actorId ? "user" : "system",
        JSON.stringify(metadata),
      ]
    );
  }

  async createShareLink(
    businessId: string,
    quoteId: string
  ): Promise<{ token: string; url: string; expiresAt: string }> {
    const existing = await this.findById(businessId, quoteId);
    if (!existing) throw new NotFoundError(`Quote ${quoteId} not found`);

    const quote = existing as Record<string, unknown>;
    let token = (quote.public_token as string | null) ?? null;

    if (!token) {
      token = crypto.randomUUID().slice(0, 32);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await query(
        `UPDATE quotes SET public_token = $1, public_token_expires_at = $2
         WHERE id = $3 AND business_id = $4`,
        [token, expiresAt, quoteId, businessId]
      );
    }

    const expiresAt = quote.public_token_expires_at as string;
    return {
      token,
      url: `${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/quote/${token}`,
      expiresAt: expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

export const quoteService = new QuoteService();
