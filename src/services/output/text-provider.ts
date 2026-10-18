import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult } from "./types.js";

export class TextOutputProvider implements OutputProvider {
  readonly name = "text";
  readonly supportedFormats = ["txt" as const];

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { html, options } = input;
    const text = stripHtml(html);
    const data = Buffer.from(text, "utf-8");

    return {
      format: "txt",
      mimeType: "text/plain",
      filename: options.filename ?? `document-${options.docId ?? "output"}.txt`,
      data,
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
    };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head[^>]*>.*?<\/head>/gis, "")
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n\s*\n/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
