import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CalculationEngine } from "@/utils/calculation";
import type { InvoiceCalculationInput, LineItemInput, FeeInput, DiscountDefinition } from "@/types/calculation";
import { SUPPORTED_CURRENCIES, getCurrencyMetadata } from "@/types/currency";
  import { useToast, Button, FormField, FormTextareaField, PageHeader, StatusBadge, Dialog, SearchInput, invoiceStatusConfig, quoteStatusConfig, creditNoteStatusConfig } from "@/components/ui";
import SectionCard from "@/components/SectionCard";
import {
  Save,
  Send,
  Plus,
  FileText,
  Bell,
  Copy,
  Search,
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { Decimal } from "decimal.js";
import DocumentPreview from "@/components/DocumentPreview";
import {
  DocumentLineItems,
  DocumentFees,
  DocumentTotalsCard,
  DocumentNotesSection,
  type DocumentState,
  type DocumentLineItem,
  type DocumentFee,
  type SaveState,
  type TaxRateOption,
  type DocumentType,
  initialLineItem,
} from "@/components/document";
import {
  getCustomers,
  getBusiness,
  getTaxRates,
  getProducts,
  getInvoice,
  createInvoice,
  updateInvoice,
  finalizeInvoice,
  sendInvoice,
  sendReminder,
  duplicateInvoice,
  type CreateInvoiceInput,
  type FinalizeInvoiceResult,
  type SendInvoiceResult,
  getQuote,
  createQuote,
  updateQuote,
  finalizeQuote,
  sendQuote,
  duplicateQuote,
  type CreateQuoteInput,
  type FinalizeQuoteResult,
  getCreditNote,
  createCreditNoteDraft,
  finalizeCreditNote,
  type CreateCreditNoteInput,
  getInvoices,
  type ApiInvoiceListItem,
} from "@/api/client";
import type { ApiBusiness, ApiCustomer, ApiTaxRate, ApiProduct } from "@/types/api";
import { formatTaxRate } from "@/utils/format";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const AUTO_SAVE_DELAY = 500;

const PAYMENT_TERMS = [
  { value: "custom", label: "Custom" },
  { value: "0", label: "Due on receipt" },
  { value: "7", label: "Net 7" },
  { value: "15", label: "Net 15" },
  { value: "30", label: "Net 30" },
  { value: "60", label: "Net 60" },
];

const VALIDITY_DAYS_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "custom", label: "Custom" },
];

const REASON_OPTIONS = [
  { value: "", label: "Select a reason" },
  { value: "return", label: "Return" },
  { value: "abatement", label: "Abatement" },
  { value: "correction", label: "Correction" },
  { value: "other", label: "Other" },
];

interface DocumentWorkspaceProps {
  docType: DocumentType;
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

function useDocumentData(
  docType: DocumentType,
  id: string | undefined,
  isNew: boolean,
) {
  const [document, setDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !id) return;
    setIsLoading(true);
    setError(null);

    if (docType === "invoice") {
      getInvoice(id)
        .then((res) => setDocument(res.invoice))
        .catch((err: any) => setError(err.message))
        .finally(() => setIsLoading(false));
    } else if (docType === "quote") {
      getQuote(id)
        .then((res) => setDocument(res.quote))
        .catch((err: any) => setError(err.message))
        .finally(() => setIsLoading(false));
    } else if (docType === "credit-note") {
      getCreditNote(id)
        .then((res) => setDocument(res.creditNote))
        .catch((err: any) => setError(err.message))
        .finally(() => setIsLoading(false));
    }
  }, [docType, id, isNew]);

  return { document, setDocument, isLoading, error };
}

function useDocumentValidation(
  state: DocumentState,
  doc: any,
  docType: DocumentType,
) {
  return useMemo(() => {
    const issues: { code: string; message: string; severity: "error" | "warning"; field?: string }[] = [];

    if (!doc?.customer_id && !state.customerId) {
      issues.push({ code: "MISSING_CUSTOMER", message: "No customer selected", severity: "error" });
    }
    if (!state.issueDate) {
      issues.push({ code: "MISSING_ISSUE_DATE", message: "No issue date set", severity: "error" });
    }
    if (!state.currency) {
      issues.push({ code: "MISSING_CURRENCY", message: "No currency selected", severity: "error" });
    }

    if (docType === "invoice" && state.dueDate && state.issueDate && state.dueDate < state.issueDate) {
      issues.push({ code: "INVALID_DUE_DATE", message: "Due date is before issue date", severity: "error" });
    }

    if (docType === "quote" && state.expiryDate && state.issueDate && state.expiryDate < state.issueDate) {
      issues.push({ code: "INVALID_EXPIRY_DATE", message: "Expiry date is before issue date", severity: "error" });
    }

    const nonEmptyItems = state.items.filter((item) => item.description.trim());
    if (nonEmptyItems.length === 0) {
      issues.push({ code: "EMPTY_LINE_ITEMS", message: "Add at least one line item", severity: "error" });
    }

    for (let i = 0; i < nonEmptyItems.length; i++) {
      const item = nonEmptyItems[i];
      const itemIdx = state.items.indexOf(item);
      const qty = new Decimal(item.quantity || "0");
      if (qty.lte(0)) {
        issues.push({ code: "INVALID_QUANTITY", message: `Line item ${itemIdx + 1} has an invalid quantity`, severity: "error", field: `item-${itemIdx}-quantity` });
      }
      const price = new Decimal(item.unitPrice || "0");
      if (price.isNegative()) {
        issues.push({ code: "NEGATIVE_UNIT_PRICE", message: `Line item ${itemIdx + 1} has a negative unit price`, severity: "error" });
      }
      const rate = new Decimal(item.taxRate || "0");
      if (rate.isNegative()) {
        issues.push({ code: "INVALID_TAX_RATE", message: `Line item ${itemIdx + 1} has an invalid tax rate`, severity: "error" });
      }
    }

    if (!doc?.payment_instructions && !state.paymentInstructions) {
      issues.push({ code: "MISSING_PAYMENT_INSTRUCTIONS", message: "No payment instructions provided", severity: "warning" });
    }

    if (docType === "quote") {
      if (!state.scopeOfWork) {
        issues.push({ code: "MISSING_SCOPE_OF_WORK", message: "No scope of work provided", severity: "warning" });
      }
    }

    if (docType === "credit-note") {
      if (!state.reason && !state.customReason) {
        issues.push({ code: "MISSING_REASON", message: "No reason provided for this credit note", severity: "error" });
      }
    }

    return issues;
  }, [state, doc, docType]);
}

export default function DocumentWorkspace({ docType }: DocumentWorkspaceProps) {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === "new";

  const { document, setDocument, isLoading, error } = useDocumentData(docType, id, isNew);

  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [taxRates, setTaxRates] = useState<ApiTaxRate[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false);
  const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [availableReferenceInvoices, setAvailableReferenceInvoices] = useState<ApiInvoiceListItem[]>([]);

  const [sendData, setSendData] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    message: "",
  });

  const [newCustomerData, setNewCustomerData] = useState({ name: "", email: "", phone: "" });

  const defaultIssueDate = new Date().toISOString().split("T")[0];
  const defaultDueDate = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString().split("T")[0];

  const [state, setState] = useState<DocumentState>({
    customerId: "",
    currency: "USD",
    issueDate: defaultIssueDate,
    notes: "",
    terms: "",
    paymentInstructions: "",
    items: [initialLineItem()],
    fees: [],
    invoiceDiscount: "0",
    invoiceDiscountType: "fixed",
    dueDate: defaultDueDate,
    expiryDate: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString().split("T")[0],
    scopeOfWork: "",
    internalNotes: "",
    quoteDiscount: "0",
    quoteDiscountType: "fixed",
  });

  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFinalized = document?.is_finalized ?? false;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    getCustomers({ limit: 100 }).then((d) => setCustomers(d.customers ?? [])).catch(() => {});
    getBusiness().then((d) => setBusiness(d.business ?? d)).catch(() => {});
    getTaxRates().then((d) => setTaxRates(d.taxRates ?? d.rates ?? [])).catch(() => {});
    const loadProducts = () => {
      getProducts({ limit: 100 }).then((d) => setProducts(d.products ?? [])).catch(() => {});
    };
    loadProducts();

    if (docType === "credit-note") {
      getInvoices({ limit: 100 }).then((d) => setAvailableReferenceInvoices(d.invoices ?? [])).catch(() => {});
    }
  }, [docType]);

  useEffect(() => {
    if (isNew || !document) return;

    const doc = document as any;
    setState((prev) => ({
      ...prev,
      customerId: doc.customer_id ?? "",
      currency: doc.currency ?? "USD",
      issueDate: doc.issue_date ? new Date(doc.issue_date).toISOString().split("T")[0] : defaultIssueDate,
      notes: doc.notes ?? "",
      terms: doc.terms ?? "",
      paymentInstructions: doc.payment_instructions ?? "",
      poNumber: doc.po_number ?? "",
      dueDate: doc.due_date ? new Date(doc.due_date).toISOString().split("T")[0] : prev.dueDate,
      expiryDate: doc.expiry_date ? new Date(doc.expiry_date).toISOString().split("T")[0] : prev.expiryDate,
      scopeOfWork: doc.scope_of_work ?? "",
      internalNotes: doc.internal_notes ?? "",
      invoiceDiscount: doc.invoice_discount ?? "0",
      invoiceDiscountType: doc.invoice_discount_type ?? "fixed",
      shippingDescription: doc.shipping_description ?? "",
      shippingAmount: doc.shipping_amount ?? "0",
      shippingTaxRate: doc.shipping_tax_rate ?? "0",
      quoteDiscount: doc.quote_discount_value ?? "0",
      quoteDiscountType: doc.quote_discount_type ?? "fixed",
      referenceInvoiceId: doc.reference_invoice_id ?? "",
      reason: doc.reason ?? "",
      paymentTerms: "custom",
      items: (doc.items ?? []).map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit ?? "each",
        unitPrice: item.unit_price,
        taxRate: item.tax_rate,
        taxName: item.tax_name ?? "",
        isTaxInclusive: item.is_tax_inclusive,
        discount: item.discount ?? "0",
        discountType: item.discount_type ?? "percentage",
        productId: item.product_id ?? null,
        isOptional: item.is_optional ?? false,
      })),
      fees: (doc.fees ?? []).map((fee: any) => ({
        description: fee.description,
        amount: fee.amount,
        taxRate: fee.tax_rate,
        taxName: fee.tax_name ?? "",
      })),
    }));
  }, [document, isNew, defaultIssueDate]);

  const calcInput: InvoiceCalculationInput = useMemo(() => {
    const currencyCode = (state.currency as any) ?? "USD";
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

    let invoiceDiscountDef: DiscountDefinition | undefined;
    if (docType === "quote") {
      const discValue = state.quoteDiscount ?? "0";
      invoiceDiscountDef =
        Number(discValue) > 0
          ? ({ type: state.quoteDiscountType ?? "fixed", value: new Decimal(discValue) } as DiscountDefinition)
          : undefined;
    } else {
      const discValue = state.invoiceDiscount ?? "0";
      invoiceDiscountDef =
        Number(discValue) > 0
          ? ({ type: state.invoiceDiscountType ?? "fixed", value: new Decimal(discValue) } as DiscountDefinition)
          : undefined;
    }

    return {
      currency: currencyCode,
      lineItems,
      fees,
      invoiceDiscount: invoiceDiscountDef,
    };
  }, [state.items, state.fees, state.invoiceDiscount, state.invoiceDiscountType, state.quoteDiscount, state.quoteDiscountType, state.currency, docType]);

  const calcEngine = useMemo(() => new CalculationEngine(), []);
  const calcResult = useMemo(() => {
    try {
      return calcEngine.calculate(calcInput);
    } catch {
      return null;
    }
  }, [calcInput, calcEngine]);

  const effectiveReason = useMemo(
    () => (docType === "credit-note" && state.reason === "other" ? state.customReason : state.reason),
    [docType, state.reason, state.customReason]
  );

  function hasUnsavedChanges(): boolean {
    if (isNew) return true;
    if (!document) return false;
    const doc = document as any;
    if (state.customerId !== (doc.customer_id ?? "")) return true;
    if (state.currency !== doc.currency) return true;
    if (state.notes !== (doc.notes ?? "")) return true;
    if (state.terms !== (doc.terms ?? "")) return true;
    if (state.paymentInstructions !== (doc.payment_instructions ?? "")) return true;
    return false;
  }

  const buildPayload = () => {
    const commonPayload: any = {
      customerId: state.customerId || undefined,
      currency: state.currency,
      issueDate: state.issueDate || undefined,
      notes: state.notes || undefined,
      terms: state.terms || undefined,
      paymentInstructions: state.paymentInstructions || undefined,
      items: state.items
        .filter((item) => item.description.trim())
        .map((item) => ({
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
          productId: item.productId,
          isOptional: item.isOptional,
        })),
      fees: state.fees
        .filter((f) => f.description.trim())
        .map((fee) => ({
          description: fee.description,
          amount: fee.amount,
          taxRate: fee.taxRate,
          taxName: fee.taxName || undefined,
        })),
    };

    if (docType === "invoice") {
      return {
        ...commonPayload,
        dueDate: state.dueDate || undefined,
        poNumber: state.poNumber ?? undefined,
        invoiceDiscount: state.invoiceDiscount,
        invoiceDiscountType: state.invoiceDiscountType,
        shippingDescription: state.shippingDescription || undefined,
        shippingAmount: state.shippingAmount,
        shippingTaxRate: state.shippingTaxRate,
      } as CreateInvoiceInput;
    }

    if (docType === "quote") {
      return {
        ...commonPayload,
        expiryDate: state.expiryDate || undefined,
        scopeOfWork: state.scopeOfWork || undefined,
        internalNotes: state.internalNotes || undefined,
        quoteDiscount: state.quoteDiscount,
        quoteDiscountType: state.quoteDiscountType,
      } as CreateQuoteInput;
    }

    const effectiveReason = state.reason === "other" ? state.customReason : state.reason;
    return {
      invoiceId: state.referenceInvoiceId || "",
      reason: effectiveReason || undefined,
      notes: state.notes || undefined,
      terms: state.terms || undefined,
      items: state.items
        .filter((item) => item.description.trim())
        .map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          taxName: item.taxName || undefined,
          isTaxInclusive: item.isTaxInclusive,
        })),
    } as CreateCreditNoteInput;
  };

  const doSave = useCallback(async () => {
    const payload = buildPayload();
    if (!payload.items || payload.items.length === 0) {
      toast("Add at least one line item before saving.", { type: "warning", title: "Empty document" });
      return;
    }
    setSaveState("saving");
    try {
      if (isNew) {
        if (docType === "invoice") {
          const res = await createInvoice(payload as CreateInvoiceInput);
          toast(`Created invoice #${res.invoice.invoice_number ?? ""}.`, { type: "success", title: `${docTypeLabel(docType)} created` });
          navigate(`/app/invoices/${res.invoice.id}`);
          setDocument(res.invoice);
        } else if (docType === "quote") {
          const res = await createQuote(payload as CreateQuoteInput);
          toast(`Created quotation #${res.quote.quote_number ?? ""}.`, { type: "success", title: `${docTypeLabel(docType)} created` });
          navigate(`/app/quotes/${res.quote.id}`);
          setDocument(res.quote);
        } else {
          const res = await createCreditNoteDraft(payload as CreateCreditNoteInput);
          toast(`Created credit note draft.`, { type: "success", title: `${docTypeLabel(docType)} created` });
          navigate(`/app/credit-notes/${res.creditNote.id}/edit`);
          setDocument(res.creditNote);
        }
      } else {
        const doc = document as any;
        if (docType === "invoice") {
          await updateInvoice(doc.id, payload as CreateInvoiceInput);
        } else if (docType === "quote") {
          await updateQuote(doc.id, payload as CreateQuoteInput);
        }
        setSaveState("saved");
        if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
        saveStateTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
      }
    } catch (err: any) {
      setSaveState("error");
      toast(err.message, { type: "error", title: "Save failed" });
    } finally {
      if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
    }
  }, [id, isNew, docType, document, state, navigate, toast]);

  useEffect(() => {
    if (isFinalized) return;
    if (!hasUnsavedChanges()) return;
    if (isNew && !document) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      doSave();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [state, isFinalized, hasUnsavedChanges(), isNew, document, doSave]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges() && !isFinalized) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges, isFinalized]);

  useKeyboardShortcuts({
    enabled: !isFinalized,
    onSave: () => doSave(),
    onFinalize: () => !isFinalizing && handleFinalize(),
    onSend: () => !isSending && (document?.is_finalized ? setSendDialogOpen(true) : handleFinalizeAndSend()),
    onAddItem: () => handleAddItem(),
    onAddFee: () => handleAddFee(),
  });

  function docTypeLabel(type: DocumentType): string {
    switch (type) {
      case "invoice": return "Invoice";
      case "quote": return "Quotation";
      case "credit-note": return "Credit Note";
    }
  }

  const getDocumentTitle = () => {
    const doc = document as any;
    if (isNew) {
      return `New ${docTypeLabel(docType)}`;
    }
    const num = doc?.invoice_number ?? doc?.quote_number ?? doc?.credit_note_number ?? "";
    return `${docTypeLabel(docType)} #${num}`;
  };

  const handleFinalize = useCallback(async () => {
    if (isNew && !document) {
      await doSave();
    }
    const doc = document as any;
    if (!doc) return;

    setIsFinalizing(true);
    try {
      let result: any;
      if (docType === "invoice") {
        result = await finalizeInvoice(doc.id) as FinalizeInvoiceResult;
        toast(`Invoice #${result.invoiceNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      } else if (docType === "quote") {
        result = await finalizeQuote(doc.id) as FinalizeQuoteResult;
        toast(`Quotation #${result.quoteNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      } else {
        result = await finalizeCreditNote(doc.id);
        toast(`Credit note finalized.`, { type: "success", title: "Finalized" });
      }
      setDocument(result.invoice ?? result.quote ?? result.creditNote);
      setSaveState("idle");
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [document, isNew, doSave, docType, toast]);

  const handleFinalizeAndSend = useCallback(async () => {
    if (isNew && !document) {
      await doSave();
    }
    const doc = document as any;
    if (!doc) return;

    const issues = validateDocument();
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0 || issues.length > 0) {
      setValidationDialogOpen(true);
      return;
    }

    setValidationDialogOpen(false);
    proceedFinalizeAndSend();
  }, [document, isNew, doSave, toast]);

  const proceedFinalizeAndSend = useCallback(async () => {
    const doc = document as any;
    if (!doc) return;

    setIsFinalizing(true);
    try {
      let result: any;
      if (docType === "invoice") {
        result = await finalizeInvoice(doc.id) as FinalizeInvoiceResult;
        toast(`Invoice #${result.invoiceNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      } else if (docType === "quote") {
        result = await finalizeQuote(doc.id) as FinalizeQuoteResult;
        toast(`Quotation #${result.quoteNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      } else {
        result = await finalizeCreditNote(doc.id);
        toast(`Credit note finalized.`, { type: "success", title: "Finalized" });
      }
      setDocument(result.invoice ?? result.quote ?? result.creditNote);
      setSaveState("idle");
      setSendDialogOpen(true);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [document, docType, toast]);

  const handleSend = useCallback(async () => {
    if (isNew && !document) {
      await doSave();
    }
    const doc = document as any;
    if (!doc || doc.is_finalized) return;
    setSendDialogOpen(true);
  }, [document, isNew, doSave]);

  const confirmSend = useCallback(async () => {
    const doc = document as any;
    if (!doc) return;

    setIsSending(true);
    try {
      if (docType === "invoice") {
        const result: SendInvoiceResult = await sendInvoice(doc.id, sendData);
        toast(`Invoice sent to ${sendData.to || doc.customer_email || "customer"}.`, { type: "success", title: "Sent" });
        const refreshed = await getInvoice(doc.id);
        setDocument(refreshed.invoice);
      } else if (docType === "quote") {
        await sendQuote(doc.id, sendData);
        toast(`Quotation sent to ${sendData.to || doc.customer_email || "customer"}.`, { type: "success", title: "Sent" });
        const refreshed = await getQuote(doc.id);
        setDocument(refreshed.quote);
      } else {
        setSendDialogOpen(false);
        toast("Send functionality for credit notes coming soon.", { type: "info", title: "Not available" });
        return;
      }
      setSendDialogOpen(false);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Send failed" });
    } finally {
      setIsSending(false);
    }
  }, [document, docType, sendData, toast]);

  const handleDuplicate = useCallback(async () => {
    const doc = document as any;
    if (!doc) return;

    try {
      if (docType === "invoice") {
        const result = await duplicateInvoice(doc.id);
        toast("Invoice duplicated.", { type: "success", title: "Duplicated" });
        navigate(`/app/invoices/${result.invoice.id}`);
      } else if (docType === "quote") {
        const result = await duplicateQuote(doc.id);
        toast("Quotation duplicated.", { type: "success", title: "Duplicated" });
        navigate(`/app/quotes/${result.quote.id}`);
      }
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Duplicate failed" });
    }
  }, [document, docType, navigate, toast]);

  const handleSendReminder = useCallback(async () => {
    const doc = document as any;
    if (!doc) return;

    try {
      await sendReminder(doc.id, {
        to: doc.customer_email ?? "",
        subject: `Payment Reminder: ${docTypeLabel(docType)} ${doc.invoice_number ?? doc.quote_number ?? ""}`,
      });
      toast("Reminder sent.", { type: "success", title: "Sent" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Send failed" });
    }
  }, [document, docType, toast]);

  const validateDocument = (): { code: string; message: string; severity: "error" | "warning"; field?: string }[] => {
    const issues: { code: string; message: string; severity: "error" | "warning"; field?: string }[] = [];

    const doc = document as any;
    if (!doc?.customer_id && !state.customerId) {
      issues.push({ code: "MISSING_CUSTOMER", message: "No customer selected", severity: "error" });
    }
    if (!doc?.customer_id && !state.customerId) {
      issues.push({ code: "MISSING_CUSTOMER", message: "No customer selected", severity: "error" });
    }
    if (!state.issueDate) {
      issues.push({ code: "MISSING_ISSUE_DATE", message: "No issue date set", severity: "error" });
    }
    if (state.dueDate && state.issueDate && state.dueDate < state.issueDate) {
      issues.push({ code: "INVALID_DUE_DATE", message: "Due date is before issue date", severity: "error" });
    }
    if (!state.currency) {
      issues.push({ code: "MISSING_CURRENCY", message: "No currency selected", severity: "error" });
    }
    const nonEmptyItems = state.items.filter((item) => item.description.trim());
    if (nonEmptyItems.length === 0) {
      issues.push({ code: "EMPTY_LINE_ITEMS", message: "Add at least one line item", severity: "error" });
    }
    for (let i = 0; i < nonEmptyItems.length; i++) {
      const item = nonEmptyItems[i];
      const itemIdx = state.items.indexOf(item);
      if (!item.description.trim()) {
        issues.push({ code: "MISSING_ITEM_DESCRIPTION", message: `Line item ${itemIdx + 1} is missing a description`, severity: "error", field: `item-${itemIdx}-description` });
      }
      const qty = new Decimal(item.quantity || "0");
      if (qty.lte(0)) {
        issues.push({ code: "INVALID_QUANTITY", message: `Line item ${itemIdx + 1} has an invalid quantity`, severity: "error", field: `item-${itemIdx}-quantity` });
      }
      const price = new Decimal(item.unitPrice || "0");
      if (price.isNegative()) {
        issues.push({ code: "NEGATIVE_UNIT_PRICE", message: `Line item ${itemIdx + 1} has a negative unit price`, severity: "error" });
      }
      const rate = new Decimal(item.taxRate || "0");
      if (rate.isNegative()) {
        issues.push({ code: "INVALID_TAX_RATE", message: `Line item ${itemIdx + 1} has an invalid tax rate`, severity: "error" });
      }
    }

    if (!doc?.payment_instructions && !state.paymentInstructions) {
      issues.push({ code: "MISSING_PAYMENT_INSTRUCTIONS", message: "No payment instructions provided", severity: "warning" });
    }
    if (!doc?.notes && !state.notes) {
      issues.push({ code: "MISSING_NOTES", message: "No notes provided for the customer", severity: "warning" });
    }
    if (!doc?.customer_email && !state.customerId) {
      issues.push({ code: "MISSING_CUSTOMER_EMAIL", message: "Customer has no email address", severity: "warning" });
    }
    return issues;
  };

  const handleUpdateItem = (idx: number, field: keyof DocumentLineItem, value: unknown) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  };

  const handleAddItem = () => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, initialLineItem()],
    }));
  };

  const handleRemoveItem = (idx: number) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleDuplicateItem = (idx: number) => {
    const item = state.items[idx];
    setState((prev) => ({
      ...prev,
      items: [...prev.items, { ...item, description: `${item.description} (copy)` }],
    }));
  };

  const handleAddFee = () => {
    setState((prev) => ({
      ...prev,
      fees: [...prev.fees, { description: "", amount: "0.00", taxRate: "0", taxName: "" }],
    }));
  };

  const handleRemoveFee = (idx: number) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateFee = (idx: number, field: keyof DocumentFee, value: string) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.map((fee, i) => (i === idx ? { ...fee, [field]: value } : fee)),
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = Number(String(active.id).replace("item-", ""));
      const newIndex = Number(String(over.id).replace("item-", ""));
      setState((prev) => ({
        ...prev,
        items: arrayMove(prev.items, oldIndex, newIndex),
      }));
    }
  };

  const handleApplyProduct = (itemIdx: number, product: ApiProduct) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === itemIdx
          ? {
              ...item,
              description: product.name,
              unitPrice: product.defaultUnitPrice ?? "0",
              unit: product.unit ?? "each",
              taxRate: product.defaultTaxRate ?? "0",
              productId: product.id,
            }
          : item
      ),
    }));
    setProductPickerOpen(false);
    setProductSearch("");
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerData.name.trim()) {
      toast("Customer name is required", { type: "error", title: "Validation error" });
      return;
    }
    try {
      const { createCustomer } = await import("@/api/client");
      const res = await createCustomer({
        name: newCustomerData.name,
        email: newCustomerData.email || undefined,
        phone: newCustomerData.phone || undefined,
      });
      const cust = res.customer ?? res;
      setCustomers((prev) => [...prev, cust]);
      setState((prev) => ({ ...prev, customerId: cust.id }));
      setNewCustomerDialogOpen(false);
      setNewCustomerData({ name: "", email: "", phone: "" });
      toast("Customer created.", { type: "success", title: "Customer created" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Failed to create customer" });
    }
  };

  const handleCreateProduct = async () => {
    if (!newProductName.trim()) {
      toast("Product name is required", { type: "error", title: "Validation error" });
      return;
    }
    try {
      const { createProduct } = await import("@/api/client");
      const res = await createProduct({
        name: newProductName,
        description: "",
        defaultUnitPrice: newProductPrice || "0",
        defaultTaxRate: "0",
        unit: "each",
        defaultCurrency: state.currency || business?.defaultCurrency,
      });
      const prod = res.product ?? res;
      setProducts((prev) => [...prev, prod]);
      setNewProductDialogOpen(false);
      setNewProductName("");
      setNewProductPrice("");
      toast("Product created.", { type: "success", title: "Product created" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Failed to create product" });
    }
  };

  const taxRateOptions = buildTaxRateOptions(taxRates);
  const customerName = state.customerId
    ? customers.find((c) => c.id === state.customerId)?.name ??
      customers.find((c) => c.id === state.customerId)?.email ??
      "—"
    : "Select a customer";

  const statusConfig = useMemo(() => {
    if (docType === "invoice") return invoiceStatusConfig;
    if (docType === "quote") return quoteStatusConfig;
    return creditNoteStatusConfig;
  }, [docType]);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64 text-secondary">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mr-3" />
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <PageHeader title={docTypeLabel(docType)} />
        <div className="p-4 rounded-md bg-error-bg text-error-text">{error}</div>
      </div>
    );
  }

  return (
    <div className="page-container h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader
        title={getDocumentTitle()}
        breadcrumbs={
          !isNew
            ? [
                { label: docTypeLabel(docType) === "Invoice" ? "Invoices" : docTypeLabel(docType) === "Quotation" ? "Quotations" : "Credit Notes", to: `/app/${docType === "credit-note" ? "credit-notes" : docType === "quote" ? "quotes" : "invoices"}` },
              ]
            : [{ label: docTypeLabel(docType) === "Invoice" ? "Invoices" : docTypeLabel(docType) === "Quotation" ? "Quotations" : "Credit Notes", to: `/app/${docType === "credit-note" ? "credit-notes" : docType === "quote" ? "quotes" : "invoices"}` }]
        }
        primaryAction={
          <div className="flex items-center gap-3">
            {!isNew && document && (
              <StatusBadge status={document.status} config={statusConfig} />
            )}
            <div className="flex items-center gap-2 text-sm">
              {saveState === "saving" && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-info" />
                  <span className="text-tertiary">Saving…</span>
                </>
              )}
              {saveState === "saved" && (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-tertiary">Saved</span>
                </>
              )}
              {saveState === "error" && (
                <>
                  <AlertCircle className="h-4 w-4 text-error" />
                  <span className="text-error">Save failed</span>
                </>
              )}
            </div>
            {isFinalized && !isNew ? (
              <>
                {docType === "invoice" && (
                  <Button
                    variant="ghost"
                    icon={<Bell className="h-4 w-4" />}
                    onClick={handleSendReminder}
                    size="sm"
                  >
                    Send Reminder
                  </Button>
                )}
                <Button
                  variant="ghost"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={handleDuplicate}
                  size="sm"
                  disabled={docType === "credit-note"}
                >
                  Duplicate
                </Button>
                <Button
                  variant="primary"
                  icon={<Send className="h-4 w-4" />}
                  onClick={() => setSendDialogOpen(true)}
                  disabled={isSending || docType === "credit-note"}
                  loading={isSending}
                >
                  Send
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  icon={<Save className="h-4 w-4" />}
                  onClick={doSave}
                  disabled={saveState === "saving"}
                  loading={saveState === "saving"}
                >
                  Save Draft
                </Button>
                <Button
                  variant="primary"
                  icon={<FileText className="h-4 w-4" />}
                  onClick={handleFinalizeAndSend}
                  disabled={isFinalizing}
                  loading={isFinalizing}
                >
                  {isNew ? "Create & Send" : "Review & Send"}
                </Button>
              </>
            )}
          </div>
        }
      />

       <div className="flex-1 overflow-hidden">
         {/* Mobile tab toggle — hidden on desktop */}
         <div className="lg:hidden flex border-b border-color bg-surface">
           <button
             onClick={() => setMobileView("editor")}
             className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
               mobileView === "editor"
                 ? "border-primary text-primary"
                 : "border-transparent text-tertiary hover:text-primary"
             }`}
             aria-label="Edit document"
           >
             Edit
           </button>
           <button
             onClick={() => setMobileView("preview")}
             className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
               mobileView === "preview"
                 ? "border-primary text-primary"
                 : "border-transparent text-tertiary hover:text-primary"
             }`}
             aria-label="Preview document"
           >
             Preview
           </button>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-8rem)] overflow-hidden">
           {/* Editor column — hidden on mobile when preview is active */}
           <div className={`overflow-y-auto space-y-6 pr-2 ${mobileView === "preview" ? "hidden lg:block" : "block"}`}>
             <SectionCard title="Customer">
              <div className="p-5 space-y-3">
                <FormField
                  label="Customer"
                  select
                  value={state.customerId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__new__") {
                      setNewCustomerDialogOpen(true);
                    } else {
                      setState((prev) => ({ ...prev, customerId: val }));
                    }
                  }}
                  disabled={isFinalized}
                  helperText={customerName !== "Select a customer" ? customerName : undefined}
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.email ?? c.id}
                    </option>
                  ))}
                  <option value="__new__" className="font-medium text-primary">
                    + Add new customer…
                  </option>
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Document Details">
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Currency"
                    select
                    value={state.currency}
                    onChange={(e) => setState((prev) => ({ ...prev, currency: e.target.value }))}
                    disabled={isFinalized}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => {
                      const meta = (() => {
                        try {
                          return getCurrencyMetadata(c);
                        } catch {
                          return null;
                        }
                      })();
                      return (
                        <option key={c} value={c}>
                          {c} {meta ? `(${meta.symbol}, ${meta.decimalPlaces}dp)` : ""}
                        </option>
                      );
                    })}
                  </FormField>

                  <FormField
                    label="Issue Date"
                    type="date"
                    value={state.issueDate}
                    onChange={(e) => setState((prev) => ({ ...prev, issueDate: e.target.value }))}
                    disabled={isFinalized}
                  />
                </div>

                {docType === "invoice" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        label="Payment Terms"
                        select
                        value={state.paymentTerms ?? "30"}
                        onChange={(e) => {
                          const terms = e.target.value;
                          if (terms === "custom") {
                            setState((prev) => ({ ...prev, paymentTerms: "custom" }));
                          } else {
                            const days = parseInt(terms, 10);
                            const issue = new Date(state.issueDate);
                            const due = new Date(issue);
                            due.setDate(issue.getDate() + days);
                            setState((prev) => ({
                              ...prev,
                              paymentTerms: terms,
                              dueDate: due.toISOString().split("T")[0],
                            }));
                          }
                        }}
                        disabled={isFinalized}
                      >
                        {PAYMENT_TERMS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </FormField>
                      <FormField
                        label="Due Date"
                        type="date"
                        value={state.dueDate ?? ""}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            dueDate: e.target.value,
                            paymentTerms: "custom",
                          }))
                        }
                        disabled={isFinalized}
                      />
                    </div>

                    <FormField
                      label="PO Number"
                      placeholder="Optional"
                      value={state.poNumber ?? ""}
                      onChange={(e) => setState((prev) => ({ ...prev, poNumber: e.target.value }))}
                      disabled={isFinalized}
                    />
                  </>
                )}

                {docType === "quote" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                     <FormField
                         label="Validity Period"
                         select
                         value={state.expiryDate ? "custom" : state.paymentTerms ?? "30"}
                         onChange={(e) => {
                           const val = e.target.value;
                           if (val === "custom") {
                             setState((prev) => ({ ...prev, paymentTerms: "custom" }));
                           } else {
                             const days = parseInt(val, 10);
                             const issue = new Date(state.issueDate);
                             const expiry = new Date(issue);
                             expiry.setDate(issue.getDate() + days);
                             setState((prev) => ({
                               ...prev,
                               paymentTerms: val,
                               expiryDate: expiry.toISOString().split("T")[0],
                             }));
                           }
                         }}
                         disabled={isFinalized}
                       >
                        {VALIDITY_DAYS_OPTIONS.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </FormField>
                      <FormField
                        label="Expiry Date"
                        type="date"
                        value={state.expiryDate ?? ""}
                        onChange={(e) => setState((prev) => ({ ...prev, expiryDate: e.target.value }))}
                        disabled={isFinalized}
                      />
                    </div>
                  </>
                )}

                {docType === "credit-note" && (
                  <>
                    <FormField
                      label="Reference Invoice"
                      select
                      value={state.referenceInvoiceId ?? ""}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, referenceInvoiceId: e.target.value }))
                      }
                      disabled={isFinalized}
                    >
                      <option value="">Select source invoice</option>
                      {availableReferenceInvoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number ?? inv.id} — {inv.customer_name ?? "—"}
                        </option>
                      ))}
                    </FormField>

                    <FormField
                      label="Reason"
                      select
                      value={state.reason === "other" ? state.reason : state.reason ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setState((prev) => ({
                          ...prev,
                          reason: val,
                          customReason: val === "other" ? prev.customReason : "",
                        }));
                      }}
                      disabled={isFinalized}
                    >
                      <option value="">Select a reason</option>
                      {REASON_OPTIONS.slice(1).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </FormField>

                    {state.reason === "other" && (
                      <FormField
                        label="Custom Reason"
                        placeholder="Enter reason..."
                        value={state.customReason ?? ""}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, customReason: e.target.value }))
                        }
                        disabled={isFinalized}
                      />
                    )}
                  </>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Line Items">
              <div className="p-5">
                <DocumentLineItems
                  items={state.items}
                  isFinalized={isFinalized}
                  taxRateOptions={taxRateOptions}
                  showOptional={docType === "quote"}
                  onUpdate={handleUpdateItem}
                  onRemove={handleRemoveItem}
                  onDuplicate={handleDuplicateItem}
                  onAdd={handleAddItem}
                />
              </div>
            </SectionCard>

            <DocumentTotalsCard
              calcResult={calcResult}
              currency={state.currency}
              invoiceDiscount={docType === "quote" ? state.quoteDiscount : state.invoiceDiscount}
              invoiceDiscountType={docType === "quote" ? state.quoteDiscountType : state.invoiceDiscountType}
              onDiscountChange={(v) =>
                docType === "quote"
                  ? setState((prev) => ({ ...prev, quoteDiscount: v }))
                  : setState((prev) => ({ ...prev, invoiceDiscount: v }))
              }
              onDiscountTypeChange={(v) =>
                docType === "quote"
                  ? setState((prev) => ({ ...prev, quoteDiscountType: v }))
                  : setState((prev) => ({ ...prev, invoiceDiscountType: v }))
              }
              isFinalized={isFinalized}
            />

            <SectionCard title="Fees">
              <div className="p-5">
                <DocumentFees
                  fees={state.fees}
                  isFinalized={isFinalized}
                  taxRateOptions={taxRateOptions}
                  onUpdate={handleUpdateFee}
                  onRemove={handleRemoveFee}
                  onAdd={handleAddFee}
                />
              </div>
            </SectionCard>

            <SectionCard title="Notes & Terms">
              <div className="p-5">
                <DocumentNotesSection
                  notes={state.notes}
                  terms={state.terms}
                  paymentInstructions={state.paymentInstructions}
                  scopeOfWork={state.scopeOfWork}
                  internalNotes={state.internalNotes}
                  isQuote={docType === "quote"}
                  isCreditNote={docType === "credit-note"}
                  onNotesChange={(v) => setState((prev) => ({ ...prev, notes: v }))}
                  onTermsChange={(v) => setState((prev) => ({ ...prev, terms: v }))}
                  onPaymentInstructionsChange={(v) =>
                    setState((prev) => ({ ...prev, paymentInstructions: v }))
                  }
                  onScopeOfWorkChange={(v) =>
                    setState((prev) => ({ ...prev, scopeOfWork: v }))
                  }
                  onInternalNotesChange={(v) =>
                    setState((prev) => ({ ...prev, internalNotes: v }))
                  }
                  disabled={isFinalized}
                />
              </div>
            </SectionCard>

            {!isFinalized && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => { setProductPickerOpen(true); setProductSearch(""); }} disabled={products.length === 0}>
                  Add from Product
                </Button>
              </div>
            )}
           </div>

           {/* Preview column — hidden on mobile when editor is active */}
           <div className={`overflow-y-auto ${mobileView === "editor" ? "hidden lg:block" : "block"}`}>
             <DocumentPreview
              documentType={docType === "credit-note" ? "credit-note" : docType === "quote" ? "quote" : "invoice"}
              documentNumber={document?.invoice_number ?? document?.quote_number ?? document?.credit_note_number}
              calcResult={calcResult}
              business={business}
              issueDate={state.issueDate}
              dueDate={state.dueDate}
              expiryDate={state.expiryDate}
              poNumber={state.poNumber}
              customerId={state.customerId}
              customers={customers}
              paymentInstructions={state.paymentInstructions}
              notes={state.notes}
              terms={state.terms}
              scopeOfWork={state.scopeOfWork}
              signedAmounts={docType === "credit-note"}
              reason={docType === "credit-note" ? effectiveReason : undefined}
              shippingDescription={docType === "invoice" ? state.shippingDescription : undefined}
              shippingAmount={docType === "invoice" ? state.shippingAmount : undefined}
              shippingTaxRate={docType === "invoice" ? state.shippingTaxRate : undefined}
              status={document?.status}
              paymentState={document?.payment_state ?? null}
            />
          </div>
        </div>
      </div>

      <Dialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        title={`Send ${docTypeLabel(docType)}`}
        description={(document as any)?.customer_email ? `Sending to ${(document as any).customer_email}` : undefined}
        size="md"
        closeOnOverlayClick={false}
      >
        <div className="space-y-4">
          <FormField
            label="To"
            type="email"
            placeholder={(document as any)?.customer_email ?? "customer@example.com"}
            value={sendData.to}
            onChange={(e) => setSendData((prev) => ({ ...prev, to: e.target.value }))}
          />
          <FormField
            label="Cc"
            type="email"
            placeholder="cc@example.com"
            value={sendData.cc}
            onChange={(e) => setSendData((prev) => ({ ...prev, cc: e.target.value }))}
          />
          <FormField
            label="Bcc"
            type="email"
            placeholder="bcc@example.com"
            value={sendData.bcc}
            onChange={(e) => setSendData((prev) => ({ ...prev, bcc: e.target.value }))}
          />
          <FormField
            label="Subject"
            placeholder={`${docTypeLabel(docType)} #${document?.invoice_number ?? document?.quote_number ?? document?.credit_note_number ?? ""}`}
            value={sendData.subject}
            onChange={(e) => setSendData((prev) => ({ ...prev, subject: e.target.value }))}
          />
          <FormTextareaField
            label="Message"
            placeholder={`Hi, please find your ${docTypeLabel(docType).toLowerCase()} attached.`}
            value={sendData.message}
            onChange={(e) => setSendData((prev) => ({ ...prev, message: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-color-subtle">
          <Button variant="secondary" size="sm" onClick={() => setSendDialogOpen(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={isSending} onClick={confirmSend}>
            Send
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={validationDialogOpen}
        onClose={() => setValidationDialogOpen(false)}
        title={`Review & Send — ${docTypeLabel(docType)}`}
        description="Please review the issues below before sending."
        size="md"
      >
        <ValidationIssuesList
          issues={validateDocument()}
          onProceed={() => {
            setValidationDialogOpen(false);
            proceedFinalizeAndSend();
          }}
          onCancel={() => setValidationDialogOpen(false)}
          isFinalizing={isFinalizing}
        />
      </Dialog>

      <Dialog
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        title="Select Product"
        description="Search and select a product to add as a line item."
        size="md"
      >
        <div className="space-y-3 max-h-80">
          <div className="flex gap-2">
            <SearchInput
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search products..."
              autoFocus
            />
            <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setNewProductDialogOpen(true)}>
              New
            </Button>
          </div>
          {products
            .filter(
              (p) =>
                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                (p.description?.toLowerCase().includes(productSearch.toLowerCase()) ?? false) ||
                (p.sku?.toLowerCase().includes(productSearch.toLowerCase()) ?? false)
            )
            .length === 0 ? (
            <p className="text-tertiary text-sm">No products found.</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {products
                .filter(
                  (p) =>
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    (p.description?.toLowerCase().includes(productSearch.toLowerCase()) ?? false) ||
                    (p.sku?.toLowerCase().includes(productSearch.toLowerCase()) ?? false)
                )
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const idx = state.items.findIndex((item) => !item.description.trim());
                      const targetIdx = idx >= 0 ? idx : state.items.length - 1;
                      handleApplyProduct(targetIdx, p);
                      setProductPickerOpen(false);
                    }}
                    className="w-full text-left p-3 border border-color rounded-md hover:bg-surface-alt transition-colors"
                  >
                    <div className="font-medium text-primary">{p.name}</div>
                    {p.description && <div className="text-sm text-tertiary">{p.description}</div>}
                    <div className="flex gap-4 text-xs text-tertiary mt-1">
                      <span>Price: {p.defaultUnitPrice}</span>
                      {p.sku && <span>SKU: {p.sku}</span>}
                      <span>Unit: {p.unit}</span>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setNewProductDialogOpen(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={newCustomerDialogOpen}
        onClose={() => setNewCustomerDialogOpen(false)}
        title="Add New Customer"
        description="Create a new customer while creating this document."
        size="md"
      >
        <div className="space-y-3">
          <FormField
            label="Name"
            placeholder="Customer name"
            value={newCustomerData.name}
            onChange={(e) => setNewCustomerData((prev) => ({ ...prev, name: e.target.value }))}
          />
          <FormField
            label="Email"
            type="email"
            placeholder="customer@example.com"
            value={newCustomerData.email}
            onChange={(e) => setNewCustomerData((prev) => ({ ...prev, email: e.target.value }))}
          />
          <FormField
            label="Phone"
            placeholder="+1 (555) 123-4567"
            value={newCustomerData.phone}
            onChange={(e) => setNewCustomerData((prev) => ({ ...prev, phone: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setNewCustomerDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreateCustomer}>
            Create Customer
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={newProductDialogOpen}
        onClose={() => setNewProductDialogOpen(false)}
        title="Add New Product"
        description="Create a new product or service to add as a line item."
        size="md"
      >
        <div className="space-y-3">
          <FormField
            label="Name"
            placeholder="Product or service name"
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
          />
          <FormField
            label="Price"
            placeholder="0.00"
            value={newProductPrice}
            onChange={(e) => setNewProductPrice(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setNewProductDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreateProduct}>
            Create Product
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

interface ValidationIssuesListProps {
  issues: { code: string; message: string; severity: "error" | "warning"; field?: string }[];
  onProceed: () => void;
  onCancel: () => void;
  isFinalizing: boolean;
}

function ValidationIssuesList({ issues, onProceed, onCancel, isFinalizing }: ValidationIssuesListProps) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const hasErrors = errors.length > 0;

  return (
    <div className="space-y-4">
      {issues.length === 0 ? (
        <div className="text-center py-4 text-tertiary">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
          <p>No issues found. You're ready to send.</p>
        </div>
      ) : (
        <>
          {hasErrors && (
            <div>
              <h4 className="text-sm font-medium text-error mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Errors ({errors.length})
              </h4>
              <ul className="space-y-1 text-sm">
                {errors.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-error-text">
                    <span className="mt-0.5">•</span>
                    <span className="flex-1">{issue.message}</span>
                    {issue.field && (
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(issue.field!);
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            const input = el.querySelector('input, select, textarea') as HTMLElement | null;
                            input?.focus();
                          }
                        }}
                        className="text-xs font-medium text-secondary hover:text-primary underline"
                      >
                        Go to field
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
           )}
           {warnings.length > 0 && (
             <div>
               <h4 className="text-sm font-medium text-warning-text mb-2 flex items-center gap-2">
                 <AlertCircle className="h-4 w-4" />
                 Warnings ({warnings.length})
               </h4>
               <ul className="space-y-1 text-sm">
                 {warnings.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-secondary">
                    <span className="mt-0.5">•</span>
                    <span className="flex-1">{issue.message}</span>
                    {issue.field && (
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(issue.field!);
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            const input = el.querySelector('input, select, textarea') as HTMLElement | null;
                            input?.focus();
                          }
                        }}
                        className="text-xs font-medium text-secondary hover:text-primary underline"
                      >
                        Go to field
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
           )}
        </>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t border-color-subtle">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={isFinalizing}
          onClick={onProceed}
          disabled={hasErrors || isFinalizing}
        >
          {hasErrors ? "Fix errors to proceed" : "Finalize & Send"}
        </Button>
      </div>
    </div>
  );
}
