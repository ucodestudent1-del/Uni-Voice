import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult } from "./types.js";
import { PuppeteerPdfService, StubPdfService } from "../pdf/pdf-service.js";
import type { DocumentTemplateData } from "../templates/template-renderer.js";
import { env } from "../../config/index.js";

export class PdfOutputProvider implements OutputProvider {
  readonly name: string;
  readonly supportedFormats = ["pdf" as const];
  private readonly useStub: boolean;
  private puppeteerService: PuppeteerPdfService | null = null;
  private stubService: StubPdfService | null = null;

  constructor(useStub = false) {
    this.useStub = useStub || env.PDF_PROVIDER !== "html";
    this.name = this.useStub ? "pdf-stub" : "pdf-puppeteer";
  }

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { html, templateData, options } = input;
    const data = templateData as unknown as DocumentTemplateData;

    let buffer: Buffer;

    if (this.useStub) {
      if (!this.stubService) {
        this.stubService = new StubPdfService();
      }
      buffer = await this.stubService.generatePdf(html, data);
    } else {
      if (!this.puppeteerService) {
        this.puppeteerService = new PuppeteerPdfService();
      }
      buffer = await this.puppeteerService.generatePdf(html, data);
    }

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    return {
      format: "pdf",
      mimeType: "application/pdf",
      filename: options.filename ?? `document-${options.docId ?? "output"}.pdf`,
      data: buffer,
      sha256,
    };
  }

  async close(): Promise<void> {
    if (this.puppeteerService) {
      await this.puppeteerService.close();
      this.puppeteerService = null;
    }
    this.stubService = null;
  }
}
