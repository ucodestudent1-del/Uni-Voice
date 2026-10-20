import { createDefaultOutputService } from "./output/index.js";
import type { OutputFormat } from "./output/types.js";
import type { OutputService } from "./output/output-service.js";
import { OutputService as OS } from "./output/output-service.js";
import { documentArtifactService } from "./document-artifact-service.js";
import type { DocumentArtifactService } from "./document-artifact-service.js";
import { templateRenderer, type DocumentTemplateData, type DocumentTypeKey } from "./templates/template-renderer.js";
import { normalizeDocumentTypeKey } from "../domain/schemas/invoice-template.js";

export type { DocumentTypeKey };

export interface FinalizeDocumentResult {
  document: Record<string, unknown>;
  documentNumber: string;
  status: string;
}

export interface SendDocumentResult {
  ok: boolean;
  success: boolean;
  messageId: string;
  status: string;
  document?: Record<string, unknown>;
}

export interface GeneratedDocumentOutput {
  format: OutputFormat;
  mimeType: string;
  filename: string;
  data: string | Buffer;
  sha256: string;
  fromCache: boolean;
  metadata?: Record<string, unknown>;
}

export interface DocumentHandler {
  toTemplateData(businessId: string, docId: string): Promise<DocumentTemplateData>;
  finalize?(businessId: string, docId: string, userId?: string): Promise<FinalizeDocumentResult>;
  send?(businessId: string, docId: string, payload: Record<string, unknown>, userId?: string): Promise<SendDocumentResult>;
  generatePdf?(businessId: string, docId: string): Promise<Buffer>;
  validate?(doc: Record<string, unknown>): { valid: boolean; errors: string[] };
}

export interface DocumentServiceOptions {
  outputService?: OutputService;
  artifactService?: DocumentArtifactService;
  handlers?: Map<DocumentTypeKey, DocumentHandler>;
}

export class DocumentService {
  private outputService: OutputService;
  private artifactService: DocumentArtifactService;
  private handlers: Map<DocumentTypeKey, DocumentHandler>;

  constructor(opts?: DocumentServiceOptions) {
    this.outputService = opts?.outputService ?? createDefaultOutputService();
    this.artifactService = opts?.artifactService ?? documentArtifactService;
    this.handlers = opts?.handlers ?? new Map();
  }

  registerHandler(docType: DocumentTypeKey, handler: DocumentHandler): void {
    this.handlers.set(docType, handler);
  }

  getHandler(docType: DocumentTypeKey): DocumentHandler {
    const handler = this.handlers.get(docType);
    if (!handler) {
      throw new Error(`No document handler registered for type: ${docType}`);
    }
    return handler;
  }

  hasHandler(docType: DocumentTypeKey): boolean {
    return this.handlers.has(docType);
  }

  async createDocument(
    docType: DocumentTypeKey,
    businessId: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const handler = this.getHandler(docType);
    if (handler.toTemplateData) {
      return handler.toTemplateData(businessId, input.id as string) as Promise<any>;
    }
    throw new Error(`Handler for ${docType} does not support create`);
  }

  async updateDocument(
    docType: DocumentTypeKey,
    businessId: string,
    docId: string,
    _input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const handler = this.getHandler(docType);
    if (handler.toTemplateData) {
      return handler.toTemplateData(businessId, docId) as Promise<any>;
    }
    throw new Error(`Handler for ${docType} does not support update`);
  }

  async finalizeDocument(
    docType: DocumentTypeKey,
    businessId: string,
    docId: string,
    userId?: string,
  ): Promise<FinalizeDocumentResult> {
    const handler = this.getHandler(docType);
    if (!handler.finalize) {
      throw new Error(`Handler for ${docType} does not support finalize`);
    }
    return handler.finalize(businessId, docId, userId);
  }

  async sendDocument(
    docType: DocumentTypeKey,
    businessId: string,
    docId: string,
    payload: Record<string, unknown>,
    userId?: string,
  ): Promise<SendDocumentResult> {
    const handler = this.getHandler(docType);
    if (!handler.send) {
      throw new Error(`Handler for ${docType} does not support send`);
    }
    return handler.send(businessId, docId, payload, userId);
  }

  async generateOutput(
    docType: DocumentTypeKey,
    businessId: string,
    docId: string,
    format: OutputFormat = "pdf",
    templateHtml?: string,
  ): Promise<GeneratedDocumentOutput> {
    const handler = this.getHandler(docType);

    const snakeType = normalizeDocumentTypeKey(docType);
    const existing = await this.artifactService.getByKey(businessId, docId, snakeType, format);
    if (existing) {
      return {
        format: existing.outputFormat as OutputFormat,
        mimeType: OS.getMimeType(existing.outputFormat as OutputFormat),
        filename: OS.buildFilename(docType, docId, existing.outputFormat as OutputFormat),
        data: existing.filePath,
        sha256: existing.sha256,
        fromCache: true,
        metadata: existing.metadata,
      };
    }

    const templateData = await handler.toTemplateData(businessId, docId);
    const html = await templateRenderer.renderUnified(docType, templateData, templateHtml);

    const result = await this.outputService.generate(format, html, {
      currency: this.extractCurrency(templateData),
      docType,
      docId,
    });

    await this.artifactService.store({
      businessId,
      documentId: docId,
      documentType: snakeType,
      outputFormat: format,
      data: result.data,
      metadata: result.metadata ?? {},
      generatedBy: "document-service",
    });

    return {
      format: result.format,
      mimeType: result.mimeType,
      filename: result.filename,
      data: result.data,
      sha256: result.sha256,
      fromCache: false,
      metadata: result.metadata,
    };
  }

  async getDocumentArtifacts(
    businessId: string,
    docId: string,
    docType?: string,
  ): Promise<any[]> {
    const snakeType = docType ? normalizeDocumentTypeKey(docType as DocumentTypeKey) : undefined;
    const raw = snakeType
      ? await this.artifactService.list(businessId, docId, snakeType)
      : await this.artifactService.list(businessId, docId);
    return raw.map((a) => ({
      id: a.id,
      outputFormat: a.outputFormat,
      fileUrl: a.fileUrl,
      sha256: a.sha256,
      fileSizeBytes: a.fileSizeBytes,
      generatedAt: a.generatedAt,
      metadata: a.metadata,
    }));
  }

  private extractCurrency(data: DocumentTemplateData): string {
    if ("invoice" in data) return data.invoice.currency;
    if ("creditNote" in data) return data.creditNote.currency;
    if ("quote" in data) return data.quote.currency;
    if ("debitNote" in data) return data.debitNote.currency;
    if ("voucher" in data) return data.voucher.currency;
    if ("receipt" in data) return data.receipt.currency;
    if ("purchaseOrder" in data) return data.purchaseOrder.currency;
    if ("recurringInvoice" in data) return data.recurringInvoice.currency;
    if ("deliveryNote" in data) return data.deliveryNote.currency;
    if ("packingSlip" in data) return data.packingSlip.currency;
    if ("proFormaInvoice" in data) return data.proFormaInvoice.currency;
    if ("estimate" in data) return data.estimate.currency;
    return "USD";
  }
}
