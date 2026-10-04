import { logger } from "../utils/logger.js";
import { customerService } from "./customer-service.js";
import { productServiceService } from "./product-service/product-service.js";
import type { InvoiceTemplate } from "../domain/models/index.js";

export interface ParsedLineItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  taxRate?: number;
  isTaxInclusive?: boolean;
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
}

export interface ParsedFee {
  description: string;
  amount: number;
  taxRate?: number;
}

export interface ParsedDocumentFields {
  customerId?: string | null;
  currency?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  items: ParsedLineItem[];
  fees: ParsedFee[];
  taxRate?: number;
}

export interface ParsedDocumentResult {
  fields: ParsedDocumentFields;
  confidence: number;
  matchedCustomer: { id: string; name: string; email: string | null } | null;
  matchedProducts: { id: string; name: string; sku: string | null }[];
  suggestions: string[];
}

export interface AiParseOptions {
  documentType?: "invoice" | "quote" | "credit_note";
  businessId: string;
}

/**
 * Stub AI service for parsing natural-language text into structured document fields.
 * In production, this would call an LLM provider (OpenAI, Anthropic, etc.).
 * For now, it uses rule-based extraction as a placeholder.
 */
export class AiService {
  async parseDocument(text: string, opts: AiParseOptions): Promise<ParsedDocumentResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return this.emptyResult();
    }

    logger.info(`AI parsing document text (${trimmed.length} chars), business: ${opts.businessId}`);

    try {
      const fields = this.extractFields(text);
      const result = await this.enrichWithEntities(fields, opts.businessId);
      return {
        fields: result.fields,
        confidence: result.confidence,
        matchedCustomer: result.matchedCustomer,
        matchedProducts: result.matchedProducts,
        suggestions: result.suggestions,
      };
    } catch (err) {
      logger.error("AI parse error: %s", err);
      return this.emptyResult();
    }
  }

  private emptyResult(): ParsedDocumentResult {
    return {
      fields: {
        customerId: null,
        currency: "USD",
        issueDate: null,
        dueDate: null,
        notes: null,
        terms: null,
        items: [],
        fees: [],
        taxRate: 0,
      },
      confidence: 0,
      matchedCustomer: null,
      matchedProducts: [],
      suggestions: ["Try describing the work done, e.g. '5 hours consulting at $100/hr for Acme Corp'"],
    };
  }

  private extractFields(text: string): ParsedDocumentFields {
    const fields: ParsedDocumentFields = {
      customerId: null,
      currency: "USD",
      issueDate: null,
      dueDate: null,
      notes: null,
      terms: null,
      items: [],
      fees: [],
      taxRate: 0,
    };

    const lower = text.toLowerCase();

    const currencyMatch = text.match(/\b(USD|EUR|GBP|CAD|AUD|JPY|CHF)\b/i);
    if (currencyMatch) {
      fields.currency = currencyMatch[1].toUpperCase();
    }

    const taxMatch = lower.match(/(\d+(?:\.\d+)?)\s*%\s*tax|tax\s*(?:rate)?\s*(\d+(?:\.\d+)?)%/i);
    if (taxMatch) {
      fields.taxRate = parseFloat(taxMatch[1] || taxMatch[2]);
    }

    const itemPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:x|units?|qty)?\s*([a-zA-Z\s]+?)\s*(?:at|@)\s*\$?(\d+(?:\.\d+)?)/gi,
      /(\d+(?:\.\d+)?)\s*(?:x|units?|qty)?\s*([a-zA-Z\s]+?)\s*\$(\d+(?:\.\d+)?)/gi,
      /([a-zA-Z\s]+?)\s*:\s*\$(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/gi,
    ];

    for (const pattern of itemPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const qty = this.tryParseQty(match[1], match[3]);
        if (qty !== null && qty > 0) {
          let desc = match[2]?.trim() ?? match[1]?.trim() ?? "";
          let price: number;
          if (match[3] !== undefined) {
            desc = match[2]?.trim() ?? "";
            price = parseFloat(match[3]);
          } else {
            price = parseFloat(match[3] ?? match[2] ?? "0");
          }
          fields.items.push({
            description: desc,
            quantity: qty,
            unit: this.inferUnit(desc),
            unitPrice: price,
            taxRate: fields.taxRate,
            isTaxInclusive: lower.includes("tax inclusive") || lower.includes("tax-inclusive"),
          });
        }
      }
    }

    if (fields.items.length === 0) {
      const altMatch = lower.match(/(\d+(?:\.\d+)?)\s+([a-zA-Z\s]+?)\s+(?:for|totaling)\s+\$?(\d+(?:[,]\d{3})*(?:\.\d+)?)/i);
      if (altMatch) {
        const qty = parseFloat(altMatch[1]);
        const desc = altMatch[2].trim();
        const total = parseFloat(altMatch[3].replace(/,/g, ""));
        if (qty > 0) {
          fields.items.push({
            description: desc,
            quantity: qty,
            unit: "each",
            unitPrice: total / qty,
            taxRate: fields.taxRate,
            isTaxInclusive: false,
          });
        }
      }
    }

    const feeMatch = text.match(/plus\s+\$?(\d+(?:\.\d+)?)\s*(?:for\s+)?([a-zA-Z\s]+?)(?=\s*[,.]|\s*$)/i);
    if (feeMatch) {
      fields.fees.push({
        description: feeMatch[2]?.trim() ?? "Fee",
        amount: parseFloat(feeMatch[1]),
        taxRate: fields.taxRate,
      });
    }

    const notesMatch = text.match(/(?:note[s]?\s*:\s*)([^.]+(?:\.[^.]*)*)/i);
    if (notesMatch) {
      fields.notes = notesMatch[1].trim();
    }

    return fields;
  }

  private tryParseQty(q1: string, q3: string | undefined): number | null {
    const candidate = (q3 !== undefined ? q3 : q1);
    const parsed = parseFloat(candidate);
    return isNaN(parsed) ? null : parsed;
  }

  private inferUnit(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes("hour") || lower.includes("hr")) return "hour";
    if (lower.includes("month") || lower.includes("mo")) return "month";
    if (lower.includes("week") || lower.includes("wk")) return "week";
    if (lower.includes("day")) return "day";
    return "each";
  }

  private async enrichWithEntities(
    fields: ParsedDocumentFields,
    businessId: string
  ): Promise<{
    fields: ParsedDocumentFields;
    confidence: number;
    matchedCustomer: { id: string; name: string; email: string | null } | null;
    matchedProducts: { id: string; name: string; sku: string | null }[];
    suggestions: string[];
  }> {
    const suggestions: string[] = [];
    let confidence = 0.5;

    const customerTerms = await customerService.search(businessId, {
      search: fields.notes ?? "",
      limit: 5,
    });

    let matchedCustomer: { id: string; name: string; email: string | null } | null = null;
    if (customerTerms.data.length > 0) {
      const c = customerTerms.data[0];
      matchedCustomer = { id: c.id, name: c.name, email: c.email ?? null };
      fields.customerId = c.id;
      confidence = Math.min(confidence + 0.2, 0.9);
    }

    const matchedProducts: { id: string; name: string; sku: string | null }[] = [];
    for (const item of fields.items) {
      const products = await productServiceService.search(businessId, {
        search: item.description,
        limit: 5,
        status: "all",
        sortOrder: "asc",
        offset: 0,
        sortBy: "name",
      });
      if (products.data.length > 0) {
        const match = products.data[0];
        matchedProducts.push({ id: match.id, name: match.name, sku: match.sku ?? null });
        item.catalogName = match.name;
        item.catalogSku = match.sku ?? null;
        item.catalogUnitPrice = String(match.unitPrice);
        item.catalogTaxCategory = match.taxCategory ?? null;
        confidence = Math.min(confidence + 0.1, 0.95);
      } else {
        suggestions.push(`Could not match "${item.description}" to an existing product`);
      }
    }

    if (fields.items.length > 0) {
      confidence = Math.min(confidence + 0.3, 0.95);
    }
    if (fields.fees.length > 0) {
      confidence = Math.min(confidence + 0.1, 0.95);
    }

    if (fields.items.length === 0) {
      suggestions.push("No line items detected — describe them like '5 hours consulting at $100'");
    }

    return {
      fields,
      confidence,
      matchedCustomer,
      matchedProducts,
      suggestions,
    };
  }

  /**
   * Apply a reusable invoice template to create draft fields.
   * This allows "zero-typing" when a customer or project template exists.
   */
  async applyTemplate(
    template: InvoiceTemplate,
    overrides?: Partial<ParsedDocumentFields>
  ): Promise<ParsedDocumentFields> {
    const config = template.config ?? {};

    const fields: ParsedDocumentFields = {
      customerId: overrides?.customerId ?? (config.customerId as string | undefined) ?? null,
      currency: overrides?.currency ?? (config.currency as string | undefined) ?? "USD",
      issueDate: overrides?.issueDate ?? null,
      dueDate: overrides?.dueDate ?? null,
      notes: overrides?.notes ?? (config.notes as string | undefined) ?? null,
      terms: overrides?.terms ?? (config.terms as string | undefined) ?? null,
      items: overrides?.items ?? [],
      fees: overrides?.fees ?? [],
      taxRate: overrides?.taxRate ?? (config.defaultTaxRate as number | undefined) ?? 0,
    };

    if (config.items && Array.isArray(config.items) && fields.items.length === 0) {
      fields.items = (config.items as Array<Record<string, unknown>>).map((it) => ({
        description: (it.description as string) ?? "",
        quantity: (it.quantity as number) ?? 1,
        unit: (it.unit as string) ?? "each",
        unitPrice: (it.unitPrice as number) ?? 0,
        taxRate: (it.taxRate as number) ?? fields.taxRate,
        isTaxInclusive: (it.isTaxInclusive as boolean) ?? false,
      }));
    }

    if (config.fees && Array.isArray(config.fees) && fields.fees.length === 0) {
      fields.fees = (config.fees as Array<Record<string, unknown>>).map((f) => ({
        description: (f.description as string) ?? "",
        amount: (f.amount as number) ?? 0,
        taxRate: (f.taxRate as number) ?? fields.taxRate,
      }));
    }

    return fields;
  }
}

export const aiService = new AiService();
