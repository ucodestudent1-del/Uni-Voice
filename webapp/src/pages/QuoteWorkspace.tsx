import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getQuote,
  createQuote,
  updateQuote,
  finalizeQuote,
  sendQuote,
  duplicateQuote,
  getCustomers,
  getBusiness,
  getTaxRates,
  getProducts,
  createCustomer,
  createProduct,
  type CreateQuoteInput,
  type CreateQuoteItemInput,
  type CreateQuoteFeeInput,
  type FinalizeQuoteResult,
  type SendQuoteResult,
  type SendQuoteData,
} from "@/api/client";
import { CalculationEngine, type InvoiceCalculationInput, type LineItemInput, type FeeInput, type DiscountDefinition } from "@/utils/calculation";
import { type CurrencyCode, SUPPORTED_CURRENCIES, getCurrencyMetadata } from "@/types/currency";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Button,
  FormField,
  FormTextareaField,
  PageHeader,
  StatusBadge,
  quoteStatusConfig,
  Money,
  Dialog,
} from "@/components/ui";
import {
  Save,
  Send,
  Plus,
  Trash2,
  FileText,
  GripVertical,
  Copy,
   CheckCircle,
   AlertCircle,
  Loader2,
  Tag,
  Search,
} from "lucide-react";
import { Decimal } from "decimal.js";
import DocumentPreview from "@/components/DocumentPreview";
import { formatDate } from "@/utils/format";
import type { ApiQuote, ApiQuoteItem, ApiQuoteFee, ApiBusiness, ApiCustomer, ApiTaxRate, ApiProduct } from "@/types/api";
import { formatTaxRate } from "@/utils/format";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

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
  productId: string | null;
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
    productId: null,
    isOptional: false,
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
  paymentTerms: string;
  expiryDate: string;
  notes: string;
  terms: string;
  paymentInstructions: string;
  scopeOfWork: string;
  internalNotes: string;
  items: LocalItem[];
  fees: LocalFee[];
  quoteDiscount: string;
  quoteDiscountType: "fixed" | "percentage";
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  field?: string;
}

interface TaxRateOption {
  value: string;
  label: string;
  taxId: string;
  rate: string;
  name: string;
}

const VALIDITY_DAYS_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "custom", label: "Custom" },
];

const AUTO_SAVE_DELAY = 500;

function useDirtyChanges(state: LocalState, quote: ApiQuote | null, isNew: boolean): boolean {
  return useMemo(() => {
    if (isNew) return true;
    if (!quote) return false;
    if (state.customerId !== (quote.customer_id ?? "")) return true;
    if (state.currency !== quote.currency) return true;
    if (state.notes !== (quote.notes ?? "")) return true;
    if (state.terms !== (quote.terms ?? "")) return true;
    if (state.paymentInstructions !== (quote.payment_instructions ?? "")) return true;
    if (state.scopeOfWork !== (quote.scope_of_work ?? "")) return true;
    if (state.internalNotes !== (quote.internal_notes ?? "")) return true;
    if (state.quoteDiscount !== (quote.quote_discount_value ?? "0")) return true;
    if (state.quoteDiscountType !== (quote.quote_discount_type ?? "fixed")) return true;
    return false;
  }, [state, quote, isNew]);
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

export default function QuoteWorkspace() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [taxRates, setTaxRates] = useState<ApiTaxRate[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendData, setSendData] = useState<SendQuoteData>({ to: "", cc: "", bcc: "", subject: "", message: "" });
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false);
  const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newCustomerData, setNewCustomerData] = useState({ name: "", email: "", phone: "" });

  const [state, setState] = useState<LocalState>({
    customerId: "",
    currency: "USD",
    issueDate: new Date().toISOString().split("T")[0],
    paymentTerms: "30",
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
    terms: "",
    paymentInstructions: "",
    scopeOfWork: "",
    internalNotes: "",
    items: [initialItem()],
    fees: [],
    quoteDiscount: "0",
    quoteDiscountType: "percentage",
  });

  const autosaveTimerRef = useRef<number | null>(null);
  const saveStateTimerRef = useRef<number | null>(null);

  const isFinalized = quote?.is_finalized ?? false;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadProducts = useCallback(() => {
    getProducts({ limit: 100 })
      .then((d) => setProducts(d.products ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getCustomers({ limit: 100 }).then((d) => setCustomers(d.customers ?? [])).catch(() => {});
    getBusiness().then((d) => setBusiness(d.business ?? d)).catch(() => {});
    getTaxRates().then((d) => setTaxRates(d.taxRates ?? d.rates ?? [])).catch(() => {});
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!isNew && id) {
      getQuote(id).then((res) => {
        const q: ApiQuote = res.quote;
        setQuote(q);
        setState({
          customerId: q.customer_id ?? "",
          currency: q.currency,
          issueDate: q.issue_date ? q.issue_date.split("T")[0] : new Date().toISOString().split("T")[0],
          paymentTerms: "30",
          expiryDate: q.expiry_date ? q.expiry_date.split("T")[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          notes: q.notes ?? "",
          terms: q.terms ?? "",
          paymentInstructions: q.payment_instructions ?? "",
          scopeOfWork: q.scope_of_work ?? "",
          internalNotes: q.internal_notes ?? "",
          items: (q.items ?? []).map((item: ApiQuoteItem) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unit_price,
            taxRate: item.tax_rate,
            taxName: item.tax_name ?? "",
            isTaxInclusive: item.is_tax_inclusive,
            discount: item.discount ?? "0",
            discountType: item.discount_type ?? "percentage",
            productId: item.product_id ?? null,
            isOptional: item.is_optional ?? false,
          })),
          fees: (q.fees ?? []).map((fee: ApiQuoteFee) => ({
            description: fee.description,
            amount: fee.amount,
            taxRate: fee.tax_rate,
            taxName: fee.tax_name ?? "",
          })),
          quoteDiscount: q.quote_discount_value ?? "0",
          quoteDiscountType: q.quote_discount_type ?? "percentage",
        });
      }).catch((err: any) => {
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
      fees: fees.length > 0 ? fees : undefined,
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

  const hasUnsavedChanges = useDirtyChanges(state, quote, isNew);

  const buildPayload = (): CreateQuoteInput => ({
    customerId: state.customerId || undefined,
    currency: state.currency,
    issueDate: state.issueDate || undefined,
    expiryDate: state.expiryDate || undefined,
    notes: state.notes || undefined,
    terms: state.terms || undefined,
    paymentInstructions: state.paymentInstructions || undefined,
    scopeOfWork: state.scopeOfWork || undefined,
    internalNotes: state.internalNotes || undefined,
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
      sortOrder: 0,
      productId: item.productId,
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
      toast("Add at least one line item before saving.", { type: "warning", title: "Empty quotation" });
      return;
    }
    setSaveState("saving");
    try {
      if (isNew) {
        const res = await createQuote(payload);
        toast(`Created quotation #${res.quote.quote_number ?? ""}.`, { type: "success", title: "Quotation created" });
        navigate(`/app/quotes/${res.quote.id}`);
        setQuote(res.quote);
      } else {
        await updateQuote(id!, payload);
        setSaveState("saved");
        if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
        saveStateTimerRef.current = window.setTimeout(() => setSaveState("idle"), 2000);
      }
    } catch (err: any) {
      setSaveState("error");
      toast(err.message, { type: "error", title: "Save failed" });
    } finally {
      if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
    }
  }, [id, isNew, navigate, toast, state, saveStateTimerRef]);

  useEffect(() => {
    if (isFinalized) return;
    if (!hasUnsavedChanges) return;
    if (isNew && !quote) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = window.setTimeout(() => {
      doSave();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [state, isFinalized, hasUnsavedChanges, isNew, quote, doSave]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isFinalized) {
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
    onSend: () => !isSending && (quote?.is_finalized ? setSendDialogOpen(true) : handleFinalizeAndSend()),
    onAddItem: () => addItem(),
    onAddFee: () => addFee(),
    onDuplicate: () => {
      const firstIdx = 0;
      if (firstIdx < state.items.length) duplicateItem(firstIdx);
    },
  });

  const handleValidityDaysChange = (days: string) => {
    if (days === "custom") return;
    const issueDate = new Date(state.issueDate);
    const expiry = new Date(issueDate);
    expiry.setDate(issueDate.getDate() + parseInt(days, 10));
    setState((prev) => ({
      ...prev,
      paymentTerms: days,
      expiryDate: expiry.toISOString().split("T")[0],
    }));
  };

  const handleIssueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIssueDate = e.target.value;
    const days = parseInt(state.paymentTerms, 10);
    const issue = new Date(newIssueDate);
    const expiry = new Date(issue);
    expiry.setDate(issue.getDate() + (days || 30));
    setState((prev) => ({
      ...prev,
      issueDate: newIssueDate,
      expiryDate: expiry.toISOString().split("T")[0],
    }));
  };

  const handleFinalize = useCallback(async () => {
    if (isNew && !quote) {
      await doSave();
    }
    if (!quote) return;
    setIsFinalizing(true);
    try {
      const result: FinalizeQuoteResult = await finalizeQuote(quote.id);
      toast(`Quotation #${result.quoteNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      setQuote(result.quote);
      setSaveState("idle");
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [quote, isNew, doSave, toast]);

  const handleFinalizeAndSend = useCallback(async () => {
    if (isNew && !quote) {
      await doSave();
    }
    if (!quote) return;

    const issues = validateQuote();
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      setValidationDialogOpen(true);
      return;
    }
    if (issues.length > 0) {
      setValidationDialogOpen(true);
      return;
    }

    setValidationDialogOpen(false);
    proceedFinalizeAndSend();
  }, [quote, isNew, doSave, toast]);

  const proceedFinalizeAndSend = useCallback(async () => {
    if (!quote) return;
    setIsFinalizing(true);
    try {
      const result: FinalizeQuoteResult = await finalizeQuote(quote.id);
      toast(`Quotation #${result.quoteNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      setQuote(result.quote);
      setSaveState("idle");
      setSendDialogOpen(true);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [quote, toast]);

  const confirmSend = useCallback(async () => {
    if (!quote) return;
    setIsSending(true);
    try {
      const result: SendQuoteResult = await sendQuote(quote.id, sendData);
      toast(`Quotation sent to ${sendData.to || quote.customer_email || "customer"}.`, { type: "success", title: "Sent" });
      const refreshed = await getQuote(quote.id);
      setQuote(refreshed.quote);
      setSendDialogOpen(false);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Send failed" });
    } finally {
      setIsSending(false);
    }
  }, [quote, sendData, toast]);

  const handleDuplicate = useCallback(async () => {
    if (!quote) return;
    try {
      const result = await duplicateQuote(quote.id);
      toast("Quotation duplicated.", { type: "success", title: "Duplicated" });
      navigate(`/app/quotes/${result.quote.id}`);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Duplicate failed" });
    }
  }, [quote, navigate, toast]);

  const validateQuote = (): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    if (!quote?.customer_id) {
      issues.push({ code: "MISSING_CUSTOMER", message: "No customer selected", severity: "error" });
    }
    if (!state.issueDate) {
      issues.push({ code: "MISSING_ISSUE_DATE", message: "No issue date set", severity: "error" });
    }
    if (state.expiryDate && state.issueDate && state.expiryDate < state.issueDate) {
      issues.push({ code: "INVALID_EXPIRY_DATE", message: "Expiry date is before issue date", severity: "error" });
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
    if (!state.scopeOfWork) {
      issues.push({ code: "MISSING_SCOPE_OF_WORK", message: "No scope of work provided", severity: "warning" });
    }
    if (!quote?.customer_email && !quote?.customer_id) {
      issues.push({ code: "MISSING_CUSTOMER_EMAIL", message: "Customer has no email address", severity: "warning" });
    }
    return issues;
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerData.name.trim()) {
      toast("Customer name is required", { type: "error", title: "Validation error" });
      return;
    }
    try {
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

  const applyProductToItem = (itemIdx: number, product: ApiProduct) => {
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

  const duplicateItem = (idx: number) => {
    const item = state.items[idx];
    setState((prev) => ({
      ...prev,
      items: [...prev.items, { ...item, description: `${item.description} (copy)` }],
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

  const updateFee = (idx: number, field: keyof LocalFee, value: string) => {
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

  const taxRateOptions = buildTaxRateOptions(taxRates);

  const customerName = state.customerId
    ? customers.find((c) => c.id === state.customerId)?.name ?? customers.find((c) => c.id === state.customerId)?.email ?? "—"
    : "Select a customer";

  return (
    <div className="page-container h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader
        title={isNew ? "New Quotation" : `Quotation #${quote?.quote_number ?? ""}`}
        breadcrumbs={
          !isNew
            ? [
                { label: "Quotations", to: "/app/quotes" },
                { label: `#${quote?.quote_number ?? ""}` },
              ]
            : undefined
        }
        primaryAction={
          <div className="flex items-center gap-3">
            {quote && !isNew && (
              <StatusBadge status={quote.status} config={quoteStatusConfig} />
            )}
            {quote?.finalized_at && !isNew && (
              <span className="text-xs text-tertiary">
                Finalized {formatDate(quote.finalized_at)}
              </span>
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
            {isFinalized ? (
              <>
                {quote?.status === "sent" || quote?.status === "viewed" ? (
                  <Button
                    variant="ghost"
                    icon={<Copy className="h-4 w-4" />}
                    onClick={handleDuplicate}
                    size="sm"
                  >
                    Duplicate
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  icon={<Send className="h-4 w-4" />}
                  onClick={() => setSendDialogOpen(true)}
                  disabled={isSending}
                  loading={isSending}
                  size="sm"
                >
                  Send
                </Button>
                {quote?.status === "accepted" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/app/quotes/${quote.id}/convert`)}
                  >
                    Convert to Invoice
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  icon={<Save className="h-4 w-4" />}
                  onClick={doSave}
                  disabled={saveState === "saving"}
                  loading={saveState === "saving"}
                  size="sm"
                >
                  Save Draft
                </Button>
                <Button
                  variant="primary"
                  icon={<FileText className="h-4 w-4" />}
                  onClick={handleFinalizeAndSend}
                  disabled={isFinalizing}
                  loading={isFinalizing}
                  size="sm"
                >
                  Review &amp; Send
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
            {/* Customer Selector */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Issue Date"
                  type="date"
                  value={state.issueDate}
                  onChange={handleIssueDateChange}
                  disabled={isFinalized}
                />
                <div>
                  <FormField
                    label="Quote Validity"
                    select
                    value={state.paymentTerms === "custom" ? "custom" : state.paymentTerms}
                    onChange={(e) => handleValidityDaysChange(e.target.value)}
                    disabled={isFinalized}
                  >
                    {VALIDITY_DAYS_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </FormField>
                </div>
              </div>
              <FormField
                label="Expiry Date"
                type="date"
                value={state.expiryDate}
                onChange={(e) => setState((prev) => ({ ...prev, expiryDate: e.target.value, paymentTerms: "custom" }))}
                disabled={isFinalized}
                helperText={state.expiryDate && state.issueDate ? `Expires in ${Math.max(0, Math.ceil((new Date(state.expiryDate).getTime() - new Date(state.issueDate).getTime()) / (1000 * 60 * 60 * 24)))} day(s)` : undefined}
              />
            </div>

            {/* Scope of Work */}
            <FormTextareaField
              label="Scope of Work"
              placeholder="Describe the work or services being quoted..."
              value={state.scopeOfWork}
              onChange={(e) => setState((prev) => ({ ...prev, scopeOfWork: e.target.value }))}
              disabled={isFinalized}
            />

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary">Line Items</h3>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={addItem}
                    disabled={isFinalized}
                  >
                    Add Item
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Tag className="h-4 w-4" />}
                    onClick={() => {
                      setProductPickerOpen(true);
                      setProductSearch("");
                    }}
                    disabled={isFinalized || products.length === 0}
                  >
                    Add from Product
                  </Button>
                </div>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={state.items.map((_, i) => `item-${i}`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {state.items.map((item, idx) => (
                      <SortableLineItem
                        key={idx}
                        id={`item-${idx}`}
                        item={item}
                        idx={idx}
                        isFinalized={isFinalized}
                        taxRateOptions={taxRateOptions}
                        calcResult={calcResult}
                        onUpdate={updateItem}
                        onRemove={removeItem}
                        onDuplicate={duplicateItem}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {state.items.length === 0 && !isFinalized && (
                <div className="text-center py-4 text-tertiary">
                  <FileText className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  <p>No line items yet. Click "Add Item" to get started.</p>
                </div>
              )}
            </div>

            {/* Line Items Summary */}
            {calcResult && (
              <div className="border border-border rounded-lg p-3 bg-surface-alt">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-tertiary">Subtotal</span>
                    <Money amount={calcResult.subtotal} currency={state.currency} />
                  </div>
                  {!calcResult.discountTotal.isZero() && (
                    <div className="flex justify-between">
                      <span className="text-tertiary">Discount</span>
                      <Money amount={calcResult.discountTotal.negated()} currency={state.currency} />
                    </div>
                  )}
                  {!calcResult.taxTotal.isZero() && calcResult.taxBreakdown.length > 1 && (
                    <div className="flex justify-between">
                      <span className="text-tertiary">Tax</span>
                      <Money amount={calcResult.taxTotal} currency={state.currency} />
                    </div>
                  )}
                  {!calcResult.taxTotal.isZero() && calcResult.taxBreakdown.length === 1 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-tertiary">
                        {formatTaxRate(calcResult.taxBreakdown[0].rate.toFixed())} {calcResult.taxBreakdown[0].name || ""}
                      </span>
                      <Money amount={calcResult.taxTotal} currency={state.currency} />
                    </div>
                  )}
                  {calcResult.fees.length > 0 && !calcResult.feeTotal.isZero() && (
                    <div className="flex justify-between">
                      <span className="text-tertiary">Fees</span>
                      <Money amount={calcResult.feeTotal} currency={state.currency} />
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg text-primary pt-1 border-t border-border">
                    <span>Total</span>
                    <Money amount={calcResult.total} currency={state.currency} />
                  </div>
                </div>
              </div>
            )}

            {/* Discount & Fees */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Quotation Discount"
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
                      <div className="col-span-3">
                        <FormField
                          label="Tax Rate"
                          select
                          value={fee.taxRate}
                          onChange={(e) => {
                            const opt = taxRateOptions.find((o) => o.value === e.target.value);
                            updateFee(idx, "taxRate", e.target.value);
                            updateFee(idx, "taxName", opt?.name ?? "");
                          }}
                          disabled={isFinalized}
                        >
                          {taxRateOptions.map((opt) => (
                            <option key={opt.taxId || opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </FormField>
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
                className="flex items-center gap-2 text-sm text-primary font-medium"
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
                placeholder="Terms and conditions..."
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
              <FormTextareaField
                label="Internal Notes"
                placeholder="Internal notes (not visible to customer)..."
                value={state.internalNotes}
                onChange={(e) => setState((prev) => ({ ...prev, internalNotes: e.target.value }))}
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
              dueDate={state.expiryDate}
              expiryDate={state.expiryDate}
              customerId={state.customerId}
              customers={customers}
              scopeOfWork={state.scopeOfWork}
              paymentInstructions={state.paymentInstructions}
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
            <h3 className="text-lg font-medium text-primary mb-4">Send Quotation</h3>
            <div className="space-y-3">
              <FormField
                label="To"
                type="email"
                placeholder={quote.customer_email ?? "customer@example.com"}
                value={sendData.to ?? ""}
                onChange={(e) => setSendData((prev) => ({ ...prev, to: e.target.value }))}
              />
              <FormField
                label="Cc"
                type="email"
                placeholder="cc@example.com"
                value={sendData.cc ?? ""}
                onChange={(e) => setSendData((prev) => ({ ...prev, cc: e.target.value }))}
              />
              <FormField
                label="Bcc"
                type="email"
                placeholder="bcc@example.com"
                value={sendData.bcc ?? ""}
                onChange={(e) => setSendData((prev) => ({ ...prev, bcc: e.target.value }))}
              />
              <FormField
                label="Subject"
                placeholder={`Quotation #${quote.quote_number ?? ""}`}
                value={sendData.subject ?? ""}
                onChange={(e) => setSendData((prev) => ({ ...prev, subject: e.target.value }))}
              />
              <FormTextareaField
                label="Message"
                placeholder="Hi, please find your quotation attached."
                value={sendData.message ?? ""}
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

      {/* Validation Dialog */}
      <Dialog
        open={validationDialogOpen}
        onClose={() => setValidationDialogOpen(false)}
        title="Review &amp; Send"
        description="Please review the issues below before sending."
        size="md"
      >
        <ValidationIssuesList
          issues={validateQuote()}
          onProceed={handleFinalizeAndSend}
          onCancel={() => setValidationDialogOpen(false)}
          isFinalizing={isFinalizing}
        />
      </Dialog>

      {/* Product Picker Dialog */}
      <Dialog
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        title="Select Product"
        description="Search and select a product to add as a line item."
        size="md"
      >
        <ProductPicker
          products={products}
          search={productSearch}
          onSearchChange={setProductSearch}
          onAddNewProduct={() => setNewProductDialogOpen(true)}
          onSelect={(p) => {
            const idx = state.items.findIndex((item) => !item.description.trim());
            const targetIdx = idx >= 0 ? idx : state.items.length - 1;
            applyProductToItem(targetIdx, p);
            setProductPickerOpen(false);
          }}
        />
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog
        open={newCustomerDialogOpen}
        onClose={() => setNewCustomerDialogOpen(false)}
        title="Add New Customer"
        description="Create a new customer while creating this quotation."
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

      {/* New Product Dialog */}
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

interface SortableLineItemProps {
  id: string;
  item: LocalItem;
  idx: number;
  isFinalized: boolean;
  taxRateOptions: TaxRateOption[];
  calcResult: ReturnType<typeof CALC_ENGINE.calculate> | null;
  onUpdate: (idx: number, field: keyof LocalItem, value: unknown) => void;
  onRemove: (idx: number) => void;
  onDuplicate: (idx: number) => void;
}

function SortableLineItem({ id, item, idx, isFinalized, taxRateOptions, calcResult, onUpdate, onRemove, onDuplicate }: SortableLineItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const lineTotal = useMemo(() => {
    if (!calcResult) return null;
    return calcResult.lineItems[idx]?.lineTotal;
  }, [calcResult, idx]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded-md bg-surface hover:bg-surface-alt/50"
    >
      <div className="col-span-1 flex items-center justify-center cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-tertiary" />
      </div>

      <div className="col-span-3">
        <FormField
          label="Description"
          value={item.description}
          onChange={(e) => onUpdate(idx, "description", e.target.value)}
          disabled={isFinalized}
          helperText={item.description ? "" : "Required"}
        />
      </div>

      <div className="col-span-1">
        <FormField
          label="Qty"
          value={item.quantity}
          onChange={(e) => onUpdate(idx, "quantity", e.target.value)}
          disabled={isFinalized}
        />
      </div>

      <div className="col-span-1">
        <FormField
          label="Unit"
          value={item.unit}
          onChange={(e) => onUpdate(idx, "unit", e.target.value)}
          disabled={isFinalized}
        />
      </div>

      <div className="col-span-1">
        <FormField
          label="Unit Price"
          value={item.unitPrice}
          onChange={(e) => onUpdate(idx, "unitPrice", e.target.value)}
          disabled={isFinalized}
        />
      </div>

      <div className="col-span-1">
        <FormField
          label="Disc"
          value={item.discount}
          onChange={(e) => onUpdate(idx, "discount", e.target.value)}
          disabled={isFinalized}
          helperText={item.discount && Number(item.discount) > 0 ? item.discountType === "percentage" ? "%" : "$" : undefined}
        />
      </div>

      <div className="col-span-1">
        <FormField
          label="Disc Type"
          select
          value={item.discountType}
          onChange={(e) => onUpdate(idx, "discountType", e.target.value as "fixed" | "percentage")}
          disabled={isFinalized}
        >
          <option value="percentage">%</option>
          <option value="fixed">$</option>
        </FormField>
      </div>

      <div className="col-span-1">
        <FormField
          label="Tax Rate"
          select
          value={item.taxRate}
          onChange={(e) => {
            const opt = taxRateOptions.find((o) => o.value === e.target.value);
            onUpdate(idx, "taxRate", e.target.value);
            onUpdate(idx, "taxName", opt?.name ?? "");
          }}
          disabled={isFinalized}
        >
          {taxRateOptions.map((opt) => (
            <option key={opt.taxId || opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </FormField>
      </div>

      <div className="col-span-1 flex items-center justify-center mt-5">
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={item.isTaxInclusive}
            onChange={(e) => onUpdate(idx, "isTaxInclusive", e.target.checked)}
            disabled={isFinalized}
            className="h-3 w-3"
          />
          <span className="text-tertiary">Incl.</span>
        </label>
      </div>

      <div className="col-span-1 flex items-end justify-end mb-0.5">
        <div className="text-sm font-medium text-primary min-w-[80px] text-right">
          {lineTotal !== null ? (
            calcResult ? <Money amount={lineTotal} currency={calcResult.currency} /> : <span>—</span>
          ) : (
            <span className="text-tertiary">—</span>
          )}
        </div>
      </div>

      {!isFinalized && (
        <div className="col-span-1 flex items-center gap-1 mt-5">
          <button
            type="button"
            onClick={() => onDuplicate(idx)}
            className="p-1 text-tertiary hover:text-primary hover:bg-surface-alt rounded"
            title="Duplicate item"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="p-1 text-error hover:bg-error/10 rounded"
            title="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

interface ValidationIssuesListProps {
  issues: ValidationIssue[];
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
                    <span>{issue.message}</span>
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
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
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
          {hasErrors ? "Fix errors to proceed" : "Finalize &amp; Send"}
        </Button>
      </div>
    </div>
  );
}

interface ProductPickerProps {
  products: ApiProduct[];
  search: string;
  onSearchChange: (val: string) => void;
  onAddNewProduct: () => void;
  onSelect: (product: ApiProduct) => void;
}

function ProductPicker({ products, search, onSearchChange, onAddNewProduct, onSelect }: ProductPickerProps) {
  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (p.sku?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-3 max-h-80">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
          <input
            type="text"
            placeholder="Search products..."
            className="pl-10 pr-3 py-2 w-full text-sm border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
          />
        </div>
        <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={onAddNewProduct}>
          New
        </Button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-tertiary text-sm">No products found.</p>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="w-full text-left p-3 border border-border rounded-md hover:bg-surface-alt transition-colors"
            >
              <div className="font-medium text-primary">{p.name}</div>
              {p.description && <div className="text-sm text-tertiary">{p.description}</div>}
              <div className="flex gap-4 text-xs text-tertiary mt-1">
                <span>Price: <Money amount={p.defaultUnitPrice} currency={p.defaultCurrency} /></span>
                {p.sku && <span>SKU: {p.sku}</span>}
                <span>Unit: {p.unit}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
