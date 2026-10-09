import React, { useState, useEffect } from "react";
import { Edit3 } from "lucide-react";
import { DisclosureSection } from "./ui/DisclosureSection";
import { FormField } from "./ui/FormField";
import type { WorkspaceInvoiceData } from "./InvoiceWorkspace";
import { toPercent, fromPercentage, formatTaxRate } from "@/utils/format";
import { getCurrencyMetadata } from "@/types/currency";

export interface AdvancedOptionsPanelProps {
  invoice: WorkspaceInvoiceData;
  onField: (field: keyof WorkspaceInvoiceData, value: unknown) => void;
  defaultTaxRate: string;
}

interface AdvancedState {
  poNumber: string;
  projectName: string;
  customerTaxId: string;
  invoiceDiscount: string;
  invoiceDiscountType: "fixed" | "percentage";
  shippingDescription: string;
  shippingAmount: string;
  shippingTaxRate: string;
  depositType: "none" | "fixed" | "percentage";
  depositValue: string;
  depositDueDate: string;
  depositPaymentPurpose: string;
  lateFeeType: "none" | "fixed" | "percentage";
  lateFeeValue: string;
  lateFeeDueDate: string;
  customNotes: string;
}

export function AdvancedOptionsPanel({
  invoice,
  onField,
  defaultTaxRate,
}: AdvancedOptionsPanelProps) {
  const [state, setState] = useState<AdvancedState>({
    poNumber: invoice.poNumber ?? "",
    projectName: invoice.projectId ?? "",
    customerTaxId: invoice.customer?.taxId ?? invoice.customer?.address?.taxId ?? "",
    invoiceDiscount: invoice.invoiceDiscount ?? "",
    invoiceDiscountType: invoice.invoiceDiscountType ?? "fixed",
    shippingDescription: invoice.shippingDescription ?? "Shipping",
    shippingAmount: invoice.shippingAmount ?? "",
    shippingTaxRate: invoice.shippingTaxRate ?? "0",
    depositType: invoice.depositType ?? "none",
    depositValue: invoice.depositValue ?? "0",
    depositDueDate: invoice.depositDueDate ?? "",
    depositPaymentPurpose: invoice.depositPaymentPurpose ?? "",
    lateFeeType: invoice.lateFeeType ?? "none",
    lateFeeValue: invoice.lateFeeValue ?? "0",
    lateFeeDueDate: invoice.lateFeeDueDate ?? "",
    customNotes: invoice.notes ?? "",
  });

  const handleField = (field: keyof AdvancedState, value: string) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const fieldMap: [keyof AdvancedState, keyof WorkspaceInvoiceData][] = [
    ["poNumber", "poNumber"],
    ["projectName", "projectId"],
    ["invoiceDiscount", "invoiceDiscount"],
    ["invoiceDiscountType", "invoiceDiscountType"],
    ["shippingDescription", "shippingDescription"],
    ["shippingAmount", "shippingAmount"],
    ["shippingTaxRate", "shippingTaxRate"],
    ["depositType", "depositType"],
    ["depositValue", "depositValue"],
    ["depositDueDate", "depositDueDate"],
    ["depositPaymentPurpose", "depositPaymentPurpose"],
    ["lateFeeType", "lateFeeType"],
    ["lateFeeValue", "lateFeeValue"],
    ["lateFeeDueDate", "lateFeeDueDate"],
    ["customNotes", "notes"],
  ];

  const [isInitialMount, setIsInitialMount] = useState(true);

  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    for (const [stateField, invoiceField] of fieldMap) {
      const val = state[stateField];
      onField(invoiceField, (val as string) || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const currencyMeta = getCurrencyMetadata(invoice.currency);
  const activeAdvancedCount = countActiveFields(state, invoice);

  return (
    <div className="mb-6">
      <DisclosureSection
        title="Advanced options"
        icon={<Edit3 className="h-4 w-4" />}
        defaultOpen={false}
        summary={activeAdvancedCount > 0 ? `${activeAdvancedCount} fields set` : "Add PO, discounts, deposits, and more"}
        className="border border-color-subtle bg-surface shadow-sm"
      >
        <div className="space-y-5">
          {/* Invoice Details */}
          <DisclosureSection
            title="Invoice details"
            defaultOpen={false}
            className="border border-color-subtle bg-surface-alt"
            contentClassName="pb-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label="PO Number"
                value={state.poNumber}
                onChange={(e) => handleField("poNumber", e.target.value)}
                placeholder="e.g. PO-12345"
              />
              <FormField
                label="Project name"
                value={state.projectName}
                onChange={(e) => handleField("projectName", e.target.value)}
                placeholder="e.g. Website Redesign"
              />
              <FormField
                label="Customer Tax ID"
                value={state.customerTaxId}
                onChange={(e) => handleField("customerTaxId", e.target.value)}
                placeholder={invoice.customer ? "From customer record" : "Enter tax ID"}
                helperText={invoice.customer && state.customerTaxId ? "From customer record (read-only)" : undefined}
                disabled={!!invoice.customer && !!state.customerTaxId}
              />
            </div>
          </DisclosureSection>

          {/* Pricing */}
          <DisclosureSection
            title="Pricing"
            defaultOpen={false}
            className="border border-color-subtle bg-surface-alt"
            contentClassName="pb-3"
          >
            <div className="space-y-3">
              <div>
                <label className="form-label-secondary">Invoice discount</label>
                <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-xs">
                      {state.invoiceDiscountType === "percentage" ? "%" : currencyMeta.symbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step={state.invoiceDiscountType === "percentage" ? "0.01" : "0.01"}
                      value={
                        state.invoiceDiscountType === "percentage"
                          ? toPercent(state.invoiceDiscount)
                          : state.invoiceDiscount
                      }
                      onChange={(e) =>
                        handleField(
                          "invoiceDiscount",
                          state.invoiceDiscountType === "percentage"
                            ? fromPercentage(e.target.value.replace(/[^\d.]/g, ""))
                            : e.target.value
                        )
                      }
                      className="input-with-prefix w-full font-tabular-nums"
                      placeholder="0.00"
                    />
                  </div>
                  <select
                    value={state.invoiceDiscountType}
                    onChange={(e) => {
                      const newType = e.target.value as "fixed" | "percentage";
                      handleField("invoiceDiscountType", newType);
                      const current = state.invoiceDiscount;
                      if (newType === "percentage" && current) {
                        handleField("invoiceDiscount", fromPercentage(toPercent(current)));
                      }
                    }}
                    className="form-select-sm min-w-[100px]"
                    title="Discount type"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
                {state.invoiceDiscount && Number(state.invoiceDiscount) > 0 && (
                  <p className="mt-1 text-xs text-tertiary">
                    Applies to all line items before tax
                  </p>
                )}
              </div>
            </div>
          </DisclosureSection>

          {/* Shipping */}
          <DisclosureSection
            title="Shipping"
            defaultOpen={false}
            className="border border-color-subtle bg-surface-alt"
            contentClassName="pb-3"
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_auto]">
                <FormField
                  label="Description"
                  value={state.shippingDescription}
                  onChange={(e) => handleField("shippingDescription", e.target.value)}
                  placeholder="e.g. Express shipping, Delivery fee"
                />
                <FormField
                  label="Amount"
                  value={state.shippingAmount}
                  onChange={(e) => handleField("shippingAmount", e.target.value || "0")}
                  placeholder="0.00"
                />
                <FormField
                  label="Tax %"
                  value={toPercent(state.shippingTaxRate)}
                  onChange={(e) =>
                    handleField("shippingTaxRate", fromPercentage(e.target.value.replace(/[^\d.]/g, "")))
                  }
                  helperText={formatTaxRate(defaultTaxRate) !== "-" ? `Default: ${formatTaxRate(defaultTaxRate)}` : undefined}
                />
              </div>
              {state.shippingAmount && Number(state.shippingAmount) > 0 && (
                <p className="text-xs text-tertiary">
                  Will appear as a line item in the invoice totals
                </p>
              )}
            </div>
          </DisclosureSection>

          {/* Deposits */}
          <DisclosureSection
            title="Deposits & partial payments"
            defaultOpen={false}
            className="border border-color-subtle bg-surface-alt"
            contentClassName="pb-3"
          >
            <div className="space-y-3">
              <FormField
                label="Deposit type"
                select
                value={state.depositType}
                onChange={(e) => handleField("depositType", e.target.value as AdvancedState["depositType"])}
              >
                <option value="none">None</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage</option>
              </FormField>

              {state.depositType !== "none" && (
                <>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-xs">
                      {state.depositType === "percentage" ? "%" : currencyMeta.symbol}
                    </span>
                    <FormField
                      label="Deposit amount"
                      value={
                        state.depositType === "percentage"
                          ? toPercent(state.depositValue)
                          : state.depositValue
                      }
                      onChange={(e) =>
                        handleField(
                          "depositValue",
                          state.depositType === "percentage"
                            ? fromPercentage(e.target.value.replace(/[^\d.]/g, ""))
                            : e.target.value
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <FormField
                    label="Deposit due date"
                    type="date"
                    value={state.depositDueDate}
                    onChange={(e) => handleField("depositDueDate", e.target.value || "")}
                  />

                  <FormField
                    label="Payment purpose"
                    value={state.depositPaymentPurpose}
                    onChange={(e) => handleField("depositPaymentPurpose", e.target.value)}
                    placeholder="e.g. Booking deposit, 50% upfront"
                  />
                </>
              )}
            </div>
          </DisclosureSection>

          {/* Late Fees */}
          <DisclosureSection
            title="Late payment terms"
            defaultOpen={false}
            className="border border-color-subtle bg-surface-alt"
            contentClassName="pb-3"
          >
            <div className="space-y-3">
              <FormField
                label="Late fee type"
                select
                value={state.lateFeeType}
                onChange={(e) => handleField("lateFeeType", e.target.value as AdvancedState["lateFeeType"])}
              >
                <option value="none">No late fee</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage</option>
              </FormField>

              {state.lateFeeType !== "none" && (
                <>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-xs">
                      {state.lateFeeType === "percentage" ? "%" : currencyMeta.symbol}
                    </span>
                    <FormField
                      label="Late fee value"
                      value={
                        state.lateFeeType === "percentage"
                          ? toPercent(state.lateFeeValue)
                          : state.lateFeeValue
                      }
                      onChange={(e) =>
                        handleField(
                          "lateFeeValue",
                          state.lateFeeType === "percentage"
                            ? fromPercentage(e.target.value.replace(/[^\d.]/g, ""))
                            : e.target.value
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <FormField
                    label="Late fee due date"
                    type="date"
                    value={state.lateFeeDueDate}
                    onChange={(e) => handleField("lateFeeDueDate", e.target.value || "")}
                  />
                </>
              )}
            </div>
          </DisclosureSection>
        </div>
      </DisclosureSection>
    </div>
  );
}

function countActiveFields(state: AdvancedState, invoice: WorkspaceInvoiceData): number {
  let count = 0;
  if (state.poNumber) count++;
  if (state.projectName) count++;
  if (state.invoiceDiscount && Number(state.invoiceDiscount) > 0) count++;
  if (state.shippingAmount && Number(state.shippingAmount) > 0) count++;
  if (state.depositType !== "none" && state.depositValue && Number(state.depositValue) > 0) count++;
  if (state.lateFeeType !== "none" && state.lateFeeValue && Number(state.lateFeeValue) > 0) count++;
  if (invoice.paymentInstructions && invoice.paymentInstructions.length > 0) count++;
  if (invoice.bankDetails) count++;
  return count;
}

AdvancedOptionsPanel.displayName = "AdvancedOptionsPanel";

export default AdvancedOptionsPanel;
