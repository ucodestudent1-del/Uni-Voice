import { z } from "zod";
import type { InvoiceTemplate, InvoiceTemplateRevision } from "../../domain/models/index.js";
import { BusinessLogicError } from "../../domain/errors.js";
import { invoiceTemplateRepository } from "../../repositories/invoice-template.repo.js";
import { templateMigrationEngine } from "./migrations.js";
import {
  structuredTemplateRenderer,
  type RenderableBusiness,
  type RenderableCustomer,
  type RenderableInvoice,
  type RenderableLineItem,
  type RenderableFee,
  type RenderableTotals,
} from "./structured-renderer.js";
import type { CurrencyCode } from "../../domain/value-objects/currency.js";
import type { InvoiceTemplateDocument } from "../../domain/schemas/invoice-template.js";
import {
  InvoiceTemplateInputSchema,
  InvoiceTemplateUpdateSchema,
  InvoiceTemplateRevisionInputSchema,
  InvoiceTemplatePublishSchema,
} from "../../domain/schemas/invoice-template.js";
import { logger } from "../../utils/logger.js";

type Infer<T> = T extends z.ZodType<infer R> ? R : never;
type InvoiceTemplateInputSchemaInput = Infer<typeof InvoiceTemplateInputSchema>;
type InvoiceTemplateUpdateSchemaInput = Infer<typeof InvoiceTemplateUpdateSchema>;
type InvoiceTemplateRevisionInputSchemaInput = Infer<typeof InvoiceTemplateRevisionInputSchema>;
type InvoiceTemplatePublishSchemaInput = Infer<typeof InvoiceTemplatePublishSchema>;

export interface ListInvoiceTemplatesFilter {
  industry?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  lifecycle?: string | string[];
  documentType?: string | string[];
  limit?: number;
  offset?: number;
}

export type Permission = "view" | "edit" | "publish" | "archive";

export interface TemplatePermission {
  userId: string;
  permission: string;
}

export interface RenderData {
  business: RenderableBusiness;
  customer: RenderableCustomer | null;
  invoice: RenderableInvoice;
  lineItems: RenderableLineItem[];
  fees: RenderableFee[];
  totals: RenderableTotals;
  currency: string;
  locale?: string;
}

export interface InvoiceTemplateService {
  create(
    businessId: string,
    input: InvoiceTemplateInputSchemaInput,
    createdBy?: string | null
  ): Promise<InvoiceTemplate>;
  getTemplate(businessId: string, id: string): Promise<InvoiceTemplate>;
  listTemplates(
    businessId: string,
    filters?: ListInvoiceTemplatesFilter
  ): Promise<InvoiceTemplate[]>;
   getDefaultTemplate(businessId: string, industry?: string, documentType?: string): Promise<InvoiceTemplate | null>;
  updateTemplate(
    businessId: string,
    id: string,
    input: InvoiceTemplateUpdateSchemaInput,
    updatedBy?: string | null
  ): Promise<InvoiceTemplate>;
  deleteTemplate(businessId: string, id: string): Promise<void>;
  duplicateTemplate(
    businessId: string,
    id: string,
    createdBy?: string | null
  ): Promise<InvoiceTemplate>;
  setDefault(businessId: string, id: string): Promise<InvoiceTemplate>;
  publish(
    businessId: string,
    id: string,
    input?: InvoiceTemplatePublishSchemaInput,
    publishedBy?: string | null
  ): Promise<InvoiceTemplate>;
  archive(businessId: string, id: string, archivedBy?: string | null): Promise<InvoiceTemplate>;
  unarchive(businessId: string, id: string, unarchivedBy?: string | null): Promise<InvoiceTemplate>;
  createRevision(
    businessId: string,
    id: string,
    input: InvoiceTemplateRevisionInputSchemaInput,
    createdBy?: string | null
  ): Promise<InvoiceTemplateRevision>;
  getRevisions(businessId: string, id: string): Promise<InvoiceTemplateRevision[]>;
  getRevision(businessId: string, id: string, revision: number): Promise<InvoiceTemplateRevision>;
  restoreRevision(
    businessId: string,
    id: string,
    revision: number,
    restoredBy?: string | null
  ): Promise<InvoiceTemplate>;
  getWithRevisions(
    businessId: string,
    id: string
  ): Promise<InvoiceTemplate & { revisions: InvoiceTemplateRevision[] }>;
  migrateSchema(
    businessId: string,
    id: string,
    targetVersion?: string
  ): Promise<{ template: InvoiceTemplate; migrated: boolean }>;
  renderToHtml(
    businessId: string,
    id: string,
    renderData: RenderData
  ): Promise<string>;
  getUsageCount(businessId: string, id: string): Promise<number>;
  setPermission(
    businessId: string,
    templateId: string,
    userId: string,
    permission: Permission
  ): Promise<void>;
  getPermissions(businessId: string, templateId: string): Promise<TemplatePermission[]>;
  checkPermission(businessId: string, templateId: string, userId: string, permission: string): Promise<boolean>;
  recordUsage(businessId: string, templateId: string, invoiceId?: string | null): Promise<void>;
}

class InvoiceTemplateServiceImpl implements InvoiceTemplateService {
  async create(
    businessId: string,
    input: InvoiceTemplateInputSchemaInput,
    createdBy?: string | null
  ): Promise<InvoiceTemplate> {
    const parsed = InvoiceTemplateInputSchema.parse(input);
    return invoiceTemplateRepository.create(businessId, parsed, createdBy);
  }

  async getTemplate(businessId: string, id: string): Promise<InvoiceTemplate> {
    return invoiceTemplateRepository.findById(businessId, id);
  }

  async listTemplates(
    businessId: string,
    filters?: ListInvoiceTemplatesFilter
  ): Promise<InvoiceTemplate[]> {
    return invoiceTemplateRepository.findMany(businessId, filters);
  }

  async getDefaultTemplate(businessId: string, industry?: string, documentType?: string): Promise<InvoiceTemplate | null> {
    const opts: { industry?: string; documentType?: string } = {};
    if (industry) opts.industry = industry;
    if (documentType) opts.documentType = documentType;
    return invoiceTemplateRepository.findDefault(businessId, Object.keys(opts).length ? opts : undefined);
  }

  async updateTemplate(
    businessId: string,
    id: string,
    input: InvoiceTemplateUpdateSchemaInput,
    updatedBy?: string | null
  ): Promise<InvoiceTemplate> {
    const parsed = InvoiceTemplateUpdateSchema.parse(input);
    return invoiceTemplateRepository.update(businessId, id, parsed, updatedBy);
  }

  async deleteTemplate(businessId: string, id: string): Promise<void> {
    return invoiceTemplateRepository.delete(businessId, id);
  }

  async duplicateTemplate(
    businessId: string,
    id: string,
    createdBy?: string | null
  ): Promise<InvoiceTemplate> {
    return invoiceTemplateRepository.duplicate(businessId, id, createdBy);
  }

  async setDefault(businessId: string, id: string): Promise<InvoiceTemplate> {
    return invoiceTemplateRepository.setDefault(businessId, id);
  }

  async publish(
    businessId: string,
    id: string,
    input?: InvoiceTemplatePublishSchemaInput,
    publishedBy?: string | null
  ): Promise<InvoiceTemplate> {
    const template = await invoiceTemplateRepository.findById(businessId, id);

    if (template.lifecycle === "archived") {
      throw new BusinessLogicError("Cannot publish an archived template. Unarchive first.");
    }

    if (input) {
      InvoiceTemplatePublishSchema.parse(input);
    }
    return invoiceTemplateRepository.publish(businessId, id, publishedBy);
  }

  async archive(businessId: string, id: string, archivedBy?: string | null): Promise<InvoiceTemplate> {
    const template = await invoiceTemplateRepository.findById(businessId, id);
    if (template.isDefault && template.lifecycle === "published") {
      throw new BusinessLogicError("Cannot archive the default template. Change the default first.");
    }
    return invoiceTemplateRepository.archive(businessId, id, archivedBy);
  }

  async unarchive(businessId: string, id: string, unarchivedBy?: string | null): Promise<InvoiceTemplate> {
    return invoiceTemplateRepository.unarchive(businessId, id, unarchivedBy);
  }

  async createRevision(
    businessId: string,
    id: string,
    input: InvoiceTemplateRevisionInputSchemaInput,
    createdBy?: string | null
  ): Promise<InvoiceTemplateRevision> {
    const parsed = InvoiceTemplateRevisionInputSchema.parse(input);
    return invoiceTemplateRepository.createRevision(businessId, id, parsed, createdBy);
  }

  async getRevisions(businessId: string, id: string): Promise<InvoiceTemplateRevision[]> {
    return invoiceTemplateRepository.findRevisions(businessId, id);
  }

  async getRevision(businessId: string, id: string, revision: number): Promise<InvoiceTemplateRevision> {
    return invoiceTemplateRepository.findRevision(businessId, id, revision);
  }

  async restoreRevision(
    businessId: string,
    id: string,
    revision: number,
    restoredBy?: string | null
  ): Promise<InvoiceTemplate> {
    return invoiceTemplateRepository.restoreRevision(businessId, id, revision, restoredBy);
  }

  async getWithRevisions(
    businessId: string,
    id: string
  ): Promise<InvoiceTemplate & { revisions: InvoiceTemplateRevision[] }> {
    return invoiceTemplateRepository.findByIdWithRevisions(businessId, id);
  }

  async migrateSchema(
    businessId: string,
    id: string,
    targetVersion?: string
  ): Promise<{ template: InvoiceTemplate; migrated: boolean }> {
    const template = await invoiceTemplateRepository.findById(businessId, id);
    const target = targetVersion ?? templateMigrationEngine.currentVersion();

    if (template.schemaVersion === target) {
      return { template, migrated: false };
    }

    const { document, migrations } = await templateMigrationEngine.migrate(
      template.document as InvoiceTemplateDocument,
      template.schemaVersion,
      target,
      businessId,
      id
    );

    const updated = await invoiceTemplateRepository.update(
      businessId,
      id,
      { document: document as unknown as Record<string, unknown>, schemaVersion: target },
      undefined
    );

    logger.info(`Migrated template ${id} from ${template.schemaVersion} to ${target} (${migrations.length} steps)`);
    return { template: updated, migrated: true };
  }

  async renderToHtml(
    businessId: string,
    id: string,
    renderData: RenderData
  ): Promise<string> {
    const template = await invoiceTemplateRepository.findById(businessId, id);
    const doc = template.document as unknown as InvoiceTemplateDocument;

    const rendered = structuredTemplateRenderer.render(doc, {
      business: renderData.business,
      customer: renderData.customer,
      invoice: renderData.invoice,
      lineItems: renderData.lineItems,
      fees: renderData.fees,
      totals: renderData.totals,
      currency: renderData.currency as CurrencyCode,
      locale: renderData.locale,
    });

    return rendered;
  }

  async getUsageCount(businessId: string, id: string): Promise<number> {
    return invoiceTemplateRepository.countTemplateUsage(businessId, id);
  }

  async setPermission(
    businessId: string,
    templateId: string,
    userId: string,
    permission: Permission
  ): Promise<void> {
    await invoiceTemplateRepository.recordTemplatePermission(businessId, templateId, userId, permission);
  }

  async getPermissions(businessId: string, templateId: string): Promise<TemplatePermission[]> {
    return invoiceTemplateRepository.getTemplatePermissions(businessId, templateId);
  }

  async checkPermission(businessId: string, templateId: string, userId: string, permission: string): Promise<boolean> {
    return invoiceTemplateRepository.checkPermission(businessId, templateId, userId, permission);
  }

  async recordUsage(businessId: string, templateId: string, invoiceId?: string | null): Promise<void> {
    await invoiceTemplateRepository.recordUsage(businessId, templateId, invoiceId);
  }
}

export const invoiceTemplateService = new InvoiceTemplateServiceImpl();
