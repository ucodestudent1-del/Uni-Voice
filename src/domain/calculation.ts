import { Decimal } from "decimal.js";
import { CurrencyCode, getCurrencyMetadata } from "./value-objects/currency.js";

export type DiscountType = "fixed" | "percentage";

export interface DiscountDefinition {
  type: DiscountType;
  value: Decimal.Value;
}

export function discountAmount(discount: DiscountDefinition | undefined, base: Decimal, currency: CurrencyCode): Decimal {
  if (!discount) return new Decimal(0);
  const meta = getCurrencyMetadata(currency);
  const d = new Decimal(discount.value);
  let amount: Decimal;
  if (discount.type === "percentage") {
    amount = base.mul(d.div(100));
  } else {
    amount = new Decimal(d);
  }
  // A discount cannot exceed the base amount
  if (amount.gt(base)) {
    amount = base;
  }
  if (amount.isNegative()) {
    amount = new Decimal(0);
  }
  return amount.toDecimalPlaces(meta.decimalPlaces, Decimal.ROUND_HALF_UP);
}

export interface LineItemInput {
  description: string;
  quantity: Decimal.Value;
  unit: string;
  unitPrice: Decimal.Value;
  discount?: DiscountDefinition;
  taxRate: Decimal.Value;
  isTaxInclusive: boolean;
  sortOrder?: number;
}

export interface FeeInput {
  description: string;
  amount: Decimal.Value;
  taxRate?: Decimal.Value;
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
  taxAmount: Decimal;
  feeTotal: Decimal;
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
}

export class CalculationEngine {
  calculate(input: InvoiceCalculationInput): CalculationResult {
    const { currency } = input;
    const meta = getCurrencyMetadata(currency);
    const dp = meta.decimalPlaces;
    const round = (v: Decimal.Value): Decimal => new Decimal(v).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
    const roundRate = (v: Decimal.Value): Decimal => new Decimal(v).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

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
        unitPrice: round(unitPrice),
        discountAmount: lineDiscount,
        taxRate: roundRate(taxRate),
        isTaxInclusive: item.isTaxInclusive,
        lineSubtotal,
        // filled in pass 2
        taxableAmount: new Decimal(0),
        taxAmount: new Decimal(0),
        lineTotal: new Decimal(0),
      });
    }

    let subtotal = new Decimal(0);
    let lineDiscountTotal = new Decimal(0);
    let totalNet = new Decimal(0); // sum of (lineSubtotal - lineDiscount)

    for (const li of lineItems) {
      subtotal = subtotal.plus(li.lineSubtotal);
      lineDiscountTotal = lineDiscountTotal.plus(li.discountAmount);
      totalNet = totalNet.plus(li.lineSubtotal.minus(li.discountAmount));
    }

    // Invoice-level discount (applied to the net subtotal, i.e. after line discounts)
    const invoiceDiscount = discountAmount(input.invoiceDiscount, subtotal.minus(lineDiscountTotal), currency);
    const discountTotal = round(lineDiscountTotal.plus(invoiceDiscount));

    // Distribute the invoice discount proportionally across lines based on their net contribution
    const lineShares = new Array(lineItems.length).fill(new Decimal(0));
    if (totalNet.isZero()) {
      for (let i = 0; i < lineItems.length; i++) lineShares[i] = new Decimal(0);
    } else {
      for (let i = 0; i < lineItems.length; i++) {
        const net = lineItems[i].lineSubtotal.minus(lineItems[i].discountAmount);
        lineShares[i] = round(invoiceDiscount.mul(net.div(totalNet)));
      }
    }

    let taxTotal = new Decimal(0);
    let total = new Decimal(0);

    // Pass 2: tax + line total per line (handles inclusive & exclusive)
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      const effectiveTaxable = round(li.lineSubtotal.minus(li.discountAmount).minus(lineShares[i]));

      let taxAmount: Decimal;

      if (li.isTaxInclusive) {
        // unit price already includes tax; extract the tax component
        if (li.taxRate.isZero() || effectiveTaxable.isZero()) {
          taxAmount = round(new Decimal(0));
        } else {
          const ratio = li.taxRate.div(new Decimal(1).plus(li.taxRate));
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
    let feeTotal = new Decimal(0);

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
        taxAmount: feeTaxAmount,
        feeTotal: feeLineTotal,
      });
      feeTotal = feeTotal.plus(feeBase);
      taxTotal = taxTotal.plus(feeTaxAmount);
      total = total.plus(feeLineTotal);
    }

    const amountPaid = round(new Decimal(input.amountPaid ?? 0));
    if (amountPaid.isNegative()) {
      throw new Error("Amount paid must be >= 0");
    }

    const amountDue = round(total.minus(amountPaid));

    const isTaxInclusive = lineItems.some((li) => li.isTaxInclusive);

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
    };
  }
}

export const calculationEngine = new CalculationEngine();
