import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clipboard,
  Download,
  Mail,
  MessageCircle,
  Share2,
} from "lucide-react";
import {
  createInvoice,
  finalizeInvoice,
  getBusiness,
  getInvoice,
  getInvoicePdf,
  getProducts,
  sendInvoice,
} from "../api/client";
import CustomerSelector from "../components/CustomerSelector";
import { formatCurrency } from "../utils/format";
import type { ApiBusiness, ApiCustomer, ApiProduct } from "../types/api";

type FlowStep = "details" | "review" | "done";
type ActionState = {
  type: "saving" | "success" | "error" | "info";
  text: string;
} | null;

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDueValue() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function publicInvoiceUrl(token: string) {
  return `${window.location.origin}/invoice/${token}`;
}

export default function QuickInvoicePage() {
  const navigate = useNavigate();
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0.00");
  const [taxRate, setTaxRate] = useState("0");
  const [issueDate, setIssueDate] = useState(todayValue());
  const [dueDate, setDueDate] = useState(defaultDueValue());
  const [notes, setNotes] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("Pay securely using the payment link on this invoice.");
  const [step, setStep] = useState<FlowStep>("details");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionState>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    loadDependencies();
  }, []);

  async function loadDependencies() {
    setLoading(true);
    setLoadError(null);
    try {
      const [businessData, productData] = await Promise.all([
        getBusiness(),
        getProducts({ limit: 100 }),
      ]);
      setBusiness(businessData.business);
      setProducts(productData.products ?? []);
    } catch (err: any) {
      setLoadError(err.response?.data?.error || "Could not load invoice details");
    } finally {
      setLoading(false);
    }
  }

  const currency = business?.default_currency || customer?.defaultCurrency || "USD";
  const selectedProduct = products.find((product) => product.id === serviceId);

  // Safe decimal parsing helper
  function parseDecimal(value: string): Decimal | null {
    try {
      const d = new Decimal(value || 0);
      return d.isNaN() ? null : d;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!selectedProduct) return;
    setDescription(selectedProduct.description || selectedProduct.name);
    setUnitPrice(selectedProduct.default_unit_price || "0.00");
    setTaxRate(selectedProduct.default_tax_rate || "0");
  }, [selectedProduct?.id]);

  const calculation = useMemo(() => {
    try {
      const lineSubtotal = new Decimal(quantity || 0).mul(unitPrice || 0);
      const tax = lineSubtotal.mul(new Decimal(taxRate || 0)).div(100);
      const total = lineSubtotal.plus(tax);
      return { lineSubtotal, tax, total };
    } catch {
      return { lineSubtotal: new Decimal(0), tax: new Decimal(0), total: new Decimal(0) };
    }
  }, [quantity, unitPrice, taxRate]);

  function selectCustomer(nextCustomer: ApiCustomer | undefined) {
    setCustomer(nextCustomer ?? null);
  }

  function validateDetails() {
    if (!customer) return "Select a customer";
    if (!description.trim()) return "Describe the work";
    const qty = parseDecimal(quantity);
    if (!qty || !qty.gt(0)) return "Quantity must be greater than zero";
    const price = parseDecimal(unitPrice);
    if (!price || price.lt(0)) return "Price cannot be negative";
    if (!issueDate || !dueDate) return "Select issue and due dates";
    if (new Date(dueDate) < new Date(issueDate)) return "Due date must be on or after the issue date";
    return null;
  }

  function goToReview() {
    const validationError = validateDetails();
    if (validationError) {
      setAction({ type: "error", text: validationError });
      return;
    }
    setAction(null);
    setStep("review");
  }

  async function ensurePaymentLink() {
    if (!invoiceId) return "";
    const data = await getInvoice(invoiceId);
    const token = data.invoice?.public_token;
    if (!token) throw new Error("Payment link is not available yet");
    const link = publicInvoiceUrl(token);
    setPaymentLink(link);
    return link;
  }

  async function createAndFinalize() {
    setAction({ type: "saving", text: "Creating invoice..." });
    try {
      const created = await createInvoice({
        customerId: customer?.id,
        currency,
        issueDate,
        dueDate,
        notes: notes || undefined,
        paymentInstructions: paymentInstructions || undefined,
        items: [
          {
            description: description.trim(),
            quantity,
            unit: selectedProduct?.unit || "each",
            unitPrice,
            taxRate,
            isTaxInclusive: false,
            productId: selectedProduct?.id || null,
            catalogName: selectedProduct?.name || null,
            catalogSku: selectedProduct?.sku || null,
            catalogTaxCategory: null,
            catalogUnitPrice: selectedProduct?.default_unit_price || null,
            catalogTaxRate: selectedProduct?.default_tax_rate || null,
          },
        ],
      });
      await finalizeInvoice(created.invoiceId);
      const data = await getInvoice(created.invoiceId);
      setInvoiceId(created.invoiceId);
      setPaymentLink(data.invoice?.public_token ? publicInvoiceUrl(data.invoice.public_token) : "");
      setAction({ type: "success", text: "Invoice finalized" });
      setStep("done");
    } catch (err: any) {
      setAction({ type: "error", text: err.response?.data?.error || err.message || "Could not create invoice" });
    }
  }

  async function handleSendEmail() {
    if (!invoiceId) return;
    setAction({ type: "saving", text: "Sending invoice..." });
    try {
      await sendInvoice(invoiceId);
      await ensurePaymentLink();
      setAction({ type: "success", text: "Invoice sent by email" });
    } catch (err: any) {
      setAction({ type: "error", text: err.response?.data?.error || err.message || "Could not send invoice" });
    }
  }

  async function handleShare() {
    let link;
    try {
      link = paymentLink || await ensurePaymentLink();
    } catch (err: any) {
      setAction({ type: "error", text: err.message || "Could not get payment link" });
      return;
    }
    if (!link) return;
    const shareData = {
      title: "Invoice",
      text: `Invoice from ${business?.name || "our business"}`,
      url: link,
    };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        setAction({ type: "success", text: "Payment link shared" });
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setAction({ type: "error", text: "Could not share payment link" });
        }
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setAction({ type: "success", text: "Payment link copied" });
    } catch {
      setAction({ type: "error", text: "Could not copy payment link" });
    }
  }

  async function handleText() {
    let link;
    try {
      link = paymentLink || await ensurePaymentLink();
    } catch (err: any) {
      setAction({ type: "error", text: err.message || "Could not get payment link" });
      return;
    }
    if (!link) return;
    const message = `Invoice from ${business?.name || "our business"}: ${link}`;
    if (typeof navigator.share === "function") {
      await handleShare();
      return;
    }
    window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
  }

  async function handleDownloadPdf() {
    if (!invoiceId) return;
    setPdfLoading(true);
    setAction({ type: "saving", text: "Preparing PDF..." });
    try {
      const blob = await getInvoicePdf(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `invoice-${invoiceId}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setAction({ type: "success", text: "PDF downloaded" });
    } catch (err: any) {
      setAction({ type: "error", text: err.response?.data?.error || err.message || "Could not download PDF" });
    } finally {
      setPdfLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md p-4 text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-800">Could not start invoice</h1>
          <p className="mt-2 text-sm text-red-700">{loadError}</p>
          <button
            onClick={loadDependencies}
            className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <Link to="/app/invoices" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Invoices
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={step === "details" ? "text-primary-700 font-semibold" : ""}>Details</span>
          <span>•</span>
          <span className={step === "review" ? "text-primary-700 font-semibold" : ""}>Review</span>
          <span>•</span>
          <span className={step === "done" ? "text-primary-700 font-semibold" : ""}>Send</span>
        </div>
      </div>

      {action && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          action.type === "error"
            ? "border-red-200 bg-red-50 text-red-800"
            : action.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
        }`}>
          {action.text}
        </div>
      )}

      {step === "details" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">1</span>
              <h1 className="text-xl font-bold text-slate-900">Who is this for?</h1>
            </div>
            <CustomerSelector
              value={customer?.id}
              onChange={(customerId) => {
                if (!customerId) setCustomer(null);
              }}
              onCustomerChange={selectCustomer}
              placeholder="Select or add a customer"
            />
            {customer && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <span className="font-medium text-slate-900">{customer.name}</span>
                {customer.email && <span> • {customer.email}</span>}
                {customer.phone && <span> • {customer.phone}</span>}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">2</span>
              <h2 className="text-xl font-bold text-slate-900">What did you do?</h2>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Saved service</span>
                <select
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Custom work description</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} — {formatCurrency(product.default_unit_price, product.default_currency || currency)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Work description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Example: Repaired kitchen sink leak"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Quantity</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Price each</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitPrice}
                    onChange={(event) => setUnitPrice(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Tax %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxRate}
                    onChange={(event) => setTaxRate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-600">Total</span>
                <span className="text-xl font-bold text-slate-900">{formatCurrency(calculation.total, currency)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">3</span>
              <h2 className="text-xl font-bold text-slate-900">When is it due?</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700"><CalendarDays className="h-4 w-4" /> Issue date</span>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700"><CalendarDays className="h-4 w-4" /> Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>
            </div>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Notes for the customer</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">How should they pay?</span>
                <textarea
                  value={paymentInstructions}
                  onChange={(event) => setPaymentInstructions(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>
            </div>
          </section>

          <button
            onClick={goToReview}
            className="sticky bottom-20 left-0 right-0 mx-auto flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-3.5 text-base font-semibold text-white shadow-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:static sm:w-auto"
          >
            Review invoice
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Invoice for</p>
                <h1 className="text-xl font-bold text-slate-900">{customer?.name || "Customer"}</h1>
              </div>
              <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">Ready to send</span>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <span className="text-slate-600">{description || "Work description"}</span>
                <span className="font-medium text-slate-900 whitespace-nowrap">{formatCurrency(calculation.total, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Quantity</span>
                <span>{quantity}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Price</span>
                <span>{formatCurrency(unitPrice, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax</span>
                <span>{taxRate}%</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900">
                <span>Total due</span>
                <span>{formatCurrency(calculation.total, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Issue date</span>
                <span>{issueDate}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Due date</span>
                <span>{dueDate}</span>
              </div>
              {notes && <p className="rounded-lg bg-slate-50 p-3 text-slate-700">{notes}</p>}
              {paymentInstructions && <p className="rounded-lg bg-slate-50 p-3 text-slate-700">{paymentInstructions}</p>}
            </div>
          </section>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              onClick={() => setStep("details")}
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={createAndFinalize}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              disabled={action?.type === "saving"}
            >
              <Check className="h-4 w-4" />
              Finalize invoice
            </button>
          </div>
        </div>
      )}

      {step === "done" && invoiceId && (
        <div className="space-y-6">
          <section className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Check className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">Invoice is ready</h1>
            <p className="mt-1 text-sm text-slate-600">Send it now or copy the secure payment link.</p>
            {paymentLink && (
              <a
                href={paymentLink}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-primary-700 ring-1 ring-primary-200 hover:bg-primary-50"
              >
                Open payment page
              </a>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Send or share</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button onClick={handleSendEmail} className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Mail className="h-4 w-4" /> Send by email
              </button>
              <button onClick={handleText} className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <MessageCircle className="h-4 w-4" /> Send by text
              </button>
              <button onClick={handleShare} className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Share2 className="h-4 w-4" /> Share payment link
              </button>
              <button onClick={handleDownloadPdf} disabled={pdfLoading} className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Download className="h-4 w-4" /> {pdfLoading ? "Preparing..." : "Download PDF"}
              </button>
            </div>
            {paymentLink && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                <Clipboard className="h-4 w-4 flex-shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{paymentLink}</span>
              </div>
            )}
          </section>
          <div className="flex justify-between gap-3">
            <Link to={`/app/invoices/${invoiceId}`} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              View invoice
            </Link>
            <button onClick={() => navigate("/app/invoices")} className="rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
