/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { CalculationEngine } from "@/utils/calculation";
import type { InvoiceCalculationInput, LineItemInput, FeeInput, DiscountDefinition } from "@/types/calculation";
  import { useToast, Button, FormField, FormTextareaField, PageHeader, StatusBadge, Dialog, SearchInput } from "@/components/ui";
import SectionCard from "@/components/SectionCard";
import {
  Send,
  Plus,
  FileText,
  Bell,
  Copy,
  AlertCircle,
  CheckCircle,
  Loader2,
   ArrowLeft,
} from "lucide-react";
import { Decimal } from "decimal.js";
import DocumentPreview from "@/components/DocumentPreview";
import {
  DocumentFees,
  DocumentTotalsCard,
  DocumentNotesSection,
  DocumentDetailsAccordion,
  SimpleDocumentLineItems,
  DocumentActionBar,
  LayoutSelector,
  ItemEntryDrawer,
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
  sendReminder,
  type CreateInvoiceInput,
  type CreateQuoteInput,
  type CreateCreditNoteInput,
  type ApiCreateDebitNoteInput,
  type ApiCreatePaymentVoucherInput,
  getSuggestedActions,
  getProgressiveAutofill,
  getDocumentTemplate,
  type SpeedQuickActions,
  type SpeedAutofillResult,
} from "@/api/client";
import { getDocumentHandler, getDocumentRoutePrefix, docTypeLabel as docTypeLabelFn } from "@/components/document";
import { DocumentConverter } from "@/components/document";
import { RelatedDocuments } from "@/components/document";
import type { ApiBusiness, ApiCustomer, ApiTaxRate, ApiProduct } from "@/types/api";
import { formatTaxRate } from "@/utils/format";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useMetaTags } from "@/hooks/useMetaTags";

const AUTO_SAVE_DELAY = 1500;

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

    const handler = getDocumentHandler(docType);
    handler
      .fetchDetail(id)
      .then((doc) => setDocument(doc))
      .catch((err: any) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [docType, id, isNew]);

  return { document, setDocument, isLoading, error };
}

export default function DocumentWorkspace({ docType }: DocumentWorkspaceProps) {
  useMetaTags({
    title: "Document Workspace — DocForge",
    description: "Create and edit your invoice, quote, or credit note with automatic calculations and professional formatting.",
    noIndex: true,
  });

  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("template");
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === "new";
  const handler = useMemo(() => getDocumentHandler(docType), [docType]);

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
  const [converterDialogOpen, setConverterDialogOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false);
  const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [quickActions, setQuickActions] = useState<SpeedQuickActions | null>(null);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);

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

  const [workflowStep, setWorkflowStep] = useState<"edit" | "preview">("edit");

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedStateRef = useRef<DocumentState | null>(null);

  const isFinalized = document?.is_finalized ?? false;

  useEffect(() => {
    if (isFinalized && !isNew) {
      setWorkflowStep("preview");
    }
  }, [isFinalized && !isNew]);
  useEffect(() => {
    getCustomers({ limit: 100 }).then((d) => setCustomers(d.customers ?? [])).catch(() => {});
    getBusiness().then((d) => setBusiness(d.business ?? d)).catch(() => {});
    getTaxRates().then((d) => setTaxRates(d.taxRates ?? d.rates ?? [])).catch(() => {});
    const loadProducts = () => {
      getProducts({ limit: 100 }).then((d) => setProducts(d.products ?? [])).catch(() => {});
    };
    loadProducts();

    // Fetch quick actions (last invoice, frequent items, recent customers, draft)
    getSuggestedActions().then((d) => setQuickActions(d)).catch(() => {});

    // Apply progressive autofill for new documents
    if (isNew) {
      getProgressiveAutofill(null).then((af: SpeedAutofillResult) => {
        setState((prev) => ({
          ...prev,
          currency: af.currency ?? prev.currency,
          issueDate: af.issueDate ?? prev.issueDate,
          dueDate: af.dueDate ?? prev.dueDate,
          terms: af.terms ?? prev.terms,
          notes: af.notes ?? prev.notes,
          paymentInstructions: af.paymentInstructions ?? prev.paymentInstructions,
        }));
      }).catch(() => {});
    }
  }, [docType, isNew]);

  useEffect(() => {
    if (!isNew || !templateId || isLoading) return;

    getDocumentTemplate(templateId).then((res) => {
      const template = res.template;
      if (template?.config?.layout) {
        const layout = template.config.layout as any;
        setState((prev) => ({
          ...prev,
          currency: layout.style?.currency ?? prev.currency,
          notes: layout.notes ?? prev.notes,
          terms: layout.terms ?? prev.terms,
          paymentInstructions: layout.paymentInstructions ?? prev.paymentInstructions,
          scopeOfWork: layout.scopeOfWork ?? prev.scopeOfWork,
          internalNotes: layout.internalNotes ?? prev.internalNotes,
        }));
      }
    }).catch(() => {});
  }, [isNew, templateId, isLoading]);

  // Apply progressive autofill when customer is selected on a new document
  useEffect(() => {
    if (!isNew || !state.customerId || !docType) return;
    getProgressiveAutofill(state.customerId).then((af: SpeedAutofillResult) => {
      setState((prev) => ({
        ...prev,
        currency: af.currency ?? prev.currency,
        terms: af.terms ?? prev.terms,
        notes: af.notes ?? prev.notes,
        paymentInstructions: af.paymentInstructions ?? prev.paymentInstructions,
        dueDate: af.dueDate ?? prev.dueDate,
      }));
    }).catch(() => {});
  }, [state.customerId, isNew, docType]);

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
        /** Debit-note fields */
        referenceInvoiceNumber: doc.reference_invoice_number ?? "",
        /** Payment-voucher fields */
        payeeName: doc.payee_name ?? "",
        payeeEmail: doc.payee_email ?? "",
        payeePhone: doc.payee_phone ?? "",
        payeeAddressLine1: doc.payee_address_line_1 ?? "",
        payeeAddressLine2: doc.payee_address_line_2 ?? "",
        payeeCity: doc.payee_city ?? "",
        payeeStateOrRegion: doc.payee_state_or_region ?? "",
        payeePostalCode: doc.payee_postal_code ?? "",
        payeeCountryCode: doc.payee_country_code ?? "",
        payeeTaxId: doc.payee_tax_id ?? "",
        voucherDate: doc.voucher_date ? new Date(doc.voucher_date).toISOString().split("T")[0] : prev.voucherDate,
        referenceNumber: doc.reference_number ?? "",
        paymentMethod: doc.payment_method ?? "",
        paymentProvider: doc.payment_provider ?? "",
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
    if (handler.formConfig.isQuote) {
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

    if (handler.formConfig.isInvoice) {
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

    if (handler.formConfig.isQuote) {
       return {
         ...commonPayload,
         expiryDate: state.expiryDate || undefined,
         scopeOfWork: state.scopeOfWork || undefined,
         internalNotes: state.internalNotes || undefined,
         quoteDiscount: state.quoteDiscount,
         quoteDiscountType: state.quoteDiscountType,
       } as CreateQuoteInput;
     }

     if (handler.formConfig.isDebitNote) {
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
       } as ApiCreateDebitNoteInput;
     }

     if (handler.formConfig.isPaymentVoucher) {
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
       } as ApiCreatePaymentVoucherInput;
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
    const fullPayload = buildPayload();
    if (!fullPayload.items || fullPayload.items.length === 0) {
      toast("Add at least one line item before saving.", { type: "warning", title: "Empty document" });
      return;
    }
    setSaveState("saving");
    try {
      if (isNew) {
        const res = await handler.create(fullPayload as unknown as Record<string, unknown>);
        const doc = res.invoice ?? res.quote ?? res.creditNote ?? res.debitNote ?? res.voucher ?? res.purchaseOrder ?? res.receipt;
        const num = handler.getNumberField(doc);
        toast(`Created ${docTypeLabelFn(docType)} #${num ?? ""}.`, { type: "success", title: `${docTypeLabelFn(docType)} created` });
        navigate(`/app/${getDocumentRoutePrefix(docType)}/${doc.id}/edit`);
        setDocument(doc);
      } else {
        const doc = document as any;
        const prev = lastSavedStateRef.current;
        let payload: any;

        if (!prev) {
          payload = fullPayload;
        } else {
          payload = {};
          const scalarFields = ["customerId", "currency", "issueDate", "dueDate", "expiryDate", "notes", "terms", "paymentInstructions", "poNumber", "quoteDiscount", "quoteDiscountType", "invoiceDiscount", "invoiceDiscountType", "shippingDescription", "shippingAmount", "shippingTaxRate", "referenceInvoiceNumber", "voucherDate", "payeeName", "payeeEmail", "payeePhone", "payeeAddressLine1", "payeeAddressLine2", "payeeCity", "payeeStateOrRegion", "payeePostalCode", "payeeCountryCode", "payeeTaxId", "referenceNumber", "paymentMethod", "paymentProvider"];
          for (const field of scalarFields) {
            if (JSON.stringify((state as any)[field]) !== JSON.stringify((prev as any)[field])) {
              (payload as any)[field] = (state as any)[field] ?? undefined;
            }
          }
        }
        payload.items = fullPayload.items;
        payload.fees = (fullPayload as any).fees;
        payload.version = doc.version;

        await handler.update(doc.id, payload as Record<string, unknown>);
        setSaveState("saved");
        if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
        saveStateTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
        lastSavedStateRef.current = { ...state };
      }
    } catch (err: any) {
      setSaveState("error");
      toast(err.message, { type: "error", title: "Save failed" });
    } finally {
      if (saveStateTimerRef.current) clearTimeout(saveStateTimerRef.current);
    }
  }, [id, isNew, docType, handler, document, state, navigate, toast]);

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
    onFinalize: () => !isFinalizing && (workflowStep === "edit" ? handleProceedToPreview() : handleFinalize()),
    onSend: () => !isSending && (document?.is_finalized ? setSendDialogOpen(true) : handleFinalizeAndSend()),
    onAddItem: () => handleAddItem(),
    onAddFee: () => handleAddFee(),
    onFocusSearch: () => {
      if (!isFinalized && isNew && workflowStep === "edit") {
        setItemDrawerOpen(true);
      }
    },
    onTogglePreview: () => {
      if (!isFinalized) {
        setWorkflowStep(workflowStep === "edit" ? "preview" : "edit");
      }
    },
  });

  const getDocumentTitle = () => {
    const doc = document as any;
    if (isNew) {
      return `New ${docTypeLabelFn(docType)}`;
    }
    const num = handler.getNumberField(doc);
    return `${docTypeLabelFn(docType)} #${num ?? ""}`;
  };

  const handleFinalize = useCallback(async () => {
    if (isNew && !document) {
      await doSave();
    }
    const doc = document as any;
    if (!doc) return;

    if (!handler.supportsFinalize) {
      toast(`${docTypeLabelFn(docType)}s do not need finalization.`, { type: "info", title: "Not applicable" });
      return;
    }

     setIsFinalizing(true);
    try {
      const result = await handler.finalize(doc.id);
      setDocument(result.document);
      setSaveState("idle");
      setWorkflowStep("preview");
      toast(`${docTypeLabelFn(docType)} #${result.documentNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [document, isNew, doSave, docType, handler, toast]);

  const handleFinalizeAndSend = useCallback(async () => {
    if (isNew && !document) {
      await doSave();
    }
    const doc = document as any;
    if (!doc) return;

    const issues = validateDocument();
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      setValidationDialogOpen(true);
      return;
    }

    setValidationDialogOpen(false);
    proceedFinalizeAndSend();
  }, [document, isNew, doSave, toast]);

  const proceedFinalizeAndSend = useCallback(async () => {
    const doc = document as any;
    if (!doc) return;

    if (!handler.supportsFinalize) {
      setIsSending(true);
      try {
        await handler.send(doc.id, sendData);
        const recipient = sendData.to || doc.customer_email || doc.payee_email || "recipient";
        toast(`${docTypeLabelFn(docType)} sent to ${recipient}.`, { type: "success", title: "Sent" });
        setSendDialogOpen(false);
      } catch (err: any) {
        toast(err.message, { type: "error", title: "Send failed" });
      } finally {
        setIsSending(false);
      }
      return;
    }

    setIsFinalizing(true);
    try {
      const finalizeResult = await handler.finalize(doc.id);
      const finalizedDoc = finalizeResult.document;
      setDocument(finalizedDoc);
      setSaveState("idle");
      toast(`${docTypeLabelFn(docType)} #${finalizeResult.documentNumber ?? ""} finalized.`, { type: "success", title: "Finalized" });

      if (handler.supportsSend) {
        setIsSending(true);
        try {
          await handler.send(finalizedDoc.id ?? doc.id, sendData);
          const recipient = sendData.to || finalizedDoc.customer_email || finalizedDoc.payee_email || doc.customer_email || doc.payee_email || "recipient";
          toast(`${docTypeLabelFn(docType)} sent to ${recipient}.`, { type: "success", title: "Sent" });
          setSendDialogOpen(false);
        } catch (err: any) {
          toast(err.message, { type: "error", title: "Send failed" });
        } finally {
          setIsSending(false);
        }
      } else {
        setSendDialogOpen(true);
      }
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Finalize failed" });
    } finally {
      setIsFinalizing(false);
    }
  }, [document, docType, handler, sendData, toast]);

  const confirmSend = useCallback(async () => {
    const doc = document as any;
    if (!doc) return;

    if (!handler.supportsSend) {
      setSendDialogOpen(false);
      toast(`Send functionality for ${docTypeLabelFn(docType).toLowerCase()} is not available.`, { type: "info", title: "Not available" });
      return;
    }

    setIsSending(true);
    try {
      await handler.send(doc.id, sendData);
      const recipient = sendData.to || doc.customer_email || doc.payee_email || "recipient";
      toast(`${docTypeLabelFn(docType)} sent to ${recipient}.`, { type: "success", title: "Sent" });
      setSendDialogOpen(false);
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Send failed" });
    } finally {
      setIsSending(false);
    }
  }, [document, docType, handler, sendData, toast]);

  const handleSendReminder = useCallback(async () => {
    const doc = document as any;
    if (!doc) return;

    try {
      await sendReminder(doc.id, {
        to: doc.customer_email ?? "",
        subject: `Payment Reminder: ${docTypeLabelFn(docType)} ${handler.getNumberField(doc) ?? ""}`,
      });
      toast("Reminder sent.", { type: "success", title: "Sent" });
    } catch (err: any) {
      toast(err.message, { type: "error", title: "Send failed" });
    }
  }, [document, docType, handler, toast]);

  const validateDocument = (): { code: string; message: string; severity: "error" | "warning"; field?: string }[] => {
    const issues: { code: string; message: string; severity: "error" | "warning"; field?: string }[] = [];

    const doc = document as any;

    // Customer/payee validation — payment vouchers use payeeName, debit notes use customerId or customerName
    if (handler.formConfig.isPaymentVoucher) {
      if (!state.payeeName) {
        issues.push({ code: "MISSING_PAYEE", message: "No payee name provided", severity: "error" });
      }
     } else if (handler.formConfig.showsReferenceInvoice) {
      // Debit notes can use either customer_id (linked customer) or flat customer name
      if (!doc?.customer_id && !state.customerId) {
        issues.push({ code: "MISSING_CUSTOMER", message: "No customer provided", severity: "error" });
      }
    } else {
      if (!doc?.customer_id && !state.customerId) {
        issues.push({ code: "MISSING_CUSTOMER", message: "No customer selected", severity: "error" });
      }
    }

    if (handler.formConfig.isPaymentVoucher) {
      if (!state.voucherDate) {
        issues.push({ code: "MISSING_DATE", message: "No voucher date set", severity: "error" });
      }
    } else {
      if (!state.issueDate) {
        issues.push({ code: "MISSING_ISSUE_DATE", message: "No issue date set", severity: "error" });
      }
      if (state.dueDate && state.issueDate && state.dueDate < state.issueDate) {
        issues.push({ code: "INVALID_DUE_DATE", message: "Due date is before issue date", severity: "error" });
      }
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

    if (!handler.formConfig.isPaymentVoucher) {
      if (!doc?.payment_instructions && !state.paymentInstructions) {
        issues.push({ code: "MISSING_PAYMENT_INSTRUCTIONS", message: "No payment instructions provided", severity: "warning" });
      }
      if (!doc?.notes && !state.notes) {
        issues.push({ code: "MISSING_NOTES", message: "No notes provided for the customer", severity: "warning" });
      }
      if (!doc?.customer_email && !state.customerId) {
        issues.push({ code: "MISSING_CUSTOMER_EMAIL", message: "Customer has no email address", severity: "warning" });
      }
    }

    if (handler.formConfig.showsReferenceInvoice) {
      if (!state.reason && !state.customReason) {
        issues.push({ code: "MISSING_REASON", message: "No reason provided for this debit note", severity: "error" });
      }
      if (!state.customerId) {
        issues.push({ code: "MISSING_CUSTOMER_ID", message: "No customer selected — link to a customer for proper tracking", severity: "warning" });
      }
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

  const handleApplyPreset = (data: Record<string, unknown>) => {
    const config = data.config as Record<string, unknown> | undefined;
    const layoutData = config ? { ...data, ...config } : data;

    setState((prev) => ({
      ...prev,
      customerId: (layoutData.customerId as string) ?? prev.customerId,
      currency: (layoutData.currency as string) ?? prev.currency,
      issueDate: (layoutData.issueDate as string) ?? prev.issueDate,
      dueDate: (layoutData.dueDate as string) ?? prev.dueDate,
      notes: (layoutData.notes as string) ?? prev.notes,
      terms: (layoutData.terms as string) ?? prev.terms,
      paymentInstructions: (layoutData.paymentInstructions as string) ?? prev.paymentInstructions,
      paymentTerms: (layoutData.paymentTerms as string) ?? prev.paymentTerms,
      poNumber: (layoutData.poNumber as string) ?? prev.poNumber,
      items: (layoutData.items as DocumentLineItem[]) ?? prev.items,
      fees: (layoutData.fees as DocumentFee[]) ?? prev.fees,
      invoiceDiscount: (layoutData.invoiceDiscount as string) ?? prev.invoiceDiscount,
      invoiceDiscountType: (layoutData.invoiceDiscountType as "fixed" | "percentage") ?? prev.invoiceDiscountType,
      scopeOfWork: (layoutData.scopeOfWork as string) ?? prev.scopeOfWork,
      internalNotes: (layoutData.internalNotes as string) ?? prev.internalNotes,
      quoteDiscount: (layoutData.quoteDiscount as string) ?? prev.quoteDiscount,
      quoteDiscountType: (layoutData.quoteDiscountType as "fixed" | "percentage") ?? prev.quoteDiscountType,
      expiryDate: (layoutData.expiryDate as string) ?? prev.expiryDate,
      reason: (layoutData.reason as string) ?? prev.reason,
      referenceInvoiceId: (layoutData.referenceInvoiceId as string) ?? prev.referenceInvoiceId,
      referenceInvoiceNumber: (layoutData.referenceInvoiceNumber as string) ?? prev.referenceInvoiceNumber,
      shippingDescription: (layoutData.shippingDescription as string) ?? prev.shippingDescription,
      shippingAmount: (layoutData.shippingAmount as string) ?? prev.shippingAmount,
      shippingTaxRate: (layoutData.shippingTaxRate as string) ?? prev.shippingTaxRate,
      voucherDate: (layoutData.voucherDate as string) ?? prev.voucherDate,
      payeeName: (layoutData.payeeName as string) ?? prev.payeeName,
      payeeEmail: (layoutData.payeeEmail as string) ?? prev.payeeEmail,
      payeePhone: (layoutData.payeePhone as string) ?? prev.payeePhone,
      deliveryDate: (layoutData.deliveryDate as string) ?? prev.deliveryDate,
    }));
  };

   const handleUseLastInvoice = () => {
    if (!quickActions?.lastInvoice) return;
    const last = quickActions.lastInvoice;
    setState((prev) => ({
      ...prev,
      customerId: last.customer.id || prev.customerId,
      currency: last.currency || prev.currency,
      notes: last.notes ?? prev.notes,
      terms: last.terms ?? prev.terms,
      paymentInstructions: last.paymentInstructions ?? prev.paymentInstructions,
      items: last.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxName: "",
        isTaxInclusive: false,
        discount: "0",
        discountType: "fixed",
        productId: item.productId ?? null,
        isOptional: false,
      })),
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
  const customerName = handler.formConfig.isPaymentVoucher
    ? (state.payeeName ?? "Enter payee name")
    : (state.customerId
        ? customers.find((c) => c.id === state.customerId)?.name ??
          customers.find((c) => c.id === state.customerId)?.email ??
          "”"
        : "Select a customer");

  const statusConfig = handler.statusConfig;

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
        <PageHeader title={docTypeLabelFn(docType)} />
        <div className="p-4 rounded-md bg-error-bg text-error-text">{error}</div>
      </div>
    );
  }

  const handleProceedToPreview = useCallback(async () => {
    const issues = validateDocument();
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      setValidationDialogOpen(true);
      return;
    }

    if (isNew && !document) {
      await doSave();
    }

    if (isNew && !document) {
      return;
    }

    setWorkflowStep("preview");
  }, [document, isNew, doSave]);

  const handleBackToEdit = useCallback(() => {
    setWorkflowStep("edit");
  }, []);

   return (
    <div className="page-container h-[calc(100vh-4rem)] flex flex-col">
       <PageHeader
          title={getDocumentTitle()}
           breadcrumbs={
             !isNew
               ? [
                   { label: handler.pluralLabel, to: `/app/${handler.routePrefix}` },
                 ]
               : [{ label: handler.pluralLabel, to: `/app/${handler.routePrefix}` }]
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

              {workflowStep === "preview" ? (
                <>
                  <Button
                    variant="ghost"
                    icon={<ArrowLeft className="h-4 w-4" />}
                    onClick={handleBackToEdit}
                    size="sm"
                  >
                    Back to Edit
                  </Button>
                  {isFinalized ? (
                    <>
                      {handler.formConfig.isInvoice && (
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
                        variant="primary"
                        icon={<Send className="h-4 w-4" />}
                        onClick={() => setSendDialogOpen(true)}
                        disabled={isSending || !handler.supportsSend}
                        loading={isSending}
                        size="sm"
                      >
                        Send
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      icon={<FileText className="h-4 w-4" />}
                      onClick={handleFinalizeAndSend}
                      disabled={isFinalizing || !handler.supportsFinalize}
                      loading={isFinalizing}
                      size="sm"
                    >
                      Finalize & Send
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {!isFinalized && !isNew && (
                    <div className="flex items-center gap-2">
                      <LayoutSelector
                        docType={docType}
                        onApply={handleApplyPreset}
                        currentData={state as unknown as Record<string, unknown>}
                      />
                    </div>
                  )}
                  <DocumentActionBar
                    isFinalized={isFinalized}
                    saveState={saveState}
                    isFinalizing={isFinalizing}
                    isSending={isSending}
                    onSave={doSave}
                    onFinalize={handleProceedToPreview}
                    onSend={() => setSendDialogOpen(true)}
                  />
                  {!isNew && document?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={() => setConverterDialogOpen(true)}
                    >
                      Convert
                    </Button>
                  )}
                </>
              )}
            </div>
          }
         />

        {workflowStep === "preview" && (
          <div className="px-6 py-3 border-b border-color bg-surface-alt">
            <div className="flex items-center gap-3 text-sm">
               <div
                 className="px-3 py-1 rounded-md text-xs font-medium text-tertiary"
               >
                 1. Edit
               </div>
              <div className="flex-1 h-px bg-color-subtle" />
              <div
                className={`px-3 py-1 rounded-md text-xs font-medium ${
                  workflowStep === "preview"
                    ? "bg-primary-bg text-primary-brand"
                    : "text-tertiary"
                }`}
              >
                2. Review & Send
              </div>
            </div>
          </div>
         )}

        {/* Quick actions — only for new/draft documents in edit step */}
        {!isFinalized && isNew && workflowStep === "edit" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setItemDrawerOpen(true)}
              >
                Add Line Item
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleAddItem}
              >
                Quick Add
              </Button>
            </div>

            {/* Frequently invoiced item chips */}
            {quickActions?.frequentlyInvoiced && quickActions.frequentlyInvoiced.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-tertiary">Frequently used:</span>
                {quickActions.frequentlyInvoiced.slice(0, 6).map((fi) => (
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
                      setState((prev) => ({
                        ...prev,
                        items: [...prev.items, newItem],
                      }));
                    }}
                    className="px-3 py-1 text-xs rounded-md bg-surface border border-color hover:bg-surface-alt transition-colors"
                  >
                    {fi.name} — {fi.unitPrice}
                  </button>
                ))}
              </div>
            )}

            {/* Use last invoice quick action */}
            {quickActions?.lastInvoice && (
              <button
                type="button"
                onClick={handleUseLastInvoice}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Use last invoice for {quickActions.lastInvoice.customer?.name ?? "this customer"}
              </button>
            )}
          </div>
        )}

        {/* --- Step 1: Edit --- */}
        {workflowStep === "edit" && (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 pr-2">
              <SectionCard title={handler.formConfig.isPaymentVoucher ? "Payee" : handler.formConfig.showsSupplierSection ? "Supplier" : "Customer"}>
                 <div className="p-5 space-y-3">
                   {handler.formConfig.isPaymentVoucher ? (
                    <>
                      <FormField
                        label="Payee Name"
                        placeholder="Payee name"
                        value={state.payeeName ?? ""}
                        onChange={(e) => setState((prev) => ({ ...prev, payeeName: e.target.value }))}
                        disabled={isFinalized}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          label="Email"
                          type="email"
                          placeholder="payee@example.com"
                          value={state.payeeEmail ?? ""}
                          onChange={(e) => setState((prev) => ({ ...prev, payeeEmail: e.target.value }))}
                          disabled={isFinalized}
                        />
                        <FormField
                          label="Phone"
                          placeholder="+1 (555) 123-4567"
                          value={state.payeePhone ?? ""}
                          onChange={(e) => setState((prev) => ({ ...prev, payeePhone: e.target.value }))}
                          disabled={isFinalized}
                        />
                      </div>
                    </>
                  ) : (
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
                  )}
                </div>
              </SectionCard>

              <DocumentDetailsAccordion
                docType={docType}
                state={state}
                isFinalized={isFinalized}
                onStateChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              />



              <SectionCard title="Line Items">
                <div className="p-5">
                  <SimpleDocumentLineItems
                    items={state.items}
                    isFinalized={isFinalized}
                    taxRateOptions={taxRateOptions}
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
                invoiceDiscount={handler.formConfig.isQuote ? state.quoteDiscount : state.invoiceDiscount}
                invoiceDiscountType={handler.formConfig.isQuote ? state.quoteDiscountType : state.invoiceDiscountType}
                onDiscountChange={(v) =>
                  handler.formConfig.isQuote
                    ? setState((prev) => ({ ...prev, quoteDiscount: v }))
                    : setState((prev) => ({ ...prev, invoiceDiscount: v }))
                }
                onDiscountTypeChange={(v) =>
                  handler.formConfig.isQuote
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
                     isQuote={handler.formConfig.isQuote}
                     isCreditNote={handler.formConfig.isCreditNote}
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
          </div>
        )}

        {!isNew && document && (
          <div className="px-1 pb-6">
            <RelatedDocuments docType={docType} docId={document.id} />
          </div>
        )}

        {!isNew && !isFinalized && document && document.id && (
          <DocumentConverter
            open={converterDialogOpen}
            onClose={() => setConverterDialogOpen(false)}
            docType={docType}
            docId={document.id}
            onConversionComplete={(result) => {
              toast(
                `Converted to ${result.targetDocumentType} successfully`,
                { type: "success" },
              );
            }}
          />
        )}
        
        {/* --- Step 2: Preview & Send --- */}
        {workflowStep === "preview" && (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 pr-2">
              {/* Validation Issues Summary */}
              {!isFinalized && (
                <SectionCard title="Review Summary">
                  <div className="p-5">
                    {(() => {
                      const issues = validateDocument();
                      const errors = issues.filter((i) => i.severity === "error");
                      const warnings = issues.filter((i) => i.severity === "warning");
                      if (issues.length === 0) {
                        return (
                          <div className="flex items-center gap-2 text-success">
                            <CheckCircle className="h-5 w-5" />
                            <p>No issues found. You're ready to send.</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-3">
                          {errors.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-error mb-1 flex items-center gap-1.5">
                                <AlertCircle className="h-4 w-4" />
                                Errors ({errors.length})
                              </h4>
                              <ul className="space-y-0.5 text-sm text-error-text">
                                {errors.map((issue, i) => (
                                  <li key={i}>• {issue.message}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {warnings.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-warning-text mb-1 flex items-center gap-1.5">
                                <AlertCircle className="h-4 w-4" />
                                Warnings ({warnings.length})
                              </h4>
                              <ul className="space-y-0.5 text-sm text-secondary">
                                {warnings.map((issue, i) => (
                                  <li key={i}>• {issue.message}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </SectionCard>
              )}

              {/* Live Preview (now a distinct step, not inline during editing) */}
              <SectionCard title="Document Preview">
                <div className="p-6">
                  <DocumentPreview
                    documentType={handler.formConfig.totalsCardType}
                    documentNumber={document?.invoice_number ?? document?.quote_number ?? document?.credit_note_number ?? document?.debit_note_number ?? document?.payment_voucher_number}
                    calcResult={calcResult}
                    business={business}
                    issueDate={state.issueDate}
                    dueDate={state.dueDate}
                    expiryDate={state.expiryDate}
                    poNumber={state.poNumber}
                    customerId={state.customerId}
                    customers={customers}
                    paymentInstructions={handler.formConfig.isPaymentVoucher ? undefined : state.paymentInstructions}
                    notes={state.notes}
                    terms={state.terms}
                    scopeOfWork={state.scopeOfWork}
                    signedAmounts={handler.formConfig.isCreditNote}
                    reason={handler.formConfig.showsReasonField ? state.reason : undefined}
                    customReason={handler.formConfig.showsReasonField ? state.customReason : undefined}
                    referenceInvoiceNumber={handler.formConfig.showsReferenceInvoice ? state.referenceInvoiceNumber : undefined}
                    shippingDescription={handler.formConfig.showsShippingFields ? state.shippingDescription : undefined}
                    shippingAmount={handler.formConfig.showsShippingFields ? state.shippingAmount : undefined}
                    shippingTaxRate={handler.formConfig.showsShippingFields ? state.shippingTaxRate : undefined}
                    status={document?.status}
                    paymentState={document?.payment_state ?? null}
                    voucherDate={handler.formConfig.isPaymentVoucher ? (state.voucherDate ?? state.issueDate) : undefined}
                    payeeName={handler.formConfig.isPaymentVoucher ? state.payeeName : undefined}
                    payeeEmail={handler.formConfig.isPaymentVoucher ? state.payeeEmail : undefined}
                    payeePhone={handler.formConfig.isPaymentVoucher ? state.payeePhone : undefined}
                    referenceNumber={handler.formConfig.isPaymentVoucher ? state.referenceNumber : undefined}
                    paymentMethod={handler.formConfig.isPaymentVoucher ? state.paymentMethod : undefined}
                    paymentProvider={handler.formConfig.isPaymentVoucher ? state.paymentProvider : undefined}
                  />
                </div>
              </SectionCard>
            </div>
          </div>
        )}

      <Dialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        title={`Send ${docTypeLabelFn}`}
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
            placeholder={`${docTypeLabelFn} #${document?.invoice_number ?? document?.quote_number ?? document?.credit_note_number ?? ""}`}
            value={sendData.subject}
            onChange={(e) => setSendData((prev) => ({ ...prev, subject: e.target.value }))}
          />
          <FormTextareaField
            label="Message"
            placeholder={`Hi, please find your ${docTypeLabelFn(docType).toLowerCase()} attached.`}
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
        title={`Review & Send — ${docTypeLabelFn}`}
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

      <ItemEntryDrawer
        open={itemDrawerOpen}
        onClose={() => setItemDrawerOpen(false)}
        item={null}
        onSave={(item) => {
          setState((prev) => ({
            ...prev,
            items: [...prev.items, item],
          }));
          setItemDrawerOpen(false);
        }}
        taxRateOptions={taxRateOptions}
        products={products}
      />
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

