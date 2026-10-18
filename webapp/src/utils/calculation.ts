import { Decimal } from "decimal.js";
import { getCurrencyMetadata, type CurrencyCode } from "@/types/currency";

const ZERO = new Decimal(0);
const ONE = new Decimal(1);

export type {
  DiscountType,
  DiscountDefinition,
  LineItemInput,
  FeeInput,
  InvoiceCalculationInput,
  CalculatedLineItem,
  CalculatedFee,
  TaxBreakdownEntry,
  CalculationResult,
} from "@/types/calculation";

import type { DiscountDefinition, InvoiceCalculationInput, CalculationResult, TaxBreakdownEntry, CalculatedFee, CalculatedLineItem } from "@/types/calculation";

export function discountAmount(discount: DiscountDefinition | undefined, base: Decimal, currency: CurrencyCode): Decimal {
  if (!discount) return ZERO;
  const meta = getCurrencyMetadata(currency);
  const d = discount.value instanceof Decimal ? discount.value : new Decimal(discount.value);
  let amount: Decimal;
  if (discount.type === "percentage") {
    amount = base.mul(d.div(100));
  } else {
    amount = d;
  }
  if (amount.gt(base)) amount = base;
  if (amount.isNegative()) return ZERO;
  return amount.toDecimalPlaces(meta.decimalPlaces, Decimal.ROUND_HALF_UP);
}

export class CalculationEngine {
  calculate(input: InvoiceCalculationInput): CalculationResult {
    const { currency } = input;
    const meta = getCurrencyMetadata(currency);
    const dp = meta.decimalPlaces;
    const round = (v: Decimal.Value): Decimal => new Decimal(v).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
    const roundRate = (v: Decimal.Value): Decimal => new Decimal(v).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

    const lineItems: CalculatedLineItem[] = [];

    for (const item of input.lineItems) {
      const qty = new Decimal(item.quantity);
      const unitPrice = new Decimal(item.unitPrice);

      if (qty.isZero() || qty.isNegative()) {
        throw new Error(`Quantity must be greater than 0 for line item "${item.description}"`);
      }
      if (unitPrice.isNegative()) {
        throw new Error(`Unit price must be >= 0 for line item "${item.description}"`);
      }
      const taxRate = new Decimal(item.taxRate);
      if (taxRate.isNegative()) {
        throw new Error(`Tax rate must be >= 0 for line item "${item.description}"`);
      }

      const lineSubtotal = round(qty.mul(unitPrice));
      const lineDiscount = discountAmount(item.discount, lineSubtotal, currency);
      lineItems.push({
        description: item.description,
        quantity: qty,
        unit: item.unit,
        unitPrice: round(unitPrice),
        discountAmount: lineDiscount,
        taxRate: roundRate(taxRate),
        tax_name: item.tax_name,
        isTaxInclusive: item.isTaxInclusive,
        lineSubtotal,
        taxableAmount: new Decimal(0),
        taxAmount: new Decimal(0),
        lineTotal: new Decimal(0),
      });
    }

    let subtotal = ZERO;
    let lineDiscountTotal = ZERO;
    let totalNet = ZERO;

    for (const li of lineItems) {
      subtotal = subtotal.plus(li.lineSubtotal);
      lineDiscountTotal = lineDiscountTotal.plus(li.discountAmount);
      totalNet = totalNet.plus(li.lineSubtotal.minus(li.discountAmount));
    }

    const invoiceDiscount = discountAmount(input.invoiceDiscount, subtotal.minus(lineDiscountTotal), currency);
    const discountTotal = round(lineDiscountTotal.plus(invoiceDiscount));

    const lineShares = new Array(lineItems.length).fill(ZERO);
    if (!totalNet.isZero()) {
      for (let i = 0; i < lineItems.length; i++) {
        const net = lineItems[i].lineSubtotal.minus(lineItems[i].discountAmount);
        lineShares[i] = round(invoiceDiscount.mul(net.div(totalNet)));
      }
    }

    let taxTotal = ZERO;
    let total = ZERO;

    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      const effectiveTaxable = round(li.lineSubtotal.minus(li.discountAmount).minus(lineShares[i]));

      let taxAmount: Decimal;

    if (li.isTaxInclusive) {
         if (li.taxRate.isZero() || effectiveTaxable.isZero()) {
           taxAmount = round(ZERO);
         } else {
           const ratio = li.taxRate.div(ONE.plus(li.taxRate));
          taxAmount = round(effectiveTaxable.mul(ratio));
        }
        const netAmount = round(effectiveTaxable.minus(taxAmount));
        li.taxableAmount = netAmount;
        li.taxAmount = taxAmount;
        li.lineTotal = round(effectiveTaxable);
      } else {
        taxAmount = round(effectiveTaxable.mul(li.taxRate));
        li.taxableAmount = round(effectiveTaxable);
        li.taxAmount = taxAmount;
        li.lineTotal = round(effectiveTaxable.plus(taxAmount));
      }

      taxTotal = taxTotal.plus(li.taxAmount);
      total = total.plus(li.lineTotal);
    }

    const fees: CalculatedFee[] = [];
    let feeTotal = ZERO;

    for (const fee of input.fees ?? []) {
      const feeBase = round(new Decimal(fee.amount));
      const feeTaxRate = new Decimal(fee.taxRate ?? 0);
      if (feeBase.isNegative()) {
        throw new Error(`Fee amount must be >= 0 for fee "${fee.description}"`);
      }
      const feeTaxAmount = round(feeBase.mul(feeTaxRate));
      const feeLineTotal = round(feeBase.plus(feeTaxAmount));
      fees.push({
        description: fee.description,
        amount: feeBase,
        taxRate: roundRate(feeTaxRate),
        tax_name: fee.tax_name,
        taxAmount: feeTaxAmount,
        feeTotal: feeLineTotal,
      });
      feeTotal = feeTotal.plus(feeBase);
      taxTotal = taxTotal.plus(feeTaxAmount);
      total = total.plus(feeLineTotal);
    }

    const amountPaid = round(input.amountPaid ?? 0);
    if (amountPaid.isNegative()) {
      throw new Error("Amount paid must be >= 0");
    }

    const amountDue = round(total.minus(amountPaid));

    const isTaxInclusive = lineItems.some((li) => li.isTaxInclusive);
    const taxBreakdown = computeTaxBreakdown(lineItems, fees, dp);

    return {
      currency,
      decimalPlaces: dp,
      lineItems,
      fees,
      subtotal: round(subtotal),
      discountTotal,
      taxableTotal: round(totalNet.minus(invoiceDiscount)),
      taxTotal: round(taxTotal),
      feeTotal: round(feeTotal),
      total: round(total),
      amountDue,
      amountPaid,
      isTaxInclusive,
      taxBreakdown,
    };
  }
}

export const calculationEngine = new CalculationEngine();

export function currencyMetadata(code: string) {
  return getCurrencyMetadata(code);
}

export function computeTaxBreakdown(
  lineItems: CalculatedLineItem[],
  fees: CalculatedFee[],
  decimalPlaces: number
): TaxBreakdownEntry[] {
  const groups = new Map<string, { rate: Decimal; name: string; taxableAmount: Decimal; taxAmount: Decimal }>();

  for (const li of lineItems) {
    const rate = li.taxRate instanceof Decimal ? li.taxRate : new Decimal(li.taxRate ?? 0);
    if (rate.isZero()) continue;
    const key = `${rate.toFixed(4)}|${li.tax_name ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.taxableAmount = existing.taxableAmount.plus(li.taxableAmount ?? li.lineSubtotal);
      existing.taxAmount = existing.taxAmount.plus(li.taxAmount ?? ZERO);
    } else {
      groups.set(key, {
        rate: rate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        name: li.tax_name ?? "",
        taxableAmount: li.taxableAmount instanceof Decimal ? li.taxableAmount : new Decimal(li.taxableAmount ?? li.lineSubtotal),
        taxAmount: li.taxAmount instanceof Decimal ? li.taxAmount : new Decimal(li.taxAmount ?? 0),
      });
    }
  }

  for (const fee of fees) {
    const rate = fee.taxRate instanceof Decimal ? fee.taxRate : new Decimal(fee.taxRate ?? 0);
    if (rate.isZero()) continue;
    const key = `${rate.toFixed(4)}|${fee.tax_name ?? ""}`;
    const existing = groups.get(key);
    const feeTaxable = fee.amount instanceof Decimal ? fee.amount : new Decimal(fee.amount);
    if (existing) {
      existing.taxableAmount = existing.taxableAmount.plus(feeTaxable);
      existing.taxAmount = existing.taxAmount.plus(fee.taxAmount ?? ZERO);
    } else {
      groups.set(key, {
        rate: rate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        name: fee.tax_name ?? "",
        taxableAmount: feeTaxable,
        taxAmount: fee.taxAmount instanceof Decimal ? fee.taxAmount : new Decimal(fee.taxAmount ?? 0),
      });
    }
  }

  return Array.from(groups.values()).map((g) => ({
    rate: g.rate,
    name: g.name,
    taxableAmount: g.taxableAmount.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP),
    taxAmount: g.taxAmount.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP),
  }));
}
