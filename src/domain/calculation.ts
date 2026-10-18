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

export interface TaxRuleInput {
  id: string;
  name: string;
  rate: Decimal.Value;
  type: "percentage" | "fixed";
  isCompound: boolean;
  countryCode?: string | null;
  region?: string | null;
  conditions: TaxRuleConditionInput[];
}

export type TaxRuleConditionOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "contains"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal";

export interface TaxRuleConditionInput {
  field:
    | "customer_country"
    | "customer_state"
    | "product_category"
    | "item_description"
    | "currency"
    | "total_amount_min"
    | "total_amount_max";
  operator: TaxRuleConditionOperator;
  value: string;
  sortOrder?: number;
}

export interface TaxRuleContext {
  customerCountry?: string | null;
  customerState?: string | null;
  productCategories?: string[];
  currency?: string;
  lineItemCount?: number;
  totalAmount?: string;
  itemDescriptions?: string[];
}

export interface DiscountRuleInput {
  id: string;
  name: string;
  type: "fixed" | "percentage";
  value: Decimal.Value;
  scope: "invoice" | "line_item";
  appliesTo?: string | null;
  minAmount?: Decimal.Value | null;
  maxDiscount?: Decimal.Value | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface InvoiceCalculationInputWithRules extends InvoiceCalculationInput {
  taxRules?: TaxRuleInput[];
  discountRules?: DiscountRuleInput[];
  taxRuleContext?: TaxRuleContext;
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
    return this.calculateWithRulesInternal({
      ...input,
      taxRules: [],
      discountRules: [],
    });
  }

  calculateWithRules(input: InvoiceCalculationInputWithRules): CalculationResult {
    return this.calculateWithRulesInternal(input);
  }

  private calculateWithRulesInternal(input: InvoiceCalculationInputWithRules): CalculationResult {
    const { currency } = input;
    const meta = getCurrencyMetadata(currency);
    const dp = meta.decimalPlaces;

    const round = (v: Decimal.Value): Decimal => (v instanceof Decimal ? v : new Decimal(v)).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
    const roundRate = (v: Decimal.Value): Decimal => (v instanceof Decimal ? v : new Decimal(v)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

    // Evaluate applicable tax rules
    const applicableTaxRules = this.evaluateTaxRules(input.taxRules ?? [], input.taxRuleContext, input.currency);
    const subtotalForRules = input.lineItems.reduce(
      (sum, li) => sum.plus(new Decimal(li.quantity).mul(li.unitPrice)),
      ZERO,
    );
    const applicableDiscountRules = this.evaluateDiscountRules(
      input.discountRules ?? [],
      subtotalForRules,
       input.currency,
    );

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

      // Apply tax rule if no explicit tax rate or rate is zero
      let effectiveTaxRate = taxRate;
      let effectiveTaxName = item.tax_name ?? null;
      if (taxRate.isZero() && applicableTaxRules.length > 0) {
        const rule = this.findApplicableTaxRuleForItem(item, applicableTaxRules, input.taxRuleContext);
        if (rule) {
          effectiveTaxRate = new Decimal(rule.rate);
          effectiveTaxName = rule.name;
        }
      }

      const lineSubtotal = round(qty.mul(unitPrice));
      let lineDiscount = discountAmount(item.discount, lineSubtotal, currency);

      // Apply line-level discount rules if no explicit discount
      const rule = this.findApplicableLineDiscountRule(item, applicableDiscountRules);
      if (rule) {
        const ruleDiscount = this.computeRuleDiscount(rule, lineSubtotal);
        if (ruleDiscount.gt(new Decimal(0))) {
          if (new Decimal(lineDiscount).isZero()) {
            lineDiscount = ruleDiscount;
          }
        }
      }

      lineItems.push({
        description: item.description,
        quantity: qty,
        unit: item.unit,
        unitPrice,
        discountAmount: lineDiscount,
        taxRate: effectiveTaxRate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        taxName: effectiveTaxName,
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
    // Invoice-level discount (from explicit discount definition)
    const explicitInvoiceDiscount = discountAmount(input.invoiceDiscount, netAfterLineDiscounts, currency);

    // Invoice-level discount from rules
    let ruleDiscountTotal = ZERO;
    for (const rule of applicableDiscountRules) {
      if (rule.scope === "invoice") {
        const ruleDiscount = this.computeRuleDiscount(rule, netAfterLineDiscounts);
        if (ruleDiscount.gt(ruleDiscountTotal)) {
          ruleDiscountTotal = ruleDiscount;
        }
      }
    }

    const totalInvoiceDiscount = explicitInvoiceDiscount.plus(ruleDiscountTotal);
    const discountTotal = round(lineDiscountTotal.plus(totalInvoiceDiscount));

    // Distribute the invoice discount proportionally across lines based on their net contribution
    const lineShares = new Array(lineItems.length).fill(null).map(() => ZERO);
    if (totalNet.isZero()) {
      // lineShares already zero by default
    } else {
      for (let i = 0; i < lineItems.length; i++) {
        const net = lineItems[i].lineSubtotal.minus(lineItems[i].discountAmount);
        lineShares[i] = round(totalInvoiceDiscount.mul(net.div(totalNet)));
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
      taxableTotal: round(netAfterLineDiscounts.minus(totalInvoiceDiscount)),
      taxTotal: round(taxTotal),
      feeTotal: round(feeTotal),
      total: round(total),
      amountDue,
      amountPaid,
      isTaxInclusive: hasTaxInclusive,
      taxBreakdown,
    };
  }

  private evaluateTaxRules(
    rules: TaxRuleInput[],
    context: TaxRuleContext | undefined,
    currency: CurrencyCode,
  ): TaxRuleInput[] {
    return rules.filter((rule) => {
      if (!rule.conditions || rule.conditions.length === 0) return true;

      for (const condition of rule.conditions) {
        const fieldValue = this.getContextValue(condition.field, context, currency);
        if (!this.evaluateCondition(condition.operator, fieldValue, condition.value)) {
          return false;
        }
      }
      return true;
    });
  }

  private evaluateCondition(
    operator: TaxRuleConditionOperator,
    fieldValue: string | undefined,
    compareTo: string,
  ): boolean {
    if (fieldValue === undefined || fieldValue === null) {
      return operator === "not_equals" || operator === "not_in";
    }

    switch (operator) {
      case "equals":
        return fieldValue === compareTo;
      case "not_equals":
        return fieldValue !== compareTo;
      case "in":
        return compareTo.split(",").map((v) => v.trim()).includes(fieldValue);
      case "not_in":
        return !compareTo.split(",").map((v) => v.trim()).includes(fieldValue);
      case "contains":
        return fieldValue.toLowerCase().includes(compareTo.toLowerCase());
      case "greater_than":
        return Number(fieldValue) > Number(compareTo);
      case "less_than":
        return Number(fieldValue) < Number(compareTo);
      case "greater_than_or_equal":
        return Number(fieldValue) >= Number(compareTo);
      case "less_than_or_equal":
        return Number(fieldValue) <= Number(compareTo);
      default:
        return true;
    }
  }

  private getContextValue(
    field: TaxRuleConditionInput["field"],
    context: TaxRuleContext | undefined,
    currency: CurrencyCode,
  ): string | undefined {
    if (!context) return undefined;

    switch (field) {
      case "customer_country":
        return context.customerCountry ?? undefined;
      case "customer_state":
        return context.customerState ?? undefined;
      case "product_category":
        return context.productCategories?.[0];
      case "item_description":
        return context.itemDescriptions?.[0];
      case "currency":
        return currency;
      case "total_amount_min":
      case "total_amount_max":
        return context.totalAmount;
      default:
        return undefined;
    }
  }

  private findApplicableTaxRuleForItem(
    item: LineItemInput,
    rules: TaxRuleInput[],
    context: TaxRuleContext | undefined,
  ): TaxRuleInput | undefined {
    return rules.find((rule) => {
      if (rule.conditions.length === 0) return true;

      if (!context?.productCategories || context.productCategories.length === 0) {
        for (const condition of rule.conditions) {
          if (condition.field === "product_category") {
            return false;
          }
        }
        return true;
      }

      for (const condition of rule.conditions) {
        if (condition.field === "product_category") {
          const fieldValue = context.productCategories[0];
          if (!this.evaluateCondition(condition.operator, fieldValue, condition.value)) {
            return false;
          }
        }
      }
      return true;
    });
  }

  private evaluateDiscountRules(
    rules: DiscountRuleInput[],
    totalAmount: Decimal,
    _currency: CurrencyCode,
  ): DiscountRuleInput[] {
    const now = new Date();
    return rules.filter((rule) => {
      if (rule.startsAt && now < rule.startsAt) return false;
      if (rule.endsAt && now > rule.endsAt) return false;
      if (rule.minAmount && totalAmount.lt(new Decimal(rule.minAmount))) return false;
      return true;
    });
  }

  private findApplicableLineDiscountRule(
    item: LineItemInput,
    rules: DiscountRuleInput[],
  ): DiscountRuleInput | undefined {
    return rules.find((rule) => rule.scope === "line_item");
  }

  private computeRuleDiscount(rule: DiscountRuleInput, base: Decimal): Decimal {
    const value = new Decimal(rule.value);
    let amount: Decimal;

    if (rule.type === "percentage") {
      amount = base.mul(value.div(100));
    } else {
      amount = value;
    }

    if (amount.isNegative()) return ZERO;
    if (amount.gt(base)) amount = base;

    if (rule.maxDiscount) {
      const maxD = new Decimal(rule.maxDiscount);
      if (amount.gt(maxD)) amount = maxD;
    }

    return amount;
  }
}

export const calculationEngine = new CalculationEngine();

export type DocumentTypeForCalculation =
  | "invoice"
  | "credit_note"
  | "debit_note"
  | "payment_voucher"
  | "quote"
  | "receipt"
  | "purchase_order";

export interface DocumentCalculationInput {
  docType: DocumentTypeForCalculation;
  currency: CurrencyCode;
  lineItems: LineItemInput[];
  fees?: FeeInput[];
  documentDiscount?: DiscountDefinition;
  amountPaid?: Decimal.Value;
  referenceInvoiceTotal?: Decimal.Value;
  referenceInvoiceAmountDue?: Decimal.Value;
}

export function calculateDocument(input: DocumentCalculationInput): CalculationResult {
  return calculationEngine.calculate({
    currency: input.currency,
    lineItems: input.lineItems,
    fees: input.fees,
    invoiceDiscount: input.documentDiscount,
    amountPaid: input.amountPaid,
  });
}

