import { useMemo } from "react";
import { Decimal } from "decimal.js";

export interface QuoteValidationError {
  field: string;
  message: string;
}

export interface QuoteValidationWarning {
  field: string;
  message: string;
}

export interface QuoteValidationResult {
  errors: QuoteValidationError[];
  warnings: QuoteValidationWarning[];
  isValid: boolean;
  hasBlockingErrors: boolean;
}

export interface QuoteValidationState {
  customerId: string;
  currency: string;
  issueDate: string;
  expiryDate: string;
  items: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
  }>;
  fees: Array<{
    description: string;
    amount: string;
    taxRate: string;
  }>;
  depositValue: string;
  depositType: "none" | "percentage" | "fixed";
  terms?: string;
  notes?: string;
  paymentInstructions?: string;
}

const ERROR_MESSAGES = {
  customerRequired: "Select a customer to proceed",
  currencyInvalid: "Select a valid currency",
  issueDateRequired: "Set an issue date",
  expiryDateAfterIssue: "Expiry date must be after the issue date",
  noLineItems: "Add at least one line item",
  descriptionRequired: "Description is required",
  quantityPositive: "Quantity must be greater than 0",
  unitPriceNonNegative: "Unit price must be 0 or more",
  taxRateRange: "Tax rate must be between 0% and 100%",
  depositValueNonNegative: "Deposit value must be 0 or more",
  depositValuePercentage: "Deposit percentage must be between 0 and 100",
};

const WARNING_MESSAGES = {
  paymentTermsEmpty: "Add payment terms to guide your customer",
  notesEmpty: "Add notes for additional context",
  paymentInstructionsEmpty: "Add payment instructions so the customer knows how to pay",
  itemNoDescription: "Line item #X has no description",
  feeNoDescription: "Fee #X has no description",
  zeroTaxRate: "Line item has 0% tax rate — verify if this is correct",
};

export function validateQuote(state: QuoteValidationState): QuoteValidationResult {
  const errors: QuoteValidationError[] = [];
  const warnings: QuoteValidationWarning[] = [];

  if (!state.customerId) {
    errors.push({ field: "customerId", message: ERROR_MESSAGES.customerRequired });
  }

  try {
    const upper = state.currency.toUpperCase();
    if (!upper || upper.length !== 3) {
      errors.push({ field: "currency", message: ERROR_MESSAGES.currencyInvalid });
    }
  } catch {
    errors.push({ field: "currency", message: ERROR_MESSAGES.currencyInvalid });
  }

  if (!state.issueDate) {
    errors.push({ field: "issueDate", message: ERROR_MESSAGES.issueDateRequired });
  } else if (state.expiryDate && state.expiryDate < state.issueDate) {
    errors.push({ field: "expiryDate", message: ERROR_MESSAGES.expiryDateAfterIssue });
  }

  const validItems = state.items.filter((item) => item.description.trim());
  if (validItems.length === 0) {
    errors.push({ field: "items", message: ERROR_MESSAGES.noLineItems });
  }

  state.items.forEach((item, idx) => {
    if (item.description && !item.description.trim()) {
      errors.push({ field: `items.${idx}.description`, message: ERROR_MESSAGES.descriptionRequired });
    }
    const qty = new Decimal(item.quantity || "0");
    if (item.description.trim() && qty.lte(0)) {
      errors.push({ field: `items.${idx}.quantity`, message: ERROR_MESSAGES.quantityPositive });
    }
    if (item.description.trim()) {
      const price = new Decimal(item.unitPrice || "0");
      if (price.lt(0)) {
        errors.push({ field: `items.${idx}.unitPrice`, message: ERROR_MESSAGES.unitPriceNonNegative });
      }
      const tax = new Decimal(item.taxRate || "0");
      if (tax.lt(0) || tax.gt(1)) {
        errors.push({ field: `items.${idx}.taxRate`, message: ERROR_MESSAGES.taxRateRange });
      }
    }
  });

  if (state.depositType !== "none" && state.depositValue) {
    const depositVal = new Decimal(state.depositValue || "0");
    if (depositVal.lt(0)) {
      errors.push({ field: "depositValue", message: ERROR_MESSAGES.depositValueNonNegative });
    }
    if (state.depositType === "percentage" && (depositVal.gt(100) || depositVal.lt(0))) {
      errors.push({ field: "depositValue", message: ERROR_MESSAGES.depositValuePercentage });
    }
  }

  state.fees.forEach((fee, idx) => {
    if (fee.description && !fee.description.trim()) {
      warnings.push({ field: `fees.${idx}.description`, message: WARNING_MESSAGES.feeNoDescription.replace("X", String(idx + 1)) });
    }
  });

  if (!state.terms || !state.terms.trim()) {
    warnings.push({ field: "terms", message: WARNING_MESSAGES.paymentTermsEmpty });
  }
  if (!state.notes || !state.notes.trim()) {
    warnings.push({ field: "notes", message: WARNING_MESSAGES.notesEmpty });
  }
  if (!state.paymentInstructions || !state.paymentInstructions.trim()) {
    warnings.push({ field: "paymentInstructions", message: WARNING_MESSAGES.paymentInstructionsEmpty });
  }

  return {
    errors: errors,
    warnings: warnings,
    isValid: errors.length === 0,
    hasBlockingErrors: errors.length > 0,
  };
}

export function useQuoteValidation(state: QuoteValidationState) {
  return useMemo(() => validateQuote(state), [
    state.customerId,
    state.currency,
    state.issueDate,
    state.expiryDate,
    state.items,
    state.fees,
    state.depositValue,
    state.depositType,
    state.terms,
    state.notes,
    state.paymentInstructions,
  ]);
}
