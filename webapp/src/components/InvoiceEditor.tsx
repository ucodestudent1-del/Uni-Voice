import { useState, useEffect, useCallback, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getInvoice, createInvoice, updateInvoice, setInvoiceItems, setInvoiceFees,
  finalizeInvoice, sendInvoice, getInvoicePdf, getCustomers, getBusiness, getProducts
} from "../api/client";
import { calculationEngine, type LineItemInput, type FeeInput, type InvoiceCalculationInput } from "../utils/calculation";
import CustomerSelector from "./CustomerSelector";
import TaxSelector from "./TaxSelector";
import TemplateSelector from "./TemplateSelector";
import InvoicePreview, { PreviewInvoice } from "./InvoicePreview";
import type { ApiInvoice, ApiCustomer, ApiBusiness, ApiProduct } from "../types/api";
import { SUPPORTED_CURRENCIES } from "../utils/currency";
import { formatCurrency } from "../utils/format";

interface EditorLineItem {
  id?: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount?: string;
  discountType?: "fixed" | "percentage";
  taxRate?: string;
  isTaxInclusive?: boolean;
  productId?: string | null;
}

interface EditorFee {
  description: string;
  amount: string;
  taxRate?: string;
}

interface EditorInvoice {
  customerId?: string;
  customer?: ApiCustomer;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  notes?: string;
  terms?: string;
  paymentInstructions?: string;
  templateId?: string;
  taxRate?: string;
  discountType?: "fixed" | "percentage";
  discountValue?: string;
  items: EditorLineItem[];
  fees: EditorFee[];
  amountPaid?: string;
}

const DEFAULT_TEMPLATE: EditorInvoice = {
  currency: "USD",
  issueDate: new Date().toISOString().split("T")[0],
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  items: [{ description: "", quantity: "1", unit: "each", unitPrice: "0.00", taxRate: "0", isTaxInclusive: false }],
  fees: [],
  notes: "",
  terms: "Net 30",
  paymentInstructions: "",
};

export default function InvoiceEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const isDraftRoute = id && !isNew;

  const [invoice, setInvoice] = useState<EditorInvoice>({ ...DEFAULT_TEMPLATE });
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [loading, setLoading] = useState(!isNew);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendData, setSendData] = useState({ subject: "", message: "" });

  useEffect(() => {
    if (isNew) return;
    loadInvoice();
  }, [id]);

  useEffect(() => {
    Promise.all([
      getBusiness().then((d) => setBusiness(d.business)).catch(() => {}),
      getCustomers({ limit: 100 }).then((d) => setCustomers(d.customers ?? [])).catch(() => {}),
      getProducts({ limit: 100 }).then((d) => setProducts(d.products ?? [])).catch(() => {}),
    ]);
  }, []);

  async function loadInvoice() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getInvoice(id);
      const inv: ApiInvoice = data.invoice;
      setInvoice({
        customerId: inv.customer_id ?? undefined,
        invoiceNumber: inv.invoice_number ?? undefined,
        issueDate: inv.issue_date?.split("T")[0],
        dueDate: inv.due_date?.split("T")[0],
        currency: inv.currency,
        notes: inv.notes ?? "",
        terms: inv.terms ?? "",
        paymentInstructions: inv.payment_instructions ?? "",
        templateId: inv.template_id ?? undefined,
        items: inv.items.map((it) => ({
          id: it.id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unit_price,
          discount: it.discount,
          discountType: it.discount_type,
          taxRate: it.tax_rate,
          isTaxInclusive: it.is_tax_inclusive,
          productId: it.product_id,
        })),
        fees: inv.fees.map((f) => ({
          description: f.description,
          amount: f.amount,
          taxRate: f.tax_rate,
        })),
        amountPaid: inv.amount_paid,
      });
    } catch (err: any) {
      if (err.response?.status === 404) {
        alert("Invoice not found");
        navigate("/app/invoices");
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: string, value: any) {
    setInvoice({ ...invoice, [field]: value });
    setSaveState("unsaved");
  }

  function updateItem(index: number, field: string, value: any) {
    const items = [...invoice.items];
    items[index] = { ...items[index], [field]: value };
    setInvoice({ ...invoice, items });
    setSaveState("unsaved");
  }

  function addItem() {
    const items = [...invoice.items, {
      description: "", quantity: "1", unit: "each", unitPrice: "0.00",
      taxRate: invoice.taxRate ?? "", isTaxInclusive: false,
    }];
    setInvoice({ ...invoice, items });
    setSaveState("unsaved");
  }

  function removeItem(index: number) {
    const items = invoice.items.filter((_, i) => i !== index);
    setInvoice({ ...invoice, items: items.length ? items : [{
      description: "", quantity: "1", unit: "each", unitPrice: "0.00", taxRate: "", isTaxInclusive: false,
    }] });
    setSaveState("unsaved");
  }

   function addFee() {
    const fees = [...invoice.fees, { description: "", amount: "0.00", taxRate: "0" }];
    setInvoice({ ...invoice, fees });
    setSaveState("unsaved");
  }

  function updateFee(index: number, field: string, value: any) {
    const fees = [...invoice.fees];
    fees[index] = { ...fees[index], [field]: value };
    setInvoice({ ...invoice, fees });
    setSaveState("unsaved");
  }

  function removeFee(index: number) {
    const fees = invoice.fees.filter((_, i) => i !== index);
    setInvoice({ ...invoice, fees });
    setSaveState("unsaved");
  }

  function applyProduct(product: ApiProduct, index: number) {
    const items = [...invoice.items];
    items[index] = {
      ...items[index],
      description: product.name,
      unitPrice: product.default_unit_price,
      taxRate: product.default_tax_rate,
      unit: product.unit,
      productId: product.id,
    };
    setInvoice({ ...invoice, items });
    setSaveState("unsaved");
  }

  const calcResult = (() => {
    try {
      const lineItems: LineItemInput[] = invoice.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit || "each",
        unitPrice: it.unitPrice,
        discount: it.discount && Number(it.discount) > 0
          ? { type: it.discountType ?? "fixed", value: it.discount }
          : undefined,
        taxRate: it.taxRate ?? "0",
        isTaxInclusive: it.isTaxInclusive ?? false,
      }));
      const fees: FeeInput[] = invoice.fees.map((f) => ({
        description: f.description,
        amount: f.amount,
        taxRate: f.taxRate ?? "0",
      }));
      const input: InvoiceCalculationInput = {
        currency: invoice.currency as any,
        lineItems,
        fees: fees.length ? fees : undefined,
        invoiceDiscount: (invoice.discountType && invoice.discountValue && Number(invoice.discountValue) > 0)
          ? { type: invoice.discountType, value: invoice.discountValue }
          : undefined,
        amountPaid: invoice.amountPaid,
      };
      return calculationEngine.calculate(input);
    } catch {
      return null;
    }
  })();

  const totals = calcResult ? {
    subtotal: formatCurrency(calcResult.subtotal, invoice.currency),
    discountTotal: formatCurrency(calcResult.discountTotal, invoice.currency),
    taxTotal: formatCurrency(calcResult.taxTotal, invoice.currency),
    feeTotal: formatCurrency(calcResult.feeTotal, invoice.currency),
    total: formatCurrency(calcResult.total, invoice.currency),
    amountDue: formatCurrency(calcResult.amountDue, invoice.currency),
    amountPaid: formatCurrency(calcResult.amountPaid, invoice.currency),
    hasTax: !calcResult.taxTotal.isZero(),
    hasDiscount: !calcResult.discountTotal.isZero(),
    hasFees: !calcResult.feeTotal.isZero(),
    hasPaid: !calcResult.amountPaid.isZero(),
  } : null;

  const previewData: PreviewInvoice = {
    businessName: business?.name ?? "My Business",
    businessEmail: business?.email ?? undefined,
    businessPhone: business?.phone ?? undefined,
    businessWebsite: business?.website ?? undefined,
    businessAddress: business?.address_line_1 ?
      `${business.address_line_1}${business.address_line_2 ? `\n${business.address_line_2}` : ""}\n${business.city ?? ""}${business.state_or_region ? `, ${business.state_or_region}` : ""}${business.postal_code ? ` ${business.postal_code}` : ""}\n${business.country_code ?? ""}`
      : undefined,
    customerName: invoice.customer ? invoice.customer.name : customers.find((c) => c.id === invoice.customerId)?.name,
    customerCompanyName: (invoice.customer ? invoice.customer.company_name : customers.find((c) => c.id === invoice.customerId)?.company_name) ?? undefined,
    customerEmail: (invoice.customer ? invoice.customer.email : customers.find((c) => c.id === invoice.customerId)?.email) ?? undefined,
    customerAddress: invoice.customer ? undefined : undefined,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    notes: invoice.notes,
    terms: invoice.terms,
    paymentInstructions: invoice.paymentInstructions,
    items: invoice.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit: it.unit || "each",
      unitPrice: it.unitPrice,
      discount: it.discount,
      discountType: it.discountType,
      taxRate: it.taxRate,
      isTaxInclusive: it.isTaxInclusive,
    })),
    fees: invoice.fees,
    subtotal: totals?.subtotal ?? "0.00",
    discountTotal: totals?.discountTotal ?? "0.00",
    taxTotal: totals?.taxTotal ?? "0.00",
    feeTotal: totals?.feeTotal ?? "0.00",
    total: totals?.total ?? "0.00",
    amountPaid: totals?.amountPaid ?? "0.00",
    amountDue: totals?.amountDue ?? "0.00",
    status: invoice.invoiceNumber ? "draft" : "draft",
  };

  async function handleSave() {
    setSaveState("saving");
    try {
      if (isNew) {
        const res = await createInvoice({
          customerId: invoice.customerId,
          currency: invoice.currency,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          notes: invoice.notes,
          terms: invoice.terms,
          paymentInstructions: invoice.paymentInstructions,
          templateId: invoice.templateId,
          items: invoice.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unit: it.unit || "each",
            unitPrice: it.unitPrice,
            discount: it.discount,
            discountType: it.discountType,
            taxRate: it.taxRate,
            isTaxInclusive: it.isTaxInclusive,
            productId: it.productId,
          })),
          fees: invoice.fees,
        });
        navigate(`/app/invoices/${res.invoiceId}/edit`);
      } else {
        await updateInvoice(id!, {
          customerId: invoice.customerId,
          currency: invoice.currency,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          notes: invoice.notes,
          terms: invoice.terms,
          paymentInstructions: invoice.paymentInstructions,
          templateId: invoice.templateId,
        });
        await setInvoiceItems(id!, invoice.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit || "each",
          unitPrice: it.unitPrice,
          discount: it.discount,
          discountType: it.discountType,
          taxRate: it.taxRate,
          isTaxInclusive: it.isTaxInclusive,
        })));
        await setInvoiceFees(id!, invoice.fees);
      }
      setSaveState("saved");
    } catch (err: any) {
      setSaveState("error");
      alert(err.response?.data?.error || "Failed to save");
    }
  }

  async function handleFinalize() {
    if (!invoice.customerId) {
      alert("Please select a customer before finalizing.");
      return;
    }
    if (!invoice.items.some((it) => Number(it.quantity) > 0 && Number(it.unitPrice) > 0)) {
      alert("Add at least one line item with a price.");
      return;
    }
    const confirmed = window.confirm("Finalize this invoice? It will be assigned an invoice number and can't be edited after.");
    if (!confirmed) return;
    try {
      if (isNew) {
        await handleSave();
      }
      // re-load to get the ID if newly created
      const currentId = id && !isNew ? id : undefined;
      if (currentId) {
        const res = await finalizeInvoice(currentId);
        alert(`Invoice finalized! Number: ${res.invoiceNumber}`);
        navigate("/app/invoices");
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to finalize invoice");
    }
  }

  function handleSend() {
    setShowSendDialog(true);
    const customer = customers.find((c) => c.id === invoice.customerId);
    const subject = invoice.invoiceNumber
      ? `Invoice ${invoice.invoiceNumber} from ${business?.name ?? "My Business"}`
      : `Invoice from ${business?.name ?? "My Business"}`;
    const message = `Dear ${customer?.name ?? "Valued Customer"},\n\nPlease find attached invoice ${invoice.invoiceNumber ?? ""}. You can view and pay this invoice online using the secure link below.\n\nThank you for your business.\n\n${business?.name ?? "My Business"}`;
    setSendData({ subject, message });
  }

  async function confirmSend() {
    if (!id || isNew) return;
    try {
      await sendInvoice(id);
      setShowSendDialog(false);
      alert("Invoice sent successfully!");
      navigate("/app/invoices");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to send invoice");
    }
  }

  async function handlePdfDownload() {
    if (!id || isNew) {
      alert("Save the invoice first");
      return;
    }
    const blob = await getInvoicePdf(id);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${invoice.invoiceNumber ?? id}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  const saveStateLabel = {
    saved: "All changes saved",
    saving: "Saving...",
    unsaved: "Unsaved changes",
    error: "Save failed",
  }[saveState];

  if (loading) {
    return <div className="text-center py-20">Loading invoice...</div>;
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/app/invoices")}
            className="text-slate-500 hover:text-slate-700"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            {invoice.invoiceNumber ?? "New Invoice"}
          </h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            saveState === "saved" ? "bg-green-100 text-green-800" :
            saveState === "saving" ? "bg-blue-100 text-blue-800" :
            saveState === "error" ? "bg-red-100 text-red-800" :
            "bg-amber-100 text-amber-800"
          }`}>
            {saveStateLabel}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Save
          </button>
          {!invoice.invoiceNumber && (
            <button
              onClick={handleFinalize}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Finalize & Send
            </button>
          )}
          {invoice.invoiceNumber && (
            <>
              <button
                onClick={handlePdfDownload}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Download PDF
              </button>
              <button
                onClick={handleSend}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Send
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        {/* Controls Panel */}
        <div className="overflow-y-auto pr-2 space-y-6">
          {/* Customer */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Customer</label>
            <CustomerSelector
              value={invoice.customerId}
              onChange={(v) => updateField("customerId", v)}
              onCustomerChange={(c) => setInvoice({ ...invoice, customer: c })}
            />
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Invoice #</label>
              <input
                type="text"
                value={invoice.invoiceNumber ?? ""}
                onChange={(e) => updateField("invoiceNumber", e.target.value || undefined)}
                placeholder="Auto-generated"
                className="mt-1 block w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Currency</label>
              <select
                value={invoice.currency}
                onChange={(e) => updateField("currency", e.target.value)}
                className="mt-1 block w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {SUPPORTED_CURRENCIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Issue Date</label>
              <input
                type="date"
                value={invoice.issueDate ?? ""}
                onChange={(e) => updateField("issueDate", e.target.value || undefined)}
                className="mt-1 block w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Due Date</label>
              <input
                type="date"
                value={invoice.dueDate ?? ""}
                onChange={(e) => updateField("dueDate", e.target.value || undefined)}
                className="mt-1 block w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Template */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Template</label>
            <TemplateSelector
              value={invoice.templateId}
              onChange={(v) => updateField("templateId", v)}
              placeholder="Default template"
            />
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Line Items</label>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 text-xs font-medium text-slate-500 uppercase">Item</th>
                    <th className="text-right py-2 text-xs font-medium text-slate-500 uppercase w-20">Qty</th>
                    <th className="text-right py-2 text-xs font-medium text-slate-500 uppercase w-24">Rate</th>
                    <th className="text-right py-2 text-xs font-medium text-slate-500 uppercase w-20">Tax</th>
                    <th className="text-right py-2 text-xs font-medium text-slate-500 uppercase w-24">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2">
                        <input
                          type="text"
                          value={it.description}
                          onChange={(e) => updateItem(i, "description", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && focusNext(e, i + 1)}
                          placeholder="Description"
                          className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        {products.length > 0 && (
                          <select
                            value={it.productId ?? ""}
                            onChange={(e) => applyProduct(products.find((p) => p.id === e.target.value)!, i)}
                            className="mt-1 w-full text-xs border border-slate-300 rounded-lg px-2 py-1"
                          >
                            <option value="">Link product</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => updateItem(i, "quantity", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && focusNext(e, i + 1)}
                          min="0"
                          step="0.01"
                          className="w-full text-right text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          value={it.unitPrice}
                          onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && focusNext(e, i + 1)}
                          min="0"
                          step="0.01"
                          className="w-full text-right text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="py-2">
                        <TaxSelector
                          value={it.taxRate}
                          onChange={(v) => updateItem(i, "taxRate", v)}
                          placeholder=""
                        />
                      </td>
                      <td className="py-2 text-right">
                        <span className="text-sm font-medium text-slate-900">
                          {calcResult ? formatCurrency(calcResult.lineItems[i]?.lineTotal, invoice.currency) : "-"}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <button
                          onClick={() => removeItem(i)}
                          className="text-red-500 hover:text-red-700"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addItem}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              + Add line item
            </button>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Discount</label>
              <select
                value={invoice.discountType ?? "fixed"}
                onChange={(e) => updateField("discountType", e.target.value as "fixed" | "percentage")}
                className="mt-1 block w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="fixed">Fixed</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">&nbsp;</label>
              <input
                type="number"
                value={invoice.discountValue ?? ""}
                onChange={(e) => updateField("discountValue", e.target.value || undefined)}
                placeholder={invoice.discountType === "percentage" ? "0%" : "0.00"}
                min="0"
                step="0.01"
                className="mt-1 block w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Fees */}
          {invoice.fees.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Fees</label>
              {invoice.fees.map((fee, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={fee.description}
                      onChange={(e) => updateFee(i, "description", e.target.value)}
                      placeholder="Fee description"
                      className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      value={fee.amount}
                      onChange={(e) => updateFee(i, "amount", e.target.value)}
                      placeholder="0.00"
                      className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <button
                    onClick={() => removeFee(i)}
                    className="text-red-500 hover:text-red-700 pb-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addFee}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + Add fee
              </button>
            </div>
          )}

          {invoice.fees.length === 0 && (
            <button
              onClick={addFee}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              + Add fee
            </button>
          )}

          {/* Notes & Terms */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={invoice.notes ?? ""}
                onChange={(e) => updateField("notes", e.target.value || undefined)}
                placeholder="Additional notes for your customer"
                rows={3}
                className="mt-1 block w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Terms</label>
              <textarea
                value={invoice.terms ?? ""}
                onChange={(e) => updateField("terms", e.target.value || undefined)}
                placeholder="Payment terms"
                rows={2}
                className="mt-1 block w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Payment Instructions</label>
              <textarea
                value={invoice.paymentInstructions ?? ""}
                onChange={(e) => updateField("paymentInstructions", e.target.value || undefined)}
                placeholder="How to pay (bank details, etc.)"
                rows={3}
                className="mt-1 block w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="border border-slate-200 rounded-xl bg-white overflow-auto">
          <InvoicePreview invoice={previewData} />
        </div>
      </div>

      {/* Send Confirmation Dialog */}
      {showSendDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Send Invoice</h3>
              <p className="text-sm text-slate-500">Review before sending</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">To</label>
                <p className="text-sm text-slate-900">
                  {customers.find((c) => c.id === invoice.customerId)?.email ?? "No email set"}
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Subject</label>
                <input
                  type="text"
                  value={sendData.subject}
                  onChange={(e) => setSendData({ ...sendData, subject: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Message</label>
                <textarea
                  value={sendData.message}
                  onChange={(e) => setSendData({ ...sendData, message: e.target.value })}
                  rows={4}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowSendDialog(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                Send Invoice
              </button>
            </div>
          </div>
        </div>
       )}
    </div>
  );
}

function focusNext(e: React.KeyboardEvent, nextIndex: number) {
  const form = e.currentTarget.closest("tr");
  const nextRow = form?.parentElement?.children[nextIndex] as HTMLElement | undefined;
  if (nextRow) {
    const input = nextRow.querySelector("input, select") as HTMLElement | null;
    if (input) input.focus();
  }
}
