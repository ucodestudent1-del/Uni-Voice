import { useMemo } from "react";
import { Decimal } from "decimal.js";
import { calculationEngine } from "@/utils/calculation";
import type {
  LineItemInput,
  FeeInput,
  InvoiceCalculationInput,
  CalculatedLineItem,
  CalculatedFee,
  CalculationResult,
} from "@/types/calculation";
import { SUPPORTED_CURRENCIES } from "@/types/currency";
import type { CurrencyCode } from "@/types/currency";
import type {
  ValidationSeverity,
  ValidationIssue,
  ValidatableItem,
  ValidatableFee,
  ValidationInput,
  InvoiceValidationState,
} from "@/types/validation";
import {
  EMPTY_VALIDATION_STATE,
  validateInvoice,
  validateInvoiceSync,
} from "@/types/validation";

export type {
  ValidationSeverity,
  ValidationIssue,
  ValidatableItem,
  ValidatableFee,
  ValidationInput,
  InvoiceValidationState,
};

export { EMPTY_VALIDATION_STATE, validateInvoice, validateInvoiceSync };

const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCIES.map((c) => c.toUpperCase()));

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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

export function useInvoiceValidation(
  data: ValidationInput | null | undefined,
  predefinedCalc?: CalculationResult
): InvoiceValidationState {
  return useMemo(() => {
    if (!data) {
      return EMPTY_VALIDATION_STATE;
    }
    const issues = validateInvoice(data, predefinedCalc);
    const hasErrors = issues.some((i) => i.severity === "error");
    const hasWarnings = issues.some((i) => i.severity === "warning");
    return {
      valid: !hasErrors,
      isValid: !hasErrors,
      issues,
      hasErrors,
      hasWarnings,
      isDirty: issues.length > 0,
    };
  }, [data, predefinedCalc]);
}
