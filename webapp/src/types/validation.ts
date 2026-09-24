import { Decimal } from "decimal.js";
import { SUPPORTED_CURRENCIES } from "./currency";
import { calculationEngine } from "../utils/calculation";
import type { CurrencyCode } from "./currency";
import type { FeeInput, InvoiceCalculationInput, LineItemInput } from "./calculation";
import type { CalculatedLineItem, CalculatedFee, CalculationResult } from "./calculation";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
  field?: string;
  fix?: string;
}

export interface ValidatableItem {
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

export interface ValidationInput {
  customerId?: string | null;
  customer?: { name?: string | null; email?: string | null } | null;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  items: ValidatableItem[];
  fees?: ValidatableFee[];
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
}

export interface InvoiceValidationState {
  valid: boolean;
  isValid: boolean;
  issues: ValidationIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  isDirty: boolean;
}

export const EMPTY_VALIDATION_STATE: InvoiceValidationState = {
  valid: true,
  isValid: true,
  issues: [],
  hasErrors: false,
  hasWarnings: false,
  isDirty: false,
};

const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCIES.map((c) => c.toUpperCase()));

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function validateInvoice(data: ValidationInput, predefinedCalc?: CalculationResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const items = data.items || [];
  const normalizedCurrency = (data.currency ?? "").toUpperCase();
  const currencyValid = SUPPORTED_CURRENCY_SET.has(normalizedCurrency);

  if (!data.customerId) {
    issues.push({
      code: "MISSING_CUSTOMER",
      message: "Invoice must have a customer selected",
      severity: "error",
      field: "customerId",
      fix: "Select a customer from the customer list",
    });
  } else {
    if (!data.customer?.name?.trim()) {
      issues.push({
        code: "MISSING_CUSTOMER_NAME",
        message: "Customer name is missing",
        severity: "warning",
        field: "customer.name",
        fix: "Ensure the customer has a name set",
      });
    }
    if (!data.customer?.email) {
      issues.push({
        code: "MISSING_CUSTOMER_EMAIL",
        message: "Customer email is recommended for sending invoices",
        severity: "warning",
        field: "customer.email",
        fix: "Add an email address to the customer profile",
      });
    }
  }

  if (!currencyValid) {
    issues.push({
      code: "UNSUPPORTED_CURRENCY",
      message: `Currency "${data.currency || "unset"}" is not supported`,
      severity: "error",
      field: "currency",
      fix: `Use one of: ${SUPPORTED_CURRENCIES.join(", ")}`,
    });
  }

  const issueDate = toDate(data.issueDate);
  if (!issueDate) {
    issues.push({
      code: "MISSING_ISSUE_DATE",
      message: "Issue date is required",
      severity: "error",
      field: "issueDate",
      fix: "Set an issue date for this invoice",
    });
  } else {
    const dueDate = toDate(data.dueDate);
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

  if (!data.paymentInstructions || data.paymentInstructions.trim() === "") {
    issues.push({
      code: "MISSING_PAYMENT_INSTRUCTIONS",
      message: "No payment instructions set — customers won't know how to pay",
      severity: "warning",
      field: "paymentInstructions",
      fix: "Add payment instructions (e.g. bank transfer details, PayPal, Stripe Checkout link)",
    });
  }

  if (!data.notes || data.notes.trim() === "") {
    issues.push({
      code: "MISSING_NOTES",
      message: "No notes set — consider adding context for the customer",
      severity: "warning",
      field: "notes",
      fix: "Add notes (e.g. payment terms, special instructions)",
    });
  }

  if (currencyValid && items.length > 0) {
    issues.push(...checkCalculations(data, normalizedCurrency, predefinedCalc));
  }

  return issues;
}

function checkCalculations(data: ValidationInput, currency: string, predefinedCalc?: CalculationResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  try {
    let result: CalculationResult;
    if (predefinedCalc) {
      result = predefinedCalc;
    } else {
      const calcInput: InvoiceCalculationInput = {
        currency: currency as CurrencyCode,
        lineItems: itemsToLineInputs(data.items),
        fees: data.fees && data.fees.length > 0 ? data.fees.map(toFeeInput) : undefined,
      };

      result = calculationEngine.calculate(calcInput);
    }

    if (result.total.isNegative()) {
      issues.push({
        code: "NEGATIVE_TOTAL",
        message: "Invoice total cannot be negative after calculation",
        severity: "error",
        field: "total",
        fix: "Remove or adjust line items and fees so the total is non-negative",
      });
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

function itemsToLineInputs(items: ValidatableItem[]): LineItemInput[] {
  return items.map((it) => ({
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
}

function toFeeInput(fee: ValidatableFee): FeeInput {
  return {
    description: fee.description,
    amount: fee.amount,
    taxRate: fee.taxRate ?? 0,
  };
}

export const validateInvoiceSync = validateInvoice;
