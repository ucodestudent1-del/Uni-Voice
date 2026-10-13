import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getCreditNote,
  createCreditNoteDraft,
  finalizeCreditNote,
  getInvoices,
  type CreateCreditNoteInput,
} from "@/api/client";
import {
  Button,
  FormField,
  FormTextareaField,
  PageHeader,
  StatusBadge,
  creditNoteStatusConfig,
  CreditNoteTotalsSummary,
  CreditNoteInvoiceLink,
  ApplyCreditNoteDialog,
  CreditNoteActivityTimeline,
} from "@/components/ui";
import SectionCard from "@/components/SectionCard";
import { CalculationEngine, type InvoiceCalculationInput, type LineItemInput, type FeeInput } from "@/utils/calculation";
import type { CurrencyCode } from "@/types/currency";
import { useToast } from "@/components/ui/ToastProvider";
import { Save, Plus, Trash2, FileText, Send } from "lucide-react";
import { Decimal } from "decimal.js";
import type { ApiCreditNote, ApiInvoiceListItem } from "@/types/api";

interface LocalItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  taxName: string;
  isTaxInclusive: boolean;
}

interface LocalFee {
  description: string;
  amount: string;
  taxRate: string;
  taxName: string;
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

const CALC_ENGINE = new CalculationEngine();

type SaveState = "idle" | "saving" | "saved" | "error";

export default function CreditNoteWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action") ?? "";
  const { toast } = useToast();

  const isNew = !id || id === "new";

  const [creditNote, setCreditNote] = useState<ApiCreditNote | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<{
    invoiceId: string;
    reason: string;
    customReason: string;
    notes: string;
    terms: string;
    items: LocalItem[];
    fees: LocalFee[];
  }>({
    invoiceId: "",
    reason: "",
    customReason: "",
    notes: "",
    terms: "",
    items: [initialItem()],
    fees: [],
  });

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [availableInvoices, setAvailableInvoices] = useState<ApiInvoiceListItem[]>([]);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(state));

  const loadCreditNote = useCallback(async () => {
    if (!id || isNew) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCreditNote(id);
      const cn = data.creditNote;
      setCreditNote(cn);
      setState({
        invoiceId: cn.reference_invoice_id ?? "",
        reason: cn.reason ?? "",
        customReason: cn.reason ?? "",
        notes: cn.notes ?? "",
        terms: cn.terms ?? "",
        items: (cn.items ?? []).map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unit_price,
          taxRate: item.tax_rate,
          taxName: item.tax_name ?? "",
          isTaxInclusive: item.is_tax_inclusive,
        })),
        fees: (cn.fees ?? []).map((fee) => ({
          description: fee.description,
          amount: fee.amount,
          taxRate: fee.tax_rate,
          taxName: fee.tax_name ?? "",
        })),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load credit note");
    } finally {
      setIsLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew) {
      loadCreditNote();
    }
  }, [loadCreditNote, isNew]);

  const loadAvailableInvoices = useCallback(async () => {
    if (!creditNote) return;
    try {
      const data = await getInvoices({
        limit: 100,
        customerId: creditNote.customer_id ?? undefined,
      });
      const openInvoices = (data.invoices ?? []).filter(
        (inv) => new Decimal(inv.amount_due ?? 0).gt(0)
      );
      setAvailableInvoices(openInvoices);
    } catch {
      setAvailableInvoices([]);
    }
  }, [creditNote]);

  useEffect(() => {
    if (action === "apply" && creditNote && creditNote.status === "finalized") {
      loadAvailableInvoices();
      setApplyDialogOpen(true);
    }
  }, [action, creditNote, loadAvailableInvoices]);

  const effectiveReason = state.reason === "other" ? state.customReason : state.reason;

  const calcInput: InvoiceCalculationInput = useMemo(() => {
    const currencyCode = "USD" as CurrencyCode;
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
  }, [state.items, state.fees]);

  const calcResult = useMemo(() => {
    try {
      return CALC_ENGINE.calculate(calcInput);
    } catch {
      return null;
    }
  }, [calcInput]);

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

  const saveDraft = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      toast(validationError, { type: "warning", title: "Validation Error" });
      return false;
    }

    setSaveState("saving");
    try {
      const payload = buildPayload();
      let savedCN: ApiCreditNote;

      if (isNew) {
        const res = await createCreditNoteDraft(payload);
        savedCN = res.creditNote;
      } else {
        savedCN = creditNote!;
      }

      setCreditNote(savedCN);
      lastSavedRef.current = JSON.stringify(state);
      setSaveState("saved");
      toast("Draft saved", { type: "success", title: "Saved" });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save draft";
      toast(message, { type: "error", title: "Save Failed" });
      setSaveState("error");
      return false;
    }
  }, [state, creditNote, isNew, buildPayload, validate, toast]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    const currentState = JSON.stringify(state);
    if (currentState !== lastSavedRef.current) {
      setSaveState("saving");
      autosaveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, 1500);
    }
  }, [state, saveDraft]);

  useEffect(() => {
    scheduleAutosave();
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [scheduleAutosave]);

  const handleFinalizeAndSend = useCallback(async () => {
    const saved = await saveDraft();
    if (!saved) return;

    if (!creditNote || !creditNote.id) {
      toast("Cannot finalize: credit note not saved", { type: "error", title: "Error" });
      return;
    }

    setIsFinalizing(true);
    try {
      await finalizeCreditNote(creditNote.id);
      await loadCreditNote();
      toast("Credit note finalized successfully", { type: "success", title: "Finalized" });
      const url = `/app/credit-notes/${creditNote.id}`;
      navigate(url, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to finalize";
      toast(message, { type: "error", title: "Finalize Failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [creditNote, saveDraft, loadCreditNote, toast, navigate]);

  const handleApplySuccess = (result: { ok: boolean; remaining: string; status: string }) => {
    toast(
      result.ok
        ? "Credit note applied successfully"
        : "Failed to apply credit note",
      { type: result.ok ? "success" : "error", title: result.ok ? "Applied" : "Error" }
    );
    loadCreditNote();
  };

  const handleCancel = () => {
    navigate("/app/credit-notes");
  };

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const isDraft = creditNote?.status === "draft";
  const isFinalized = creditNote?.is_finalized === true;
  const remainingCredit = creditNote
    ? new Decimal(creditNote.total ?? 0).minus(new Decimal(creditNote.applied_total ?? 0))
    : new Decimal(0);
  const canApply = creditNote && (isFinalized || creditNote.status === "sent") && remainingCredit.gt(0);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64 text-secondary">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mr-3" />
          Loading credit note...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="p-4 rounded-md bg-error/10 text-error-text">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader
        title={creditNote ? `#${creditNote.credit_note_number ?? ""}` : "New Credit Note"}
        breadcrumbs={[
          { label: "Credit Notes", to: "/app/credit-notes" },
          ...(creditNote ? [{ label: `#${creditNote.credit_note_number ?? ""}` }] : []),
        ]}
        description={creditNote?.status ?? (isNew ? "Create a new credit note" : undefined)}
        primaryAction={
          <div className="flex items-center gap-3">
            {creditNote && (
              <StatusBadge status={creditNote.status} config={creditNoteStatusConfig} />
            )}
            <span className="text-xs text-tertiary">
              {saveState === "saving" && "Saving..."}
              {saveState === "saved" && "Saved"}
              {saveState === "error" && "Save failed"}
            </span>
            <Button
              variant="ghost"
              icon={<FileText className="h-4 w-4" />}
              onClick={handleCancel}
              disabled={saveState === "saving"}
            >
              {creditNote ? "Back to Detail" : "Cancel"}
            </Button>
            {!isDraft && !isFinalized && (
              <Button
                variant="secondary"
                icon={<Save className="h-4 w-4" />}
                onClick={saveDraft}
                disabled={saveState === "saving"}
                loading={saveState === "saving"}
              >
                Save Draft
              </Button>
            )}
            {isDraft && (
              <Button
                variant="primary"
                icon={<Send className="h-4 w-4" />}
                onClick={handleFinalizeAndSend}
                disabled={isFinalizing || saveState === "saving"}
                loading={isFinalizing}
              >
                Finalize & Send
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
          {/* Editor Panel */}
          <div className="overflow-y-auto space-y-6 pr-2">
            {creditNote && (
              <CreditNoteInvoiceLink
                creditNote={creditNote}
                onNavigateToInvoice={(invId) => navigate(`/app/invoices/${invId}`)}
              />
            )}

            {!creditNote && (
              <SectionCard title="Source Invoice">
                <div className="p-5 space-y-3">
                  <FormField
                    label="Invoice to Credit"
                    select
                    value={state.invoiceId}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, invoiceId: e.target.value }))
                    }
                  >
                    <option value="">Select an invoice</option>
                    <InvoiceSelectOption />
                  </FormField>
                  <p className="text-xs text-tertiary">
                    Enter the invoice ID or navigate from an invoice detail page.
                  </p>
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
                <option value="return">Return</option>
                <option value="abatement">Abatement</option>
                <option value="correction">Correction</option>
                <option value="other">Other</option>
              </FormField>

              {state.reason === "other" && (
                <FormField
                  label="Custom Reason"
                  placeholder="Enter reason..."
                  value={state.customReason}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, customReason: e.target.value }))
                  }
                />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary">Line Items</h3>
              </div>
              <div className="space-y-2">
                {state.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-md bg-surface"
                  >
                    <div className="col-span-4">
                      <FormField
                        label="Description"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(idx, "description", e.target.value)
                        }
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary">Fees</h3>
              </div>
              <div className="space-y-2">
                {state.fees.map((fee, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-md"
                  >
                    <div className="col-span-5">
                      <FormField
                        label="Description"
                        value={fee.description}
                        onChange={(e) =>
                          updateFee(idx, "description", e.target.value)
                        }
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

            <div className="space-y-3">
              <FormTextareaField
                label="Notes"
                placeholder="Additional notes for the customer..."
                value={state.notes}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
              <FormTextareaField
                label="Terms"
                placeholder="Payment terms..."
                value={state.terms}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, terms: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Sidebar Panel */}
          <div className="overflow-y-auto space-y-6">
            {calcResult && (
              <SectionCard title="Totals">
                <div className="p-5">
                  <CreditNoteTotalsSummary
                    creditNote={{
                      id: "",
                      business_id: "",
                      status: "draft",
                      currency: calcResult.currency,
                      subtotal: calcResult.subtotal.toFixed(),
                      discount_total: calcResult.discountTotal.toFixed(),
                      tax_total: calcResult.taxTotal.toFixed(),
                      fee_total: calcResult.feeTotal.toFixed(),
                      total: calcResult.total.toFixed(),
                      amount_paid: "0",
                      amount_due: calcResult.total.toFixed(),
                      applied_total: "0",
                      is_finalized: false,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      items: [],
                      fees: [],
                      applications: [],
                    }}
                    showApplied={false}
                  />
                </div>
              </SectionCard>
            )}

            {creditNote && creditNote.applications && creditNote.applications.length > 0 && (
              <SectionCard title="Applications">
                <div className="p-5">
                  <CreditNoteActivityTimeline events={creditNote.events ?? []} />
                </div>
              </SectionCard>
            )}

            {creditNote && canApply && (
              <SectionCard title="Apply Credit">
                <div className="p-5 space-y-3">
                  <p className="text-sm text-tertiary">
                    Remaining credit:{" "}
                    <strong className="text-primary">{remainingCredit.toFixed(2)}</strong>
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => setApplyDialogOpen(true)}
                  >
                    Apply to Invoice
                  </Button>
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      </div>

      {applyDialogOpen && creditNote && (
        <ApplyCreditNoteDialog
          open={applyDialogOpen}
          onClose={() => setApplyDialogOpen(false)}
          creditNote={creditNote}
          onSuccess={handleApplySuccess}
          availableInvoices={availableInvoices}
        />
      )}
    </div>
  );
}

function InvoiceSelectOption() {
  return null;
}
