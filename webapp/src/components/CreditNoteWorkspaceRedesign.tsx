import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Download, FileText, Plus, RefreshCw, Save, Send, Trash2 } from "lucide-react";
import { Decimal } from "decimal.js";
import {
  calculationEngine,
  type FeeInput,
  type LineItemInput,
} from "@/utils/calculation";
import {
  formatCurrency,
  fromPercentage,
  toPercent,
} from "@/utils/format";
import { getCurrencyMetadata } from "@/types/currency";
import {
  createCreditNote,
  updateCreditNote,
  finalizeCreditNote,
  sendCreditNote,
  getCreditNote,
  getCreditNotePdf,
  getCustomers,
  getInvoices,
  type CreateCreditNoteInput,
  type UpdateCreditNoteInput,
} from "@/api/client";
import type { ApiCustomer, ApiCreditNote, ApiInvoice, ApiCreditNoteItem, ApiCreditNoteFee } from "@/types/api";
import { Button } from "./ui/Button";
import { FormField } from "./ui/FormField";
import { DisclosureSection } from "./ui/DisclosureSection";
import EmptyState from "@/components/ui/EmptyState";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export type CreditNoteLineItemDraft = {
  id?: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount?: string;
  discountType?: "fixed" | "percentage";
  taxRate?: string;
  taxName?: string | null;
  isTaxInclusive?: boolean;
  productId?: string | null;
};

export type CreditNoteFeeDraft = {
  description: string;
  amount: string;
  taxRate?: string;
  taxName?: string | null;
};

export type CreditNoteReason =
  | "returned_goods"
  | "service_not_delivered"
  | "partial_refund"
  | "overcharge_correction"
  | "pricing_adjustment"
  | "cancelled_service"
  | "damaged_goods"
  | "other";

export const CREDIT_NOTE_REASONS: Array<{ value: CreditNoteReason | ""; label: string; description: string }> = [
  { value: "returned_goods", label: "Returned Goods", description: "Goods returned by the customer" },
  { value: "service_not_delivered", label: "Service Not Delivered", description: "Service was not provided as agreed" },
  { value: "partial_refund", label: "Partial Refund", description: "Partial refund for a dispute or adjustment" },
  { value: "overcharge_correction", label: "Overcharge Correction", description: "Corrected billing error" },
  { value: "pricing_adjustment", label: "Pricing Adjustment", description: "Price change or correction" },
  { value: "cancelled_service", label: "Cancelled Service or Order", description: "Service or order was cancelled" },
  { value: "damaged_goods", label: "Damaged or Defective Goods", description: "Damaged or defective items" },
  { value: "", label: "Other", description: "Custom reason" },
];

export interface CreditNoteDraft {
  customerId?: string | null;
  customer?: ApiCustomer | null;
  referenceInvoiceId?: string | null;
  referenceInvoice?: ApiInvoice | null;
  currency: string;
  issueDate: string;
  reason?: string | null;
  reasonCustom?: string | null;
  items: CreditNoteLineItemDraft[];
  fees: CreditNoteFeeDraft[];
  notes?: string | null;
  terms?: string | null;
  internalNotes?: string | null;
  taxRate?: string | null;
}

const QUICK_ADJUST_PRESETS = [10, 25, 50, 75, 100];

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function parseDecimal(value: string | number | undefined | null): Decimal {
  return new Decimal(value ?? 0);
}

export default function CreditNoteWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<ApiCustomer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSearchResults, setInvoiceSearchResults] = useState<ApiInvoice[]>([]);
  const [invoiceSearchLoading, setInvoiceSearchLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<CreditNoteDraft>({
    customerId: null,
    customer: null,
    referenceInvoiceId: null,
    referenceInvoice: null,
    currency: "USD",
    issueDate: todayISO(),
    reason: null,
    reasonCustom: null,
    items: [],
    fees: [],
    notes: "",
    terms: "",
    internalNotes: "",
    taxRate: "0",
  });

  const [savedCreditNote, setSavedCreditNote] = useState<ApiCreditNote | null>(null);
  const [loading, setLoading] = useState(false);

  const [businessDefaultCurrency, setBusinessDefaultCurrency] = useState<string>("USD");

  useEffect(() => {
    loadBusinessDefaults();
    loadCustomersInitial();
  }, []);

  useEffect(() => {
    if (isEditMode && id) {
      loadCreditNote(id);
    }
  }, [id, isEditMode]);

  const debouncedCustomerSearch = useDebouncedCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setCustomerResults([]);
      return;
    }
    setCustomerSearchLoading(true);
    try {
      const res = await getCustomers({ search: term, limit: 50, includeArchived: false });
      setCustomerResults(res.customers ?? res.data ?? []);
    } catch {
      setCustomerResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  }, 300);

  const debouncedInvoiceSearch = useDebouncedCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setInvoiceSearchResults([]);
      return;
    }
    setInvoiceSearchLoading(true);
    try {
      const res = await getInvoices({ search: term, limit: 20 });
      setInvoiceSearchResults(res.invoices ?? []);
    } catch {
      setInvoiceSearchResults([]);
    } finally {
      setInvoiceSearchLoading(false);
    }
  }, 300);

  async function loadBusinessDefaults() {
    try {
      const [bizRes, settingsRes] = await Promise.allSettled([
        import("@/api/client").then((m) => m.getBusiness()),
        import("@/api/client").then((m) => m.getBusinessSettings()),
      ]);
      if (bizRes.status === "fulfilled" && bizRes.value?.business) {
        setBusinessDefaultCurrency(bizRes.value.business.defaultCurrency ?? "USD");
      }
      if (settingsRes.status === "fulfilled" && settingsRes.value?.settings) {
        const s = settingsRes.value.settings;
        if (s.default_currency) setBusinessDefaultCurrency(s.default_currency);
      }
    } catch {
      // Use defaults silently
    }
  }

  async function loadCustomersInitial() {
    try {
      const res = await getCustomers({ limit: 100 });
      const initialCustomers = res.customers ?? res.data ?? [];
      setCustomerResults(initialCustomers);
    } catch {
      setCustomerResults([]);
    }
  }

  async function loadCreditNote(cnId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await getCreditNote(cnId);
      const cn: ApiCreditNote = res.creditNote;
      if (!cn) return;
      setSavedCreditNote(cn);

      let customer: ApiCustomer | null = null;
      if (cn.customer_id) {
        try {
          customer = customerResults.find((c) => c.id === cn.customer_id) ?? null;
        } catch {
          customer = null;
        }
      }

      setDraft({
        customerId: cn.customer_id ?? null,
        customer,
        referenceInvoiceId: cn.reference_invoice_id ?? null,
        referenceInvoice: null,
        currency: cn.currency,
        issueDate: cn.issue_date ?? todayISO(),
        reason: cn.reason ?? null,
        reasonCustom: null,
        items: (cn.items ?? []).map((it: ApiCreditNoteItem) => ({
          id: it.id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unit_price,
          discount: it.discount && Number(it.discount) > 0 ? it.discount : undefined,
          discountType: it.discount_type,
          taxRate: it.tax_rate,
          taxName: it.tax_name ?? null,
          isTaxInclusive: it.is_tax_inclusive,
          productId: it.product_id ?? null,
        })),
        fees: (cn.fees ?? []).map((f: ApiCreditNoteFee) => ({
          description: f.description,
          amount: f.amount,
          taxRate: f.tax_rate,
          taxName: f.tax_name ?? null,
        })),
        notes: cn.notes ?? "",
        terms: cn.terms ?? "",
        internalNotes: cn.internal_notes ?? "",
        taxRate: draft.taxRate,
      });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load credit note");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(updates: Partial<CreditNoteDraft>) {
    setDraft((prev) => ({ ...prev, ...updates }));
  }

  function handleItemChange(index: number, patch: Partial<CreditNoteLineItemDraft>) {
    const items = [...draft.items];
    items[index] = { ...items[index], ...patch };
    updateDraft({ items });
  }

  function handleAddItem() {
    updateDraft({
      items: [
        ...draft.items,
        { description: "", quantity: "1", unit: "each", unitPrice: "", discount: undefined, discountType: "fixed", taxRate: draft.taxRate ?? "0", isTaxInclusive: false, productId: null },
      ],
    });
  }

  function handleRemoveItem(index: number) {
    updateDraft({ items: draft.items.filter((_, i) => i !== index) });
  }

  function handleDuplicateItem(index: number) {
    const item = draft.items[index];
    updateDraft({
      items: [...draft.items, { ...item, id: undefined }],
    });
  }

  function handleFeeChange(index: number, field: keyof CreditNoteFeeDraft, value: string) {
    const fees = [...draft.fees];
    fees[index] = { ...fees[index], [field]: value };
    updateDraft({ fees });
  }

  function handleAddFee() {
    updateDraft({
      fees: [...draft.fees, { description: "", amount: "0", taxRate: draft.taxRate ?? "0", taxName: null }],
    });
  }

  function handleRemoveFee(index: number) {
    updateDraft({ fees: draft.fees.filter((_, i) => i !== index) });
  }

  const calculation = useMemo(() => {
    if (draft.items.length === 0 && draft.fees.length === 0) {
      return {
        subtotal: "0",
        discountTotal: "0",
        taxTotal: "0",
        feeTotal: "0",
        total: "0",
      };
    }

    try {
      const calcInput: LineItemInput[] = draft.items.map((it) => ({
        description: it.description || "",
        quantity: it.quantity || "1",
        unit: it.unit || "each",
        unitPrice: it.unitPrice || "0",
        discount:
          it.discount && !parseDecimal(it.discount).isZero()
            ? { type: it.discountType ?? "fixed", value: it.discount }
            : undefined,
        taxRate: it.taxRate ?? draft.taxRate ?? "0",
        tax_name: it.taxName ?? null,
        isTaxInclusive: it.isTaxInclusive ?? false,
      }));

      const feeInputs: FeeInput[] = draft.fees.map((f) => ({
        description: f.description,
        amount: f.amount,
        taxRate: f.taxRate ?? draft.taxRate ?? "0",
        tax_name: f.taxName ?? null,
      }));

      const result = calculationEngine.calculate({
        currency: draft.currency as any,
        lineItems: calcInput,
        fees: feeInputs.length ? feeInputs : undefined,
        amountPaid: "0",
      });

      return {
        subtotal: result.subtotal.toFixed(2),
        discountTotal: result.discountTotal.toFixed(2),
        taxTotal: result.taxTotal.toFixed(2),
        feeTotal: result.feeTotal.toFixed(2),
        total: result.total.toFixed(2),
      };
    } catch {
      return {
        subtotal: "0",
        discountTotal: "0",
        taxTotal: "0",
        feeTotal: "0",
        total: "0",
      };
    }
  }, [draft.items, draft.fees, draft.currency, draft.taxRate]);

  const currency = draft.currency;
  const meta = getCurrencyMetadata(currency);
  const step = meta.decimalPlaces === 0 ? "1" : "0.01";

  function handleCustomerSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCustomerSearch(e.target.value);
    debouncedCustomerSearch(e.target.value);
  }

  function handleInvoiceSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInvoiceSearch(e.target.value);
    debouncedInvoiceSearch(e.target.value);
  }

  function selectCustomer(customer: ApiCustomer) {
    updateDraft({ customerId: customer.id, customer });
    setCustomerSearch("");
    setCustomerResults([]);
  }

  function selectInvoice(invoice: ApiInvoice) {
    updateDraft({
      referenceInvoiceId: invoice.id,
      referenceInvoice: invoice,
      customerId: invoice.customer_id ?? draft.customerId,
      customer: customerResults.find((c) => c.id === invoice.customer_id) ?? draft.customer ?? null,
      currency: invoice.currency ?? draft.currency,
      items: invoice.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unit_price,
        discount: it.discount && Number(it.discount) > 0 ? it.discount : undefined,
        discountType: it.discount_type,
        taxRate: it.tax_rate,
        taxName: it.tax_name ?? null,
        isTaxInclusive: it.is_tax_inclusive ?? false,
        productId: it.product_id ?? null,
      })),
    });
    setInvoiceSearch("");
    setInvoiceSearchResults([]);
  }

  async function handleSaveDraft() {
    if (!isEditMode) {
      await handleCreate();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: UpdateCreditNoteInput = {
        issueDate: draft.issueDate || null,
        reason: draft.reasonCustom || draft.reason || null,
        notes: draft.notes || null,
        terms: draft.terms || null,
        items: draft.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          discount: it.discount ?? 0,
          discountType: it.discountType ?? "fixed",
          taxRate: it.taxRate ?? "0",
          isTaxInclusive: it.isTaxInclusive ?? false,
        })),
        fees: draft.fees.length > 0 ? draft.fees : undefined,
      };
      await updateCreditNote(id!, input);
      setActionMessage("Draft saved.");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const input: CreateCreditNoteInput = {
        customerId: draft.customerId,
        referenceInvoiceId: draft.referenceInvoiceId,
        currency: draft.currency,
        issueDate: draft.issueDate,
        reason: draft.reasonCustom || draft.reason || null,
        items: draft.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          discount: it.discount ?? 0,
          discountType: it.discountType ?? "fixed",
          taxRate: it.taxRate ?? "0",
          isTaxInclusive: it.isTaxInclusive ?? false,
        })),
        fees: draft.fees.length > 0 ? draft.fees : undefined,
        notes: draft.notes || null,
        terms: draft.terms || null,
      };
      const result = await createCreditNote(input);
      navigate(`/app/credit-notes/${result.id}/edit`);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to create credit note");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await finalizeCreditNote(id);
      await loadCreditNote(id);
      setActionMessage("Credit note finalized.");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to finalize");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await sendCreditNote(id);
      await loadCreditNote(id);
      setActionMessage("Credit note sent to customer.");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to send");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!id) return;
    try {
      const blob = await getCreditNotePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Credit-Note-${savedCreditNote?.credit_note_number ?? id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download PDF");
    }
  }

  const hasItems = draft.items.length > 0;
  const canSave = draft.items.length > 0 && draft.items.every((it) => it.description.trim() && Number(it.unitPrice || 0) > 0);

  const isFinalized = savedCreditNote?.is_finalized ?? false;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <div className="flex items-center gap-3 text-secondary">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading credit note…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-page text-primary">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-color bg-surface px-6">
        <div className="flex items-center gap-4">
          <Link
            to="/app/credit-notes"
            className="rounded-lg p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary"
            aria-label="Back to credit notes"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-tertiary">|</span>
          <h1 className="text-xl font-semibold text-primary">
            {isEditMode
              ? (savedCreditNote?.credit_note_number ?? "Editing Credit Note")
              : "New Credit Note"}
          </h1>
          {isEditMode && savedCreditNote && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-medium text-tertiary">
              {savedCreditNote.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isEditMode && (
            <>
              {!isFinalized && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadPdf}
                >
                  Download PDF
                </Button>
              )}
              {!isFinalized && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Save className="w-4 h-4" />}
                  onClick={handleSaveDraft}
                  loading={saving}
                >
                  Save Draft
                </Button>
              )}
              {isFinalized && savedCreditNote?.status === "finalized" && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Send className="w-4 h-4" />}
                  onClick={handleSend}
                  loading={saving}
                >
                  Send
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Action message */}
      {actionMessage && (
        <div className="rounded-lg border status-success-border status-success-bg px-3 py-2 text-sm status-success-text">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border status-error-border status-error-bg px-3 py-2 text-sm status-error-text">
          {error}
        </div>
      )}

      <main className="flex flex-1 overflow-hidden">
        <div className="flex w-full flex-[2] flex-col overflow-y-auto">
          {/* Customer & Reference Invoice */}
          <section className="border-b border-color bg-surface p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Customer Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-tertiary mb-2">
                  Customer
                </label>
                {draft.customerId ? (
                  <div className="mb-2 rounded-lg bg-surface-alt p-3 text-sm">
                    <span className="font-medium text-primary">{draft.customer?.name ?? "—"}</span>
                    {draft.customer?.email && (
                      <span className="block text-xs text-tertiary">{draft.customer.email}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => updateDraft({ customerId: null, customer: null })}
                      className="mt-1 text-xs text-tertiary hover:text-primary"
                    >
                      Clear selection
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={handleCustomerSearchChange}
                      className="filter-input pl-4 w-full"
                    />
                    {customerSearchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <RefreshCw className="h-4 w-4 animate-spin text-tertiary" />
                      </div>
                    )}
                    {customerResults.length > 0 && customerSearch && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-color bg-surface-alt shadow-lg">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full p-3 text-left hover:bg-surface border-b border-color-subtle last:border-b-0"
                            onClick={() => selectCustomer(c)}
                          >
                            <p className="font-medium text-sm text-primary">{c.name}</p>
                            {c.companyName && <p className="text-xs text-secondary">{c.companyName}</p>}
                            {c.email && <p className="text-xs text-tertiary">{c.email}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reference Invoice */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-tertiary mb-2">
                  Original Invoice (optional)
                </label>
                {draft.referenceInvoice ? (
                  <div className="rounded-lg bg-surface-alt p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-primary">{draft.referenceInvoice.invoice_number}</span>
                      <span className="text-tertiary">{formatCurrency(draft.referenceInvoice.total, draft.referenceInvoice.currency)}</span>
                    </div>
                    <div className="text-xs text-tertiary">
                      Balance due: {formatCurrency(draft.referenceInvoice.amount_due, draft.referenceInvoice.currency)}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDraft({ referenceInvoiceId: null, referenceInvoice: null, items: [], currency: businessDefaultCurrency })}
                      className="mt-1 text-xs text-tertiary hover:text-primary"
                    >
                      Clear reference
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search invoices by number or customer..."
                      value={invoiceSearch}
                      onChange={handleInvoiceSearchChange}
                      className="filter-input pl-4 w-full"
                    />
                    {invoiceSearchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <RefreshCw className="h-4 w-4 animate-spin text-tertiary" />
                      </div>
                    )}
                    {invoiceSearchResults.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-color bg-surface-alt shadow-lg">
                        {invoiceSearchResults.map((inv) => (
                          <button
                            key={inv.id}
                            type="button"
                            className="w-full p-3 text-left hover:bg-surface border-b border-color-subtle last:border-b-0"
                            onClick={() => selectInvoice(inv)}
                          >
                            <div className="flex justify-between">
                              <span className="font-medium text-primary">{inv.invoice_number}</span>
                              <span className="text-tertiary">{formatCurrency(inv.total, inv.currency)}</span>
                            </div>
                            <div className="text-xs text-secondary">{inv.customer_name}</div>
                            <div className="text-xs text-tertiary">
                              Balance: {formatCurrency(inv.amount_due, inv.currency)} · Status: {inv.status}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Reason */}
          <section className="border-b border-color bg-surface p-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-tertiary mb-3">
              Reason for Credit
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CREDIT_NOTE_REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex items-start gap-3 rounded-lg border border-color p-3 hover:bg-surface-alt cursor-pointer"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={draft.reason === r.value}
                    onChange={(e) => updateDraft({ reason: e.target.value, reasonCustom: "" })}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="block font-medium text-primary">{r.label}</span>
                    <span className="block text-xs text-tertiary">{r.description}</span>
                  </div>
                </label>
              ))}
            </div>
            {draft.reason === "" && (
              <div className="mt-4">
                <FormField
                  label="Custom Reason"
                  value={draft.reasonCustom || ""}
                  onChange={(e) => updateDraft({ reasonCustom: e.target.value })}
                  placeholder="Enter your reason..."
                />
              </div>
            )}
          </section>

          {/* Issue Date & Currency */}
          <section className="border-b border-color bg-surface p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                label="Issue Date"
                labelClassName="uppercase"
                type="date"
                value={draft.issueDate ?? ""}
                onChange={(e) => updateDraft({ issueDate: e.target.value })}
              />
              <FormField
                label="Currency"
                labelClassName="uppercase"
                value={draft.currency}
                onChange={(e) => updateDraft({ currency: e.target.value })}
                select
              >
                {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CNY"].map((c) => (
                  <option key={c} value={c}>
                    {c} ({getCurrencyMetadata(c).symbol})
                  </option>
                ))}
              </FormField>
              <FormField
                label="Default Tax Rate"
                labelClassName="uppercase"
                type="number"
                value={toPercent(draft.taxRate ?? "0")}
                onChange={(e) => updateDraft({ taxRate: fromPercentage(e.target.value.replace(/[^\d.]/g, "")) })}
                helperText="Applied to items without a specific tax rate."
              />
            </div>
          </section>

          {/* Line Items */}
          <section className="border-b border-color bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Credit Items</h2>
              <Button variant="ghost" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddItem}>
                Add Item
              </Button>
            </div>

            {!hasItems ? (
              <div className="rounded-xl border border-dashed border-color-subtle bg-surface-alt py-10 text-center">
                <FileText className="mx-auto h-10 w-10 text-tertiary/40" />
                <h3 className="mt-3 text-sm font-semibold text-primary">No line items added yet</h3>
                <p className="mt-1 max-w-sm text-center text-xs text-tertiary">
                  Add items to credit or select an original invoice above to pre-populate them.
                </p>
                <div className="mt-5">
                  <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddItem}>
                    Add a line item
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {draft.items.map((item, i) => (
                  <LineItemCard
                    key={item.id ?? `li_${i}`}
                    item={item}
                    index={i}
                    currency={draft.currency}
                    meta={meta}
                    step={step}
                    defaultTaxRate={draft.taxRate ?? "0"}
                     onItemChange={handleItemChange}
                     onDuplicate={handleDuplicateItem}
                     onRemove={handleRemoveItem}
                   />
                ))}
              </div>
            )}

            {hasItems && (
              <div className="mt-4 flex items-center gap-2 text-sm text-tertiary">
                {QUICK_ADJUST_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const firstItem = draft.items[0];
                      if (firstItem) {
                        const originalTotal = new Decimal(firstItem.unitPrice || "0").mul(new Decimal(firstItem.quantity || "1"));
                        const adjusted = originalTotal.mul(new Decimal(pct).div(100));
                        const newPrice = adjusted.div(new Decimal(firstItem.quantity || "1"));
                        handleItemChange(0, { unitPrice: newPrice.toFixed(2) });
                      }
                    }}
                    className="rounded border border-color px-2 py-0.5 text-xs text-tertiary hover:bg-surface-alt"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}

            {!hasItems && (
              <button
                type="button"
                onClick={handleAddItem}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-color bg-surface-alt px-3 py-1.5 text-sm text-secondary hover:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another line
              </button>
            )}
          </section>

          {/* Fees */}
          <section className="border-b border-color bg-surface p-6">
            <DisclosureSection title="Additional Fees" defaultOpen={false}>
              <div className="space-y-3">
                {draft.fees.map((fee, i) => (
                  <div key={`fee_${i}`} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px_100px_auto]">
                    <FormField
                      label="Description"
                      value={fee.description}
                      onChange={(e) => handleFeeChange(i, "description", e.target.value)}
                    />
                    <FormField
                      label="Amount"
                      type="number"
                      value={fee.amount}
                      onChange={(e) => handleFeeChange(i, "amount", e.target.value)}
                    />
                    <FormField
                      label="Tax %"
                      type="number"
                      value={toPercent(fee.taxRate ?? "0")}
                      onChange={(e) => handleFeeChange(i, "taxRate", fromPercentage(e.target.value.replace(/[^\d.]/g, "")))}
                    />
                    <div className="flex items-end">
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveFee(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddFee}>
                  Add Fee
                </Button>
              </div>
            </DisclosureSection>
          </section>

          {/* Notes & Terms */}
          <section className="bg-surface p-6">
            <DisclosureSection title="Notes & Terms" defaultOpen={true}>
              <div className="space-y-4">
                <FormField
                  label="Notes (for customer)"
                  value={draft.notes ?? ""}
                  onChange={(e) => updateDraft({ notes: e.target.value })}
                  placeholder="Additional notes visible to the customer..."
                  className="w-full"
                />
                <FormField
                  label="Terms & Conditions"
                  value={draft.terms ?? ""}
                  onChange={(e) => updateDraft({ terms: e.target.value })}
                  placeholder="Payment terms, cancellation policy, etc."
                  className="w-full"
                />
                <FormField
                  label="Internal Notes"
                  value={draft.internalNotes ?? ""}
                  onChange={(e) => updateDraft({ internalNotes: e.target.value })}
                  placeholder="Internal notes visible only to your team..."
                  className="w-full"
                />
              </div>
            </DisclosureSection>
          </section>
        </div>

        {/* Sidebar - Totals */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-color bg-surface-alt">
          <div className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-tertiary mb-4">
              Credit Note Summary
            </h3>
            <div className="space-y-2 font-tabular-nums">
              <div className="flex justify-between py-1.5">
                <span className="text-sm text-tertiary">Line Items</span>
                <span className="text-sm font-medium text-primary">{draft.items.length}</span>
              </div>
              <div className="border-t border-color-subtle py-1.5" />

              <div className="flex justify-between py-1.5">
                <span className="text-sm text-tertiary">Subtotal</span>
                <span className="text-sm font-medium text-primary">{formatCurrency(calculation.subtotal, currency, meta.decimalPlaces)}</span>
              </div>
              {Number(calculation.discountTotal) > 0 && (
                <div className="flex justify-between py-1.5">
                  <span className="text-sm text-tertiary">Discount</span>
                  <span className="text-sm font-medium text-success-text">−{formatCurrency(calculation.discountTotal, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              {Number(calculation.taxTotal) > 0 && (
                <div className="flex justify-between py-1.5">
                  <span className="text-sm text-tertiary">Tax</span>
                  <span className="text-sm font-medium text-primary">{formatCurrency(calculation.taxTotal, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              {Number(calculation.feeTotal) > 0 && (
                <div className="flex justify-between py-1.5">
                  <span className="text-sm text-tertiary">Fees</span>
                  <span className="text-sm font-medium text-primary">{formatCurrency(calculation.feeTotal, currency, meta.decimalPlaces)}</span>
                </div>
              )}
              <div className="border-t border-color pt-3">
                <div className="flex justify-between">
                  <span className="text-base font-semibold text-secondary">Total Credit</span>
                  <span className="text-lg font-bold text-primary-brand font-tabular-nums">
                    {formatCurrency(calculation.total, currency, meta.decimalPlaces)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action footer */}
          <div className="mt-auto border-t border-color p-6">
            {!isEditMode ? (
              <>
                {canSave ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    icon={<Save className="w-4 h-4" />}
                    onClick={handleSaveDraft}
                    loading={saving}
                  >
                    Save Draft
                  </Button>
                ) : (
                  <EmptyState
                    variant="compact"
                    title="Ready to save"
                    description="Add items and select a customer to save this credit note."
                  />
                )}
              </>
            ) : (
              <>
                {!isFinalized && (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full mb-2"
                    icon={<Save className="w-4 h-4" />}
                    onClick={handleSaveDraft}
                    loading={saving}
                  >
                    Save Draft
                  </Button>
                )}
                {!isFinalized && savedCreditNote && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    icon={<Send className="w-4 h-4" />}
                    onClick={handleFinalize}
                    loading={saving}
                  >
                    Finalize &amp; Continue
                  </Button>
                )}
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

// LineItemCard sub-component
interface LineItemCardProps {
  item: CreditNoteLineItemDraft;
  index: number;
  currency: string;
  meta: ReturnType<typeof getCurrencyMetadata>;
  step: string;
  defaultTaxRate: string;
  onItemChange: (index: number, patch: Partial<CreditNoteLineItemDraft>) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
}

function LineItemCard({
  item,
  index,
  currency,
  meta,
  step,
  defaultTaxRate,
  onItemChange,
  onDuplicate,
  onRemove,
}: LineItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const itemId = item.id ?? `li_${index}`;

  return (
    <div className="rounded-xl border border-color bg-surface shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <textarea
          id={`desc-${itemId}`}
          value={item.description}
          onChange={(e) => onItemChange(index, { description: e.target.value })}
          placeholder="What is being credited?"
          rows={expanded ? 2 : 1}
          className="flex-1 resize-y border-0 bg-transparent text-sm text-primary placeholder-tertiary focus:outline-none"
          style={{ minHeight: "2rem", maxHeight: "6rem" }}
        />

        <span className="w-32 shrink-0 text-right text-sm font-medium text-primary font-tabular-nums">
          {formatCurrency(
            new Decimal(item.quantity || "1").mul(item.unitPrice || "0"),
            currency
          )}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onDuplicate(index)}
            title="Duplicate line"
            className="rounded p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            title="Remove line"
            className="rounded p-1.5 text-tertiary hover:bg-error-bg hover:text-error-text focus:outline-none focus:ring-1 focus:ring-error"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-color-subtle px-3 pb-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_80px_1fr_100px]">
            <div>
              <label className="form-label-secondary">Qty</label>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => onItemChange(index, { quantity: e.target.value || "1" })}
                min={1}
                step="any"
                className="form-control-sm w-full text-right font-tabular-nums"
              />
            </div>
            <div>
              <label className="form-label-secondary">Unit</label>
              <select
                value={item.unit}
                onChange={(e) => onItemChange(index, { unit: e.target.value })}
                className="form-control-sm w-full"
              >
                {["each", "hour", "day", "week", "month", "fixed"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <label className="form-label-secondary">Rate</label>
              <span className="pointer-events-none absolute left-3 top-5 text-tertiary text-xs">{meta.symbol}</span>
              <input
                type="number"
                value={item.unitPrice}
                onChange={(e) => onItemChange(index, { unitPrice: e.target.value || "0" })}
                min={0}
                step={step}
                className="input-with-prefix w-full text-right font-tabular-nums"
              />
            </div>
            <div>
              <label className="form-label-secondary">Tax %</label>
              <div className="mt-1 relative">
                <input
                  type="number"
                  value={toPercent(item.taxRate ?? defaultTaxRate)}
                  onChange={(e) =>
                    onItemChange(index, { taxRate: fromPercentage(e.target.value.replace(/[^\d.]/g, "")) })
                  }
                  min={0}
                  max={100}
                  step="0.01"
                  className="form-control-sm w-full text-right font-tabular-nums pr-8"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-tertiary text-xs">%</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-tertiary">
                  <input
                    type="checkbox"
                    checked={item.isTaxInclusive ?? false}
                    onChange={(e) => onItemChange(index, { isTaxInclusive: e.target.checked })}
                    className="h-3 w-3 rounded border-input-border text-primary-brand focus:ring-primary"
                  />
                  Inclusive
                </label>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_80px_auto]">
            <div className="relative">
              <label className="form-label-secondary">Discount</label>
              <span className="pointer-events-none absolute left-3 top-5 text-tertiary text-xs">
                {item.discountType === "percentage" ? "%" : meta.symbol}
              </span>
              <input
                type="number"
                value={
                  item.discountType === "percentage"
                    ? toPercent(item.discount ?? "0")
                    : item.discount ?? ""
                }
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/[^\d.]/g, "");
                  onItemChange(index, {
                    discount:
                      item.discountType === "percentage"
                        ? rawValue
                        : rawValue || "",
                  });
                }}
                min={0}
                step="0.01"
                className="input-with-prefix w-full text-right font-tabular-nums"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="form-label-secondary">Type</label>
              <select
                value={item.discountType ?? "fixed"}
                onChange={(e) =>
                  onItemChange(index, { discountType: e.target.value as "fixed" | "percentage" })
                }
                className="form-control-sm w-full"
              >
                <option value="fixed">Fixed</option>
                <option value="percentage">%</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => onDuplicate(index)}
                className="rounded p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                title="Duplicate"
              >
                <FileText className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

LineItemCard.displayName = "LineItemCard";
