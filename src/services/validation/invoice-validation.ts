import { Decimal } from "decimal.js";
import {
  calculationEngine,
  type CalculationResult,
  type FeeInput,
  type InvoiceCalculationInput,
  type LineItemInput,
} from "../../domain/calculation.js";
import {
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from "../../domain/value-objects/currency.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
  field?: string;
  fix?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface ValidatableLineItem {
  description: string;
  quantity: Decimal.Value;
  unit?: string;
  unitPrice: Decimal.Value;
  discount?: Decimal.Value;
  discountType?: "fixed" | "percentage" | null;
  taxRate?: Decimal.Value;
  isTaxInclusive?: boolean;
}

export interface ValidatableFee {
  description: string;
  amount: Decimal.Value;
  taxRate?: Decimal.Value;
}

export interface InvoiceValidationInput {
  customerId?: string | null;
  currency?: string;
  issueDate?: Date | string | null;
  dueDate?: Date | string | null;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  subtotal?: Decimal.Value;
  discountTotal?: Decimal.Value;
  taxTotal?: Decimal.Value;
  feeTotal?: Decimal.Value;
  total?: Decimal.Value;
  amountPaid?: Decimal.Value;
  amountDue?: Decimal.Value;
  items: ValidatableLineItem[];
  fees?: ValidatableFee[];
}

const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export class InvoiceValidationService {
  validate(input: InvoiceValidationInput): ValidationResult {
    const issues: ValidationIssue[] = [];
    const items = input.items || [];
    const normalizedCurrency = (input.currency ?? "").toUpperCase();
    const currencyValid = SUPPORTED_CURRENCY_SET.has(normalizedCurrency);

    if (!input.customerId) {
      issues.push({
        code: "MISSING_CUSTOMER",
        message: "Invoice must have a customer selected",
        severity: "error",
        field: "customerId",
        fix: "Select a customer from the customer list",
      });
    }

    if (!currencyValid) {
      issues.push({
        code: "UNSUPPORTED_CURRENCY",
        message: `Currency "${input.currency || "unset"}" is not supported`,
        severity: "error",
        field: "currency",
        fix: `Use one of: ${SUPPORTED_CURRENCIES.join(", ")}`,
      });
    }

    const issueDate = toDate(input.issueDate);
    if (!issueDate) {
      issues.push({
        code: "MISSING_ISSUE_DATE",
        message: "Issue date is required",
        severity: "error",
        field: "issueDate",
        fix: "Set an issue date for this invoice",
      });
    } else {
      const dueDate = toDate(input.dueDate);
      if (dueDate && dueDate < issueDate) {
        issues.push({
          code: "INVALID_DUE_DATE",
          message: "Due date must be on or after the issue date",
          severity: "error",
          field: "dueDate",
          fix: "Adjust the due date so it falls on or after the issue date",
        });
      }
    }

    if (items.length === 0) {
      issues.push({
        code: "EMPTY_LINE_ITEMS",
        message: "At least one line item is required",
        severity: "error",
        field: "items",
        fix: "Add at least one product or service line item",
      });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const label = item.description && item.description.trim()
        ? `"${item.description}"`
        : `#${i + 1}`;

      if (!item.description || item.description.trim() === "") {
        issues.push({
          code: "MISSING_ITEM_DESCRIPTION",
          message: `Line item ${i + 1} is missing a description`,
          severity: "error",
          field: `items[${i}].description`,
          fix: "Enter a description for this line item",
        });
      }

      const qty = new Decimal(item.quantity ?? 0);
      if (qty.isZero() || qty.isNegative()) {
        issues.push({
          code: "INVALID_QUANTITY",
          message: `Line item ${label} has a zero or negative quantity`,
          severity: "error",
          field: `items[${i}].quantity`,
          fix: "Set the quantity to a positive number",
        });
      }

      const price = new Decimal(item.unitPrice ?? 0);
      if (price.isNegative()) {
        issues.push({
          code: "NEGATIVE_UNIT_PRICE",
          message: `Line item ${label} has a negative unit price`,
          severity: "error",
          field: `items[${i}].unitPrice`,
          fix: "Set a non-negative unit price",
        });
      }
    }

    if (!input.paymentInstructions || input.paymentInstructions.trim() === "") {
      issues.push({
        code: "MISSING_PAYMENT_INSTRUCTIONS",
        message: "No payment instructions set — customers won't know how to pay",
        severity: "warning",
        field: "paymentInstructions",
        fix: "Add payment instructions (e.g. bank transfer details, PayPal, Stripe Checkout link)",
      });
    }

    if (!input.notes || input.notes.trim() === "") {
      issues.push({
        code: "MISSING_NOTES",
        message: "No notes set — consider adding context for the customer",
        severity: "warning",
        field: "notes",
        fix: "Add notes (e.g. payment terms, special instructions)",
      });
    }

    if (currencyValid && items.length > 0) {
      issues.push(...this.checkCalculations(input, normalizedCurrency));
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    const hasWarnings = issues.some((i) => i.severity === "warning");

    return {
      valid: !hasErrors,
      issues,
      hasErrors,
      hasWarnings,
    };
  }

  private checkCalculations(input: InvoiceValidationInput, currency: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      const calcInput = this.buildCalcInput(input, currency as CurrencyCode);
      const result = calculationEngine.calculate(calcInput);

      if (result.total.isNegative()) {
        issues.push({
          code: "NEGATIVE_TOTAL",
          message: "Invoice total cannot be negative after calculation",
          severity: "error",
          field: "total",
          fix: "Remove or adjust line items and fees so the total is non-negative",
        });
      }

      const storedTotal = new Decimal(input.total ?? 0);
      if (!storedTotal.isZero()) {
        issues.push(...this.compareTotals(input, result));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      issues.push({
        code: "CALCULATION_ERROR",
        message: `Unable to verify calculations: ${message}`,
        severity: "error",
        field: "items",
        fix: "Ensure all line items have valid quantities, prices, and tax rates",
      });
    }

    return issues;
  }

  private buildCalcInput(input: InvoiceValidationInput, currency: CurrencyCode): InvoiceCalculationInput {
    const lineItems: LineItemInput[] = (input.items || []).map((it) => ({
      description: it.description ?? "",
      quantity: it.quantity ?? 0,
      unit: it.unit ?? "each",
      unitPrice: it.unitPrice ?? 0,
      discount:
        it.discount && !new Decimal(it.discount).isZero()
          ? { type: it.discountType ?? "fixed", value: it.discount }
          : undefined,
      taxRate: it.taxRate ?? 0,
      isTaxInclusive: it.isTaxInclusive ?? false,
    }));

    const fees: FeeInput[] = (input.fees || []).map((f) => ({
      description: f.description,
      amount: f.amount,
      taxRate: f.taxRate ?? 0,
    }));

    return {
      currency,
      lineItems,
      fees: fees.length ? fees : undefined,
      amountPaid: input.amountPaid,
    };
  }

  private compareTotals(input: InvoiceValidationInput, result: CalculationResult): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const dp = result.decimalPlaces;

    const fields: Array<{ key: string; stored: Decimal.Value | undefined; computed: Decimal }> = [
      { key: "subtotal", stored: input.subtotal, computed: result.subtotal },
      { key: "discountTotal", stored: input.discountTotal, computed: result.discountTotal },
      { key: "taxTotal", stored: input.taxTotal, computed: result.taxTotal },
      { key: "feeTotal", stored: input.feeTotal, computed: result.feeTotal },
      { key: "total", stored: input.total, computed: result.total },
      { key: "amountDue", stored: input.amountDue, computed: result.amountDue },
      { key: "amountPaid", stored: input.amountPaid, computed: result.amountPaid },
    ];

    for (const { key, stored, computed } of fields) {
      const storedDec = new Decimal(stored ?? 0);
      const roundedStored = storedDec.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
      if (!roundedStored.equals(computed)) {
        issues.push({
          code: "CALCULATION_DISCREPANCY",
          message: `Stored ${key} (${storedDec.toFixed(dp)}) does not match computed value (${computed.toFixed(dp)})`,
          severity: "error",
          field: key,
          fix: "Recalculate totals to ensure stored values match the line items and fees",
        });
      }
    }

    return issues;
  }
}

export const invoiceValidationService = new InvoiceValidationService();
