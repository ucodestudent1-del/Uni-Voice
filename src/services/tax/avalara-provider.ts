import { Decimal } from "decimal.js";
import type { TaxProvider, TaxContext, TaxCalculation, TaxLineItem } from "./types.js";
import { env } from "../../config/index.js";
import { logger } from "../../utils/logger.js";
import { query } from "../../db/pool.js";
import { getCurrencyMetadata } from "../../domain/value-objects/currency.js";

export interface AvalaraAddress {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface AvalaraConfig {
  accountId: string;
  apiKey: string;
  environment: "development" | "production";
  companyCode?: string;
}

const ROUND = Decimal.ROUND_HALF_UP;

function roundTo(v: Decimal.Value, dp: number): Decimal {
  return new Decimal(v).toDecimalPlaces(dp, ROUND);
}

export class AvalaraTaxProvider implements TaxProvider {
  readonly name = "avalara";
  private config: AvalaraConfig;

  constructor(config?: Partial<AvalaraConfig>) {
    this.config = {
      accountId: config?.accountId ?? env.AVALARA_ACCOUNT_ID ?? "",
      apiKey: config?.apiKey ?? env.AVALARA_API_KEY ?? "",
      environment: (config?.environment ?? env.AVALARA_ENVIRONMENT ?? "development") as "development" | "production",
      companyCode: config?.companyCode ?? "DEFAULT",
    };

    if (!this.config.accountId || !this.config.apiKey) {
      throw new Error("Avalara credentials not configured. Set AVALARA_ACCOUNT_ID and AVALARA_API_KEY.");
    }
  }

  private getBaseUrl(): string {
    return this.config.environment === "production"
      ? "https://rest.avatax.com"
      : "https://rest.sandbox.avatax.com";
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.config.accountId}:${this.config.apiKey}`).toString("base64")}`;
  }

  private async fetchTaxCodes(): Promise<Record<string, string>> {
    const cacheKey = "avalara:taxcodes";
    const cached = await query(
      `SELECT value FROM cache_store WHERE key = $1 AND expires_at > NOW()`,
      [cacheKey],
    );

    if (cached.rows.length) {
      try {
        return JSON.parse(cached.rows[0].value) as Record<string, string>;
      } catch {
        // fall through
      }
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/api/v2/taxcodes`, {
        headers: {
          "Authorization": this.getAuthHeader(),
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Avalara tax codes fetch failed: ${res.status}`);
      }

      const data = await res.json() as {
        value: Array<{ code: string; name: string; description: string }>;
      };

      const codes: Record<string, string> = {};
      for (const item of data.value) {
        codes[item.name ?? item.code] = item.code;
      }

      await query(
        `INSERT INTO cache_store (key, value, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '24 hours')
         ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = NOW() + INTERVAL '24 hours'`,
        [cacheKey, JSON.stringify(codes)],
      );

      return codes;
    } catch (err) {
      logger.warn({ err }, "Failed to fetch Avalara tax codes — using empty mapping");
      return {};
    }
  }

  async calculateTax(context: TaxContext): Promise<TaxCalculation> {
    const meta = getCurrencyMetadata(context.currency);
    const moneyDp = meta.decimalPlaces;
    const rateDp = 4;

    const taxCodes = await this.fetchTaxCodes();

    const lineTaxes = [];
    const feeTaxes = [];
    let totalTax = new Decimal(0);

    let exempt = false;
    if (context.customerTaxId && this.isExempt) {
      exempt = await this.isExempt(context);
    }

    const avalaraLines = context.lineItems.map((li: TaxLineItem, idx) => ({
      number: String(idx + 1),
      quantity: Number(li.quantity),
      amount: Number(new Decimal(li.taxableAmount).toFixed(moneyDp)),
       tax_code: this.lookupTaxCode(li.description, li.productId ?? null, taxCodes),
      item_code: li.productId ?? undefined,
      description: li.description,
      exempt_code: exempt ? "EXEMPT" : undefined,
    }));

    const requestBody = {
      company_code: this.config.companyCode,
      type: "SalesInvoice",
      date: context.date.toISOString().split("T")[0],
      customer_code: context.customerId ?? "ANONYMOUS",
      addresses: {
        single_location: this.buildSingleLocation(context),
      },
      lines: avalaraLines,
      currency_code: context.currency,
    };

    try {
      const res = await fetch(`${this.getBaseUrl()}/api/v2/tax/calculate`, {
        method: "POST",
        headers: {
          "Authorization": this.getAuthHeader(),
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        throw new Error(`Avalara tax calculation failed: ${res.status} ${res.statusText}`);
      }

      const result = await res.json() as {
        total_tax: number;
        lines: Array<{
          line_number: number;
          tax_calculations: Array<{
            rate: number;
            amount: number;
            tax_type: string;
            tax_name: string;
            jurisdiction_name: string;
          }>;
        }>;
      };

      totalTax = new Decimal(result.total_tax ?? 0);

      for (const line of result.lines ?? []) {
        const li = context.lineItems[Number(line.line_number) - 1];
        if (!li) continue;

        const calculations = line.tax_calculations ?? [];
        let combinedRate = new Decimal(0);
        let combinedAmount = new Decimal(0);

        for (const calc of calculations) {
          combinedRate = combinedRate.plus(calc.rate);
          combinedAmount = combinedAmount.plus(calc.amount);
        }

        lineTaxes.push({
          lineItemId: li.id,
          taxRate: roundTo(combinedRate, rateDp),
          taxAmount: roundTo(combinedAmount, moneyDp),
        });
      }

      for (const fee of context.fees ?? []) {
        const rate = new Decimal(0);
        const taxable = roundTo(fee.amount, moneyDp);
        let tax = new Decimal(0);
        if (!exempt && !taxable.isZero()) {
          tax = roundTo(taxable.mul(rate), moneyDp);
        }
        feeTaxes.push({
          description: fee.description,
          taxRate: roundTo(rate, rateDp),
          taxAmount: tax,
        });
        totalTax = totalTax.plus(tax);
      }

      return {
        lineTaxes,
        feeTaxes,
        totalTax: roundTo(totalTax, moneyDp),
      };
    } catch (err) {
      logger.error({ err, context: { currency: context.currency, customerId: context.customerId } },
        "Avalara tax calculation failed — falling back to manual rates");
      throw err;
    }
  }

  async isExempt(context: TaxContext): Promise<boolean> {
    if (!context.customerTaxId || !context.customerCountry || !context.businessCountry) {
      return false;
    }

    if (context.businessCountry !== context.customerCountry) {
      return false;
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/api/v2/companies/${this.config.companyCode}/customers/${context.customerId}`, {
        method: "GET",
        headers: {
          "Authorization": this.getAuthHeader(),
          "Accept": "application/json",
        },
      });

      if (!res.ok) return false;

      const data = await res.json() as { exempt: boolean; exemption_type?: string };
      return Boolean(data.exempt);
    } catch (err) {
      logger.warn({ err }, "Failed to check Avalara tax exemption status");
      return false;
    }
  }

  private lookupTaxCode(description: string, productId: string | null, taxCodes: Record<string, string>): string | undefined {
    const desc = description.toLowerCase();
    const product = (productId ?? "").toLowerCase();

    if (product.includes("service") || desc.includes("service") || desc.includes("consulting")) {
      return taxCodes["Service"] ?? "P0000000";
    }
    if (desc.includes("software") || desc.includes("saas") || desc.includes("digital")) {
      return taxCodes["Digital Goods"] ?? "D0000000";
    }
    if (desc.includes("shipping")) {
      return taxCodes["Shipping"] ?? "FR000000";
    }

    return taxCodes[product] ?? taxCodes[desc] ?? undefined;
  }

  private buildAddress(country: string | undefined): AvalaraAddress {
    return {
      line1: "1 Main St",
      city: "Unknown",
      country: country ?? "US",
    };
  }

  private buildSingleLocation(context: TaxContext): Record<string, unknown> {
    return {
      line1: "1 Main St",
      city: "Unknown",
      country: context.customerCountry ?? "US",
    };
  }
}

export const avalaraTaxProvider = new AvalaraTaxProvider();
