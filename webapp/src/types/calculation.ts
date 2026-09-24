import type { Decimal } from "decimal.js";
import type { CurrencyCode } from "./currency";

export type DiscountType = "fixed" | "percentage";

export interface DiscountDefinition {
  type: DiscountType;
  value: Decimal.Value;
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
