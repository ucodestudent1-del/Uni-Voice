import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Download,
  FileText,
  Layers,
  Link2,
  Mail,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import {
  createInvoice,
  duplicateInvoice,
  finalizeInvoice,
  getBusiness,
  getBusinessSettings,
  getCustomer,
  getCustomers,
  getInvoice,
  getInvoicePdf,
  getProducts,
  sendInvoice,
  setInvoiceFees,
  setInvoiceItems,
  updateInvoice,
} from "../api/client";
import {
  calculationEngine,
  type FeeInput,
  type InvoiceCalculationInput,
  type LineItemInput,
} from "../utils/calculation";
import { formatCurrency, formatDate, parseDecimal } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";
import { useInvoiceValidation, type ValidationInput } from "../hooks/useInvoiceValidation";
import { useAnalytics } from "../hooks/useAnalytics";
import CustomerSelector from "./CustomerSelector";
import InvoicePreview, {
  type PreviewAttachment,
  type PreviewFee,
  type PreviewInvoice,
  type PreviewLineItem,
} from "./InvoicePreview";
import type { ApiBusiness, ApiCustomer, ApiInvoice, ApiProduct } from "../types/api";

type LineItemType = "service" | "labor" | "material" | "part" | "other";

interface WorkspaceLineItem {
  id?: string;
  type: LineItemType;
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

interface WorkspaceFee {
  description: string;
  amount: string;
  taxRate?: string;
}

interface WorkspaceAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  category: "attachment" | "before" | "after";
}

interface WorkspaceInvoiceData {
  customerId?: string | null;
  customer?: ApiCustomer | null;
  invoiceNumber?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  currency: string;
  items: WorkspaceLineItem[];
  fees: WorkspaceFee[];
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  taxRate?: string | null;
  amountPaid?: string | null;
  depositType?: "none" | "fixed" | "percentage";
  depositValue?: string | null;
  depositDueDate?: string | null;
  depositPaymentPurpose?: string | null;
  lateFeeType?: "none" | "fixed" | "percentage";
  lateFeeValue?: string | null;
  templateId?: string | null;
  status: string;
  isFinalized: boolean;
  publicToken?: string | null;
  attachments: WorkspaceAttachment[];
  beforePhotos: WorkspaceAttachment[];
  afterPhotos: WorkspaceAttachment[];
}

const LINE_ITEM_UNITS = ["each", "hour", "day", "week", "month", "fixed"] as const;

const LINE_ITEM_TYPES: { value: LineItemType; label: string; icon: React.ComponentType<any> }[] =
  [
    { value: "service", label: "Service", icon: Package },
    { value: "labor", label: "Labor", icon: Wrench },
    { value: "material", label: "Material", icon: Layers },
    { value: "part", label: "Part", icon: Package },
    { value: "other", label: "Other", icon: Receipt },
  ];

const LINE_TYPE_ICON: Record<LineItemType, React.ComponentType<any>> = {
  service: Package,
  labor: Wrench,
  material: Layers,
  part: Package,
  other: Receipt,
};

const AUTOSAVE_DELAY = 2000;

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function fmt(v: Decimal.Value, currency: string): string {
  return formatCurrency(v, currency, 2);
}

function toApiItem(item: WorkspaceLineItem) {
  return {
    productId: item.productId ?? null,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit || "each",
    unitPrice: item.unitPrice,
    discount:
      item.discount && !parseDecimal(item.discount).isZero()
        ? item.discount
        : undefined,
    discountType: item.discount ? (item.discountType ?? "fixed") : undefined,
    taxRate: item.taxRate ?? "0",
    isTaxInclusive: item.isTaxInclusive ?? false,
  };
}

function buildCalcInput(data: WorkspaceInvoiceData): InvoiceCalculationInput {
  const lineItems: LineItemInput[] = data.items.map((it) => ({
    description: it.description || "",
    quantity: it.quantity || "1",
    unit: it.unit || "each",
    unitPrice: it.unitPrice || "0",
    discount:
      it.discount && !parseDecimal(it.discount).isZero()
        ? { type: it.discountType ?? "fixed", value: it.discount }
        : undefined,
    taxRate: it.taxRate ?? data.taxRate ?? "0",
    isTaxInclusive: it.isTaxInclusive ?? false,
  }));
  const fees: FeeInput[] = data.fees.map((f) => ({
    description: f.description,
    amount: f.amount,
    taxRate: f.taxRate ?? "0",
  }));
  return {
    currency: data.currency as any,
    lineItems,
    fees: fees.length ? fees : undefined,
    amountPaid: data.amountPaid ?? "0",
  };
}

function businessAddressString(b: ApiBusiness | null): string | undefined {
  if (!b) return undefined;
  const parts = [
    b.address_line_1,
    b.address_line_2,
    b.city,
    b.state_or_region,
    [b.postal_code, b.country_code].filter(Boolean).join(" "),
    b.tax_id ? `Tax ID: ${b.tax_id}` : undefined,
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

function fileToAttachment(file: File, category: WorkspaceAttachment["category"]): WorkspaceAttachment {
  return {
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: file.name,
    size: file.size,
    type: file.type,
    url: URL.createObjectURL(file),
    category,
  };
}

function fromPercentage(pct: string): string {
  if (pct === "") return "0";
  return new Decimal(pct).div(100).toFixed(6);
}

function toPercent(rate: string | undefined | null): string {
  const v = new Decimal(rate ?? 0).mul(100);
  return v.isZero() ? "" : v.toFixed(2);
}

function toPercentDisplay(rate: string | undefined | null): string {
  const v = new Decimal(rate ?? 0).mul(100);
  if (v.isZero()) return "-";
  return `${v.toFixed(2)}%`;
}

function lineTotalDisplay(item: WorkspaceLineItem, calc?: any): string | null {
  if (calc?.lineItems) {
    const idx = calc.lineItems.findIndex((li: any) => li.description === item.description && li.lineTotal != null);
    if (idx >= 0) {
      return fmt(calc.lineItems[idx].lineTotal, "");
    }
  }
  const qty = new Decimal(item.quantity || 1);
  const price = new Decimal(item.unitPrice || 0);
  let total = qty.mul(price);
  if (item.discount && !parseDecimal(item.discount).isZero()) {
    if (item.discountType === "percentage") {
      total = total.minus(total.mul(parseDecimal(item.discount).div(100)));
    } else {
      total = total.minus(parseDecimal(item.discount));
    }
  }
  return fmt(total, "");
}

export default function InvoiceWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);

  const [invoice, setInvoice] = useState<WorkspaceInvoiceData | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [loadedInvoiceId, setLoadedInvoiceId] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("unsaved");
  const [dirty, setDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedItemsRef = useRef<string | null>(null);
  const lastSavedFeesRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewStep, setReviewStep] = useState<"review" | "success">("review");
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(560);

  const analytics = useAnalytics();

  const latestRef = useRef<{
    invoice: WorkspaceInvoiceData | null;
    invoiceId: string | null;
    isNew: boolean;
  }>({ invoice, invoiceId, isNew });
   latestRef.current = { invoice, invoiceId, isNew };

   const calc = useMemo(() => {
     if (!invoice) return null;
     try {
       return calculationEngine.calculate(buildCalcInput(invoice));
     } catch {
       return null;
     }
   }, [invoice]);

   // Memoize the validation input so useInvoiceValidation's internal useMemo
   // actually skips re-computation. The inline object literal would create a new
   // reference on every render, defeating the memo and causing the calculation
   // engine to run on every render.
   const validationInput = useMemo<ValidationInput | null>(
     () =>
       invoice
         ? {
             customerId: invoice.customerId,
             customer: invoice.customer ?? undefined,
             currency: invoice.currency,
             issueDate: invoice.issueDate ?? undefined,
             dueDate: invoice.dueDate ?? undefined,
             items: invoice.items.map((it) => ({
               description: it.description,
               quantity: it.quantity,
               unit: it.unit,
               unitPrice: it.unitPrice,
               discount: it.discount,
               discountType: it.discountType,
               taxRate: it.taxRate,
               isTaxInclusive: it.isTaxInclusive,
             })),
             fees: invoice.fees.map((f) => ({
               description: f.description,
               amount: f.amount,
               taxRate: f.taxRate,
             })),
             notes: invoice.notes,
             terms: invoice.terms,
             paymentInstructions: invoice.paymentInstructions,
           }
         : null,
     [invoice]
   );

   const validation = useInvoiceValidation(validationInput, calc ?? undefined);

   useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      try {
        // Only fetch business + settings eagerly; these are needed for new-invoice
        // defaults (currency, notes, terms, tax rate) and the live preview.
        // Customers and products are deferred to avoid blocking the editor load —
        // CustomerSelector lazy-loads on open and can accept preloaded data.
        const [bizRes, settingsRes, customersRes, productsRes] = await Promise.allSettled([
          getBusiness().catch(() => null),
          getBusinessSettings().catch(() => ({ settings: {} })),
          getCustomers({ limit: 100, includeArchived: false }).catch(() => ({ data: [] })),
          getProducts({ limit: 200 }).catch(() => ({ products: [] })),
        ]);
        if (cancelled) return;
        if (bizRes.status === "fulfilled" && bizRes.value) setBusiness(bizRes.value.business ?? null);
        const s = settingsRes.status === "fulfilled" ? settingsRes.value : { settings: {} };
        setSettings(s.settings ?? {});
        if (customersRes.status === "fulfilled") setCustomers(customersRes.value.data ?? []);
        if (productsRes.status === "fulfilled") setProducts(productsRes.value.products ?? []);
      } catch {
        // context failed — workspace still usable with defaults
      }
    }
    loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultTaxRate = settings?.default_tax_rate ?? "0";
  const defaultCurrency = business?.default_currency ?? settings?.default_currency ?? "USD";

  useEffect(() => {
    if (!isNew) return;
    setInvoice({
      customerId: undefined,
      customer: null,
      invoiceNumber: null,
      issueDate: todayISO(),
      dueDate: addDaysISO(todayISO(), 30),
      currency: defaultCurrency,
      items: [],
      fees: [],
      notes: settings.default_notes ?? "",
      terms: settings.default_terms ?? "Net 30",
      paymentInstructions: settings.default_payment_instructions ?? "",
      taxRate: settings.default_tax_rate ?? "0",
      amountPaid: "0",
      depositType: "none",
      depositValue: "0",
      depositDueDate: null,
      depositPaymentPurpose: null,
      lateFeeType: "none",
      lateFeeValue: "0",
      templateId: null,
      status: "draft",
      isFinalized: false,
      publicToken: null,
      attachments: [],
      beforePhotos: [],
      afterPhotos: [],
    });
    setLoadedInvoiceId("new");
  }, [isNew, defaultCurrency, settings]);

  useEffect(() => {
    if (isNew || invoiceId || loadedInvoiceId === id) return;
    let cancelled = false;
    async function loadInvoice() {
      setLoading(true);
      try {
        const res = await getInvoice(id as string);
        const inv: ApiInvoice = res.invoice;
        let cust: ApiCustomer | null = null;
        if (inv.customer_id) {
          const cached = customers.find((c) => c.id === inv.customer_id) ?? null;
          if (cached) {
            cust = cached;
          } else {
            try {
              cust = (await getCustomer(inv.customer_id)).customer ?? null;
            } catch (err) {
              console.warn("Failed to fetch customer:", err);
              cust = null;
            }
          }
        }
        const mapped: WorkspaceInvoiceData = {
          customerId: inv.customer_id ?? null,
          customer: cust,
          invoiceNumber: inv.invoice_number ?? null,
          issueDate: inv.issue_date ? inv.issue_date.split("T")[0] : null,
          dueDate: inv.due_date ? inv.due_date.split("T")[0] : null,
          currency: inv.currency,
          items: (inv.items ?? []).map((it): WorkspaceLineItem => ({
            id: it.id,
            type: "service",
            description: it.description,
            quantity: it.quantity,
            unit: it.unit || "each",
            unitPrice: it.unit_price,
            discount: it.discount ? String(it.discount) : "",
            discountType: it.discount_type ?? "fixed",
            taxRate: it.tax_rate,
            isTaxInclusive: it.is_tax_inclusive ?? false,
            productId: it.product_id ?? null,
          })),
          fees: (inv.fees ?? []).map((f): WorkspaceFee => ({
            description: f.description,
            amount: f.amount,
            taxRate: f.tax_rate,
          })),
          notes: inv.notes ?? "",
          terms: inv.terms ?? "",
          paymentInstructions: inv.payment_instructions ?? "",
          taxRate: settings.default_tax_rate ?? "0",
          amountPaid: inv.amount_paid ?? "0",
          depositType: inv.deposit_type ?? "none",
          depositValue: inv.deposit_value ?? "0",
          depositDueDate: inv.deposit_due_date ?? null,
          depositPaymentPurpose: inv.deposit_payment_purpose ?? null,
          lateFeeType: inv.late_fee_type ?? "none",
          lateFeeValue: inv.late_fee_value ?? "0",
          templateId: inv.template_id ?? null,
          status: inv.status,
          isFinalized: inv.is_finalized ?? false,
          publicToken: inv.public_token ?? null,
          attachments: [],
          beforePhotos: [],
          afterPhotos: [],
        };
        if (!cancelled) {
          setInvoice(mapped);
          setInvoiceId(inv.id);
          setLoadedInvoiceId(inv.id);
          setSaveState("saved");
          setDirty(false);
          lastSavedItemsRef.current = JSON.stringify(mapped.items);
          lastSavedFeesRef.current = JSON.stringify(mapped.fees);
        }
      } catch (err: any) {
        if (!cancelled) {
          setActionMessage(err?.response?.data?.error || "Failed to load invoice");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInvoice();
  }, [id, isNew, invoiceId, loadedInvoiceId, settings.default_tax_rate]);

  function markDirtyAndSchedule() {
    const { invoice: cur } = latestRef.current;
    if (!cur) return;
    setDirty(true);
    setSaveState("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), AUTOSAVE_DELAY);
  }

  function updateData(partial: Partial<WorkspaceInvoiceData>) {
    const { invoice: cur } = latestRef.current;
    if (!cur) return;
    const next = { ...cur, ...partial };
    setInvoice(next);
    setDirty(true);
    setSaveState("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), AUTOSAVE_DELAY);
  }

  async function doSave() {
    const { invoice: cur, invoiceId: curId, isNew: newFlag } = latestRef.current;
    if (!cur) return;
    setSaveState("saving");
    try {
      const metaPayload = {
        customerId: cur.customerId,
        currency: cur.currency,
        issueDate: cur.issueDate,
        dueDate: cur.dueDate,
        notes: cur.notes,
        terms: cur.terms,
        paymentInstructions: cur.paymentInstructions,
        templateId: cur.templateId,
        depositType: cur.depositType || "none",
        depositAmount: cur.depositValue || "0",
        depositDueDate: cur.depositDueDate,
        depositPaymentPurpose: cur.depositPaymentPurpose,
        lateFeeType: cur.lateFeeType || "none",
        lateFeeValue: cur.lateFeeValue || "0",
      };
      const apiItems = cur.items.map(toApiItem);
      const apiFees = cur.fees;

      if (!curId) {
        const res = await createInvoice({ ...metaPayload, items: apiItems, fees: apiFees });
        setInvoiceId(res.invoiceId);
        setLoadedInvoiceId(res.invoiceId);
        lastSavedItemsRef.current = JSON.stringify(apiItems);
        lastSavedFeesRef.current = JSON.stringify(apiFees);
        if (newFlag) {
          navigate(`/app/invoices/${res.invoiceId}/edit`, { replace: true });
        }
      } else {
        await updateInvoice(curId, metaPayload);
        if (JSON.stringify(apiItems) !== lastSavedItemsRef.current) {
          await setInvoiceItems(curId, apiItems);
          lastSavedItemsRef.current = JSON.stringify(apiItems);
        }
        if (JSON.stringify(apiFees) !== lastSavedFeesRef.current) {
          await setInvoiceFees(curId, apiFees);
          lastSavedFeesRef.current = JSON.stringify(apiFees);
        }
      }
      setSaveState("saved");
      setDirty(false);
      analytics.trackInvoiceCreated({
        invoiceId: curId ?? latestRef.current.invoiceId,
        currency: cur.currency,
        itemCount: cur.items.length,
      });
    } catch (err: any) {
      setSaveState("error");
      setActionMessage(err?.response?.data?.error || "Failed to save invoice");
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleField = (field: keyof WorkspaceInvoiceData, value: any) => {
    const patch: Partial<WorkspaceInvoiceData> =
      field === "customerId"
        ? {
            customerId: value,
            customer: customers.find((c) => c.id === value) ?? null,
          }
        : { [field]: value };
    updateData(patch);
  };

  const handleItemChange = (itemId: string, patch: Partial<WorkspaceLineItem>) => {
    setInvoice((prev) =>
      prev
        ? { ...prev, items: prev.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
        : prev
    );
    markDirtyAndSchedule();
  };

  function addItem(type: LineItemType = "service") {
    const newItem: WorkspaceLineItem = {
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      description: "",
      quantity: "1",
      unitPrice: "",
      discount: "",
      discountType: "fixed",
      taxRate: invoice?.taxRate ?? defaultTaxRate,
      unit: "each",
      isTaxInclusive: false,
      productId: null,
    };
    setInvoice((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : prev));
    markDirtyAndSchedule();
  }

  function duplicateItem(itemId: string) {
    const item = invoice?.items.find((it) => it.id === itemId);
    if (!item) return;
    const newItem: WorkspaceLineItem = {
      ...item,
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      description: `${item.description} (copy)`,
    };
    setInvoice((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : prev));
    markDirtyAndSchedule();
  }

  function removeItem(itemId: string) {
    setInvoice((prev) =>
      prev ? { ...prev, items: prev.items.filter((it) => it.id !== itemId) } : prev
    );
    markDirtyAndSchedule();
  }

  function addFromProduct(product: ApiProduct) {
    const newItem: WorkspaceLineItem = {
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: "service",
      description: product.name,
      quantity: "1",
      unit: product.unit || "each",
      unitPrice: product.default_unit_price || "0",
      discount: "",
      discountType: "fixed",
      taxRate: product.default_tax_rate || invoice?.taxRate || "0",
      isTaxInclusive: false,
      productId: product.id,
    };
    setInvoice((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : prev));
    markDirtyAndSchedule();
  }

  function handleFilesSelected(files: FileList | null, category: "attachment" | "before" | "after") {
    if (!files?.length || !invoice) return;
    const additions = Array.from(files).map((f) => fileToAttachment(f, category));
    setInvoice((prev) => {
      if (!prev) return prev;
      if (category === "attachment")
        return { ...prev, attachments: [...prev.attachments, ...additions] };
      if (category === "before") return { ...prev, beforePhotos: [...prev.beforePhotos, ...additions] };
      return { ...prev, afterPhotos: [...prev.afterPhotos, ...additions] };
    });
    markDirtyAndSchedule();
  }

  function removeAttachment(category: "attachment" | "before" | "after", id: string) {
    setInvoice((prev) => {
      if (!prev) return prev;
      const rm = (list: WorkspaceAttachment[]) => list.filter((a) => a.id !== id);
      return {
        ...prev,
        attachments: category === "attachment" ? rm(prev.attachments) : prev.attachments,
        beforePhotos: category === "before" ? rm(prev.beforePhotos) : prev.beforePhotos,
        afterPhotos: category === "after" ? rm(prev.afterPhotos) : prev.afterPhotos,
      };
    });
    markDirtyAndSchedule();
  }

  const allAttachments = useMemo(() => {
    if (!invoice) return [];
    return [...invoice.beforePhotos, ...invoice.afterPhotos, ...invoice.attachments];
  }, [invoice?.attachments, invoice?.beforePhotos, invoice?.afterPhotos]);

  const previewInvoice = useMemo((): PreviewInvoice | null => {
    if (!invoice || !calc) return null;
    const previewItems: PreviewLineItem[] = invoice.items.map((it) => ({
      description: it.description,
      quantity: it.quantity || "1",
      unit: it.unit || "each",
      unitPrice: it.unitPrice || "0",
      discount: it.discount && Number(it.discount) > 0 ? it.discount : undefined,
      discountType: it.discountType,
      taxRate: it.taxRate,
      isTaxInclusive: it.isTaxInclusive ?? false,
    }));
    const previewFees: PreviewFee[] = invoice.fees.map((f) => ({
      description: f.description,
      amount: f.amount,
      taxRate: f.taxRate,
    }));
    const attachments: PreviewAttachment[] = allAttachments.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      type: a.type,
      category: a.category,
    }));
    const paymentInstructions =
      invoice.paymentInstructions ??
      (invoice.isFinalized
        ? `Please pay ${fmt(calc.amountDue, invoice.currency)} by the due date.`
        : undefined) ??
      undefined;
    return {
      businessName: business?.name || business?.legal_name || "Untitled Business",
      businessEmail: business?.email ?? undefined,
      businessPhone: business?.phone ?? undefined,
      businessWebsite: business?.website ?? undefined,
      businessAddress: businessAddressString(business),
      businessLogo: business?.logo_url ?? undefined,
      customerName: invoice.customer?.name ?? customers.find((c) => c.id === invoice.customerId)?.name ?? undefined,
      customerCompanyName:
        invoice.customer?.companyName ?? customers.find((c) => c.id === invoice.customerId)?.companyName ?? undefined,
      customerEmail: invoice.customer?.email ?? customers.find((c) => c.id === invoice.customerId)?.email ?? undefined,
      customerAddress: invoice.customer ? customerAddressString(invoice.customer) : undefined,
      invoiceNumber: invoice.invoiceNumber ?? (invoiceId ? "Draft" : undefined),
      issueDate: invoice.issueDate ? formatDate(invoice.issueDate) : undefined,
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : undefined,
      currency: invoice.currency,
      notes: invoice.notes ?? undefined,
      terms: invoice.terms ?? undefined,
      paymentInstructions,
      items: previewItems,
      fees: previewFees,
      subtotal: calc.subtotal.toFixed(2),
      discountTotal: calc.discountTotal.toFixed(2),
      taxTotal: calc.taxTotal.toFixed(2),
      feeTotal: calc.feeTotal.toFixed(2),
      total: calc.total.toFixed(2),
      amountPaid: calc.amountPaid.toFixed(2),
      amountDue: calc.amountDue.toFixed(2),
      status: invoice.isFinalized ? invoice.status : "draft",
      paymentLink:
        invoice.isFinalized && invoice.publicToken
          ? `${window.location.origin}/invoice/${invoice.publicToken}`
          : undefined,
    };
  }, [invoice, calc, business, customers, invoiceId, allAttachments]);

  async function handleSaveDraft() {
    await doSave();
  }

  async function handleCreateAnother() {
    if (dirty) {
      const ok = window.confirm(
        "You have unsaved changes. Create another invoice anyway? Your current work has been/will be saved as a draft."
      );
      if (!ok) return;
    }
    await doSave();
    navigate("/app/invoices/new", { replace: true });
  }

  async function handleDuplicate() {
    if (!invoiceId) {
      await doSave();
    }
    const { invoiceId: curId } = latestRef.current;
    if (!curId) return;
    try {
      const res = await duplicateInvoice(curId);
      analytics.track("invoice_saved", { sourceInvoiceId: curId, newInvoiceId: res.invoiceId });
      navigate(`/app/invoices/${res.invoiceId}/edit`);
    } catch (err: any) {
      setActionMessage(err?.response?.data?.error || "Failed to duplicate invoice");
    }
  }

  async function downloadPdf() {
    const { invoiceId: curId } = latestRef.current;
    if (!curId) return;
    try {
      const blob = await getInvoicePdf(curId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice?.invoiceNumber || curId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionMessage(err?.response?.data?.error || "Failed to download PDF");
    }
  }

  async function handleReviewAndSend() {
    if (validation.hasErrors) {
      setActionMessage("Please fix the highlighted issues before sending.");
      return;
    }
    if (!latestRef.current.invoiceId) {
      await doSave();
    }
    setReviewStep("review");
    setReviewError(null);
    setReviewOpen(true);
  }

  async function handleFinalizeAndSend() {
    const { invoiceId: curId, invoice: cur, isNew: newFlag } = latestRef.current;
    if (!cur || !curId) return;
    if (!cur.customerId) {
      setReviewError("Select a customer before sending.");
      return;
    }
    setReviewSending(true);
    setReviewError(null);
    try {
      if (!cur.isFinalized) {
        const finalRes = await finalizeInvoice(curId);
        setInvoice((prev) =>
          prev
            ? {
                ...prev,
                isFinalized: true,
                status: "draft",
                invoiceNumber: prev.invoiceNumber ?? finalRes.invoiceNumber ?? null,
              }
            : prev
        );
        const refreshed = await getInvoice(curId);
        setInvoice((prev) =>
          prev
            ? {
                ...prev,
                invoiceNumber: refreshed.invoice.invoice_number ?? prev.invoiceNumber ?? null,
                status: refreshed.invoice.status,
                publicToken: refreshed.invoice.public_token ?? null,
              }
            : prev
        );
      }
      await sendInvoice(curId);
      const refreshed = await getInvoice(curId);
      setInvoice((prev) =>
        prev
          ? {
              ...prev,
               isFinalized: true,
              status: "sent",
              invoiceNumber: refreshed.invoice.invoice_number ?? prev.invoiceNumber ?? null,
              publicToken: refreshed.invoice.public_token ?? null,
            }
          : prev
      );
      analytics.trackInvoiceSent({ invoiceId: curId, currency: cur.currency });
      setReviewStep("success");
    } catch (err: any) {
      setReviewError(err?.response?.data?.error || "Failed to finalize or send the invoice");
    } finally {
      setReviewSending(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  if (!invoice) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <div className="flex items-center gap-3 text-secondary">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Setting up your invoice…</span>
        </div>
      </div>
    );
  }

  if (loading && invoiceId) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <div className="flex items-center gap-3 text-secondary">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading invoice…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-page text-primary">
      <WorkspaceHeader
        isNew={isNew}
        invoiceId={invoiceId}
        invoiceNumber={invoice.invoiceNumber}
        saveState={saveState}
        validation={validation}
      />

    {actionMessage && (
      <div className="fixed top-4 right-4 z-40 max-w-sm rounded-lg bg-surface-elevated px-4 py-3 text-sm text-primary shadow-lg">
        {actionMessage}
      </div>
    )}

    <main className="flex flex-1 overflow-hidden">
      <aside className="flex w-full min-w-0 flex-[3] flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-color bg-surface">
          <CustomerHeaderSection invoice={invoice} onField={handleField} customers={customers} />
          <TotalsCard invoice={invoice} calc={calc} onField={handleField} />
        </div>
        <div className="overflow-y-auto px-8 py-6">
          {validation.hasErrors && (
            <ValidationBanner issues={validation.issues} />
          )}
          {invoice.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-color bg-surface py-12">
              <FileText className="h-10 w-10 text-tertiary" />
              <p className="mt-3 text-sm text-tertiary">No line items yet.</p>
              <button
                type="button"
                onClick={() => addItem("service")}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover"
              >
                <Plus className="h-4 w-4" />
                Add line item
              </button>
            </div>
          ) : (
            <LineItemsTable
              invoice={invoice}
              calc={calc}
              onItemChange={handleItemChange}
              onAdd={addItem}
              onDuplicate={duplicateItem}
              onRemove={removeItem}
              defaultTaxRate={invoice.taxRate ?? defaultTaxRate}
            />
          )}

          {products.length > 0 && invoice.items.length > 0 && (
            <SavedServicesBar products={products} onSelect={addFromProduct} />
          )}

          <FeesSection
            fees={invoice.fees}
            onChange={(fees) => updateData({ fees })}
          />

          <PaymentConfigurationSection
            invoice={invoice}
            onField={handleField}
          />

          <NotesSection
            invoice={invoice}
            onField={handleField}
            onFiles={handleFilesSelected}
            attachments={invoice.attachments}
            beforePhotos={invoice.beforePhotos}
            afterPhotos={invoice.afterPhotos}
            onRemoveAttachment={removeAttachment}
          />
        </div>
      </aside>

      <div
        onMouseDown={startResize}
        className="flex-shrink-0 cursor-col-resize hover:bg-primary/20"
        style={{ width: "8px" }}
        aria-label="Resize preview"
      />

      <aside
        className="flex flex-col overflow-y-auto bg-surface-alt"
        style={{ width: `${previewWidth}px`, minWidth: "320px" }}
      >
        <div className="border-b border-color bg-surface px-6 py-3 text-center text-xs text-tertiary">
          {invoice.isFinalized ? "Customer view" : "Live preview (not yet sent)"}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {previewInvoice ? <InvoicePreview invoice={previewInvoice} /> : null}
        </div>
        {previewInvoice && previewInvoice.amountDue && Number(parseDecimal(previewInvoice.amountDue).toFixed(2)) > 0 && (
          <div className="border-t border-color p-6 text-center">
            <a
              href={previewInvoice.paymentLink ?? "#"}
              onClick={(e) => {
                if (!previewInvoice.paymentLink) {
                  e.preventDefault();
                  copyToClipboard(
                    "Payment link will be available once the invoice is finalized and sent."
                  );
                }
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-on-primary shadow-md ${
                previewInvoice.paymentLink
                  ? "bg-primary-action hover:bg-primary-hover"
                  : "cursor-not-allowed bg-tertiary"
              }`}
            >
              <CreditCard className="h-5 w-5" />
              Pay {fmt(parseDecimal(previewInvoice.amountDue), previewInvoice.currency)} now
            </a>
          </div>
        )}
      </aside>
    </main>

    <ActionFooter
      isNew={isNew}
      hasInvoiceId={!!invoiceId}
      saveState={saveState}
      onSaveDraft={handleSaveDraft}
      onDuplicate={handleDuplicate}
      onCreateAnother={handleCreateAnother}
      onPreview={() => setPreviewOpen(true)}
      onReviewAndSend={handleReviewAndSend}
      validation={validation}
    />

    {reviewOpen && (
      <ReviewAndSendDialog
        invoice={invoice}
        invoiceId={invoiceId}
        calc={calc}
        validation={validation}
        step={reviewStep}
        sending={reviewSending}
        error={reviewError}
        onFinalizeAndSend={handleFinalizeAndSend}
        onClose={() => setReviewOpen(false)}
        onCopyPaymentLink={() => {
          if (invoice.publicToken) {
            copyToClipboard(`${window.location.origin}/invoice/${invoice.publicToken}`);
            setActionMessage("Payment link copied to clipboard");
          }
        }}
        onDownloadPdf={downloadPdf}
      />
    )}

    {previewOpen && previewInvoice && (
      <PreviewDialog invoice={previewInvoice} onClose={() => setPreviewOpen(false)} onDownloadPdf={downloadPdf} />
    )}
  </div>
  );

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = previewWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(640, Math.max(320, startWidth + (ev.clientX - startX)));
      setPreviewWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const WorkspaceHeader = React.memo(function WorkspaceHeader({
  isNew,
  invoiceId,
  invoiceNumber,
  saveState,
  validation,
}: {
  isNew: boolean;
  invoiceId: string | null;
  invoiceNumber: string | null | undefined;
  saveState: "saved" | "saving" | "unsaved" | "error";
  validation: ReturnType<typeof useInvoiceValidation>;
}) {
  const navigate = useNavigate();
  const navigateBack = () => navigate("/app/invoices", { replace: true });

  const statusLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
      ? "Saved"
      : saveState === "error"
      ? "Save failed"
      : "Unsaved";

  const statusColor =
    saveState === "saved"
      ? "text-success-text"
      : saveState === "saving"
      ? "text-tertiary"
      : saveState === "error"
      ? "text-error-text"
      : "text-warning-text";

  return (
    <header className="flex h-14 items-center justify-between border-b border-color bg-surface px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={navigateBack}
          className="rounded-lg p-1.5 text-tertiary hover-bg-hover hover:text-primary"
          aria-label="Back to invoices"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-tertiary">|</span>
        <h1 className="text-xl font-semibold text-primary">
          {invoiceNumber ? `Invoice #${invoiceNumber}` : isNew ? "Create Invoice" : "Edit Invoice"}
        </h1>
        {invoiceId && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-medium text-tertiary">
            {isNew ? "Draft" : "Editing"}
          </span>
        )}
        {!invoiceId && isNew && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-medium text-warning-text">
            <AlertCircle className="h-3 w-3" /> Not yet saved
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 text-sm font-medium ${statusColor}`}>
          {saveState === "saved" ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {statusLabel}
        </div>
        {validation.hasErrors && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-error-bg px-2.5 py-0.5 text-xs font-medium text-error-text">
            <AlertCircle className="h-3 w-3" /> {validation.issues.filter((i) => i.severity === "error").length} issue
            {validation.issues.filter((i) => i.severity === "error").length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </header>
  );
});

const CustomerHeaderSection = React.memo(function CustomerHeaderSection({
  invoice,
  onField,
  customers,
}: {
  invoice: WorkspaceInvoiceData;
  onField: (field: keyof WorkspaceInvoiceData, value: any) => void;
  customers: ApiCustomer[];
}) {
  return (
    <div className="flex flex-wrap items-end gap-4 p-6">
      <div className="flex flex-col">
        <label className="text-xs font-semibold text-tertiary uppercase">Customer</label>
        <div className="mt-1 w-64">
          <CustomerSelector
            value={invoice.customerId ?? undefined}
            onChange={(cid) => onField("customerId", cid)}
            onCustomerChange={(c) => onField("customer", c ?? null)}
            placeholder="Select a customer"
            preloadedCustomers={customers}
          />
        </div>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-semibold text-tertiary uppercase">Invoice #</label>
        <input
          type="text"
          value={invoice.invoiceNumber ?? ""}
          onChange={(e) => onField("invoiceNumber", e.target.value || null)}
          placeholder="Auto-assigned"
          disabled={invoice.isFinalized}
          className="mt-1 w-36 rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-semibold text-tertiary uppercase">Issue date</label>
        <input
          type="date"
          value={invoice.issueDate ?? ""}
          onChange={(e) => onField("issueDate", e.target.value || null)}
          className="mt-1 w-40 rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-semibold text-tertiary uppercase">Due date</label>
        <input
          type="date"
          value={invoice.dueDate ?? ""}
          onChange={(e) => onField("dueDate", e.target.value || null)}
          className="mt-1 w-40 rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-semibold text-tertiary uppercase">Currency</label>
        <select
          value={invoice.currency}
          onChange={(e) => onField("currency", e.target.value)}
          className="mt-1 w-28 rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CNY"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-semibold text-tertiary uppercase">Tax rate</label>
        <input
          type="text"
          value={toPercent(invoice.taxRate ?? "0")}
          onChange={(e) => onField("taxRate", fromPercentage(e.target.value.replace(/[^\d.]/g, "")))}
          placeholder="e.g. 8.5"
          className="mt-1 w-24 rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
});

const TotalsCard = React.memo(function TotalsCard({
  invoice,
  calc,
  onField,
}: {
  invoice: WorkspaceInvoiceData;
  calc: any;
  onField: (field: keyof WorkspaceInvoiceData, value: any) => void;
}) {
  const c = invoice.currency;
  const total = calc?.total ?? 0;
  const due = calc?.amountDue ?? 0;
  const discount = calc?.discountTotal ?? 0;
  const tax = calc?.taxTotal ?? 0;
  const fees = calc?.feeTotal ?? 0;
  const subtotal = calc?.subtotal ?? 0;

  return (
    <div className="border-t border-color px-6 py-4">
      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="text-tertiary">Subtotal</div>
        <div className="text-right font-medium text-primary">{fmt(subtotal, c)}</div>
        {Number(new Decimal(discount ?? 0).toString()) > 0 && (
          <>
            <div className="text-tertiary">Discount</div>
            <div className="text-right font-medium text-success-text">−{fmt(discount, c)}</div>
          </>
        )}
        {Number(new Decimal(tax ?? 0).toString()) > 0 && (
          <>
            <div className="text-tertiary">Tax</div>
            <div className="text-right font-medium text-primary">{fmt(tax, c)}</div>
          </>
        )}
        {Number(new Decimal(fees ?? 0).toString()) > 0 && (
          <>
            <div className="text-tertiary">Fees</div>
            <div className="text-right font-medium text-primary">{fmt(fees, c)}</div>
          </>
        )}
        <div className="border-t border-color pt-2 text-secondary">Total</div>
        <div className="border-t border-color pt-2 text-right text-xl font-bold text-primary">
          {fmt(total, c)}
        </div>

        <div className="pt-2 text-tertiary">Amount paid</div>
        <div className="pt-2 text-right">
          <input
            type="number"
            value={invoice.amountPaid ?? "0"}
            onChange={(e) => onField("amountPaid", e.target.value || null)}
            className="w-28 rounded-lg border border-input-border bg-input px-2 py-1 text-right text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="pt-1 text-secondary">Balance due</div>
        <div className="pt-1 text-right text-xl font-bold text-primary-brand">{fmt(due, c)}</div>
      </div>
    </div>
  );
});

const SavedServicesBar = React.memo(function SavedServicesBar({
  products,
  onSelect,
}: {
  products: ApiProduct[];
  onSelect: (p: ApiProduct) => void;
}) {
  return (
    <div className="mb-6 border border-color rounded-xl bg-surface p-4">
      <p className="mb-2 text-xs font-semibold text-tertiary uppercase">Saved services</p>
      <div className="flex gap-2 overflow-x-auto">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="flex flex-col items-start rounded-lg border border-color bg-surface-alt px-3 py-2 text-left whitespace-nowrap hover:border-color-strong hover:bg-surface"
          >
            <span className="text-sm font-medium text-primary">{p.name}</span>
            <span className="text-xs text-tertiary">{fmt(p.default_unit_price, p.default_currency)}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

const LineItemsTable = React.memo(function LineItemsTable({
  invoice,
  calc,
  onItemChange,
  onAdd,
  onDuplicate,
  onRemove,
  defaultTaxRate,
}: {
  invoice: WorkspaceInvoiceData;
  calc: any;
  onItemChange: (id: string, patch: Partial<WorkspaceLineItem>) => void;
  onAdd: (type?: LineItemType) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  defaultTaxRate: string;
}) {
  const c = invoice.currency;
  const meta = getCurrencyMetadata(c);
  const step = meta.decimalPlaces === 0 ? "1" : "0.01";
  const lineTotals = calc?.lineItems ?? [];

  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-color bg-surface">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-surface-alt text-left text-xs font-semibold text-tertiary uppercase">
            <th className="w-[20%] px-4 py-3">Description</th>
            <th className="w-[6%] px-2 py-3 text-right">Qty</th>
            <th className="w-[8%] px-2 py-3">Unit</th>
            <th className="w-[12%] px-2 py-3 text-right">Rate</th>
            <th className="w-[7%] px-2 py-3">Disc.</th>
            <th className="w-[7%] px-2 py-3">Type</th>
            <th className="w-[7%] px-2 py-3 text-right">Tax %</th>
            <th className="w-[5%] px-2 py-3 text-center">Inc.</th>
            <th className="w-[12%] px-2 py-3 text-right">Total</th>
            <th className="w-[8%] px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => {
            const lineTotal = lineTotals[i]?.lineTotal ?? null;
            return (
              <tr key={item.id ?? i} className="border-t border-color-subtle">
                <td className="px-4 py-3">
                  <textarea
                    value={item.description}
                    onChange={(e) => onItemChange(item.id ?? String(i), { description: e.target.value })}
                    placeholder="What did you do?"
                    rows={2}
                    className="w-full min-h-[40px] resize-y rounded-lg border border-input-border bg-input px-2 py-1.5 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary overflow-hidden"
                  />
                </td>
                <td className="px-2 py-3">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      onItemChange(item.id ?? String(i), { quantity: e.target.value || "1" })
                    }
                    min={1}
                    step="any"
                    className="w-full rounded-lg border border-input-border bg-input px-2 py-1.5 text-right text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </td>
                <td className="px-2 py-3">
                  <select
                    value={item.unit}
                    onChange={(e) =>
                      onItemChange(item.id ?? String(i), { unit: e.target.value })
                    }
                    className="w-full rounded-lg border border-input-border bg-input px-2 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    title="Unit"
                  >
                    {LINE_ITEM_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-3">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-tertiary text-xs">
                      {meta.symbol}
                    </span>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) =>
                        onItemChange(item.id ?? String(i), { unitPrice: e.target.value || "0" })
                      }
                      min={0}
                      step={step}
                      className="w-full rounded-lg border border-input-border bg-input px-6 py-1.5 text-right text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </td>
                <td className="px-2 py-3">
                  <input
                    type="number"
                    value={item.discount ?? ""}
                    onChange={(e) =>
                      onItemChange(item.id ?? String(i), { discount: e.target.value || "" })
                    }
                    min={0}
                    step={step}
                    className="w-full rounded-lg border border-input-border bg-input px-2 py-1.5 text-right text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-2 py-3">
                  <select
                    value={item.discountType ?? "fixed"}
                    onChange={(e) =>
                      onItemChange(item.id ?? String(i), { discountType: e.target.value as "fixed" | "percentage" })
                    }
                    className="w-full rounded-lg border border-input-border bg-input px-2 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    title="Discount type"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">%</option>
                  </select>
                </td>
                <td className="px-2 py-3">
                  <input
                    type="number"
                    value={toPercent(item.taxRate ?? defaultTaxRate)}
                    onChange={(e) =>
                      onItemChange(item.id ?? String(i), {
                        taxRate: fromPercentage(e.target.value.replace(/[^\d.]/g, "")),
                      })
                    }
                    min={0}
                    max={100}
                    step="0.01"
                    className="w-full rounded-lg border border-input-border bg-input px-2 py-1.5 text-right text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    title="Tax rate %"
                  />
                </td>
                <td className="px-2 py-3">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={item.isTaxInclusive ?? false}
                      onChange={(e) =>
                        onItemChange(item.id ?? String(i), { isTaxInclusive: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-input-border text-primary-brand focus:ring-primary"
                      title={item.isTaxInclusive ? "Tax-inclusive" : "Tax-exclusive"}
                    />
                  </div>
                </td>
                <td className="px-2 py-3 text-right text-sm font-medium text-primary">
                  {lineTotal !== null ? fmt(lineTotal, c) : ""}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDuplicate(item.id ?? String(i))}
                      title="Duplicate line"
                      className="rounded p-1.5 text-tertiary hover-bg-hover hover:text-primary"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id ?? String(i))}
                      title="Remove line"
                      className="rounded p-1.5 text-tertiary hover:bg-error-bg hover:text-error-text"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-color p-3 text-center">
        <button
          type="button"
          onClick={() => onAdd("service")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-alt px-3 py-1.5 text-sm text-secondary hover:bg-surface"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another line
        </button>
      </div>
    </div>
  );
});

const FeesSection = React.memo(function FeesSection({
  fees,
  onChange,
}: {
  fees: WorkspaceFee[];
  onChange: (fees: WorkspaceFee[]) => void;
}) {
  const addFee = () =>
    onChange([
      ...fees,
      { description: "", amount: "", taxRate: "0" },
    ]);
  const updateFee = (i: number, patch: Partial<WorkspaceFee>) => {
    const next = [...fees];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const removeFee = (i: number) => {
    const next = [...fees];
    next.splice(i, 1);
    onChange(next);
  };
  if (fees.length === 0) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={addFee}
          className="inline-flex items-center gap-1.5 rounded-lg border border-color bg-surface px-3 py-1.5 text-sm text-secondary hover:bg-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Add fee or charge
        </button>
      </div>
    );
  }
  return (
    <div className="mb-6 space-y-2">
      <p className="text-xs font-semibold text-tertiary uppercase"> Fees &amp; charges</p>
      {fees.map((fee, i) => (
        <div key={i} className="flex items-end gap-2 rounded-lg border border-color bg-surface p-2">
          <input
            type="text"
            value={fee.description}
            onChange={(e) => updateFee(i, { description: e.target.value })}
            placeholder="Description"
            className="flex-1 rounded border border-input-border bg-input px-2 py-1 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="number"
            value={fee.amount}
            onChange={(e) => updateFee(i, { amount: e.target.value || "0" })}
            placeholder="0.00"
            className="w-24 rounded border border-input-border bg-input px-2 py-1 text-right text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => removeFee(i)}
            className="rounded p-1 text-tertiary hover:bg-error-bg hover:text-error-text"
            title="Remove fee"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addFee}
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        Add another fee
      </button>
    </div>
  );
});

const PaymentConfigurationSection = React.memo(function PaymentConfigurationSection({
  invoice,
  onField,
}: {
  invoice: WorkspaceInvoiceData;
  onField: (field: keyof WorkspaceInvoiceData, value: any) => void;
}) {
  const depositType = invoice.depositType ?? "none";
  const depositValue = invoice.depositValue ?? "0";
  const lateFeeType = invoice.lateFeeType ?? "none";
  const lateFeeValue = invoice.lateFeeValue ?? "0";

  return (
    <div className="mb-6 rounded-xl border border-color bg-surface p-5">
      <h3 className="text-sm font-semibold text-secondary uppercase mb-4">Payment Configuration</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">Deposit</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={depositType}
              onChange={(e) => {
                onField("depositType", e.target.value);
                onField("depositValue", e.target.value === "none" ? "0" : depositValue);
              }}
              className="rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="none">No deposit</option>
              <option value="fixed">Fixed amount</option>
              <option value="percentage">Percentage</option>
            </select>
            {depositType !== "none" && (
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositValue}
                  onChange={(e) => onField("depositValue", e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-input-border bg-input px-3 py-2 pr-10 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-tertiary">
                  {depositType === "percentage" ? "%" : invoice.currency}
                </span>
              </div>
            )}
            <input
              type="date"
              value={invoice.depositDueDate?.split("T")[0] ?? ""}
              onChange={(e) => onField("depositDueDate", e.target.value || null)}
              className="rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {depositType !== "none" && (
            <input
              type="text"
              value={invoice.depositPaymentPurpose ?? ""}
              onChange={(e) => onField("depositPaymentPurpose", e.target.value || null)}
              placeholder="Payment purpose (e.g. 'Booking deposit')"
              className="mt-2 w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>

        <div className="border-t border-color pt-4">
          <label className="block text-sm font-medium text-secondary mb-1">Late Fee</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={lateFeeType}
              onChange={(e) => {
                onField("lateFeeType", e.target.value);
                onField("lateFeeValue", e.target.value === "none" ? "0" : lateFeeValue);
              }}
              className="rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="none">No late fee</option>
              <option value="fixed">Fixed amount</option>
              <option value="percentage">Percentage of total</option>
            </select>
            {lateFeeType !== "none" && (
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={lateFeeValue}
                  onChange={(e) => onField("lateFeeValue", e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-input-border bg-input px-3 py-2 pr-10 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-tertiary">
                  {lateFeeType === "percentage" ? "%" : invoice.currency}
                </span>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-tertiary">
            Applied automatically when the invoice becomes overdue and online payments are available.
          </p>
        </div>
      </div>
    </div>
  );
});

const NotesSection = React.memo(function NotesSection({
  invoice,
  onField,
  onFiles,
  attachments,
  beforePhotos,
  afterPhotos,
  onRemoveAttachment,
}: {
  invoice: WorkspaceInvoiceData;
  onField: (field: keyof WorkspaceInvoiceData, value: any) => void;
  onFiles: (files: FileList | null, category: "attachment" | "before" | "after") => void;
  attachments: WorkspaceAttachment[];
  beforePhotos: WorkspaceAttachment[];
  afterPhotos: WorkspaceAttachment[];
  onRemoveAttachment: (category: "attachment" | "before" | "after", id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-secondary">Job notes</label>
        <textarea
          value={invoice.notes ?? ""}
          onChange={(e) => onField("notes", e.target.value || null)}
          rows={3}
          placeholder="Add a note for the customer…"
          className="mt-1 block w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-secondary">Payment instructions</label>
          <textarea
            value={invoice.paymentInstructions ?? ""}
            onChange={(e) => onField("paymentInstructions", e.target.value || null)}
            rows={3}
            placeholder="Bank transfer, PayPal, etc.…"
            className="mt-1 block w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-secondary">Terms</label>
          <textarea
            value={invoice.terms ?? ""}
            onChange={(e) => onField("terms", e.target.value || null)}
            rows={3}
            placeholder="Payment terms (e.g. Net 30)…"
            className="mt-1 block w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <PhotoUploadSection
        label="Before photos"
        items={beforePhotos}
        onFiles={(f) => onFiles(f, "before")}
        onRemove={(id) => onRemoveAttachment("before", id)}
      />
      <PhotoUploadSection
        label="After photos"
        items={afterPhotos}
        onFiles={(f) => onFiles(f, "after")}
        onRemove={(id) => onRemoveAttachment("after", id)}
      />
      <PhotoUploadSection
        label="Attachments"
        items={attachments}
        onFiles={(f) => onFiles(f, "attachment")}
        onRemove={(id) => onRemoveAttachment("attachment", id)}
        acceptAny
      />
    </div>
  );
});

const PhotoUploadSection = React.memo(function PhotoUploadSection({
  label,
  items,
  onFiles,
  onRemove,
  acceptAny,
}: {
  label: string;
  items: WorkspaceAttachment[];
  onFiles: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  acceptAny?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-secondary">{label}</label>
      {items.length === 0 ? (
        <label className="mt-1 flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-color bg-surface text-tertiary hover:border-color-strong">
          <input
            type="file"
            multiple
            accept={acceptAny ? undefined : "image/*"}
            onChange={(e) => onFiles(e.target.files)}
            className="sr-only"
          />
          <Upload className="h-6 w-6" />
        </label>
      ) : (
        <div className="mt-2 flex flex-wrap gap-3">
          {items.map((a) => (
            <div key={a.id} className="relative">
              {a.type.startsWith("image/") ? (
                <img src={a.url} alt={a.name} className="h-20 w-20 rounded-lg object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-color bg-surface-alt">
                  <FileText className="h-6 w-6 text-tertiary" />
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                className="absolute -top-1 -right-1 rounded-full bg-surface-alt text-tertiary hover:bg-error-bg hover:text-error-text"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-color bg-surface text-tertiary hover:border-color-strong">
            <input
              type="file"
              multiple
              accept={acceptAny ? undefined : "image/*"}
              onChange={(e) => onFiles(e.target.files)}
              className="sr-only"
            />
            <Plus className="h-5 w-5" />
          </label>
        </div>
      )}
    </div>
  );
});

const ValidationBanner = React.memo(function ValidationBanner({ issues }: { issues: ReturnType<typeof useInvoiceValidation>["issues"] }) {
  if (!issues.length) return null;
  return (
    <div className="mb-4 rounded-lg border border-error-border bg-error-bg p-3 text-sm text-error-text">
      <div className="flex items-center gap-2 font-semibold">
        <AlertCircle className="h-4 w-4" />
        <span>
          {issues.filter((i) => i.severity === "error").length} issue
          {issues.filter((i) => i.severity === "error").length !== 1 ? "s" : ""} need attention
        </span>
      </div>
      <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs">
        {issues.map((i) => (
          <li key={i.code}>
            [{i.severity}] {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
});

const ActionFooter = React.memo(function ActionFooter({
  isNew,
  hasInvoiceId,
  saveState,
  onSaveDraft,
  onDuplicate,
  onCreateAnother,
  onPreview,
  onReviewAndSend,
  validation,
}: {
  isNew: boolean;
  hasInvoiceId: boolean;
  saveState: "saved" | "saving" | "unsaved" | "error";
  onSaveDraft: () => void;
  onDuplicate: () => void;
  onCreateAnother: () => void;
  onPreview: () => void;
  onReviewAndSend: () => void;
  validation: ReturnType<typeof useInvoiceValidation>;
}) {
  return (
    <footer className="flex h-16 items-center justify-between border-t border-color bg-surface px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCreateAnother}
          className="inline-flex items-center gap-1.5 rounded-lg border border-color bg-surface px-3 py-2 text-sm font-medium text-secondary hover:bg-hover"
        >
          Create another
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          disabled={!hasInvoiceId}
          className="inline-flex items-center gap-1.5 rounded-lg border border-color bg-surface px-3 py-2 text-sm font-medium text-secondary hover:bg-hover disabled:opacity-50"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 rounded-lg border border-color bg-surface px-3 py-2 text-sm font-medium text-secondary hover:bg-hover"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saveState === "saving" || saveState === "saved"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-color bg-surface px-3 py-2 text-sm font-medium text-secondary hover:bg-hover disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save draft
        </button>
      </div>
      <button
        type="button"
        onClick={onReviewAndSend}
        disabled={validation.hasErrors}
        className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-5 py-2.5 text-sm font-semibold text-on-primary focus:ring-2 focus:ring-primary disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        Review &amp; Send
      </button>
    </footer>
  );
});

const ReviewAndSendDialog = React.memo(function ReviewAndSendDialog({
  invoice,
  invoiceId,
  calc,
  validation,
  step,
  sending,
  error,
  onFinalizeAndSend,
  onClose,
  onCopyPaymentLink,
  onDownloadPdf,
}: {
  invoice: WorkspaceInvoiceData;
  invoiceId: string | null;
  calc: any;
  validation: ReturnType<typeof useInvoiceValidation>;
  step: "review" | "success";
  sending: boolean;
  error: string | null;
  onFinalizeAndSend: () => void;
  onClose: () => void;
  onCopyPaymentLink: () => void;
  onDownloadPdf: () => void;
}) {
  const c = invoice.currency;
  const total = calc?.total ?? 0;
  const due = calc?.amountDue ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-surface shadow-xl">
        {step === "review" ? (
          <>
            <div className="border-b border-color p-6">
              <h2 className="text-xl font-semibold text-primary">Review &amp; Send</h2>
              <p className="mt-1 text-sm text-secondary">
                Finalizing assigns an invoice number and locks this invoice. You'll then be able to
                send it by email, copy a payment link, and download a PDF.
              </p>
            </div>

            {error && <div className="p-4 text-sm text-error-text">{error}</div>}

            <div className="p-6">
              <div className="mb-4 flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-tertiary">Total</p>
                  <p className="text-2xl font-bold text-primary">{fmt(total, c)}</p>
                  <p className="text-sm text-tertiary">Balance due</p>
                  <p className="text-xl font-semibold text-primary-brand">{fmt(due, c)}</p>
                </div>
              </div>

              {validation.issues.filter((i) => i.severity === "error").length > 0 && (
                <div className="mb-4 space-y-1 text-sm">
                  {validation.issues.filter((i) => i.severity === "error").map((i) => (
                    <p key={i.code} className="flex items-center gap-2 text-error-text">
                      <AlertCircle className="h-4 w-4" />
                      {i.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-tertiary">Customer</span>
                  <span className="font-medium text-primary">
                    {invoice.customer?.name ?? invoice.customerId ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Issue date</span>
                  <span className="font-medium text-primary">
                    {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Due date</span>
                  <span className="font-medium text-primary">
                    {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tertiary">Items</span>
                  <span className="font-medium text-primary">{invoice.items.length} line item(s)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-color p-4">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="rounded-lg border border-input-border px-4 py-2 text-sm font-medium text-secondary hover:bg-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onFinalizeAndSend}
                disabled={sending || validation.hasErrors}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Finalizing…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Finalize &amp; send by email
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-color p-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-success-text" />
                <div>
                  <h2 className="text-xl font-semibold text-primary">Invoice sent!</h2>
                  <p className="text-sm text-secondary">Your customer will receive it by email.</p>
                </div>
              </div>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm text-secondary">What would you like to do next?</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row justify-center gap-2">
                <button
                  type="button"
                  onClick={onCopyPaymentLink}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-input-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-hover"
                >
                  <Link2 className="h-4 w-4" />
                  Copy payment link
                </button>
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-input-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-hover"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
                <a
                  href={invoice.publicToken ? `${window.location.origin}/invoice/${invoice.publicToken}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-input-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-hover"
                >
                  <Mail className="h-4 w-4" />
                  Share via text
                </a>
              </div>
            </div>
            <div className="flex justify-end border-t border-color p-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-primary-action px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

const PreviewDialog = React.memo(function PreviewDialog({
  invoice,
  onClose,
  onDownloadPdf,
}: {
  invoice: PreviewInvoice;
  onClose: () => void;
  onDownloadPdf: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="h-[85vh] w-[90vw] max-w-4xl overflow-auto rounded-xl bg-surface">
        <div className="sticky top-0 flex items-center justify-between border-b border-color bg-surface-alt px-4 py-2">
          <h3 className="text-sm font-semibold text-secondary">Invoice preview</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input-border bg-surface px-3 py-1.5 text-xs font-medium text-secondary hover:bg-hover"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-tertiary hover:bg-hover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <InvoicePreview invoice={invoice} />
        </div>
      </div>
    </div>
  );
});
