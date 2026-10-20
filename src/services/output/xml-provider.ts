import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult } from "./types.js";

export class XmlOutputProvider implements OutputProvider {
  readonly name = "xml";
  readonly supportedFormats = ["xml" as const];

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { html, ctx, options } = input;

    const xml = this.buildXml(html, ctx);
    const data = Buffer.from(xml, "utf-8");

    return {
      format: "xml",
      mimeType: "application/xml",
      filename: options.filename ?? `document-${options.docId ?? "output"}.xml`,
      data,
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
    };
  }

  private buildXml(
    html: string,
    ctx: { currency: string; locale?: string; docType: string; docId?: string },
  ): string {
    const parts: string[] = [];

    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push(
      `<document type="${this.escapeXml(ctx.docType)}" id="${this.escapeXml(ctx.docId ?? "")}" currency="${this.escapeXml(ctx.currency)}" locale="${this.escapeXml(ctx.locale ?? "en")}" generated="${new Date().toISOString()}">`,
    );

    const title = this.extractFirstMatch(html, /<title[^>]*>(.*?)<\/title>/i);
    if (title) {
      parts.push(`  <title>${this.escapeXml(title)}</title>`);
    }

    const metaPairs = html.matchAll(/<meta[^>]+name=["']([^"']+)["'][^>]+content=["']([^"']*)["'][^>]*>/gi);
    for (const match of metaPairs) {
      parts.push(`  <meta name="${this.escapeXml(match[1])}">${this.escapeXml(match[2])}</meta>`);
    }

    const tables = this.extractTables(html);
    if (tables.length > 0) {
      parts.push("  <tables>");
      for (let t = 0; t < tables.length; t++) {
        parts.push(`    <table index="${t}">`);
        for (const row of tables[t]) {
          parts.push("      <row>");
          for (const cell of row) {
            parts.push(`        <cell>${this.escapeXml(cell)}</cell>`);
          }
          parts.push("      </row>");
        }
        parts.push("    </table>");
      }
      parts.push("  </tables>");
    }

    const body = this.extractBodyText(html);
    if (body) {
      parts.push("  <body>");
      parts.push(this.indentXml(body));
      parts.push("  </body>");
    }

    parts.push("</document>");
    return parts.join("\n");
  }

  private extractFirstMatch(html: string, regex: RegExp): string | null {
    const match = html.match(regex);
    return match ? match[1] : null;
  }

  private extractTables(html: string): string[][][] {
    const tables: string[][][] = [];
    const tableMatches = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);

    for (const tableMatch of tableMatches) {
      const table: string[][] = [];
      const rowMatches = tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

      for (const rowMatch of rowMatches) {
        const cells: string[] = [];
        const cellMatches = rowMatch[1].matchAll(/<(th|td)[^>]*>(.*?)<\/(th|td)>/gi);
        for (const cellMatch of cellMatches) {
          cells.push(this.cleanText(cellMatch[2]));
        }
        if (cells.length > 0) {
          table.push(cells);
        }
      }

      if (table.length > 0) {
        tables.push(table);
      }
    }

    return tables;
  }

  private extractBodyText(html: string): string {
    return html
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<html[^>]*>/gi, "")
      .replace(/<\/html>/gi, "")
      .replace(/<head[^>]*>.*?<\/head>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<title[^>]*>.*?<\/title>/gi, "")
      .replace(/<meta[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  private cleanText(text: string): string {
    return text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private indentXml(xml: string): string {
    return xml
      .split("\n")
      .map((line) => line.trim() ? `    ${line}` : "")
      .join("\n");
  }
}
