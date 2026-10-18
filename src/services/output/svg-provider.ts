import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult } from "./types.js";
import type { Browser, Page, LaunchOptions } from "puppeteer";
import { env } from "../../config/index.js";

export class SvgOutputProvider implements OutputProvider {
  readonly name = "svg";
  readonly supportedFormats = ["svg" as const];
  private browser: Browser | null = null;

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { html, options } = input;

    if (env.PDF_PROVIDER !== "html") {
      throw new Error("SvgOutputProvider requires puppeteer. Set PDF_PROVIDER=html");
    }

    const width = typeof options.width === "number" ? options.width : 1280;
    const svg = await this.pageToSvg(html, width);
    const data = Buffer.from(svg, "utf-8");
    const sha256 = crypto.createHash("sha256").update(data).digest("hex");

    return {
      format: "svg",
      mimeType: "image/svg+xml",
      filename: options.filename ?? `document-${options.docId ?? "output"}.svg`,
      data,
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

  private async pageToSvg(html: string, width: number): Promise<string> {
    const browser = await this.getBrowser();
    let page: Page | null = null;
    try {
      page = await browser.newPage();
      await page.setViewport({ width, height: 100, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "load", timeout: 15000 });

      const height = await page.evaluate(() => (globalThis as any).document.body.scrollHeight);
      const heightNum = Number(height);
      await page.setViewport({ width, height: heightNum, deviceScaleFactor: 1 });

      await page.waitForFunction("document.fonts.ready", { timeout: 5000 }).catch(() => {});

      const svg = await page.evaluate((w: number, h: number) => {
        const doc = (globalThis as any).document;
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <foreignObject width="${w}" height="${h}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;">
      ${doc.body.innerHTML}
    </div>
  </foreignObject>
</svg>`;
      }, width, heightNum);

      return svg;
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
