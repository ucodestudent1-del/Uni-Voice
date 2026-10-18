import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult, OutputFormat, RenderContext, OutputServiceOptions } from "./types.js";

const DEFAULT_MIME_TYPES: Record<OutputFormat, string> = {
  pdf: "application/pdf",
  html: "text/html",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  csv: "text/csv",
  "email-html": "text/html",
  png: "image/png",
  svg: "image/svg+xml",
};

export class OutputService {
  private providers: Map<OutputFormat, OutputProvider> = new Map();
  private fallbackProvider: OutputProvider | null = null;

  constructor(opts?: OutputServiceOptions) {
    if (opts?.providers) {
      for (const [format, provider] of opts.providers) {
        this.register(format, provider);
      }
    }
  }

  register(format: OutputFormat, provider: OutputProvider): void {
    this.providers.set(format, provider);
  }

  registerFallback(provider: OutputProvider): void {
    this.fallbackProvider = provider;
  }

  getProvider(format: OutputFormat): OutputProvider | null {
    const provider = this.providers.get(format);
    if (provider) return provider;
    return this.fallbackProvider;
  }

  isSupported(format: OutputFormat): boolean {
    return this.providers.has(format) || this.fallbackProvider !== null;
  }

  getSupportedFormats(): OutputFormat[] {
    const formats = Array.from(this.providers.keys());
    if (this.fallbackProvider) {
      formats.push(...this.fallbackProvider.supportedFormats.filter((f) => !formats.includes(f)));
    }
    return formats;
  }

  async generate(
    format: OutputFormat,
    html: string,
    ctx: RenderContext,
  ): Promise<OutputResult> {
    const provider = this.getProvider(format);
    if (!provider) {
      throw new Error(`No output provider registered for format: ${format}`);
    }

    const input: OutputProviderInput = {
      html,
      templateData: {} as Parameters<typeof provider.generate>[0]["templateData"],
      ctx,
      options: { format, docType: ctx.docType, docId: ctx.docId, locale: ctx.locale, currency: ctx.currency },
    };

    const result = await provider.generate(input);
    return result;
  }

  async generateFromInput(input: OutputProviderInput): Promise<OutputResult> {
    const provider = this.getProvider(input.options.format);
    if (!provider) {
      throw new Error(`No output provider registered for format: ${input.options.format}`);
    }
    return provider.generate(input);
  }

  static getMimeType(format: OutputFormat): string {
    return DEFAULT_MIME_TYPES[format] ?? "application/octet-stream";
  }

  static computeSha256(data: string | Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  static buildFilename(docType: string, docId: string | undefined, format: OutputFormat, extension?: string): string {
    const ext = extension ?? format;
    const base = docId ? `${docType}-${docId}` : `${docType}-document`;
    return `${base}.${ext}`;
  }
}
