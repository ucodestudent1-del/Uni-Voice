import type { Decimal } from "decimal.js";
import type { CurrencyCode } from "../../domain/value-objects/currency.js";

export interface TaxLineItem {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: Decimal.Value;
  unitPrice: Decimal.Value;
  taxableAmount: Decimal.Value;
  taxRate?: Decimal.Value;
  isTaxInclusive?: boolean;
  countryCode?: string;
  region?: string;
}

export interface TaxFeeItem {
  description: string;
  amount: Decimal.Value;
  countryCode?: string;
  region?: string;
}

export interface TaxRate {
  code: string;
  name: string;
  rate: Decimal.Value;
  type: "percentage";
  isCompound: boolean;
  jurisdiction?: string;
  countryCode?: string;
  region?: string;
}

export interface LineTax {
  lineItemId?: string;
  taxRate: Decimal.Value;
  taxAmount: Decimal.Value;
}

export interface FeeTax {
  description: string;
  taxRate: Decimal.Value;
  taxAmount: Decimal.Value;
}

export interface TaxCalculation {
  lineTaxes: LineTax[];
  feeTaxes: FeeTax[];
  totalTax: Decimal.Value;
}

export interface TaxContext {
  businessId: string;
  businessCountry?: string;
  businessTaxId?: string;
  customerId?: string;
  customerCountry?: string;
  customerTaxId?: string;
  currency: CurrencyCode;
  date: Date;
  lineItems: TaxLineItem[];
  fees?: TaxFeeItem[];
}

/**
 * Abstraction over tax providers.
 *
 * MVP uses ManualTaxProvider (rates pre-configured on line items).
 * Future: plug in Avalmar, TaxJar, etc. via this same interface without
 * touching the invoice domain.
 */
export interface TaxProvider {
  readonly name: string;
  calculateTax(context: TaxContext): Promise<TaxCalculation>;
  isExempt?(context: TaxContext): Promise<boolean>;
}

export interface TaxProviderConfig {
  type: "manual" | "avalara" | "taxjar" | string;
}
