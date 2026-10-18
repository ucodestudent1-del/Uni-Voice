import type { DocumentTypeKey, DocumentTemplateData } from "../templates/template-renderer.js";

export type OutputFormat =
  | "pdf"
  | "html"
  | "docx"
  | "txt"
  | "csv"
  | "email-html"
  | "png"
  | "svg";

export interface OutputOptions {
  format: OutputFormat;
  docType: DocumentTypeKey;
  docId?: string;
  filename?: string;
  locale?: string;
  currency?: string;
  [key: string]: unknown;
}

export interface OutputResult {
  format: OutputFormat;
  mimeType: string;
  filename: string;
  data: string | Buffer;
  sha256: string;
  metadata?: Record<string, unknown>;
}

export interface OutputProvider {
  readonly name: string;
  readonly supportedFormats: OutputFormat[];
  generate(input: OutputProviderInput): Promise<OutputResult>;
}

export interface OutputProviderInput {
  html: string;
  templateData: DocumentTemplateData;
  ctx: RenderContext;
  options: OutputOptions;
}

export interface RenderContext {
  currency: string;
  locale?: string;
  docType: DocumentTypeKey;
  docId?: string;
}

export interface OutputServiceOptions {
  providers?: Map<OutputFormat, OutputProvider>;
  defaultProvider?: Record<OutputFormat, string>;
}
