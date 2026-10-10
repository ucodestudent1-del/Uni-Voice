import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Download,
  FileText,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  createCreditNote,
  updateCreditNote,
  finalizeCreditNote,
  cancelCreditNote,
  getCreditNote,
  getCreditNotePdf,
  getCustomers,
  getInvoices,
  type CreateCreditNoteInput,
  type UpdateCreditNoteInput,
} from "@/api/client";
import type { ApiCustomer, ApiCreditNote, ApiInvoice, ApiCreditNoteItem, ApiCreditNoteFee, ApiCreditNoteApplication } from "@/types/api";
import {
  calculationEngine,
  type FeeInput,
  type LineItemInput,
  } from "@/utils/calculation";
import { formatCurrency, formatDate, formatTaxRate, fromPercentage, toPercent, parseDecimal } from "@/utils/format";
import { getCurrencyMetadata, type CurrencyCode } from "@/types/currency";
import CustomerSelector from "./CustomerSelector";
import CommandLineItemInput from "./CommandLineItemInput";
import { Button } from "./ui/Button";
import { FormField, FormTextareaField } from "./ui/FormField";
import { CreditNoteLifecycle, creditNoteStatusConfig } from "@/components/ui";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import CreditNoteDisplay, { type CreditNoteDesign } from "@/components/CreditNoteDisplay";
import { useSubscription } from "@/contexts/SubscriptionContext";

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
  referenceInvoiceId?: string | null;
  currency: string;
  issueDate: string;
  reason: string;
  reasonCustom?: string;
  items: CreditNoteLineItemDraft[];
  fees: CreditNoteFeeDraft[];
  notes?: string;
  terms?: string;
  internalNotes?: string;
}

const STEP_INDICATORS = [
  { key: "invoice", label: "Select Invoice" },
  { key: "reason", label: "Reason" },
  { key: "items", label: "Items" },
  { key: "review", label: "Review & Issue" },
];

const QUICK_AMOUNTS = ["10", "25", "50", "75", "100"];

export default function CreditNoteWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { plan } = useSubscription();
  const isEditMode = Boolean(id);

  const [draft, setDraft] = useState<CreditNoteDraft>({
    customerId: null,
    referenceInvoiceId: null,
    currency: "USD",
    issueDate: new Date().toISOString().split("T")[0],
    reason: "",
    reasonCustom: "",
    items: [],
    fees: [],
    notes: "",
    terms: "",
    internalNotes: "",
  });

  const [referenceInvoice, setReferenceInvoice] = useState<ApiInvoice | null>(null);
  const [savedCreditNote, setSavedCreditNote] = useState<ApiCreditNote | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSearchResults, setInvoiceSearchResults] = useState<ApiInvoice[]>([]);
  const [invoiceSearchLoading, setInvoiceSearchLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
    if (id) loadCreditNote(id);
  }, [id]);

  async function loadCustomers() {
    setCustomersLoading(true);
    try {
      const res = await getCustomers({ limit: 100 });
      setCustomers(res.customers ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }

  async function loadCreditNote(cnId: string) {
    setLoading(true);
    try {
      const res = await getCreditNote(cnId);
      const cn = res.creditNote;
      setSavedCreditNote(cn);
      setDraft({
        customerId: cn.customer_id ?? null,
        referenceInvoiceId: cn.reference_invoice_id ?? null,
        currency: cn.currency,
        issueDate: cn.issue_date ?? new Date().toISOString().split("T")[0],
        reason: cn.reason ?? "",
        reasonCustom: "",
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
      });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to load credit note");
    } finally {
      setLoading(false);
    }
  }

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

  async function searchInvoices(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInvoiceSearch(val);
    debouncedInvoiceSearch(val);
  }

  function selectInvoice(invoice: ApiInvoice) {
    setDraft((prev) => ({
      ...prev,
      referenceInvoiceId: invoice.id,
      customerId: invoice.customer_id ?? prev.customerId,
      currency: invoice.currency ?? prev.currency,
      items: invoice.items.map((it) => ({
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
    }));
    setReferenceInvoice(invoice);
    setInvoiceSearchResults([]);
    setInvoiceSearch("");
    setCurrentStep(1);
  }

  const calculation = useMemo(() => {
    if (draft.items.length === 0) {
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
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discount: it.discount ? { type: it.discountType ?? "fixed", value: it.discount } : undefined,
        taxRate: it.taxRate ?? "0",
        isTaxInclusive: it.isTaxInclusive ?? false,
      }));

      const feeInputs: FeeInput[] = draft.fees.map((f) => ({
        description: f.description,
        amount: f.amount,
        taxRate: f.taxRate ?? "0",
      }));

      const result = calculationEngine.calculate({
        currency: draft.currency as CurrencyCode,
        lineItems: calcInput,
        fees: feeInputs,
      });

      return {
        subtotal: result.subtotal.toFixed(2),
        discountTotal: result.discountTotal.toFixed(2),
        taxTotal: result.taxTotal.toFixed(2),
        feeTotal: result.feeTotal.toFixed(2),
        total: result.total.toFixed(2),
      };
    } catch (e) {
      return {
        subtotal: "0",
        discountTotal: "0",
        taxTotal: "0",
        feeTotal: "0",
        total: "0",
      };
    }
  }, [draft.items, draft.fees, draft.currency]);

  const debouncedSave = useDebouncedCallback(async (updatedDraft: CreditNoteDraft) => {
    if (!isEditMode) return;

    try {
      const input: UpdateCreditNoteInput = {
        issueDate: updatedDraft.issueDate || null,
        reason: updatedDraft.reason || updatedDraft.reasonCustom || null,
        notes: updatedDraft.notes || null,
        terms: updatedDraft.terms || null,
        items: updatedDraft.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          discount: it.discount ?? 0,
          discountType: it.discountType ?? "fixed",
          taxRate: it.taxRate ?? "0",
          isTaxInclusive: it.isTaxInclusive ?? false,
        })),
        fees: updatedDraft.fees,
      };
      await updateCreditNote(id!, input);
      setActionMessage("Draft saved.");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to save draft");
    }
  }, 750);

  function updateDraft(updates: Partial<CreditNoteDraft>) {
    setDraft((prev) => {
      const updated = { ...prev, ...updates };
      if (isEditMode) {
        debouncedSave(updated);
      }
      return updated;
    });
  }

  function handleItemChange(index: number, field: keyof CreditNoteLineItemDraft, value: string | boolean | string[] | undefined) {
    const items = [...draft.items];
    items[index] = { ...items[index], [field]: value };
    updateDraft({ items });
  }

  function handleAddItem() {
    updateDraft({
      items: [
        ...draft.items,
        { description: "", quantity: "1", unit: "each", unitPrice: "0", discount: undefined, discountType: "fixed", taxRate: "0", isTaxInclusive: false },
      ],
    });
  }

  function handleRemoveItem(index: number) {
    const items = [...draft.items];
    items.splice(index, 1);
    updateDraft({ items });
  }

  function handleFeeChange(index: number, field: keyof CreditNoteFeeDraft, value: string) {
    const fees = [...draft.fees];
    fees[index] = { ...fees[index], [field]: value };
    updateDraft({ fees });
  }

  function handleAddFee() {
    updateDraft({
      fees: [...draft.fees, { description: "", amount: "0", taxRate: "0", taxName: null }],
    });
  }

  function handleRemoveFee(index: number) {
    const fees = [...draft.fees];
    fees.splice(index, 1);
    updateDraft({ fees });
  }

  function handleQuickAdjust(itemIndex: number, percentage: string) {
    const items = [...draft.items];
    const item = items[itemIndex];
    const originalTotal = new Decimal(item.unitPrice).mul(new Decimal(item.quantity));
    const adjusted = originalTotal.mul(new Decimal(percentage).div(100));
    items[itemIndex] = {
      ...item,
      unitPrice: adjusted.div(new Decimal(item.quantity)).toFixed(2),
    };
    updateDraft({ items });
  }

  async function handleSaveDraft() {
    if (!isEditMode) {
      await handleCreate();
    } else {
      setActionMessage("Draft saved.");
    }
  }

  async function handleCreate() {
    try {
      setSaving(true);
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
    try {
      setSaving(true);
      await finalizeCreditNote(id);
      await loadCreditNote(id);
      setActionMessage("Credit note finalized.");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to finalize");
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

  const totalQuantity = draft.items.reduce((sum, it) => sum.plus(new Decimal(it.quantity)), new Decimal(0));
  const hasItems = draft.items.length > 0;

  const canProceedReason = draft.items.length > 0 || draft.fees.length > 0;
  const canProceedReview = canProceedReason && (draft.reason || draft.reasonCustom);

  const displayDesign: CreditNoteDesign | null = useMemo(() => {
    if (!savedCreditNote) return null;
    return {
      businessName: "",
      businessLegalName: null,
      businessEmail: undefined,
      businessPhone: undefined,
      businessWebsite: undefined,
      businessAddress: undefined,
      businessLogo: null,
      businessTaxId: undefined,
      businessRegistrationNumber: null,

      creditNoteNumber: savedCreditNote.credit_note_number ?? "",
      issueDate: savedCreditNote.issue_date ?? undefined,
      currency: savedCreditNote.currency,
      status: savedCreditNote.status,

      customerName: savedCreditNote.customer_name ?? undefined,
      customerCompanyName: undefined,
      customerEmail: savedCreditNote.customer_email ?? undefined,
      customerAddress: savedCreditNote.customer_address ?? undefined,
      customerPhone: savedCreditNote.customer_phone ?? undefined,
      customerTaxId: savedCreditNote.customer_tax_id ?? undefined,

      referenceInvoiceNumber: savedCreditNote.reference_invoice_number ?? undefined,
      referenceInvoiceDate: undefined,

      reason: savedCreditNote.reason,
      notes: savedCreditNote.notes,
      terms: savedCreditNote.terms,

      items: (savedCreditNote.items ?? []).map((it: ApiCreditNoteItem) => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unit_price,
        discount: it.discount && Number(it.discount) > 0 ? it.discount : undefined,
        discountType: it.discount_type,
        taxRate: it.tax_rate,
        tax_name: it.tax_name ?? null,
        isTaxInclusive: it.is_tax_inclusive ?? false,
      })),
      fees: (savedCreditNote.fees ?? []).map((f: ApiCreditNoteFee) => ({
        description: f.description,
        amount: f.amount,
        taxRate: f.tax_rate,
        tax_name: f.tax_name ?? null,
        tax_amount: f.tax_amount ?? null,
      })),
      subtotal: savedCreditNote.subtotal,
      discountTotal: savedCreditNote.discount_total,
      taxTotal: savedCreditNote.tax_total,
      feeTotal: savedCreditNote.fee_total,
      total: savedCreditNote.total,
      appliedTotal: savedCreditNote.applied_total,
      amountDue: savedCreditNote.amount_due,
      applications: (savedCreditNote.applications ?? []).map((app: ApiCreditNoteApplication) => ({
        amount: app.amount,
        invoiceNumber: app.invoice_id,
        invoiceId: app.invoice_id,
        appliedAt: app.applied_at,
      })),
      isFinalized: savedCreditNote.is_finalized,
      notesForCustomer: savedCreditNote.notes ?? undefined,
    };
  }, [savedCreditNote]);

  if (loading) {
    return (
      <div className="text-center py-20 text-secondary">
        Loading credit note…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/app/credit-notes"
          className="text-tertiary hover:text-primary flex-shrink-0 flex items-center gap-1"
        >
          &larr; Credit Notes
        </Link>
        <h1 className="text-2xl font-bold text-primary truncate">
          {isEditMode ? (savedCreditNote?.credit_note_number ?? "Editing Credit Note") : "New Credit Note"}
        </h1>
        {isEditMode && savedCreditNote && (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-surface-alt text-tertiary">
            {creditNoteStatusConfig.getConfig(savedCreditNote.status).label}
          </span>
        )}
      </div>

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

      {saving && (
        <div className="flex items-center gap-2 text-sm text-tertiary">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          Saving…
        </div>
      )}

      {!isEditMode && (
        <div className="flex items-center gap-2 text-sm text-tertiary">
          <FileText className="w-4 h-4" />
          <span>Step {currentStep + 1} of {STEP_INDICATORS.length}: {STEP_INDICATORS[currentStep].label}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {!isEditMode && (
            <>
              {/* Step 0: Select Invoice */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-primary">Select Original Invoice</h2>
                  <p className="text-sm text-secondary">
                    Select an eligible invoice to pre-populate customer, currency, and line items.
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search invoices by number or customer..."
                      value={invoiceSearch}
                      onChange={searchInvoices}
                      className="filter-input pl-4 w-full"
                    />
                  </div>
                  {invoiceSearchLoading && <p className="text-sm text-tertiary">Searching…</p>}
                  {invoiceSearchResults.length > 0 && (
                    <div className="border border-color rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                      {invoiceSearchResults.map((inv) => (
                        <button
                          key={inv.id}
                          className="w-full p-3 text-left hover:bg-hover border-b border-color-subtle last:border-b-0"
                          onClick={() => selectInvoice(inv)}
                        >
                          <div className="flex justify-between">
                            <span className="font-medium text-primary">{inv.invoice_number}</span>
                            <span className="text-sm text-tertiary">{formatCurrency(inv.total, inv.currency)}</span>
                          </div>
                          <div className="text-sm text-secondary">{inv.customer_name}</div>
                          <div className="text-xs text-tertiary">
                            Balance: {formatCurrency(inv.amount_due, inv.currency)} · Status: {inv.status}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {invoiceSearch && invoiceSearchResults.length === 0 && !invoiceSearchLoading && (
                    <p className="text-sm text-tertiary">No invoices found. You can still create a credit note without an original invoice.</p>
                  )}
                  {!invoiceSearch && referenceInvoice && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-primary mb-2">Selected Invoice</p>
                      <div className="p-3 border border-color rounded-lg bg-surface-alt">
                        <div className="flex justify-between">
                          <span className="font-medium">{referenceInvoice.invoice_number}</span>
                          <span className="text-sm text-tertiary">{formatCurrency(referenceInvoice.total, referenceInvoice.currency)}</span>
                        </div>
                        <div className="text-sm text-secondary">{referenceInvoice.customer_name}</div>
                        <div className="text-xs text-tertiary">
                          Balance Due: {formatCurrency(referenceInvoice.amount_due, referenceInvoice.currency)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 1: Reason */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-primary">Reason for Credit</h2>
                  <p className="text-sm text-secondary">Why are you issuing this credit note?</p>
                  <div className="space-y-2">
                    {CREDIT_NOTE_REASONS.map((r) => (
                      <label key={r.value} className="flex items-start gap-3 p-3 border border-color rounded-lg hover:bg-surface-alt cursor-pointer">
                        <input
                          type="radio"
                          name="reason"
                          value={r.value}
                          checked={draft.reason === r.value}
                          onChange={(e) => updateDraft({ reason: e.target.value, reasonCustom: "" })}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-medium text-primary">{r.label}</span>
                          <p className="text-xs text-tertiary">{r.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {draft.reason === "" && (
                    <FormField
                      label="Custom Reason"
                      value={draft.reasonCustom || ""}
                      onChange={(e) => updateDraft({ reasonCustom: e.target.value })}
                      placeholder="Enter your reason..."
                    />
                  )}
                </div>
              )}

              {/* Step 2: Items */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-primary">Credit Items</h2>
                    <Button variant="ghost" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddItem}>
                      Add Item
                    </Button>
                  </div>
                  {draft.items.length === 0 ? (
                    <div className="text-center py-12 text-secondary">
                      <FileText className="w-12 h-12 text-tertiary mx-auto mb-3" />
                      <p className="text-sm text-secondary mb-3">No items to credit.</p>
                      <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddItem}>
                        Add Item
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {draft.items.map((item, index) => (
                        <div key={item.id ?? `item-${index}`} className="border border-color rounded-lg p-4 space-y-3">
                          <FormField
                            label="Description"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, "description", e.target.value)}
                            placeholder="What is being credited?"
                          />
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <FormField
                              label="Quantity"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                              type="number"
                              min="0"
                            />
                            <FormField
                              label="Unit"
                              value={item.unit}
                              onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                              placeholder="each"
                            />
                            <FormField
                              label="Unit Price"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                              type="number"
                              min="0"
                            />
                            <FormField
                              label="Tax Rate"
                              value={item.taxRate || "0"}
                              onChange={(e) => handleItemChange(index, "taxRate", e.target.value)}
                              type="number"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <FormField
                              label="Discount"
                              value={item.discount || ""}
                              onChange={(e) => handleItemChange(index, "discount", e.target.value || undefined)}
                              type="number"
                              min="0"
                            />
                            <select
                              value={item.discountType || "fixed"}
                              onChange={(e) => handleItemChange(index, "discountType", e.target.value as "fixed" | "percentage")}
                              className="form-control-sm mt-6"
                            >
                              <option value="fixed">Fixed Amount</option>
                              <option value="percentage">Percentage</option>
                            </select>
                            <label className="flex items-center gap-2 mt-6">
                              <input
                                type="checkbox"
                                checked={item.isTaxInclusive ?? false}
                                onChange={(e) => handleItemChange(index, "isTaxInclusive", e.target.checked)}
                              />
                              <span className="text-xs text-tertiary">Tax inclusive</span>
                            </label>
                          </div>
                          <div className="flex justify-end">
                            <button
                              className="text-sm text-tertiary hover:text-error"
                              onClick={() => handleRemoveItem(index)}
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Review & Issue */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-primary">Review &amp; Issue</h2>
                  <div className="rounded-xl border border-color bg-surface p-5 space-y-4">
                    <div className="flex justify-between">
                      <span className="text-tertiary">Subtotal</span>
                      <span className="font-medium text-primary font-tabular-nums">
                        {formatCurrency(calculation.subtotal, draft.currency)}
                      </span>
                    </div>
                    {Number(calculation.discountTotal) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-tertiary">Discount</span>
                        <span className="text-success-text font-tabular-nums">
                          −{formatCurrency(calculation.discountTotal, draft.currency)}
                        </span>
                      </div>
                    )}
                    {Number(calculation.taxTotal) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-tertiary">Tax</span>
                        <span className="font-medium text-primary font-tabular-nums">
                          {formatCurrency(calculation.taxTotal, draft.currency)}
                        </span>
                      </div>
                    )}
                    {Number(calculation.feeTotal) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-tertiary">Fees</span>
                        <span className="font-medium text-primary font-tabular-nums">
                          {formatCurrency(calculation.feeTotal, draft.currency)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-color pt-3">
                      <div className="flex justify-between">
                        <span className="font-medium text-secondary">Total Credit</span>
                        <span className="text-lg font-bold text-primary-brand font-tabular-nums">
                          {formatCurrency(calculation.total, draft.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                  <FormTextareaField
                    label="Notes"
                    value={draft.notes || ""}
                    onChange={(e) => updateDraft({ notes: e.target.value })}
                    placeholder="Additional notes for the customer..."
                  />
                  <FormTextareaField
                    label="Terms"
                    value={draft.terms || ""}
                    onChange={(e) => updateDraft({ terms: e.target.value })}
                    placeholder="Terms and conditions..."
                  />
                  </div>
                </div>
              )}
            </>
          )}

          {isEditMode && savedCreditNote && (
            <div className="space-y-6">
              {savedCreditNote.is_finalized ? (
                <CreditNoteDisplay
                  design={displayDesign!}
                  showActions={false}
                  onDownloadPdf={handleDownloadPdf}
                />
              ) : (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-primary">Edit Credit Note</h2>
                  <FormTextareaField
                    label="Reason"
                    value={draft.reason || draft.reasonCustom || ""}
                    onChange={(e) => updateDraft({ reasonCustom: e.target.value })}
                    placeholder="Reason for the credit..."
                  />
                  <FormTextareaField
                    label="Notes"
                    value={draft.notes || ""}
                    onChange={(e) => updateDraft({ notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                  <FormTextareaField
                    label="Terms"
                    value={draft.terms || ""}
                    onChange={(e) => updateDraft({ terms: e.target.value })}
                    placeholder="Terms and conditions..."
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {!isEditMode && (
            <>
              <div className="rounded-xl border border-color bg-surface p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-tertiary mb-3">
                  Credit Note Summary
                </h3>
                <div className="space-y-2 font-tabular-nums">
                  <div className="flex justify-between py-1.5">
                    <span className="text-sm text-tertiary">Items</span>
                    <span className="text-sm font-medium text-primary">{draft.items.length}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-t border-color-subtle">
                    <span className="text-sm text-tertiary">Subtotal</span>
                    <span className="text-sm font-medium text-primary">{formatCurrency(calculation.subtotal, draft.currency)}</span>
                  </div>
                  {Number(calculation.discountTotal) > 0 && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-tertiary">Discount</span>
                      <span className="text-sm font-medium text-success-text">−{formatCurrency(calculation.discountTotal, draft.currency)}</span>
                    </div>
                  )}
                  {Number(calculation.taxTotal) > 0 && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-tertiary">Tax</span>
                      <span className="text-sm font-medium text-primary">{formatCurrency(calculation.taxTotal, draft.currency)}</span>
                    </div>
                  )}
                  {Number(calculation.feeTotal) > 0 && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-sm text-tertiary">Fees</span>
                      <span className="text-sm font-medium text-primary">{formatCurrency(calculation.feeTotal, draft.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-t border-color">
                    <span className="text-base font-semibold text-secondary">Total Credit</span>
                    <span className="text-lg font-bold text-primary-brand font-tabular-nums">
                      {formatCurrency(calculation.total, draft.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {isEditMode && savedCreditNote && (
            <div className="rounded-xl border border-color bg-surface p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-tertiary">
                Actions
              </h3>
              <div className="space-y-2">
                {!savedCreditNote.is_finalized && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={handleFinalize}
                    disabled={saving}
                  >
                    Finalize Credit Note
                  </Button>
                )}
                {savedCreditNote.is_finalized && savedCreditNote.status === "finalized" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    icon={<Send className="w-4 h-4" />}
                    onClick={handleSaveDraft}
                    disabled={saving}
                  >
                    Send to Customer
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadPdf}
                >
                  Download PDF
                </Button>
                {!savedCreditNote.is_finalized && (
                  <Link to="/app/credit-notes" className="block">
                    <Button variant="secondary" size="sm" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stepper Navigation (for new credit notes) */}
      {!isEditMode && (
        <div className="flex justify-between pt-4 border-t border-color">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          <div className="flex gap-2">
            {currentStep < STEP_INDICATORS.length - 1 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={!canProceedReason && currentStep === 0}
              >
                Next
              </Button>
            )}
            {currentStep === STEP_INDICATORS.length - 1 && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Save className="w-4 h-4" />}
                  onClick={handleSaveDraft}
                >
                  Save Draft
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileText className="w-4 h-4" />}
                  onClick={handleSaveDraft}
                >
                  Save &amp; Continue
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
