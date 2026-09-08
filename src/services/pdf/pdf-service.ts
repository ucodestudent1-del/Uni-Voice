import type { Browser, Page, LaunchOptions, PDFOptions } from "puppeteer";
import { env } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import type { InvoiceTemplateData } from "../templates/template-renderer.js";

export interface PdfProvider {
  readonly name: string;
  generatePdf(html: string, data: InvoiceTemplateData): Promise<Buffer>;
}

export class PuppeteerPdfService implements PdfProvider {
  readonly name = "puppeteer";
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    const puppeteer = await this.loadPuppeteer();
    this.browser = await puppeteer.launch(this.launchOptions());
    return this.browser;
  }

  private async loadPuppeteer(): Promise<typeof import("puppeteer")> {
    try {
      return await import("puppeteer");
    } catch {
      throw new Error("puppeteer is not installed. Run `npm install puppeteer` to enable HTML PDF generation.");
    }
  }

  private launchOptions(): LaunchOptions {
    return { args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] };
  }

  async generatePdf(html: string, data: InvoiceTemplateData): Promise<Buffer> {
    await this.loadPuppeteer();
    let page: Page | null = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load", timeout: 15000 });
      const options: PDFOptions = {
        format: "A4",
        printBackground: true,
        margin: { top: "24px", right: "24px", bottom: "24px", left: "24px" },
      };
      const buffer = await page.pdf(options);
      return Buffer.from(buffer);
    } finally {
      if (page) await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export class StubPdfService implements PdfProvider {
  readonly name = "stub";
  async generatePdf(_html: string, data: InvoiceTemplateData): Promise<Buffer> {
    logger.warn(`[StubPdfService] Placeholder PDF for invoice ${data.invoice.invoiceNumber}. Configure puppeteer for real PDFs.`);
    const number = data.invoice.invoiceNumber ?? "INV";
    const pdf =
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n` +
      `4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 72 720 Td (Invoice ${number}) Tj ET\nendstream\nendobj\n` +
      `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n` +
      `xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000360 00000 n \n` +
      `trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n434\ntrue\n%%EOF`;
    return Buffer.from(pdf);
  }
}

export class PdfService {
  private provider: PdfProvider;

  constructor(provider?: PdfProvider) {
    this.provider = provider ?? PdfService.createProvider(env.PDF_PROVIDER);
  }

  static createProvider(type: string): PdfProvider {
    if (type === "html" || type === "puppeteer") return new PuppeteerPdfService();
    return new StubPdfService();
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async generatePdfFromHtml(html: string, data: InvoiceTemplateData): Promise<Buffer> {
    return this.provider.generatePdf(html, data);
  }

  async close(): Promise<void> {
    if (this.provider instanceof PuppeteerPdfService) await this.provider.close();
  }
}

export const pdfService = new PdfService();