import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clipboard,
  Copy,
  CreditCard,
  Download,
  FileText,
  GripVertical,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  createInvoice,
  finalizeInvoice,
  getBusiness,
  getBusinessSettings,
  getCustomers,
  getInvoice,
  getInvoicePdf,
  sendInvoice,
} from "../api/client";
import CustomerSelector from "../components/CustomerSelector";
import { AiInput } from "../components/AiInput";
import { PaymentTermsWithCustomField, computeDueDateFromTerms } from "../components/ui/PaymentTermsField";
import { Button } from "../components/ui/Button";
import { FormField, FormTextareaField } from "../components/ui/FormField";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { useToast } from "../components/ui/ToastProvider";
import {
  calculationEngine,
  type LineItemInput,
} from "../utils/calculation";
import {
  formatCurrency,
  fromPercentage,
  parseDecimal,
  toPercent,
} from "../utils/format";
import { getCurrencyMetadata, SUPPORTED_CURRENCIES } from "../types/currency";
import InvoicePreviewV2, {
  type PreviewInvoice,
  type PreviewLineItem,
} from "../components/InvoicePreviewV2";
import { StatusBadge } from "../components/ui/StatusBadge";
import type { ApiBusiness, ApiCustomer } from "../types/api";
import type { ApiParsedDocumentResult } from "../api/client";

type FlowStep = "details" | "review" | "done";

const LINE_ITEM_UNITS = ["each", "hour", "day", "week", "month", "fixed"] as const;

interface QuickLineItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  isTaxInclusive: boolean;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function defaultDueISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
}

function publicInvoiceUrl(token: string) {
  return `${window.location.origin}/invoice/${token}`;
}

function emptyLineItem(): QuickLineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unit: "each",
    unitPrice: "0",
    taxRate: "0",
    isTaxInclusive: false,
  };
}

function businessAddressString(b: ApiBusiness | null): string | undefined {
  if (!b) return undefined;
  const parts = [
    b.addressLine1,
    b.addressLine2,
    b.city,
    b.stateOrRegion,
    [b.postalCode, b.countryCode].filter(Boolean).join(" "),
    b.taxId ? `Tax ID: ${b.taxId}` : undefined,
  ];
  const joined = parts.filter(Boolean).join("\n");
  return joined || undefined;
}

function customerAddressString(c: ApiCustomer | null): string | undefined {
  if (!c?.address) return undefined;
  const a = c.address;
  const parts = [
    a.addressLine1,
    a.addressLine2,
    a.city,
    a.stateOrRegion,
    [a.postalCode, a.countryCode].filter(Boolean).join(" "),
  ];
  const joined = parts.filter(Boolean).join("\n");
  return joined || undefined;
}

function buildPreviewInvoice(
  items: QuickLineItem[],
  currency: string,
  customer: ApiCustomer | null,
  business: ApiBusiness | null,
  settings: Record<string, any>,
  issueDate: string,
  dueDate: string,
  invoiceTerms: string,
  notes: string,
  paymentInstructions: string,
  calc: ReturnType<typeof calculationEngine.calculate> | null,
  isDraft: boolean,
): PreviewInvoice {
  const meta = getCurrencyMetadata(currency);
  const dp = meta.decimalPlaces;

  const previewItems: PreviewLineItem[] = items.map((it) => ({
    description: it.description,
    quantity: it.quantity || "1",
    unit: it.unit || "each",
    unitPrice: it.unitPrice || "0",
    taxRate: it.taxRate ? fromPercentage(toPercent(it.taxRate)) : undefined,
    isTaxInclusive: it.isTaxInclusive,
  }));

  const paymentMethods: PreviewInvoice["paymentMethods"] = [];
  const bankDetails = settings?.default_bank_details ?? undefined;
  if (bankDetails) {
    paymentMethods.push({
      type: "bank",
      label: "Bank Transfer",
      details: bankDetails,
    });
  }
  const onlineUrl = settings?.default_payment_portal_url ?? undefined;
  if (onlineUrl) {
    paymentMethods.push({
      type: "custom",
      label: "Online Payment",
      url: onlineUrl,
    });
  }

  return {
    businessName: business?.name || business?.legalName || "Untitled Business",
    businessLegalName: business?.legalName ?? null,
    businessEmail: business?.email ?? undefined,
    businessPhone: business?.phone ?? undefined,
    businessWebsite: business?.website ?? undefined,
    businessAddress: businessAddressString(business),
    businessLogo: business?.logoUrl ?? undefined,
    businessTaxId: business?.taxId ?? undefined,
    businessRegistrationNumber: business?.registrationNumber ?? undefined,
    invoiceNumber: null,
    invoiceTitle: "INVOICE",
    issueDate,
    dueDate,
    currency,
    poNumber: null,
    projectName: null,
    terms: invoiceTerms || undefined,
    customerName: customer?.name ?? undefined,
    customerCompanyName: customer?.companyName ?? undefined,
    customerEmail: customer?.email ?? undefined,
    customerPhone: customer?.phone ?? undefined,
    customerAddress: customer ? customerAddressString(customer) : undefined,
    customerTaxId: customer?.taxId ?? customer?.address?.taxId ?? undefined,
    items: previewItems,
    fees: [],
    subtotal: calc?.subtotal.toFixed(dp) ?? "0.00",
    discountTotal: calc?.discountTotal.toFixed(dp) ?? "0.00",
    taxTotal: calc?.taxTotal.toFixed(dp) ?? "0.00",
    feeTotal: calc?.feeTotal.toFixed(dp) ?? "0.00",
    total: calc?.total.toFixed(dp) ?? "0.00",
    amountPaid: calc?.amountPaid.toFixed(dp) ?? "0.00",
    amountDue: calc?.amountDue.toFixed(dp) ?? "0.00",
    notes: notes || undefined,
    paymentInstructions,
    paymentMethods,
    paymentLink: undefined,
    bankDetails,
    lateFeeType: settings?.late_fee_type ?? null,
    lateFeeValue: settings?.late_fee_value ?? null,
    lateFeePeriodDays: settings?.late_fee_period_days ?? null,
    taxExemption: settings?.tax_exemption ?? null,
    deliveryDetails: settings?.delivery_details ?? null,
    warrantyInfo: settings?.warranty_info ?? null,
    returnPolicy: settings?.return_policy ?? null,
    depositType: "none",
    depositValue: null,
    depositDueDate: null,
    depositPaymentPurpose: null,
    depositPaid: "0",
    depositDue: "0",
    status: isDraft ? "draft" : "draft",
    isFinalized: false,
    attachments: [],
  };
}

export default function QuickInvoicePage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);

  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [items, setItems] = useState<QuickLineItem[]>([emptyLineItem()]);
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(defaultDueISO());
  const [invoiceTerms, setInvoiceTerms] = useState("Net 14");
  const [notes, setNotes] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState(
    "Pay securely using the payment link on this invoice."
  );
  const [currencyOverride, setCurrencyOverride] = useState<string | null>(null);

  const [step, setStep] = useState<FlowStep>("details");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [aiParsed, setAiParsed] = useState<ApiParsedDocumentResult | null>(null);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [previewMobileOpen, setPreviewMobileOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const currency =
    currencyOverride || business?.defaultCurrency || customer?.defaultCurrency || "USD";

  useEffect(() => {
    loadDependencies();
  }, []);

  async function loadDependencies() {
    setLoading(true);
    setLoadError(null);
    try {
      const [businessData, settingsData, customerData] = await Promise.all([
        getBusiness(),
        getBusinessSettings(),
        getCustomers({ limit: 100, includeArchived: false }),
      ]);
      setBusiness(businessData.business);
      setSettings(settingsData.settings ?? {});
      setCustomers(customerData.data ?? []);
    } catch (err: any) {
      setLoadError(err.response?.data?.error || "Could not load invoice details");
    } finally {
      setLoading(false);
    }
  }

  const calc = useMemo(() => {
    try {
      const lineItems: LineItemInput[] = items.map((it) => ({
        description: it.description || "",
        quantity: parseDecimal(it.quantity || "1"),
        unit: it.unit || "each",
        unitPrice: parseDecimal(it.unitPrice || "0"),
        taxRate: it.taxRate ? fromPercentage(toPercent(it.taxRate)) : "0",
        isTaxInclusive: it.isTaxInclusive ?? false,
      }));
      return calculationEngine.calculate({
        currency: currency as any,
        lineItems,
      });
    } catch {
      return null;
    }
  }, [items, currency]);

  const previewInvoice = useMemo(() => {
    if (!calc) return null;
    return buildPreviewInvoice(
      items,
      currency,
      customer,
      business,
      settings,
      issueDate,
      dueDate,
      invoiceTerms,
      notes,
      paymentInstructions,
      calc,
      true
    );
  }, [items, currency, customer, business, settings, issueDate, dueDate, invoiceTerms, notes, paymentInstructions, calc]);

  const meta = useMemo(() => {
    try {
      return getCurrencyMetadata(currency);
    } catch {
      return getCurrencyMetadata("USD");
    }
  }, [currency]);

  function selectCustomer(nextCustomer: ApiCustomer | undefined) {
    setCustomer(nextCustomer ?? null);
    if (nextCustomer?.defaultCurrency) {
      setCurrencyOverride(nextCustomer.defaultCurrency);
    }
  }

  function handleAiParsed(parsed: ApiParsedDocumentResult) {
    if (parsed.fields.currency) setCurrencyOverride(parsed.fields.currency);
    if (parsed.fields.notes) setNotes(parsed.fields.notes);

    if (parsed.fields.items.length > 0) {
      const newItems = parsed.fields.items.map((item) => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: String(item.quantity ?? 1),
        unit: item.unit ?? "each",
        unitPrice: String(item.unitPrice ?? 0),
        taxRate: String(item.taxRate ?? 0),
        isTaxInclusive: !!item.isTaxInclusive,
      }));
      setItems(newItems);
    }
  }

  function clearAiParsed() {
    setAiParsed(null);
    setItems([emptyLineItem()]);
    setNotes("");
  }

  const handleTermsChange = (terms: string) => {
    setInvoiceTerms(terms);
    if (terms !== "Custom" && issueDate) {
      const newDue = computeDueDateFromTerms(issueDate, terms);
      if (newDue) setDueDate(newDue);
    }
  };

  function updateItem(id: string, patch: Partial<QuickLineItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyLineItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function reorderItems(dragIndex: number, dropIndex: number) {
    setItems((prev) => {
      const newItems = [...prev];
      const [moved] = newItems.splice(dragIndex, 1);
      newItems.splice(dropIndex, 0, moved);
      return newItems;
    });
  }

  function validateDetails(): string | null {
    if (!customer) return "Select a customer";
    const hasDescription = items.some((it) => it.description.trim().length > 0);
    if (!hasDescription) return "Add at least one line item with a description";
    for (const it of items) {
      if (it.description.trim() && parseDecimal(it.quantity).lte(0))
        return `Quantity must be greater than zero for "${it.description}"`;
      if (it.description.trim() && parseDecimal(it.unitPrice).lt(0))
        return `Price cannot be negative for "${it.description}"`;
    }
    if (!issueDate || !dueDate) return "Select issue and due dates";
    if (new Date(dueDate) < new Date(issueDate)) return "Due date must be on or after the issue date";
    return null;
  }

  function goToReview() {
    const err = validateDetails();
    if (err) {
      toast(err, { type: "error" });
      return;
    }
    setStep("review");
  }

  async function ensurePaymentLink(): Promise<string> {
    if (!invoiceId) return "";
    const data = await getInvoice(invoiceId);
    const token = data.invoice?.public_token;
    if (!token) throw new Error("Payment link is not available yet");
    const link = publicInvoiceUrl(token);
    setPaymentLink(link);
    return link;
  }

  async function createAndSaveDraft(): Promise<string | null> {
    setSaving(true);
    try {
      const lineItemsPayload = items
        .filter((it) => it.description.trim().length > 0)
        .map((it) => ({
          description: it.description.trim(),
          quantity: it.quantity,
          unit: it.unit || "each",
          unitPrice: it.unitPrice,
          taxRate: it.taxRate ? fromPercentage(toPercent(it.taxRate)) : "0",
          discount: undefined,
          discountType: undefined,
          isTaxInclusive: it.isTaxInclusive,
          productId: null,
          catalogName: null,
          catalogSku: null,
          catalogTaxCategory: null,
          catalogUnitPrice: null,
          catalogTaxRate: null,
        }));

      const created = await createInvoice({
        customerId: customer?.id,
        currency,
        issueDate,
        dueDate,
        notes: notes || undefined,
        paymentInstructions: paymentInstructions || undefined,
        items: lineItemsPayload,
      });
      setInvoiceId(created.invoiceId);
      toast("Invoice created", { type: "success" });
      return created.invoiceId;
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Could not create invoice", { type: "error" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function doFinalizeAndSend() {
    setShowFinalizeDialog(false);

    const id = invoiceId ?? (await createAndSaveDraft());
    if (!id) return;

    setSaving(true);
    try {
      await finalizeInvoice(id);
      await sendInvoice(id);
      const data = await getInvoice(id);
      setInvoiceId(id);
      setPaymentLink(data.invoice?.public_token ? publicInvoiceUrl(data.invoice.public_token) : "");
      setStep("done");
      toast("Invoice finalized and sent by email", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Could not finalize and send invoice", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendEmail() {
    if (!invoiceId) return;
    setSaving(true);
    try {
      await sendInvoice(invoiceId);
      await ensurePaymentLink();
      toast("Invoice sent by email", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Could not send invoice", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    let link: string;
    try {
      link = paymentLink || (await ensurePaymentLink());
    } catch (err: any) {
      toast(err.message || "Could not get payment link", { type: "error" });
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
        toast("Payment link shared", { type: "success" });
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          toast("Could not share payment link", { type: "error" });
        }
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast("Payment link copied", { type: "success" });
    } catch {
      toast("Could not copy payment link", { type: "error" });
    }
  }

  async function handleText() {
    let link: string;
    try {
      link = paymentLink || (await ensurePaymentLink());
    } catch (err: any) {
      toast(err.message || "Could not get payment link", { type: "error" });
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
    try {
      const blob = await getInvoicePdf(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `invoice-${invoiceId}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      toast("PDF downloaded", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Could not download PDF", { type: "error" });
    } finally {
      setPdfLoading(false);
    }
  }

  function copyPaymentLink() {
    if (!paymentLink) return;
    navigator.clipboard.writeText(paymentLink).catch(() => {});
    toast("Payment link copied to clipboard", { type: "success" });
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <div className="flex items-center gap-3 text-secondary">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Setting up invoice…</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-4">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-error-text" />
          <h2 className="mt-3 text-lg font-semibold text-primary">Could not start invoice</h2>
          <p className="mt-2 text-sm text-secondary">{loadError}</p>
          <Button variant="primary" size="md" className="mt-4" onClick={loadDependencies}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-page text-primary">
      <header className="flex h-14 items-center justify-between border-b border-color bg-surface px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            icon={<X className="h-5 w-5" />}
            onClick={() => navigate("/app/invoices", { replace: true })}
            aria-label="Back to invoices"
          />
          <h1 className="text-xl font-semibold text-primary">
            Create Invoice
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-bg px-2.5 py-0.5 text-xs font-medium text-primary-brand">
            <Sparkles className="h-3 w-3" /> Quick Entry
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<LayoutDashboard className="h-4 w-4" />}
            onClick={() => setPreviewMobileOpen(!previewMobileOpen)}
            className="lg:hidden"
          >
            {previewMobileOpen ? "Hide Preview" : "Show Preview"}
          </Button>
          <Link to="/app/invoices">
            <Button variant="secondary" size="sm">
              Invoices
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="lg:hidden border-b border-color bg-surface px-4 py-2">
          <span className="text-xs text-secondary">
            Step {step === "details" ? "1" : step === "review" ? "2" : "3"} of 3 ·{" "}
            {step === "details" ? "Details" : step === "review" ? "Review" : "Send"}
          </span>
        </div>

        <aside className="flex w-full min-w-0 flex-[3] flex-col overflow-hidden">
          <div className="overflow-y-auto px-6 py-5">
            {step === "details" && (
              <div className="space-y-6">
                <section className="rounded-xl border border-color-subtle bg-surface p-4 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-bg text-primary-brand">1</span>
                    <h2 className="text-xl font-bold text-primary">Who is this for?</h2>
                  </div>
                  <CustomerSelector
                    value={customer?.id}
                    onChange={(customerId) => {
                      if (!customerId) setCustomer(null);
                      else {
                        const found = customers.find((c) => c.id === customerId);
                        selectCustomer(found);
                      }
                    }}
                    onCustomerChange={selectCustomer}
                    placeholder="Select or add a customer"
                  />
                  {customer && (
                    <div className="mt-3 rounded-lg bg-surface-alt p-3 text-sm text-secondary">
                      <span className="font-medium text-primary">{customer.name}</span>
                      {customer.email && <span> • {customer.email}</span>}
                      {customer.phone && <span> • {customer.phone}</span>}
                    </div>
                  )}
                </section>

                <AiInput
                  onParsed={handleAiParsed}
                  onClear={clearAiParsed}
                  hasParsedData={!!aiParsed}
                  businessName={(business?.name ?? business?.legalName) ?? "Your Business"}
                  currency={currency}
                  customerId={customer?.id}
                />

                <section className="rounded-xl border border-color-subtle bg-surface p-4 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-bg text-primary-brand">2</span>
                    <h2 className="text-xl font-bold text-primary">What did you do?</h2>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, index) => {
                      const lineTotal = calc?.lineItems[index]?.lineTotal;
                      const isLast = index === items.length - 1;

                      return (
                        <div
                          key={item.id}
                          className="relative rounded-xl border border-color bg-surface-alt p-3 shadow-sm"
                        >
                          <div
                            draggable
                            onDragStart={() => setDraggedItem(item.id)}
                            onDragEnd={() => setDraggedItem(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              const fromIdx = items.findIndex((it) => it.id === draggedItem);
                              if (fromIdx !== -1 && fromIdx !== index) {
                                reorderItems(fromIdx, index);
                              }
                            }}
                            className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab rounded p-1 text-tertiary hover:bg-surface-hover hover:text-primary"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>

                          <div className="ml-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_80px_80px_120px]">
                            <div className="sm:col-span-4 flex items-end gap-2">
                              <div className="flex-1">
                                <FormField
                                  label="Description"
                                  labelClassName="uppercase"
                                  inputClassName="w-full text-sm"
                                  helperText={isLast ? "Press Enter to add a new line" : undefined}
                                >
                                  <textarea
                                    value={item.description}
                                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        if (isLast) addItem();
                                      }
                                    }}
                                    placeholder="Example: Repaired kitchen sink leak"
                                    rows={2}
                                  />
                                </FormField>
                              </div>

                              {items.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={<Trash2 className="h-4 w-4" />}
                                  onClick={() => removeItem(item.id)}
                                  aria-label="Remove line"
                                  className="text-error-text hover:bg-error-bg"
                                />
                              )}
                            </div>

                            <div>
                              <FormField
                                label="Qty"
                                labelClassName="uppercase"
                                inputClassName="form-control-sm text-right font-tabular-nums"
                              >
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(item.id, { quantity: e.target.value || "1" })}
                                />
                              </FormField>
                            </div>

                            <div>
                              <FormField
                                label="Unit"
                                labelClassName="uppercase"
                                inputClassName="form-control-sm"
                                select
                              >
                                {LINE_ITEM_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </FormField>
                            </div>

                            <div className="relative">
                              <FormField
                                label="Rate"
                                labelClassName="uppercase"
                                inputClassName="form-control-sm pl-8 text-right font-tabular-nums"
                              >
                                <input
                                  type="number"
                                  min="0"
                                  step={meta.decimalPlaces === 0 ? "1" : "0.01"}
                                  value={item.unitPrice}
                                  onChange={(e) => updateItem(item.id, { unitPrice: e.target.value || "0" })}
                                />
                              </FormField>
                              <span className="pointer-events-none absolute left-3 top-6 text-tertiary text-xs">
                                {meta.symbol}
                              </span>
                            </div>

                            <div className="sm:col-span-4 flex items-end justify-between gap-2">
                              <FormField
                                label="Tax %"
                                labelClassName="uppercase"
                                inputClassName="form-control-sm pl-8 text-right font-tabular-nums"
                              >
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={toPercent(item.taxRate)}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      taxRate: fromPercentage(e.target.value.replace(/[^\d.]/g, "")),
                                    })
                                  }
                                />
                              </FormField>
                              <span className="pointer-events-none absolute left-3 top-6 text-tertiary text-xs">
                                %
                              </span>

                              <label className="flex items-center gap-1 text-xs text-tertiary">
                                <input
                                  type="checkbox"
                                  checked={item.isTaxInclusive ?? false}
                                  onChange={(e) =>
                                    updateItem(item.id, { isTaxInclusive: e.target.checked })
                                  }
                                  className="h-3 w-3 rounded border-input-border text-primary-brand focus:ring-primary"
                                />
                                Inclusive
                              </label>
                            </div>

                            {lineTotal !== undefined && lineTotal !== null && (
                              <div className="sm:col-span-4 border-t border-color pt-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-tertiary">Line total</span>
                                  <span className="font-medium text-primary font-tabular-nums">
                                    {formatCurrency(lineTotal, currency)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Plus className="h-4 w-4" />}
                        onClick={() => addItem()}
                      >
                        Add another line
                      </Button>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-color-subtle bg-surface p-4 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-bg text-primary-brand">3</span>
                    <h2 className="text-xl font-bold text-primary">When is it due?</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      label="Issue date"
                      labelClassName="uppercase flex items-center gap-1.5"
                    >
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => {
                          setIssueDate(e.target.value);
                          setTimeout(() => handleTermsChange(invoiceTerms), 0);
                        }}
                        className="form-control w-full"
                      />
                    </FormField>

                    <div>
                      <PaymentTermsWithCustomField
                        issueDate={issueDate}
                        dueDate={dueDate}
                        terms={invoiceTerms}
                        onTermsChange={handleTermsChange}
                        onDueDateChange={(d) => setDueDate(d ?? defaultDueISO())}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      label="Currency"
                      labelClassName="uppercase"
                      select
                      value={currency}
                      onChange={(e) => setCurrencyOverride(e.target.value)}
                    >
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c} ({getCurrencyMetadata(c).symbol})
                        </option>
                      ))}
                    </FormField>

                    <FormField
                      label="Tax rate"
                      labelClassName="uppercase flex items-center gap-1.5"
                      helperText="Default tax for new line items"
                    >
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={toPercent(items[0]?.taxRate ?? "0")}
                        onChange={(e) => {
                          const pct = e.target.value;
                          items.forEach((it) => {
                            updateItem(it.id, { taxRate: fromPercentage(pct.replace(/[^\d.]/g, "")) });
                          });
                        }}
                        className="form-control-sm w-full text-right font-tabular-nums"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-tertiary text-xs">
                        %
                      </span>
                    </FormField>
                  </div>

                  <div className="mt-4 space-y-3">
                    <FormTextareaField
                      label="Notes for the customer"
                      labelClassName="uppercase"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional"
                    />
                    <FormTextareaField
                      label="How should they pay?"
                      labelClassName="uppercase"
                      value={paymentInstructions}
                      onChange={(e) => setPaymentInstructions(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {calc && (
                    <div className="mt-4 border-t border-color pt-4">
                      <div className="flex justify-between text-sm font-medium text-secondary">
                        <span>Subtotal</span>
                        <span className="text-right text-primary">
                          {formatCurrency(calc.subtotal, currency)}
                        </span>
                      </div>
                      {Number(calc.taxTotal) > 0 && (
                        <div className="flex justify-between text-sm font-medium text-secondary">
                          <span>Tax</span>
                          <span className="text-right text-primary">
                            {formatCurrency(calc.taxTotal, currency)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-color-subtle pt-3 mt-1">
                        <span className="text-base font-semibold text-secondary">Total due</span>
                        <span className="text-right text-2xl font-bold text-primary">
                          {formatCurrency(calc.total, currency)}
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {step === "review" && previewInvoice && (
              <div className="space-y-6">
                <section className="rounded-xl border border-color-subtle bg-surface p-4 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-bg text-primary-brand">1</span>
                    <h2 className="text-xl font-bold text-primary">Review &amp; Finalize</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="text-tertiary">Customer</div>
                    <div className="text-right text-primary">{customer?.name || "—"}</div>
                    <div className="text-tertiary">Currency</div>
                    <div className="text-right text-primary">{currency} ({meta.symbol})</div>
                    <div className="text-tertiary">Issue date</div>
                    <div className="text-right text-primary">{issueDate || "—"}</div>
                    <div className="text-tertiary">Due date</div>
                    <div className="text-right text-primary">{dueDate || "—"}</div>
                  </div>

                  <div className="mt-4 text-sm">
                    <div className="font-medium text-secondary mb-2">Line items ({items.filter((it) => it.description.trim()).length})</div>
                    {items.filter((it) => it.description.trim()).map((item) => (
                      <div key={item.id} className="border-b border-color-subtle py-2 flex justify-between">
                        <span className="text-secondary">{item.description}</span>
                        <span className="text-primary font-tabular-nums">
                          {item.quantity} × {formatCurrency(item.unitPrice, currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {calc && (
                    <div className="mt-4 border-t border-color pt-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-tertiary">Subtotal</span>
                        <span className="text-primary font-tabular-nums">{formatCurrency(calc.subtotal, currency)}</span>
                      </div>
                      {Number(calc.taxTotal) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-tertiary">Tax</span>
                          <span className="text-primary font-tabular-nums">{formatCurrency(calc.taxTotal, currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-color-subtle pt-2 mt-2 font-semibold">
                        <span className="text-secondary">Total</span>
                        <span className="text-primary font-tabular-nums text-xl">{formatCurrency(calc.total, currency)}</span>
                      </div>
                    </div>
                  )}
                </section>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button variant="secondary" size="md" onClick={() => setStep("details")}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={<Check className="h-4 w-4" />}
                    onClick={doFinalizeAndSend}
                    loading={saving}
                    disabled={saving}
                  >
                    Finalize &amp; Send
                  </Button>
                </div>
              </div>
            )}

            {step === "done" && invoiceId && (
              <div className="space-y-6">
                <section className="rounded-xl border status-success-border status-success-bg p-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full status-success-bg status-success-text">
                    <Check className="h-6 w-6" />
                  </div>
                  <h1 className="mt-3 text-xl font-bold text-primary">Invoice is ready</h1>
                  <p className="mt-1 text-sm text-secondary">Send it now or copy the secure payment link.</p>
                  {paymentLink && (
                    <a
                      href={paymentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-action px-6 py-3 text-sm font-semibold text-on-primary shadow-md hover:bg-primary-hover hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                    >
                      <CreditCard className="h-5 w-5" />
                      Open payment page
                    </a>
                  )}
                </section>

                <section className="rounded-xl border border-color-subtle bg-surface p-4 sm:p-6">
                  <h2 className="text-lg font-bold text-primary">Send or share</h2>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button variant="secondary" size="md" icon={<Mail className="h-4 w-4" />} onClick={handleSendEmail} loading={saving}>
                      Send by email
                    </Button>
                    <Button variant="secondary" size="md" icon={<MessageCircle className="h-4 w-4" />} onClick={handleText}>
                      Send by text
                    </Button>
                    <Button variant="secondary" size="md" icon={<Share2 className="h-4 w-4" />} onClick={handleShare}>
                      Share payment link
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<Download className="h-4 w-4" />}
                      onClick={handleDownloadPdf}
                      loading={pdfLoading}
                      disabled={pdfLoading}
                    >
                      {pdfLoading ? "Preparing…" : "Download PDF"}
                    </Button>
                  </div>

                  {paymentLink && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-alt p-3">
                      <Clipboard className="h-4 w-4 flex-shrink-0 text-tertiary" />
                      <span className="min-w-0 flex-1 truncate text-xs text-secondary">{paymentLink}</span>
                      <Button variant="ghost" size="sm" icon={<Copy className="h-3 w-3" />} onClick={copyPaymentLink}>
                        Copy
                      </Button>
                    </div>
                  )}
                </section>

                <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
                  <Link to={`/app/invoices/${invoiceId}`}>
                    <Button variant="secondary" size="md">
                      <FileText className="h-4 w-4" />
                      View invoice
                    </Button>
                  </Link>
                  <Button variant="primary" size="md" onClick={() => navigate("/app/invoices")}>
                    Done
                  </Button>
                </div>
              </div>
            )}

            {step !== "done" && (
              <div className="mt-6">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto"
                  icon={<ArrowLeft className="h-4 w-4 rotate-180" />}
                  iconPosition="right"
                  onClick={goToReview}
                  disabled={step === "review"}
                >
                  Review invoice
                </Button>
              </div>
            )}
          </div>
        </aside>

        <div className="hidden lg:flex lg:flex-shrink-0 cursor-col-resize hover:bg-primary/20">
          <div style={{ width: "2px" }} />
        </div>

        <aside
          className={`${previewMobileOpen ? "block" : "hidden"} lg:flex lg:flex-col lg:overflow-y-auto bg-surface-alt`}
          style={{ width: "400px", minWidth: "320px" }}
        >
          <div className="border-b border-color bg-surface px-4 py-2 text-center text-xs text-tertiary">
            Live preview (not yet sent)
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {previewInvoice ? <InvoicePreviewV2 invoice={previewInvoice} /> : null}
          </div>
          {calc && Number(calc.amountDue.toNumber()) > 0 && previewInvoice?.paymentLink && (
            <div className="border-t border-color p-6 text-center">
              <a
                href={previewInvoice.paymentLink}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-6 py-3 text-base font-semibold text-on-primary shadow-md hover:bg-primary-hover"
              >
                <CreditCard className="h-5 w-5" />
                Pay {formatCurrency(calc.amountDue, currency)} now
              </a>
            </div>
          )}
        </aside>
      </main>

      <ConfirmationDialog
        open={showFinalizeDialog}
        onClose={() => setShowFinalizeDialog(false)}
        onConfirm={doFinalizeAndSend}
        title="Finalize and send invoice?"
        message="This will finalize the invoice (making it immutable) and send it to your customer immediately. You cannot edit a finalized invoice."
        confirmLabel="Finalize &amp; Send"
        cancelLabel="Cancel"
      />

      <StatusBadge status="draft" showLabel size="sm" className="fixed bottom-4 right-4 z-10 hidden sm:inline-flex" />
    </div>
  );
}
