import { useState, useEffect, useRef, useMemo } from "react";
import {
  getQuoteById,
  createQuote,
  updateQuote,
  getCustomers,
  getProducts,
  getBusiness,
} from "../../api/client";
import { calculationEngine, type LineItemInput, type FeeInput, type InvoiceCalculationInput } from "../../utils/calculation";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "../../utils/currency";
import { analytics } from "../../lib/analytics";
import type { ApiCustomer, ApiProduct, ApiBusiness } from "../../types/api";
import { useInvoiceValidation, type ValidationInput } from "../../hooks/useInvoiceValidation";
import type {
  QuoteBuilderData,
  BuilderLineItem,
  BuilderFee,
  SaveState,
} from "./types";
import { DEFAULT_LINE_ITEM, DEFAULT_FEE, DEFAULT_DISCOUNT, generateRowId } from "./types";

const AUTOSAVE_DELAY = 500;
const todayISO = () => new Date().toISOString().split("T")[0];
const addDaysISO = (d: string, days: number) => {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

export interface UseQuoteBuilderOptions {
  quoteId?: string | null;
}

export function useQuoteBuilder({ quoteId }: UseQuoteBuilderOptions) {
  const isNew = !quoteId;

  const [data, setData] = useState<QuoteBuilderData>({
    customerId: null,
    customer: null,
    currency: "USD",
    issueDate: todayISO(),
    dueDate: addDaysISO(todayISO(), 30),
    expiryDate: addDaysISO(todayISO(), 60),
    notes: "",
    terms: "",
    paymentInstructions: "",
    discount: { ...DEFAULT_DISCOUNT },
    items: [{ ...DEFAULT_LINE_ITEM, id: generateRowId() }],
    fees: [],
    savedQuoteId: null,
  });

  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saveState, setSaveState] = useState<SaveState>("unsaved");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<QuoteBuilderData>(data);

  latestDataRef.current = data;

  useEffect(() => {
    loadContext();
    if (!isNew) {
      loadQuote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function loadContext() {
    try {
      const [bizRes, custRes, prodRes] = await Promise.allSettled([
        getBusiness(),
        getCustomers({ limit: 100, includeArchived: false }).catch(() => ({ data: [] })),
        getProducts({ limit: 200 }).catch(() => ({ products: [] })),
      ]);
      if (bizRes.status === "fulfilled" && bizRes.value) {
        const b = bizRes.value as ApiBusiness & {
          default_notes?: string | null;
          default_terms?: string | null;
          default_payment_instructions?: string | null;
        };
        setBusiness(b);
        setData(prev => ({
          ...prev,
          currency: prev.currency === "USD" ? (b.default_currency || "USD") : prev.currency,
          notes: prev.notes || b.default_notes || "",
          terms: prev.terms || b.default_terms || "Net 30",
          paymentInstructions: prev.paymentInstructions || b.default_payment_instructions || "",
        }));
      }
      if (custRes.status === "fulfilled") {
        const res = custRes.value;
        setCustomers(res?.data ?? []);
      }
      if (prodRes.status === "fulfilled") {
        setProducts(prodRes.value?.products ?? []);
      }
    } catch {
      // context load failure — builder still usable with defaults
    }
  }

  async function loadQuote() {
    if (!quoteId) return;
    setLoading(true);
    setError(null);
    try {
      const { quote } = await getQuoteById(quoteId);
      const customer = customers.find(c => c.id === quote.customer_id) ?? null;
      setData({
        customerId: quote.customer_id ?? null,
        customer,
        currency: quote.currency,
        issueDate: quote.issue_date ? quote.issue_date.split("T")[0] : todayISO(),
        dueDate: quote.due_date ? quote.due_date.split("T")[0] : addDaysISO(todayISO(), 30),
        expiryDate: quote.expiry_date ? quote.expiry_date.split("T")[0] : addDaysISO(todayISO(), 60),
        notes: quote.notes ?? "",
        terms: quote.terms ?? "",
        paymentInstructions: quote.payment_instructions ?? "",
        discount: { type: "none", value: "0" },
        items: (quote.items ?? []).map(item => ({
          id: item.id,
          productId: item.product_id ?? null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || "each",
          unitPrice: item.unit_price,
          discount: item.discount || "0",
          discountType: item.discount_type ?? "fixed",
          taxRate: item.tax_rate || "0",
          isTaxInclusive: item.is_tax_inclusive ?? false,
        })),
        fees: (quote.fees ?? []).map(fee => ({
          id: fee.id,
          description: fee.description,
          amount: fee.amount,
          taxRate: fee.tax_rate || "0",
        })),
        savedQuoteId: quote.id,
      });
      setSaveState("saved");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load quote");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof QuoteBuilderData, value: any) {
    setData(prev => ({ ...prev, [field]: value }));
    scheduleSave();
  }

  function updateItem(id: string, patch: Partial<BuilderLineItem>) {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, ...patch } : item),
    }));
    scheduleSave();
  }

  function addItem() {
    setData(prev => ({
      ...prev,
      items: [...prev.items, { ...DEFAULT_LINE_ITEM, id: generateRowId() }],
    }));
    scheduleSave();
  }

  function removeItem(id: string) {
    setData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }));
    scheduleSave();
  }

  function setItems(items: BuilderLineItem[]) {
    setData(prev => ({ ...prev, items }));
    scheduleSave();
  }

  function addFee() {
    setData(prev => ({
      ...prev,
      fees: [...prev.fees, { ...DEFAULT_FEE, id: generateRowId() }],
    }));
    scheduleSave();
  }

  function removeFee(id: string) {
    setData(prev => ({
      ...prev,
      fees: prev.fees.filter(f => f.id !== id),
    }));
    scheduleSave();
  }

  function updateFee(id: string, patch: Partial<BuilderFee>) {
    setData(prev => ({
      ...prev,
      fees: prev.fees.map(f => f.id === id ? { ...f, ...patch } : f),
    }));
    scheduleSave();
  }

  function setFees(fees: BuilderFee[]) {
    setData(prev => ({ ...prev, fees }));
    scheduleSave();
  }

  function scheduleSave() {
    setSaveState("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), AUTOSAVE_DELAY);
  }

  async function doSave() {
    const currentData = latestDataRef.current;
    setSaveState("saving");
    try {
      const payload = {
        customerId: currentData.customerId ?? undefined,
        currency: currentData.currency,
        issueDate: currentData.issueDate || undefined,
        dueDate: currentData.dueDate || undefined,
        expiryDate: currentData.expiryDate ?? undefined,
        notes: currentData.notes || undefined,
        terms: currentData.terms || undefined,
        paymentInstructions: currentData.paymentInstructions || undefined,
        items: currentData.items.map(item => ({
          id: item.id,
          productId: item.productId ?? null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discount: Number(item.discount) || 0,
          discountType: item.discountType,
          taxRate: item.taxRate || "0",
          isTaxInclusive: item.isTaxInclusive ?? false,
          sortOrder: currentData.items.indexOf(item),
        })),
        fees: currentData.fees.map(fee => ({
          id: fee.id,
          description: fee.description,
          amount: fee.amount,
          taxRate: fee.taxRate || "0",
          sortOrder: currentData.fees.indexOf(fee),
        })),
      };

      if (!currentData.savedQuoteId) {
        const res = await createQuote(payload);
        const newId: string = res?.quoteId ?? res?.id;
        if (newId) {
          window.history.replaceState(null, "", `/app/quotes/${newId}`);
          setData(prev => ({ ...prev, savedQuoteId: newId }));
        }
      } else {
        await updateQuote(currentData.savedQuoteId, payload);
      }

      setSaveState("saved");
      setActionMessage("Draft saved");
      analytics.trackEvent("invoice_saved", { quoteId: currentData.savedQuoteId });
    } catch (err: any) {
      setSaveState("error");
      setActionMessage(err.response?.data?.error || "Failed to save draft");
    }
  }

  const calcResult = useMemo(() => {
    try {
      const lineItems: LineItemInput[] = data.items.map(it => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit || "each",
        unitPrice: it.unitPrice,
        discount: it.discount && Number(it.discount) > 0
          ? { type: it.discountType ?? "fixed", value: it.discount }
          : undefined,
        taxRate: it.taxRate || "0",
        isTaxInclusive: it.isTaxInclusive ?? false,
      }));

      const feeInputs: FeeInput[] | undefined = data.fees.length > 0
        ? data.fees.map(f => ({
            description: f.description,
            amount: f.amount,
            taxRate: f.taxRate || "0",
          }))
        : undefined;

      const invoiceDiscount =
        data.discount.type !== "none" && data.discount.value && Number(data.discount.value) > 0
          ? { type: data.discount.type, value: data.discount.value } as const
          : undefined;

      const input: InvoiceCalculationInput = {
        currency: data.currency as CurrencyCode,
        lineItems,
        fees: feeInputs,
        invoiceDiscount,
        amountPaid: "0",
      };

      return calculationEngine.calculate(input);
    } catch {
      return null;
    }
  }, [data.items, data.fees, data.discount, data.currency]);

  const validationInput = useMemo<ValidationInput | null>(() => {
    if (!data.customerId && !data.customer) return null;
    return {
      customerId: data.customerId ?? undefined,
      customer: data.customer ?? undefined,
      currency: data.currency,
      issueDate: data.issueDate || undefined,
      dueDate: data.dueDate || undefined,
      items: data.items.map(it => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discount: it.discount && Number(it.discount) > 0 ? it.discount : undefined,
        discountType: it.discountType,
        taxRate: it.taxRate || "0",
        isTaxInclusive: it.isTaxInclusive ?? false,
      })),
      fees: data.fees.length > 0 ? data.fees.map(f => ({
        description: f.description,
        amount: f.amount,
        taxRate: f.taxRate || "0",
      })) : undefined,
      notes: data.notes || undefined,
      terms: data.terms || undefined,
      paymentInstructions: data.paymentInstructions || undefined,
    };
  }, [data]);

  const validation = useInvoiceValidation(validationInput, calcResult ?? undefined);

  const totals = useMemo(() => {
    if (!calcResult) return null;
    return {
      subtotal: calcResult.subtotal,
      discountTotal: calcResult.discountTotal,
      taxTotal: calcResult.taxTotal,
      feeTotal: calcResult.feeTotal,
      total: calcResult.total,
      amountDue: calcResult.amountDue,
    };
  }, [calcResult]);

  return {
    data,
    isNew,
    business,
    customers,
    products,
    loading,
    saveState,
    validation,
    calcResult,
    totals,
    error,
    actionMessage,

    updateField,
    updateItem,
    addItem,
    removeItem,
    setItems,
    addFee,
    removeFee,
    updateFee,
    setFees,
    doSave,
    setActionMessage,
    SUPPORTED_CURRENCIES,
  };
}
