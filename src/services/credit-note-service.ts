import { Decimal } from "decimal.js";
import { query } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { creditNoteRepository, type CreditNoteWithDetails } from "../repositories/credit-note.repo.js";
import { businessRepository } from "../repositories/business.repo.js";
import { customerRepository } from "../repositories/customer.repo.js";
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

export class CreditNoteService {
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
