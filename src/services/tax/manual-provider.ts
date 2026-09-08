import { Decimal } from "decimal.js";
import type { TaxProvider, TaxContext, TaxCalculation } from "./types.js";
import { getCurrencyMetadata } from "../../domain/value-objects/currency.js";

const ROUND = Decimal.ROUND_HALF_UP;

function roundTo(v: Decimal.Value, dp: number): Decimal {
  return new Decimal(v).toDecimalPlaces(dp, ROUND);
}

/**
 * MVP tax provider: uses rates pre-configured on each line item.
 *
 * External providers (Avalara, TaxJar) will plug in via the same interface
 * and resolve rates by jurisdiction instead of trusting the line-level rate.
 */
export class ManualTaxProvider implements TaxProvider {
  readonly name = "manual";

  async calculateTax(context: TaxContext): Promise<TaxCalculation> {
    const meta = getCurrencyMetadata(context.currency);
    const moneyDp = meta.decimalPlaces;
    const rateDp = 4;

    let totalTax = new Decimal(0);
    const lineTaxes = [];
    const feeTaxes = [];

    const exempt = context.customerTaxId ? await this.isExempt(context) : false;

    for (const li of context.lineItems) {
      const rate = new Decimal(li.taxRate ?? 0);
      const taxable = roundTo(li.taxableAmount, moneyDp);
      let tax = new Decimal(0);
      if (!exempt && !rate.isZero() && !taxable.isZero()) {
        tax = roundTo(taxable.mul(rate), moneyDp);
      }
      lineTaxes.push({ lineItemId: li.id, taxRate: roundTo(rate, rateDp), taxAmount: tax });
      totalTax = totalTax.plus(tax);
    }

    for (const fee of context.fees ?? []) {
      const taxable = roundTo(fee.amount, moneyDp);
      let tax = new Decimal(0);
      if (!exempt && !taxable.isZero()) {
        tax = roundTo(taxable.mul(0), moneyDp);
      }
      feeTaxes.push({ description: fee.description, taxRate: new Decimal(0), taxAmount: tax });
    }

    return { lineTaxes, feeTaxes, totalTax: roundTo(totalTax, moneyDp) };
  }

  async isExempt(context: TaxContext): Promise<boolean> {
    // MVP: customers with a tax ID in the same country as the business may be
    // reverse-charged / exempt depending on config. Default: not exempt.
    if (!context.customerTaxId || !context.businessCountry || !context.customerCountry) {
      return false;
    }
    return context.businessCountry === context.customerCountry;
  }
}
