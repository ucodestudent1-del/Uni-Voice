import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult } from "./types.js";

export class MarkdownOutputProvider implements OutputProvider {
  readonly name = "markdown";
  readonly supportedFormats = ["markdown" as const];

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { html, options } = input;
    const markdown = htmlToMarkdown(html);
    const data = Buffer.from(markdown, "utf-8");

    return {
      format: "markdown",
      mimeType: "text/markdown",
      filename: options.filename ?? `document-${options.docId ?? "output"}.md`,
      data,
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
    };
  }
}

function htmlToMarkdown(html: string): string {
  let md = html;

  md = md.replace(/<!DOCTYPE[^>]*>/gi, "");
  md = md.replace(/<html[^>]*>/gi, "");
  md = md.replace(/<\/html>/gi, "");
  md = md.replace(/<head[^>]*>.*?<\/head>/gis, "");
  md = md.replace(/<style[^>]*>.*?<\/style>/gis, "");
  md = md.replace(/<script[^>]*>.*?<\/script>/gis, "");

  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n\n");
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n\n");
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "\n##### $1\n\n");
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "\n###### $1\n\n");

  md = md.replace(/<table[^>]*>/gi, "\n\n| ");
  md = md.replace(/<tr[^>]*>/gi, "| ");
  md = md.replace(/<th[^>]*>(.*?)<\/th>/gi, "$1 | ");
  md = md.replace(/<td[^>]*>(.*?)<\/td>/gi, "$1 | ");
  md = md.replace(/<\/tr>/gi, "\n");
  md = md.replace(/<\/table>/gi, "\n");

  md = md.replace(/<ul[^>]*>/gi, "\n");
  md = md.replace(/<ol[^>]*>/gi, "\n");
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/ul>/gi, "\n");
  md = md.replace(/<\/ol>/gi, "\n");

  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1\n\n");
  md = md.replace(/<br\s*\/?>/gi, "\n\n");
  md = md.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "_$1_");
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "_$1_");
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, "<u>$1</u>");
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gi, "\n```\n$1\n```\n");
  md = md.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<a[^>]*>(.*?)<\/a>/gi, "$1");

  md = md.replace(/<div[^>]*>/gi, "\n");
  md = md.replace(/<\/div>/gi, "\n");
  md = md.replace(/<span[^>]*>/gi, "");
  md = md.replace(/<\/span>/gi, "");
  md = md.replace(/<p[^>]*>/gi, "\n");
  md = md.replace(/<\/p>/gi, "\n\n");

  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#039;/g, "'");
  md = md.replace(/&apos;/g, "'");
  md = md.replace(/&hellip;/g, "...");
  md = md.replace(/&mdash;/g, "\u2014");
  md = md.replace(/&ndash;/g, "\u2013");
  md = md.replace(/&ldquo;/g, "\u201C");
  md = md.replace(/&rdquo;/g, "\u201D");
  md = md.replace(/&lsquo;/g, "\u2018");
  md = md.replace(/&rsquo;/g, "\u2019");

  md = md.replace(/\n\s*\n\s*\n/g, "\n\n");
  md = md.replace(/[ \t]+\n/g, "\n");
  md = md.replace(/(?!^)~\n/g, "\n");
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.trim();

  return md;
}
