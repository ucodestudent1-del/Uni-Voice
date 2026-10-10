import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Download, FileText, Mail, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import { calculationEngine } from "@/utils/calculation";
import {
  formatCurrency,
  fromPercentage,
  toPercent,
} from "@/utils/format";
import { getCurrencyMetadata } from "@/types/currency";
import {
  createQuote,
  finalizeQuote,
  getCustomers,
  sendQuote,
  getQuote,
  getQuotePdf,
  updateQuote,
  type QuoteCreateInput,
} from "@/api/client";
import type { ApiCustomer, ApiQuote } from "@/types/api";
import CustomerSelector from "./CustomerSelector";
import { Button } from "./ui/Button";
import { FormField, FormTextareaField } from "./ui/FormField";
import { DisclosureSection } from "./ui/DisclosureSection";
import EmptyState from "@/components/ui/EmptyState";

export type QuoteLineItem = {
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

export type QuoteFee = {
  description: string;
  amount: string;
  taxRate?: string;
  taxName?: string | null;
};

export interface QuoteDraftData {
  customerId?: string | null;
  customer?: ApiCustomer | null;
  currency: string;
  issueDate?: string | null;
  dueDate?: string | null;
  expiryDate?: string | null;
  items: QuoteLineItem[];
  fees: QuoteFee[];
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  scopeOfWork?: string | null;
  depositType?: "none" | "percentage" | "fixed";
  depositValue?: string | null;
  depositDueDate?: string | null;
  taxRate?: string | null;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function parseDecimal(value: string | number | undefined | null): Decimal {
  return new Decimal(value ?? 0);
}

function quoteToCalcInput(data: QuoteDraftData) {
  const lineItems = data.items.map((it) => ({
    description: it.description || "",
    quantity: it.quantity || "1",
    unit: it.unit || "each",
    unitPrice: it.unitPrice || "0",
    discount:
      it.discount && !parseDecimal(it.discount).isZero()
        ? { type: it.discountType ?? "fixed", value: it.discount }
        : undefined,
    taxRate: it.taxRate ?? data.taxRate ?? "0",
    tax_name: it.taxName ?? null,
    isTaxInclusive: it.isTaxInclusive ?? false,
  }));
  const fees = data.fees.map((f) => ({
    description: f.description,
    amount: f.amount,
    taxRate: f.taxRate ?? "0",
    tax_name: f.taxName ?? null,
  }));
  return {
    currency: data.currency as any,
    lineItems,
    fees: fees.length ? fees : undefined,
    amountPaid: "0",
  };
}

export default function QuoteWorkspace({ quoteId }: { quoteId?: string }) {
  const isEditing = Boolean(quoteId);

  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [data, setData] = useState<QuoteDraftData>({
    customerId: undefined,
    customer: null,
    currency: "USD",
    issueDate: todayISO(),
    dueDate: addDaysISO(todayISO(), 14),
    expiryDate: addDaysISO(todayISO(), 30),
    items: [],
    fees: [],
    notes: "",
    terms: "",
    paymentInstructions: "",
    scopeOfWork: "",
    depositType: "none",
    depositValue: "0",
    depositDueDate: null,
    taxRate: "0",
  });

  const [action, setAction] = useState<{ type: "saving" | "success" | "error" | "info"; text: string } | null>(null);
  const [finalizedQuoteId, setFinalizedQuoteId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    if (isEditing && quoteId) {
      loadQuote();
    }
  }, [quoteId, isEditing]);

  async function loadContext() {
    setLoadingContext(true);
    setContextError(null);
    try {
      const customerRes = await getCustomers({ limit: 100, includeArchived: false });
      setCustomers(customerRes.data ?? customerRes.customers ?? []);
    } catch (err: any) {
      setContextError(err.response?.data?.error || "Could not load customer data");
    } finally {
      setLoadingContext(false);
    }
  }

  async function loadQuote() {
    if (!quoteId) return;
    setLoadingContext(true);
    try {
      const quoteRes = await getQuote(quoteId);
      const q: ApiQuote = quoteRes.quote;
      if (!q) return;
      setData((prev) => ({
        ...prev,
        customerId: q.customer_id ?? null,
        currency: q.currency,
        issueDate: q.issue_date ? q.issue_date.split("T")[0] : prev.issueDate,
        dueDate: q.due_date ? q.due_date.split("T")[0] : prev.dueDate,
        expiryDate: q.expiry_date ? q.expiry_date.split("T")[0] : prev.expiryDate,
        items: (q.items ?? []).map((it) => ({
          id: it.id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit || "each",
          unitPrice: it.unit_price,
          discount: it.discount ? String(it.discount) : "",
          discountType: it.discount_type ?? "fixed",
          taxRate: it.tax_rate,
          taxName: it.tax_name ?? null,
          isTaxInclusive: it.is_tax_inclusive ?? false,
          productId: it.product_id ?? null,
        })),
        fees: (q.fees ?? []).map((f) => ({
          description: f.description,
          amount: f.amount,
          taxRate: f.tax_rate,
          taxName: null,
        })),
        notes: q.notes ?? "",
        terms: q.terms ?? "",
        paymentInstructions: q.payment_instructions ?? "",
        scopeOfWork: q.scope_of_work ?? "",
        depositType: (q.deposit_type ?? "none") as any,
        depositValue: q.deposit_value ?? "0",
        depositDueDate: q.deposit_due_date ?? null,
      }));
      setFinalizedQuoteId(q.id);
    } catch (err: any) {
      setAction({ type: "error", text: err.response?.data?.error || "Could not load quote" });
     } finally {
      setLoadingContext(false);
    }
  }

  const calc = useMemo(() => {
    try {
      return calculationEngine.calculate(quoteToCalcInput(data));
    } catch {
      return null;
    }
  }, [data.items, data.fees, data.currency, data.taxRate]);

  function updateData(patch: Partial<QuoteDraftData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  function handleItemChange(index: number, patch: Partial<QuoteLineItem>) {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));
  }

  function handleAddItem() {
    setData((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: "1", unit: "each", unitPrice: "", discount: "", discountType: "fixed", taxRate: data.taxRate ?? "0", isTaxInclusive: false, productId: null }],
    }));
  }

  function handleRemoveItem(index: number) {
    setData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  function handleDuplicateItem(index: number) {
    const item = data.items[index];
    setData((prev) => ({
      ...prev,
      items: [...prev.items, { ...item, id: undefined }],
    }));
  }

  function handleFeeChange(index: number, field: keyof QuoteFee, value: string) {
    setData((prev) => ({
      ...prev,
      fees: prev.fees.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
    }));
  }

  function handleAddFee() {
    setData((prev) => ({
      ...prev,
      fees: [...prev.fees, { description: "", amount: "0", taxRate: data.taxRate ?? "0", taxName: null }],
    }));
  }

  function handleRemoveFee(index: number) {
    setData((prev) => ({ ...prev, fees: prev.fees.filter((_, i) => i !== index) }));
  }

  function validateForm(): string | null {
    if (!data.customerId) return "Please select a customer";
    if (data.items.length === 0) return "Add at least one line item";
    const hasEmpty = data.items.some((it) => !it.description.trim() || !it.unitPrice || Number(it.unitPrice) <= 0);
    if (hasEmpty) return "All line items must have a description and price";
    if (!data.issueDate || !data.dueDate) return "Set issue and due dates";
    if (!data.expiryDate) return "Set a quote expiry date";
    return null;
  }

  async function handleSaveDraft() {
    const error = validateForm();
    if (error && !data.customerId) {
      setAction({ type: "error", text: error });
      return;
    }
    setAction({ type: "saving", text: "Saving..." });
    try {
      let qid: string | null = finalizedQuoteId;
      if (!qid) {
        const created = await createQuote(buildQuotePayload());
        qid = created.quoteId;
        setFinalizedQuoteId(qid);
        updateData({ issueDate: todayISO() });
      } else {
        await updateQuote(qid, buildQuotePayload());
      }
      setAction({ type: "success", text: "Draft saved." });
    } catch (err: any) {
      setAction({ type: "error", text: err.response?.data?.error || "Could not save quote" });
    }
  }

  async function handleFinalizeAndSend() {
    const error = validateForm();
    if (error) {
      setAction({ type: "error", text: error });
      return;
    }
    setShowFinalizeDialog(false);
    setAction({ type: "saving", text: "Saving quote..." });
    try {
      let qid: string | null = finalizedQuoteId;
      if (!qid) {
        const created = await createQuote(buildQuotePayload());
        qid = created.quoteId;
        setFinalizedQuoteId(qid);
      } else {
        await updateQuote(qid, buildQuotePayload());
      }
      setAction({ type: "saving", text: "Finalizing quote..." });
      const finalizeRes = await finalizeQuote(qid!);
      const quoteNumber = finalizeRes.quoteNumber;
      setAction({ type: "saving", text: "Sending quote..." });
      const sentRes = await sendQuote(qid!);
      setPublicToken(sentRes.publicToken ?? null);
      setAction({ type: "success", text: `Quote ${quoteNumber} sent successfully` });
    } catch (err: any) {
      setAction({ type: "error", text: err.response?.data?.error || err.message || "Could not finalize quote" });
    }
  }

  function buildQuotePayload(): QuoteCreateInput {
    return {
      customerId: data.customerId,
      currency: data.currency,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      expiryDate: data.expiryDate,
      notes: data.notes || undefined,
      terms: data.terms || undefined,
      paymentInstructions: data.paymentInstructions || undefined,
      scopeOfWork: data.scopeOfWork || undefined,
      items: data.items.map((it) => ({
        productId: it.productId ?? null,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discount: it.discount ? Number(it.discount) : 0,
        discountType: it.discountType ?? "fixed",
        taxRate: Number(it.taxRate ?? data.taxRate ?? "0"),
        isTaxInclusive: it.isTaxInclusive ?? false,
      })),
      fees: data.fees.map((f) => ({
        description: f.description,
        amount: f.amount,
        taxRate: f.taxRate,
        taxName: f.taxName,
      })),
      depositType: data.depositType,
      depositValue: data.depositValue ?? "0",
      depositDueDate: data.depositDueDate,
    };
  }

  function handleSendEmail() {
    if (!publicToken) return;
    window.open(`${window.location.origin}/quote/${publicToken}`, "_blank");
  }

  function handleDownloadPdf() {
    if (!finalizedQuoteId) return;
    getQuotePdf(finalizedQuoteId)
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `quote-${finalizedQuoteId}.pdf`;
        anchor.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => setAction({ type: "error", text: "Could not download PDF" }));
  }

  const currency = data.currency;
  const meta = getCurrencyMetadata(currency);

  if (loadingContext) {
    return (
      <EmptyState
        variant="loading"
        title="Loading quote workspace..."
        description="Fetching your business and customer data"
        className="mx-auto max-w-3xl p-4 sm:p-6"
      />
    );
  }

  if (contextError) {
    return (
      <EmptyState
        variant="error"
        title="Could not start quote"
        description={contextError}
        actionLabel="Try again"
        onAction={loadContext}
        className="mx-auto max-w-md p-4"
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/app/quotes"
          className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotes
        </Link>
        <div className="flex items-center gap-2 text-xs text-secondary">
          <span className="font-medium text-primary-brand">Customer</span>
          <span>•</span>
          <span className="font-medium text-primary-brand">Services</span>
          <span>•</span>
          <span className="font-medium text-primary-brand">Pricing</span>
          <span>•</span>
          <span className="font-medium text-primary-brand">Details</span>
        </div>
      </div>

      {action && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            action.type === "error"
              ? "status-error-border status-error-bg status-error-text"
              : action.type === "success"
              ? "status-success-border status-success-bg status-success-text"
              : "status-info-border status-info-bg status-info-text"
          }`}
        >
          {action.text}
          {action.type === "success" && finalizedQuoteId && (
            <div className="mt-2 flex gap-2">
              <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleDownloadPdf}>
                Download PDF
              </Button>
              {publicToken && (
                <Button variant="ghost" size="sm" icon={<Mail className="h-4 w-4" />} onClick={handleSendEmail}>
                  View Online
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Customer Section */}
      <section className="rounded-xl border border-color bg-surface p-4 sm:p-6">
        <h2 className="mb-4 text-xl font-bold text-primary">Customer</h2>
        <CustomerSelector
          value={data.customerId ?? undefined}
          onChange={(customerId) => {
            updateData({ customerId, customer: customerId ? customers.find((c) => c.id === customerId) ?? null : null });
          }}
          onCustomerChange={(customer) => {
            updateData({ customer: customer ?? null, customerId: customer?.id ?? undefined });
          }}
          placeholder="Select or add a customer"
          preloadedCustomers={customers}
        />
        {data.customer && (
          <div className="mt-3 rounded-lg bg-surface-alt p-3 text-sm">
            <span className="font-medium text-primary">{data.customer.name}</span>
            {data.customer.email && <span> • {data.customer.email}</span>}
          </div>
        )}
      </section>

      {/* Line Items Section */}
      <section className="rounded-xl border border-color bg-surface p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">Services &amp; Products</h2>
          <Button variant="ghost" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddItem}>
            Add Item
          </Button>
        </div>

        {data.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-color-subtle bg-surface-alt py-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-tertiary/40" />
            <h3 className="mt-3 text-sm font-semibold text-primary">No line items added yet</h3>
            <p className="mt-1 max-w-sm text-center text-xs text-tertiary">
              Add a product or service so your quote has something to charge for.
            </p>
            <div className="mt-5">
              <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddItem}>
                Add a line item
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((item, i) => (
              <QuoteLineItemCard
                key={item.id ?? `li_${i}`}
                item={item}
                index={i}
                currency={currency}
                meta={meta}
                step={meta.decimalPlaces === 0 ? "1" : "0.01"}
                defaultTaxRate={data.taxRate ?? "0"}
                onItemChange={handleItemChange}
                onDuplicate={handleDuplicateItem}
                onRemove={handleRemoveItem}
              />
            ))}
          </div>
        )}

        {data.items.length > 0 && (
          <button
            type="button"
            onClick={handleAddItem}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-color bg-surface-alt px-3 py-1.5 text-sm text-secondary hover:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add another line
          </button>
        )}
      </section>

      {/* Pricing & Dates Section */}
      <section className="rounded-xl border border-color bg-surface p-4 sm:p-6">
        <h2 className="mb-4 text-xl font-bold text-primary">Pricing &amp; Dates</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Issue Date"
            labelClassName="uppercase"
            type="date"
            value={data.issueDate ?? ""}
            onChange={(e) => updateData({ issueDate: e.target.value })}
          />
          <FormField
            label="Due Date"
            labelClassName="uppercase"
            type="date"
            value={data.dueDate ?? ""}
            onChange={(e) => updateData({ dueDate: e.target.value })}
          />
        </div>

        <FormField
          label="Quote Valid Until"
          labelClassName="uppercase"
          helperText="The date this quote expires. After this date it can no longer be accepted."
          type="date"
          value={data.expiryDate ?? ""}
          onChange={(e) => updateData({ expiryDate: e.target.value })}
        />

        <FormField
          label="Default Tax Rate"
          labelClassName="uppercase"
          type="number"
          value={toPercent(data.taxRate ?? "0")}
          onChange={(e) => updateData({ taxRate: fromPercentage(e.target.value.replace(/[^\d.]/g, "")) })}
          helperText="Applied to line items without a specific tax rate."
        />

        {calc && (
          <div className="mt-4 rounded-xl border border-color bg-surface-alt p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-tertiary">Subtotal</span>
              <span className="font-tabular-nums text-primary">{formatCurrency(calc.subtotal, currency, meta.decimalPlaces)}</span>
            </div>
            {new Decimal(calc.discountTotal).gt(0) && (
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">Discount</span>
                <span className="font-tabular-nums text-success-text">−{formatCurrency(calc.discountTotal, currency, meta.decimalPlaces)}</span>
              </div>
            )}
            {new Decimal(calc.taxTotal).gt(0) && (
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">Tax</span>
                <span className="font-tabular-nums text-primary">{formatCurrency(calc.taxTotal, currency, meta.decimalPlaces)}</span>
              </div>
            )}
            {new Decimal(calc.feeTotal).gt(0) && (
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">Fees</span>
                <span className="font-tabular-nums text-primary">{formatCurrency(calc.feeTotal, currency, meta.decimalPlaces)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-color-subtle pt-3 mt-2">
              <span className="text-base font-semibold text-secondary">Total</span>
              <span className="text-xl font-bold text-primary font-tabular-nums">
                {formatCurrency(calc.total, currency, meta.decimalPlaces)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Deposit & Fees */}
      <DisclosureSection title="Deposit &amp; Additional Fees" defaultOpen={false}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr] sm:items-end">
            <FormField
              label="Deposit Type"
              labelClassName="uppercase"
              select
              value={data.depositType ?? "none"}
              onChange={(e) => updateData({ depositType: e.target.value as any })}
            >
              <option value="none">No deposit required</option>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed amount</option>
            </FormField>
            {data.depositType !== "none" && (
              <FormField
                label="Deposit Value"
                labelClassName="uppercase"
                type="number"
                value={data.depositType === "percentage" ? toPercent(data.depositValue ?? "0") : data.depositValue ?? ""}
                onChange={(e) =>
                  updateData({
                    depositValue:
                      data.depositType === "percentage"
                        ? fromPercentage(e.target.value)
                        : e.target.value,
                  })
                }
                helperText={data.depositType === "percentage" ? "Percentage of total" : undefined}
              />
            )}
          </div>

          {data.depositType !== "none" && (
            <FormField
              label="Deposit Due Date"
              labelClassName="uppercase"
              type="date"
              value={data.depositDueDate ?? ""}
              onChange={(e) => updateData({ depositDueDate: e.target.value || null })}
            />
          )}

          <div className="border-t border-color-subtle pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-secondary">Additional Fees</h4>
              <Button variant="secondary" size="sm" icon={<Plus className="h-3 w-3" />} onClick={handleAddFee}>
                Add Fee
              </Button>
            </div>
            {data.fees.length === 0 ? (
              <p className="mt-2 text-xs text-tertiary">No additional fees added.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {data.fees.map((fee, i) => (
                  <div key={`fee_${i}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_100px_auto]">
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
              </div>
            )}
          </div>
        </div>
      </DisclosureSection>

      {/* Scope & Terms Section */}
      <DisclosureSection title="Scope &amp; Terms" defaultOpen={false}>
        <div className="space-y-4">
          <FormTextareaField
            label="Scope of Work"
            labelClassName="uppercase"
            value={data.scopeOfWork ?? ""}
            onChange={(e) => updateData({ scopeOfWork: e.target.value })}
            placeholder="Describe the work or services you are providing..."
            className="min-h-[8rem]"
          />
          <FormTextareaField
            label="Terms &amp; Conditions"
            labelClassName="uppercase"
            value={data.terms ?? ""}
            onChange={(e) => updateData({ terms: e.target.value })}
            placeholder="Payment terms, cancellation policy, etc."
            className="min-h-[6rem]"
          />
          <FormTextareaField
            label="Notes"
            labelClassName="uppercase"
            value={data.notes ?? ""}
            onChange={(e) => updateData({ notes: e.target.value })}
            placeholder="Internal notes visible only to your team"
            className="min-h-[4rem]"
          />
          <FormTextareaField
            label="Payment Instructions"
            labelClassName="uppercase"
            value={data.paymentInstructions ?? ""}
            onChange={(e) => updateData({ paymentInstructions: e.target.value })}
            placeholder="How should the customer pay?"
            className="min-h-[4rem]"
          />
        </div>
      </DisclosureSection>

      {/* Action Footer */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row pt-4 border-t border-color">
        <Button variant="primary" size="lg" onClick={() => setShowFinalizeDialog(true)}>
          <Send className="h-4 w-4" />
          Finalize &amp; Send
        </Button>
        <Button variant="secondary" size="lg" onClick={handleSaveDraft}>
          Save Draft
        </Button>
      </div>

      {/* Finalize Confirmation Dialog */}
      {showFinalizeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-surface shadow-xl">
            <div className="border-b border-color p-6">
              <h2 className="text-xl font-semibold text-primary">Finalize &amp; Send Quote</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-secondary">
                This will finalize the quote and send it to the customer. Once sent, the customer will receive
                a link to view and accept the quote online.
              </p>
              <div className="rounded-lg bg-surface-alt p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-tertiary">Total</span>
                  <span className="font-medium text-primary font-tabular-nums">
                    {calc ? formatCurrency(calc.total, currency, meta.decimalPlaces) : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-tertiary">Customer</span>
                  <span className="font-medium text-primary">{data.customer?.name ?? "—"}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-color p-4 flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowFinalizeDialog(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" icon={<Send className="h-4 w-4" />} onClick={handleFinalizeAndSend}>
                Finalize &amp; Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// QuoteLineItemCard sub-component
interface QuoteLineItemCardProps {
  item: QuoteLineItem;
  index: number;
  currency: string;
  meta: ReturnType<typeof getCurrencyMetadata>;
  step: string;
  defaultTaxRate: string;
  onItemChange: (index: number, patch: Partial<QuoteLineItem>) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
}

function QuoteLineItemCard({
  item,
  index,
  currency,
  meta,
  step,
  defaultTaxRate,
  onItemChange,
  onDuplicate,
  onRemove,
}: QuoteLineItemCardProps) {
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
          placeholder="What did you do?"
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

QuoteLineItemCard.displayName = "QuoteLineItemCard";
