import crypto from "node:crypto";
import type { OutputProvider, OutputProviderInput, OutputResult } from "./types.js";
import type { TemplateTotals, TemplateLineItem, TemplateFee } from "../templates/template-renderer.js";

export class CsvOutputProvider implements OutputProvider {
  readonly name = "csv";
  readonly supportedFormats = ["csv" as const];

  async generate(input: OutputProviderInput): Promise<OutputResult> {
    const { ctx, options } = input;
    void ctx;
    const csv = buildCsv(input);
    const data = Buffer.from(csv, "utf-8");

    return {
      format: "csv",
      mimeType: "text/csv",
      filename: options.filename ?? `document-${options.docId ?? "output"}.csv`,
      data,
      sha256: crypto.createHash("sha256").update(data).digest("hex"),
    };
  }
}

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const str = typeof value === "string" ? value : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(input: OutputProviderInput): string {
  const { templateData, options } = input;
  void options;
  const lines: string[] = [];

  const lineItems = (templateData as unknown as { lineItems?: TemplateLineItem[] }).lineItems ?? [];
  const fees = (templateData as unknown as { fees?: TemplateFee[] }).fees ?? [];
  const totals = (templateData as unknown as { totals?: TemplateTotals }).totals;

  lines.push(csvEscape("description"), csvEscape("quantity"), csvEscape("unit"), csvEscape("unitPrice"), csvEscape("taxRate"), csvEscape("taxName"), csvEscape("taxAmount"), csvEscape("lineSubtotal"), csvEscape("lineTotal"));

  for (const li of lineItems) {
    lines.push(
      csvEscape(li.description),
      csvEscape(li.quantity),
      csvEscape(li.unit),
      csvEscape(li.unitPrice),
      csvEscape(li.taxRate),
      csvEscape(li.taxName ?? ""),
      csvEscape(li.taxAmount),
      csvEscape(li.lineSubtotal),
      csvEscape(li.lineTotal),
    );
  }

  if (fees.length > 0) {
    lines.push("");
    lines.push("Fees:");
    lines.push(csvEscape("description"), csvEscape("amount"), csvEscape("taxRate"), csvEscape("taxName"), csvEscape("taxAmount"), csvEscape("feeTotal"));
    for (const fee of fees) {
      lines.push(
        csvEscape(fee.description),
        csvEscape(fee.amount),
        csvEscape(fee.taxRate),
        csvEscape(fee.taxName ?? ""),
        csvEscape(fee.taxAmount),
        csvEscape((fee as unknown as { feeTotal?: unknown }).feeTotal ?? ""),
      );
    }
  }

  if (totals) {
    lines.push("");
    lines.push("Totals:");
    lines.push(csvEscape("subtotal"), csvEscape(totals.subtotal));
    lines.push(csvEscape("discount_total"), csvEscape(totals.discountTotal));
    lines.push(csvEscape("tax_total"), csvEscape(totals.taxTotal));
    lines.push(csvEscape("fee_total"), csvEscape(totals.feeTotal));
    lines.push(csvEscape("total"), csvEscape(totals.total));
    lines.push(csvEscape("amount_due"), csvEscape(totals.amountDue));
  }

  return lines.join("\n");
}
