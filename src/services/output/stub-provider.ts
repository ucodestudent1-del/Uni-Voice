import type { OutputProvider, OutputProviderInput, OutputResult, OutputFormat, RenderContext } from "./types.js";
import crypto from "node:crypto";

export class StubOutputProvider implements OutputProvider {
  readonly name: string;
  readonly supportedFormats: OutputFormat[];

  constructor(
    format: OutputFormat,
    name?: string,
  ) {
    this.supportedFormats = [format];
    this.name = name ?? `stub-${format}`;
  }

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { html, ctx, options } = input;
    const format = options.format;
    const sha256 = crypto.createHash("sha256").update(html).digest("hex");

    let data: string | Buffer;
    let mimeType: string;
    let filename: string;

    switch (format) {
      case "docx":
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        filename = options.filename ?? `document-${options.docId ?? "output"}.docx`;
        data = await this.generateStubDocx(html, ctx);
        break;
      case "png":
        mimeType = "image/png";
        filename = options.filename ?? `document-${options.docId ?? "output"}.png`;
        data = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
        break;
      case "svg":
        mimeType = "image/svg+xml";
        filename = options.filename ?? `document-${options.docId ?? "output"}.svg`;
        data = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="800" height="100"><text x="10" y="50">Document ${options.docId ?? ""}</text></svg>`;
        break;
      default:
        mimeType = "application/octet-stream";
        filename = options.filename ?? `document-${options.docId ?? "output"}.${format}`;
        data = html;
        break;
    }

    return {
      format,
      mimeType,
      filename,
      data,
      sha256,
    };
  }

  private async generateStubDocx(_html: string, _ctx: RenderContext): Promise<Buffer> {
    const docxXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Document generated from HTML (stub - install html-to-docx for full fidelity)</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

    const base64Docx = [
      "UEsDBAoAAAAAALyFVFYAAAAAAAAAAAAAAAAJAAAA",
      "d29yZC9fcmVscy9fcmVscy54bWwucmVsc1VUCQAD",
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "AIdzQ3b1BQYFBQAAAAEAAgD+AA==",
      "UEsCBAgAGQAAALMF1lkAAAAAAAAAAAAAAAA",
      "DwAAAAAAd29yZC9fcmVscy9fcmVscy54bWwucmVsc1VUBQAD",
      "AAAAAAAAAAQAO1NFUEsFBgAAAAABAAEAPwAAAE4BAAAAAA==",
    ].join("");

    void docxXml;
    return Buffer.from(base64Docx, "base64");
  }
}
