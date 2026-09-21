import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { EditorProvider, useEditor } from "../document-model/editor/EditorContext";
import {
  InvoiceDocument,
  initializeRegistry,
} from "../document-model";
import { getPresetTemplate, PROFESSIONAL_PRESET } from "../document-model/templates/preset-templates";
import {
  getInvoiceTemplate,
  createInvoiceTemplate,
  updateInvoiceTemplate,
  publishInvoiceTemplate,
  archiveInvoiceTemplate,
  unarchiveInvoiceTemplate,
  deleteInvoiceTemplate,
  setDefaultInvoiceTemplate,
  getBusiness,
} from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import type { ApiBusiness, InvoiceTemplateDTO } from "../types/api";
import TemplatePreview from "../components/TemplatePreview";
import TemplateCustomizationPanel from "../components/TemplateCustomizationPanel";
import DocumentTemplateGallery from "../components/DocumentTemplateGallery";
import { formatDate } from "../utils/format";

interface TemplateEditorInnerProps {
  existingTemplate: InvoiceTemplateDTO | null;
  isNew: boolean;
  templateId?: string;
  onNavigateBack: () => void;
}

function TemplateEditorInner({ existingTemplate, isNew, templateId, onNavigateBack }: TemplateEditorInnerProps) {
  const navigate = useNavigate();
  const {
    document: doc,
    markSaved,
    dirty,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useEditor();

  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");

  const [templateName, setTemplateName] = useState(existingTemplate?.name || "");
  const [templateDescription, setTemplateDescription] = useState(existingTemplate?.description || "");
  const [templateIndustry, setTemplateIndustry] = useState(existingTemplate?.industry || "");
  const [documentType, setDocumentType] = useState<InvoiceTemplateDTO["documentType"]>(existingTemplate?.documentType || "invoice");
  const [lifecycle, setLifecycle] = useState<InvoiceTemplateDTO["lifecycle"]>(existingTemplate?.lifecycle || "draft");

  useEffect(() => {
    if (existingTemplate) {
      markSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getBusiness()
      .then((d) => {
        const b = d.business as ApiBusiness;
        setBusiness(b);
        if (b?.logo_url) setLogoUrl(b.logo_url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (dirty) setSaveState("unsaved");
  }, [dirty]);

  const saveStateLabel = {
    saved: "Saved",
    saving: "Saving...",
    unsaved: "Unsaved changes",
    error: "Save failed",
  }[saveState];

  const businessOverride = useMemo(() => {
    if (!business) return null;
    const addressParts = [
      business.address_line_1,
      business.address_line_2,
      [business.city, business.state_or_region, business.postal_code].filter(Boolean).join(", "),
      business.country_code,
    ].filter(Boolean);
    return {
      ...business,
      address: addressParts.join("\n"),
      logo_url: logoUrl ?? business.logo_url,
    };
  }, [business, logoUrl]);

  const handleSave = useCallback(async () => {
    if (!templateName.trim()) return;
    setSaveState("saving");
    try {
      const payload: any = {
        name: templateName,
        description: templateDescription || null,
        industry: templateIndustry || null,
        documentType,
        document: doc,
      };
      if (isNew) {
        const data = await createInvoiceTemplate(payload);
        setLifecycle(data.template.lifecycle);
        markSaved();
        setSaveState("saved");
        if (data.template.id) {
          navigate(`/app/templates/${data.template.id}/edit`, { replace: true });
        }
      } else {
        const data = await updateInvoiceTemplate(templateId!, payload);
        setLifecycle(data.template.lifecycle);
        setSaveState("saved");
      }
      markSaved();
    } catch {
      setSaveState("error");
    }
  }, [doc, templateName, templateDescription, templateIndustry, documentType, isNew, templateId, markSaved, navigate]);

  const handlePublish = useCallback(async () => {
    if (!templateId) return;
    try {
      await publishInvoiceTemplate(templateId);
      setLifecycle("published");
    } catch {
      // stay in draft
    }
  }, [templateId]);

  const handleArchive = useCallback(async () => {
    if (!templateId) return;
    try {
      await archiveInvoiceTemplate(templateId);
      setLifecycle("archived");
    } catch {
      // stay as-is
    }
  }, [templateId]);

  const handleUnarchive = useCallback(async () => {
    if (!templateId) return;
    try {
      await unarchiveInvoiceTemplate(templateId);
      setLifecycle("draft");
    } catch {
      // stay as-is
    }
  }, [templateId]);

  const handleSetDefault = useCallback(async () => {
    if (!templateId) return;
    try {
      await setDefaultInvoiceTemplate(templateId);
    } catch {
      // ignore
    }
  }, [templateId]);

  const handleDelete = useCallback(async () => {
    if (!templateId) return;
    if (!confirm("Delete this template? This action cannot be undone.")) return;
    try {
      await deleteInvoiceTemplate(templateId);
      onNavigateBack();
    } catch {
      // ignore
    }
  }, [templateId, onNavigateBack]);

  const lifecycleBadge = {
    draft: { bg: "status-warning-bg", text: "status-warning-text", label: "Draft" },
    published: { bg: "status-success-bg", text: "status-success-text", label: "Published" },
    archived: { bg: "bg-surface-alt", text: "text-primary", label: "Archived" },
  }[lifecycle];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-color-subtle">
        <div className="flex items-center gap-4">
          <button
            onClick={onNavigateBack}
            className="text-secondary hover:text-secondary text-sm"
          >
            &larr; Back to Templates
          </button>
          <div className="border-l border-color-subtle pl-4">
            <input
              type="text"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                setSaveState("unsaved");
              }}
              className="text-xl font-semibold text-primary border-none outline-none bg-transparent focus:ring-0"
              placeholder="Template name"
            />
             <input
               type="text"
               value={templateDescription}
               onChange={(e) => {
                 setTemplateDescription(e.target.value);
                 setSaveState("unsaved");
               }}
               className="mt-0.5 text-sm text-secondary border-none outline-none bg-transparent focus:ring-0"
               placeholder="Description (optional)"
             />
           </div>
         </div>
         <div className="flex items-center gap-2 text-xs text-secondary">
           <label className="text-secondary">For:</label>
           <select
             value={documentType}
             onChange={(e) => {
               setDocumentType(e.target.value as InvoiceTemplateDTO["documentType"]);
               setSaveState("unsaved");
             }}
             className="border border-input-border rounded px-2 py-0.5 bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
           >
             <option value="invoice">Invoice</option>
             <option value="quote">Estimate / Quote</option>
             <option value="recurring_invoice">Recurring Invoice</option>
           </select>
         </div>
        <div className="flex items-center gap-3">
          {existingTemplate && (
            <>
              <span className="text-xs text-tertiary">Last modified: {formatDate(existingTemplate.updatedAt)}</span>
              {!existingTemplate.isDefault && (
                <button
                  onClick={handleSetDefault}
                  className="text-xs text-secondary hover:text-primary underline"
                  title="Set as default template"
                >
                  Set Default
                </button>
              )}
              {lifecycle === "draft" && (
                <button
                  onClick={handlePublish}
                  disabled={!templateName.trim()}
                  className="text-xs text-primary-brand hover:text-primary-brand underline disabled:opacity-50"
                >
                  Publish
                </button>
              )}
              {lifecycle === "published" && (
                <button
                  onClick={handleArchive}
                  className="text-xs text-secondary hover:text-primary underline"
                >
                  Archive
                </button>
              )}
              {lifecycle === "archived" && (
                <button
                  onClick={handleUnarchive}
                  className="text-xs text-primary-brand hover:text-primary-brand underline"
                >
                  Unarchive
                </button>
              )}
              <button
                onClick={handleDelete}
                className="text-xs status-error-text hover:status-error-text underline"
                title="Delete template"
              >
                Delete
              </button>
            </>
          )}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="rounded-lg border border-input-border px-2.5 py-1.5 text-sm text-secondary hover:bg-surface-alt disabled:opacity-50"
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="rounded-lg border border-input-border px-2.5 py-1.5 text-sm text-secondary hover:bg-surface-alt disabled:opacity-50"
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${lifecycleBadge.bg} ${lifecycleBadge.text}`}>
            {lifecycleBadge.label}
          </span>
          <span className={`text-xs ${saveState === "saved" ? "status-success-text" : saveState === "saving" ? "status-info-text" : saveState === "error" ? "status-error-text" : "status-warning-text"}`}>
            {saveStateLabel}
          </span>
          <button
            onClick={handleSave}
            disabled={saveState === "saving" || !dirty}
            className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-[340px_1fr] gap-4 overflow-hidden">
        <div className="overflow-y-auto border-r border-color-subtle">
          <TemplateCustomizationPanel
            businessLogoUrl={logoUrl}
            onLogoUrlChange={setLogoUrl}
          />
        </div>
        <div className="overflow-auto bg-surface-alt p-6">
          <div className="max-w-4xl mx-auto">
            <TemplatePreview
              document={doc}
              business={businessOverride ?? undefined}
              className="border border-color-subtle rounded-xl shadow-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const isNew = !id;
  const presetKey = isNew ? (searchParams.get("preset") || null) : null;

  const [initialDocument, setInitialDocument] = useState<InvoiceDocument | null>(null);
  const [loadedTemplate, setLoadedTemplate] = useState<InvoiceTemplateDTO | null>(null);
  const [loading, setLoading] = useState(isNew ? (presetKey ? false : false) : true);

  useEffect(() => {
    initializeRegistry();

    if (isNew && !presetKey) {
      setLoading(false);
      return;
    }

    if (isNew && presetKey) {
      const preset = getPresetTemplate(presetKey) || PROFESSIONAL_PRESET;
      const businessId = user?.businessId || "local";
      const doc = preset.build(businessId);
      setInitialDocument(doc);
       setLoadedTemplate({
         id: "",
         businessId: businessId,
         name: preset.metadata.name,
         description: preset.metadata.description,
         industry: preset.metadata.industry ?? null,
         documentType: "invoice",
         schemaVersion: "1.0",
        revision: 1,
        version: doc.version,
        document: doc,
        htmlTemplate: null,
        config: {},
        isDefault: false,
        isActive: true,
        lifecycle: "draft",
        publishedAt: null,
        archivedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: null,
        updatedBy: null,
      } as unknown as InvoiceTemplateDTO);
      setLoading(false);
      return;
    }

    if (id) {
      getInvoiceTemplate(id)
        .then((data) => {
          setLoadedTemplate(data.template as unknown as InvoiceTemplateDTO);
          setInitialDocument(data.template.document as unknown as InvoiceDocument);
        })
        .catch(() => {
          navigate("/app/templates");
        })
        .finally(() => setLoading(false));
    }
  }, [id, presetKey, isNew, user?.businessId]);

  if (isNew && !presetKey) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-surface-alt p-6">
        <DocumentTemplateGallery
          onSelect={(key) => {
            const url = new URL(window.location.href);
            url.searchParams.set("preset", key);
            navigate(url.pathname + url.search);
          }}
        />
      </div>
    );
  }

  if (loading || !initialDocument) {
    return <div className="text-center py-20 text-secondary">Loading template...</div>;
  }

  return (
    <EditorProvider
      initialDocument={initialDocument}
      onDocumentChange={() => {}}
      autosaveDelayMs={2000}
    >
      <TemplateEditorInner
        existingTemplate={loadedTemplate}
        isNew={isNew}
        templateId={id}
        onNavigateBack={() => navigate("/app/templates")}
      />
    </EditorProvider>
  );
}





