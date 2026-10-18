import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult } from "./types.js";

export class HtmlOutputProvider implements OutputProvider {
  readonly name = "html";
  readonly supportedFormats = ["html" as const];

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { html, options } = input;
    const data = Buffer.from(html, "utf-8");

    return {
      format: "html",
      mimeType: "text/html",
      filename: options.filename ?? `document-${options.docId ?? "output"}.html`,
      data,
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
    };
  }
}
