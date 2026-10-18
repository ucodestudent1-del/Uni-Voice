import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult } from "./types.js";
import type { Browser, Page, LaunchOptions } from "puppeteer";
import { env } from "../../config/index.js";

export class PngOutputProvider implements OutputProvider {
  readonly name = "png";
  readonly supportedFormats = ["png" as const];
  private browser: Browser | null = null;

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { html, options } = input;

    if (env.PDF_PROVIDER !== "html") {
      throw new Error("PngOutputProvider requires puppeteer. Set PDF_PROVIDER=html");
    }

    const width = typeof options.width === "number" ? options.width : 1280;
    const buffer = await this.screenshotToPng(html, width);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    return {
      format: "png",
      mimeType: "image/png",
      filename: options.filename ?? `document-${options.docId ?? "output"}.png`,
      data: buffer,
      sha256,
    };
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    const puppeteer = await import("puppeteer");
    this.browser = await puppeteer.launch(this.launchOptions());
    return this.browser;
  }

  private launchOptions(): LaunchOptions {
    return { args: ["--no-sandbox", "--disable-setuid-font", "--disable-gpu"] };
  }

  private async screenshotToPng(html: string, width: number): Promise<Buffer> {
    const browser = await this.getBrowser();
    let page: Page | null = null;
    try {
      page = await browser.newPage();
      await page.setViewport({ width, height: 100, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "load", timeout: 15000 });

      const height = await page.evaluate(() => (globalThis as any).document.body.scrollHeight);
      await page.setViewport({ width, height: Number(height), deviceScaleFactor: 2 });

      const screenshot = await page.screenshot({ fullPage: true, type: "png" });
      return Buffer.from(screenshot);
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
