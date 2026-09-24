import { Decimal } from "decimal.js";
import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, BusinessLogicError } from "../domain/errors.js";
import { receiptRepository, type ReceiptRow, type ReceiptFilter } from "../repositories/receipt.repo.js";
import { businessRepository } from "../repositories/business.repo.js";
import { buildTemplateData, type InvoiceTemplateData, type TemplateLineItem, type TemplateFee, type TemplateTotals } from "../services/templates/template-renderer.js";
import type { CurrencyCode } from "../domain/value-objects/currency.js";
import { pdfService } from "../services/pdf/pdf-service.js";
import { emailService, type InvoiceEmailData } from "../services/email/email-service.js";
import type { Payment } from "../domain/models/index.js";
import Handlebars from "handlebars";

export interface ReceiptNumberConfig {
  prefix: string;
  padding: number;
  includesYear: boolean;
}

const DEFAULT_RECEIPT_CONFIG: Omit<ReceiptNumberConfig, "nextNumber"> = {
  prefix: "RCPT",
  padding: 6,
  includesYear: true,
};

function pad(num: number, size: number): string {
  return num.toString().padStart(size, "0");
}

function formatReceiptNumber(assignedNumber: number, config: ReceiptNumberConfig, date: Date): string {
  const year = date.getFullYear().toString();
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

/**
 * Generates receipt numbers atomically per business using a DB-level row lock,
 * mirroring the InvoiceNumberService pattern.
 */
export class ReceiptNumberService {
  async generate(businessId: string, date: Date = new Date()): Promise<string> {
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO receipt_number_sequences (business_id, prefix, next_number, padding, includes_year)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (business_id) DO NOTHING`,
        [businessId, DEFAULT_RECEIPT_CONFIG.prefix, DEFAULT_RECEIPT_CONFIG.padding, DEFAULT_RECEIPT_CONFIG.includesYear]
      );
      const res = await client.query(
        `UPDATE receipt_number_sequences
         SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING prefix, next_number - 1 AS assigned_number, padding, includes_year`,
        [businessId]
      );
      if (res.rowCount === 0) {
        throw new BusinessLogicError(`Failed to generate receipt number for business ${businessId}`, "RECEIPT_NUMBER_FAILED");
      }
      const row = res.rows[0];
      const config: ReceiptNumberConfig = {
        prefix: row.prefix,
        padding: Number(row.padding),
        includesYear: Boolean(row.includes_year),
      };
      const number = formatReceiptNumber(Number(row.assigned_number), config, date);
      await client.query("COMMIT");
      logger.info(`Generated receipt number ${number} for business ${businessId}`);
      return number;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Receipt number generation failed for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }
}

export const receiptNumberService = new ReceiptNumberService();

const RECEIPT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Receipt {{receipt.receiptNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 32px; color: #222; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .logo { max-height: 60px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    th { color: #666; font-weight: 600; }
    .totals { margin-top: 16px; }
    .totals td { font-weight: 600; }
    .big-total { font-size: 20px; }
    .badge { display:inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #15803d; }
    .footer { margin-top: 32px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0 0 4px;">Receipt</h1>
      <h2 style="margin:0; font-size: 22px;">{{receipt.receiptNumber}}</h2>
    </div>
    <div style="text-align:right">
      <h2 style="margin:0">{{business.name}}</h2>
      <p class="muted">{{business.email}}</p>
      <p class="muted">{{business.phone}}</p>
    </div>
  </div>

  <table>
    <tr><td><span class="muted">Date issued</span></td><td>{{receipt.issuedAt}}</td></tr>
    <tr><td><span class="muted">Payment method</span></td><td>{{receipt.paymentMethod}}</td></tr>
    <tr><td><span class="muted">Payment reference</span></td><td>{{receipt.paymentProvider}} — {{receipt.providerPaymentId}}</td></tr>
    <tr><td><span class="muted">Invoice</span></td><td>{{receipt.invoiceNumber}}</td></tr>
    <tr><td><span class="muted">Status</span></td><td><span class="badge">{{receipt.status}}</span></td></tr>
  </table>

  <div class="totals">
    <table style="max-width:320px; margin-left:auto">
      <tr><td>Amount paid</td><td style="text-align:right">{{formatMoney receipt.amount}}</td></tr>
      <tr><td>Currency</td><td style="text-align:right">{{receipt.currency}}</td></tr>
      <tr class="big-total"><td>Total</td><td style="text-align:right">{{formatMoney receipt.amount}}</td></tr>
    </table>
  </div>

  <div class="footer">
    <p>This receipt was generated automatically from your payment of {{formatMoney receipt.amount}}.</p>
    <p>Invoice: {{receipt.invoiceNumber}} — Thank you for your business.</p>
  </div>
</body>
</html>`;

const compiledReceiptTemplate = Handlebars.compile(RECEIPT_TEMPLATE, { noEscape: true });

export interface ReceiptTemplateData {
  business: { name: string; email?: string | null; phone?: string | null; address?: Record<string, unknown> | null };
  receipt: {
    receiptNumber: string;
    amount: Decimal.Value;
    currency: string;
    status: string;
    issuedAt: string | null;
    paymentMethod: string | null;
    paymentProvider: string;
    providerPaymentId: string | null;
    invoiceNumber: string | null;
  };
  formatMoney: (v: Decimal.Value) => string;
}

export class ReceiptService {
  async issueReceipt(businessId: string, invoiceId: string, payment: Payment): Promise<ReceiptRow> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const idempotencyKey = `receipt:${payment.id}`;
      const existing = await receiptRepository.findByIdempotencyKey(businessId, idempotencyKey);
      if (existing) {
        await client.query("ROLLBACK");
        logger.info(`Receipt already issued for payment ${payment.id} (idempotent)`);
        return existing;
      }

      const receiptNumber = await receiptNumberService.generate(businessId);
      const receipt = await receiptRepository.create({
        businessId,
        invoiceId,
        paymentId: payment.id,
        receiptNumber,
        amount: String(payment.amount),
        currency: payment.currency as string,
        paymentMethod: payment.method,
        paymentPurpose: payment.metadata?.paymentPurpose as string | undefined,
        idempotencyKey,
        pdf: null,
        metadata: { provider: payment.provider, providerPaymentId: payment.providerPaymentId },
      });

      logger.info(`Issued receipt ${receiptNumber} for invoice ${invoiceId} payment ${payment.id}`);

      const pdf = await this.generatePdf(receipt.id);
      await client.query("COMMIT");
      return { ...receipt, pdf };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async getById(businessId: string, id: string): Promise<ReceiptRow> {
    return receiptRepository.findById(businessId, id);
  }

  async getResponse(businessId: string, id: string): Promise<Record<string, unknown>> {
    const res = await query(
      `SELECT r.*, i.invoice_number, i.currency,
              i.customer_id, c.name as customer_name, c.email as customer_email,
              b.name as business_name
       FROM receipts r
       JOIN invoices i ON i.id = r.invoice_id
       JOIN businesses b ON b.id = r.business_id
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE r.id = $1 AND r.business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Receipt ${id} not found`);
    return this.toApiRow(res.rows[0]);
  }

  private toApiRow(r: Record<string, unknown>): Record<string, unknown> {
    const metadata = (r.metadata as Record<string, unknown>) ?? {};
    return {
      id: r.id,
      invoice_id: r.invoice_id,
      business_id: r.business_id,
      payment_id: r.payment_id,
      receipt_number: r.receipt_number,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      provider: metadata.provider ?? "unknown",
      provider_receipt_url: metadata.provider_receipt_url ?? null,
      sent_to: r.email_log_id ? metadata.sent_to ?? null : null,
      issued_at: r.issued_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      invoice_number: r.invoice_number,
      customer_name: r.customer_name ?? null,
      customer_email: r.customer_email ?? null,
    };
  }

  async listResponse(businessId: string, filter: Record<string, unknown>): Promise<{ receipts: Record<string, unknown>[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(Math.max(Number(filter.limit ?? 50), 1), 200);
    const offset = Math.max(Number(filter.offset ?? 0), 0);
    const receiptFilter: ReceiptFilter = {
      status: filter.status as string | undefined,
      invoiceId: filter.invoiceId as string | undefined,
      paymentId: filter.paymentId as string | undefined,
      dateFrom: filter.dateFrom as string | undefined,
      dateTo: filter.dateTo as string | undefined,
      provider: filter.provider as string | undefined,
      search: filter.search as string | undefined,
      limit, offset,
    };
    const result = await receiptRepository.findManyWithDetailsAndCount(businessId, receiptFilter);
    const receipts = result.data.map((r) => this.toApiRow(r));
    return {
      receipts,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }


  async findByInvoice(businessId: string, invoiceId: string): Promise<ReceiptRow[]> {
    return receiptRepository.findByInvoice(businessId, invoiceId);
  }

  async findMany(businessId: string, filter: Record<string, unknown>): Promise<{ data: ReceiptRow[]; total: number; limit: number; offset: number }> {
    return receiptRepository.findMany(businessId, {
      status: filter.status as string | undefined,
      invoiceId: filter.invoiceId as string | undefined,
      paymentId: filter.paymentId as string | undefined,
      dateFrom: filter.dateFrom as string | undefined,
      dateTo: filter.dateTo as string | undefined,
      limit: filter.limit as number | undefined,
      offset: filter.offset as number | undefined,
    });
  }

  async generatePdf(receiptId: string): Promise<Buffer> {
    const { pdf, receiptNumber } = await this.generatePdfWithMeta(receiptId);
    return pdf;
  }

  async generatePdfWithMeta(receiptId: string): Promise<{ pdf: Buffer; receiptNumber: string }> {
    const client = await query(
      `SELECT r.id, r.receipt_number, r.amount, r.currency, r.status, r.issued_at,
              r.payment_method, r.metadata,
              i.invoice_number, i.status as invoice_status, i.currency as invoice_currency, i.amount_paid, i.amount_due,
              b.name as business_name, b.email as business_email, b.phone as business_phone,
              b.address_line_1, b.address_line_2, b.city, b.state_or_region, b.postal_code, b.country_code
        FROM receipts r
        JOIN invoices i ON i.id = r.invoice_id
        JOIN businesses b ON b.id = r.business_id
        WHERE r.id = $1`,
       [receiptId]
    );
    if (!client.rows.length) throw new NotFoundError(`Receipt ${receiptId} not found`);

    const r = client.rows[0] as Record<string, unknown>;
    const metadata = (r.metadata as Record<string, unknown>) ?? {};
    const data: ReceiptTemplateData = {
      business: {
        name: r.business_name as string,
        email: r.business_email as string | null,
        phone: r.business_phone as string | null,
        address: r.address_line_1 ? { addressLine1: r.address_line_1 as string, addressLine2: r.address_line_2 as string | null, city: r.city as string, stateOrRegion: r.state_or_region as string, postalCode: r.postal_code as string, countryCode: r.country_code as string } : null,
      },
      receipt: {
        receiptNumber: r.receipt_number as string,
        amount: r.amount as Decimal.Value,
         currency: (r.currency as string) ?? (r.invoice_currency as string) ?? "USD",
        status: r.status as string,
        issuedAt: r.issued_at ? new Date(r.issued_at as string).toISOString().slice(0, 10) : null,
        paymentMethod: r.payment_method as string | null,
        paymentProvider: (metadata.provider as string) ?? "unknown",
        providerPaymentId: (metadata.providerPaymentId as string) ?? null,
        invoiceNumber: r.invoice_number as string | null,
      },
      formatMoney: (v: Decimal.Value) => new Decimal(v).toFixed(2),
    };

    const html = this.renderReceipt(data);
    const pdf = await pdfService.generatePdfFromHtml(html, this.toInvoiceTemplateData(r, data));
    await receiptRepository.storePdf(receiptId, pdf);
    return { pdf, receiptNumber: r.receipt_number as string };
  }

  private renderReceipt(data: ReceiptTemplateData): string {
    return compiledReceiptTemplate(data);
  }

  private toInvoiceTemplateData(r: Record<string, unknown>, receiptData: ReceiptTemplateData): InvoiceTemplateData {
    return buildTemplateData(
      {
        id: r.id as string,
        invoiceNumber: r.invoice_number as string | null,
        status: r.invoice_status as string,
        issueDate: null,
        dueDate: null,
        currency: r.currency as CurrencyCode,
      },
      {
        id: r.business_id as string,
        name: r.business_name as string,
        legalName: null,
        email: r.business_email as string | null,
        phone: r.business_phone as string | null,
        website: null,
        taxId: null,
        address: {
          addressLine1: r.address_line_1 as string,
          addressLine2: r.address_line_2 as string | null,
          city: r.city as string,
          stateOrRegion: r.state_or_region as string,
          postalCode: r.postal_code as string,
          countryCode: r.country_code as string,
          taxId: null,
        },
        countryCode: r.country_code as string,
        defaultCurrency: r.currency as CurrencyCode,
        logoUrl: null,
      },
      null,
      [] as TemplateLineItem[],
      [] as TemplateFee[],
      {
        subtotal: String(receiptData.receipt.amount),
        discountTotal: "0",
        taxTotal: "0",
        feeTotal: "0",
        total: String(receiptData.receipt.amount),
        amountPaid: String(receiptData.receipt.amount),
        amountDue: "0",
      } as TemplateTotals,
      {}
    );
  }

  async sendReceiptEmail(receiptId: string, recipient: { email: string; name?: string }): Promise<{ messageId: string; status: string }> {
    const receipt = await receiptRepository.findByIdRaw(receiptId);

    const business = await businessRepository.findById(receipt.businessId);

    const templateData = await this.buildReceiptTemplateData(receipt);
    const html = this.renderReceipt(templateData);
    const pdf = receipt.pdf ?? await this.generatePdf(receiptId);

    const idempotencyKey = `receipt-email:${receipt.id}`;
    const emailData: InvoiceEmailData = {
      invoiceId: receipt.invoiceId,
      businessId: receipt.businessId,
      recipient,
      subject: `Receipt ${receipt.receiptNumber} from ${business.name}`,
      htmlBody: html,
      attachments: [{ filename: `Receipt-${receipt.receiptNumber}.pdf`, content: pdf }],
      idempotencyKey,
    };

    const result = await emailService.sendInvoiceEmail(emailData);
    await receiptRepository.setStatus(receiptId, "sent", { emailLogId: result.messageId });
    logger.info(`Sent receipt ${receipt.receiptNumber} to ${recipient.email}`);
    return { messageId: result.messageId, status: result.status };
  }

  private async buildReceiptTemplateData(receipt: ReceiptRow): Promise<ReceiptTemplateData> {
    const metadata = receipt.metadata ?? {};
    return {
      business: { name: "", email: null, phone: null, address: null },
      receipt: {
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        currency: receipt.currency,
        status: receipt.status,
        issuedAt: receipt.issuedAt ? receipt.issuedAt.toISOString().slice(0, 10) : null,
        paymentMethod: receipt.paymentMethod,
        paymentProvider: (metadata.provider as string) ?? "unknown",
        providerPaymentId: (metadata.providerPaymentId as string) ?? null,
        invoiceNumber: null,
      },
      formatMoney: (v: Decimal.Value) => new Decimal(v).toFixed(2),
    };
  }
}

export const receiptService = new ReceiptService();
