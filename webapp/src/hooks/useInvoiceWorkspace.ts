import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getInvoice,
  createInvoice,
  updateInvoice,
  finalizeInvoice,
  sendInvoice,
  duplicateInvoice,
  getCustomers,
  getBusiness,
  getTaxRates,
  getProducts,
  createCustomer,
  createProduct,
  type CreateInvoiceInput,
  type FinalizeInvoiceResult,
  type SendInvoiceResult,
} from "@/api/client";
import {
  CalculationEngine,
  type InvoiceCalculationInput,
  type LineItemInput,
  type FeeInput,
  type DiscountDefinition,
} from "@/utils/calculation";
import type { CurrencyCode } from "@/types/currency";
import type {
  ApiInvoice,
  ApiInvoiceItem,
  ApiInvoiceFee,
  ApiBusiness,
  ApiCustomer,
  ApiTaxRate,
  ApiProduct,
} from "@/types/api";
import { useToast } from "@/components/ui/ToastProvider";

export interface LocalItem {
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
  taxRuleId?: string | null;
  discountRuleId?: string | null;
}

export interface LocalFee {
  description: string;
  amount: string;
  taxRate: string;
  taxName: string;
}

export interface LocalState {
  customerId: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  poNumber: string;
  terms: string;
  notes: string;
  paymentInstructions: string;
  items: LocalItem[];
  fees: LocalFee[];
  invoiceDiscount: string;
  invoiceDiscountType: "fixed" | "percentage";
  discountRuleId?: string | null;
  shippingDescription: string;
  shippingAmount: string;
  shippingTaxRate: string;
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  field?: string;
}

export interface TaxRateOption {
  value: string;
  label: string;
  taxId: string;
  rate: string;
  name: string;
}

export interface UseInvoiceWorkspaceResult {
  state: LocalState;
  setState: React.Dispatch<React.SetStateAction<LocalState>>;
  invoice: ApiInvoice | null;
  setInvoice: (inv: ApiInvoice | null) => void;
  customers: ApiCustomer[];
  business: ApiBusiness | null;
  taxRates: ApiTaxRate[];
  products: ApiProduct[];
  saveState: SaveState;
  isFinalizing: boolean;
  isSending: boolean;
  calcResult: ReturnType<typeof CalculationEngine.prototype.calculate> | null;
  calcInput: InvoiceCalculationInput;
  hasUnsavedChanges: boolean;
  isFinalized: boolean;
  taxRateOptions: TaxRateOption[];
  buildPayload: () => CreateInvoiceInput;
  doSave: () => Promise<void>;
  handleFinalize: () => Promise<void>;
  handleFinalizeAndSend: () => Promise<void>;
  handleSend: () => Promise<void>;
  handleDuplicate: () => Promise<void>;
  handleSendReminder: () => Promise<void>;
  handlePaymentTermsChange: (terms: string) => void;
  handleIssueDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addItem: () => void;
  removeItem: (idx: number) => void;
  updateItem: (idx: number, field: keyof LocalItem, value: unknown) => void;
  duplicateItem: (idx: number) => void;
  addFee: () => void;
  removeFee: (idx: number) => void;
  updateFee: (idx: number, field: keyof LocalFee, value: string) => void;
  handleCreateCustomer: () => Promise<void>;
  handleCreateProduct: () => Promise<void>;
  applyProductToItem: (itemIdx: number, product: ApiProduct) => void;
  validateInvoice: () => ValidationIssue[];
}

export function initialItem(): LocalItem {
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
    taxRuleId: null,
    discountRuleId: null,
  };
}

export function buildTaxRateOptions(taxRates: ApiTaxRate[]): TaxRateOption[] {
  const opts: TaxRateOption[] = [
    { value: "0", label: "0.00% — Exempt", taxId: "", rate: "0", name: "" },
  ];
  for (const t of taxRates.filter((t) => t.enabled)) {
    const label = (Number(t.rate) * 100).toFixed(2) + `%${t.name ? ` (${t.name})` : ""}`;
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

export function useInvoiceWorkspace(
  id: string | undefined,
  navigate: ReturnType<typeof useNavigate>,
): UseInvoiceWorkspaceResult {
  const isNew = !id || id === "new";
  const { toast } = useToast();

  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [taxRates, setTaxRates] = useState<ApiTaxRate[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [state, setState] = useState<LocalState>({
    customerId: "",
    currency: "USD",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    paymentTerms: "30",
    poNumber: "",
    terms: "",
    notes: "",
    paymentInstructions: "",
    items: [initialItem()],
    fees: [],
    invoiceDiscount: "0",
    invoiceDiscountType: "fixed",
    discountRuleId: null,
    shippingDescription: "",
    shippingAmount: "0",
    shippingTaxRate: "0",
  });

  const autosaveTimerRef = useRef<number | null>(null);
  const saveStateTimerRef = useRef<number | null>(null);

  const isFinalized = invoice?.is_finalized ?? false;

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
    getProducts({ limit: 100 })
      .then((d) => setProducts(d.products ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNew && id) {
      getInvoice(id).then((res) => {
        const inv: ApiInvoice = res.invoice;
        setInvoice(inv);
        setState((prev) => ({
          ...prev,
          customerId: inv.customer_id ?? "",
          currency: inv.currency,
          issueDate: inv.issue_date ? inv.issue_date.split("T")[0] : new Date().toISOString().split("T")[0],
          dueDate: inv.due_date ? inv.due_date.split("T")[0] : new Date().toISOString().split("T")[0],
          paymentTerms: "custom",
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
            discount: item.discount ?? "0",
            discountType: item.discount_type ?? "percentage",
            productId: item.product_id ?? null,
            taxRuleId: (item as unknown as Record<string, unknown>).tax_rule_id as string | null ?? null,
            discountRuleId: null,
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
        }));
      }).catch((err: Error) => {
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

  const calcEngine = useMemo(() => new CalculationEngine(), []);
  const calcResult = useMemo(() => {
    try {
      return calcEngine.calculate(calcInput);
    } catch {
      return null;
    }
  }, [calcInput, calcEngine]);

  const hasUnsavedChanges = useMemo(() => {
    if (isNew) return true;
    if (!invoice) return false;
    if (state.customerId !== (invoice.customer_id ?? "")) return true;
    if (state.currency !== invoice.currency) return true;
    if (state.poNumber !== (invoice.po_number ?? "")) return true;
    if (state.terms !== (invoice.terms ?? "")) return true;
    if (state.notes !== (invoice.notes ?? "")) return true;
    if (state.paymentInstructions !== (invoice.payment_instructions ?? "")) return true;
    if (state.invoiceDiscount !== (invoice.invoice_discount ?? "0")) return true;
    if (state.invoiceDiscountType !== (invoice.invoice_discount_type ?? "fixed")) return true;
    return false;
  }, [state, invoice, isNew]);

  const buildPayload = useCallback((): CreateInvoiceInput => ({
    customerId: state.customerId || undefined,
    currency: state.currency,
    issueDate: state.issueDate || undefined,
    dueDate: state.dueDate || undefined,
    poNumber: state.poNumber || undefined,
    terms: state.terms || undefined,
    notes: state.notes || undefined,
    paymentInstructions: state.paymentInstructions || undefined,
    items: state.items.map((item) => ({
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
    })),
    fees: state.fees.map((fee) => ({
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
  }), [state]);

  const doSave = useCallback(async () => {
    const payload = buildPayload();
    if (!payload.items || payload.items.length === 0) {
      toast("Add at least one line item before saving.", { type: "warning", title: "Empty invoice" });
      return;
    }
    setSaveState("saving");
    try {
      if (isNew) {
        const res = await createInvoice(payload);
        toast(`Created invoice #${res.invoice.invoice_number ?? ""}.`, { type: "success", title: "Invoice created" });
        navigate(`/app/invoices/${res.invoice.id}`);
        setInvoice(res.invoice);
      } else {
        await updateInvoice(id!, payload);
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
  }, [id, isNew, navigate, toast, buildPayload]);

  useEffect(() => {
    if (isFinalized) return;
    if (!hasUnsavedChanges) return;
    if (isNew && !invoice) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = window.setTimeout(() => {
      doSave();
    }, 500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [state, isFinalized, hasUnsavedChanges, isNew, invoice, doSave]);

  const handleFinalize = useCallback(async () => {
    if (isNew && !invoice) {
      await doSave();
    }
    if (!invoice) return;
    setIsFinalizing(true);
    try {
      const result: FinalizeInvoiceResult = await finalizeInvoice(invoice.id);
      toast(`Invoice #${result.invoiceNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
      setInvoice(result.invoice);
      setSaveState("idle");
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [invoice, isNew, doSave, toast]);

  const handleFinalizeAndSend = useCallback(async () => {
    if (isNew && !invoice) {
      await doSave();
    }
    if (!invoice) return;

    const result: FinalizeInvoiceResult = await finalizeInvoice(invoice.id);
    toast(`Invoice #${result.invoiceNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
    setInvoice(result.invoice);
    setSaveState("idle");
  }, [invoice, isNew, doSave, toast]);

  const handleSend = useCallback(async () => {
    if (isNew && !invoice) {
      await doSave();
    }
  }, [invoice, isNew, doSave]);

  const handleDuplicate = useCallback(async () => {
    if (!invoice) return;
    try {
      const result = await duplicateInvoice(invoice.id);
      toast("Invoice duplicated.", { type: "success", title: "Duplicated" });
      navigate(`/app/invoices/${result.invoice.id}`);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Duplicate failed" });
    }
  }, [invoice, navigate, toast]);

  const handleSendReminder = useCallback(async () => {
    if (!invoice) return;
    try {
      await sendInvoice(invoice.id, {
        to: invoice.customer_email ?? "",
        subject: `Payment Reminder: Invoice ${invoice.invoice_number ?? ""}`,
      });
      toast("Reminder sent.", { type: "success", title: "Sent" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Send failed" });
    }
  }, [invoice, toast]);

  const handlePaymentTermsChange = useCallback((terms: string) => {
    setState((prev) => {
      if (terms === "custom") return { ...prev, paymentTerms: "custom" };
      const days = parseInt(terms, 10);
      const issueDate = new Date(prev.issueDate);
      const dueDate = new Date(issueDate);
      dueDate.setDate(issueDate.getDate() + days);
      return {
        ...prev,
        paymentTerms: terms,
        dueDate: dueDate.toISOString().split("T")[0],
      };
    });
  }, []);

  const handleIssueDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newIssueDate = e.target.value;
    setState((prev) => {
      let newDueDate = prev.dueDate;
      if (prev.paymentTerms !== "custom") {
        const days = parseInt(prev.paymentTerms, 10);
        const issue = new Date(newIssueDate);
        const due = new Date(issue);
        due.setDate(issue.getDate() + days);
        newDueDate = due.toISOString().split("T")[0];
      }
      return { ...prev, issueDate: newIssueDate, dueDate: newDueDate };
    });
  }, []);

  const addItem = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, initialItem()],
    }));
  }, []);

  const removeItem = useCallback((idx: number) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  }, []);

  const updateItem = useCallback((idx: number, field: keyof LocalItem, value: unknown) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  }, []);

  const duplicateItem = useCallback((idx: number) => {
    const item = state.items[idx];
    setState((prev) => ({
      ...prev,
      items: [...prev.items, { ...item, description: `${item.description} (copy)` }],
    }));
  }, [state.items]);

  const addFee = useCallback(() => {
    setState((prev) => ({
      ...prev,
      fees: [...prev.fees, { description: "", amount: "0.00", taxRate: "0", taxName: "" }],
    }));
  }, []);

  const removeFee = useCallback((idx: number) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.filter((_, i) => i !== idx),
    }));
  }, []);

  const updateFee = useCallback((idx: number, field: keyof LocalFee, value: string) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.map((fee, i) => (i === idx ? { ...fee, [field]: value } : fee)),
    }));
  }, []);

  const handleCreateCustomer = useCallback(async () => {
    const newCustomerData = { name: "", email: "", phone: "" };
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
      toast("Customer created.", { type: "success", title: "Customer created" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Failed to create customer" });
    }
  }, [toast]);

  const handleCreateProduct = useCallback(async () => {
    const newProductName = "";
    const newProductPrice = "";
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
      toast("Product created.", { type: "success", title: "Product created" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Failed to create product" });
    }
  }, [state.currency, business?.defaultCurrency, toast]);

  const applyProductToItem = useCallback((itemIdx: number, product: ApiProduct) => {
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
  }, []);

  const taxRateOptions = useMemo(() => buildTaxRateOptions(taxRates), [taxRates]);

  const validateInvoice = useCallback((): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    if (!invoice?.customer_id) {
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
      const qty = new Decimal(item.quantity || "0");
      if (qty.lte(0)) {
        issues.push({ code: "INVALID_QUANTITY", message: `Line item ${itemIdx + 1} has an invalid quantity`, severity: "error" });
      }
      const price = new Decimal(item.unitPrice || "0");
      if (price.isNegative()) {
        issues.push({ code: "NEGATIVE_UNIT_PRICE", message: `Line item ${itemIdx + 1} has a negative unit price`, severity: "error" });
      }
    }
    if (!invoice?.payment_instructions) {
      issues.push({ code: "MISSING_PAYMENT_INSTRUCTIONS", message: "No payment instructions provided", severity: "warning" });
    }
    if (!invoice?.notes && !state.notes) {
      issues.push({ code: "MISSING_NOTES", message: "No notes provided for the customer", severity: "warning" });
    }
    return issues;
  }, [invoice, state]);

  return {
    state,
    setState,
    invoice,
    setInvoice,
    customers,
    business,
    taxRates,
    products,
    saveState,
    isFinalizing,
    isSending,
    calcResult,
    calcInput,
    hasUnsavedChanges,
    isFinalized,
    taxRateOptions,
    buildPayload,
    doSave,
    handleFinalize,
    handleFinalizeAndSend,
    handleSend,
    handleDuplicate,
    handleSendReminder,
    handlePaymentTermsChange,
    handleIssueDateChange,
    addItem,
    removeItem,
    updateItem,
    duplicateItem,
    addFee,
    removeFee,
    updateFee,
    handleCreateCustomer,
    handleCreateProduct,
    applyProductToItem,
    validateInvoice,
  };
}
