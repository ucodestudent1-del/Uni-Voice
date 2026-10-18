import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult } from "./types.js";

export class EmailHtmlOutputProvider implements OutputProvider {
  readonly name = "email-html";
  readonly supportedFormats = ["email-html" as const];

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { html, options } = input;
    const inlined = inlineCssForEmail(html);
    const data = Buffer.from(inlined, "utf-8");

    return {
      format: "email-html",
      mimeType: "text/html",
      filename: options.filename ?? `document-${options.docId ?? "output"}.html`,
      data,
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
    };
  }
}

function inlineCssForEmail(html: string): string {
  return html
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_match, css) => {
      return `<style>${css.replace(/\s+/g, " ").trim()}</style>`;
    })
    .replace(/<head>/i, '<head><meta name="color-scheme" content="light">')
    .replace(
      /<body[^>]*>/i,
      '<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;">',
    )
    .replace(
      /<table[^>]*class="line-items"[^>]*>/gi,
      '<table class="line-items" style="width:100%;border-collapse:collapse;font-size:14px;">',
    )
    .replace(
      /<th[^>]*>(.*?<\/th>)/gi,
      (m) => m.replace(/\s*style="[^"]*"/g, ""),
    );
}
