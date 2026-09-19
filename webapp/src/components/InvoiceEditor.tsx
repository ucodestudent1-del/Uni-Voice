import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getInvoice, createInvoice, updateInvoice, setInvoiceItems, setInvoiceFees,
  finalizeInvoice, sendInvoice, getInvoicePdf, getCustomers, getBusiness, getProducts
} from "../api/client";
import { calculationEngine, type LineItemInput, type FeeInput, type InvoiceCalculationInput } from "../utils/calculation";
import { formatCurrency } from "../utils/format";
import { SUPPORTED_CURRENCIES } from "../utils/currency";

import {
  InvoiceDocument,
  ComponentId,
  ComponentType,
  ParentId,
  StyleProps,
  createEmptyDocument,
} from "../document-model";
import { EditorProvider, useEditor } from "../document-model/editor/EditorContext";
import { DocumentEditor, PALETTE_DRAGGABLE_ID_PREFIX } from "../document-model/editor/DocumentEditor";
import PropertyInspector from "../document-model/editor/PropertyInspector";

import { invoiceToDocument, getDefaultDocument, documentToInvoice } from "../document-model/converter";
import { DocumentPreview } from "../document-model/DocumentPreview";
import { initializeRegistry } from "../document-model";
import { getPresetTemplate } from "../document-model/templates/preset-templates";
import {
  insertComponent,
  updateComponent,
  moveComponent,
  removeComponent,
  duplicateComponent,
  getChildren,
  findComponent,
  findComponentDeep,
  findParent,
  findSiblings,
  findSiblingsDeep,
} from "../document-model/document-operations";
import {
  getComponentDefinition,
  getAllComponentDefinitions,
  RenderContext,
} from "../document-model/registry";

import type { ApiInvoice, ApiCustomer, ApiBusiness, ApiProduct } from "../types/api";

import CustomerSelector from "./CustomerSelector";
import TaxSelector from "./TaxSelector";
import TemplateSelector from "./TemplateSelector";
import TemplateGallery from "./TemplateGallery";
import DocumentTemplateGallery from "./DocumentTemplateGallery";
import { ValidationPanel } from "./ValidationPanel";
import { OutlineEditor } from "./OutlineEditor";
import { useInvoiceValidation, type ValidationIssue } from "../hooks/useInvoiceValidation";
import { useAnalytics } from "../hooks/useAnalytics";

export interface EditorLineItem {
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
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
}

export interface EditorFee {
  description: string;
  amount: string;
  taxRate?: string;
}

interface EditorInvoiceData {
  customerId?: string;
  customer?: ApiCustomer;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  notes?: string;
  terms?: string;
  paymentInstructions?: string;
  templateId?: string;
  taxRate?: string;
  discountType?: "fixed" | "percentage";
  discountValue?: string;
  items: EditorLineItem[];
  fees: EditorFee[];
  amountPaid?: string;
  depositType?: "fixed" | "percentage" | "none";
  depositValue?: string;
  depositDueDate?: string;
}

const DEFAULT_DOCUMENT = (businessId: string): InvoiceDocument => {
  initializeRegistry();
  return getDefaultDocument(businessId);
};

function InvoiceEditorContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const {
    document: doc,
    selectedComponentId,
    setDocument,
    onSelect,
    insertComponent: doInsertComponent,
    updateComponent: doUpdateComponent,
    moveComponent: doMoveComponent,
    moveComponentTo: doMoveComponentTo,
    removeComponent: doRemoveComponent,
    setSettings,
    undo,
    redo,
    canUndo,
    canRedo,
    dirty,
    markSaved,
    saveDocument,
    enableAutosave,
    isAutosaveEnabled,
  } = useEditor();

  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendData, setSendData] = useState({ subject: "", message: "" });
  const [editorData, setEditorData] = useState<EditorInvoiceData | null>(null);
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [templateChoice, setTemplateChoice] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [outlineMode, setOutlineMode] = useState(false);
  const analytics = useAnalytics();
  const [apiValidationIssues, setApiValidationIssues] = useState<ValidationIssue[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    initializeRegistry();

    Promise.all([
      getBusiness().then((d) => setBusiness(d.business)).catch(() => {}),
      getCustomers({ limit: 100 }).then((d) => setCustomers(d.customers ?? [])).catch(() => {}),
      getProducts({ limit: 100 }).then((d) => setProducts(d.products ?? [])).catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    if (!loading && editorData) {
      enableAutosave(true, 2000);
    }
  }, [loading, editorData, enableAutosave]);

  useEffect(() => {
    if (isNew) {
      const businessId = business?.id || "local";
      const newDoc = DEFAULT_DOCUMENT(businessId);
      setDocument(newDoc);
      setSaveState("saved");
      return;
    }

    if (!id) return;

    const loadInvoice = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getInvoice(id);
        const inv: ApiInvoice = data.invoice;

        let customer: ApiCustomer | undefined;
        if (inv.customer_id) {
          const custRes = await getCustomers({ limit: 100 });
          customer = custRes.customers?.find((c: ApiCustomer) => c.id === inv.customer_id);
        }

        const newDoc = invoiceToDocument(inv, business || { id: inv.business_id, name: "Business", email: "", default_currency: inv.currency }, customer);
        setDocument(newDoc);

        setEditorData({
          customerId: inv.customer_id ?? undefined,
          customer,
          invoiceNumber: inv.invoice_number ?? undefined,
          issueDate: inv.issue_date?.split("T")[0],
          dueDate: inv.due_date?.split("T")[0],
          currency: inv.currency,
          notes: inv.notes ?? "",
          terms: inv.terms ?? "",
          paymentInstructions: inv.payment_instructions ?? "",
          templateId: inv.template_id ?? undefined,
          items: inv.items.map((it) => ({
            id: it.id,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unit_price,
            discount: it.discount,
            discountType: it.discount_type,
            taxRate: it.tax_rate,
            isTaxInclusive: it.is_tax_inclusive,
            productId: it.product_id,
            catalogName: it.catalog_name ?? null,
            catalogSku: it.catalog_sku ?? null,
            catalogTaxCategory: it.catalog_tax_category ?? null,
            catalogUnitPrice: it.catalog_unit_price ?? null,
            catalogTaxRate: it.catalog_tax_rate ?? null,
          })),
          fees: inv.fees.map((f) => ({
            description: f.description,
            amount: f.amount,
            taxRate: f.tax_rate,
          })),
          amountPaid: inv.amount_paid,
          depositType: (inv as any).deposit_type ?? "none",
          depositValue: (inv as any).deposit_value ?? "0",
          depositDueDate: (inv as any).deposit_due_date?.split("T")[0],
        });

        setSaveState("saved");
      } catch (err: any) {
        if (err.response?.status === 404) {
          setActionMessage({ type: "error", text: "Invoice not found" });
          navigate("/app/invoices");
          return;
        }
        setLoadError(err.response?.data?.error || "Could not load invoice");
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [id, isNew, business, retryKey]);

  useEffect(() => {
    if (dirty) {
      setSaveState("unsaved");
    }
  }, [dirty]);

  const calcResult = (() => {
    try {
      const items = editorData?.items || [];
      const fees = editorData?.fees || [];

      const lineItems: LineItemInput[] = items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit || "each",
        unitPrice: it.unitPrice,
        discount: it.discount && Number(it.discount) > 0
          ? { type: it.discountType ?? "fixed", value: it.discount }
          : undefined,
        taxRate: it.taxRate ?? "0",
        isTaxInclusive: it.isTaxInclusive ?? false,
      }));
      const feeInputs: FeeInput[] = fees.map((f) => ({
        description: f.description,
        amount: f.amount,
        taxRate: f.taxRate ?? "0",
      }));

      const input: InvoiceCalculationInput = {
        currency: (editorData?.currency || "USD") as any,
        lineItems,
        fees: feeInputs.length ? feeInputs : undefined,
        invoiceDiscount: (editorData?.discountType && editorData?.discountValue && Number(editorData.discountValue) > 0)
          ? { type: editorData.discountType, value: editorData.discountValue }
          : undefined,
        amountPaid: editorData?.amountPaid,
      };

      return calculationEngine.calculate(input);
    } catch {
      return null;
    }
  })();

  const totals = calcResult ? {
    subtotal: formatCurrency(calcResult.subtotal, editorData?.currency || "USD"),
    discountTotal: formatCurrency(calcResult.discountTotal, (editorData?.currency || "USD") as any),
    taxTotal: formatCurrency(calcResult.taxTotal, (editorData?.currency || "USD") as any),
    feeTotal: formatCurrency(calcResult.feeTotal, (editorData?.currency || "USD") as any),
    total: formatCurrency(calcResult.total, (editorData?.currency || "USD") as any),
    amountDue: formatCurrency(calcResult.amountDue, (editorData?.currency || "USD") as any),
    amountPaid: formatCurrency(calcResult.amountPaid, (editorData?.currency || "USD") as any),
    hasTax: !calcResult.taxTotal.isZero(),
    hasDiscount: !calcResult.discountTotal.isZero(),
    hasFees: !calcResult.feeTotal.isZero(),
    hasPaid: !calcResult.amountPaid.isZero(),
  } : null;

  const calculations = calcResult
    ? {
        subtotal: calcResult.subtotal.toFixed(),
        discountTotal: calcResult.discountTotal.toFixed(),
        taxTotal: calcResult.taxTotal.toFixed(),
        feeTotal: calcResult.feeTotal.toFixed(),
        total: calcResult.total.toFixed(),
        amountDue: calcResult.amountDue.toFixed(),
        amountPaid: calcResult.amountPaid.toFixed(),
        formatCurrency: (value: any, currency: string) => formatCurrency(new Decimal(value), currency as any),
        computeLineTotal: (item: EditorLineItem, currency: string) => {
          const qty = new Decimal(item.quantity || 1);
          const price = new Decimal(item.unitPrice || 0);
          return qty.mul(price).toFixed(2);
        },
        lineItems: calcResult.lineItems.map((li) => ({
          ...li,
          lineTotal: li.lineTotal.toFixed(),
          lineSubtotal: li.lineSubtotal.toFixed(),
          discountAmount: li.discountAmount.toFixed(),
          taxAmount: li.taxAmount.toFixed(),
        })),
        fees: calcResult.fees.map((f) => ({
          ...f,
          amount: f.amount.toFixed(),
          feeTotal: f.feeTotal.toFixed(),
          taxAmount: f.taxAmount.toFixed(),
        })),
      }
    : null;

  const renderContext: RenderContext = {
    document: doc,
    business: business || undefined,
    customer: editorData?.customer,
    invoice: {
      invoiceNumber: editorData?.invoiceNumber,
      issueDate: editorData?.issueDate,
      dueDate: editorData?.dueDate,
      currency: editorData?.currency || "USD",
      items: editorData?.items || [],
      fees: editorData?.fees || [],
      notes: editorData?.notes,
      terms: editorData?.terms,
      paymentInstructions: editorData?.paymentInstructions,
    },
    calculations,
    currency: editorData?.currency || "USD",
    locale: "en-US",
    isEditing: true,
    selectedComponentId: selectedComponentId,
    onSelect,
  };

  const validation = useInvoiceValidation({
    customerId: editorData?.customerId,
    customer: editorData?.customer,
    currency: editorData?.currency,
    issueDate: editorData?.issueDate,
    dueDate: editorData?.dueDate,
    items: editorData?.items || [],
    fees: editorData?.fees,
    notes: editorData?.notes,
    terms: editorData?.terms,
    paymentInstructions: editorData?.paymentInstructions,
  });

  const allValidationIssues = useMemo(() => {
    const merged = [...validation.issues, ...apiValidationIssues];
    const seen = new Set<string>();
    return merged.filter((issue) => {
      const key = `${issue.code}:${issue.field ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [validation.issues, apiValidationIssues]);

  const validationErrorCount = allValidationIssues.filter((i) => i.severity === "error").length;
  const validationWarningCount = allValidationIssues.filter((i) => i.severity === "warning").length;

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  const handleDuplicateComponent = (componentId: ComponentId) => {
    const newDoc = duplicateComponent(doc, { componentId });
    setDocument(newDoc);
    analytics.track("component_duplicated", { componentId });
  };

  const handleTemplateSelect = (presetKey: string) => {
    initializeRegistry();
    const preset = getPresetTemplate(presetKey);
    if (!preset) return;
    const businessId = business?.id || "local";
    const newDoc = preset.build(businessId);
    setDocument(newDoc);
    if (isNew) {
      setEditorData({
        currency: newDoc.settings.currency,
        items: [],
        fees: [],
      });
      setTemplateChoice(presetKey);
      setSaveState("saved");
    }
    setShowTemplateGallery(false);
    analytics.trackTemplateSelected({ presetKey });
  };

  async function handleSave() {
    if (!validation.isValid) {
      setShowValidation(true);
      return;
    }
    setSaveState("saving");
    try {
      if (isNew) {
        const res = await createInvoice({
          customerId: editorData?.customerId,
          currency: editorData?.currency || "USD",
          issueDate: editorData?.issueDate,
          dueDate: editorData?.dueDate,
          notes: editorData?.notes,
          terms: editorData?.terms,
          paymentInstructions: editorData?.paymentInstructions,
          templateId: editorData?.templateId,
          depositType: editorData?.depositType || "none",
          depositValue: editorData?.depositValue || "0",
          depositDueDate: editorData?.depositDueDate,
          items: (editorData?.items || []).map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unit: it.unit || "each",
            unitPrice: it.unitPrice,
            discount: it.discount,
            discountType: it.discountType,
            taxRate: it.taxRate,
            isTaxInclusive: it.isTaxInclusive,
            productId: it.productId,
            catalogName: it.catalogName,
            catalogSku: it.catalogSku,
            catalogTaxCategory: it.catalogTaxCategory,
            catalogUnitPrice: it.catalogUnitPrice,
            catalogTaxRate: it.catalogTaxRate,
          })),
          fees: editorData?.fees || [],
        });
        analytics.trackInvoiceCreated({ invoiceId: res.invoiceId });
        navigate(`/app/invoices/${res.invoiceId}/edit`);
      } else {
        await updateInvoice(id!, {
          customerId: editorData?.customerId,
          currency: editorData?.currency || "USD",
          issueDate: editorData?.issueDate,
          dueDate: editorData?.dueDate,
          notes: editorData?.notes,
          terms: editorData?.terms,
          paymentInstructions: editorData?.paymentInstructions,
          templateId: editorData?.templateId,
          depositType: editorData?.depositType || "none",
          depositValue: editorData?.depositValue || "0",
          depositDueDate: editorData?.depositDueDate,
        });
        await setInvoiceItems(id!, (editorData?.items || []).map((it) => ({
          id: it.id,
          productId: it.productId,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit || "each",
          unitPrice: it.unitPrice,
          discount: it.discount,
          discountType: it.discountType,
          taxRate: it.taxRate,
          isTaxInclusive: it.isTaxInclusive,
          catalogName: it.catalogName,
          catalogSku: it.catalogSku,
          catalogTaxCategory: it.catalogTaxCategory,
          catalogUnitPrice: it.catalogUnitPrice,
          catalogTaxRate: it.catalogTaxRate,
        })));
        await setInvoiceFees(id!, editorData?.fees || []);
        analytics.track("invoice_saved", { invoiceId: id });
      }
      markSaved();
      setSaveState("saved");
    } catch (err: any) {
      setSaveState("error");
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to save" });
    }
  }

  async function handleFinalize() {
    setApiValidationIssues([]);
    if (!validation.isValid) {
      setShowValidation(true);
      return;
    }
    const confirmed = window.confirm("Finalize this invoice? It will be assigned an invoice number and can't be edited after.");
    if (!confirmed) return;
    try {
      if (isNew) {
        await handleSave();
      }
      const currentId = id && !isNew ? id : undefined;
      if (currentId) {
        const res = await finalizeInvoice(currentId);
        analytics.track("invoice_finalized", { invoiceNumber: res.invoiceNumber });
        setActionMessage({ type: "success", text: `Invoice finalized! Number: ${res.invoiceNumber}` });
        setTimeout(() => navigate("/app/invoices"), 1500);
      }
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.code === "VALIDATION_FAILED" && data?.context?.issues) {
        setApiValidationIssues(data.context.issues);
        setShowValidation(true);
      } else {
        setActionMessage({ type: "error", text: data?.error || "Failed to finalize invoice" });
      }
    }
  }

  function handleSend() {
    if (!validation.isValid) {
      setShowValidation(true);
      return;
    }
    setShowSendDialog(true);
    const customer = editorData?.customerId ? customers.find((c) => c.id === editorData.customerId) : undefined;
    const subject = editorData?.invoiceNumber
      ? `Invoice ${editorData.invoiceNumber} from ${business?.name ?? "My Business"}`
      : `Invoice from ${business?.name ?? "My Business"}`;
    const message = `Dear ${customer?.name ?? "Valued Customer"},\n\nPlease find attached invoice ${editorData?.invoiceNumber ?? ""}. You can view and pay this invoice online using the secure link below.\n\nThank you for your business.\n\n${business?.name ?? "My Business"}`;
    setSendData({ subject, message });
  }

  async function confirmSend() {
    if (!id || isNew) return;
    try {
      await sendInvoice(id);
      setShowSendDialog(false);
      analytics.trackInvoiceSent({ invoiceId: id });
      setActionMessage({ type: "success", text: "Invoice sent successfully!" });
      setTimeout(() => navigate("/app/invoices"), 1500);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.error || "Failed to send invoice" });
    }
  }

  async function handlePdfDownload() {
    if (!id || isNew) {
      setActionMessage({ type: "info", text: "Save the invoice first" });
      return;
    }
    const blob = await getInvoicePdf(id);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${editorData?.invoiceNumber ?? id}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  const handleInsertComponent = (params: { type: ComponentType; parentId: ParentId; index: number }) => {
    const def = getComponentDefinition(params.type);
    if (!def) return;

    const newComponent = def.defaultProps
      ? { ...def.defaultProps }
      : {};

    doInsertComponent({
      type: params.type,
      parentId: params.parentId,
      index: params.index,
      props: newComponent,
      style: { ...def.defaultStyle },
    });
    analytics.trackComponentAdded({ componentType: params.type, parentId: params.parentId });
  };

  const handleUpdateComponent = (
    componentId: ComponentId,
    props: Record<string, unknown>,
    style?: Partial<StyleProps>
  ) => {
    doUpdateComponent(componentId, props, style);

    if (props.currency !== undefined) {
      setSettings({ currency: props.currency as string });
    }

    const component = findComponentDeep(doc, componentId);
    if (!component) return;

    if (component.type === "notes") {
      setEditorData((prev) => prev ? { ...prev, notes: props.content as string } : prev);
    }
    if (component.type === "terms") {
      setEditorData((prev) => prev ? { ...prev, terms: props.content as string } : prev);
    }
    if (component.type === "paymentInstructions") {
      setEditorData((prev) => prev ? { ...prev, paymentInstructions: props.content as string } : prev);
    }
    if (component.type === "invoiceNumber") {
      const invProps = props as { prefix?: string; format?: string };
      setEditorData((prev) => prev ? { ...prev, invoiceNumber: (invProps.prefix || "") + (invProps.format || "") } : prev);
    }
    if (component.type === "date") {
      const dateProps = props as { dateType?: string; customValue?: string };
      if (dateProps.dateType === "issue") {
        setEditorData((prev) => prev ? { ...prev, issueDate: dateProps.customValue as string } : prev);
      }
      if (dateProps.dateType === "due") {
        setEditorData((prev) => prev ? { ...prev, dueDate: dateProps.customValue as string } : prev);
      }
    }
  };

  const handleRemoveComponent = (componentId: ComponentId) => {
    const component = findComponentDeep(doc, componentId);
    if (component?.type === "notes") {
      setEditorData((prev) => prev ? { ...prev, notes: undefined } : prev);
    }
    if (component?.type === "terms") {
      setEditorData((prev) => prev ? { ...prev, terms: undefined } : prev);
    }
    if (component?.type === "paymentInstructions") {
      setEditorData((prev) => prev ? { ...prev, paymentInstructions: undefined } : prev);
    }

    doRemoveComponent({ componentId });
    onSelect(null);
  };

  const saveStateLabel = {
    saved: "All changes saved",
    saving: "Saving...",
    unsaved: "Unsaved changes",
    error: "Save failed",
  }[saveState];

  if (isNew && !templateChoice) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-slate-50 p-6">
        <DocumentTemplateGallery onSelect={handleTemplateSelect} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-slate-50 p-6 text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 max-w-md mx-auto">
          <h1 className="text-lg font-semibold text-red-800">Could not load invoice</h1>
          <p className="mt-2 text-sm text-red-700">{loadError}</p>
          <div className="mt-4 flex gap-3 justify-center">
            <button
              onClick={() => setRetryKey((key) => key + 1)}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Try again
            </button>
            <button
              onClick={() => navigate("/app/invoices")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to invoices
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !editorData) {
    return <div className="text-center py-20">Loading invoice...</div>;
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/app/invoices")}
            className="text-slate-500 hover:text-slate-700"
          >
            &larr; Back
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            Document Editor
          </h1>
           <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
             saveState === "saved" ? "bg-green-100 text-green-800" :
             saveState === "saving" ? "bg-blue-100 text-blue-800" :
             saveState === "error" ? "bg-red-100 text-red-800" :
             "bg-amber-100 text-amber-800"
           }`}>
             {saveStateLabel}
           </span>
           {validationErrorCount > 0 && (
             <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
               {validationErrorCount} validation error{validationErrorCount !== 1 ? "s" : ""}
             </span>
           )}
           {validationWarningCount > 0 && validationErrorCount === 0 && (
             <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
               {validationWarningCount} warning{validationWarningCount !== 1 ? "s" : ""}
             </span>
           )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="Undo (Ctrl+Z)"
          >
            &larr;
          </button>
           <button
              onClick={redo}
              disabled={!canRedo}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Redo (Ctrl+Y)"
            >
              &rarr;
            </button>
            <button
              onClick={() => setPreviewMode(previewMode === "edit" ? "preview" : "edit")}
              className={`rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${
                previewMode === "preview" ? "bg-primary-100 text-primary-700" : ""
              }`}
              title="Toggle preview"
            >
              {previewMode === "edit" ? "Preview" : "Edit"}
            </button>
            <button
              onClick={() => setShowTemplateGallery(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title="Choose template"
            >
              Gallery
            </button>
            <button
              onClick={() => setOutlineMode(!outlineMode)}
              className={`rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${
                outlineMode ? "bg-primary-100 text-primary-700" : ""
              }`}
              title="Toggle document outline"
            >
              Outline
            </button>
            <button
              onClick={() => setShowValidation(!showValidation)}
              className={`rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${
                showValidation ? "bg-primary-100 text-primary-700" : ""
              }`}
              title="Validation"
            >
              {validationErrorCount > 0 ? "⚠" : validationWarningCount > 0 ? "!" : "✓"}
            </button>
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save
            </button>
            {!editorData?.invoiceNumber && (
              <button
                onClick={handleFinalize}
                disabled={!validation.isValid}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Finalize &amp; Send
              </button>
            )}
            {editorData?.invoiceNumber && (
              <>
                <button
                  onClick={handlePdfDownload}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Download PDF
                </button>
                <button
                  onClick={handleSend}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Send
                </button>
              </>
            )}
          </div>
        </div>

        {actionMessage && (
          <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
            actionMessage.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : actionMessage.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}>
            {actionMessage.text}
          </div>
        )}

          <ValidationPanel
            issues={allValidationIssues}
            hasErrors={validationErrorCount > 0}
            hasWarnings={validationWarningCount > 0}
          />

      <div className="flex-1 grid grid-cols-[1fr_320px] gap-4 overflow-hidden bg-slate-50">
        {previewMode === "edit" ? (
          <>
            <div className="overflow-auto">
              <DocumentEditor
                document={doc}
                selectedComponentId={selectedComponentId}
                onSelect={onSelect}
                onInsertComponent={handleInsertComponent}
                onReorderComponent={(params) => {
                  doMoveComponent(params);
                }}
                onMoveComponentTo={doMoveComponentTo}
                onUpdateComponentStyle={doUpdateComponent}
                business={business}
                customer={editorData?.customer}
                invoice={{
                  invoiceNumber: editorData?.invoiceNumber,
                  issueDate: editorData?.issueDate,
                  dueDate: editorData?.dueDate,
                  currency: editorData?.currency || "USD",
                  items: editorData?.items || [],
                  fees: editorData?.fees || [],
                  notes: editorData?.notes,
                  terms: editorData?.terms,
                  paymentInstructions: editorData?.paymentInstructions,
                }}
                calculations={calculations}
                currency={editorData?.currency || "USD"}
                locale="en-US"
              />
            </div>

            {outlineMode ? (
              <OutlineEditor
                document={doc}
                selectedComponentId={selectedComponentId}
                onSelect={(id) => onSelect(id ? id as string : null)}
                onDuplicate={handleDuplicateComponent}
                onRemove={handleRemoveComponent}
              />
            ) : (
              <div className="overflow-y-auto">
                <PropertyInspector
                  componentId={selectedComponentId}
                  component={selectedComponentId ? findComponentDeep(doc, selectedComponentId) ?? findComponent(doc, selectedComponentId) ?? null : null}
                  onSelect={onSelect}
                  onUpdate={handleUpdateComponent}
                  onDelete={handleRemoveComponent}
                  onDuplicate={selectedComponentId ? handleDuplicateComponent : undefined}
                  onVisibilityToggle={(componentId) => {
                    const component = findComponentDeep(doc, componentId) ?? findComponent(doc, componentId);
                    if (!component) return;
                    doUpdateComponent(componentId, {}, { visibility: component.visible === false ? "visible" : "hidden" });
                  }}
                  document={doc}
                  business={business}
                  customer={editorData?.customer}
                  currency={editorData?.currency || "USD"}
                  locale="en-US"
                />
              </div>
            )}
          </>
        ) : (
          <div className="overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              <DocumentPreview
                document={doc}
                business={business}
                customer={editorData?.customer}
                invoice={{
                  invoiceNumber: editorData?.invoiceNumber,
                  issueDate: editorData?.issueDate,
                  dueDate: editorData?.dueDate,
                  currency: editorData?.currency || "USD",
                  items: editorData?.items || [],
                  fees: editorData?.fees || [],
                  notes: editorData?.notes,
                  terms: editorData?.terms,
                  paymentInstructions: editorData?.paymentInstructions,
                }}
                calculations={calculations}
                currency={editorData?.currency || "USD"}
                locale="en-US"
                className="border border-slate-200 rounded-xl shadow-lg"
              />
            </div>
          </div>
        )}
      </div>

      {showSendDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Send Invoice</h3>
              <p className="text-sm text-slate-500">Review before sending</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">To</label>
                <p className="text-sm text-slate-900">
                  {editorData?.customerId ? customers.find((c) => c.id === editorData.customerId)?.email ?? "No email set" : "No customer selected"}
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Subject</label>
                <input
                  type="text"
                  value={sendData.subject}
                  onChange={(e) => setSendData({ ...sendData, subject: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Message</label>
                <textarea
                  value={sendData.message}
                  onChange={(e) => setSendData({ ...sendData, message: e.target.value })}
                  rows={4}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowSendDialog(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                Send Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      <TemplateGallery
        isOpen={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        onSelect={handleTemplateSelect}
        selectedKey={editorData?.templateId}
      />
    </div>
  );
}

export default function InvoiceEditor() {
  return (
    <EditorProvider
      initialDocument={createEmptyDocument("local", "Loading...")}
      onDocumentChange={() => {}}
      autosaveDelayMs={2000}
    >
      <InvoiceEditorContent />
    </EditorProvider>
  );
}
