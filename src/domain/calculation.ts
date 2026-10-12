import { Decimal } from "decimal.js";
import { CurrencyCode, getCurrencyMetadata } from "./value-objects/currency.js";

const ZERO = new Decimal(0);
const ONE = new Decimal(1);

export type DiscountType = "fixed" | "percentage";

export interface DiscountDefinition {
  type: DiscountType;
  value: Decimal.Value;
}

export function discountAmount(discount: DiscountDefinition | undefined, base: Decimal, currency: CurrencyCode): Decimal {
  if (!discount) return ZERO;
  const d = discount.value instanceof Decimal ? discount.value : new Decimal(discount.value);
  const meta = getCurrencyMetadata(currency);
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

export interface LineItemInput {
  description: string;
  quantity: Decimal.Value;
  unit: string;
  unitPrice: Decimal.Value;
  discount?: DiscountDefinition;
  taxRate: Decimal.Value;
  tax_name?: string | null;
  isTaxInclusive: boolean;
  sortOrder?: number;
}

export interface FeeInput {
  description: string;
  amount: Decimal.Value;
  taxRate?: Decimal.Value;
  tax_name?: string | null;
  sortOrder?: number;
}

export interface InvoiceCalculationInput {
  currency: CurrencyCode;
  lineItems: LineItemInput[];
  fees?: FeeInput[];
  invoiceDiscount?: DiscountDefinition;
  amountPaid?: Decimal.Value;
}

export interface CalculatedLineItem {
  description: string;
  quantity: Decimal;
  unit: string;
  unitPrice: Decimal;
  discountAmount: Decimal;
  taxRate: Decimal;
  taxName?: string | null;
  isTaxInclusive: boolean;
  lineSubtotal: Decimal;
  taxableAmount: Decimal;
  taxAmount: Decimal;
  lineTotal: Decimal;
}

export interface CalculatedFee {
  description: string;
  amount: Decimal;
  taxRate: Decimal;
  taxName?: string | null;
  taxAmount: Decimal;
  feeTotal: Decimal;
}

export interface TaxBreakdownEntry {
  rate: Decimal;
  name: string;
  taxableAmount: Decimal;
  taxAmount: Decimal;
}

export interface CalculationResult {
  currency: CurrencyCode;
  decimalPlaces: number;
  lineItems: CalculatedLineItem[];
  fees: CalculatedFee[];
  subtotal: Decimal;
  discountTotal: Decimal;
  taxableTotal: Decimal;
  taxTotal: Decimal;
  feeTotal: Decimal;
  total: Decimal;
  amountDue: Decimal;
  amountPaid: Decimal;
  isTaxInclusive: boolean;
  taxBreakdown: TaxBreakdownEntry[];
}

export function computeTaxBreakdown(
  lineItems: CalculatedLineItem[],
  fees: CalculatedFee[],
  decimalPlaces: number
): TaxBreakdownEntry[] {
  const groups = new Map<string, { rate: Decimal; name: string; taxableAmount: Decimal; taxAmount: Decimal }>();

  for (const li of lineItems) {
    const rate = new Decimal(li.taxRate ?? 0);
    if (rate.isZero()) continue;
    const key = `${rate.toFixed(4)}|${li.taxName ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.taxableAmount = existing.taxableAmount.plus(li.taxableAmount ?? li.lineSubtotal);
      existing.taxAmount = existing.taxAmount.plus(li.taxAmount ?? 0);
    } else {
      groups.set(key, {
        rate: rate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        name: li.taxName ?? "",
        taxableAmount: new Decimal(li.taxableAmount ?? li.lineSubtotal),
        taxAmount: new Decimal(li.taxAmount ?? 0),
      });
    }
  }

  for (const fee of fees) {
    const rate = new Decimal(fee.taxRate ?? 0);
    if (rate.isZero()) continue;
    const key = `${rate.toFixed(4)}|${fee.taxName ?? ""}`;
    const existing = groups.get(key);
    const feeTaxable = new Decimal(fee.amount);
    if (existing) {
      existing.taxableAmount = existing.taxableAmount.plus(feeTaxable);
      existing.taxAmount = existing.taxAmount.plus(fee.taxAmount ?? 0);
    } else {
      groups.set(key, {
        rate: rate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        name: fee.taxName ?? "",
        taxableAmount: feeTaxable,
        taxAmount: new Decimal(fee.taxAmount ?? 0),
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

export class CalculationEngine {
  calculate(input: InvoiceCalculationInput): CalculationResult {
    const { currency } = input;
    const meta = getCurrencyMetadata(currency);
    const dp = meta.decimalPlaces;

    const round = (v: Decimal.Value): Decimal => (v instanceof Decimal ? v : new Decimal(v)).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
    const roundRate = (v: Decimal.Value): Decimal => (v instanceof Decimal ? v : new Decimal(v)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

    const lineItems: CalculatedLineItem[] = [];

    // Pass 1: line subtotals + per-line discounts
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
        unitPrice,
        discountAmount: lineDiscount,
        taxRate: taxRate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        taxName: item.tax_name ?? null,
        isTaxInclusive: item.isTaxInclusive,
        lineSubtotal,
        taxableAmount: ZERO,
        taxAmount: ZERO,
        lineTotal: ZERO,
      });
    }

    let subtotal = ZERO;
    let lineDiscountTotal = ZERO;
    let totalNet = ZERO; // sum of (lineSubtotal - lineDiscount)

    for (const li of lineItems) {
      subtotal = subtotal.plus(li.lineSubtotal);
      lineDiscountTotal = lineDiscountTotal.plus(li.discountAmount);
      totalNet = totalNet.plus(li.lineSubtotal.minus(li.discountAmount));
    }

    const netAfterLineDiscounts = subtotal.minus(lineDiscountTotal);
    // Invoice-level discount (applied to the net subtotal, i.e. after line discounts)
    const invoiceDiscount = discountAmount(input.invoiceDiscount, netAfterLineDiscounts, currency);
    const discountTotal = round(lineDiscountTotal.plus(invoiceDiscount));

    // Distribute the invoice discount proportionally across lines based on their net contribution
    const lineShares = new Array(lineItems.length).fill(null).map(() => ZERO);
    if (totalNet.isZero()) {
      // lineShares already zero by default
    } else {
      for (let i = 0; i < lineItems.length; i++) {
        const net = lineItems[i].lineSubtotal.minus(lineItems[i].discountAmount);
        lineShares[i] = round(invoiceDiscount.mul(net.div(totalNet)));
      }
    }

    let taxTotal = ZERO;
    let total = ZERO;

    // Pass 2: tax + line total per line (handles inclusive & exclusive)
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      const effectiveTaxable = round(li.lineSubtotal.minus(li.discountAmount).minus(lineShares[i]));

      let taxAmount: Decimal;

      if (li.isTaxInclusive) {
        // unit price already includes tax; extract the tax component
        if (li.taxRate.isZero() || effectiveTaxable.isZero()) {
          taxAmount = ZERO;
        } else {
          const ratio = li.taxRate.div(ONE.plus(li.taxRate));
          taxAmount = round(effectiveTaxable.mul(ratio));
        }
        const netAmount = round(effectiveTaxable.minus(taxAmount));
        li.taxableAmount = netAmount;
        li.taxAmount = taxAmount;
        li.lineTotal = round(effectiveTaxable); // gross already includes tax
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
        taxName: fee.tax_name ?? null,
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

    let hasTaxInclusive = false;
    for (const li of lineItems) {
      if (li.isTaxInclusive) { hasTaxInclusive = true; break; }
    }

    const taxBreakdown = computeTaxBreakdown(lineItems, fees, dp);

    return {
      currency,
      decimalPlaces: dp,
      lineItems,
      fees,
      subtotal: round(subtotal),
      discountTotal,
      taxableTotal: round(netAfterLineDiscounts.minus(invoiceDiscount)),
      taxTotal: round(taxTotal),
      feeTotal: round(feeTotal),
      total: round(total),
      amountDue,
      amountPaid,
      isTaxInclusive: hasTaxInclusive,
      taxBreakdown,
    };
  }
}

export const calculationEngine = new CalculationEngine();
