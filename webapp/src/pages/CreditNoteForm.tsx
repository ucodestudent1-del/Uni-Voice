import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createCreditNote, getInvoice, type CreateCreditNoteInput } from "@/api/client";
import { CalculationEngine, type InvoiceCalculationInput, type LineItemInput, type FeeInput } from "@/utils/calculation";
import { type CurrencyCode } from "@/types/currency";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Button,
  FormField,
  FormTextareaField,
  PageHeader,
  Money,
} from "@/components/ui";
import SectionCard from "@/components/SectionCard";
import { Save, Plus, Trash2, FileText } from "lucide-react";
import { formatDate } from "@/utils/format";
import { Decimal } from "decimal.js";
import type { ApiInvoice } from "@/types/api";

interface LocalItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  taxName: string;
  isTaxInclusive: boolean;
}

function initialItem(): LocalItem {
  return {
    description: "",
    quantity: "1",
    unit: "each",
    unitPrice: "0.00",
    taxRate: "0",
    taxName: "",
    isTaxInclusive: false,
  };
}

const REASON_OPTIONS = [
  { value: "", label: "Select a reason" },
  { value: "return", label: "Return" },
  { value: "abatement", label: "Abatement" },
  { value: "correction", label: "Correction" },
  { value: "other", label: "Other" },
];

interface LocalFee {
  description: string;
  amount: string;
  taxRate: string;
  taxName: string;
}

const CALC_ENGINE = new CalculationEngine();

export default function CreditNoteForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const { toast } = useToast();

  const [sourceInvoice, setSourceInvoice] = useState<ApiInvoice | null>(null);
  const [isLoadingSource, setIsLoadingSource] = useState(!!invoiceId);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const [state, setState] = useState({
    invoiceId: invoiceId ?? "",
    reason: "",
    customReason: "",
    notes: "",
    terms: "",
    items: [initialItem()],
    fees: [] as LocalFee[],
  });

  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      setIsLoadingSource(true);
      setSourceError(null);
      getInvoice(invoiceId)
        .then((res) => {
          const inv = res.invoice;
          setSourceInvoice(inv);
          setState((prev) => ({
            ...prev,
            invoiceId: inv.id,
            terms: prev.terms || inv.terms || "",
          }));
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to load invoice";
          setSourceError(message);
        })
        .finally(() => setIsLoadingSource(false));
    }
  }, [invoiceId]);

  const calcInput: InvoiceCalculationInput = useMemo(() => {
    const currencyCode = (sourceInvoice?.currency ?? "USD") as CurrencyCode;
    const lineItems: LineItemInput[] = state.items
      .filter((item) => item.description.trim())
      .map((item, idx) => ({
        description: item.description,
        quantity: new Decimal(item.quantity || "1"),
        unit: item.unit || "each",
        unitPrice: new Decimal(item.unitPrice || "0"),
        taxRate: new Decimal(item.taxRate || "0"),
        tax_name: item.taxName || null,
        isTaxInclusive: item.isTaxInclusive,
        sortOrder: idx,
      }));

    const fees: FeeInput[] = state.fees
      .filter((f) => f.description.trim())
      .map((fee, idx) => ({
        description: fee.description,
        amount: new Decimal(fee.amount || "0"),
        taxRate: new Decimal(fee.taxRate || "0"),
        tax_name: fee.taxName || null,
        sortOrder: idx,
      }));

    return {
      currency: currencyCode,
      lineItems,
      fees,
    };
  }, [state.items, state.fees, sourceInvoice?.currency]);

  const calcResult = useMemo(() => {
    try {
      return CALC_ENGINE.calculate(calcInput);
    } catch {
      return null;
    }
  }, [calcInput]);

  const effectiveReason = state.reason === "other" ? state.customReason : state.reason;

  const buildPayload = (): CreateCreditNoteInput => ({
    invoiceId: state.invoiceId,
    reason: effectiveReason || undefined,
    notes: state.notes || undefined,
    terms: state.terms || undefined,
    items: state.items
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxName: item.taxName || undefined,
        isTaxInclusive: item.isTaxInclusive,
      })),
  });

  const validate = (): string | null => {
    if (!state.invoiceId) return "Please select an invoice to credit.";
    if (!state.items || state.items.length === 0) return "Add at least one line item.";
    const hasValidItem = state.items.some((item) => item.description.trim());
    if (!hasValidItem) return "Add at least one line item with a description.";
    if (!effectiveReason) return "Please select a reason for this credit note.";
    return null;
  };

  const handleCreate = async () => {
    const validationError = validate();
    if (validationError) {
      toast(validationError, { type: "warning", title: "Validation Error" });
      return;
    }
    setIsCreating(true);
    try {
      const payload = buildPayload();
      const res = await createCreditNote(payload);
      toast(
        `Credit note #${res.creditNote.credit_note_number ?? ""} created.`,
        { type: "success", title: "Credit Note Created" }
      );
      navigate(`/app/credit-notes/${res.creditNote.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Create failed";
      toast(message, { type: "error", title: "Create Failed" });
    } finally {
      setIsCreating(false);
    }
  };

  const updateItem = (idx: number, field: keyof LocalItem, value: unknown) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  };

  const addItem = () => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, initialItem()],
    }));
  };

  const removeItem = (idx: number) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const addFee = () => {
    setState((prev) => ({
      ...prev,
      fees: [...prev.fees, { description: "", amount: "0.00", taxRate: "0", taxName: "" }],
    }));
  };

  const removeFee = (idx: number) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.filter((_, i) => i !== idx),
    }));
  };

  const updateFee = (idx: number, field: keyof LocalFee, value: string) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.map((fee, i) => (i === idx ? { ...fee, [field]: value } : fee)),
    }));
  };

  if (isLoadingSource) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64 text-secondary">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mr-3" />
          Loading invoice...
        </div>
      </div>
    );
  }

  if (sourceError) {
    return (
      <div className="page-container">
        <PageHeader
          title="New Credit Note"
          primaryAction={
            <Button variant="ghost" icon={<FileText className="h-4 w-4" />} onClick={() => navigate("/app/credit-notes")}>
              Back to Credit Notes
            </Button>
          }
        />
        <div className="p-4 rounded-md bg-error/10 text-error-text">
          {sourceError}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader
        title="New Credit Note"
        description={!invoiceId ? "Select an invoice to create a credit note." : undefined}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button variant="ghost" icon={<FileText className="h-4 w-4" />} onClick={() => navigate("/app/credit-notes")}>
              Back
            </Button>
            <Button
              variant="primary"
              icon={<Save className="h-4 w-4" />}
              onClick={handleCreate}
              disabled={isCreating}
              loading={isCreating}
            >
              Finalize
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
          {/* Editor Panel */}
          <div className="overflow-y-auto space-y-6 pr-2">
            {!invoiceId && (
              <SectionCard title="Source Invoice">
                <div className="p-5 space-y-3">
                  <FormField
                    label="Invoice to Credit"
                    select
                    value={state.invoiceId}
                    onChange={(e) => setState((prev) => ({ ...prev, invoiceId: e.target.value }))}
                  >
                    <option value="">Select an invoice</option>
                    <option value={invoiceId ?? ""}>{invoiceId}</option>
                  </FormField>
                  <p className="text-xs text-tertiary">
                    Navigate from an invoice detail page, or enter an invoice ID above.
                  </p>
                </div>
              </SectionCard>
            )}

            {sourceInvoice && (
              <SectionCard title="Source Invoice">
                <div className="p-5">
                  <div className="text-sm">
                    <div className="font-medium text-primary">
                      {sourceInvoice.invoice_number ?? "—"}
                    </div>
                    <div className="text-tertiary mt-1">
                      Customer: {sourceInvoice.customer_name ?? "—"}
                    </div>
                    <div className="text-tertiary">
                      Total: <Money amount={sourceInvoice.total} currency={sourceInvoice.currency} />
                    </div>
                    <div className="text-tertiary">
                      Outstanding: <Money amount={sourceInvoice.amount_due} currency={sourceInvoice.currency} />
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}

            <div className="space-y-4">
              <FormField
                label="Reason"
                select
                value={state.reason === "other" ? state.reason : state.reason}
                onChange={(e) => {
                  const val = e.target.value;
                  setState((prev) => ({
                    ...prev,
                    reason: val,
                    customReason: val === "other" ? prev.customReason : "",
                  }));
                }}
              >
                <option value="">Select a reason</option>
                {REASON_OPTIONS.slice(1).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </FormField>

              {state.reason === "other" && (
                <FormField
                  label="Custom Reason"
                  placeholder="Enter reason..."
                  value={state.customReason}
                  onChange={(e) => setState((prev) => ({ ...prev, customReason: e.target.value }))}
                />
              )}
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary">Line Items</h3>
              </div>
              <div className="space-y-2">
                {state.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-md bg-surface">
                    <div className="col-span-4">
                      <FormField
                        label="Description"
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        helperText={item.description ? "" : "Required"}
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Unit"
                        value={item.unit}
                        onChange={(e) => updateItem(idx, "unit", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        label="Unit Price"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Tax %"
                        value={item.taxRate}
                        onChange={(e) => updateItem(idx, "taxRate", e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1.5 text-error hover:bg-error/10 rounded"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary font-medium"
                >
                  <Plus className="h-4 w-4" /> Add Line Item
                </button>
              </div>
            </div>

            {/* Fees */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary">Fees</h3>
              </div>
              <div className="space-y-2">
                {state.fees.map((fee, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-md">
                    <div className="col-span-5">
                      <FormField
                        label="Description"
                        value={fee.description}
                        onChange={(e) => updateFee(idx, "description", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        label="Amount"
                        value={fee.amount}
                        onChange={(e) => updateFee(idx, "amount", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        label="Tax %"
                        value={fee.taxRate}
                        onChange={(e) => updateFee(idx, "taxRate", e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => removeFee(idx)}
                        className="p-1.5 text-error hover:bg-error/10 rounded"
                        title="Remove fee"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFee}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary font-medium"
                >
                  <Plus className="h-4 w-4" /> Add Fee
                </button>
              </div>
            </div>

            {/* Notes & Terms */}
            <div className="space-y-3">
              <FormTextareaField
                label="Notes"
                placeholder="Additional notes for the customer..."
                value={state.notes}
                onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <FormTextareaField
                label="Terms"
                placeholder="Payment terms..."
                value={state.terms}
                onChange={(e) => setState((prev) => ({ ...prev, terms: e.target.value }))}
              />
            </div>
          </div>

          {/* Preview Panel */}
          <div className="overflow-y-auto">
            <div className="sticky top-0">
              <div className="border border-border rounded-lg p-6 bg-surface shadow">
                <h3 className="text-sm font-medium text-tertiary mb-4 uppercase tracking-wider">
                  Live Preview
                </h3>

                {calcResult ? (
                  <div className="text-sm">
                    {/* Header */}
                    <div className="mb-4">
                      <div className="text-2xl font-bold text-primary flex items-center gap-2">
                        <FileText className="h-6 w-6" />
                        Credit Note (credit)
                      </div>
                      <div className="text-tertiary mt-1">
                        Issue date: {formatDate(new Date().toISOString())}
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="mb-4">
                      <div className="font-medium text-primary">
                        {sourceInvoice?.customer_name ?? "—"}
                      </div>
                      {sourceInvoice?.customer_email && (
                        <div className="text-tertiary">{sourceInvoice.customer_email}</div>
                      )}
                    </div>

                    {/* Line Items Table */}
                    <div className="mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1 text-tertiary font-medium">Description</th>
                            <th className="text-right py-1 text-tertiary font-medium">Qty</th>
                            <th className="text-right py-1 text-tertiary font-medium">Price</th>
                            <th className="text-right py-1 text-tertiary font-medium">Tax</th>
                            <th className="text-right py-1 text-tertiary font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calcResult.lineItems.map((li, idx) => (
                            <tr key={idx} className="border-b border-border/50">
                              <td className="py-1">{li.description}</td>
                              <td className="text-right py-1">{li.quantity.toFixed()}</td>
                              <td className="text-right py-1">{li.unitPrice.toFixed(2)}</td>
                              <td className="text-right py-1">{(li.taxRate.mul(100)).toFixed(2)}%</td>
                              <td className="text-right py-1 font-medium">
                                <Money amount={li.lineTotal} currency={calcResult.currency} signed />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="border-t border-border pt-2 space-y-1">
                      <div className="flex justify-between text-tertiary">
                        <span>Subtotal</span>
                        <Money amount={calcResult.subtotal} currency={calcResult.currency} />
                      </div>
                      {Number(calcResult.discountTotal.toFixed()) !== 0 && (
                        <div className="flex justify-between text-tertiary">
                          <span>Discount</span>
                          <Money amount={calcResult.discountTotal.negated()} currency={calcResult.currency} />
                        </div>
                      )}
                      <div className="flex justify-between text-tertiary">
                        <span>Tax</span>
                        <Money amount={calcResult.taxTotal} currency={calcResult.currency} />
                      </div>
                      {calcResult.fees.length > 0 && Number(calcResult.feeTotal.toFixed()) !== 0 && (
                        <div className="flex justify-between text-tertiary">
                          <span>Fees</span>
                          <Money amount={calcResult.feeTotal} currency={calcResult.currency} />
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t border-border">
                        <span>Total</span>
                        <Money amount={calcResult.total} currency={calcResult.currency} signed />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-tertiary">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Add line items to see a preview</p>
                  </div>
                )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
