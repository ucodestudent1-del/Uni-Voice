import { Decimal } from "decimal.js";
import { createHash } from "node:crypto";
import { query } from "../db/pool.js";
import { getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, BusinessLogicError } from "../domain/errors.js";
import type { NumberSequenceConfig } from "../services/numbering/service.js";
import { businessRepository } from "../repositories/business.repo.js";
import { customerRepository } from "../repositories/customer.repo.js";
import { generatePublicInvoiceToken } from "../utils/crypto.js";
import { templateRenderer, buildTemplateData, type TemplateLineItem, type TemplateFee, type TemplateTotals } from "../services/templates/template-renderer.js";
import type { CurrencyCode } from "../domain/value-objects/currency.js";
import { pdfService } from "../services/pdf/pdf-service.js";
import { emailService, type InvoiceEmailData } from "../services/email/email-service.js";
import { invoiceService } from "./invoice-service.js";

export interface QuoteItemInput {
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

export interface QuoteFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  sortOrder?: number;
}

export interface QuoteCreateInput {
  customerId?: string | null;
  currency: string;
  issueDate?: string | null;
  dueDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  items?: QuoteItemInput[];
  fees?: QuoteFeeInput[];
}

export interface QuoteRow {
  id: string;
  businessId: string;
  customerId: string | null;
  quoteNumber: string | null;
  status: string;
  issueDate: Date | null;
  dueDate: Date | null;
  expiryDate: Date | null;
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  feeTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  notes: string | null;
  terms: string | null;
  isFinalized: boolean;
  finalizedAt: Date | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  convertedInvoiceId: string | null;
  publicToken: string | null;
  publicTokenExpiresAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteItemRow {
  id: string;
  quoteId: string;
  productId: string | null;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount: string;
  discountType: "fixed" | "percentage";
  taxRate: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
  sortOrder: number;
  isTaxInclusive: boolean;
  createdAt: Date;
}

export interface QuoteFeeRow {
  id: string;
  quoteId: string;
  description: string;
  amount: string;
  taxRate: string;
  taxAmount: string;
  sortOrder: number;
  createdAt: Date;
}

const DEFAULT_QUOTE_CONFIG = {
  prefix: "QOT",
  padding: 6,
  includesYear: true,
};

function pad(num: number, size: number): string {
  return num.toString().padStart(size, "0");
}

function formatNumber(assignedNumber: number, config: NumberSequenceConfig, date: Date): string {
  const year = date.getFullYear().toString();
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

async function generateQuoteNumber(businessId: string, date: Date = new Date()): Promise<string> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO quote_number_sequences (business_id, prefix, next_number, padding, includes_year)
       VALUES ($1, $2, 1, $3, $4)
       ON CONFLICT (business_id) DO NOTHING`,
      [businessId, DEFAULT_QUOTE_CONFIG.prefix, DEFAULT_QUOTE_CONFIG.padding, DEFAULT_QUOTE_CONFIG.includesYear]
    );
    const res = await client.query(
      `UPDATE quote_number_sequences
       SET next_number = next_number + 1
       WHERE business_id = $1
       RETURNING prefix, next_number - 1 AS assigned_number, padding, includes_year`,
      [businessId]
    );
    if (res.rowCount === 0) {
      throw new BusinessLogicError(`Failed to generate quote number for business ${businessId}`, "QUOTE_NUMBER_FAILED");
    }
    const row = res.rows[0];
    const config: NumberSequenceConfig = {
      prefix: row.prefix,
      nextNumber: Number(row.assigned_number),
      padding: Number(row.padding),
      includesYear: Boolean(row.includes_year),
    };
    const number = formatNumber(Number(row.assigned_number), config, date);
    await client.query("COMMIT");
    return number;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export class QuoteService {
  async create(input: QuoteCreateInput, businessId: string, userId?: string): Promise<string> {
    if (input.customerId) {
      await customerRepository.findById(businessId, input.customerId);
    }
    const id = crypto.randomUUID();
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO quotes (id, business_id, customer_id, currency, issue_date, due_date, expiry_date,
          notes, terms, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
        [
          id, businessId, input.customerId ?? null, input.currency ?? "USD",
          input.issueDate ?? null, input.dueDate ?? null, input.expiryDate ?? null,
          input.notes ?? null, input.terms ?? null, userId ?? null,
        ]
      );
      await this.persistItems(id, input.items ?? [], client);
      await this.persistFees(id, input.fees ?? [], client);
      await this.persistTotals(id, client);
      await client.query("COMMIT");
      logger.info(`Quote ${id} created for business ${businessId}`);
      return id;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  private async persistItems(quoteId: string, items: QuoteItemInput[], client: any): Promise<void> {
    for (const it of items) {
      await client.query(
        `INSERT INTO quote_items (id, quote_id, product_id, description, quantity, unit, unit_price,
          discount, discount_type, tax_rate, tax_amount, line_subtotal, line_total, sort_order, is_tax_inclusive, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
        [
          it.id ?? crypto.randomUUID(), quoteId, it.productId ?? null, it.description,
          it.quantity, it.unit ?? "each", it.unitPrice,
          it.discount ?? 0, (it.discountType ?? "fixed") as string,
          it.taxRate ?? 0, 0, 0, 0, it.sortOrder ?? 0, it.isTaxInclusive ?? false,
        ]
      );
    }
    await this.calcLineTotals(quoteId, client);
  }

  private async persistFees(quoteId: string, fees: QuoteFeeInput[], client: any): Promise<void> {
    for (const f of fees) {
      const taxRate = new Decimal(f.taxRate ?? 0);
      const amount = new Decimal(f.amount);
      const taxAmount = amount.mul(taxRate);
      await client.query(
        `INSERT INTO quote_fees (id, quote_id, description, amount, tax_rate, tax_amount, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [crypto.randomUUID(), quoteId, f.description, f.amount, f.taxRate ?? 0, taxAmount.toFixed(6), f.sortOrder ?? 0]
      );
    }
  }

  private async calcLineTotals(quoteId: string, client: any): Promise<void> {
    const res = await client.query(
      `SELECT id, quantity, unit_price, discount, discount_type, tax_rate, is_tax_inclusive
       FROM quote_items WHERE quote_id = $1 ORDER BY sort_order, created_at`,
      [quoteId]
    );
    for (const r of res.rows) {
      const qty = new Decimal(r.quantity);
      const unitPrice = new Decimal(r.unit_price);
      const base = qty.mul(unitPrice);
      let discount = new Decimal(r.discount ?? 0);
      if (r.discount_type === "percentage") {
        discount = base.mul(new Decimal(r.discount).div(100));
      }
      const lineSubtotal = base.minus(discount);
      const taxRate = new Decimal(r.tax_rate ?? 0);
      const taxAmount = lineSubtotal.mul(taxRate);
      const lineTotal = lineSubtotal.plus(taxAmount);
      await client.query(
        `UPDATE quote_items SET line_subtotal = $1, tax_amount = $2, line_total = $3
         WHERE id = $4`,
        [lineSubtotal.toFixed(6), taxAmount.toFixed(6), lineTotal.toFixed(6), r.id]
      );
    }
  }

  private async persistTotals(quoteId: string, client: any): Promise<void> {
    const itemsRes = await client.query(
      `SELECT COALESCE(SUM(line_subtotal),0) AS subtotal,
              COALESCE(SUM(discount),0) AS discount_total,
              COALESCE(SUM(tax_amount),0) AS tax_total,
              COALESCE(SUM(line_total),0) AS total
       FROM quote_items WHERE quote_id = $1`,
      [quoteId]
    );
    const feesRes = await client.query(
      `SELECT COALESCE(SUM(amount),0) AS fee_total FROM quote_fees WHERE quote_id = $1`,
      [quoteId]
    );
    const subtotal = new Decimal(itemsRes.rows[0]?.subtotal ?? 0);
    const discountTotal = new Decimal(itemsRes.rows[0]?.discount_total ?? 0);
    const taxTotal = new Decimal(itemsRes.rows[0]?.tax_amount ?? 0);
    const lineTotal = new Decimal(itemsRes.rows[0]?.total ?? 0);
    const feeTotal = new Decimal(feesRes.rows[0]?.fee_total ?? 0);
    const calcTotal = lineTotal.plus(feeTotal);
    await client.query(
      `UPDATE quotes SET subtotal = $1, discount_total = $2, tax_total = $3, fee_total = $4, total = $5,
         amount_due = GREATEST($5 - COALESCE(amount_paid,0), 0), updated_at = NOW()
       WHERE id = $6`,
      [subtotal.toFixed(6), discountTotal.toFixed(6), taxTotal.toFixed(6), feeTotal.toFixed(6), calcTotal.toFixed(6), quoteId]
    );
  }

  async update(businessId: string, id: string, input: Partial<QuoteCreateInput>): Promise<void> {
    const quote = await this.findById(businessId, id);
    if (quote.isFinalized) throw new BusinessLogicError("Cannot modify a finalized quote");
    const fields: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (input.customerId !== undefined) {
      if (input.customerId) await customerRepository.findById(businessId, input.customerId);
      fields.push(`customer_id = $${i++}`); vals.push(input.customerId ?? null);
    }
    if (input.currency !== undefined) { fields.push(`currency = $${i++}`); vals.push(input.currency); }
    if (input.issueDate !== undefined) { fields.push(`issue_date = $${i++}`); vals.push(input.issueDate ?? null); }
    if (input.dueDate !== undefined) { fields.push(`due_date = $${i++}`); vals.push(input.dueDate ?? null); }
    if (input.expiryDate !== undefined) { fields.push(`expiry_date = $${i++}`); vals.push(input.expiryDate ?? null); }
    if (input.notes !== undefined) { fields.push(`notes = $${i++}`); vals.push(input.notes ?? null); }
    if (input.terms !== undefined) { fields.push(`terms = $${i++}`); vals.push(input.terms ?? null); }
    vals.push(id, businessId);
    if (fields.length) {
      await query(`UPDATE quotes SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i} AND business_id = $${i + 1}`, vals);
    }
    if (input.items !== undefined || input.fees !== undefined) {
      const client = await getClient();
      try {
        await client.query("BEGIN");
        if (input.items !== undefined) {
          await query(`DELETE FROM quote_items WHERE quote_id = $1`, [id]);
          await this.persistItems(id, input.items, client);
        }
        if (input.fees !== undefined) {
          await query(`DELETE FROM quote_fees WHERE quote_id = $1`, [id]);
          await this.persistFees(id, input.fees, client);
        }
        await this.persistTotals(id, client);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }
  }

  async findById(businessId: string, id: string): Promise<QuoteWithDetails> {
    // Single query with JSON subqueries instead of 3 sequential round-trips.
    // Numeric columns are cast to ::text to preserve PostgreSQL decimal representation.
    const res = await query(
      `SELECT q.*, c.name as customer_name, c.email as customer_email,
             COALESCE((SELECT json_agg(row_to_json(items)) FROM (
               SELECT id, quote_id, product_id, description,
                      quantity::text AS quantity, unit, unit_price::text AS unit_price,
                      discount::text AS discount, discount_type, tax_rate::text AS tax_rate,
                      tax_amount::text AS tax_amount, line_subtotal::text AS line_subtotal,
                      line_total::text AS line_total, sort_order, is_tax_inclusive, created_at
               FROM quote_items WHERE quote_id = $1 ORDER BY sort_order, created_at
             ) items), '[]'::json) AS items_json,
             COALESCE((SELECT json_agg(row_to_json(fees)) FROM (
               SELECT id, quote_id, description,
                      amount::text AS amount, tax_rate::text AS tax_rate,
                      tax_amount::text AS tax_amount, sort_order, created_at
               FROM quote_fees WHERE quote_id = $1 ORDER BY sort_order, created_at
             ) fees), '[]'::json) AS fees_json
       FROM quotes q
       LEFT JOIN customers c ON c.id = q.customer_id
       WHERE q.id = $1 AND q.business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Quote ${id} not found`);
    const r = res.rows[0];

    const items: QuoteItemRow[] = (r.items_json ? JSON.parse(r.items_json as string) : []).map(this.itemRowToModel);
    const fees: QuoteFeeRow[] = (r.fees_json ? JSON.parse(r.fees_json as string) : []).map(this.feeRowToModel);
    return { ...this.rowToModel(r), items, fees };
  }

  async list(businessId: string, filter: Record<string, unknown>): Promise<{ data: QuoteRow[]; total: number; limit: number; offset: number }> {
    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;
    if (filter.status) { conditions.push(`status = $${i++}`); vals.push(filter.status); }
    if (filter.customerId) { conditions.push(`customer_id = $${i++}`); vals.push(filter.customerId); }
    if (filter.search) { conditions.push(`(quote_number ILIKE $${i} OR customer_id IS NULL)`); vals.push(`%${filter.search}%`); i++; }
    const limit = Math.min(Math.max(filter.limit as number ?? 50, 1), 200);
    const offset = Math.max(filter.offset as number ?? 0, 0);

    // Use COUNT(*) OVER() to get the total in the same query, avoiding a
    // second round-trip to the database.
    const dataRes = await query(
      `SELECT q.*, c.name as customer_name, c.email as customer_email,
              COUNT(*) OVER() AS total_count
       FROM quotes q LEFT JOIN customers c ON c.id = q.customer_id
       WHERE ${conditions.join(" AND ")} ORDER BY q.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, offset]
    );
    const total = dataRes.rows.length ? Number(dataRes.rows[0]?.total_count ?? 0) : 0;
    return {
      data: dataRes.rows.map(this.listRowToModel),
      total,
      limit,
      offset,
    };
  }

  async generateNumber(businessId: string, id: string): Promise<string> {
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const number = await generateQuoteNumber(businessId);
      await client.query(`UPDATE quotes SET quote_number = $1 WHERE id = $2 AND business_id = $3`, [number, id, businessId]);
      await client.query("COMMIT");
      return number;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async setPublicToken(id: string): Promise<string> {
    const token = generatePublicInvoiceToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      `UPDATE quotes SET public_token = $1, public_token_expires_at = $2 WHERE id = $3`,
      [token, expiresAt, id]
    );
    return token;
  }

  async finalize(businessId: string, id: string, userId?: string, existingQuote?: QuoteWithDetails): Promise<string> {
    const quote = existingQuote ?? await this.findById(businessId, id);
    if (quote.isFinalized) return quote.quoteNumber ?? "";
    if (!quote.customerId) throw new BusinessLogicError("Cannot finalize a quote without a customer");
    let number = quote.quoteNumber;
    if (!number) {
      number = await this.generateNumber(businessId, id);
    }
    await query(
      `UPDATE quotes SET is_finalized = TRUE, finalized_at = NOW(), status = 'sent', updated_at = NOW()
        WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
    return number;
  }

  async convertToInvoice(businessId: string, id: string, userId?: string): Promise<{ invoiceId: string; quoteNumber: string }> {
    const quote = await this.findById(businessId, id);
    if (!quote.isFinalized) {
      await this.finalize(businessId, id, userId, quote);
    }

    const invoiceId = await invoiceService.createDraft({
      customerId: quote.customerId ?? undefined,
      currency: quote.currency,
      issueDate: quote.issueDate ?? null,
      dueDate: quote.dueDate ?? null,
      notes: quote.notes ?? undefined,
      terms: quote.terms ?? undefined,
      items: quote.items.map((it) => ({
        productId: it.productId,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discount: Number(it.discount),
        discountType: it.discountType,
        taxRate: Number(it.taxRate),
        isTaxInclusive: it.isTaxInclusive,
        sortOrder: it.sortOrder,
      })),
      fees: quote.fees.map((f) => ({
        description: f.description,
        amount: f.amount,
        taxRate: Number(f.taxRate),
        sortOrder: f.sortOrder,
      })),
    }, businessId, userId);

    await query(
      `UPDATE quotes SET converted_invoice_id = $1, status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND business_id = $3`,
      [invoiceId, id, businessId]
    );
    return { invoiceId, quoteNumber: quote.quoteNumber ?? id };
  }

  async send(businessId: string, id: string, userId?: string): Promise<void> {
    const quote = await this.findById(businessId, id);
    const business = await businessRepository.findById(businessId);
    const customer = quote.customerId ? await customerRepository.findById(businessId, quote.customerId) : null;
    const customerEmail = customer?.email ?? null;
    if (!customerEmail) throw new BusinessLogicError("Customer has no email address");

    const number = quote.quoteNumber ?? await this.generateNumber(businessId, id);
    const token = await this.setPublicToken(id);

    const html = await this.renderQuoteHtml(quote, business, customer);
    const pdf = await pdfService.generatePdfFromHtml(html, { htmlTemplate: undefined } as any);

    const idempotencyKey = `quote-send:${id}:${token}`;
    const emailData: InvoiceEmailData = {
      invoiceId: id,
      businessId,
      recipient: { email: customerEmail, name: customer?.name ?? undefined },
      subject: `Quote ${number} from ${business.name}`,
      htmlBody: html,
      attachments: [{ filename: `Quote-${number}.pdf`, content: pdf }],
      idempotencyKey,
    };
    await emailService.sendInvoiceEmail(emailData);
    await query(
      `UPDATE quotes SET status = 'sent', sent_at = NOW(), public_token = $1, updated_at = NOW() WHERE id = $2`,
      [token, id]
    );
    logger.info(`Quote ${number} sent to ${customerEmail}`);
  }

async generatePdf(businessId: string, id: string): Promise<Buffer> {
    const quote = await this.findById(businessId, id);

    // Check the cached PDF first — if the quote state hash matches, we can
    // return the stored buffer without re-running puppeteer.
    const cacheHash = this.computePdfCacheHash(quote);
    const cached = await this.getPdfCache(id, cacheHash);
    if (cached) {
      logger.info(`PDF cache hit for quote ${id}`);
      return cached;
    }

    const business = await businessRepository.findById(businessId);
    const customer = quote.customerId ? await customerRepository.findById(businessId, quote.customerId) : null;
    const html = await this.renderQuoteHtml(quote, business, customer);
    const pdf = await pdfService.generatePdfFromHtml(html, { htmlTemplate: undefined } as any);
    await this.storePdfCache(id, pdf, cacheHash);
    return pdf;
  }

  private computePdfCacheHash(quote: QuoteWithDetails): string {
    const parts = [
      quote.id,
      quote.quoteNumber,
      quote.status,
      quote.issueDate instanceof Date ? quote.issueDate.toISOString() : quote.issueDate,
      quote.dueDate instanceof Date ? quote.dueDate.toISOString() : quote.dueDate,
      quote.expiryDate instanceof Date ? quote.expiryDate.toISOString() : quote.expiryDate,
      quote.currency,
      quote.subtotal,
      quote.discountTotal,
      quote.taxTotal,
      quote.feeTotal,
      quote.total,
      quote.amountPaid,
      quote.amountDue,
      quote.notes,
      quote.terms,
      JSON.stringify(quote.items),
      JSON.stringify(quote.fees),
    ];
    return createHash("sha256").update(parts.join("|")).digest("hex");
  }

  private async getPdfCache(quoteId: string, expectedHash: string): Promise<Buffer | null> {
    const res = await query(
      `SELECT pdf_cache, pdf_cache_hash FROM quotes WHERE id = $1 AND pdf_cache IS NOT NULL`,
      [quoteId]
    );
    if (!res.rows.length) return null;
    const row = res.rows[0];
    if (row.pdf_cache_hash !== expectedHash) return null;
    return row.pdf_cache as Buffer;
  }

  private async storePdfCache(quoteId: string, pdf: Buffer, hash: string): Promise<void> {
    await query(
      `UPDATE quotes SET pdf_cache = $1, pdf_cache_hash = $2, pdf_cached_at = NOW() WHERE id = $3`,
      [pdf, hash, quoteId]
    );
  }

  private async renderQuoteHtml(quote: QuoteWithDetails, business: any, customer: any): Promise<string> {
    const totals: TemplateTotals = {
      subtotal: new Decimal(quote.subtotal),
      discountTotal: new Decimal(quote.discountTotal),
      taxTotal: new Decimal(quote.taxTotal),
      feeTotal: new Decimal(quote.feeTotal),
      total: new Decimal(quote.total),
      amountPaid: new Decimal(quote.amountPaid),
      amountDue: new Decimal(quote.amountDue),
    };
    const businessData = {
      id: business.id,
      name: business.name,
      legalName: business.legalName ?? null,
      email: business.email ?? null,
      phone: business.phone ?? null,
      website: business.website ?? null,
      taxId: business.taxId ?? null,
      address: business.address ?? { addressLine1: "", addressLine2: null, city: "", stateOrRegion: "", postalCode: "", countryCode: "", taxId: null },
      countryCode: business.countryCode ?? "US",
      defaultCurrency: (business.defaultCurrency ?? quote.currency) as CurrencyCode,
      logoUrl: business.logoUrl ?? null,
    };
    const customerData = customer
      ? {
          id: customer.id,
          name: customer.name,
          companyName: customer.companyName ?? null,
          email: customer.email ?? null,
          phone: customer.phone ?? null,
          taxId: customer.taxId ?? null,
          address: customer.address ?? { addressLine1: "", addressLine2: null, city: "", stateOrRegion: "", postalCode: "", countryCode: "", taxId: null },
          countryCode: customer.countryCode ?? null,
          notes: null,
        }
      : null;
    const items: TemplateLineItem[] = quote.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      discount: it.discount,
      taxRate: it.taxRate,
      taxAmount: it.taxAmount,
      lineSubtotal: it.lineSubtotal,
      lineTotal: it.lineTotal,
      isTaxInclusive: it.isTaxInclusive,
      catalogName: null,
      catalogSku: null,
      catalogTaxCategory: null,
      catalogUnitPrice: null,
      catalogTaxRate: null,
    }));
    const fees: TemplateFee[] = quote.fees.map((f) => ({
      description: f.description,
      amount: f.amount,
      taxRate: f.taxRate,
      taxAmount: f.taxAmount,
    }));
    const templateData = buildTemplateData(
      {
        id: quote.id,
        invoiceNumber: quote.quoteNumber ?? null,
        status: quote.status,
        issueDate: quote.issueDate,
        dueDate: quote.dueDate,
        currency: quote.currency as CurrencyCode,
        notes: quote.notes,
        terms: quote.terms,
      },
      businessData,
      customerData,
      items,
      fees,
      totals,
      { htmlTemplate: undefined }
    );
    return templateRenderer.render(templateData);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const res = await query(`DELETE FROM quotes WHERE id = $1 AND business_id = $2 RETURNING id`, [id, businessId]);
    if (!res.rows.length) throw new NotFoundError(`Quote ${id} not found`);
  }

  private rowToModel(r: Record<string, unknown> & { customer_name?: string; customer_email?: string }): QuoteRow & { customerName?: string | null; customerEmail?: string | null } {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      customerId: r.customer_id as string | null,
      quoteNumber: r.quote_number as string | null,
      status: r.status as string,
      issueDate: r.issue_date ? new Date(r.issue_date as string) : null,
      dueDate: r.due_date ? new Date(r.due_date as string) : null,
      expiryDate: r.expiry_date ? new Date(r.expiry_date as string) : null,
      currency: r.currency as string,
      subtotal: r.subtotal as string,
      discountTotal: r.discount_total as string,
      taxTotal: r.tax_total as string,
      feeTotal: r.fee_total as string,
      total: r.total as string,
      amountPaid: r.amount_paid as string,
      amountDue: r.amount_due as string,
      notes: r.notes as string | null,
      terms: r.terms as string | null,
      isFinalized: Boolean(r.is_finalized) || ["sent","accepted","expired"].includes(r.status as string),
      finalizedAt: r.finalized_at ? new Date(r.finalized_at as string) : null,
      sentAt: r.sent_at ? new Date(r.sent_at as string) : null,
      viewedAt: r.viewed_at ? new Date(r.viewed_at as string) : null,
      acceptedAt: r.accepted_at ? new Date(r.accepted_at as string) : null,
      rejectedAt: r.rejected_at ? new Date(r.rejected_at as string) : null,
      convertedInvoiceId: r.converted_invoice_id as string | null,
      publicToken: r.public_token as string | null,
      publicTokenExpiresAt: r.public_token_expires_at ? new Date(r.public_token_expires_at as string) : null,
      createdBy: r.created_by as string | null,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
      customerName: r.customer_name as string | null | undefined,
      customerEmail: r.customer_email as string | null | undefined,
    };
  }

  private listRowToModel = (r: Record<string, unknown> & { customer_name?: string; customer_email?: string }): QuoteRow & { customerName?: string | null; customerEmail?: string | null } => {
    return this.rowToModel(r);
  };

  private itemRowToModel(r: Record<string, unknown>): QuoteItemRow {
    return {
      id: r.id as string,
      quoteId: r.quote_id as string,
      productId: r.product_id as string | null,
      description: r.description as string,
      quantity: r.quantity as string,
      unit: r.unit as string,
      unitPrice: r.unit_price as string,
      discount: r.discount as string,
      discountType: (r.discount_type as string) as "fixed" | "percentage",
      taxRate: r.tax_rate as string,
      taxAmount: r.tax_amount as string,
      lineSubtotal: r.line_subtotal as string,
      lineTotal: r.line_total as string,
      sortOrder: Number(r.sort_order),
      isTaxInclusive: Boolean(r.is_tax_inclusive),
      createdAt: new Date(r.created_at as string),
    };
  }

  private feeRowToModel(r: Record<string, unknown>): QuoteFeeRow {
    return {
      id: r.id as string,
      quoteId: r.quote_id as string,
      description: r.description as string,
      amount: r.amount as string,
      taxRate: r.tax_rate as string,
      taxAmount: r.tax_amount as string,
      sortOrder: Number(r.sort_order),
      createdAt: new Date(r.created_at as string),
    };
  }
}

export interface QuoteWithDetails extends QuoteRow {
  customerName?: string | null;
  customerEmail?: string | null;
  items: QuoteItemRow[];
  fees: QuoteFeeRow[];
}

export const quoteService = new QuoteService();
