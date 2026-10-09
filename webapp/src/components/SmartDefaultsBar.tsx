import React from "react";
import { Currency, Edit3, FileText, Receipt } from "lucide-react";
import { getCurrencyMetadata } from "@/types/currency";
import { formatTaxRate, fromPercentage, toPercent } from "@/utils/format";
import type { ApiBusiness } from "@/types/api";

interface SmartDefaultsBarProps {
  currency: string;
  taxRate: string;
  invoiceNumber: string | null;
  business: ApiBusiness | null;
  settings: Record<string, any>;
  onCurrencyChange: (value: string) => void;
  onTaxRateChange: (value: string) => void;
  onSettingsClick?: () => void;
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CNY"];

export function SmartDefaultsBar({
  currency,
  taxRate,
  invoiceNumber,
  business,
  settings,
  onCurrencyChange,
  onTaxRateChange,
  onSettingsClick = () => {},
}: SmartDefaultsBarProps) {
  const defaultCurrency = business?.defaultCurrency ?? settings?.default_currency ?? "USD";
  const defaultTax = settings?.default_tax_rate ?? "0";

  const showCurrencyOverride = currency !== defaultCurrency;
  const showTaxOverride = taxRate !== (defaultTax ?? "0");

  return (
    <div className="mb-4 rounded-xl border border-color bg-surface-alt px-4 py-3">
      <div className="flex flex-wrap items-center gap-4 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-tertiary" />
          <span className="text-tertiary">Invoice #</span>
          <span className="font-medium text-primary">
            {invoiceNumber ?? <span className="italic text-tertiary">Auto-assigned on finalize</span>}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Currency className="h-4 w-4 text-tertiary" />
          <span className="text-tertiary">Currency</span>
          <select
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="form-select-sm w-auto min-w-[80px]"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} ({getCurrencyMetadata(c).symbol})
              </option>
            ))}
          </select>
          {showCurrencyOverride && (
            <span className="text-xs text-tertiary">(business default: {defaultCurrency})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-tertiary" />
          <span className="text-tertiary">Tax rate</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={toPercent(taxRate ?? "0")}
            onChange={(e) => onTaxRateChange(fromPercentage(e.target.value.replace(/[^\d.]/g, "")))}
            className="form-control-sm w-24 text-right font-tabular-nums"
            placeholder="0.00"
          />
          <span className="text-xs text-tertiary">%</span>
          {showTaxOverride && (
            <span className="text-xs text-tertiary">(default: {formatTaxRate(defaultTax)})</span>
          )}
        </div>

        {business?.logoUrl && (
          <div className="flex items-center gap-2">
            <img src={business.logoUrl} alt={business.name} className="h-6 w-auto" />
            <span className="text-tertiary">Logo from business settings</span>
          </div>
        )}

         <button
           type="button"
           onClick={onSettingsClick}
           className="ml-auto flex items-center gap-1 text-xs text-tertiary hover:text-primary"
           title="Customize defaults"
         >
           <Edit3 className="h-3 w-3" />
           Customize
         </button>
      </div>
    </div>
  );
}

export default SmartDefaultsBar;
