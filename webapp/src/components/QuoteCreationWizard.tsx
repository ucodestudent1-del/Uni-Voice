import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Copy, CreditCard, Download, FileText, Mail, Send, Share2 } from "lucide-react";
import { Decimal } from "decimal.js";
import {
  calculationEngine,
} from "@/utils/calculation";
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

export interface QuoteWizardData {
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

type QuoteStep = "customer" | "items" | "pricing" | "scope" | "review";

const STEP_ORDER: QuoteStep[] = ["customer", "items", "pricing", "scope", "review"];

const STEP_LABELS: Record<QuoteStep, string> = {
  customer: "Customer",
  items: "Services",
  pricing: "Pricing",
  scope: "Scope & Terms",
  review: "Review",
};

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

function quoteToCalcInput(data: QuoteWizardData) {
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

export default function QuoteCreationWizard({ quoteId }: { quoteId?: string }) {
  const navigate = useNavigate();
  const isEditing = Boolean(quoteId);

  // Context data
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  // Wizard state
  const [data, setData] = useState<QuoteWizardData>({
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
  const [currentStep, setCurrentStep] = useState<QuoteStep>("customer");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<{ type: "saving" | "success" | "error" | "info"; text: string } | null>(null);
  const [finalizedQuoteId, setFinalizedQuoteId] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);

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
      const [customerRes] = await Promise.all([
        getCustomers({ limit: 100, includeArchived: false }),
      ]);
      setCustomers(customerRes.data ?? customerRes.customers ?? []);
      setContextError(null);
    } catch (err: any) {
      setContextError(err.response?.data?.error || "Could not load customer data");
    } finally {
      setLoadingContext(false);
    }
  }

  async function loadQuote() {
    if (!quoteId) return;
    setLoading(true);
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
      setLoading(false);
    }
  }

  const calc = useMemo(() => {
    try {
      return calculationEngine.calculate(quoteToCalcInput(data));
    } catch {
      return null;
    }
  }, [data.items, data.fees, data.currency, data.taxRate, calculationEngine]);

  function updateData(patch: Partial<QuoteWizardData>) {
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
      items: [...prev.items, { description: "", quantity: "1", unit: "each", unitPrice: "0", discount: "", discountType: "fixed", taxRate: data.taxRate ?? "0", isTaxInclusive: false, productId: null }],
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

  function validateStep(step: QuoteStep): string | null {
    switch (step) {
      case "customer":
        if (!data.customerId) return "Please select a customer";
        return null;
      case "items":
        if (data.items.length === 0) return "Add at least one line item";
        {
          const hasEmpty = data.items.some((it) => !it.description.trim() || !it.unitPrice || Number(it.unitPrice) <= 0);
          if (hasEmpty) return "All line items must have a description and price";
        }
        return null;
      case "pricing":
        if (!data.issueDate || !data.dueDate) return "Set issue and due dates";
        if (!data.expiryDate) return "Set a quote expiry date";
        return null;
      case "scope":
        return null;
      case "review":
        return null;
      default:
        return null;
    }
  }

  function nextStep() {
    const error = validateStep(currentStep);
    if (error) {
      setAction({ type: "error", text: error });
      return;
    }
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[idx + 1]);
      setAction(null);
    }
  }

  function prevStep() {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(STEP_ORDER[idx - 1]);
    }
  }

  async function handleFinalizeAndSend() {
    const error = validateStep("review");
    if (error) {
      setAction({ type: "error", text: error });
      return;
    }
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
        title="Loading quote wizard..."
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
          {STEP_ORDER.map((step) => (
            <React.Fragment key={step}>
              <span
                className={
                  step === currentStep
                    ? "font-semibold text-primary-brand"
                    : step === "review" && finalizedQuoteId
                    ? "text-success-text"
                    : ""
                }
              >
                {STEP_LABELS[step]}
              </span>
              {step !== "review" && <span>•</span>}
            </React.Fragment>
          ))}
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
        </div>
      )}

      {!finalizedQuoteId && (
        <>
          {currentStep === "customer" && (
            <StepCustomer
              data={data}
              customers={customers}
              onUpdate={updateData}
              onNext={nextStep}
            />
          )}
          {currentStep === "items" && (
            <StepItems
              data={data}
              meta={meta}
              onItemChange={handleItemChange}
              onAdd={handleAddItem}
              onRemove={handleRemoveItem}
              onDuplicate={handleDuplicateItem}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === "pricing" && (
            <StepPricing
              data={data}
              calc={calc}
              currency={currency}
              meta={meta}
              onUpdate={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === "scope" && (
            <StepScope
              data={data}
              onUpdate={updateData}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {currentStep === "review" && (
            <StepReview
              data={data}
              calc={calc}
              currency={currency}
              meta={meta}
              onFinalize={handleFinalizeAndSend}
              onBack={prevStep}
              loading={loading}
            />
          )}
        </>
      )}

      {finalizedQuoteId && action?.type === "success" && (
        <StepDone
          publicToken={publicToken}
          onSendEmail={handleSendEmail}
          onDownloadPdf={handleDownloadPdf}
          onNavigate={() => navigate("/app/quotes")}
        />
      )}
    </div>
  );
}

// Step 1: Customer Details

interface StepCustomerProps {
  data: QuoteWizardData;
  customers: ApiCustomer[];
  onUpdate: (patch: Partial<QuoteWizardData>) => void;
  onNext: () => void;
}

function StepCustomer({ data, customers, onUpdate, onNext }: StepCustomerProps) {
  return (
    <section className="space-y-6">
      <SectionHeader number={1} title="Who is this for?" subtitle="Select the customer receiving the quote" />
      <CustomerSelector
        value={data.customerId ?? undefined}
        onChange={(customerId) => {
          if (!customerId) {
            onUpdate({ customerId: undefined, customer: null });
          } else {
            const customer = customers.find((c) => c.id === customerId) ?? null;
            onUpdate({ customerId, customer });
          }
        }}
        onCustomerChange={(customer) => {
          onUpdate({ customer: customer ?? null, customerId: customer?.id ?? undefined });
        }}
        placeholder="Select or add a customer"
        preloadedCustomers={customers}
      />
      {data.customer && (
        <div className="rounded-lg bg-surface-alt p-3 text-sm">
          <span className="font-medium text-primary">{data.customer.name}</span>
          {data.customer.email && <span> • {data.customer.email}</span>}
        </div>
      )}
      <div className="pt-4">
        <Button variant="primary" size="lg" onClick={onNext} className="w-full">
          Continue
        </Button>
      </div>
    </section>
  );
}

// Step 2: Services / Products
interface StepItemsProps {
  data: QuoteWizardData;
  meta: ReturnType<typeof getCurrencyMetadata>;
  onItemChange: (index: number, patch: Partial<QuoteLineItem>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  onNext: () => void;
  onBack: () => void;
}

function StepItems({ data, meta, onItemChange, onAdd, onRemove, onDuplicate, onNext, onBack }: StepItemsProps) {
  return (
    <section className="space-y-6">
      <SectionHeader number={2} title="What did you do?" subtitle="Add services and products" />
      {data.items.length === 0 ? (
        <EmptyState
          variant="default"
          title="No line items added yet"
          description="Add a product or service so your quote has something to charge for."
          actionLabel="Add a line item"
          onAction={onAdd}
          icon={<FileText />}
        />
      ) : (
        <div className="space-y-2">
          {data.items.map((item, i) => (
            <div
              key={item.id ?? `li_${i}`}
              className="rounded-xl border border-color bg-surface shadow-sm"
            >
              <div className="flex items-center gap-2 p-3">
                <textarea
                  value={item.description}
                  onChange={(e) => onItemChange(i, { description: e.target.value })}
                  placeholder="What did you do?"
                  rows={1}
                  className="flex-1 resize-y border-0 bg-transparent text-sm text-primary placeholder-tertiary focus:outline-none"
                  style={{ minHeight: "2rem", maxHeight: "6rem" }}
                />
                {item.quantity && <span className="w-16 shrink-0 text-right text-sm text-primary font-tabular-nums">{item.quantity}</span>}
                {item.unitPrice && (
                  <span className="w-24 shrink-0 text-right text-sm font-medium text-primary font-tabular-nums">
                    {formatCurrency(item.unitPrice, data.currency)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onDuplicate(i)}
                  title="Duplicate line"
                  className="rounded p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  title="Remove line"
                  className="rounded p-1.5 text-tertiary hover:bg-error-bg hover:text-error-text focus:outline-none focus:ring-1 focus:ring-error"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="border-t border-color-subtle px-3 pb-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_80px_1fr_100px]">
                  <div>
                    <label className="form-label-secondary">Qty</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onItemChange(i, { quantity: e.target.value || "1" })}
                      min={1}
                      step="any"
                      className="form-control-sm w-full text-right font-tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="form-label-secondary">Unit</label>
                    <select
                      value={item.unit}
                      onChange={(e) => onItemChange(i, { unit: e.target.value })}
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
                      onChange={(e) => onItemChange(i, { unitPrice: e.target.value || "0" })}
                      min={0}
                      step={meta.decimalPlaces === 0 ? "1" : "0.01"}
                      className="input-with-prefix w-full text-right font-tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="form-label-secondary">Tax %</label>
                    <div className="mt-1 relative">
                      <input
                        type="number"
                        value={toPercent(item.taxRate ?? "0")}
                        onChange={(e) =>
                          onItemChange(i, { taxRate: fromPercentage(e.target.value.replace(/[^\d.]/g, "")) })
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
                          onChange={(e) => onItemChange(i, { isTaxInclusive: e.target.checked })}
                          className="h-3 w-3 rounded border-input-border text-primary-brand focus:ring-primary"
                        />
                        Inclusive
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-lg border border-color bg-surface-alt px-3 py-1.5 text-sm text-secondary hover:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add another line
      </button>
      <div className="flex flex-col-reverse gap-3 sm:flex-row pt-4">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button variant="primary" onClick={onNext}>Continue</Button>
      </div>
    </section>
  );
}

// Step 3: Pricing & Totals
interface StepPricingProps {
  data: QuoteWizardData;
  calc: ReturnType<typeof calculationEngine.calculate> | null;
  currency: string;
  meta: ReturnType<typeof getCurrencyMetadata>;
  onUpdate: (patch: Partial<QuoteWizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

function StepPricing({ data, calc, currency, meta, onUpdate, onNext, onBack }: StepPricingProps) {
  function handleAddFee() {
    onUpdate({ fees: [...data.fees, { description: "", amount: "0", taxRate: "0", taxName: null }] });
  }
  return (
    <section className="space-y-6">
      <SectionHeader number={3} title="Pricing & Dates" subtitle="Set totals and payment requirements" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label="Issue date"
          type="date"
          value={data.issueDate ?? ""}
          onChange={(e) => onUpdate({ issueDate: e.target.value })}
        />
        <FormField
          label="Due date"
          type="date"
          value={data.dueDate ?? ""}
          onChange={(e) => onUpdate({ dueDate: e.target.value })}
        />
      </div>
      <FormField
        label="Quote valid until"
        helperText="The date this quote expires. After this date it can no longer be accepted."
        type="date"
        value={data.expiryDate ?? ""}
        onChange={(e) => onUpdate({ expiryDate: e.target.value })}
      />
      <FormField
        label="Tax rate (default)"
        type="number"
        value={toPercent(data.taxRate ?? "0")}
        onChange={(e) => onUpdate({ taxRate: fromPercentage(e.target.value) })}
        helperText="Applied to line items without a specific tax rate."
      />

      {calc && (
        <div className="rounded-xl border border-color bg-surface p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-tertiary">Subtotal</span>
            <span className="font-tabular-nums text-primary">{formatCurrency(calc.subtotal, currency, meta.decimalPlaces)}</span>
          </div>
          {new Decimal(calc.discountTotal).gt(0) && (
            <div className="flex justify-between text-sm">
              <span className="text-tertiary">Discount</span>
              <span className="font-tabular-nums text-success-text">−’{formatCurrency(calc.discountTotal, currency, meta.decimalPlaces)}</span>
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

      <DisclosureSection title="Quote deposits & fees" defaultOpen={false}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr] sm:items-end">
            <div>
              <FormField
                label="Deposit type"
                select
                value={data.depositType ?? "none"}
                onChange={(e) => onUpdate({ depositType: e.target.value as any })}
              >
                <option value="none">No deposit required</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount</option>
              </FormField>
            </div>
            {data.depositType !== "none" && (
              <div>
                <FormField
                  label="Deposit value"
                  type="number"
                  value={data.depositType === "percentage" ? toPercent(data.depositValue ?? "0") : data.depositValue ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      depositValue:
                        data.depositType === "percentage"
                          ? fromPercentage(e.target.value)
                          : e.target.value,
                    })
                  }
                  helperText={data.depositType === "percentage" ? "Percentage of total" : undefined}
                />
              </div>
            )}
          </div>
          {data.depositType !== "none" && (
            <FormField
              label="Deposit due date"
              type="date"
              value={data.depositDueDate ?? ""}
              onChange={(e) => onUpdate({ depositDueDate: e.target.value || null })}
            />
          )}

          <div className="border-t border-color-subtle pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-secondary">Additional fees</h4>
              <Button variant="secondary" size="sm" onClick={handleAddFee}>
                <PlusIcon className="h-3 w-3" /> Add fee
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
                      onChange={(e) => onUpdate({ fees: data.fees.map((f, j) => (j === i ? { ...f, description: e.target.value } : f)) })}
                    />
                    <FormField
                      label="Amount"
                      type="number"
                      value={fee.amount}
                      onChange={(e) => onUpdate({ fees: data.fees.map((f, j) => (j === i ? { ...f, amount: e.target.value } : f)) })}
                    />
                    <FormField
                      label="Tax %"
                      type="number"
                      value={toPercent(fee.taxRate ?? "0")}
                      onChange={(e) => onUpdate({ fees: data.fees.map((f, j) => (j === i ? { ...f, taxRate: fromPercentage(e.target.value) } : f)) })}
                    />
                    <div className="flex items-end">
                      <Button variant="ghost" size="sm" onClick={() => onUpdate({ fees: data.fees.filter((_, j) => j !== i) })}>
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DisclosureSection>

      <div className="flex flex-col-reverse gap-3 sm:flex-row pt-4">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button variant="primary" onClick={onNext}>Continue</Button>
      </div>
    </section>
  );
}

// Step 4: Scope & Terms
interface StepScopeProps {
  data: QuoteWizardData;
  onUpdate: (patch: Partial<QuoteWizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

function StepScope({ data, onUpdate, onNext, onBack }: StepScopeProps) {
  return (
    <section className="space-y-6">
      <SectionHeader number={4} title="Scope & Terms" subtitle="Describe the work and set payment terms" />
      <FormTextareaField
        label="Scope of work"
        value={data.scopeOfWork ?? ""}
        onChange={(e) => onUpdate({ scopeOfWork: e.target.value })}
        placeholder="Describe the work or services you are providing..."
        className="min-h-[8rem]"
      />
      <FormTextareaField
        label="Terms & conditions"
        value={data.terms ?? ""}
        onChange={(e) => onUpdate({ terms: e.target.value })}
        placeholder="Payment terms, cancellation policy, etc."
        className="min-h-[6rem]"
      />
      <FormTextareaField
        label="Notes (internal)"
        value={data.notes ?? ""}
        onChange={(e) => onUpdate({ notes: e.target.value })}
        placeholder="Internal notes visible only to your team"
        className="min-h-[4rem]"
      />
      <FormTextareaField
        label="Payment instructions"
        value={data.paymentInstructions ?? ""}
        onChange={(e) => onUpdate({ paymentInstructions: e.target.value })}
        placeholder="How should the customer pay?"
        className="min-h-[4rem]"
      />
      <div className="flex flex-col-reverse gap-3 sm:flex-row pt-4">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button variant="primary" onClick={onNext}>Continue</Button>
      </div>
    </section>
  );
}

// Step 5: Review & Send
interface StepReviewProps {
  data: QuoteWizardData;
  calc: ReturnType<typeof calculationEngine.calculate> | null;
  currency: string;
  meta: ReturnType<typeof getCurrencyMetadata>;
  onFinalize: () => void;
  onBack: () => void;
  loading: boolean;
}

function StepReview({ data, calc, currency, meta, onFinalize, onBack, loading }: StepReviewProps) {
  return (
    <section className="space-y-6">
      <SectionHeader number={5} title="Review & Send" subtitle="Confirm everything looks correct" />
      <div className="rounded-xl border border-color bg-surface p-6 space-y-4">
        <div>
          <p className="text-sm text-tertiary">Customer</p>
          <p className="font-medium text-primary">{data.customer?.name ?? "—"}</p>
          {data.customer?.email && <p className="text-sm text-secondary">{data.customer.email}</p>}
        </div>
        <div>
          <p className="text-sm text-tertiary">Issue date</p>
          <p className="font-medium text-primary">{data.issueDate ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-tertiary">Due date</p>
          <p className="font-medium text-primary">{data.dueDate ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-tertiary">Valid until</p>
          <p className="font-medium text-primary">{data.expiryDate ?? "—"}</p>
        </div>
        {calc && (
          <div className="border-t border-color-subtle pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-tertiary">Subtotal</span>
              <span className="font-tabular-nums text-primary">{formatCurrency(calc.subtotal, currency, meta.decimalPlaces)}</span>
            </div>
            {new Decimal(calc.taxTotal).gt(0) && (
              <div className="flex justify-between text-sm">
                <span className="text-tertiary">Tax</span>
                <span className="font-tabular-nums text-primary">{formatCurrency(calc.taxTotal, currency, meta.decimalPlaces)}</span>
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
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <Button variant="primary" size="lg" onClick={onFinalize} loading={loading} disabled={loading}>
          <Send className="h-4 w-4" />
          Finalize & Send
        </Button>
      </div>
    </section>
  );
}

// Done state
interface StepDoneProps {
  publicToken: string | null;
  onSendEmail: () => void;
  onDownloadPdf: () => void;
  onNavigate: () => void;
}

function StepDone({ publicToken, onSendEmail, onDownloadPdf, onNavigate }: StepDoneProps) {
  return (
    <section className="space-y-6">
      <section className="rounded-xl border status-success-border status-success-bg p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full status-success-bg status-success-text">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="mt-3 text-xl font-bold text-primary">Quote is ready</h1>
        <p className="mt-1 text-sm text-secondary">The quote has been finalized and sent to the customer.</p>
        {publicToken && (
          <a
            href={`${window.location.origin}/quote/${publicToken}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-action px-6 py-3 text-sm font-semibold text-on-primary shadow-md hover:bg-primary-hover hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <CreditCard className="h-5 w-5" />
            Open customer view
          </a>
        )}
      </section>
      <section className="rounded-xl border border-color-subtle bg-surface p-4 sm:p-6">
        <h2 className="text-lg font-bold text-primary">Send or share</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={onSendEmail} icon={<Mail className="h-4 w-4" />}>
            Send by email
          </Button>
          <Button variant="secondary" onClick={onDownloadPdf} icon={<Download className="h-4 w-4" />}>
            Download PDF
          </Button>
          <Button variant="secondary" onClick={() => publicToken && navigator.clipboard.writeText(`${window.location.origin}/quote/${publicToken}`)}>
            <Share2 className="h-4 w-4" /> Share link
          </Button>
          <Link to="/app/quotes" className="flex items-center justify-center gap-2 rounded-lg border border-input-border px-4 py-3 text-sm font-medium text-secondary hover:bg-surface-alt">
            All quotes
          </Link>
        </div>
        {publicToken && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-alt p-3">
            <Copy className="h-4 w-4 flex-shrink-0 text-secondary" />
            <span className="min-w-0 flex-1 truncate text-xs text-secondary">
              {`${window.location.origin}/quote/${publicToken}`}
            </span>
          </div>
        )}
      </section>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onNavigate}>Done</Button>
      </div>
    </section>
  );
}

// Reusable helpers

function SectionHeader({ number, title, subtitle }: { number: number; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-bg text-primary-brand">
        {number}
      </span>
      <div>
        <h1 className="text-xl font-bold text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
      </div>
    </div>
  );
}

function PlusIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v2" />
    </svg>
  );
}




