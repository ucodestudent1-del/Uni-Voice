import { Decimal } from "decimal.js";
import { query } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { creditNoteRepository, type CreditNoteWithDetails, type CreditNoteCreateInput, type CreditNoteEvent } from "../repositories/credit-note.repo.js";
import { businessRepository } from "../repositories/business.repo.js";
import { customerRepository } from "../repositories/customer.repo.js";
import { invoiceRepository } from "../repositories/invoice.repo.js";
import { creditNoteNumberService } from "../services/numbering/service.js";
import {
  creditNoteTemplateRenderer,
  buildCreditNoteTemplateData,
  type CreditNoteTemplateData,
  type CreditNoteTemplateLineItem,
  type CreditNoteTemplateFee,
  type CreditNoteTemplateTotals,
  type CreditNoteTemplateApplicationInfo,
} from "./templates/credit-note-template-renderer.js";
import { pdfService } from "./pdf/pdf-service.js";
import type { CurrencyCode } from "../domain/value-objects/currency.js";
import { BusinessLogicError } from "../domain/errors.js";
import { emailService, type CreditNoteEmailData } from "./email/email-service.js";
import { generatePublicInvoiceToken } from "../utils/crypto.js";

export interface CreateCreditNoteInput {
  customerId?: string | null;
  referenceInvoiceId?: string | null;
  currency?: string;
  issueDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  items?: CreditNoteItemInput[];
  fees?: CreditNoteFeeInput[];
}

export interface CreditNoteItemInput {
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
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
}

export interface CreditNoteFeeInput {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  sortOrder?: number;
}

export class CreditNoteService {
  async create(input: CreateCreditNoteInput, businessId: string, userId?: string): Promise<string> {
    if (input.customerId) {
      await customerRepository.findById(businessId, input.customerId);
    }
    const cnId = await creditNoteRepository.create(businessId, input as CreditNoteCreateInput, userId);
    const cn = await creditNoteRepository.findById(businessId, cnId);
    const calc = this.recalculate(cn);
    await creditNoteRepository.updateTotals(cnId, calc);
    return cnId;
  }

  /**
   * Create a credit note from selected invoice items (partial credit).
   * Used by the Invoice → Credit Note partial-credit workflow.
   */
  async createFromInvoiceItems(
    businessId: string,
    invoiceId: string,
    selectedItems: Array<{
      id: string;
      description: string;
      quantity: any;
      unit: string;
      unitPrice: any;
      taxRate: any;
      taxAmount: any;
      lineSubtotal: any;
      lineTotal: any;
      discount: any;
      discountType: "fixed" | "percentage";
      isTaxInclusive?: boolean;
      productId?: string | null;
      catalogName?: string | null;
    }>,
    reason?: string,
    userId?: string
  ): Promise<string> {
    const invoice = await invoiceRepository.findById(businessId, invoiceId);
    const input: CreateCreditNoteInput = {
      customerId: invoice.customerId,
      referenceInvoiceId: invoiceId,
      currency: invoice.currency,
      issueDate: new Date().toISOString().split("T")[0],
      reason: reason ?? null,
      notes: null,
      terms: invoice.notes ?? invoice.terms,
      templateId: null,
      items: selectedItems.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discount: it.discount,
        discountType: it.discountType,
        taxRate: it.taxRate,
        isTaxInclusive: it.isTaxInclusive ?? false,
        sortOrder: 0,
        catalogName: it.catalogName,
      })),
    };
    return this.create(input, businessId, userId);
  }

  async update(businessId: string, id: string, input: Partial<CreateCreditNoteInput>): Promise<void> {
    const cn = await creditNoteRepository.findById(businessId, id);
    if (cn.isFinalized) throw new BusinessLogicError("Cannot modify a finalized credit note");
    await creditNoteRepository.update(businessId, id, input as Partial<CreditNoteCreateInput>);
  }

  async finalize(businessId: string, id: string, _userId?: string): Promise<{ creditNoteNumber?: string | null }> {
    const cn = await creditNoteRepository.findById(businessId, id);
    if (cn.isFinalized) throw new BusinessLogicError("Credit note is already finalized");
    const creditNoteNumber = await this.generateNumber(businessId, id, cn);
    await creditNoteRepository.finalize(id, businessId, new Date());
    const fresh = await creditNoteRepository.findById(businessId, id);
    await this.captureSnapshot(fresh);
    return { creditNoteNumber };
  }

  async cancel(businessId: string, id: string, reason: string, _userId?: string): Promise<void> {
    await creditNoteRepository.cancel(id, businessId, new Date(), reason);
  }

  async send(businessId: string, id: string, userId?: string): Promise<{ publicToken: string; status: string }> {
    const cn = await creditNoteRepository.findById(businessId, id);
    if (!cn.isFinalized) throw new BusinessLogicError("Cannot send a credit note that is not finalized");

    const business = await businessRepository.findById(businessId);
    const customer = cn.customerId ? await customerRepository.findById(businessId, cn.customerId) : null;
    const customerEmail = customer?.email ?? null;
    if (!customerEmail) throw new BusinessLogicError("Customer has no email address");

    const referenceInvoiceNumber = await this.fetchReferenceInvoiceNumber(cn, businessId);

    const html = await this.renderCreditNoteHtml(cn, business, customer, referenceInvoiceNumber);
    const templateData = this.buildTemplateData(cn, business, customer, referenceInvoiceNumber);
    const pdf = await pdfService.generatePdfFromHtml(html, templateData as any);

    const token = cn.publicToken ?? generatePublicInvoiceToken();
    const idempotencyKey = `cn-send:${id}:${token}`;
    const emailData: CreditNoteEmailData = {
      creditNoteId: id,
      businessId,
      recipient: { email: customerEmail, name: customer?.name ?? undefined },
      subject: `Credit Note ${cn.creditNoteNumber ?? ""} from ${business.name}`,
      htmlBody: html,
      attachments: [{ filename: `CreditNote-${cn.creditNoteNumber ?? id}.pdf`, content: pdf }],
      idempotencyKey,
    };

    await emailService.sendCreditNoteEmail(emailData);

    await query(
      `UPDATE credit_notes SET status = 'sent', public_token = $1, updated_at = NOW() WHERE id = $2`,
      [token, id]
    );
    logger.info(`Credit note ${cn.creditNoteNumber} sent to ${customerEmail}`);
    return { publicToken: token, status: "sent" };
  }

  async applyCreditNote(
    businessId: string,
    creditNoteId: string,
    invoiceId: string,
    amount?: string,
    applicationMethod?: "invoice_offset" | "balance_credit" | "refund"
  ): Promise<void> {
    const cn = await creditNoteRepository.findById(businessId, creditNoteId);
    if (!cn.isFinalized) throw new BusinessLogicError("Credit note must be finalized before applying");
    const idempotencyKey = `cn-apply:${creditNoteId}:${invoiceId}:${amount ?? "full"}:${applicationMethod ?? "invoice_offset"}`;
    const applyAmount = new Decimal(amount ?? cn.amountDue);
    const metadata: Record<string, unknown> = {
      application_method: applicationMethod ?? "invoice_offset",
    };
    if (applicationMethod === "refund") {
      metadata.refund_provider = "stub";
    }
    await creditNoteRepository.recordApplication(creditNoteId, invoiceId, businessId, applyAmount.toFixed(6), idempotencyKey, metadata);
    const newAppliedTotal = new Decimal(cn.appliedTotal).plus(applyAmount);
    const newAmountDue = new Decimal(cn.total).minus(newAppliedTotal);
    const total = new Decimal(cn.total);
    const finalApplied = newAppliedTotal.gt(total) ? total : newAppliedTotal;
    const finalDue = finalApplied.gt(total) ? new Decimal(0) : newAmountDue;
    const status = finalDue.lte(0) && (applicationMethod === "refund" || applicationMethod === "balance_credit")
      ? "applied"
      : finalDue.lte(0)
      ? "applied"
      : "finalized";
    await query(
      `UPDATE credit_notes SET applied_total = $1, amount_due = $2, status = $3, updated_at = NOW()
       WHERE id = $4 AND business_id = $5`,
      [finalApplied.toFixed(6), finalDue.isNegative() ? "0" : finalDue.toFixed(6), status, creditNoteId, businessId]
    );
  }

  async getEvents(businessId: string, id: string): Promise<CreditNoteEvent[]> {
    return creditNoteRepository.getEvents(id, businessId);
  }

  private recalculate(cn: CreditNoteWithDetails): {
    subtotal: string;
    discountTotal: string;
    taxTotal: string;
    feeTotal: string;
    total: string;
    appliedTotal: string;
    amountDue: string;
  } {
    const subtotal = cn.items.reduce((sum, it) => sum.plus(new Decimal(it.lineSubtotal)), new Decimal(0));
    const discountTotal = cn.items.reduce((sum, it) => sum.plus(new Decimal(it.discount)), new Decimal(0));
    const taxTotal = cn.items.reduce((sum, it) => sum.plus(new Decimal(it.taxAmount)), new Decimal(0));
    const feeTotal = cn.fees.reduce((sum, f) => sum.plus(new Decimal(f.amount)), new Decimal(0));
    const total = subtotal.plus(feeTotal);
    const appliedTotal = new Decimal(cn.appliedTotal ?? 0);
    const amountDue = total.minus(appliedTotal).isNegative() ? new Decimal(0) : total.minus(appliedTotal);
    return {
      subtotal: subtotal.toFixed(6),
      discountTotal: discountTotal.toFixed(6),
      taxTotal: taxTotal.toFixed(6),
      feeTotal: feeTotal.toFixed(6),
      total: total.toFixed(6),
      appliedTotal: appliedTotal.toFixed(6),
      amountDue: amountDue.toFixed(6),
    };
  }

  private async generateNumber(businessId: string, _cnId: string, _cn: CreditNoteWithDetails): Promise<string | null> {
    const result = await creditNoteNumberService.generate(businessId);
    return result.number;
  }

  private async captureSnapshot(cn: CreditNoteWithDetails): Promise<void> {
    await query(
      `INSERT INTO credit_note_snapshots (credit_note_id, snapshot, snapshot_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (credit_note_id) DO UPDATE SET snapshot = $2, snapshot_hash = $3`,
      [cn.id, JSON.stringify(cn), cn.version.toString()]
    );
  }

  async generatePdf(businessId: string, id: string): Promise<Buffer> {
    const cn = await creditNoteRepository.findById(businessId, id);

    const cacheHash = creditNoteRepository.computePdfCacheHash(cn);
    const cached = await this.getPdfCache(id, cacheHash);
    if (cached) {
      logger.info(`PDF cache hit for credit note ${id}`);
      return cached;
    }

    const business = await businessRepository.findById(businessId);
    let customer: any = null;
    if (cn.customerId) {
      customer = await customerRepository.findById(businessId, cn.customerId).catch(() => null);
    }

    const referenceInvoiceNumber = await this.fetchReferenceInvoiceNumber(cn, businessId);
    const html = await this.renderCreditNoteHtml(cn, business, customer, referenceInvoiceNumber);
    const templateData = this.buildTemplateData(cn, business, customer, referenceInvoiceNumber);
    const pdf = await pdfService.generatePdfFromHtml(html, templateData as any);
    await this.storePdfCache(id, pdf, cacheHash);
    return pdf;
  }

  async renderHtml(businessId: string, id: string): Promise<string> {
    const cn = await creditNoteRepository.findById(businessId, id);
    const business = await businessRepository.findById(businessId);
    let customer: any = null;
    if (cn.customerId) {
      customer = await customerRepository.findById(businessId, cn.customerId).catch(() => null);
    }
    const referenceInvoiceNumber = await this.fetchReferenceInvoiceNumber(cn, businessId);
    return this.renderCreditNoteHtml(cn, business, customer, referenceInvoiceNumber);
  }

  private async fetchReferenceInvoiceNumber(cn: CreditNoteWithDetails, businessId: string): Promise<string | null> {
    if (!cn.referenceInvoiceId) return null;
    try {
      const res = await query(
        `SELECT invoice_number FROM invoices WHERE id = $1 AND business_id = $2`,
        [cn.referenceInvoiceId, businessId]
      );
      return res.rows[0]?.invoice_number ?? null;
    } catch {
      return null;
    }
  }

  private async getPdfCache(creditNoteId: string, expectedHash: string): Promise<Buffer | null> {
    const res = await query(
      `SELECT pdf_cache, pdf_cache_hash FROM credit_notes WHERE id = $1 AND pdf_cache IS NOT NULL`,
      [creditNoteId]
    );
    if (!res.rows.length) return null;
    const row = res.rows[0];
    if (row.pdf_cache_hash !== expectedHash) return null;
    return row.pdf_cache as Buffer;
  }

  private async storePdfCache(creditNoteId: string, pdf: Buffer, hash: string): Promise<void> {
    await query(
      `UPDATE credit_notes SET pdf_cache = $1, pdf_cache_hash = $2, pdf_cached_at = NOW() WHERE id = $3`,
      [pdf, hash, creditNoteId]
    );
  }

  private buildTemplateData(
    cn: CreditNoteWithDetails,
    business: any,
    customer: any,
    referenceInvoiceNumber: string | null
  ): CreditNoteTemplateData {
    const totals: CreditNoteTemplateTotals = {
      subtotal: new Decimal(cn.subtotal),
      discountTotal: new Decimal(cn.discountTotal),
      taxTotal: new Decimal(cn.taxTotal),
      feeTotal: new Decimal(cn.feeTotal),
      total: new Decimal(cn.total),
      appliedTotal: new Decimal(cn.appliedTotal),
      amountDue: new Decimal(cn.amountDue),
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
      defaultCurrency: (business.defaultCurrency ?? cn.currency) as CurrencyCode,
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
          notes: customer.notes ?? null,
        }
      : null;

    const items: CreditNoteTemplateLineItem[] = cn.items.map((it) => ({
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
      catalogName: it.catalogName,
      catalogSku: it.catalogSku,
      catalogTaxCategory: it.catalogTaxCategory,
      catalogUnitPrice: it.catalogUnitPrice,
      catalogTaxRate: it.catalogTaxRate,
    }));

    const fees: CreditNoteTemplateFee[] = cn.fees.map((f) => ({
      description: f.description,
      amount: f.amount,
      taxRate: f.taxRate,
      taxAmount: f.taxAmount,
    }));

    const applications: CreditNoteTemplateApplicationInfo[] = cn.applications.map((app) => ({
      amount: app.amount,
      invoiceId: app.invoiceId,
      invoiceNumber: null,
      appliedAt: app.appliedAt.toISOString(),
    }));

    return buildCreditNoteTemplateData(
      {
        id: cn.id,
        creditNoteNumber: cn.creditNoteNumber ?? null,
        status: cn.status,
        issueDate: cn.issueDate,
        currency: cn.currency as CurrencyCode,
        reason: cn.reason,
        notes: cn.notes,
        terms: cn.terms,
        referenceInvoiceId: cn.referenceInvoiceId,
        referenceInvoiceNumber,
        language: "en",
      },
      businessData,
      customerData,
      items,
      fees,
      totals,
      applications,
      {}
    );
  }

  private async renderCreditNoteHtml(
    cn: CreditNoteWithDetails,
    business: any,
    customer: any,
    referenceInvoiceNumber: string | null
  ): Promise<string> {
    const templateData = this.buildTemplateData(cn, business, customer, referenceInvoiceNumber);
    return creditNoteTemplateRenderer.render(templateData);
  }

}

export const creditNoteService = new CreditNoteService();
