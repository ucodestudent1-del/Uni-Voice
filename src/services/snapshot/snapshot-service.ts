import { createHash } from "node:crypto";
import type { InvoiceWithDetails } from "../../repositories/invoice.repo.js";
import type { Customer } from "../../domain/models/index.js";
import type { Template } from "../../domain/models/index.js";
import { businessRepository } from "../../repositories/business.repo.js";
import { customerRepository } from "../../repositories/customer.repo.js";
import { templateRepository } from "../../repositories/template.repo.js";
import { templateRenderer, type InvoiceTemplateData, buildTemplateData } from "../../services/templates/template-renderer.js";

export interface SnapshotResult {
  snapshot: Record<string, unknown>;
  hash: string;
  templateId: string | null;
  templateSchemaVersion: string;
  templateRevision: number;
  renderedHtml: string;
}

export interface SnapshotBuildOptions {
  createdBy?: string;
  templateSchemaVersion?: string | null;
  templateRevision?: number | null;
}

/**
 * Builds a tamper-evident, immutable snapshot of everything required to
 * reproduce a finalized invoice exactly as the customer received it:
 * business details, customer details, line items, fees, totals, currency,
 * template configuration, and payment terms.
 *
 * The snapshot also captures the template schemaVersion/revision that was
 * active at finalization time plus the rendered HTML so that PDF/email/public
 * rendering always uses the historical template rather than the current
 * mutable template.
 */
export class SnapshotService {
  static hash(signature: string): string {
    return createHash("sha256").update(signature).digest("hex");
  }

  async build(invoice: InvoiceWithDetails, businessId: string, opts?: SnapshotBuildOptions): Promise<SnapshotResult> {
    const business = await businessRepository.findById(businessId);
    let customer: Customer | null = null;
    if (invoice.customerId) {
      try {
        customer = await customerRepository.findById(businessId, invoice.customerId);
      } catch {
        customer = null;
      }
    }

    let template: Template | null = null;
    if (invoice.templateId) {
      try {
        template = await templateRepository.findById(businessId, invoice.templateId);
      } catch {
        template = null;
      }
    }

    const templateSchemaVersion = opts?.templateSchemaVersion ?? template?.schemaVersion ?? "1";
    const templateRevision = opts?.templateRevision ?? template?.revision ?? 1;

    const templateData = buildTemplateData(
      {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber ?? null,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        notes: invoice.notes,
        terms: invoice.terms,
        paymentInstructions: invoice.paymentInstructions,
      },
      {
        id: business.id,
        name: business.name,
        legalName: business.legalName,
        email: business.email,
        phone: business.phone,
        website: business.website,
        taxId: business.taxId,
        address: business.address,
        countryCode: business.countryCode,
        defaultCurrency: business.defaultCurrency,
        logoUrl: business.logoUrl,
      },
      customer
        ? {
            id: customer.id, name: customer.name, companyName: customer.companyName, email: customer.email,
            phone: customer.phone, taxId: customer.taxId, address: customer.address, countryCode: customer.countryCode,
            notes: customer.notes,
          }
        : null,
      invoice.items.map((i) => ({
        description: i.description, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice,
        discount: i.discount, discountType: i.discountType, taxRate: i.taxRate, taxAmount: i.taxAmount,
        lineSubtotal: i.lineSubtotal, lineTotal: i.lineTotal, isTaxInclusive: i.isTaxInclusive, productId: i.productId,
      })),
      invoice.fees.map((f) => ({
        description: f.description, amount: f.amount, taxRate: f.taxRate, taxAmount: f.taxAmount,
      })),
      {
        subtotal: invoice.subtotal, discountTotal: invoice.discountTotal, taxTotal: invoice.taxTotal,
        feeTotal: invoice.feeTotal, total: invoice.total, amountPaid: invoice.amountPaid, amountDue: invoice.amountDue,
      },
      {
        htmlTemplate: template?.htmlTemplate,
        schemaVersion: templateSchemaVersion,
        revision: templateRevision,
      }
    );

    const renderedHtml = templateRenderer.render(templateData);

    const payload: Record<string, unknown> = {
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issueDate: invoice.issueDate?.toISOString(),
        dueDate: invoice.dueDate?.toISOString(),
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        subtotal: invoice.subtotal,
        discountTotal: invoice.discountTotal,
        taxTotal: invoice.taxTotal,
        feeTotal: invoice.feeTotal,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        amountDue: invoice.amountDue,
        notes: invoice.notes,
        terms: invoice.terms,
        paymentInstructions: invoice.paymentInstructions,
        publicToken: invoice.publicToken,
      },
      business: {
        id: business.id,
        name: business.name,
        legalName: business.legalName,
        email: business.email,
        phone: business.phone,
        website: business.website,
        taxId: business.taxId,
        registrationNumber: business.registrationNumber,
        address: business.address,
        countryCode: business.countryCode,
        defaultCurrency: business.defaultCurrency,
        logoUrl: business.logoUrl,
      },
      customer: customer
        ? {
            id: customer.id, name: customer.name, companyName: customer.companyName, email: customer.email,
            phone: customer.phone, taxId: customer.taxId, address: customer.address, countryCode: customer.countryCode,
            defaultCurrency: customer.defaultCurrency, notes: customer.notes,
          }
        : null,
      items: invoice.items.map((i) => ({
        description: i.description, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice,
        discount: i.discount, discountType: i.discountType, taxRate: i.taxRate, taxAmount: i.taxAmount,
        lineSubtotal: i.lineSubtotal, lineTotal: i.lineTotal, isTaxInclusive: i.isTaxInclusive, productId: i.productId,
      })),
      fees: invoice.fees.map((f) => ({
        description: f.description, amount: f.amount, taxRate: f.taxRate, taxAmount: f.taxAmount,
      })),
      template: template
        ? {
            id: template.id,
            name: template.name,
            schemaVersion: template.schemaVersion,
            revision: template.revision,
            htmlTemplate: template.htmlTemplate,
            config: template.config,
          }
        : null,
      templateSchemaVersion,
      templateRevision,
      renderedHtml,
    };

    const signature = JSON.stringify(payload);
    const hash = SnapshotService.hash(signature);
    return {
      snapshot: payload,
      hash,
      templateId: template?.id ?? null,
      templateSchemaVersion,
      templateRevision,
      renderedHtml,
    };
  }

  verify(currentHash: string, invoice: InvoiceWithDetails, businessId: string): Promise<boolean> {
    return this.build(invoice, businessId).then((data) => data.hash === currentHash);
  }
}

export const snapshotService = new SnapshotService();
