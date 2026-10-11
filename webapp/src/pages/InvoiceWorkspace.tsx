import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getInvoice,
  createInvoice,
  updateInvoice,
  finalizeInvoice,
  sendInvoice,
  getCustomers,
  type CreateInvoiceInput,
  type CreateInvoiceItemInput,
  type CreateInvoiceFeeInput,
  type FinalizeInvoiceResult,
  type SendInvoiceResult,
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
import {
  Save,
  Send,
  Plus,
  Trash2,
  FileText,
} from "lucide-react";
import { formatDate } from "@/utils/format";
import { Decimal } from "decimal.js";
import type { ApiInvoice, ApiInvoiceItem, ApiInvoiceFee } from "@/types/api";
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
  };
}

interface LocalState {
  customerId: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  poNumber: string;
  terms: string;
  notes: string;
  paymentInstructions: string;
  items: LocalItem[];
  fees: { description: string; amount: string; taxRate: string; taxName: string }[];
  invoiceDiscount: string;
  invoiceDiscountType: "fixed" | "percentage";
  shippingDescription: string;
  shippingAmount: string;
  shippingTaxRate: string;
}

const CALC_ENGINE = new CalculationEngine();

export default function InvoiceWorkspace() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [state, setState] = useState<LocalState>({
    customerId: "",
    currency: "USD",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    poNumber: "",
    terms: "",
    notes: "",
    paymentInstructions: "",
    items: [initialItem()],
    fees: [],
    invoiceDiscount: "0",
    invoiceDiscountType: "fixed",
    shippingDescription: "",
    shippingAmount: "0",
    shippingTaxRate: "0",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendData, setSendData] = useState({ to: "", subject: "", message: "" });

  useEffect(() => {
    getCustomers({ limit: 100 }).then((d) => setCustomers(d.customers ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNew && id) {
      getInvoice(id).then((res) => {
        const inv: ApiInvoice = res.invoice;
        setInvoice(inv);
        setState({
          customerId: inv.customer_id ?? "",
          currency: inv.currency,
          issueDate: inv.issue_date ? inv.issue_date.split("T")[0] : new Date().toISOString().split("T")[0],
          dueDate: inv.due_date ? inv.due_date.split("T")[0] : new Date().toISOString().split("T")[0],
          poNumber: inv.po_number ?? "",
          terms: inv.terms ?? "",
          notes: inv.notes ?? "",
          paymentInstructions: inv.payment_instructions ?? "",
          items: (inv.items ?? []).map((item: ApiInvoiceItem) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unit_price,
            taxRate: item.tax_rate,
            taxName: item.tax_name ?? "",
            isTaxInclusive: item.is_tax_inclusive,
            discount: item.discount,
            discountType: item.discount_type ?? "percentage",
          })),
          fees: (inv.fees ?? []).map((fee: ApiInvoiceFee) => ({
            description: fee.description,
            amount: fee.amount,
            taxRate: fee.tax_rate,
            taxName: fee.tax_name ?? "",
          })),
          invoiceDiscount: inv.invoice_discount ?? "0",
          invoiceDiscountType: inv.invoice_discount_type ?? "fixed",
          shippingDescription: inv.shipping_description ?? "",
          shippingAmount: inv.shipping_amount ?? "0",
          shippingTaxRate: inv.shipping_tax_rate ?? "0",
        });
      }).catch((err) => {
        toast(err.message, { type: "error", title: "Failed to load invoice" });
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

    const invoiceDiscountDef =
      Number(state.invoiceDiscount) > 0
        ? ({ type: state.invoiceDiscountType, value: new Decimal(state.invoiceDiscount) } as DiscountDefinition)
        : undefined;

    return {
      currency: currencyCode,
      lineItems,
      fees,
      invoiceDiscount: invoiceDiscountDef,
    };
  }, [state.items, state.fees, state.invoiceDiscount, state.invoiceDiscountType, state.currency]);

  const calcResult = useMemo(() => {
    try {
      return CALC_ENGINE.calculate(calcInput);
     } catch {
       return null;
     }
  }, [calcInput]);

  const buildPayload = (): CreateInvoiceInput => ({
    customerId: state.customerId || undefined,
    currency: state.currency,
    issueDate: state.issueDate || undefined,
    dueDate: state.dueDate || undefined,
    poNumber: state.poNumber || undefined,
    terms: state.terms || undefined,
    notes: state.notes || undefined,
    paymentInstructions: state.paymentInstructions || undefined,
    items: state.items.map((item): CreateInvoiceItemInput => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discount: item.discount,
      discountType: item.discountType,
      taxRate: item.taxRate,
      taxName: item.taxName || undefined,
      isTaxInclusive: item.isTaxInclusive,
      sortOrder: 0,
    })),
    fees: state.fees.map((fee): CreateInvoiceFeeInput => ({
      description: fee.description,
      amount: fee.amount,
      taxRate: fee.taxRate,
      taxName: fee.taxName || undefined,
    })),
    invoiceDiscount: state.invoiceDiscount,
    invoiceDiscountType: state.invoiceDiscountType,
    shippingDescription: state.shippingDescription || undefined,
    shippingAmount: state.shippingAmount,
    shippingTaxRate: state.shippingTaxRate,
  });

  const doSave = useCallback(async () => {
    const payload = buildPayload();
    if (!payload.items || payload.items.length === 0) {
      toast("Add at least one line item before saving.", { type: "warning", title: "Empty invoice" });
      return;
    }
    setIsSaving(true);
    try {
      if (isNew) {
        const res = await createInvoice(payload);
        toast(`Created invoice #${res.invoice.invoice_number ?? ""}.`, { type: "success", title: "Invoice created" });
        navigate(`/app/invoices/${res.invoice.id}`);
      } else {
        await updateInvoice(id!, payload);
        toast("Invoice saved.", { type: "success", title: "Saved" });
      }
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Save failed" });
    } finally {
      setIsSaving(false);
    }
  }, [id, isNew, navigate, toast, state, setState]);

  const handleFinalize = useCallback(async () => {
    if (isNew) {
      await doSave();
    }
    if (!invoice) return;
    setIsFinalizing(true);
    try {
      const result: FinalizeInvoiceResult = await finalizeInvoice(invoice.id);
      toast(`Invoice #${result.invoiceNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      setInvoice(result.invoice);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [invoice, isNew, doSave, toast]);

  const handleSend = useCallback(async () => {
    if (isNew) {
      await doSave();
    }
    if (!invoice || invoice.is_finalized) return;
    setSendDialogOpen(true);
  }, [invoice, isNew, doSave]);

  const confirmSend = useCallback(async () => {
    if (!invoice) return;
    setIsSending(true);
    try {
      const result: SendInvoiceResult = await sendInvoice(invoice.id, sendData);
      toast(`Invoice sent to ${sendData.to || invoice.customer_email || "customer"}.`, { type: "success", title: "Sent" });
      setInvoice(result.invoice);
      setSendDialogOpen(false);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Send failed" });
    } finally {
      setIsSending(false);
    }
  }, [invoice, sendData, toast]);

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

  const isFinalized = invoice?.is_finalized ?? false;

  return (
    <div className="page-container h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader
        title={isNew ? "New Invoice" : `Invoice #${invoice?.invoice_number ?? ""}`}
        description={invoice?.status ? `Status: ${invoice.status}` : "Draft"}
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
                  label="Due Date"
                  type="date"
                  value={state.dueDate}
                  onChange={(e) => setState((prev) => ({ ...prev, dueDate: e.target.value }))}
                  disabled={isFinalized}
                />
              </div>

              <FormField
                label="PO Number"
                placeholder="Optional"
                value={state.poNumber}
                onChange={(e) => setState((prev) => ({ ...prev, poNumber: e.target.value }))}
                disabled={isFinalized}
              />
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
                label="Invoice Discount"
                value={state.invoiceDiscount}
                onChange={(e) => setState((prev) => ({ ...prev, invoiceDiscount: e.target.value }))}
                disabled={isFinalized}
              />
              <FormField
                label="Discount Type"
                select
                value={state.invoiceDiscountType}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    invoiceDiscountType: e.target.value as "fixed" | "percentage",
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
                label="Notes"
                placeholder="Additional notes for the customer..."
                value={state.notes}
                onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
                disabled={isFinalized}
              />
              <FormTextareaField
                label="Terms"
                placeholder="Payment terms..."
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
                        Invoice {invoice?.invoice_number ?? "(Unsaved)"}
                      </div>
                      {state.issueDate && (
                        <div className="text-tertiary mt-1">
                          <span className="font-medium">Invoice date:</span> {formatDate(state.issueDate)}
                        </div>
                      )}
                      {state.dueDate && (
                        <div className="text-tertiary">
                          <span className="font-medium">Due date:</span> {formatDate(state.dueDate)}
                        </div>
                      )}
                      {state.poNumber && (
                        <div className="text-tertiary">
                          <span className="font-medium">PO:</span> {state.poNumber}
                        </div>
                      )}
                    </div>

                    {/* Customer */}
                    {state.customerId && (
                      <div className="mb-4">
                        {(() => {
                          const cust = customers.find((c) => c.id === state.customerId);
                          if (!cust) return null;
                          return (
                            <div className="text-tertiary">
                              <div className="font-medium text-primary">{cust.name ?? "—"}</div>
                              {cust.email && <div>{cust.email}</div>}
                              {cust.address?.addressLine1 && <div>{cust.address.addressLine1}</div>}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Line Items Table */}
                    <div className="mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1 text-tertiary font-medium">Description</th>
                            <th className="text-right py-1 text-tertiary font-medium">Qty</th>
                            <th className="text-right py-1 text-tertiary font-medium">Unit Price</th>
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
                              <td className="text-right py-1 font-medium">{li.lineTotal.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="border-t border-border pt-2 space-y-1">
                      <div className="flex justify-between text-tertiary">
                        <span>Subtotal</span>
                        <span>{calcResult.subtotal.toFixed(2)}</span>
                      </div>
                      {Number(calcResult.discountTotal.toFixed()) > 0 && (
                        <div className="flex justify-between text-tertiary">
                          <span>Discount</span>
                          <span>-{calcResult.discountTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-tertiary">
                        <span>Tax</span>
                        <span>{calcResult.taxTotal.toFixed(2)}</span>
                      </div>
                      {calcResult.fees.length > 0 && (
                        <div className="flex justify-between text-tertiary">
                          <span>Fees</span>
                          <span>{calcResult.feeTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t border-border">
                        <span>Total</span>
                        <span>{calcResult.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-tertiary">
                        <span>Amount Due</span>
                        <span>{calcResult.amountDue.toFixed(2)}</span>
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

      {/* Send Dialog */}
      {sendDialogOpen && invoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSendDialogOpen(false)}
        >
          <div
            className="bg-popover border border-border rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-primary mb-4">Send Invoice</h3>
            <div className="space-y-3">
              <FormField
                label="To"
                type="email"
                placeholder={invoice.customer_email ?? "customer@example.com"}
                value={sendData.to}
                onChange={(e) => setSendData((prev) => ({ ...prev, to: e.target.value }))}
              />
              <FormField
                label="Subject"
                placeholder={`Invoice #${invoice.invoice_number ?? ""}`}
                value={sendData.subject}
                onChange={(e) => setSendData((prev) => ({ ...prev, subject: e.target.value }))}
              />
              <FormTextareaField
                label="Message"
                placeholder="Hi, please find your invoice attached."
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
