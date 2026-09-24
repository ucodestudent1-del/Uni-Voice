import type { ApiCustomer } from "./api";

export interface BuilderLineItem {
  id: string;
  productId?: string | null;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount: string;
  discountType: "fixed" | "percentage";
  taxRate: string;
  isTaxInclusive: boolean;
}

export interface BuilderFee {
  id: string;
  description: string;
  amount: string;
  taxRate: string;
}

export interface BuilderDiscount {
  type: "fixed" | "percentage" | "none";
  value: string;
}

export interface QuoteBuilderData {
  customerId: string | null;
  customer: ApiCustomer | null;
  currency: string;
  issueDate: string;
  dueDate: string;
  expiryDate: string | null;
  notes: string;
  terms: string;
  paymentInstructions: string;
  discount: BuilderDiscount;
  items: BuilderLineItem[];
  fees: BuilderFee[];
  savedQuoteId: string | null;
}

export type SaveState = "saved" | "saving" | "unsaved" | "error";

export const DEFAULT_LINE_ITEM: Omit<BuilderLineItem, "id"> = {
  productId: null,
  description: "",
  quantity: "1",
  unit: "each",
  unitPrice: "0.00",
  discount: "0",
  discountType: "fixed",
  taxRate: "0",
  isTaxInclusive: false,
};

export const DEFAULT_FEE: Omit<BuilderFee, "id"> = {
  description: "",
  amount: "0.00",
  taxRate: "0",
};

export const DEFAULT_DISCOUNT: BuilderDiscount = {
  type: "none",
  value: "0",
};

export const LINE_ITEM_UNITS = ["each", "hour", "day", "week", "month", "fixed"] as const;

export function generateRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
