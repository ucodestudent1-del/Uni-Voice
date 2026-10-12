import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getQuote,
  createQuote,
  updateQuote,
  finalizeQuote,
  sendQuote,
  getCustomers,
  getBusiness,
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
import { Save, Send, Plus, Trash2, FileText } from "lucide-react";
import { Decimal } from "decimal.js";
import DocumentPreview from "@/components/DocumentPreview";
import type { ApiQuote, ApiQuoteItem, ApiQuoteFee, ApiBusiness } from "@/types/api";
import type { ApiCustomer } from "@/types/api";

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

interface LocalState {
  customerId: string;
  currency: string;
  issueDate: string;
  expiryDate: string;
  terms: string;
  notes: string;
  scopeOfWork: string;
  paymentInstructions: string;
  items: LocalItem[];
  fees: { description: string; amount: string; taxRate: string; taxName: string }[];
  quoteDiscount: string;
  quoteDiscountType: "fixed" | "percentage";
}

const CALC_ENGINE = new CalculationEngine();

export default function QuoteBuilder() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [state, setState] = useState<LocalState>({
    customerId: "",
    currency: "USD",
    issueDate: new Date().toISOString().split("T")[0],
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    terms: "",
    notes: "",
    scopeOfWork: "",
    paymentInstructions: "",
    items: [initialItem()],
    fees: [],
    quoteDiscount: "0",
    quoteDiscountType: "fixed",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendData, setSendData] = useState({ to: "", subject: "", message: "" });

  useEffect(() => {
    getCustomers({ limit: 100 }).then((d) => setCustomers(d.customers ?? [])).catch(() => {});
    getBusiness().then((d) => setBusiness(d.business ?? d)).catch(() => {});
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
  });

  const doSave = useCallback(async () => {
    const payload = buildPayload();
    if (!payload.items || payload.items.length === 0) {
      toast("Add at least one line item before saving.", { type: "warning", title: "Empty quote" });
      return;
    }
    setIsSaving(true);
    try {
      if (isNew) {
        const res = await createQuote(payload);
        toast(`Created quote #${res.quote.quote_number ?? ""}.`, { type: "success", title: "Quote created" });
        navigate(`/app/quotes/${res.quote.id}`);
      } else {
        const res = await updateQuote(id!, payload);
        toast("Quote saved.", { type: "success", title: "Saved" });
        setQuote(res.quote);
      }
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Save failed" });
    } finally {
      setIsSaving(false);
    }
  }, [id, isNew, navigate, toast, state]);

  const handleFinalize = useCallback(async () => {
    if (isNew) {
      await doSave();
    }
    if (!quote) return;
    setIsFinalizing(true);
    try {
      const result: FinalizeQuoteResult = await finalizeQuote(quote.id);
      toast(`Quote #${result.quoteNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      setQuote(result.quote);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [quote, isNew, doSave, toast]);

  const handleSend = useCallback(async () => {
    if (isNew) {
      await doSave();
    }
    if (!quote || quote.is_finalized) return;
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

  const updateFee = (idx: number, field: keyof typeof state.fees[0], value: string) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.map((fee, i) => (i === idx ? { ...fee, [field]: value } : fee)),
    }));
  };

  const isFinalized = quote?.is_finalized ?? false;

  return (
    <div className="page-container h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader
        title={isNew ? "New Quote" : `Quote #${quote?.quote_number ?? ""}`}
        description={quote?.status ? `Status: ${quote.status}` : "Draft"}
        primaryAction={
          <div className="flex items-center gap-2">
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
                <Button variant="ghost" icon={<Save className="h-4 w-4" />} onClick={doSave} disabled={isSaving} loading={isSaving}>
                  Save Draft
                </Button>
                <Button variant="primary" icon={<FileText className="h-4 w-4" />} onClick={handleFinalize} disabled={isFinalizing} loading={isFinalizing}>
                  Finalize
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Customer"
                  select
                  value={state.customerId}
                  onChange={(e) => setState((prev) => ({ ...prev, customerId: e.target.value }))}
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
                  onChange={(e) => setState((prev) => ({ ...prev, currency: e.target.value }))}
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
                  onChange={(e) => setState((prev) => ({ ...prev, issueDate: e.target.value }))}
                  disabled={isFinalized}
                />
                <FormField
                  label="Expiry Date"
                  type="date"
                  value={state.expiryDate}
                  onChange={(e) => setState((prev) => ({ ...prev, expiryDate: e.target.value }))}
                  disabled={isFinalized}
                />
              </div>
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
                        disabled={isFinalized}
                        helperText={item.description ? "" : "Required"}
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                        disabled={isFinalized}
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Unit"
                        value={item.unit}
                        onChange={(e) => updateItem(idx, "unit", e.target.value)}
                        disabled={isFinalized}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        label="Unit Price"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                        disabled={isFinalized}
                      />
                    </div>
                    <div className="col-span-1">
                      <FormField
                        label="Tax %"
                        value={item.taxRate}
                        onChange={(e) => updateItem(idx, "taxRate", e.target.value)}
                        disabled={isFinalized}
                      />
                    </div>
                    {!isFinalized && (
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
                    )}
                  </div>
                ))}
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
                onChange={(e) => setState((prev) => ({ ...prev, quoteDiscount: e.target.value }))}
                disabled={isFinalized}
              />
              <FormField
                label="Discount Type"
                select
                value={state.quoteDiscountType}
                onChange={(e) =>
                  setState((prev) => ({
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
                onChange={(e) => setState((prev) => ({ ...prev, scopeOfWork: e.target.value }))}
                disabled={isFinalized}
              />
              <FormTextareaField
                label="Notes"
                placeholder="Additional notes for the customer..."
                value={state.notes}
                onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
                disabled={isFinalized}
              />
              <FormTextareaField
                label="Terms"
                placeholder="Quote terms..."
                value={state.terms}
                onChange={(e) => setState((prev) => ({ ...prev, terms: e.target.value }))}
                disabled={isFinalized}
              />
              <FormTextareaField
                label="Payment Instructions"
                placeholder="How should the customer pay..."
                value={state.paymentInstructions}
                onChange={(e) => setState((prev) => ({ ...prev, paymentInstructions: e.target.value }))}
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
    </div>
  );
}
