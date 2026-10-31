import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CalculationEngine } from "@/utils/calculation";
import type { InvoiceCalculationInput, LineItemInput, FeeInput, DiscountDefinition } from "@/types/calculation";
import { useToast, PageHeader, Button } from "@/components/ui";
import {
  DocumentMakerForm,
  DocumentMakerPreview,
  DocumentMakerActions,
} from "@/components/invoice-maker";
import {
  getCustomers,
  getBusiness,
  getTaxRates,
  getProducts,
  getSuggestedActions,
  getProgressiveAutofill,
  type SpeedQuickActions,
  type SpeedAutofillResult,
} from "@/api/client";
import type { ApiBusiness, ApiCustomer, ApiProduct, ApiTaxRate } from "@/types/api";
import {
  type DocumentState,
  type DocumentLineItem,
  type DocumentFee,
  type TaxRateOption,
  type DocumentType,
  type DocumentFormConfig,
  getDocumentHandler,
  docTypeLabel,
  initialLineItem,
} from "@/components/document";
import { Decimal } from "decimal.js";
import { Download, ArrowRightLeft } from "lucide-react";
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

function getDisplayName(docType: DocumentType): string {
  return docTypeLabel(docType);
}

export default function DocumentMaker({ docType }: { docType: DocumentType }) {
  useMetaTags({
    title: `${getDisplayName(docType)} Maker — DocForge`,
    description: `Create a professional ${getDisplayName(docType).toLowerCase()} with live preview.`,
    noIndex: true,
  });

  const navigate = useNavigate();
  const { toast } = useToast();
  const handler = useMemo(() => getDocumentHandler(docType), [docType]);
  const formConfig: DocumentFormConfig = handler.formConfig;

  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [taxRates, setTaxRates] = useState<ApiTaxRate[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);

  const [savedDoc, setSavedDoc] = useState<Record<string, unknown> | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [quickActions, setQuickActions] = useState<SpeedQuickActions | null>(null);
  const [currentStage, setCurrentStage] = useState<"create" | "preview">("create");

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
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    quoteDiscount: "0",
    quoteDiscountType: "fixed",
    scopeOfWork: "",
    internalNotes: "",
    voucherDate: "",
    payeeName: "",
    payeeEmail: "",
    payeePhone: "",
    referenceNumber: "",
    paymentMethod: "",
    paymentProvider: "",
    supplierName: "",
    supplierEmail: "",
    supplierPhone: "",
    referenceInvoiceId: "",
    referenceInvoiceNumber: "",
    reason: "",
    customReason: "",
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
  }, [docType]);

  useEffect(() => {
    if (state.customerId) {
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
  }, [state.customerId, docType]);

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

    let invoiceDiscountDef: DiscountDefinition | undefined;
    if (formConfig.isQuote) {
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
      currency: currencyCode as InvoiceCalculationInput["currency"],
      lineItems,
      fees,
      invoiceDiscount: invoiceDiscountDef,
    };
  }, [state.items, state.fees, state.invoiceDiscount, state.invoiceDiscountType, state.quoteDiscount, state.quoteDiscountType, state.currency, formConfig.isQuote]);

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
  const hasSaved = !!savedDoc;
  const isSaving = saveState === "saving";

  const buildPayload = useCallback(() => {
    const commonPayload: Record<string, unknown> = {
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

    if (formConfig.isInvoice) {
      return {
        ...commonPayload,
        dueDate: state.dueDate || undefined,
        poNumber: state.poNumber ?? undefined,
        invoiceDiscount: state.invoiceDiscount,
        invoiceDiscountType: state.invoiceDiscountType,
        shippingDescription: state.shippingDescription || undefined,
        shippingAmount: state.shippingAmount,
        shippingTaxRate: state.shippingTaxRate,
      };
    }

    if (formConfig.isQuote) {
      return {
        ...commonPayload,
        expiryDate: state.expiryDate || undefined,
        scopeOfWork: state.scopeOfWork || undefined,
        internalNotes: state.internalNotes || undefined,
        quoteDiscount: state.quoteDiscount,
        quoteDiscountType: state.quoteDiscountType,
      };
    }

    if (formConfig.isDebitNote) {
      return {
        customerId: state.customerId || undefined,
        issueDate: state.issueDate || undefined,
        dueDate: state.dueDate || undefined,
        currency: state.currency,
        notes: state.notes || undefined,
        terms: state.terms || undefined,
        paymentInstructions: state.paymentInstructions || undefined,
        referenceInvoiceId: state.referenceInvoiceId || undefined,
        referenceInvoiceNumber: state.referenceInvoiceNumber || undefined,
        reason: state.reason === "other" ? state.customReason : state.reason,
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
      };
    }

    if (formConfig.isPaymentVoucher) {
      return {
        voucherDate: state.voucherDate || state.issueDate || undefined,
        currency: state.currency,
        payeeName: state.payeeName,
        payeeEmail: state.payeeEmail || null,
        payeePhone: state.payeePhone || null,
        payeeAddressLine1: state.payeeAddressLine1 || null,
        payeeAddressLine2: state.payeeAddressLine2 || null,
        payeeCity: state.payeeCity || null,
        payeeStateOrRegion: state.payeeStateOrRegion || null,
        payeePostalCode: state.payeePostalCode || null,
        payeeCountryCode: state.payeeCountryCode || null,
        payeeTaxId: state.payeeTaxId || null,
        referenceNumber: state.referenceNumber || null,
        paymentMethod: state.paymentMethod || null,
        paymentProvider: state.paymentProvider || null,
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
          })),
      };
    }

    if (formConfig.isCreditNote) {
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
      };
    }

    if (formConfig.showsSupplierSection) {
      return {
        ...commonPayload,
        dueDate: state.dueDate || undefined,
        poNumber: state.poNumber ?? undefined,
        supplierName: state.supplierName || undefined,
        supplierEmail: state.supplierEmail || undefined,
        supplierPhone: state.supplierPhone || undefined,
        supplierTaxId: state.supplierTaxId || undefined,
        supplierAddressLine1: state.supplierAddressLine1 || undefined,
        supplierAddressLine2: state.supplierAddressLine2 || undefined,
        supplierCity: state.supplierCity || undefined,
        supplierStateOrRegion: state.supplierStateOrRegion || undefined,
        supplierPostalCode: state.supplierPostalCode || undefined,
        supplierCountryCode: state.supplierCountryCode || undefined,
        deliveryDate: state.deliveryDate || undefined,
        shippingDescription: state.shippingDescription || undefined,
        shippingAmount: state.shippingAmount || undefined,
        shippingTaxRate: state.shippingTaxRate || undefined,
        shippingAddressLine1: state.shippingAddressLine1 || undefined,
        shippingAddressLine2: state.shippingAddressLine2 || undefined,
        shippingCity: state.shippingCity || undefined,
        shippingStateOrRegion: state.shippingStateOrRegion || undefined,
        shippingPostalCode: state.shippingPostalCode || undefined,
        shippingCountryCode: state.shippingCountryCode || undefined,
      };
    }

    return commonPayload;
  }, [
    state,
    formConfig.isInvoice,
    formConfig.isQuote,
    formConfig.isDebitNote,
    formConfig.isPaymentVoucher,
    formConfig.isCreditNote,
    formConfig.showsSupplierSection,
  ]);

  const doSaveDraft = useCallback(async () => {
    if (!handler.supportsFinalize) {
      toast(`${getDisplayName(docType)}s cannot be created directly.`, { type: "error" });
      return;
    }

    const nonEmptyItems = state.items.filter((item) => item.description.trim());
    if (nonEmptyItems.length === 0) {
      toast("Add at least one line item before saving.", {
        type: "warning",
        title: "Empty document",
      });
      return;
    }

    setSaveState("saving");
    try {
      const res = await handler.create(buildPayload());
      const doc = res.invoice ?? res.quote ?? res.creditNote ?? res.debitNote ?? res.voucher ?? res.purchaseOrder ?? res.receipt;
      if (!doc) throw new Error("Failed to create document");
      setSavedDoc(doc);
      const num = handler.getNumberField(doc);
      setState((prev) => ({
        ...prev,
        invoiceNumber: num ?? prev.invoiceNumber,
      }));
      setSaveState("saved");
      if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
      saveStateTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
      toast(`${getDisplayName(docType)} saved.`, { type: "success", title: `${getDisplayName(docType)} #${num ?? ""} saved` });
    } catch (err: unknown) {
      setSaveState("error");
      toast(err instanceof Error ? err.message : "Save failed", { type: "error", title: "Save failed" });
    } finally {
      if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
    }
  }, [handler, docType, buildPayload, state.items, toast]);

  const doDownloadPdf = useCallback(async () => {
    if (!savedDoc) return;

    setIsGeneratingPdf(true);
    try {
      const blob = await handler.getPdf(savedDoc.id as string);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const num = handler.getNumberField(savedDoc);
      a.download = `${num ?? "document"}.pdf`;
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
  }, [savedDoc, handler, toast]);

  const doDuplicate = useCallback(async () => {
    if (!handler.supportsDuplicate) {
      toast(`Duplicate is not supported for ${getDisplayName(docType).toLowerCase()}.`, { type: "info" });
      return;
    }
    if (!savedDoc) return;

    try {
      const res = await handler.duplicate(savedDoc.id as string);
      const newDoc = res.invoice ?? res.quote ?? res.creditNote ?? res.debitNote ?? res.voucher ?? res.purchaseOrder;
      const newNum = handler.getNumberField(newDoc);
      toast(`${getDisplayName(docType)} duplicated as #${newNum ?? ""}.`, {
        type: "success",
        title: "Duplicated",
      });
      setSavedDoc(newDoc);
      setState((prev) => ({
        ...prev,
        invoiceNumber: newNum ?? prev.invoiceNumber,
      }));
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Duplicate failed", { type: "error", title: "Duplicate failed" });
    }
  }, [handler, docType, savedDoc, toast]);

  const handleItemDrawerSave = (item: DocumentLineItem) => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));
  };

  useEffect(() => {
    const hasSavedCheck = !!savedDoc;
    if (hasSavedCheck) return;
    const nonEmptyItems = state.items.filter((item) => item.description.trim());
    if (nonEmptyItems.length === 0 && state.items.length <= 1) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      doSaveDraft();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
   }, [state.items, state.customerId, state.currency, state.notes, doSaveDraft, savedDoc]);

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
    if (formConfig.isQuote) {
      setState((prev) => ({ ...prev, quoteDiscount: value }));
    } else {
      setState((prev) => ({ ...prev, invoiceDiscount: value }));
    }
  }, [formConfig.isQuote]);

  const handleDiscountTypeChange = useCallback((value: "fixed" | "percentage") => {
    if (formConfig.isQuote) {
      setState((prev) => ({ ...prev, quoteDiscountType: value }));
    } else {
      setState((prev) => ({ ...prev, invoiceDiscountType: value }));
    }
  }, [formConfig.isQuote]);

  const handleStateChange = useCallback((patch: Partial<DocumentState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const documentNumber = savedDoc
    ? handler.getNumberField(savedDoc) ?? state.invoiceNumber ?? ""
    : state.invoiceNumber ?? "";

  const label = getDisplayName(docType);

  return (
    <div className="space-y-6">
      {currentStage === "create" ? (
        <>
          <PageHeader
            title={`${label} Maker`}
            breadcrumbs={[
              { label: "Home", to: "/app" },
              { label: `${label} Maker` },
            ]}
            description={`Enter your document details below.`}
            primaryAction={
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/app/documents")}
                  className="text-sm text-tertiary hover:text-primary"
                >
                  Back to My Documents
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentStage("preview")}
                  disabled={!hasSaved}
                  icon={<ArrowRightLeft className="h-4 w-4" />}
                >
                  Preview
                </Button>
              </div>
            }
          />

          <div className="space-y-4">
            <DocumentMakerForm
              docType={docType}
              state={state}
              calcResult={calcResult}
              formConfig={formConfig}
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

            <DocumentMakerActions
              saveState={saveState}
              isSaving={isSaving}
              hasSaved={hasSaved}
              isGeneratingPdf={isGeneratingPdf}
              supportsDuplicate={handler.supportsDuplicate}
              supportsSend={handler.supportsSend}
              onSaveDraft={doSaveDraft}
              onDownloadPdf={doDownloadPdf}
              onDuplicate={doDuplicate}
              onSend={() => {}}
            />
          </div>
        </>
      ) : (
        <>
          <PageHeader
            title={`Preview ${label}`}
            breadcrumbs={[
              { label: "Home", to: "/app" },
              { label: `${label} Maker`, to: `/app/${handler.routePrefix}/${savedDoc ? "edit" : "new"}` },
              { label: "Preview" },
            ]}
            description={`Review your ${label.toLowerCase()} before finalizing.`}
            primaryAction={
              <button
                onClick={() => setCurrentStage("create")}
                className="text-sm text-tertiary hover:text-primary"
              >
                ← Back to Edit
              </button>
            }
          />

          <div className="max-w-4xl mx-auto">
            <DocumentMakerPreview
              docType={docType}
              state={state}
              calcResult={calcResult}
              formConfig={formConfig}
              business={business}
              customers={customers}
              documentNumber={documentNumber}
              onDownloadPdf={doDownloadPdf}
              canDownload={hasSaved}
              isGeneratingPdf={isGeneratingPdf}
            />

            <div className="flex justify-end gap-3 pt-6 border-t border-color">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentStage("create")}
              >
                Back to Edit
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={doDownloadPdf}
                disabled={!hasSaved || isGeneratingPdf}
                loading={isGeneratingPdf}
              >
                Download PDF
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
