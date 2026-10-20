import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CalculationEngine } from "@/utils/calculation";
import type { InvoiceCalculationInput, LineItemInput, FeeInput, DiscountDefinition } from "@/types/calculation";
import { useToast, PageHeader } from "@/components/ui";
import {
  InvoiceMakerForm,
  InvoiceMakerPreview,
  InvoiceMakerActions,
} from "@/components/invoice-maker";
import {
  getCustomers,
  getBusiness,
  getTaxRates,
  getProducts,
  createInvoice,
  duplicateInvoice,
  getInvoicePdf,
  getSuggestedActions,
  getProgressiveAutofill,
  type SpeedQuickActions,
  type SpeedAutofillResult,
} from "@/api/client";
import type { ApiBusiness, ApiCustomer, ApiProduct, ApiTaxRate, ApiInvoice } from "@/types/api";
import {
  type DocumentState,
  type DocumentLineItem,
  type DocumentFee,
  type TaxRateOption,
  initialLineItem,
} from "@/components/document";
import { Decimal } from "decimal.js";
import { formatTaxRate } from "@/utils/format";
import { useMetaTags } from "@/hooks/useMetaTags";

const AUTO_SAVE_DELAY = 1500;

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

function getInvoiceNumber(doc: ApiInvoice): string {
  return doc.invoice_number ?? doc.id?.slice(0, 8) ?? "—";
}

export default function InvoiceMaker() {
  useMetaTags({
    title: "Invoice Maker — DocForge",
    description: "Create a professional invoice with live preview. Enter your details, add items, and download as PDF.",
    noIndex: true,
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [taxRates, setTaxRates] = useState<ApiTaxRate[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);

  const [savedInvoice, setSavedInvoice] = useState<ApiInvoice | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [quickActions, setQuickActions] = useState<SpeedQuickActions | null>(null);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultIssueDate = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultDueDate = useMemo(
    () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    [],
  );

  const [state, setState] = useState<DocumentState>({
    customerId: "",
    currency: "USD",
    issueDate: defaultIssueDate,
    invoiceNumber: "",
    notes: "",
    terms: "",
    paymentInstructions: "",
    items: [initialLineItem()],
    fees: [],
    invoiceDiscount: "0",
    invoiceDiscountType: "fixed",
    dueDate: defaultDueDate,
  });

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
    getSuggestedActions()
      .then((d) => setQuickActions(d))
      .catch(() => {});

    getProgressiveAutofill(null)
      .then((af: SpeedAutofillResult) => {
        setState((prev) => ({
          ...prev,
          currency: af.currency ?? prev.currency,
          issueDate: af.issueDate ?? prev.issueDate,
          dueDate: af.dueDate ?? prev.dueDate,
          terms: af.terms ?? prev.terms,
          notes: af.notes ?? prev.notes,
          paymentInstructions: af.paymentInstructions ?? prev.paymentInstructions,
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (customers.length > 0 && !state.customerId && !state.customerName) {
      return;
    }
    if (state.customerId && customers.length > 0) {
      getProgressiveAutofill(state.customerId)
        .then((af: SpeedAutofillResult) => {
          setState((prev) => ({
            ...prev,
            currency: af.currency ?? prev.currency,
            terms: af.terms ?? prev.terms,
            notes: af.notes ?? prev.notes,
            paymentInstructions: af.paymentInstructions ?? prev.paymentInstructions,
            dueDate: af.dueDate ?? prev.dueDate,
          }));
        })
        .catch(() => {});
    }
  }, [state.customerId, customers.length, state.customerName]);

  const calcInput: InvoiceCalculationInput = useMemo(() => {
    const currencyCode = state.currency;
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

    const discValue = state.invoiceDiscount ?? "0";
    const invoiceDiscountDef: DiscountDefinition | undefined =
      Number(discValue) > 0
        ? ({ type: state.invoiceDiscountType ?? "fixed", value: new Decimal(discValue) } as DiscountDefinition)
        : undefined;

    return {
      currency: currencyCode as InvoiceCalculationInput["currency"],
      lineItems,
      fees,
      invoiceDiscount: invoiceDiscountDef,
    };
  }, [state.items, state.fees, state.invoiceDiscount, state.invoiceDiscountType, state.currency]);

  const calcEngine = useMemo(() => new CalculationEngine(), []);
  const calcResult = useMemo(() => {
    try {
      if (calcInput.lineItems.length === 0) return null;
      return calcEngine.calculate(calcInput);
    } catch {
      return null;
    }
  }, [calcInput, calcEngine]);

  const taxRateOptions = useMemo(() => buildTaxRateOptions(taxRates), [taxRates]);
  const hasSaved = !!savedInvoice;
  const isSaving = saveState === "saving";

  const buildPayload = useCallback(() => {
    const items = state.items
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
      }));

    const fees = state.fees
      .filter((f) => f.description.trim())
      .map((fee) => ({
        description: fee.description,
        amount: fee.amount,
        taxRate: fee.taxRate,
        taxName: fee.taxName || undefined,
      }));

    return {
      customerId: state.customerId || undefined,
      currency: state.currency,
      issueDate: state.issueDate || undefined,
      dueDate: state.dueDate || undefined,
      poNumber: state.poNumber || undefined,
      terms: state.terms || undefined,
      notes: state.notes || undefined,
      paymentInstructions: state.paymentInstructions || undefined,
      items,
      fees,
      invoiceDiscount: state.invoiceDiscount,
      invoiceDiscountType: state.invoiceDiscountType,
      shippingDescription: state.shippingDescription || undefined,
      shippingAmount: state.shippingAmount,
      shippingTaxRate: state.shippingTaxRate,
    };
  }, [state.items, state.fees, state.invoiceDiscount, state.invoiceDiscountType, state.currency, state.customerId, state.issueDate, state.dueDate, state.poNumber, state.terms, state.notes, state.paymentInstructions, state.shippingDescription, state.shippingAmount, state.shippingTaxRate]);

  const doSaveDraft = useCallback(async () => {
    const nonEmptyItems = state.items.filter((item) => item.description.trim());
    if (nonEmptyItems.length === 0) {
      toast("Add at least one line item before saving.", {
        type: "warning",
        title: "Empty invoice",
      });
      return;
    }

    setSaveState("saving");
    try {
      const res = await createInvoice(buildPayload());
      const doc: ApiInvoice = res.invoice;
      setSavedInvoice(doc);
      setState((prev) => ({
        ...prev,
        invoiceNumber: doc.invoice_number ?? prev.invoiceNumber,
      }));
      setSaveState("saved");
      if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
      saveStateTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
      toast("Draft saved.", { type: "success", title: `${getInvoiceNumber(doc)} saved` });
    } catch (err: unknown) {
      setSaveState("error");
      toast(err instanceof Error ? err.message : "Save failed", { type: "error", title: "Save failed" });
    } finally {
      if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
    }
  }, [state, toast, buildPayload]);

  const doDownloadPdf = useCallback(async () => {
    if (!savedInvoice) return;

    setIsGeneratingPdf(true);
    try {
      const blob = await getInvoicePdf(savedInvoice.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${savedInvoice.invoice_number ?? "invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("PDF downloaded.", { type: "success", title: "Download complete" });
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Download failed", { type: "error", title: "Download failed" });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [savedInvoice, toast]);

  const doDuplicate = useCallback(async () => {
    if (!savedInvoice) return;

    try {
      const res = await duplicateInvoice(savedInvoice.id);
      const newDoc: ApiInvoice = res.invoice;
      const newInvoiceNumber = getInvoiceNumber(newDoc);
      toast(`Duplicated as ${newInvoiceNumber}.`, {
        type: "success",
        title: "Duplicated",
      });
      setSavedInvoice(newDoc);
      setState((prev) => ({
        ...prev,
        invoiceNumber: newDoc.invoice_number ?? prev.invoiceNumber,
      }));
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Duplicate failed", { type: "error", title: "Duplicate failed" });
    }
  }, [savedInvoice, toast]);

  const handleItemDrawerSave = (item: DocumentLineItem) => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));
  };

  useEffect(() => {
    if (hasSaved) return;
    const nonEmptyItems = state.items.filter((item) => item.description.trim());
    if (nonEmptyItems.length === 0 && state.items.length <= 1) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      doSaveDraft();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [state.items, state.customerId, state.currency, state.notes, doSaveDraft, hasSaved]);

  const handleUpdateItem = useCallback(
    (idx: number, field: keyof DocumentLineItem, value: unknown) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
      }));
    },
    [],
  );

  const handleAddItem = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, initialLineItem()],
    }));
  }, []);

  const handleRemoveItem = useCallback((idx: number) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  }, []);

  const handleDuplicateItem = useCallback((idx: number) => {
    const item = state.items[idx];
    setState((prev) => ({
      ...prev,
      items: [...prev.items, { ...item, description: `${item.description} (copy)` }],
    }));
  }, [state.items]);

  const handleAddFee = useCallback(() => {
    setState((prev) => ({
      ...prev,
      fees: [...prev.fees, { description: "", amount: "0.00", taxRate: "0", taxName: "" }],
    }));
  }, []);

  const handleRemoveFee = useCallback((idx: number) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.filter((_, i) => i !== idx),
    }));
  }, []);

  const handleUpdateFee = useCallback((idx: number, field: keyof DocumentFee, value: string) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.map((fee, i) => (i === idx ? { ...fee, [field]: value } : fee)),
    }));
  }, []);

  const handleDiscountChange = useCallback((value: string) => {
    setState((prev) => ({ ...prev, invoiceDiscount: value }));
  }, []);

  const handleDiscountTypeChange = useCallback((value: "fixed" | "percentage") => {
    setState((prev) => ({ ...prev, invoiceDiscountType: value }));
  }, []);

  const handleStateChange = useCallback((patch: Partial<DocumentState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Maker"
        breadcrumbs={[
          { label: "Home", to: "/app" },
          { label: "Invoice Maker" },
        ]}
        description="Enter your details on the left and see a live preview on the right."
        primaryAction={
          <button
            onClick={() => navigate("/app/documents")}
            className="text-sm text-tertiary hover:text-primary"
          >
            Back to My Documents
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <InvoiceMakerForm
            state={state}
            calcResult={calcResult}
            business={business}
            customers={customers}
            taxRateOptions={taxRateOptions}
            products={products}
            itemDrawerOpen={itemDrawerOpen}
            onItemDrawerClose={() => setItemDrawerOpen(false)}
            onItemDrawerSave={handleItemDrawerSave}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            onDuplicateItem={handleDuplicateItem}
            onAddFee={handleAddFee}
            onRemoveFee={handleRemoveFee}
            onUpdateFee={handleUpdateFee}
            onDiscountChange={handleDiscountChange}
            onDiscountTypeChange={handleDiscountTypeChange}
            onStateChange={handleStateChange}
          />

          {quickActions?.frequentlyInvoiced &&
            quickActions.frequentlyInvoiced.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-tertiary">Frequently used:</span>
                {quickActions.frequentlyInvoiced.slice(0, 4).map((fi) => (
                  <button
                    key={fi.id ?? fi.name}
                    type="button"
                    onClick={() => {
                      const newItem: DocumentLineItem = {
                        description: fi.name,
                        quantity: "1",
                        unit: fi.unit,
                        unitPrice: fi.unitPrice,
                        taxRate: fi.taxRate,
                        taxName: "",
                        isTaxInclusive: false,
                        discount: "0",
                        discountType: "fixed",
                        productId: fi.id ?? null,
                        isOptional: false,
                      };
                      handleStateChange({
                        items: [...state.items, newItem],
                      });
                    }}
                    className="px-2 py-1 rounded-md bg-surface border border-color hover:bg-surface-alt transition-colors"
                  >
                    {fi.name}
                  </button>
                ))}
              </div>
            )}

          <InvoiceMakerActions
            saveState={saveState}
            isSaving={isSaving}
            hasSaved={hasSaved}
            isGeneratingPdf={isGeneratingPdf}
            onSaveDraft={doSaveDraft}
            onDownloadPdf={doDownloadPdf}
            onDuplicate={doDuplicate}
          />
        </div>

        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <InvoiceMakerPreview
            state={state}
            calcResult={calcResult}
            business={business}
            customers={customers}
            onDownloadPdf={doDownloadPdf}
            canDownload={hasSaved}
            isGeneratingPdf={isGeneratingPdf}
          />
        </div>
      </div>
    </div>
  );
}
