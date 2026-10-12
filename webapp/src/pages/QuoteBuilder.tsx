import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getQuote,
  createQuote,
  updateQuote,
  finalizeQuote,
  sendQuote,
  getCustomers,
  getBusiness,
  getTaxRates,
  duplicateQuote,
  type CreateQuoteInput,
  type CreateQuoteItemInput,
  type CreateQuoteFeeInput,
  type FinalizeQuoteResult,
  type SendQuoteResult,
} from "@/api/client";
import { CalculationEngine, type InvoiceCalculationInput, type LineItemInput, type FeeInput, type DiscountDefinition } from "@/utils/calculation";
import { type CurrencyCode } from "@/types/currency";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Button,
  FormField,
  FormTextareaField,
  PageHeader,
} from "@/components/ui";
import { Save, Send, Plus, Trash2, FileText, GripVertical, Copy, AlertCircle, HelpCircle, AlertTriangle } from "lucide-react";
import { Decimal } from "decimal.js";
import DocumentPreview from "@/components/DocumentPreview";
import type { ApiQuote, ApiQuoteItem, ApiQuoteFee, ApiBusiness, ApiTaxRate } from "@/types/api";
import type { ApiCustomer } from "@/types/api";
import { useKeyboardShortcuts, getShortcutsHelp } from "@/hooks/useKeyboardShortcuts";
import { useQuoteValidation } from "@/hooks/useQuoteValidation";
import { formatCurrency, formatTaxRate } from "@/utils/format";
import { cn } from "@/lib/utils";

interface LocalItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  taxName: string;
  isTaxInclusive: boolean;
  discount: string;
  discountType: "fixed" | "percentage";
  isOptional: boolean;
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
    discount: "0",
    discountType: "percentage",
    isOptional: false,
  };
}

const PAYMENT_TERMS_OPTIONS = [
  { value: "net_7", label: "Net 7" },
  { value: "net_15", label: "Net 15" },
  { value: "net_30", label: "Net 30" },
  { value: "net_60", label: "Net 60" },
  { value: "upfront", label: "Upfront" },
  { value: "custom", label: "Custom" },
];

interface LocalState {
  customerId: string;
  currency: string;
  issueDate: string;
  expiryDate: string;
  paymentTerms: string;
  terms: string;
  notes: string;
  scopeOfWork: string;
  paymentInstructions: string;
  items: LocalItem[];
  fees: { description: string; amount: string; taxRate: string; taxName: string }[];
  quoteDiscount: string;
  quoteDiscountType: "fixed" | "percentage";
  depositType: "none" | "percentage" | "fixed";
  depositValue: string;
  depositDueDate: string;
}

const CALC_ENGINE = new CalculationEngine();

export default function QuoteBuilder() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [taxRates, setTaxRates] = useState<ApiTaxRate[]>([]);
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [removedItem, setRemovedItem] = useState<{ item: LocalItem; index: number } | null>(null);
  const [state, setState] = useState<LocalState>({
    customerId: "",
    currency: "USD",
    issueDate: new Date().toISOString().split("T")[0],
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    paymentTerms: "net_30",
    terms: "",
    notes: "",
    scopeOfWork: "",
    paymentInstructions: "",
    items: [initialItem()],
    fees: [],
    quoteDiscount: "0",
    quoteDiscountType: "fixed",
    depositType: "none",
    depositValue: "0",
    depositDueDate: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [sendData, setSendData] = useState({ to: "", subject: "", message: "" });
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const shortcutsHelp = getShortcutsHelp();

  const setDirtyState = (updater: (prev: LocalState) => LocalState) => {
    setState((prev) => {
      const next = updater(prev);
      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        setIsDirty(true);
      }
      return next;
    });
  };

  useEffect(() => {
    getCustomers({ limit: 100 }).then((d) => setCustomers(d.customers ?? [])).catch(() => {});
    getBusiness().then((d) => setBusiness(d.business ?? d)).catch(() => {});
    getTaxRates().then((d) => setTaxRates(d.tax_rates ?? d.rates ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNew && id) {
      getQuote(id).then((res) => {
        const q: ApiQuote = res.quote;
        setQuote(q);
        setState({
          customerId: q.customer_id ?? "",
          currency: q.currency,
          issueDate: q.issue_date ? q.issue_date.split("T")[0] : new Date().toISOString().split("T")[0],
          expiryDate: q.expiry_date ? q.expiry_date.split("T")[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          paymentTerms: "net_30",
          terms: q.terms ?? "",
          notes: q.notes ?? "",
          scopeOfWork: q.scope_of_work ?? "",
          paymentInstructions: q.payment_instructions ?? "",
          items: (q.items ?? []).map((item: ApiQuoteItem) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unit_price,
            taxRate: item.tax_rate,
            taxName: item.tax_name ?? "",
            isTaxInclusive: item.is_tax_inclusive,
            discount: item.discount,
            discountType: (item as unknown as { discount_type?: "fixed" | "percentage" }).discount_type ?? "percentage",
            isOptional: item.is_optional ?? false,
          })),
          fees: (q.fees ?? []).map((fee: ApiQuoteFee) => ({
            description: fee.description,
            amount: fee.amount,
            taxRate: fee.tax_rate,
            taxName: fee.tax_name ?? "",
          })),
          quoteDiscount: (q as unknown as { quote_discount_value?: string }).quote_discount_value ?? "0",
          quoteDiscountType: (q as unknown as { quote_discount_type?: "fixed" | "percentage" }).quote_discount_type ?? "fixed",
          depositType: (q as unknown as { deposit_type?: "none" | "percentage" | "fixed" }).deposit_type ?? "none",
          depositValue: (q as unknown as { deposit_value?: string }).deposit_value ?? "0",
          depositDueDate: q.due_date ? q.due_date.split("T")[0] : "",
        });
      }).catch((err) => {
        toast(err.message, { type: "error", title: "Failed to load quote" });
      });
    }
  }, [id, isNew, toast]);

  const calcInput: InvoiceCalculationInput = useMemo(() => {
    const currencyCode = (state.currency as CurrencyCode) ?? "USD";
    const lineItems: LineItemInput[] = state.items
      .filter((item) => item.description.trim())
      .map((item, idx) => ({
        description: item.description,
        quantity: new Decimal(item.quantity || "1"),
        unit: item.unit || "each",
        unitPrice: new Decimal(item.unitPrice || "0"),
        discount: Number(item.discount) > 0
          ? ({ type: item.discountType, value: new Decimal(item.discount) } as DiscountDefinition)
          : undefined,
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

    const quoteDiscountDef =
      Number(state.quoteDiscount) > 0
        ? ({ type: state.quoteDiscountType, value: new Decimal(state.quoteDiscount) } as DiscountDefinition)
        : undefined;

    return {
      currency: currencyCode,
      lineItems,
      fees,
      invoiceDiscount: quoteDiscountDef,
    };
  }, [state.items, state.fees, state.quoteDiscount, state.quoteDiscountType, state.currency]);

  const calcResult = useMemo(() => {
    try {
      return CALC_ENGINE.calculate(calcInput);
    } catch {
      return null;
    }
  }, [calcInput]);

  const validation = useQuoteValidation({
    customerId: state.customerId,
    currency: state.currency,
    issueDate: state.issueDate,
    expiryDate: state.expiryDate,
    items: state.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
    })),
    fees: state.fees,
    depositType: state.depositType,
    depositValue: state.depositValue,
    terms: state.terms,
    notes: state.notes,
    paymentInstructions: state.paymentInstructions,
  });

  const isFinalized = quote?.is_finalized ?? false;
  const isExpiryUrgent = state.expiryDate && new Date(state.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const saveState = useMemo(() => {
    if (isSaving) return "saving";
    return "saved";
  }, [isSaving]);
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  const draggedItemRef = useRef<number | null>(null);

  const handleDiscard = useCallback(() => {
    if (window.confirm("Discard all unsaved changes and start over?")) {
      setState({
        customerId: "",
        currency: business?.defaultCurrency ?? "USD",
        issueDate: new Date().toISOString().split("T")[0],
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        paymentTerms: "net_30",
        terms: "",
        notes: "",
        scopeOfWork: "",
        paymentInstructions: "",
        items: [initialItem()],
        fees: [],
        quoteDiscount: "0",
        quoteDiscountType: "fixed",
        depositType: "none",
        depositValue: "0",
        depositDueDate: "",
      });
      setQuote(null);
      if (isNew) {
        navigate("/app/quotes");
      } else {
        navigate("/app/quotes");
      }
    }
  }, [business, isNew, navigate]);

  const buildPayload = (): CreateQuoteInput => ({
    customerId: state.customerId || undefined,
    currency: state.currency,
    issueDate: state.issueDate || undefined,
    expiryDate: state.expiryDate || undefined,
    terms: state.terms || undefined,
    notes: state.notes || undefined,
    scopeOfWork: state.scopeOfWork || undefined,
    paymentInstructions: state.paymentInstructions || undefined,
    items: state.items.map((item): CreateQuoteItemInput => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discount: item.discount,
      discountType: item.discountType,
      taxRate: item.taxRate,
      taxName: item.taxName || undefined,
      isTaxInclusive: item.isTaxInclusive,
      isOptional: item.isOptional,
    })),
    fees: state.fees.map((fee): CreateQuoteFeeInput => ({
      description: fee.description,
      amount: fee.amount,
      taxRate: fee.taxRate,
      taxName: fee.taxName || undefined,
    })),
    quoteDiscount: state.quoteDiscount,
    quoteDiscountType: state.quoteDiscountType,
    depositType: state.depositType,
    depositValue: state.depositValue,
    depositDueDate: state.depositDueDate || undefined,
  });

  const doSave = useCallback(async () => {
    const payload = buildPayload();
    if (!payload.items || payload.items.length === 0) {
      toast("Add at least one line item before saving.", { type: "warning", title: "Empty quote" });
      return null;
    }
    setIsSaving(true);
    try {
      if (isNew) {
        const res = await createQuote(payload);
        toast(`Created quote #${res.quote.quote_number ?? ""}.`, { type: "success", title: "Quote created" });
        setQuote(res.quote);
        setIsDirty(false);
        return res.quote;
      } else {
        const res = await updateQuote(id!, payload);
        toast("Quote saved.", { type: "success", title: "Saved" });
        setQuote(res.quote);
        setIsDirty(false);
        return res.quote;
      }
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Save failed" });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [id, isNew, navigate, toast, state, buildPayload]);

  const handleFinalizeAndSend = useCallback(async () => {
    let savedQuote = quote;
    if (isNew) {
      const result = await doSave();
      if (!result) return;
      savedQuote = result;
      if (!savedQuote) return;
    }
    if (!savedQuote) return;
    setIsFinalizing(true);
    try {
      const result: FinalizeQuoteResult = await finalizeQuote(savedQuote.id);
      setQuote(result.quote);
      toast(`Quote #${result.quoteNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      setReviewDialogOpen(false);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [quote, isNew, doSave, toast]);

  const handleFinalize = useCallback(async () => {
    let savedQuote = quote;
    if (isNew) {
      const result = await doSave();
      if (!result) return;
      savedQuote = result;
    }
    if (!savedQuote) return;
    setIsFinalizing(true);
    try {
      const result: FinalizeQuoteResult = await finalizeQuote(savedQuote.id);
      setQuote(result.quote);
      toast(`Quote #${result.quoteNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [quote, isNew, doSave, toast]);

  const handleSend = useCallback(async () => {
    let savedQuote = quote;
    if (isNew) {
      const result = await doSave();
      if (!result) return;
      savedQuote = result;
    }
    if (!savedQuote || savedQuote.is_finalized) return;
    setSendDialogOpen(true);
  }, [quote, isNew, doSave]);

  const confirmSend = useCallback(async () => {
    if (!quote) return;
    setIsSending(true);
    try {
      const result: SendQuoteResult = await sendQuote(quote.id, sendData);
      toast(`Quote sent to ${sendData.to || quote.customer_email || "customer"}.`, { type: "success", title: "Sent" });
      setQuote(result.quote);
      setSendDialogOpen(false);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Send failed" });
    } finally {
      setIsSending(false);
    }
  }, [quote, sendData, toast]);

  const updateItem = (idx: number, field: keyof LocalItem, value: unknown) => {
    setDirtyState((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  };

  const addItem = () => {
    setDirtyState((prev) => ({
      ...prev,
      items: [...prev.items, initialItem()],
    }));
  };

  const addFee = () => {
    setDirtyState((prev) => ({
      ...prev,
      fees: [...prev.fees, { description: "", amount: "0.00", taxRate: "0", taxName: "" }],
    }));
  };

  const removeFee = (idx: number) => {
    setDirtyState((prev) => ({
      ...prev,
      fees: prev.fees.filter((_, i) => i !== idx),
    }));
  };

  const updateFee = (idx: number, field: keyof typeof state.fees[0], value: string) => {
    setDirtyState((prev) => ({
      ...prev,
      fees: prev.fees.map((fee, i) => (i === idx ? { ...fee, [field]: value } : fee)),
    }));
  };

  useKeyboardShortcuts({
    enabled: !isFinalized,
    onSave: doSave,
    onFinalize: handleFinalize,
    onSend: handleSend,
    onAddItem: addItem,
    onAddFee: addFee,
    onCancel: handleDiscard,
  });

  const handleDuplicate = useCallback(async () => {
    if (!quote) return;
    try {
      const res = await duplicateQuote(quote.id);
      navigate(`/app/quotes/${res.quote.id}`);
      toast("Quote duplicated.", { type: "success", title: "Duplicated" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Duplicate failed" });
    }
  }, [quote, navigate, toast]);

  const handleReorderItems = useCallback((newItems: LocalItem[]) => {
    setDirtyState((prev) => ({ ...prev, items: newItems }));
  }, []);

  const handleDuplicateItem = useCallback((idx: number) => {
    const item = state.items[idx];
    setDirtyState((prev) => ({
      ...prev,
      items: [...prev.items.slice(0, idx + 1), { ...item }, ...prev.items.slice(idx + 1)],
    }));
  }, [state.items]);

  const handleRemoveItem = useCallback((idx: number) => {
    const removed = state.items[idx];
    setRemovedItem({ item: removed, index: idx });
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
    toast("Line item removed.", {
      type: "info",
      title: "Removed",
      actionLabel: "Undo",
      duration: 10000,
      onAction: () => {
        setState((prev) => {
          const newItems = [...prev.items];
          newItems.splice(removedItem!.index, 0, removedItem!.item);
          return { ...prev, items: newItems };
        });
        setRemovedItem(null);
      },
    });
  }, [state.items, toast]);

  const handleItemDragStart = useCallback((idx: number) => {
    draggedItemRef.current = idx;
  }, []);

  const handleItemDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const fromIdx = draggedItemRef.current;
    if (fromIdx === null || fromIdx === idx) return;
    const newItems = [...state.items];
    const [moved] = newItems.splice(fromIdx, 1);
    newItems.splice(idx, 0, moved);
    handleReorderItems(newItems);
    draggedItemRef.current = idx;
  }, [state.items, handleReorderItems]);

  return (
    <div className="page-container h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader
        title={isNew ? "New Quote" : `Quote #${quote?.quote_number ?? ""}`}
        description={
          <div className="flex items-center gap-2">
            <span>Status: {quote?.status ?? "Draft"}</span>
            {isSaving && <span className="text-xs text-tertiary">(Saving...)</span>}
            {!isSaving && isDirty && <span className="text-xs text-tertiary">(Unsaved changes)</span>}
          </div>
        }
        primaryAction={
          <div className="flex items-center gap-2">
            {isExpiryUrgent && !isFinalized && (
              <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-warning-text bg-warning-bg border border-warning-border rounded-md">
                <AlertCircle className="h-3 w-3" />
                Expires soon
              </span>
            )}
            {isFinalized ? (
              <Button
                variant="primary"
                icon={<Send className="h-4 w-4" />}
                onClick={handleSend}
                disabled={isSending}
                loading={isSending}
              >
                Send
              </Button>
            ) : (
              <>
                <Button variant="ghost" icon={<Save className="h-4 w-4" />} onClick={() => { doSave().then(q => q && navigate(`/app/quotes/${q.id}`)); }} disabled={isSaving} loading={isSaving}>
                  Save Draft
                </Button>
                <Button
                  variant="primary"
                  icon={<FileText className="h-4 w-4" />}
                  onClick={() => setReviewDialogOpen(true)}
                  disabled={isFinalizing || !validation.isValid}
                  loading={isFinalizing}
                >
                  Review &amp; Send
                </Button>
                {!isNew && (
                  <Button variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={handleDuplicate} title="Duplicate quote">
                    Duplicate
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
          {/* Editor Panel */}
          <div className="overflow-y-auto space-y-6 pr-2">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Customer"
                  select
                  value={state.customerId}
                  onChange={(e) => setDirtyState((prev) => ({ ...prev, customerId: e.target.value }))}
                  disabled={isFinalized}
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.email}
                    </option>
                  ))}
                </FormField>

                <FormField
                  label="Currency"
                  select
                  value={state.currency}
                  onChange={(e) => setDirtyState((prev) => ({ ...prev, currency: e.target.value }))}
                  disabled={isFinalized}
                >
                  {["USD", "EUR", "GBP", "CAD", "AUD", "JPY"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Issue Date"
                  type="date"
                  value={state.issueDate}
                  onChange={(e) => setDirtyState((prev) => ({ ...prev, issueDate: e.target.value }))}
                  disabled={isFinalized}
                  error={validation.errors.find((e) => e.field === "issueDate")?.message}
                />
                <FormField
                  label="Expiry Date"
                  type="date"
                  value={state.expiryDate}
                  onChange={(e) => setDirtyState((prev) => ({ ...prev, expiryDate: e.target.value }))}
                  disabled={isFinalized}
                  error={validation.errors.find((e) => e.field === "expiryDate")?.message}
                />
              </div>

              <FormField
                label="Payment Terms"
                select
                value={state.paymentTerms}
                onChange={(e) => setDirtyState((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                disabled={isFinalized}
              >
                {PAYMENT_TERMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </FormField>

              {!isFinalized && (
                <div className="p-4 border border-border rounded-lg bg-surface-alt">
                  <h4 className="text-xs font-medium text-tertiary uppercase mb-3">Deposit Configuration</h4>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {["none", "percentage", "fixed"].map((dt) => (
                      <label key={dt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="depositType"
                          value={dt}
                          checked={state.depositType === dt}
                          onChange={(e) => setDirtyState((prev) => ({ ...prev, depositType: e.target.value as "none" | "percentage" | "fixed" }))}
                          disabled={isFinalized}
                          className="form-radio h-4 w-4 text-primary"
                        />
                        <span className="text-sm text-primary capitalize">{dt === "none" ? "No Deposit" : dt}</span>
                      </label>
                    ))}
                  </div>
                  {state.depositType !== "none" && (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        label={state.depositType === "percentage" ? "Deposit %" : "Deposit Amount"}
                        value={state.depositValue}
                        onChange={(e) => setDirtyState((prev) => ({ ...prev, depositValue: e.target.value }))}
                        disabled={isFinalized}
                        error={validation.errors.find((e) => e.field === "depositValue")?.message}
                      />
                      <FormField
                        label="Deposit Due Date"
                        type="date"
                        value={state.depositDueDate}
                        onChange={(e) => setDirtyState((prev) => ({ ...prev, depositDueDate: e.target.value }))}
                        disabled={isFinalized}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Line Items */}
            <div>
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-medium text-primary">Line Items</h3>
                 <div className="flex items-center gap-2 text-xs text-tertiary">
                   <kbd className="px-1.5 py-0.5 bg-surface-alt border border-border rounded">Ctrl+N</kbd>
                   <span>to add</span>
                   <button
                     type="button"
                     onClick={() => setShowShortcutsHelp(true)}
                     className="ml-2 p-1 text-tertiary hover:text-primary hover:bg-surface-alt rounded"
                     title="Keyboard shortcuts"
                   >
                     <HelpCircle className="h-4 w-4" />
                   </button>
               </div>
               {showShortcutsHelp && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowShortcutsHelp(false)}>
                   <div className="bg-popover border border-border rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                     <h3 className="text-lg font-medium text-primary mb-4">Keyboard Shortcuts</h3>
                     <div className="space-y-2">
                       {shortcutsHelp.map((s, i) => (
                         <div key={i} className="flex justify-between gap-4">
                           <kbd className="px-2 py-1 bg-surface-alt border border-border rounded text-xs">{s.keys}</kbd>
                           <span className="text-sm text-tertiary">{s.description}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                 </div>
               )}
             </div>
              <div className="space-y-2">
                {state.items.map((item, idx) => {
                  const hasError = validation.errors.some((e) => e.field === `items.${idx}.description` || e.field === `items.${idx}.quantity` || e.field === `items.${idx}.unitPrice` || e.field === `items.${idx}.taxRate`);
                  return (
                     <div
                       key={idx}
                       data-item-idx={idx}
                       draggable={!isFinalized}
                       onDragStart={() => !isFinalized && handleItemDragStart(idx)}
                       onDragOver={(e) => !isFinalized && handleItemDragOver(e, idx)}
                       className={cn(
                         "grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-md bg-surface transition-colors",
                         hasError && "border-error-border bg-error-bg",
                       )}
                     >
                      <div className="col-span-4 flex items-end gap-1">
                        <button
                          type="button"
                          className="mt-4 p-1 text-tertiary hover:text-primary cursor-grab active:cursor-grabbing md:group"
                          title="Drag to reorder"
                          aria-label="Drag handle"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <div className="flex-1">
                          <FormField
                            label="Description"
                            value={item.description}
                            onChange={(e) => updateItem(idx, "description", e.target.value)}
                            disabled={isFinalized}
                            helperText={item.description ? "" : "Required"}
                            error={validation.errors.find((e) => e.field === `items.${idx}.description`)?.message}
                          />
                        </div>
                      </div>
                      <div className="col-span-1">
                        <FormField
                          label="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          disabled={isFinalized}
                          error={validation.errors.find((e) => e.field === `items.${idx}.quantity`)?.message}
                        />
                      </div>
                      <div className="col-span-1">
                        <FormField
                          label="Unit"
                          select
                          value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          disabled={isFinalized}
                        >
                          {["each", "hour", "day", "week", "month", "fixed", "custom"].map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </FormField>
                      </div>
                      <div className="col-span-2">
                        <FormField
                          label="Unit Price"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                          disabled={isFinalized}
                          error={validation.errors.find((e) => e.field === `items.${idx}.unitPrice`)?.message}
                        />
                      </div>
                      <div className="col-span-1">
                        <FormField
                          label="Tax"
                          select
                          value={item.taxName || item.taxRate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.startsWith("preset:")) {
                              const rateObj = taxRates.find((t) => t.id === val.replace("preset:", ""));
                              updateItem(idx, "taxRate", rateObj?.rate ?? "0");
                              updateItem(idx, "taxName", rateObj?.name ?? "");
                            } else {
                              updateItem(idx, "taxRate", val);
                              updateItem(idx, "taxName", "");
                            }
                          }}
                          disabled={isFinalized}
                        >
                          <option value="0">None (0%)</option>
                          {taxRates.filter((t) => t.enabled).map((t) => (
                            <option key={t.id} value={`preset:${t.id}`}>
                              {t.name} ({formatTaxRate(t.rate)})
                            </option>
                          ))}
                          <option value={item.taxRate || "0"}>Custom: {formatTaxRate(item.taxRate)}</option>
                        </FormField>
                      </div>
                      <div className="col-span-1">
                        <FormField
                          label="Disc"
                          value={item.discount}
                          onChange={(e) => updateItem(idx, "discount", e.target.value)}
                          disabled={isFinalized}
                        />
                      </div>
                      <div className="col-span-1">
                        <FormField
                          label="Disc Type"
                          select
                          value={item.discountType}
                          onChange={(e) =>
                            updateItem(idx, "discountType", e.target.value as "fixed" | "percentage")
                          }
                          disabled={isFinalized}
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">$</option>
                        </FormField>
                      </div>
                      {!isFinalized && (
                        <div className="col-span-1 flex flex-col gap-1">
                          <label className="text-xs font-medium text-tertiary uppercase">Actions</label>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicateItem(idx)}
                              className="p-1 text-tertiary hover:text-primary hover:bg-surface-alt rounded"
                              title="Duplicate line item"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-error hover:bg-error/10 rounded"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="col-span-1 text-right">
                        <div className="text-xs text-tertiary">Line Total</div>
                        <div className="font-medium font-tabular-nums">
                          {calcResult?.lineItems[idx]
                            ? formatCurrency(calcResult.lineItems[idx].lineTotal.toFixed(), state.currency)
                            : "$0.00"}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!isFinalized && (
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary font-medium"
                  >
                    <Plus className="h-4 w-4" /> Add Line Item
                  </button>
                )}
              </div>
            </div>

            {/* Discount & Fees */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Quote Discount"
                value={state.quoteDiscount}
                onChange={(e) => setDirtyState((prev) => ({ ...prev, quoteDiscount: e.target.value }))}
                disabled={isFinalized}
              />
              <FormField
                label="Discount Type"
                select
                value={state.quoteDiscountType}
                onChange={(e) =>
                  setDirtyState((prev) => ({
                    ...prev,
                    quoteDiscountType: e.target.value as "fixed" | "percentage",
                  }))
                }
                disabled={isFinalized}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </FormField>
            </div>

            {state.fees.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-primary mb-2">Fees</h3>
                <div className="space-y-2">
                  {state.fees.map((fee, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-md">
                      <div className="col-span-5">
                        <FormField
                          label="Description"
                          value={fee.description}
                          onChange={(e) => updateFee(idx, "description", e.target.value)}
                          disabled={isFinalized}
                        />
                      </div>
                      <div className="col-span-2">
                        <FormField
                          label="Amount"
                          value={fee.amount}
                          onChange={(e) => updateFee(idx, "amount", e.target.value)}
                          disabled={isFinalized}
                        />
                      </div>
                      <div className="col-span-2">
                        <FormField
                          label="Tax %"
                          value={fee.taxRate}
                          onChange={(e) => updateFee(idx, "taxRate", e.target.value)}
                          disabled={isFinalized}
                        />
                      </div>
                      {!isFinalized && (
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
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isFinalized && (
              <button
                type="button"
                onClick={addFee}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary font-medium"
              >
                <Plus className="h-4 w-4" /> Add Fee
              </button>
            )}

            {/* Notes & Terms */}
            <div className="space-y-3">
              <FormTextareaField
                label="Scope of Work"
                placeholder="Describe the scope of work..."
                value={state.scopeOfWork}
                onChange={(e) => setDirtyState((prev) => ({ ...prev, scopeOfWork: e.target.value }))}
                disabled={isFinalized}
              />
              <FormTextareaField
                label="Notes"
                placeholder="Additional notes for the customer..."
                value={state.notes}
                onChange={(e) => setDirtyState((prev) => ({ ...prev, notes: e.target.value }))}
                disabled={isFinalized}
              />
              <FormTextareaField
                label="Terms"
                placeholder="Quote terms..."
                value={state.terms}
                onChange={(e) => setDirtyState((prev) => ({ ...prev, terms: e.target.value }))}
                disabled={isFinalized}
              />
              <FormTextareaField
                label="Payment Instructions"
                placeholder="How should the customer pay..."
                value={state.paymentInstructions}
                onChange={(e) => setDirtyState((prev) => ({ ...prev, paymentInstructions: e.target.value }))}
                disabled={isFinalized}
              />
            </div>
          </div>

          {/* Preview Panel */}
          <div className="overflow-y-auto">
              <DocumentPreview
                documentType="quote"
                documentNumber={quote?.quote_number}
                calcResult={calcResult}
                business={business}
                issueDate={state.issueDate}
                expiryDate={state.expiryDate}
                customerId={state.customerId}
                customers={customers}
                notes={state.notes}
                terms={state.terms}
                paymentInstructions={state.paymentInstructions}
                scopeOfWork={state.scopeOfWork}
                depositType={state.depositType}
                depositValue={state.depositValue}
                depositDueDate={state.depositDueDate}
                depositPaid={false}
                signedAmounts={false}
              />
          </div>
        </div>
      </div>

      {/* Send Dialog */}
      {sendDialogOpen && quote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSendDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">Send Quote</h3>
            <div className="space-y-3">
              <FormField
                label="To"
                type="email"
                placeholder={quote.customer_email ?? "customer@example.com"}
                value={sendData.to}
                onChange={(e) => setSendData((prev) => ({ ...prev, to: e.target.value }))}
              />
              <FormField
                label="Subject"
                placeholder={`Quote #${quote.quote_number ?? ""}`}
                value={sendData.subject}
                onChange={(e) => setSendData((prev) => ({ ...prev, subject: e.target.value }))}
              />
              <FormTextareaField
                label="Message"
                placeholder="Hi, please find your quote attached."
                value={sendData.message}
                onChange={(e) => setSendData((prev) => ({ ...prev, message: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setSendDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={isSending}
                onClick={confirmSend}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Review & Send Dialog */}
      {reviewDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setReviewDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">Review &amp; Send</h3>

            {validation.hasBlockingErrors && (
              <div className="mb-4 p-3 rounded-md bg-error/10 border border-error-border">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-error-text flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-error-text">Please fix these issues before sending:</p>
                    <ul className="mt-1 list-disc list-inside text-sm text-error-text">
                      {validation.errors.map((err) => (
                        <li key={err.field}>{err.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="mb-4 p-3 rounded-md bg-warning-bg border border-warning-border">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning-text flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-warning-text">Warnings (you can still proceed):</p>
                    <ul className="mt-1 list-disc list-inside text-sm text-warning-text">
                      {validation.warnings.map((w) => (
                        <li key={w.field}>{w.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 p-4 border border-border rounded-lg bg-surface-alt">
              <h4 className="text-sm font-medium text-primary mb-2">Estimated Total</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-tertiary">Subtotal</span>
                  <span className="font-tabular-nums">
                    {calcResult ? formatCurrency(calcResult.subtotal.toFixed(), state.currency) : "$0.00"}
                  </span>
                </div>
                {Number(state.quoteDiscount) > 0 && calcResult && (
                  <div className="flex justify-between text-success-text">
                    <span>Discount</span>
                    <span>-{formatCurrency(calcResult.discountTotal.toFixed(), state.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-tertiary">Tax</span>
                  <span className="font-tabular-nums">
                    {calcResult ? formatCurrency(calcResult.taxTotal.toFixed(), state.currency) : "$0.00"}
                  </span>
                </div>
                {state.fees.length > 0 && calcResult && (
                  <div className="flex justify-between">
                    <span className="text-tertiary">Fees</span>
                    <span className="font-tabular-nums">
                      {formatCurrency(calcResult.feeTotal.toFixed(), state.currency)}
                    </span>
                  </div>
                )}
                {state.depositType !== "none" && (
                  <div className="flex justify-between text-primary font-medium">
                    <span>Deposit Required</span>
                    <span>
                      {state.depositType === "percentage"
                        ? `${state.depositValue}%`
                        : formatCurrency(state.depositValue, state.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-border pt-2 mt-2">
                  <span>Estimated Total</span>
                  <span className="font-tabular-nums">
                    {calcResult ? formatCurrency(calcResult.total.toFixed(), state.currency) : "$0.00"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setReviewDialogOpen(false)}>
                Back
              </Button>
              {validation.hasBlockingErrors ? (
                <Button variant="primary" size="sm" onClick={() => setReviewDialogOpen(false)}>
                  Fix and Continue
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileText className="h-4 w-4" />}
                  loading={isFinalizing}
                  onClick={() => {
                    handleFinalizeAndSend();
                    setTimeout(() => setSendDialogOpen(true), 500);
                  }}
                >
                  Finalize &amp; Send
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
