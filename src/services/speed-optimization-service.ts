import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import type { Invoice } from "../domain/models/index.js";

export interface ParsedLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  productId?: string | null;
  catalogMatch?: {
    name: string;
    unitPrice: string;
    taxRate: string;
    confidence: number;
  } | null;
}

export interface AutofillResult {
  customerId?: string | null;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  templateId?: string | null;
  taxRate?: string;
  depositType?: "none" | "fixed" | "percentage";
  depositValue?: string;
  depositDueDate?: string | null;
  depositPaymentPurpose?: string | null;
  lateFeeType?: "none" | "fixed" | "percentage";
  lateFeeValue?: string;
  lateFeeDueDate?: string | null;
  poNumber?: string | null;
}

export interface FrequentlyInvoicedItem {
  id: string;
  name: string;
  description: string | null;
  unitPrice: string;
  unit: string;
  taxRate: string;
  frequencyScore: number;
  lastUsed: Date | null;
}

export interface LastInvoiceInfo {
  invoiceId: string;
  invoiceNumber?: string | null;
  customer: {
    id: string;
    name: string;
    email?: string | null;
  };
  items: Array<{
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    taxRate: string;
    productId?: string | null;
    catalogName?: string | null;
  }>;
  currency: string;
  terms?: string | null;
  notes?: string | null;
  paymentInstructions?: string | null;
  templateId?: string | null;
  total: string;
  sentAt?: Date | null;
  isDraft: boolean;
}

export interface QuickActions {
  lastInvoice: LastInvoiceInfo | null;
  frequentlyInvoiced: FrequentlyInvoicedItem[];
  recentCustomers: Array<{ id: string; name: string; email?: string | null }>;
  hasDraft: boolean;
  draftInfo: { id: string; customerId?: string | null; itemCount: number } | null;
}

export interface CustomerInvoicePattern {
  customerId: string;
  lastInvoiceId?: string | null;
  lastInvoiceItems: any[] | null;
  lastInvoiceCurrency: string;
  lastInvoiceTerms?: string | null;
  lastInvoiceTemplateId?: string | null;
  lastInvoiceSentAt?: Date | null;
  frequentlyInvoiced: any[] | null;
  avgInvoiceTotal: string;
  invoiceCount: number;
}

// --- Command-line parsing patterns (regex pipeline) ---
// Order matters: try most specific patterns first
const QUANTITY_PATTERN = /(\d+(?:\.\d+)?)\s*[×x]\s*/i;
const UNIT_HOUR_PATTERN = /(\d+(?:\.\d+)?)\s*(hr|hour|hours)/i;
const PRICE_PATTERN = /@\$?([\d,]+\.?\d*)/i;
const PRICE_PER_UNIT_PATTERN = /@\$?([\d,]+\.?\d*)\/([\w\s]+)/i;
const PRICE_HOUR_PATTERN = /@\$?([\d,]+\.?\d*)(?:\/hr|\/hour)/i;
const DASH_SEPARATOR = /—|--|-/i;

const INDUSTRY_DEFAULTS: Record<string, { defaultTerms?: string; defaultTaxRate?: string; defaultCurrency?: string }> = {
  plumbing: { defaultTerms: "Net 14", defaultTaxRate: "0.0875" },
  electrical: { defaultTerms: "Net 15", defaultTaxRate: "0.0875" },
  hvac: { defaultTerms: "Net 30", defaultTaxRate: "0.0875" },
  construction: { defaultTerms: "Net 30", defaultTaxRate: "0.0875" },
  freelancing: { defaultTerms: "Net 30", defaultTaxRate: "0.0" },
  consulting: { defaultTerms: "Net 30", defaultTaxRate: "0.0" },
};

const SYSTEM_DEFAULTS: AutofillResult = {
  currency: "USD",
  issueDate: new Date().toISOString().split("T")[0],
  dueDate: addDays(new Date(), 30).toISOString().split("T")[0],
  terms: "Net 30",
  notes: "",
  paymentInstructions: "",
  taxRate: "0",
  depositType: "none",
  depositValue: "0",
  lateFeeType: "none",
  lateFeeValue: "0",
  poNumber: null,
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getPaymentTermsDays(terms?: string | null): number {
  if (!terms) return 30;
  const match = terms.match(/Net\s*(\d+)/i);
  if (match) return parseInt(match[1], 10);
  if (/due\s+on\s+receipt/i.test(terms)) return 0;
  if (/due\s+on\s+receipt/i.test(terms) || /0\s*days/i.test(terms)) return 0;
  return 30;
}

function normalizeQuantity(raw: string): number {
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed <= 0) return 1;
  return parsed;
}

function normalizePrice(raw: string): number {
  const cleaned = raw.replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

function normalizeTaxRate(raw: string | number): number {
  const num = typeof raw === "string" ? parseFloat(raw) : raw;
  if (isNaN(num) || num < 0) return 0;
  // Handle both 0.0875 and 8.75 representations
  if (num > 1) return num / 100;
  return num;
}

function fuzzyMatchProduct(input: string, products: any[]): { product: any; confidence: number } | null {
  const inputTokens = input.toLowerCase().split(/\s+/).filter(Boolean);
  if (inputTokens.length === 0) return null;

  let bestMatch: { product: any; score: number } | null = null;

  for (const product of products) {
    const nameTokens = product.name.toLowerCase().split(/\s+/).filter(Boolean);
    const descTokens = (product.description || "").toLowerCase().split(/\s+/).filter(Boolean);

    // Token overlap (Jaccard similarity)
    const allTokens = new Set([...inputTokens, ...nameTokens, ...descTokens]);
    const overlap = inputTokens.filter((t) =>
      nameTokens.includes(t) || descTokens.includes(t)
    ).length;
    const jaccard = allTokens.size > 0 ? overlap / allTokens.size : 0;

    // Length difference penalty
    const lengthDiff = Math.abs(input.length - product.name.length) /
      Math.max(input.length, product.name.length, 1);
    const lengthPenalty = 1 - lengthDiff;

    const score = jaccard * 0.7 + lengthPenalty * 0.3;

    if (score > 0.55 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { product, score };
    }
  }

  return bestMatch ? { product: bestMatch.product, confidence: bestMatch.score } : null;
}

export class SpeedOptimizationService {
  /**
   * Parse a natural-language line item entry from the command bar.
   * Supports patterns like:
   *   "3 x Logo design @ $150"
   *   "Drain snaking — 1 hr @ $120"
   *   "PVC pipes 2\" (qty 3) @ $12/each"
   *   "Emergency fee @ $75"
   */
  parseCommandLineItem(
    input: string,
    products?: any[]
  ): ParsedLineItem {
    const trimmed = input.trim();

    // Extract quantity
    let quantity = 1;
    let unit = "each";
    let remaining = trimmed;

    // Try quantity × pattern: "3 x Logo design @ $150"
    let match = remaining.match(QUANTITY_PATTERN);
    if (match) {
      quantity = normalizeQuantity(match[1]);
      remaining = remaining.slice(0, match.index) + remaining.slice(match.index! + match[0].length);
    } else {
      // Try hour-based pattern: "Drain snaking — 1 hr @ $120"
      match = remaining.match(UNIT_HOUR_PATTERN);
      if (match) {
        quantity = normalizeQuantity(match[1]);
        unit = "hour";
        remaining = remaining.slice(0, match.index) + remaining.slice(match.index! + match[0].length);
      }
    }

    // Extract price and unit price
    let unitPrice = 0;
    match = remaining.match(PRICE_PER_UNIT_PATTERN);
    if (match) {
      unitPrice = normalizePrice(match[1]);
      remaining = remaining.slice(0, match.index) + remaining.slice(match.index! + match[0].length);
    } else {
      match = remaining.match(PRICE_HOUR_PATTERN);
      if (match) {
        unitPrice = normalizePrice(match[1]);
        unit = "hour";
        remaining = remaining.slice(0, match.index) + remaining.slice(match.index! + match[0].length);
      } else {
        match = remaining.match(PRICE_PATTERN);
        if (match) {
          unitPrice = normalizePrice(match[1]);
          remaining = remaining.slice(0, match.index) + remaining.slice(match.index! + match[0].length);
        }
      }
    }

    // Extract description (clean remaining text)
    let description = remaining
      .replace(DASH_SEPARATOR, "")
      .replace(/\(qty\s*\d+\)/gi, "")
      .trim();

    // Fuzzy match against product catalog
    let productId: string | null = null;
    let catalogMatch: ParsedLineItem["catalogMatch"] = null;
    let taxRate = 0;

    if (products && products.length > 0) {
      const match = fuzzyMatchProduct(description, products);
      if (match) {
        catalogMatch = {
          name: match.product.name,
          unitPrice: match.product.unitPrice,
          taxRate: match.product.defaultTaxRate,
          confidence: match.confidence,
        };
        productId = match.product.id;
        taxRate = normalizeTaxRate(match.product.defaultTaxRate);
        // If price was not specified in the command, use the catalog price
        if (unitPrice === 0) {
          unitPrice = parseFloat(match.product.unitPrice);
        }
      }
    }

    return {
      description,
      quantity,
      unit,
      unitPrice,
      taxRate,
      productId,
      catalogMatch,
    };
  }

  /**
   * Get the frequently invoiced items for a business (top 12 by score).
   */
  async getFrequentlyInvoiced(businessId: string, limit = 12): Promise<FrequentlyInvoicedItem[]> {
    try {
      const res = await query(
        `WITH item_stats AS (
          SELECT
            p.id as product_id,
            p.name,
            p.description,
            p.unit_price,
            p.unit,
            p.default_tax_rate as tax_rate,
            COUNT(*) as frequency,
            MAX(i.created_at) as last_used,
            AVG(i.unit_price * i.quantity) as avg_value
          FROM invoice_items i
          JOIN invoices inv ON i.invoice_id = inv.id
          LEFT JOIN products p ON i.product_id = p.id
          WHERE inv.business_id = $1
            AND inv.created_at > NOW() - INTERVAL '6 months'
          GROUP BY p.id, p.name, p.description, p.unit_price, p.unit, p.default_tax_rate
          HAVING COUNT(*) >= 2
        ),
        scored AS (
          SELECT
            product_id as id,
            name,
            description,
            unit_price,
            unit,
            tax_rate,
            frequency,
            last_used,
            avg_value,
            (frequency * 0.7 + EXP(-EXTRACT(DAY FROM (NOW() - last_used)) / 30) * 0.3) as frequency_score
          FROM item_stats
        )
        SELECT * FROM scored
        WHERE id IS NOT NULL
        ORDER BY frequency_score DESC, frequency DESC, last_used DESC
        LIMIT $2

        UNION ALL

        SELECT
          NULL as id,
          i.description as name,
          NULL as description,
          i.unit_price as unit_price,
          i.unit as unit,
          i.tax_rate as tax_rate,
          COUNT(*) as frequency,
          MAX(inv.created_at) as last_used,
          NULL as avg_value,
          (COUNT(*) * 0.7 + EXP(-EXTRACT(DAY FROM (NOW() - MAX(inv.created_at))) / 30) * 0.3) as frequency_score
        FROM invoice_items i
        JOIN invoices inv ON i.invoice_id = inv.id
        WHERE inv.business_id = $1
          AND inv.created_at > NOW() - INTERVAL '6 months'
          AND i.product_id IS NULL
        GROUP BY i.description, i.unit_price, i.unit, i.tax_rate
        HAVING COUNT(*) >= 3
        ORDER BY frequency_score DESC, frequency DESC, last_used DESC
        LIMIT $2`,
        [businessId, limit]
      );

    return res.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        unitPrice: row.unit_price,
        unit: row.unit,
        taxRate: row.tax_rate,
        frequencyScore: parseFloat(row.frequency_score),
        lastUsed: row.last_used,
      }));
    } catch (err) {
      logger.warn({ err, businessId }, "Failed to fetch frequently invoiced items");
      return [];
    }
  }

  /**
   * Get the last invoice for a customer (or overall last invoice for the business).
   * Used for "Use Last Invoice" quick-repeat feature.
   */
  async getLastInvoice(businessId: string, customerId?: string): Promise<LastInvoiceInfo | null> {
    try {
      const customerFilter = customerId
        ? "AND inv.customer_id = $2"
        : "AND ($2::uuid IS NULL OR inv.customer_id = $2)";
      const params: any[] = [businessId, customerId || null];

      const res = await query(
        `SELECT inv.id, inv.invoice_number, inv.currency, inv.terms, inv.notes,
                inv.payment_instructions, inv.template_id, inv.total, inv.status,
                inv.sent_at, inv.created_at,
                c.name as customer_name, c.email as customer_email,
                COALESCE(items_json.items, '[]'::json) as items
         FROM invoices inv
         LEFT JOIN customers c ON c.id = inv.customer_id
         LEFT JOIN LATERAL (
           SELECT json_agg(json_build_object(
             'id', ii.id,
             'description', ii.description,
             'quantity', ii.quantity::text,
             'unit', ii.unit,
             'unit_price', ii.unit_price::text,
             'tax_rate', ii.tax_rate::text,
             'product_id', ii.product_id,
             'catalog_name', ii.catalog_name
           )) as items
           FROM invoice_items ii
           WHERE ii.invoice_id = inv.id
         ) items_json ON true
         WHERE inv.business_id = $1
           AND inv.status IN ('draft', 'sent', 'viewed', 'paid', 'partially_paid')
           ${customerFilter}
         ORDER BY inv.created_at DESC
         LIMIT 1`,
        params
      );

      if (!res.rows.length) return null;

      const row = res.rows[0];
      const items = row.items || [];

      return {
        invoiceId: row.id,
        invoiceNumber: row.invoice_number,
        customer: {
          id: row.customer_id,
          name: row.customer_name || "Unknown",
          email: row.customer_email,
        },
        items: items.map((it: any) => ({
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unit_price,
          taxRate: it.tax_rate,
          productId: it.product_id,
          catalogName: it.catalog_name,
        })),
        currency: row.currency,
        terms: row.terms,
        notes: row.notes,
        paymentInstructions: row.payment_instructions,
        templateId: row.template_id,
        total: row.total,
        sentAt: row.sent_at,
        isDraft: row.status === "draft",
      };
    } catch (err) {
      logger.warn({ err, businessId, customerId }, "Failed to fetch last invoice");
      return null;
    }
  }

  /**
   * Get quick-start actions for the dashboard / new invoice page.
   */
  async getQuickActions(businessId: string, userId?: string): Promise<QuickActions> {
    try {
      const [lastInvoice, frequentlyInvoiced, recentCustomers, draftInfo] = await Promise.all([
        this.getLastInvoice(businessId),
        this.getFrequentlyInvoiced(businessId, 12),
        this.getRecentCustomers(businessId, 5),
        this.checkForActiveDraft(businessId, userId),
      ]);

      return {
        lastInvoice,
        frequentlyInvoiced,
        recentCustomers,
        hasDraft: !!draftInfo,
        draftInfo,
      };
    } catch (err) {
      logger.warn({ err, businessId }, "Failed to fetch quick actions");
      return {
        lastInvoice: null,
        frequentlyInvoiced: [],
        recentCustomers: [],
        hasDraft: false,
        draftInfo: null,
      };
    }
  }

  /**
   * Get progressive autofill values for a new invoice based on context.
   * Priority: recent history → customer defaults → business defaults → industry presets → system defaults
   */
  async getProgressiveAutofill(
    businessId: string,
    customerId?: string | null
  ): Promise<AutofillResult> {
    const autofill: AutofillResult = { ...SYSTEM_DEFAULTS };

    try {
      // 1. Business defaults
      const biz = await this.getBusinessDefaults(businessId);
      Object.assign(autofill, biz);

      // 2. Customer defaults (if customer selected)
      if (customerId) {
        const customerDefaults = await this.getCustomerDefaults(businessId, customerId);
        Object.assign(autofill, customerDefaults);

        // 3. Last invoice for this customer
        const lastInvoice = await this.getLastInvoice(businessId, customerId);
        if (lastInvoice) {
          autofill.currency = lastInvoice.currency;
          autofill.terms = lastInvoice.terms ?? autofill.terms;
          autofill.notes = lastInvoice.notes ?? autofill.notes;
          autofill.paymentInstructions = lastInvoice.paymentInstructions ?? autofill.paymentInstructions;
          autofill.templateId = lastInvoice.templateId ?? autofill.templateId;
        }
      }

      // 4. Industry presets
      const industry = biz.industry;
      if (industry && INDUSTRY_DEFAULTS[industry.toLowerCase()]) {
        const ind = INDUSTRY_DEFAULTS[industry.toLowerCase()];
        if (ind.defaultTerms && !autofill.terms) autofill.terms = ind.defaultTerms;
        if (ind.defaultTaxRate && !autofill.taxRate) autofill.taxRate = ind.defaultTaxRate;
        if (ind.defaultCurrency && !autofill.currency) autofill.currency = ind.defaultCurrency;
      }

      // Ensure issue date is today
      autofill.issueDate = new Date().toISOString().split("T")[0];

      // Compute due date from terms
      if (autofill.terms) {
        const days = getPaymentTermsDays(autofill.terms);
        autofill.dueDate = addDays(new Date(), days).toISOString().split("T")[0];
      }
    } catch (err) {
      logger.warn({ err, businessId, customerId }, "Failed progressive autofill");
    }

    return autofill;
  }

  private async getBusinessDefaults(businessId: string): Promise<Partial<AutofillResult> & { industry?: string }> {
    const res = await query(
      `SELECT b.id, b.name, b.industry, b.default_currency, b.tax_id,
              b.address_line_1, b.address_line_2, b.city, b.state_or_region, b.postal_code, b.country_code,
              bs.default_currency as settings_currency,
              bs.default_tax_rate as settings_tax_rate,
              bs.default_terms as settings_terms,
              bs.default_notes as settings_notes,
              bs.payment_provider_config
       FROM businesses b
       LEFT JOIN business_settings bs ON bs.business_id = b.id
       WHERE b.id = $1`,
      [businessId]
    );

    if (!res.rows.length) return { industry: undefined };

    const row = res.rows[0];
    return {
      industry: row.industry,
      currency: row.settings_currency || row.default_currency,
      taxRate: row.settings_tax_rate ? String(row.settings_tax_rate) : "0",
      notes: row.settings_notes,
      terms: row.settings_terms,
      paymentInstructions:
        row.payment_provider_config?.payment_instructions ||
        row.payment_provider_config?.default_payment_instructions ||
        undefined,
      depositType: "none",
      lateFeeType: "none",
    };
  }

  private async getCustomerDefaults(businessId: string, customerId: string): Promise<Partial<AutofillResult>> {
    const res = await query(
      `SELECT c.default_currency, c.payment_terms, b.default_currency as biz_currency
       FROM customers c
       JOIN businesses b ON b.id = c.business_id
       WHERE c.id = $1 AND c.business_id = $2`,
      [customerId, businessId]
    );

    if (!res.rows.length) return {};

    const row = res.rows[0];
    const result: Partial<AutofillResult> = {};

    if (row.default_currency) result.currency = row.default_currency;
    if (row.payment_terms) result.terms = `Net ${row.payment_terms}`;

    return result;
  }

  private async getRecentCustomers(businessId: string, limit = 5): Promise<Array<{ id: string; name: string; email?: string | null }>> {
    const res = await query(
      `SELECT c.id, c.name, c.email
       FROM customers c
       WHERE c.business_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2`,
      [businessId, limit]
    );
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
    }));
  }

  private async checkForActiveDraft(businessId: string, userId?: string): Promise<{ id: string; customerId?: string | null; itemCount: number } | null> {
    const res = await query(
      `SELECT inv.id, inv.customer_id, COUNT(ii.id) as item_count
       FROM invoices inv
       LEFT JOIN invoice_items ii ON ii.invoice_id = inv.id
       WHERE inv.business_id = $1
         AND inv.status = 'draft'
         AND inv.is_finalized = FALSE
         AND inv.created_at > NOW() - INTERVAL '24 hours'
       GROUP BY inv.id
       ORDER BY inv.updated_at DESC
       LIMIT 1`,
      [businessId]
    );

    if (!res.rows.length) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      customerId: row.customer_id,
      itemCount: parseInt(row.item_count, 10) || 0,
    };
  }

  /**
   * Record a user interaction for adaptive UI learning.
   */
  async logInteraction(
    businessId: string,
    userId: string,
    actionType: string,
    targetField?: string,
    invoiceId?: string,
    durationMs?: number,
    valueFrom?: string,
    valueTo?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO user_interaction_log
          (user_id, business_id, action_type, target_field, invoice_id, duration_ms,
           value_from, value_to, session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, businessId, actionType, targetField, invoiceId, durationMs, valueFrom, valueTo, sessionId]
      );
    } catch (err) {
      logger.debug({ err }, "Failed to log interaction");
    }
  }

  /**
   * Record speed metrics for an invoice creation session.
   */
  async recordSpeedMetrics(
    businessId: string,
    userId: string,
    invoiceId: string,
    metrics: {
      creationSeconds: number;
      customerSelectedVia: string;
      usedLastInvoice: boolean;
      commandBarItems: number;
      catalogChipItems: number;
      manualItems: number;
      itemsCount: number;
      isReturningCustomer: boolean;
      isMobile: boolean;
      sessionId?: string;
    }
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO invoice_speed_metrics
          (business_id, user_id, invoice_id, session_id, creation_seconds,
           customer_selected_via, used_last_invoice, command_bar_items,
           catalog_chip_items, manual_items, items_count, is_returning_customer, is_mobile)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          businessId, userId, invoiceId, metrics.sessionId, metrics.creationSeconds,
          metrics.customerSelectedVia, metrics.usedLastInvoice, metrics.commandBarItems,
          metrics.catalogChipItems, metrics.manualItems, metrics.itemsCount,
          metrics.isReturningCustomer, metrics.isMobile,
        ]
      );
    } catch (err) {
      logger.debug({ err }, "Failed to record speed metrics");
    }
  }

  /**
   * Update the customer_invoice_patterns cache table for a given customer.
   * Called after invoice send/finalize.
   */
  async updateCustomerPattern(businessId: string, customerId: string, invoiceId: string): Promise<void> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // Get invoice details
      const invoiceRes = await client.query(
        `SELECT id, customer_id, currency, terms, notes, payment_instructions,
                template_id, total, status, sent_at, created_at
         FROM invoices
         WHERE id = $1 AND business_id = $2`,
        [invoiceId, businessId]
      );

      if (!invoiceRes.rows.length) {
        await client.query("ROLLBACK");
        return;
      }

      const inv = invoiceRes.rows[0];

      // Get line items with product data
      const itemsRes = await client.query(
        `SELECT ii.description, ii.quantity::text as quantity, ii.unit,
                ii.unit_price::text as unit_price, ii.tax_rate::text as tax_rate,
                ii.product_id, p.name as catalog_name
         FROM invoice_items ii
         LEFT JOIN products p ON p.id = ii.product_id
         WHERE ii.invoice_id = $1`,
        [invoiceId]
      );

      const itemsJson = itemsRes.rows.map((row) => ({
        description: row.description,
        quantity: row.quantity,
        unit: row.unit,
        unitPrice: row.unit_price,
        taxRate: row.tax_rate,
        productId: row.product_id,
        catalogName: row.catalog_name,
      }));

      // Check existing pattern
      const existingRes = await client.query(
        `SELECT invoice_count, frequently_invoiced FROM customer_invoice_patterns
         WHERE business_id = $1 AND customer_id = $2`,
        [businessId, customerId]
      );

      const now = new Date().toISOString();
      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        const invoiceCount = (existing.invoice_count || 0) + 1;

        // Update frequently invoiced items
        const freqItems = await this.computeFrequentItems(client, businessId, customerId);

        await client.query(
          `UPDATE customer_invoice_patterns SET
             last_invoice_id = $3,
             last_invoice_items = $4,
             last_invoice_total = $5,
             last_invoice_currency = $6,
             last_invoice_terms = $7,
             last_invoice_template_id = $8,
             last_invoice_sent_at = $9,
             frequently_invoiced = $10,
             avg_invoice_total = $11,
             invoice_count = $12,
             updated_at = $13
           WHERE business_id = $1 AND customer_id = $2`,
          [
            businessId, customerId, invoiceId,
            JSON.stringify(itemsJson),
            inv.total, inv.currency, inv.terms, inv.template_id,
            inv.sent_at || inv.created_at,
            JSON.stringify(freqItems),
            await this.computeAvgTotal(client, businessId, customerId),
            invoiceCount,
            now,
          ]
        );
      } else {
        const freqItems = await this.computeFrequentItems(client, businessId, customerId);
        await client.query(
          `INSERT INTO customer_invoice_patterns
             (business_id, customer_id, last_invoice_id, last_invoice_items,
              last_invoice_total, last_invoice_currency, last_invoice_terms,
              last_invoice_template_id, last_invoice_sent_at, frequently_invoiced,
              avg_invoice_total, invoice_count, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 12, $13)`,
          [
            businessId, customerId, invoiceId,
            JSON.stringify(itemsJson),
            inv.total, inv.currency, inv.terms, inv.template_id,
            inv.sent_at || inv.created_at,
            JSON.stringify(freqItems),
            inv.total,
            now,
          ]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      logger.warn({ err, businessId, customerId }, "Failed to update customer pattern");
    } finally {
      client.release();
    }
  }

  private async computeFrequentItems(client: any, businessId: string, customerId: string): Promise<any[]> {
    const res = await client.query(
      `SELECT ii.product_id as id, COALESCE(p.name, ii.description) as name,
              ii.description, p.unit_price, p.unit, p.default_tax_rate as tax_rate,
              COUNT(*) as frequency, MAX(inv.created_at) as last_used
       FROM invoice_items ii
       JOIN invoices inv ON ii.invoice_id = inv.id
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE inv.business_id = $1 AND inv.customer_id = $2
         AND inv.created_at > NOW() - INTERVAL '6 months'
       GROUP BY ii.product_id, p.name, ii.description, p.unit_price, p.unit, p.default_tax_rate
       ORDER BY COUNT(*) DESC, MAX(inv.created_at) DESC
       LIMIT 12`,
      [businessId, customerId]
    );

    return res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      unitPrice: row.unit_price,
      unit: row.unit,
      taxRate: row.tax_rate,
      frequency: parseInt(row.frequency, 10),
      lastUsed: row.last_used,
    }));
  }

  private async computeAvgTotal(client: any, businessId: string, customerId: string): Promise<string> {
    const res = await client.query(
      `SELECT AVG(total)::text as avg_total
       FROM invoices
       WHERE business_id = $1 AND customer_id = $2
         AND status IN ('sent', 'viewed', 'partially_paid', 'paid')`,
      [businessId, customerId]
    );
    return res.rows[0]?.avg_total ?? "0";
  }
}

export const speedOptimizationService = new SpeedOptimizationService();
