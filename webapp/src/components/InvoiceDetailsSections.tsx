import React from "react";
import { Decimal } from "decimal.js";
import { Hash, Receipt, Truck } from "lucide-react";
import { DisclosureSection } from "./ui/DisclosureSection";
import { FormField } from "./ui/FormField";
import type { WorkspaceInvoiceData } from "./InvoiceWorkspace";

interface InvoiceDetailsSectionsProps {
  data: WorkspaceInvoiceData;
  onField: (field: keyof WorkspaceInvoiceData, value: any) => void;
}

const EXPENSE_CATEGORIES = [
  "Professional Services",
  "Software & Tools",
  "Travel",
  "Office Supplies",
  "Marketing",
  "Training",
  "Legal",
  "Consulting",
  "Other",
];

function toPercent(rate: string | undefined | null): string {
  const v = new Decimal(rate ?? 0).mul(100);
  return v.isZero() ? "" : v.toFixed(2);
}

function fromPercentage(pct: string): string {
  if (pct === "") return "0";
  return new Decimal(pct).div(100).toFixed(6);
}

export function InvoiceDetailsSections({ data, onField }: InvoiceDetailsSectionsProps) {
  const hasDiscount = data.invoiceDiscount && Number(data.invoiceDiscount) > 0;
  const hasShipping = data.shippingAmount && Number(data.shippingAmount) > 0;
  const hasPO = data.poNumber;
  const hasProject = data.projectId;
  const hasCategory = data.invoiceCategory;
  const hasSource = data.sourceUrl;

  const detailsSummary = [hasPO ? "PO set" : null, hasProject ? "Project set" : null, hasCategory ? "Category set" : null, hasSource ? "Link set" : null]
    .filter(Boolean)
    .join(", ");

  const paymentSummary = [
    data.depositType && data.depositType !== "none" ? "Deposit set" : null,
    hasShipping ? "Shipping set" : null,
    hasDiscount ? "Discount set" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-3">
      <DisclosureSection
        title="More invoice details"
        icon={<Hash className="h-4 w-4" />}
        defaultOpen={false}
        summary={detailsSummary || undefined}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <FormField
              label="P.O. #"
              labelClassName="uppercase"
              placeholder="Reference #"
              value={data.poNumber ?? ""}
              onChange={(e) => onField("poNumber", e.target.value || null)}
            />

            <FormField
              label="Project ID"
              labelClassName="uppercase"
              placeholder="Project reference"
              value={data.projectId ?? ""}
              onChange={(e) => onField("projectId", e.target.value || null)}
            />

            <FormField
              label="Invoice category"
              labelClassName="uppercase"
              value={data.invoiceCategory ?? ""}
              select
              onChange={(e) => onField("invoiceCategory", e.target.value || null)}
            >
              <option value="">Select category</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </FormField>
          </div>

          <div className="space-y-3">
            <FormField
              label="Source / Link"
              labelClassName="uppercase"
              placeholder="https://..."
              value={data.sourceUrl ?? ""}
              onChange={(e) => onField("sourceUrl", e.target.value || null)}
            />

            <FormField
              label="Invoice discount"
              labelClassName="uppercase"
              placeholder="0.00"
              value={hasDiscount ? data.invoiceDiscount ?? "" : ""}
              onChange={(e) => onField("invoiceDiscount", e.target.value || null)}
              helperText="Reduces the total before tax"
            />

            {hasDiscount && (
              <FormField
                label="Discount type"
                labelClassName="uppercase"
                value={data.invoiceDiscountType ?? "fixed"}
                select
                onChange={(e) => onField("invoiceDiscountType", e.target.value as "fixed" | "percentage")}
              >
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage</option>
              </FormField>
            )}
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection
        title="Tax & compliance"
        icon={<Receipt className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <FormField
              label="Tax/VAT ID (customer)"
              labelClassName="uppercase"
              placeholder="e.g. VAT123456789"
              value=""
              onChange={() => {}}
              helperText="Read from customer profile — override per line item below"
            />

            <FormField
              label="Default tax rate"
              labelClassName="uppercase"
              placeholder="e.g. 8.5"
              value={toPercent(data.taxRate ?? "0")}
              onChange={(e) => onField("taxRate", fromPercentage(e.target.value.replace(/[^\d.]/g, "")))}
            />
          </div>

          <div className="space-y-3">
            <FormField
              label="Invoice terms"
              labelClassName="uppercase"
              value={data.invoiceTerms ?? "Net 30"}
              onChange={(e) => onField("invoiceTerms", e.target.value)}
              helperText="e.g. Net 30, Due on receipt, 2/10 Net 30"
            />

            <FormField
              label="Invoice number"
              labelClassName="uppercase"
              placeholder="Auto-assigned on finalize"
              value={data.invoiceNumber ?? ""}
              onChange={(e) => onField("invoiceNumber", e.target.value || null)}
              disabled={data.isFinalized}
            />
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection
        title="Payment configuration"
        icon={<Truck className="h-4 w-4" />}
        defaultOpen={false}
        summary={paymentSummary || undefined}
      >
        <div className="space-y-4">
          {hasShipping && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-tertiary uppercase">Shipping</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField label="Description" labelClassName="uppercase" placeholder="e.g. Express shipping">
                  <input
                    type="text"
                    value={data.shippingDescription ?? ""}
                    onChange={(e) => onField("shippingDescription", e.target.value || null)}
                    className="form-control"
                  />
                </FormField>
                <FormField label="Amount" labelClassName="uppercase" placeholder="0.00">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.shippingAmount ?? "0"}
                    onChange={(e) => onField("shippingAmount", e.target.value || null)}
                    className="form-control-sm w-full text-right font-tabular-nums"
                  />
                </FormField>
                <FormField label="Tax %" labelClassName="uppercase" placeholder="e.g. 8.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={toPercent(data.shippingTaxRate ?? "0")}
                    onChange={(e) => onField("shippingTaxRate", fromPercentage(e.target.value.replace(/[^\d.]/g, "")))}
                    className="form-control-sm w-full text-right font-tabular-nums"
                  />
                </FormField>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-tertiary uppercase">Deposit</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                value={data.depositType ?? "none"}
                onChange={(e) => {
                  onField("depositType", e.target.value);
                  onField("depositValue", e.target.value === "none" ? "0" : data.depositValue ?? "0");
                }}
                className="form-select"
              >
                <option value="none">No deposit</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage</option>
              </select>
              {data.depositType !== "none" && (
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.depositValue ?? "0"}
                    onChange={(e) => onField("depositValue", e.target.value || "0")}
                    placeholder="0.00"
                    className="input-with-suffix w-full"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-tertiary">
                    {data.depositType === "percentage" ? "%" : data.currency}
                  </span>
                </div>
              )}
              <input
                type="date"
                value={data.depositDueDate?.split("T")[0] ?? ""}
                onChange={(e) => onField("depositDueDate", e.target.value || null)}
                className="form-control"
              />
            </div>
            {data.depositType !== "none" && (
              <input
                type="text"
                value={data.depositPaymentPurpose ?? ""}
                onChange={(e) => onField("depositPaymentPurpose", e.target.value || null)}
                placeholder="Payment purpose (e.g. 'Booking deposit')"
                className="form-control"
              />
            )}
          </div>

          <div className="border-t border-color pt-3 space-y-2">
            <p className="text-xs font-semibold text-tertiary uppercase">Late fee</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={data.lateFeeType ?? "none"}
                onChange={(e) => {
                  onField("lateFeeType", e.target.value);
                  onField("lateFeeValue", e.target.value === "none" ? "0" : data.lateFeeValue ?? "0");
                }}
                className="form-select"
              >
                <option value="none">No late fee</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage of total</option>
              </select>
              {data.lateFeeType !== "none" && (
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.lateFeeValue ?? "0"}
                    onChange={(e) => onField("lateFeeValue", e.target.value || "0")}
                    placeholder="0.00"
                    className="input-with-suffix w-full"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-tertiary">
                    {data.lateFeeType === "percentage" ? "%" : data.currency}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-tertiary">
              Applied automatically when the invoice becomes overdue and online payments are available.
            </p>
          </div>

          <div className="border-t border-color pt-3 space-y-2">
            <p className="text-xs font-semibold text-tertiary uppercase">Template & routing</p>
            <FormField
              label="Template"
              labelClassName="uppercase"
              value={data.templateId ?? ""}
              select
              onChange={(e) => onField("templateId", e.target.value || null)}
            >
              <option value="">Use default template</option>
              <option value="standard">Standard (default)</option>
              <option value="minimal">Minimal</option>
              <option value="detailed">Detailed</option>
            </FormField>
          </div>
        </div>
      </DisclosureSection>
    </div>
  );
}

export default InvoiceDetailsSections;
