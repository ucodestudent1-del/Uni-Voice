import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Layers,
  LayoutDashboard,
  Package,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  cancelCreditNote,
  createCreditNote,
  finalizeCreditNote,
  getBusiness,
  getBusinessSettings,
  getCreditNote,
  getCreditNotePdf,
  getCustomers,
  getProducts,
  updateCreditNote,
} from "../api/client";
import type { ApiParsedDocumentResult } from "../api/client";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import {
  calculationEngine,
  type FeeInput,
  type InvoiceCalculationInput,
  type LineItemInput,
} from "../utils/calculation";
import { formatCurrency, formatDate, parseDecimal } from "../utils/format";
import { getCurrencyMetadata } from "../types/currency";
import { useInvoiceValidation, type ValidationInput } from "../hooks/useInvoiceValidation";
import CustomerSelector from "./CustomerSelector";
import CommandLineItemInput from "./CommandLineItemInput";
import FrequentlyInvoicedChips from "./FrequentlyInvoicedChips";
import QuickRepeatBanner from "./QuickRepeatBanner";
import { AiInput } from "./AiInput";
import { ServiceAutocomplete } from "./ServiceAutocomplete";
import { Button } from "./ui/Button";
import { FormField } from "./ui/FormField";
import { ConfirmationDialog } from "./ui/ConfirmationDialog";
import CreditNotePreview, {
  type PreviewApplication,
  type PreviewCreditNote,
  type PreviewFee,
  type PreviewLineItem,
} from "./CreditNotePreview";
import type { ApiBusiness, ApiCustomer, ApiCreditNote, ApiProduct } from "../types/api";

export type CreditNoteLineItemInput = {
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
};

export interface WorkspaceCreditNoteData {
  customerId?: string | null;
  customer?: ApiCustomer | null;
  creditNoteNumber?: string | null;
  issueDate?: string | null;
  invoiceTerms?: string | null;
  currency: string;
  referenceInvoiceId?: string | null;
  referenceInvoiceNumber?: string | null;
  reason?: string | null;
  items: CreditNoteLineItemInput[];
  fees: WorkspaceFee[];
  notes?: string | null;
  internalNotes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  status: string;
  isFinalized: boolean;
  publicToken?: string | null;
  appliedTotal?: string;
  amountDue?: string;
}

export interface WorkspaceFee {
  description: string;
  amount: string;
  taxRate?: string;
}

const LINE_ITEM_UNITS = ["each", "hour", "day", "week", "month", "fixed"] as const;

const AUTOSAVE_DELAY = 2000;

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function fmt(v: Decimal.Value, currency: string): string {
  return formatCurrency(v, currency, 2);
}

function toApiItem(item: CreditNoteLineItemInput) {
  return {
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit || "each",
    unitPrice: item.unitPrice,
    discount: item.discount && !parseDecimal(item.discount).isZero() ? item.discount : undefined,
    discountType: item.discount ? (item.discountType ?? "fixed") : undefined,
    taxRate: item.taxRate ?? "0",
    isTaxInclusive: item.isTaxInclusive ?? false,
    productId: item.productId ?? null,
  };
}

function buildCalcInput(data: WorkspaceCreditNoteData): InvoiceCalculationInput {
  const lineItems: LineItemInput[] = data.items.map((it) => ({
    description: it.description || "",
    quantity: it.quantity || "1",
    unit: it.unit || "each",
    unitPrice: it.unitPrice || "0",
    discount: it.discount && !parseDecimal(it.discount).isZero() ? { type: it.discountType ?? "fixed", value: it.discount } : undefined,
    taxRate: it.taxRate ?? "0",
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

function fromPercent(pct: string): string {
  if (pct === "") return "0";
  return new Decimal(pct).div(100).toFixed(6);
}

function toPercent(rate: string | undefined | null): string {
  const v = new Decimal(rate ?? 0).mul(100);
  return v.isZero() ? "" : v.toFixed(2);
}

export default function CreditNoteWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);

  const [creditNote, setCreditNote] = useState<WorkspaceCreditNoteData | null>(null);
  const [creditNoteId, setCreditNoteId] = useState<string | null>(null);
  const [loadedCreditNoteId, setLoadedCreditNoteId] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("unsaved");
  const [dirty, setDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedItemsRef = useRef<string | null>(null);
  const lastSavedFeesRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(!isNew);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(480);
  const [previewMobileOpen, setPreviewMobileOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const latestRef = useRef<{
    creditNote: WorkspaceCreditNoteData | null;
    creditNoteId: string | null;
    isNew: boolean;
  }>({ creditNote, creditNoteId, isNew });
  latestRef.current = { creditNote, creditNoteId, isNew };

  const calc = useMemo(() => {
    if (!creditNote) return null;
    try {
      return calculationEngine.calculate(buildCalcInput(creditNote));
    } catch {
      return null;
    }
  }, [creditNote]);

  const validationInput = useMemo<ValidationInput | null>(
    () =>
      creditNote
        ? {
            customerId: creditNote.customerId ?? undefined,
            customer: creditNote.customer ?? undefined,
            currency: creditNote.currency,
            issueDate: creditNote.issueDate ?? undefined,
            items: creditNote.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unit: it.unit,
              unitPrice: it.unitPrice,
              discount: it.discount,
              discountType: it.discountType,
              taxRate: it.taxRate,
              isTaxInclusive: it.isTaxInclusive,
            })),
            fees: creditNote.fees.map((f) => ({
              description: f.description,
              amount: f.amount,
              taxRate: f.taxRate,
            })),
            notes: creditNote.notes,
            terms: creditNote.terms,
          }
        : null,
    [creditNote]
  );

  const validation = useInvoiceValidation(validationInput, calc ?? undefined);

  const [quickActionsLoading, setQuickActionsLoading] = useState(!isNew);

  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      try {
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
        // ignored - individual results handled via allSettled
      } finally {
        if (!cancelled) setQuickActionsLoading(false);
      }
    }
    loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultTaxRate = settings?.default_tax_rate ?? "0";
  const defaultCurrency = business?.defaultCurrency ?? settings?.default_currency ?? "USD";

  useEffect(() => {
    if (!isNew) return;
    setCreditNote({
      customerId: undefined,
      customer: null,
      creditNoteNumber: null,
      issueDate: todayISO(),
      currency: defaultCurrency,
      referenceInvoiceId: null,
      referenceInvoiceNumber: null,
      reason: null,
      items: [],
      fees: [],
      notes: settings.default_notes ?? "",
      internalNotes: "",
      terms: settings.default_terms ?? "",
      templateId: null,
      status: "draft",
      isFinalized: false,
    });
    setLoadedCreditNoteId("new");
  }, [isNew, defaultCurrency, settings]);

  useEffect(() => {
    if (isNew || creditNoteId || loadedCreditNoteId === id) return;
    const cancelled = false;
    async function loadCreditNote() {
      setLoading(true);
      try {
        const res = await getCreditNote(id as string);
        const cn: ApiCreditNote = res.creditNote;
        let cust: ApiCustomer | null = null;
        if (cn.customer_id) {
          const cached = customers.find((c) => c.id === cn.customer_id) ?? null;
          if (cached) {
            cust = cached;
          } else {
            try {
              const { getCustomer } = await import("../api/client");
              cust = (await getCustomer(cn.customer_id)).customer ?? null;
            } catch (err) {
              console.warn("Failed to fetch customer:", err);
              cust = null;
            }
          }
        }
        const mapped: WorkspaceCreditNoteData = {
          customerId: cn.customer_id ?? null,
          customer: cust,
          creditNoteNumber: cn.credit_note_number ?? null,
          issueDate: cn.issue_date ? cn.issue_date.split("T")[0] : null,
          currency: cn.currency,
          referenceInvoiceId: cn.reference_invoice_id ?? null,
          referenceInvoiceNumber: null,
          reason: cn.reason ?? null,
          items: (cn.items ?? []).map((it): CreditNoteLineItemInput => ({
            id: it.id,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit || "each",
            unitPrice: it.unit_price,
            discount: it.discount ? String(it.discount) : "",
            discountType: (it.discount_type ?? "fixed") as "fixed" | "percentage",
            taxRate: it.tax_rate,
            isTaxInclusive: it.is_tax_inclusive ?? false,
            productId: it.product_id ?? null,
          })),
          fees: (cn.fees ?? []).map((f): WorkspaceFee => ({
            description: f.description,
            amount: f.amount,
            taxRate: f.tax_rate,
          })),
          notes: cn.notes ?? "",
          internalNotes: cn.internal_notes ?? "",
          terms: cn.terms ?? "",
          templateId: cn.template_id ?? null,
          status: cn.status,
          isFinalized: cn.is_finalized ?? false,
        };
        if (!cancelled) {
          setCreditNote(mapped);
          setCreditNoteId(cn.id);
          setLoadedCreditNoteId(cn.id);
          setSaveState("saved");
          setDirty(false);
          lastSavedItemsRef.current = JSON.stringify(mapped.items);
          lastSavedFeesRef.current = JSON.stringify(mapped.fees);
        }
      } catch (err: any) {
        if (!cancelled) {
          setActionMessage(err?.response?.data?.error || "Failed to load credit note");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCreditNote();
  }, [id, isNew, creditNoteId, loadedCreditNoteId]);

  function markDirtyAndSchedule() {
    setDirty(true);
    setSaveState("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), AUTOSAVE_DELAY);
  }

  function updateData(partial: Partial<WorkspaceCreditNoteData>) {
    const { creditNote: cur } = latestRef.current;
    if (!cur) return;
    const next = { ...cur, ...partial };
    setCreditNote(next);
    setDirty(true);
    setSaveState("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), AUTOSAVE_DELAY);
  }

  async function doSave(): Promise<boolean> {
    const { creditNote: cur, creditNoteId: curId, isNew: newFlag } = latestRef.current;
    if (!cur) return false;
    setSaveState("saving");
    try {
      const metaPayload = {
        customerId: cur.customerId,
        currency: cur.currency,
        issueDate: cur.issueDate,
        reason: cur.reason,
        notes: cur.notes,
        internalNotes: cur.internalNotes,
        terms: cur.invoiceTerms || cur.terms,
        templateId: cur.templateId,
        referenceInvoiceId: cur.referenceInvoiceId,
        items: cur.items.map(toApiItem),
        fees: cur.fees,
      };

      if (!curId) {
        const res = await createCreditNote(metaPayload);
        setCreditNoteId(res.creditNoteId);
        setLoadedCreditNoteId(res.creditNoteId);
        lastSavedItemsRef.current = JSON.stringify(metaPayload.items);
        lastSavedFeesRef.current = JSON.stringify(metaPayload.fees);
        if (newFlag) {
          navigate(`/app/credit-notes/${res.creditNoteId}/edit`, { replace: true });
        }
      } else {
        await updateCreditNote(curId, metaPayload);
        lastSavedItemsRef.current = JSON.stringify(metaPayload.items);
        lastSavedFeesRef.current = JSON.stringify(metaPayload.fees);
      }
      setSaveState("saved");
      setDirty(false);
      return true;
    } catch (err: any) {
      setSaveState("error");
      setActionMessage(err?.response?.data?.error || "Failed to save credit note");
      return false;
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

  const handleField = (field: keyof WorkspaceCreditNoteData, value: any) => {
    const patch: Partial<WorkspaceCreditNoteData> =
      field === "customerId"
        ? {
            customerId: value,
            customer: customers.find((c) => c.id === value) ?? null,
          }
        : { [field]: value };
    updateData(patch);
  };

  const handlePopulateFromQuickActions = (data: Partial<WorkspaceCreditNoteData>) => {
    updateData(data);
  };

  const handleDismissBanner = () => {
    setBannerDismissed(true);
  };

  const handleQuickAddItem = (item: Omit<CreditNoteLineItemInput, "id">) => {
    const newItem: CreditNoteLineItemInput = {
      ...item,
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
    setCreditNote((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : prev));
    markDirtyAndSchedule();
  };

  const handleParsedFromAi = (result: ApiParsedDocumentResult) => {
    const fields = result.fields;
    if (fields.customerId) {
      updateData({ customerId: fields.customerId });
    }
    if (fields.currency) {
      updateData({ currency: fields.currency });
    }
    if (fields.notes) {
      setCreditNote((prev) =>
        prev ? { ...prev, notes: (prev.notes ?? "") + (prev.notes ? "\n\n" : "") + fields.notes! } : prev
      );
    }
    if (fields.items && fields.items.length > 0) {
      const newItems: CreditNoteLineItemInput[] = fields.items.map((item) => ({
        id: `li_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        description: item.description,
        quantity: String(item.quantity ?? 1),
        unit: item.unit ?? "each",
        unitPrice: String(item.unitPrice ?? 0),
        discount: "",
        discountType: "fixed",
        taxRate: item.taxRate ? String(item.taxRate) : undefined,
        isTaxInclusive: item.isTaxInclusive ?? false,
        productId: null,
      }));
      setCreditNote((prev) =>
        prev ? { ...prev, items: [...prev.items, ...newItems] } : prev
      );
      markDirtyAndSchedule();
    }
    if (fields.fees && fields.fees.length > 0) {
      const newFees = fields.fees.map((fee) => ({
        description: fee.description,
        amount: String(fee.amount),
        taxRate: fee.taxRate ? String(fee.taxRate) : undefined,
      }));
      setCreditNote((prev) =>
        prev ? { ...prev, fees: [...prev.fees, ...newFees] } : prev
      );
      markDirtyAndSchedule();
    }
  };

  const serviceAutocompleteRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    enabled: !creditNote?.isFinalized && !reviewOpen,
    onSave: () => undefined,
    onFinalize: () => {
      if (!validation.hasErrors) {
        setReviewError(null);
        setReviewOpen(true);
      }
    },
    onSend: () => {
      if (!validation.hasErrors) {
        handleReviewAndFinalize();
      }
    },
    onDuplicate: () => handleDuplicate(),
    onAddItem: () => addItem("service"),
    onAddFee: () => undefined,
    onFocusSearch: () => {
      serviceAutocompleteRef.current?.focus();
    },
    onTogglePreview: () => setPreviewOpen(true),
    onCancel: () => {
      if (reviewOpen) setReviewOpen(false);
    },
    onDelete: () => undefined,
  });

  const handleItemChange = (itemId: string, patch: Partial<CreditNoteLineItemInput>) => {
    setCreditNote((prev) =>
      prev
        ? { ...prev, items: prev.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
        : prev
    );
    markDirtyAndSchedule();
  };

  function addItem(type: "service" = "service") {
    const newItem: CreditNoteLineItemInput = {
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      description: "",
      quantity: "1",
      unitPrice: "",
      discount: "",
      discountType: "fixed",
      taxRate: defaultTaxRate,
      unit: "each",
      isTaxInclusive: false,
      productId: null,
    };
    setCreditNote((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : prev));
    markDirtyAndSchedule();
  }

  function duplicateItem(itemId: string) {
    const item = creditNote?.items.find((it) => it.id === itemId);
    if (!item) return;
    const newItem: CreditNoteLineItemInput = {
      ...item,
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      description: `${item.description} (copy)`,
    };
    setCreditNote((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : prev));
    markDirtyAndSchedule();
  }

  function removeItem(itemId: string) {
    setCreditNote((prev) =>
      prev ? { ...prev, items: prev.items.filter((it) => it.id !== itemId) } : prev
    );
    markDirtyAndSchedule();
  }

  function addFromProduct(product: ApiProduct) {
    const newItem: CreditNoteLineItemInput = {
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      description: product.name,
      quantity: "1",
      unit: product.unit || "each",
      unitPrice: product.defaultUnitPrice || "0",
      discount: "",
      discountType: "fixed",
      taxRate: product.defaultTaxRate || defaultTaxRate,
      isTaxInclusive: false,
      productId: product.id,
    };
    setCreditNote((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : prev));
    markDirtyAndSchedule();
  }

  async function handleSaveDraft() {
    await doSave();
  }

  async function handleCreateAnother() {
    if (dirty) {
      const ok = window.confirm(
        "You have unsaved changes. Create another credit note anyway? Your current work has been/will be saved as a draft."
      );
      if (!ok) return;
    }
    const saved = await doSave();
    if (saved) {
      navigate("/app/credit-notes/new", { replace: true });
    }
  }

  async function handleDuplicate() {
    if (!creditNoteId) {
      await doSave();
    }
    const { creditNoteId: curId } = latestRef.current;
    if (!curId) return;
    try {
      const res = await createCreditNote({
        ...latestRef.current.creditNote,
        items: latestRef.current.creditNote?.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          discount: it.discount,
          discountType: it.discountType,
          taxRate: it.taxRate,
          isTaxInclusive: it.isTaxInclusive,
          productId: it.productId ?? null,
        })) ?? [],
        fees: latestRef.current.creditNote?.fees ?? [],
      });
      navigate(`/app/credit-notes/${res.creditNoteId}/edit`);
    } catch (err: any) {
      setActionMessage(err?.response?.data?.error || "Failed to duplicate credit note");
    }
  }

  async function downloadPdf() {
    const { creditNoteId: curId } = latestRef.current;
    if (!curId) return;
    try {
      const blob = await getCreditNotePdf(curId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `credit-note-${creditNote?.creditNoteNumber || curId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionMessage(err?.response?.data?.error || "Failed to download PDF");
    }
  }

  async function handleReviewAndFinalize() {
    if (validation.hasErrors) {
      setActionMessage("Please fix the highlighted issues before finalizing.");
      return;
    }
    if (!latestRef.current.creditNoteId || dirty) {
      await doSave();
    }
    setReviewError(null);
    setReviewOpen(true);
  }

  async function handleFinalize() {
    const { creditNoteId: curId, creditNote: cur } = latestRef.current;
    if (!cur || !curId) return;
    if (!cur.customerId) {
      setReviewError("Select a customer before finalizing.");
      return;
    }
    setReviewError(null);
    try {
      const finalRes = await finalizeCreditNote(curId);
      setCreditNote((prev) =>
        prev
          ? {
              ...prev,
              isFinalized: true,
              status: "finalized",
              creditNoteNumber: finalRes.creditNoteNumber ?? prev.creditNoteNumber ?? null,
            }
          : prev
      );
      setReviewError(null);
      setReviewOpen(false);
    } catch (err: any) {
      setReviewError(err?.response?.data?.error || "Failed to finalize credit note");
    }
  }

  async function handleCancel(reason: string) {
    const { creditNoteId: curId } = latestRef.current;
    if (!curId) return;
    try {
      await cancelCreditNote(curId, { reason });
      setCreditNote((prev) =>
        prev ? { ...prev, status: "cancelled" } : prev
      );
       setActionMessage("Credit note cancelled.");
     } catch (err: any) {
       setActionMessage(err?.response?.data?.error || "Failed to cancel credit note");
     }
   }

   async function handleSend() {
      const { creditNoteId: curId } = latestRef.current;
      if (!curId) return;
      try {
        const { sendCreditNote } = await import("../api/client");
        const sendRes = await sendCreditNote(curId);
        setActionMessage("Credit note sent successfully!");
        setCreditNote((prev) =>
          prev
            ? {
                ...prev,
                status: sendRes.status ?? prev.status,
                ...(sendRes.publicToken ? { publicToken: sendRes.publicToken } : {}),
              }
            : prev
        );
      } catch (err: any) {
       setActionMessage(err?.response?.data?.error || "Failed to send credit note");
     }
   }

   async function handleApplyToInvoice(invoiceId: string, amount?: string) {
    const { creditNoteId: curId } = latestRef.current;
    if (!curId) return;
    try {
      const { applyCreditNote } = await import("../api/client");
      await applyCreditNote(curId, invoiceId, amount);
      setActionMessage("Credit note applied successfully!");
      const updated = await getCreditNote(curId);
      setCreditNote((prev) => {
        if (!prev || !updated.creditNote) return prev;
        const cn = updated.creditNote;
        return {
          ...prev,
          status: cn.status,
          appliedTotal: cn.applied_total,
          amountDue: cn.amount_due,
          isFinalized: cn.is_finalized,
        };
      });
    } catch (err: any) {
      setActionMessage(err?.response?.data?.error || "Failed to apply credit note");
    }
  }

  const previewCreditNote = useMemo((): PreviewCreditNote | null => {
    if (!creditNote || !calc) return null;
    const previewItems: PreviewLineItem[] = creditNote.items.map((it) => ({
      description: it.description,
      quantity: it.quantity || "1",
      unit: it.unit || "each",
      unitPrice: it.unitPrice || "0",
      discount: it.discount && Number(it.discount) > 0 ? it.discount : undefined,
      discountType: it.discountType,
      taxRate: it.taxRate,
      isTaxInclusive: it.isTaxInclusive ?? false,
    }));
    const previewFees: PreviewFee[] = creditNote.fees.map((f) => ({
      description: f.description,
      amount: f.amount,
      taxRate: f.taxRate,
    }));

    const applications: PreviewApplication[] = [];

    return {
      businessName: business?.name || business?.legalName || "Untitled Business",
      businessEmail: business?.email ?? undefined,
      businessPhone: business?.phone ?? undefined,
      businessWebsite: business?.website ?? undefined,
      businessAddress: businessAddressString(business),
      businessLogo: business?.logoUrl ?? undefined,
      businessTaxId: business?.taxId ?? undefined,
      businessRegistrationNumber: business?.registrationNumber ?? undefined,
      customerName: creditNote.customer?.name ?? customers.find((c) => c.id === creditNote.customerId)?.name ?? undefined,
      customerCompanyName:
        creditNote.customer?.companyName ?? customers.find((c) => c.id === creditNote.customerId)?.companyName ?? undefined,
      customerEmail: creditNote.customer?.email ?? customers.find((c) => c.id === creditNote.customerId)?.email ?? undefined,
      customerPhone: creditNote.customer?.phone ?? customers.find((c) => c.id === creditNote.customerId)?.phone ?? undefined,
      customerAddress: creditNote.customer ? customerAddressString(creditNote.customer) : undefined,
      creditNoteNumber: creditNote.creditNoteNumber ?? (creditNoteId ? "Draft" : undefined),
      issueDate: creditNote.issueDate ?? undefined,
      currency: creditNote.currency,
      reason: creditNote.reason ?? undefined,
      notes: creditNote.notes ?? undefined,
      terms: creditNote.terms ?? undefined,
      referenceInvoiceNumber: creditNote.referenceInvoiceNumber ?? undefined,
      items: previewItems,
      fees: previewFees,
      subtotal: calc.subtotal.toFixed(2),
      discountTotal: calc.discountTotal.toFixed(2),
      taxTotal: calc.taxTotal.toFixed(2),
      feeTotal: calc.feeTotal.toFixed(2),
      total: calc.total.toFixed(2),
      appliedTotal: "0",
      amountDue: calc.total.toFixed(2),
      status: creditNote.isFinalized ? creditNote.status : "draft",
      applications: applications,
    };
  }, [creditNote, calc, business, customers, creditNoteId]);

  if (!creditNote) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <div className="flex items-center gap-3 text-secondary">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Setting up your credit note…</span>
        </div>
      </div>
    );
  }

  if (loading && creditNoteId) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <div className="flex items-center gap-3 text-secondary">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading credit note…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-page text-primary">
      <CreditNoteWorkspaceHeader
        isNew={isNew}
        creditNoteId={creditNoteId}
        creditNoteNumber={creditNote.creditNoteNumber}
        saveState={saveState}
        validation={validation}
      />

      {actionMessage && (
        <div className="fixed top-4 right-4 z-40 max-w-sm rounded-lg bg-surface-elevated px-4 py-3 text-sm text-primary shadow-lg">
          {actionMessage}
        </div>
      )}

      <main className="flex flex-1 overflow-hidden">
        {/* Mobile preview toggle */}
        <div className="lg:hidden border-b border-color bg-surface px-4 py-2">
          <button
            type="button"
            onClick={() => setPreviewMobileOpen(!previewMobileOpen)}
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-color bg-surface px-4 py-2 text-sm font-medium text-primary hover:bg-surface-alt"
          >
            <LayoutDashboard className="h-4 w-4" />
            {previewMobileOpen ? "Hide Preview" : "Show Preview"}
          </button>
        </div>

        <aside className="flex w-full min-w-0 flex-[3] flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-color bg-surface">
            <CreditNoteCustomerHeader
              creditNote={creditNote}
              onField={handleField}
              customers={customers}
            />
            <CreditNoteTotalsCard
              creditNote={creditNote}
              calc={calc}
            />
          </div>
          <div className="overflow-y-auto px-6 py-5">
            {validation.hasErrors && (
              <ValidationBanner issues={validation.issues} />
            )}

            {isNew && !bannerDismissed && (
              <QuickRepeatBanner<WorkspaceCreditNoteData>
                businessId={business?.id || ""}
                customerId={creditNote?.customerId ?? undefined}
                onPopulate={handlePopulateFromQuickActions}
                onDismiss={handleDismissBanner}
              />
            )}

             {isNew && creditNote.items.length === 0 && (
               <div className="mb-6">
                 <AiInput
                   onParsed={handleParsedFromAi}
                   businessName={business?.name || business?.legalName}
                   currency={creditNote.currency}
                   customerId={creditNote.customerId ?? undefined}
                 />
               </div>
             )}

            {creditNote.items.length === 0 ? (
              <div className="mb-6 rounded-xl border border-dashed border-color bg-surface-alt py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-tertiary/40" />
                <h3 className="mt-4 text-lg font-semibold text-primary">No line items added yet</h3>
                <p className="mt-2 max-w-sm text-center text-sm text-tertiary">
                  Add a product or service to credit the customer for.
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => addItem("service")}
                  >
                    Add a line item
                  </Button>
                  {products.length > 0 && (
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<Layers className="h-4 w-4" />}
                      onClick={() => {
                        if (products.length === 1) addFromProduct(products[0]);
                      }}
                    >
                      Add from saved product
                    </Button>
                  )}
                </div>
              {products.length > 0 && (
                <div className="mt-6 max-w-sm">
                  <ServiceAutocomplete
                    products={products}
                    onSelect={addFromProduct}
                    placeholder="Search services to credit..."
                  />
                </div>
              )}
              </div>
            ) : (
              <CreditNoteLineItemsTable
                creditNote={creditNote}
                calc={calc}
                onItemChange={handleItemChange}
                onAdd={addItem}
                onDuplicate={duplicateItem}
                onRemove={removeItem}
                defaultTaxRate={defaultTaxRate}
              />
            )}

             {products.length > 0 && creditNote.items.length > 0 && (
               <div className="mb-4 max-w-sm">
                 <ServiceAutocomplete
                   products={products}
                   onSelect={addFromProduct}
                   placeholder="Search and add another service..."
                 />
               </div>
             )}

            {isNew && creditNote.items.length > 0 && (
              <div className="mb-4">
                <FrequentlyInvoicedChips<CreditNoteLineItemInput>
                  businessId={business?.id || ""}
                  customerId={creditNote?.customerId ?? undefined}
                  onAddItem={handleQuickAddItem}
                />
              </div>
            )}

            <CreditNoteFeesSection
              fees={creditNote.fees}
              onChange={(fees) => updateData({ fees })}
            />

            <CreditNoteNotesSection
              creditNote={creditNote}
              onField={handleField}
            />
          </div>
        </aside>

        {/* Resize handle - only show on lg+ when preview is visible */}
        <div
          onMouseDown={startResize}
          className="hidden lg:flex lg:flex-shrink-0 cursor-col-resize hover:bg-primary/20"
          style={{ width: "8px" }}
          aria-label="Resize preview"
        />

        {/* Preview sidebar - responsive */}
        <aside
          className={`${previewMobileOpen ? "block" : "hidden"} lg:flex lg:flex-col lg:overflow-y-auto bg-surface-alt`}
          style={{ width: `${previewWidth}px`, minWidth: "320px" }}
        >
          <div className="border-b border-color bg-surface px-4 py-2 text-center text-xs text-tertiary">
            {creditNote.isFinalized ? "Customer view" : "Live preview (not yet finalized)"}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {previewCreditNote ? <CreditNotePreview creditNote={previewCreditNote} /> : null}
          </div>
        </aside>
      </main>

      <CreditNoteActionFooter
        isNew={isNew}
        hasCreditNoteId={!!creditNoteId}
        saveState={saveState}
        onSaveDraft={handleSaveDraft}
        onDuplicate={handleDuplicate}
        onCreateAnother={handleCreateAnother}
        onPreview={() => setPreviewOpen(true)}
         onFinalize={handleFinalize}
         onCancel={handleCancel}
         onSend={handleSend}
         validation={validation}
        creditNote={creditNote}
        onApplyToInvoice={handleApplyToInvoice}
      />

      {reviewOpen && (
        <CreditNoteFinalizeDialog
          creditNote={creditNote}
          creditNoteId={creditNoteId}
          calc={calc}
          validation={validation}
          error={reviewError}
          onFinalize={handleFinalize}
          onClose={() => setReviewOpen(false)}
          onDownloadPdf={downloadPdf}
        />
      )}

      {previewOpen && previewCreditNote && (
        <CreditNotePreviewDialog
          creditNote={previewCreditNote}
          onClose={() => setPreviewOpen(false)}
          onDownloadPdf={downloadPdf}
        />
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

const CreditNoteWorkspaceHeader = React.memo(function CreditNoteWorkspaceHeader({
  isNew,
  creditNoteId,
  creditNoteNumber,
  saveState,
  validation,
}: {
  isNew: boolean;
  creditNoteId: string | null;
  creditNoteNumber: string | null | undefined;
  saveState: "saved" | "saving" | "unsaved" | "error";
  validation: ReturnType<typeof useInvoiceValidation>;
}) {
  const navigate = useNavigate();
  const navigateBack = () => navigate("/app/credit-notes", { replace: true });

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
          className="rounded-lg p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary"
          aria-label="Back to credit notes"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-tertiary">|</span>
        <h1 className="text-xl font-semibold text-primary">
          {creditNoteNumber ? `Credit Note #${creditNoteNumber}` : isNew ? "Create Credit Note" : "Edit Credit Note"}
        </h1>
        {creditNoteId && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-0.5 text-xs font-medium text-tertiary">
            {isNew ? "Draft" : "Editing"}
          </span>
        )}
        {!creditNoteId && isNew && (
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

const CreditNoteCustomerHeader = React.memo(function CreditNoteCustomerHeader({
  creditNote,
  onField,
   customers,
}: {
  creditNote: WorkspaceCreditNoteData;
  onField: (field: keyof WorkspaceCreditNoteData, value: any) => void;
  customers: ApiCustomer[];
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <FormField
        label="Customer"
        labelClassName="uppercase"
        className="sm:col-span-2 lg:col-span-2 xl:col-span-2"
        inputClassName="w-full"
      >
        <CustomerSelector
          value={creditNote.customerId ?? undefined}
          onChange={(cid) => onField("customerId", cid)}
          onCustomerChange={(c) => onField("customer", c ?? null)}
          placeholder="Select a customer"
          preloadedCustomers={customers}
        />
      </FormField>

      <FormField
        label="Credit Note #"
        labelClassName="uppercase"
        placeholder="Auto-assigned on finalize"
        disabled={creditNote.isFinalized}
        value={creditNote.creditNoteNumber ?? ""}
        onChange={(e) => onField("creditNoteNumber", e.target.value || null)}
      />

      <FormField
        label="Issue date"
        labelClassName="uppercase"
        type="date"
        value={creditNote.issueDate ?? ""}
        onChange={(e) => onField("issueDate", e.target.value || null)}
      />

      <FormField
        label="Currency"
        labelClassName="uppercase"
        value={creditNote.currency}
        onChange={(e) => onField("currency", e.target.value)}
        select
      >
        {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CNY"].map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </FormField>

      <FormField
        label="Reason"
        labelClassName="uppercase"
        placeholder="e.g. Product returned, Service adjustment"
        value={creditNote.reason ?? ""}
        onChange={(e) => onField("reason", e.target.value || null)}
      />

      <FormField
        label="Reference Invoice #"
        labelClassName="uppercase"
        placeholder="INV-2026-045"
        value={creditNote.referenceInvoiceNumber ?? ""}
        onChange={(e) => onField("referenceInvoiceNumber", e.target.value || null)}
        helperText="Optional — link to the original invoice"
      />
    </div>
  );
});

const CreditNoteTotalsCard = React.memo(function CreditNoteTotalsCard({
  creditNote,
  calc,
}: {
  creditNote: WorkspaceCreditNoteData;
  calc: any;
}) {
  const c = creditNote.currency;
  const total = calc?.total ?? 0;
  const discount = calc?.discountTotal ?? 0;
  const tax = calc?.taxTotal ?? 0;
  const fees = calc?.feeTotal ?? 0;
  const subtotal = calc?.subtotal ?? 0;

  return (
    <div className="border-t border-color bg-surface-alt px-6 py-5">
      <div className="mx-auto max-w-2xl">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-tabular-nums">
          <div className="text-tertiary">Subtotal</div>
          <div className="text-right font-medium text-primary">{fmt(subtotal, c)}</div>

          {Number(new Decimal(discount ?? 0).toString()) > 0 && (
            <>
              <div className="text-tertiary">Discount</div>
              <div className="text-right font-medium text-success-text">−{fmt(discount, c)}</div>
            </>
          )}

          <div className="text-tertiary">Tax</div>
          <div className="text-right font-medium text-primary">{fmt(tax, c)}</div>

          {Number(new Decimal(fees ?? 0).toString()) > 0 && (
            <>
              <div className="text-tertiary">Fees</div>
              <div className="text-right font-medium text-primary">{fmt(fees, c)}</div>
            </>
          )}

          <div className="border-t-2 border-color pt-3 text-sm font-semibold text-secondary">Total Credit</div>
          <div className="border-t-2 border-color pt-3 text-right text-xl font-bold text-primary-brand">
            -{fmt(total, c)}
          </div>
        </div>
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
    <div className="mb-6 overflow-x-auto rounded-xl border border-color bg-surface p-4">
      <p className="mb-2 text-xs font-semibold text-tertiary uppercase">Saved services</p>
      <div className="flex gap-2">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="flex flex-col items-start rounded-lg border border-color bg-surface-alt px-3 py-2 text-left whitespace-nowrap hover:border-color-strong hover:bg-surface"
          >
            <span className="text-sm font-medium text-primary">{p.name}</span>
            <span className="text-xs text-tertiary">{fmt(p.defaultUnitPrice, p.defaultCurrency)}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

const CreditNoteLineItemsTable = React.memo(function CreditNoteLineItemsTable({
  creditNote,
  calc,
  onItemChange,
  onAdd,
  onDuplicate,
  onRemove,
  defaultTaxRate,
}: {
  creditNote: WorkspaceCreditNoteData;
  calc: any;
  onItemChange: (id: string, patch: Partial<CreditNoteLineItemInput>) => void;
  onAdd: (type?: "service") => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  defaultTaxRate: string;
}) {
  const c = creditNote.currency;
  const meta = getCurrencyMetadata(c);
  const step = meta.decimalPlaces === 0 ? "1" : "0.01";
  const lineTotals = calc?.lineItems ?? [];

  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-color bg-surface shadow-sm">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-surface-alt">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-tertiary">Description</th>
            <th className="px-2 py-3 text-right text-xs font-semibold uppercase text-tertiary">Qty</th>
            <th className="px-2 py-3 text-left text-xs font-semibold uppercase text-tertiary">Unit</th>
            <th className="px-2 py-3 text-right text-xs font-semibold uppercase text-tertiary">Rate</th>
            <th className="px-2 py-3 text-right text-xs font-semibold uppercase text-tertiary">Disc.</th>
            <th className="px-2 py-3 text-center text-xs font-semibold uppercase text-tertiary">Disc.<br/>Type</th>
            <th className="px-2 py-3 text-right text-xs font-semibold uppercase text-tertiary">Tax %</th>
            <th className="px-2 py-3 text-center text-xs font-semibold uppercase text-tertiary">Inc.</th>
            <th className="px-2 py-3 text-right text-xs font-semibold uppercase text-tertiary">Total</th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-tertiary">Actions</th>
          </tr>
        </thead>
        <tbody>
          {creditNote.items.map((item, i) => {
            const lineTotal = lineTotals[i]?.lineTotal ?? null;
            return (
              <tr key={item.id ?? i} className="border-t border-color-subtle">
                <td className="px-4 py-3">
                  <textarea
                    value={item.description}
                    onChange={(e) => onItemChange(item.id ?? String(i), { description: e.target.value })}
                    placeholder="What are you crediting?"
                    rows={2}
                    className="form-control-sm resize-y min-h-[40px] w-full"
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
                    className="form-control-sm w-full text-right font-tabular-nums"
                  />
                </td>
                <td className="px-2 py-3">
                  <select
                    value={item.unit}
                    onChange={(e) =>
                      onItemChange(item.id ?? String(i), { unit: e.target.value })
                    }
                    className="form-control-sm w-full"
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
                      className="form-control-sm w-full text-right font-tabular-nums"
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
                    className="form-control-sm w-full text-right font-tabular-nums"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-2 py-3">
                  <select
                    value={item.discountType ?? "fixed"}
                    onChange={(e) =>
                      onItemChange(item.id ?? String(i), { discountType: e.target.value as "fixed" | "percentage" })
                    }
                    className="form-control-sm w-full"
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
                        taxRate: fromPercent(e.target.value.replace(/[^\d.]/g, "")),
                      })
                    }
                    min={0}
                    max={100}
                    step="0.01"
                    className="form-control-sm w-full text-right font-tabular-nums"
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
                <td className="px-2 py-3 text-right text-sm font-medium text-primary font-tabular-nums">
                  {lineTotal !== null ? fmt(lineTotal, c) : ""}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDuplicate(item.id ?? String(i))}
                      title="Duplicate line"
                      className="rounded p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary"
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

const CreditNoteFeesSection = React.memo(function CreditNoteFeesSection({
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
      <p className="text-xs font-semibold text-tertiary uppercase">Fees &amp; charges</p>
      {fees.map((fee, i) => (
        <div key={i} className="flex items-end gap-2 rounded-lg border border-color bg-surface p-2">
          <input
            type="text"
            value={fee.description}
            onChange={(e) => updateFee(i, { description: e.target.value })}
            placeholder="Description"
            className="flex-1 form-control"
          />
          <input
            type="number"
            value={fee.amount}
            onChange={(e) => updateFee(i, { amount: e.target.value || "0" })}
            placeholder="0.00"
            className="w-32 form-control text-right font-tabular-nums"
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

const CreditNoteNotesSection = React.memo(function CreditNoteNotesSection({
  creditNote,
  onField,
}: {
  creditNote: WorkspaceCreditNoteData;
  onField: (field: keyof WorkspaceCreditNoteData, value: any) => void;
}) {
  return (
    <div className="mb-6 space-y-4">
      <div>
        <label className="form-label-secondary">Notes</label>
        <textarea
          value={creditNote.notes ?? ""}
          onChange={(e) => onField("notes", e.target.value || null)}
          rows={3}
          placeholder="Additional notes for the customer…"
          className="form-control resize-y"
        />
      </div>

      <div>
        <label className="form-label-secondary">Internal Notes</label>
        <textarea
          value={creditNote.internalNotes ?? ""}
          onChange={(e) => onField("internalNotes", e.target.value || null)}
          rows={3}
          placeholder="Internal notes visible only to your team…"
          className="form-control resize-y"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="form-label-secondary">Terms &amp; Conditions</label>
          <textarea
            value={creditNote.terms ?? ""}
            onChange={(e) => onField("terms", e.target.value || null)}
            rows={3}
            placeholder="Payment terms and conditions…"
            className="form-control resize-y"
          />
        </div>
        <div>
          <label className="form-label-secondary">Reason</label>
          <textarea
            value={creditNote.reason ?? ""}
            onChange={(e) => onField("reason", e.target.value || null)}
            rows={3}
            placeholder="Why is this credit being issued?…"
            className="form-control resize-y"
          />
        </div>
      </div>
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

const CreditNoteActionFooter = React.memo(function CreditNoteActionFooter({
  isNew,
  hasCreditNoteId,
  saveState,
  onSaveDraft,
  onDuplicate,
  onCreateAnother,
  onPreview,
  onFinalize,
  onCancel,
  onSend,
  validation,
  creditNote,
  onApplyToInvoice,
}: {
  isNew: boolean;
  hasCreditNoteId: boolean;
  saveState: "saved" | "saving" | "unsaved" | "error";
  onSaveDraft: () => void;
  onDuplicate: () => void;
  onCreateAnother: () => void;
  onPreview: () => void;
  onFinalize: () => void;
  onCancel: (reason: string) => void;
  onSend: () => void;
  validation: ReturnType<typeof useInvoiceValidation>;
  creditNote: WorkspaceCreditNoteData;
  onApplyToInvoice: (invoiceId: string, amount?: string) => void;
}) {
  const isFinalized = creditNote.isFinalized;
  const isCancelled = creditNote.status === "cancelled";
  const showCancelButton = isFinalized && creditNote.status === "finalized";

  const [showCancelDialog, setShowCancelDialog] = useState(false);

  return (
    <footer className="sticky bottom-0 z-10 flex h-16 items-center justify-between border-t border-color bg-surface px-6 shadow-md">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onCreateAnother}>
          Create another
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onDuplicate}
          disabled={!hasCreditNoteId}
        >
          Duplicate
        </Button>
        <Button variant="secondary" size="sm" onClick={onPreview}>
          Preview
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Save className="h-4 w-4" />}
          onClick={onSaveDraft}
          disabled={saveState === "saving" || saveState === "saved"}
        >
          Save draft
        </Button>
        {showCancelButton && (
          <Button
            variant="warning"
            size="sm"
            onClick={() => setShowCancelDialog(true)}
          >
            Cancel
          </Button>
        )}
      </div>
      {!isFinalized && (
        <Button
          variant="primary"
          size="md"
          icon={<FileText className="h-4 w-4" />}
          iconPosition="left"
          onClick={onFinalize}
          disabled={validation.hasErrors}
        >
          Finalize
        </Button>
      )}
      {isFinalized && !isCancelled && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-medium text-info-text">
            Finalized
          </span>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            iconPosition="left"
            onClick={onPreview}
          >
            View PDF
          </Button>
          {creditNote.status === "finalized" && !isCancelled && (
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="h-4 w-4" />}
              iconPosition="left"
              onClick={onSend}
            >
              Send
            </Button>
          )}
        </div>
      )}
      <ConfirmationDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={(data) => {
          onCancel(data?.input ?? "Cancelled by user");
          setShowCancelDialog(false);
        }}
        title="Cancel Credit Note"
        message="This will cancel the credit note. It will remain in your records but cannot be applied to invoices."
        confirmLabel="Cancel Credit Note"
        destructive
        showInput
        inputLabel="Reason (optional)"
        inputPlaceholder="Enter a reason..."
      />
    </footer>
  );
});

const CreditNoteFinalizeDialog = React.memo(function CreditNoteFinalizeDialog({
  creditNote,
  creditNoteId,
  calc,
  validation,
  error,
  onFinalize,
  onClose,
  onDownloadPdf,
}: {
  creditNote: WorkspaceCreditNoteData;
  creditNoteId: string | null;
  calc: any;
  validation: ReturnType<typeof useInvoiceValidation>;
  error: string | null;
  onFinalize: () => void;
  onClose: () => void;
  onDownloadPdf: () => void;
}) {
  const c = creditNote.currency;
  const total = calc?.total ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-surface shadow-xl">
        <div className="border-b border-color p-6">
          <h2 className="text-xl font-semibold text-primary">Finalize Credit Note</h2>
          <p className="mt-1 text-sm text-secondary">
            Finalizing will assign a credit note number and lock this credit note. You'll then be able
            to apply it to an invoice, download a PDF, or issue a refund.
          </p>
        </div>

        {error && <div className="p-4 text-sm text-error-text">{error}</div>}

        <div className="p-6">
          <div className="mb-4 flex justify-end">
            <div className="text-right">
              <p className="text-sm text-tertiary">Total Credit</p>
              <p className="text-2xl font-bold text-primary-brand">-{fmt(total, c)}</p>
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
                {creditNote.customer?.name ?? creditNote.customerId ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-tertiary">Issue date</span>
              <span className="font-medium text-primary">
                {creditNote.issueDate ? formatDate(creditNote.issueDate) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-tertiary">Reason</span>
              <span className="font-medium text-primary">
                {creditNote.reason ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-tertiary">Reference Invoice</span>
              <span className="font-medium text-primary">
                {creditNote.referenceInvoiceNumber ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-tertiary">Items</span>
              <span className="font-medium text-primary">{creditNote.items.length} line item(s)</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-color p-4">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onFinalize}
            disabled={validation.hasErrors}
          >
            Finalize Credit Note
          </Button>
        </div>

        <div className="border-t border-color p-4">
          <p className="text-sm text-tertiary">After finalizing:</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} iconPosition="left" onClick={onDownloadPdf}>
              Download PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { onClose(); }}>
              Apply to Invoice
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

const CreditNotePreviewDialog = React.memo(function CreditNotePreviewDialog({
  creditNote,
  onClose,
  onDownloadPdf,
}: {
  creditNote: PreviewCreditNote;
  onClose: () => void;
  onDownloadPdf: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="h-[85vh] w-[90vw] max-w-4xl overflow-auto rounded-xl bg-surface">
        <div className="sticky top-0 flex items-center justify-between border-b border-color bg-surface-alt px-4 py-2">
          <h3 className="text-sm font-semibold text-secondary">Credit note preview</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              iconPosition="left"
              onClick={onDownloadPdf}
            >
              Download
            </Button>
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
          <CreditNotePreview creditNote={creditNote} />
        </div>
      </div>
    </div>
  );
});
