import type { Decimal } from "decimal.js";
import type { CurrencyCode } from "../value-objects/currency.js";

export type ProductServiceType = "product" | "service";

export type ProductServiceStatus = "active" | "archived" | "draft";

export interface ProductService {
  id: string;
  tenantId: string;
  type: ProductServiceType;
  name: string;
  description: string | null;
  sku: string | null;
  unit: string;
  unitPrice: string;
  defaultTaxRate: string;
  taxCategory: string | null;
  currency: CurrencyCode;
  status: ProductServiceStatus;
  discountType: "fixed" | "percentage";
  discountValue: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductServiceSnapshot {
  productId: string;
  productType: ProductServiceType;
  name: string;
  description: string | null;
  sku: string | null;
  unit: string;
  unitPrice: string;
  taxCategory: string | null;
  taxRate: string;
  discountType: "fixed" | "percentage";
  discountValue: string;
  currency: CurrencyCode;
}

export interface InvoiceLineItemSnapshot {
  catalogProductId: string | null;
  catalogName: string | null;
  catalogSku: string | null;
  catalogTaxCategory: string | null;
  catalogUnitPrice: string | null;
  catalogTaxRate: string | null;
  description: string;
  quantity: Decimal.Value;
  unit: string;
  unitPrice: Decimal.Value;
  discount: Decimal.Value;
  discountValue: Decimal.Value;
  discountType: "fixed" | "percentage";
  taxRate: Decimal.Value;
  isTaxInclusive: boolean;
}

export const PRODUCT_SERVICE_STATUSES: ProductServiceStatus[] = ["active", "archived", "draft"];

export const PRODUCT_SERVICE_TYPES: ProductServiceType[] = ["product", "service"];
