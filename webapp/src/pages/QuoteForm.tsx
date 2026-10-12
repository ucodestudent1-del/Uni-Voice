import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getQuote,
  createQuote,
  updateQuote,
  finalizeQuote,
  sendQuote,
  duplicateQuote,
  convertToInvoice,
  getQuotePdf,
  getQuoteShareLink,
  getCustomers,
  getBusiness,
  getTaxRates,
  type CreateQuoteInput,
  type CreateQuoteItemInput,
  type CreateQuoteFeeInput,
} from "@/api/client";
import {
  CalculationEngine,
  type InvoiceCalculationInput,
  type LineItemInput,
  type FeeInput,
} from "@/utils/calculation";
import { type CurrencyCode, SUPPORTED_CURRENCIES } from "@/types/currency";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Button,
  FormField,
  FormTextareaField,
  PageHeader,
} from "@/components/ui";
import { Save, Send, Plus, Trash2, FileText, Copy, Tag } from "lucide-react";
import { Decimal } from "decimal.js";
import DocumentPreview from "@/components/DocumentPreview";
import type {
  ApiQuote,
  ApiQuoteItem,
  ApiQuoteFee,
  ApiBusiness,
  ApiCustomer,
  ApiTaxRate,
} from "@/types/api";
import { formatTaxRate } from "@/utils/format";

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
  productId: string | null;
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
    productId: null,
  };
}

interface LocalFee {
  description: string;
  amount: string;
  taxRate: string;
  taxName: string;
}

interface LocalState {
  customerId: string;
  currency: string;
  issueDate: string;
  expiryDate: string;
  terms: string;
  notes: string;
  scopeOfWork: string;
  internalNotes: string;
  paymentInstructions: string;
  items: LocalItem[];
  fees: LocalFee[];
  quoteDiscount: string;
  quoteDiscountType: "fixed" | "percentage";
  depositType: "none" | "percentage" | "fixed";
  depositValue: string;
  depositDueDate: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface TaxRateOption {
  value: string;
  label: string;
  taxId: string;
  rate: string;
  name: string;
}

function buildTaxRateOptions(taxRates: ApiTaxRate[]): TaxRateOption[] {
  const opts: TaxRateOption[] = [
    { value: "0", label: "0.00% — Exempt", taxId: "", rate: "0", name: "" },
  ];
  for (const t of taxRates.filter((t) => t.enabled)) {
    const label = formatTaxRate(t.rate) + (t.name ? ` (${t.name})` : "");
    opts.push({
      value: String(t.rate),
      label,
      taxId: t.id,
      rate: t.rate,
      name: t.name ?? "",
    });
  }
  return opts;
}

const CALC_ENGINE = new CalculationEngine();

const QUOTE_VALIDITY_DAYS = [30, 45, 60, 90];

export default function QuoteForm() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const fromInvoice = searchParams.get("fromInvoice");
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [taxRates, setTaxRates] = useState<ApiTaxRate[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  const [state, setState] = useState<LocalState>({
    customerId: "",
    currency: "USD",
    issueDate: new Date().toISOString().split("T")[0],
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    terms: "",
    notes: "",
    scopeOfWork: fromInvoice
      ? `Reproducing work for invoice ${fromInvoice}`
      : "",
    internalNotes: "",
    paymentInstructions: "",
    items: [initialItem()],
    fees: [],
    quoteDiscount: "0",
    quoteDiscountType: "percentage",
    depositType: "none",
    depositValue: "0",
    depositDueDate: "",
  });

  const isFinalized = quote?.is_finalized ?? false;

  useEffect(() => {
    getCustomers({ limit: 100 })
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => {});
    getBusiness()
      .then((d) => setBusiness(d.business ?? d))
      .catch(() => {});
    getTaxRates()
      .then((d) => setTaxRates(d.taxRates ?? d.rates ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNew && id) {
      getQuote(id)
        .then((res) => {
          const q: ApiQuote = res.quote;
          setQuote(q);
          setState({
            customerId: q.customer_id ?? "",
            currency: q.currency || "USD",
            issueDate: q.issue_date
              ? q.issue_date.split("T")[0]
              : new Date().toISOString().split("T")[0],
            expiryDate: q.expiry_date
              ? q.expiry_date.split("T")[0]
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
            terms: q.terms ?? "",
            notes: q.notes ?? "",
            scopeOfWork: q.scope_of_work ?? "",
            internalNotes: q.internal_notes ?? "",
            paymentInstructions: q.payment_instructions ?? "",
            items: (q.items ?? []).map((item: ApiQuoteItem) => ({
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unit_price,
              taxRate: item.tax_rate,
              taxName: item.tax_name ?? "",
              isTaxInclusive: item.is_tax_inclusive,
              discount: "0",
              discountType: "percentage",
              isOptional: item.is_optional ?? false,
              productId: item.product_id ?? null,
            })),
            fees: (q.fees ?? []).map((fee: ApiQuoteFee) => ({
              description: fee.description,
              amount: fee.amount,
              taxRate: fee.tax_rate,
              taxName: fee.tax_name ?? "",
            })),
            quoteDiscount: q.quote_discount ?? "0",
            quoteDiscountType: q.quote_discount_type ?? "percentage",
            depositType: q.deposit_type ?? "none",
            depositValue: q.deposit_value ?? "0",
            depositDueDate: q.deposit_due_date
              ? q.deposit_due_date.split("T")[0]
              : "",
          });
        })
        .catch(() => {});
    }
  }, [id, isNew]);

  const taxRateOptions = useMemo(
    () => buildTaxRateOptions(taxRates),
    [taxRates],
  );

  const calcInput: InvoiceCalculationInput = useMemo(() => {
    const currencyCode = state.currency as CurrencyCode;
    const lineItems: LineItemInput[] = state.items
      .filter((item) => item.description.trim())
      .map((item, idx) => {
        const discount:
          { type: "fixed" | "percentage"; value: string } | undefined =
          Number(item.discount) > 0
            ? { type: item.discountType, value: item.discount }
            : undefined;
        return {
          description: item.description,
          quantity: new Decimal(item.quantity || "1"),
          unit: item.unit || "each",
          unitPrice: new Decimal(item.unitPrice || "0"),
          taxRate: new Decimal(item.taxRate || "0"),
          tax_name: item.taxName || null,
          isTaxInclusive: item.isTaxInclusive,
          discount,
          sortOrder: idx,
        };
      });

    const fees: FeeInput[] = state.fees
      .filter((f) => f.description.trim())
      .map((fee, idx) => ({
        description: fee.description,
        amount: new Decimal(fee.amount || "0"),
        taxRate: new Decimal(fee.taxRate || "0"),
        tax_name: fee.taxName || null,
        sortOrder: idx,
      }));

    const invoiceDiscount =
      Number(state.quoteDiscount) > 0
        ? { type: state.quoteDiscountType, value: state.quoteDiscount }
        : undefined;

    return {
      currency: currencyCode,
      lineItems,
      fees,
      invoiceDiscount,
    };
  }, [state]);

  const calcResult = useMemo(() => {
    try {
      return CALC_ENGINE.calculate(calcInput);
    } catch {
      return null;
    }
  }, [calcInput]);

  const canFinalize =
    !isFinalized && state.items.some((i) => i.description.trim());
  const canSend = isFinalized && quote?.status === "finalized";
  const canEdit = !isFinalized;
  const canConvert = isFinalized;

  const buildPayload = (): CreateQuoteInput => ({
    customerId: state.customerId || undefined,
    currency: state.currency,
    issueDate: state.issueDate || undefined,
    expiryDate: state.expiryDate || undefined,
    terms: state.terms || undefined,
    notes: state.notes || undefined,
    scopeOfWork: state.scopeOfWork || undefined,
    internalNotes: state.internalNotes || undefined,
    paymentInstructions: state.paymentInstructions || undefined,
    items: state.items
      .filter((item) => item.description.trim())
      .map((item): CreateQuoteItemInput => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discount: Number(item.discount) > 0 ? item.discount : undefined,
        discountType: item.discountType,
        taxRate: item.taxRate,
        taxName: item.taxName || undefined,
        isTaxInclusive: item.isTaxInclusive,
        isOptional: item.isOptional,
        productId: item.productId || undefined,
      })),
    fees:
      state.fees.length > 0
        ? state.fees
            .filter((f) => f.description.trim())
            .map((fee): CreateQuoteFeeInput => ({
              description: fee.description,
              amount: fee.amount,
              taxRate: fee.taxRate,
              taxName: fee.taxName || undefined,
              isTaxInclusive: false,
            }))
        : undefined,
    quoteDiscount:
      Number(state.quoteDiscount) > 0 ? state.quoteDiscount : undefined,
    quoteDiscountType: state.quoteDiscountType,
    depositType: state.depositType,
    depositValue: state.depositType !== "none" ? state.depositValue : undefined,
    depositDueDate: state.depositDueDate || undefined,
  });

  const doSave = async () => {
    try {
      setSaveState("saving");
      const payload = buildPayload();
      if (isNew) {
        const res = await createQuote(payload);
        setQuote(res.quote as ApiQuote);
        toast("Quote created.", { type: "success", title: "Saved" });
        navigate(`/app/quotes/${res.quote.id}`, { replace: true });
      } else {
        const res = await updateQuote(id, payload);
        setQuote(res.quote as ApiQuote);
        toast("Quote updated.", { type: "success", title: "Saved" });
      }
      setSaveState("saved");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast(message, { type: "error", title: "Save failed" });
      setSaveState("error");
    }
  };

  const handleSave = () => {
    if (isNew) {
      doSave();
    } else {
      setSaveState("saving");
      doSave();
    }
  };

  const handleFinalize = async () => {
    if (!id || !canFinalize) return;
    const validationError = validateQuote();
    if (validationError) {
      toast(validationError, { type: "warning", title: "Validation Error" });
      return;
    }
    setIsFinalizing(true);
    try {
      await doSave();
      const result = await finalizeQuote(id);
      setQuote((prev) => ({ ...prev, ...result.quote }) as ApiQuote);
      toast(`Quote #${result.quoteNumber ?? ""} finalized.`, {
        type: "success",
        title: "Quote Finalized",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Finalize failed";
      toast(message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleSend = async () => {
    if (!id) return;
    setIsSending(true);
    try {
      await sendQuote(id, { sendTo: "" });
      setQuote(
        (prev) =>
          ({
            ...prev,
            status: "sent" as const,
            sent_at: new Date().toISOString(),
          }) as ApiQuote,
      );
      toast("Quote sent.", { type: "success", title: "Sent" });
      setSendDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Send failed";
      toast(message, { type: "error", title: "Send failed" });
    } finally {
      setIsSending(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!id) return;
    try {
      const result = await convertToInvoice(id);
      const invoiceId = (result.invoice as Record<string, unknown>)
        .id as string;
      if (invoiceId) {
        toast("Quote converted to invoice.", {
          type: "success",
          title: "Converted",
        });
        navigate(`/app/invoices/${invoiceId}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Conversion failed";
      toast(message, { type: "error", title: "Conversion failed" });
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    try {
      const res = await duplicateQuote(id);
      toast("Quote duplicated.", { type: "success", title: "Duplicated" });
      navigate(`/app/quotes/${res.quote.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Duplicate failed";
      toast(message, { type: "error", title: "Duplicate failed" });
    }
  };

  const handleDownloadPdf = async () => {
    if (!id) return;
    try {
      const blob = await getQuotePdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quote-${quote?.quote_number ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Download failed";
      toast(message, { type: "error", title: "Download failed" });
    }
  };

  const handleShareLink = async () => {
    if (!id) return;
    try {
      const res = await getQuoteShareLink(id);
      navigator.clipboard.writeText(res.url);
      toast("Share link copied to clipboard.", {
        type: "success",
        title: "Link copied",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate link";
      toast(message, { type: "error", title: "Failed" });
    }
  };

  function validateQuote(): string | null {
    if (!state.customerId) return "Please select a customer.";
    if (!state.items || state.items.length === 0)
      return "Add at least one line item.";
    const hasValidItem = state.items.some((item) => item.description.trim());
    if (!hasValidItem) return "Add at least one line item with a description.";
    return null;
  }

  const updateItem = (idx: number, field: keyof LocalItem, value: unknown) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item,
      ),
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
      fees: [
        ...prev.fees,
        { description: "", amount: "0.00", taxRate: "0", taxName: "" },
      ],
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
      fees: prev.fees.map((fee, i) =>
        i === idx ? { ...fee, [field]: value } : fee,
      ),
    }));
  };

  const selectedCustomer = customers.find((c) => c.id === state.customerId);

  const handleExpiryChange = (days: number) => {
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setState((prev) => ({
      ...prev,
      expiryDate: date.toISOString().split("T")[0],
    }));
  };

  return (
    <div className="page-container h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader
        title={quote ? `Quote #${quote.quote_number ?? "—"}` : "New Quote"}
        description={
          isNew
            ? "Create a new quote for your customer."
            : `Status: ${quote?.status ?? "draft"}`
        }
        primaryAction={
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button
                variant="ghost"
                size="sm"
                icon={<FileText className="h-4 w-4" />}
                onClick={() => navigate("/app/quotes")}
              >
                Back
              </Button>
            )}
            {canEdit && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Save className="h-4 w-4" />}
                  onClick={handleSave}
                  loading={saveState === "saving"}
                >
                  Save
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileText className="h-4 w-4" />}
                  onClick={handleFinalize}
                  loading={isFinalizing}
                  disabled={!canFinalize}
                >
                  Finalize
                </Button>
              </>
            )}
            {canSend && (
              <Button
                variant="primary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                onClick={() => setSendDialogOpen(true)}
                loading={isSending}
              >
                Send
              </Button>
            )}
            {canConvert && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => setConvertDialogOpen(true)}
              >
                Convert to Invoice
              </Button>
            )}
            {!isNew && isFinalized && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={handleDuplicate}
                >
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<FileText className="h-4 w-4" />}
                  onClick={handleDownloadPdf}
                >
                  Download PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Tag className="h-4 w-4" />}
                  onClick={handleShareLink}
                >
                  Share Link
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
          {/* Editor Panel */}
          <div className="overflow-y-auto space-y-6 pr-2">
            {/* Customer & Currency */}
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-sm font-medium text-primary mb-3">
                Customer & Currency
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Customer"
                  select
                  value={state.customerId}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      customerId: e.target.value,
                    }))
                  }
                  helperText={
                    state.customerId
                      ? customers.find((c) => c.id === state.customerId)?.name
                      : undefined
                  }
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </FormField>
                <FormField
                  label="Currency"
                  select
                  value={state.currency}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, currency: e.target.value }))
                  }
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </FormField>
              </div>
              {state.customerId && (
                <div className="mt-2 text-sm">
                  <div className="text-tertiary">
                    {selectedCustomer?.email && (
                      <span>Email: {selectedCustomer.email}</span>
                    )}
                  </div>
                  {selectedCustomer?.address?.addressLine1 && (
                    <div className="text-tertiary mt-1">
                      {[
                        selectedCustomer.address.addressLine1,
                        selectedCustomer.address.city,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-sm font-medium text-primary mb-3">Dates</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Issue Date"
                  type="date"
                  value={state.issueDate}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, issueDate: e.target.value }))
                  }
                />
                <FormField
                  label="Expiry Date"
                  type="date"
                  value={state.expiryDate}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      expiryDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                <span className="text-xs text-tertiary">Quick set:</span>
                {QUOTE_VALIDITY_DAYS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleExpiryChange(days)}
                    className="px-2 py-1 text-xs rounded border border-border hover:bg-surface-alt"
                  >
                    +{days} days
                  </button>
                ))}
              </div>
            </div>

            {/* Line Items */}
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
                        onChange={(e) =>
                          updateItem(idx, "quantity", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Unit"
                        value={item.unit}
                        onChange={(e) =>
                          updateItem(idx, "unit", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Unit Price"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(idx, "unitPrice", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Tax"
                        select
                        value={item.taxRate}
                        onChange={(e) => {
                          const opt = taxRateOptions.find(
                            (o) => o.value === e.target.value,
                          );
                          updateItem(idx, "taxRate", opt?.rate ?? "0");
                          updateItem(idx, "taxName", opt?.name ?? "");
                        }}
                      >
                        {taxRateOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </FormField>
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Discount"
                        value={item.discount}
                        onChange={(e) =>
                          updateItem(idx, "discount", e.target.value)
                        }
                        helperText={item.discountType}
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
                        onChange={(e) =>
                          updateFee(idx, "amount", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        label="Tax %"
                        value={fee.taxRate}
                        onChange={(e) =>
                          updateFee(idx, "taxRate", e.target.value)
                        }
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

            {/* Quote Discount */}
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-sm font-medium text-primary mb-3">
                Quote Discount
              </h3>
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="col-span-2">
                  <FormField
                    label="Discount Value"
                    value={state.quoteDiscount}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        quoteDiscount: e.target.value,
                      }))
                    }
                  />
                </div>
                <FormField
                  label="Type"
                  select
                  value={state.quoteDiscountType}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      quoteDiscountType: e.target.value as
                        "fixed" | "percentage",
                    }))
                  }
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed</option>
                </FormField>
              </div>
            </div>

            {/* Deposit */}
            <div className="border border-border rounded-lg p-4 bg-surface">
              <h3 className="text-sm font-medium text-primary mb-3">Deposit</h3>
              <div className="grid grid-cols-3 gap-4 items-end">
                <FormField
                  label="Deposit Type"
                  select
                  value={state.depositType}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      depositType: e.target.value as
                        "none" | "percentage" | "fixed",
                    }))
                  }
                >
                  <option value="none">None</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </FormField>
                {state.depositType !== "none" && (
                  <FormField
                    label="Deposit Value"
                    value={state.depositValue}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        depositValue: e.target.value,
                      }))
                    }
                  />
                )}
                {state.depositType !== "none" && (
                  <FormField
                    label="Due Date"
                    type="date"
                    value={state.depositDueDate}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        depositDueDate: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            </div>

            {/* Notes & Terms */}
            <div className="space-y-3">
              <FormTextareaField
                label="Scope of Work"
                placeholder="Describe the scope of work..."
                value={state.scopeOfWork}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, scopeOfWork: e.target.value }))
                }
              />
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
              <FormTextareaField
                label="Payment Instructions"
                placeholder="How to pay..."
                value={state.paymentInstructions}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    paymentInstructions: e.target.value,
                  }))
                }
              />
              <FormTextareaField
                label="Internal Notes"
                placeholder="Internal notes (not shown to customer)..."
                value={state.internalNotes}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    internalNotes: e.target.value,
                  }))
                }
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
              scopeOfWork={state.scopeOfWork}
              paymentInstructions={state.paymentInstructions}
              notes={state.notes}
              terms={state.terms}
              depositType={state.depositType}
              depositValue={state.depositValue}
              depositDueDate={state.depositDueDate}
            />
          </div>
        </div>
      </div>

      {/* Send Dialog */}
      {sendDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSendDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">
              Send Quote
            </h3>
            <p className="text-sm text-secondary mb-4">
              This will send the quote to your customer and mark it as sent.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSendDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                onClick={handleSend}
                loading={isSending}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Invoice Dialog */}
      {convertDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConvertDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">
              Convert to Invoice
            </h3>
            <p className="text-sm text-secondary mb-4">
              This will create a new invoice from this quote and mark the quote
              as converted.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConvertDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={handleConvertToInvoice}
              >
                Convert
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
