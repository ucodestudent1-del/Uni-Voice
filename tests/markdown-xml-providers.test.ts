import { describe, it, expect } from "vitest";
import { MarkdownOutputProvider } from "../src/services/output/markdown-provider.js";
import { XmlOutputProvider } from "../src/services/output/xml-provider.js";
import { OutputService } from "../src/services/output/output-service.js";
import type { OutputFormat, OutputProviderInput } from "../src/services/output/types.js";

describe("MarkdownOutputProvider", () => {
  const provider = new MarkdownOutputProvider();

  it("registers with correct name and supported formats", () => {
    expect(provider.name).toBe("markdown");
    expect(provider.supportedFormats).toContain("markdown");
  });

  it("converts HTML headings to markdown", async () => {
    const html = "<h1>Title</h1><h2>Subtitle</h2><p>Content</p>";
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice", docId: "test-123" },
      options: { format: "markdown", docType: "invoice", docId: "test-123", locale: "en", currency: "USD" },
    });

    expect(result.format).toBe("markdown");
    expect(result.mimeType).toBe("text/markdown");
    expect(result.filename).toBe("document-test-123.md");
    expect(result.data.toString()).toContain("# Title");
    expect(result.data.toString()).toContain("## Subtitle");
  });

  it("converts HTML lists to markdown", async () => {
    const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice", docId: "test-123" },
      options: { format: "markdown", docType: "invoice", docId: "test-123", locale: "en", currency: "USD" },
    });

    const markdown = result.data.toString();
    expect(markdown).toContain("- Item 1");
    expect(markdown).toContain("- Item 2");
  });

  it("converts HTML tables to markdown", async () => {
    const html = "<table><tr><th>Name</th><th>Price</th></tr><tr><td>Item</td><td>$10</td></tr></table>";
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice", docId: "test-123" },
      options: { format: "markdown", docType: "invoice", docId: "test-123", locale: "en", currency: "USD" },
    });

    const markdown = result.data.toString();
    expect(markdown).toContain("| Name");
    expect(markdown).toContain("| Price");
  });

  it("converts HTML links to markdown", async () => {
    const html = '<a href="https://example.com">Example</a>';
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice", docId: "test-123" },
      options: { format: "markdown", docType: "invoice", docId: "test-123", locale: "en", currency: "USD" },
    });

    expect(result.data.toString()).toContain("[Example](https://example.com)");
  });

  it("computes SHA-256 hash", async () => {
    const result = await provider.generate({
      html: "<p>Test</p>",
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice", docId: "test-123" },
      options: { format: "markdown", docType: "invoice", docId: "test-123", locale: "en", currency: "USD" },
    });

    expect(result.sha256).toHaveLength(64);
  });
});

describe("XmlOutputProvider", () => {
  const provider = new XmlOutputProvider();

  it("registers with correct name and supported formats", () => {
    expect(provider.name).toBe("xml");
    expect(provider.supportedFormats).toContain("xml");
  });

  it("generates valid XML with document metadata", async () => {
    const html = "<html><head><title>Test Document</title></head><body>Hello</body></html>";
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice", docId: "test-123" },
      options: { format: "xml", docType: "invoice", docId: "test-123", locale: "en", currency: "USD" },
    });

    expect(result.format).toBe("xml");
    expect(result.mimeType).toBe("application/xml");
    expect(result.filename).toBe("document-test-123.xml");

    const xml = result.data.toString();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<document type="invoice"');
    expect(xml).toContain('id="test-123"');
    expect(xml).toContain('currency="USD"');
    expect(xml).toContain("<title>Test Document</title>");
  });

  it("extracts meta tags as XML elements", async () => {
    const html = '<html><head><meta name="author" content="John Doe"></head><body>Test</body></html>';
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice", docId: "test-123" },
      options: { format: "xml", docType: "invoice", docId: "test-123", locale: "en", currency: "USD" },
    });

    const xml = result.data.toString();
    expect(xml).toContain('<meta name="author">John Doe</meta>');
  });

  it("extracts HTML tables as XML", async () => {
    const html = "<table><tr><th>Col1</th><th>Col2</th></tr><tr><td>Val1</td><td>Val2</td></tr></table>";
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice", docId: "test-123" },
      options: { format: "xml", docType: "invoice", docId: "test-123", locale: "en", currency: "USD" },
    });

    const xml = result.data.toString();
    expect(xml).toContain("<tables>");
    expect(xml).toContain("<table");
    expect(xml).toContain("<row>");
    expect(xml).toContain("<cell>Col1</cell>");
    expect(xml).toContain("<cell>Val1</cell>");
  });

  it("escapes XML special characters", async () => {
    const html = "<html><body>Text with <special> & \"quotes\"</body></html>";
    const result = await provider.generate({
      html,
      templateData: {} as never,
      ctx: { currency: "USD", docType: "invoice", docId: "test-123" },
      options: { format: "xml", docType: "invoice", docId: "test-123", locale: "en", currency: "USD" },
    });

    const xml = result.data.toString();
    expect(xml).not.toContain("<special>");
  });
});

describe("OutputService with new providers", () => {
  it("returns correct MIME types for new formats", () => {
    const { OutputService } = require("../src/services/output/output-service.js");
    expect(OutputService.getMimeType("markdown")).toBe("text/markdown");
    expect(OutputService.getMimeType("xml")).toBe("application/xml");
  });

  it("registers markdown and xml providers in default service", () => {
    const { createDefaultOutputService } = require("../src/services/output/index.js");
    const service = createDefaultOutputService();
    expect(service.isSupported("markdown")).toBe(true);
    expect(service.isSupported("xml")).toBe(true);
  });
});
