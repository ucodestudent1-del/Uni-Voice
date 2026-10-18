import { describe, it, expect } from "vitest";
import { OutputService } from "../src/services/output/output-service.js";
import { HtmlOutputProvider } from "../src/services/output/html-provider.js";
import { PdfOutputProvider } from "../src/services/output/pdf-provider.js";
import { TextOutputProvider } from "../src/services/output/text-provider.js";
import { CsvOutputProvider } from "../src/services/output/csv-provider.js";
import { EmailHtmlOutputProvider } from "../src/services/output/email-html-provider.js";
import { StubOutputProvider } from "../src/services/output/stub-provider.js";
import { OutputService as OS } from "../src/services/output/output-service.js";

describe("OutputService", () => {
  it("registers and retrieves providers by format", () => {
    const service = new OutputService();
    const htmlProvider = new HtmlOutputProvider();
    service.register("html", htmlProvider);

    expect(service.getProvider("html")).toBe(htmlProvider);
    expect(service.getProvider("pdf")).toBeNull();
  });

  it("reports supported formats", () => {
    const service = new OutputService();
    service.register("html", new HtmlOutputProvider());
    service.register("pdf", new PdfOutputProvider(true));

    expect(service.getSupportedFormats()).toContain("html");
    expect(service.getSupportedFormats()).toContain("pdf");
    expect(service.isSupported("html")).toBe(true);
    expect(service.isSupported("png")).toBe(false);
  });

  it("returns null for unregistered format when no fallback", () => {
    const service = new OutputService();
    expect(service.getProvider("png")).toBeNull();
  });

  it("falls back to fallbackProvider when format not registered", () => {
    const service = new OutputService();
    const fallback = new StubOutputProvider("png", "stub-png");
    service.registerFallback(fallback);

    expect(service.getProvider("png")).toBe(fallback);
    expect(service.isSupported("svg")).toBe(true);
  });

  it("getMimeType returns correct MIME types", () => {
    expect(OS.getMimeType("pdf")).toBe("application/pdf");
    expect(OS.getMimeType("html")).toBe("text/html");
    expect(OS.getMimeType("docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(OS.getMimeType("txt")).toBe("text/plain");
    expect(OS.getMimeType("csv")).toBe("text/csv");
    expect(OS.getMimeType("png")).toBe("image/png");
    expect(OS.getMimeType("svg")).toBe("image/svg+xml");
  });

  it("computes SHA-256 hash correctly", () => {
    const hash = OS.computeSha256("hello");
    expect(hash).toHaveLength(64);
  });

  it("builds filename with docId", () => {
    const filename = OS.buildFilename("invoice", "INV-001", "pdf");
    expect(filename).toBe("invoice-INV-001.pdf");
  });

  it("builds filename without docId", () => {
    const filename = OS.buildFilename("invoice", undefined, "pdf");
    expect(filename).toBe("invoice-document.pdf");
  });
});

describe("HtmlOutputProvider", () => {
  it("generates HTML output with correct format and mime type", async () => {
    const provider = new HtmlOutputProvider();
    const html = "<html><body>Test</body></html>";
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice" },
      options: { format: "html", docType: "invoice", docId: "test-1" },
    });

    expect(result.format).toBe("html");
    expect(result.mimeType).toBe("text/html");
    expect(result.filename).toBe("document-test-1.html");
    expect(result.data.toString()).toContain("Test");
  });
});

describe("TextOutputProvider", () => {
  it("strips HTML tags and returns plain text", async () => {
    const provider = new TextOutputProvider();
    const html = "<html><body><h1>Hello</h1><p>World</p></body></html>";
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice" },
      options: { format: "txt", docType: "invoice", docId: "test-1" },
    });

    expect(result.format).toBe("txt");
    expect(result.mimeType).toBe("text/plain");
    expect(result.data.toString()).toContain("Hello");
    expect(result.data.toString()).toContain("World");
    expect(result.data.toString()).not.toContain("<");
  });
});

describe("EmailHtmlOutputProvider", () => {
  it("preserves HTML structure for email embedding", async () => {
    const provider = new EmailHtmlOutputProvider();
    const html = "<html><head><style>.x{color:red}</style></head><body>Test</body></html>";
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice" },
      options: { format: "email-html", docType: "invoice", docId: "test-1" },
    });

    expect(result.format).toBe("email-html");
    expect(result.data.toString()).toContain("Test");
  });
});

describe("CsvOutputProvider", () => {
  it("generates CSV from template data line items", async () => {
    const provider = new CsvOutputProvider();
    const templateData = {
      lineItems: [
        {
          description: "Web Dev",
          quantity: 2,
          unit: "hour",
          unitPrice: 100,
          taxRate: 0.1,
          taxName: "VAT",
          taxAmount: 20,
          lineSubtotal: 200,
          lineTotal: 220,
          isTaxInclusive: false,
        },
      ],
      fees: [],
      totals: {
        subtotal: 200,
        discountTotal: 0,
        taxTotal: 20,
        feeTotal: 0,
        total: 220,
        amountPaid: 0,
        amountDue: 220,
      },
    };
     const result = await provider.generate({
      html: "",
      templateData: templateData as never,
      ctx: { currency: "USD", docType: "invoice" },
      options: { format: "csv", docType: "invoice", docId: "test-1" },
    });

    expect(result.format).toBe("csv");
    expect(result.mimeType).toBe("text/csv");
    const csv = result.data.toString();
    expect(csv).toContain("Web Dev");
    expect(csv).toContain("220");
  });

  it("escapes CSV values with commas", async () => {
    const provider = new CsvOutputProvider();
    const templateData = {
      lineItems: [
        {
          description: "Service, with comma",
          quantity: 1,
          unit: "each",
          unitPrice: 50,
          taxRate: 0,
          taxName: null,
          taxAmount: 0,
          lineSubtotal: 50,
          lineTotal: 50,
          isTaxInclusive: false,
        },
      ],
      fees: [],
      totals: {
        subtotal: 50,
        discountTotal: 0,
        taxTotal: 0,
        feeTotal: 0,
        total: 50,
        amountPaid: 0,
        amountDue: 50,
      },
    };
    const result = await provider.generate({
      html: "",
      templateData: templateData as never,
      ctx: { currency: "USD", docType: "invoice" },
      options: { format: "csv", docType: "invoice", docId: "test-1" },
    });

    const csv = result.data.toString();
    expect(csv).toContain('"Service, with comma"');
  });
});

describe("StubOutputProvider", () => {
  it("generates stub DOCX output", async () => {
    const provider = new StubOutputProvider("docx", "docx-stub");
    const result = await provider.generate({
      html: "<html><body>Test</body></html>",
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice" },
      options: { format: "docx", docType: "invoice", docId: "test-1" },
    });

    expect(result.format).toBe("docx");
    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(Buffer.isBuffer(result.data)).toBe(true);
    expect(result.sha256).toHaveLength(64);
  });

  it("generates stub PNG output", async () => {
    const provider = new StubOutputProvider("png", "png-stub");
    const result = await provider.generate({
      html: "<html><body>Test</body></html>",
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice" },
      options: { format: "png", docType: "invoice", docId: "test-1" },
    });

    expect(result.format).toBe("png");
    expect(result.mimeType).toBe("image/png");
    expect(Buffer.isBuffer(result.data)).toBe(true);
  });

  it("generates stub SVG output", async () => {
    const provider = new StubOutputProvider("svg", "svg-stub");
    const result = await provider.generate({
      html: "<html><body>Test</body></html>",
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice" },
      options: { format: "svg", docType: "invoice", docId: "test-1" },
    });

    expect(result.format).toBe("svg");
    expect(result.mimeType).toBe("image/svg+xml");
    expect(result.data.toString()).toContain("<svg");
  });
});

describe("PdfOutputProvider", () => {
  it("uses stub provider when configured", async () => {
    const provider = new PdfOutputProvider(true);
    const result = await provider.generate({
      html: "<html><body>Test</body></html>",
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice" },
      options: { format: "pdf", docType: "invoice", docId: "test-1" },
    });

    expect(result.format).toBe("pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(Buffer.isBuffer(result.data)).toBe(true);
    expect(result.sha256).toHaveLength(64);
    expect(result.filename).toBe("document-test-1.pdf");
    await provider.close();
  });
});
