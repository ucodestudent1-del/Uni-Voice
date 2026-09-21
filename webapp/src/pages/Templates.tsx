import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getInvoiceTemplates,
  duplicateInvoiceTemplate,
  setDefaultInvoiceTemplate,
  deleteInvoiceTemplate,
  publishInvoiceTemplate,
  archiveInvoiceTemplate,
  unarchiveInvoiceTemplate,
  getBusiness,
} from "../api/client";
import { Plus, Trash2, Archive, Copy, MousePointerClick, Settings2 } from "lucide-react";
import { initializeRegistry, type InvoiceDocument } from "../document-model";
import TemplatePreview from "../components/TemplatePreview";
import DocumentTemplateGallery from "../components/DocumentTemplateGallery";
import type { ApiBusiness, InvoiceTemplateDTO } from "../types/api";
import { Button } from "../components/ui/Button";

interface PresetChoiceState {
  isOpen: boolean;
}

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<InvoiceTemplateDTO[]>([]);
  const [business, setBusiness] = useState<ApiBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPresetGallery, setShowPresetGallery] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [documentTypeFilter, setDocumentTypeFilter] = useState("");

  useEffect(() => {
    initializeRegistry();
    loadTemplates();
    getBusiness().then((d) => setBusiness(d.business)).catch(() => {});
  }, []);

   async function loadTemplates(documentType?: string) {
     try {
       const data = await getInvoiceTemplates({ limit: 50, documentType: documentType || undefined });
       setTemplates(data.templates ?? []);
     } catch {
       setTemplates([]);
     } finally {
       setLoading(false);
     }
   }

  const handlePresetSelect = useCallback((key: string) => {
    navigate(`/app/templates/new?preset=${key}`);
  }, [navigate]);

  async function handleDuplicate(id: string) {
    setActionLoading(`dup-${id}`);
    try {
      await duplicateInvoiceTemplate(id);
      loadTemplates();
    } catch {}
    setActionLoading(null);
  }

  async function handleSetDefault(id: string) {
    setActionLoading(`default-${id}`);
    try {
      await setDefaultInvoiceTemplate(id);
      loadTemplates();
    } catch {}
    setActionLoading(null);
  }

  async function handleLifecycle(id: string, current: InvoiceTemplateDTO["lifecycle"]) {
    setActionLoading(`lc-${id}`);
    try {
      if (current === "draft" || current === "archived") {
        await publishInvoiceTemplate(id);
      } else if (current === "published") {
        await archiveInvoiceTemplate(id);
      } else if (current === "archived") {
        await unarchiveInvoiceTemplate(id);
      }
      loadTemplates();
    } catch {}
    setActionLoading(null);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    setActionLoading(`del-${id}`);
    try {
      await deleteInvoiceTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {}
    setActionLoading(null);
  }

  const LIFECYCLE_BADGE = {
    draft: { bg: "status-warning-bg", text: "status-warning-text", label: "Draft" },
    published: { bg: "status-success-bg", text: "status-success-text", label: "Live" },
    archived: { bg: "bg-surface-alt", text: "text-primary", label: "Archived" },
  };

  const DOCUMENT_TYPE_LABEL: Record<string, string> = {
    invoice: "Invoice",
    quote: "Quote",
    recurring_invoice: "Recurring",
  };

  if (loading) {
    return <div className="text-center py-20 text-secondary">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-inverse">Templates</h1>
          <p className="mt-1 text-sm text-secondary text-tertiary">
            Choose a preset to get started or customize an existing template.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowPresetGallery(true)}
        >
          New Template
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={documentTypeFilter}
          onChange={(e) => {
            setDocumentTypeFilter(e.target.value);
            loadTemplates(e.target.value);
          }}
          className="text-xs border border-input-border rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All document types</option>
          <option value="invoice">Invoice</option>
          <option value="quote">Quote</option>
          <option value="recurring_invoice">Recurring Invoice</option>
        </select>
      </div>

      {templates.length === 0 && !showPresetGallery && (
        <div className="text-center py-16 bg-surface-alt dark:bg-surface-alt rounded-xl border border-color-subtle border-color">
          <p className="text-tertiary text-tertiary mb-4">No templates yet</p>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowPresetGallery(true)}
        >
          Create from preset
        </Button>
        </div>
      )}

      {templates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t) => {
            const badge = LIFECYCLE_BADGE[t.lifecycle] || LIFECYCLE_BADGE.draft;
            const isDefault = t.isDefault;
            return (
              <div
                key={t.id}
                className="bg-surface rounded-xl border border-color-subtle shadow-sm overflow-hidden group transition-shadow hover:shadow-md"
              >
                <div className="relative">
                  <div className="h-40 overflow-hidden">
                    <TemplatePreview
                      document={t.document as unknown as InvoiceDocument}
                      business={business ? { ...business, logo_url: business?.logo_url || undefined } : undefined}
                      compact
                      className="h-full"
                    />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    {isDefault && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary-bg text-primary-brand">
                        Default
                      </span>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-primary">{t.name}</h3>
                  {t.description && <p className="mt-1 text-sm text-secondary line-clamp-2">{t.description}</p>}
                  {t.industry && (
                    <span className="mt-2 inline-block text-xs bg-surface-alt text-secondary px-2 py-0.5 rounded">
                      {t.industry}
                    </span>
                  )}
                  {t.documentType && (
                    <span className="mt-2 inline-block text-xs status-info-bg status-info-text px-2 py-0.5 rounded">
                      {DOCUMENT_TYPE_LABEL[t.documentType] ?? t.documentType}
                    </span>
                  )}

                   <div className="mt-4 flex items-center justify-between text-xs text-secondary">
                     <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1">
                        {t.lifecycle === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<MousePointerClick className="w-3.5 h-3.5" />}
                            onClick={() => handleLifecycle(t.id, t.lifecycle)}
                            disabled={actionLoading === `lc-${t.id}`}
                            title="Publish"
                          />
                        )}
                        {t.lifecycle === "published" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Archive className="w-3.5 h-3.5" />}
                            onClick={() => handleLifecycle(t.id, t.lifecycle)}
                            disabled={actionLoading === `lc-${t.id}`}
                            title="Archive"
                          />
                        )}
                        {!isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Settings2 className="w-3.5 h-3.5" />}
                            onClick={() => handleSetDefault(t.id)}
                            disabled={actionLoading === `default-${t.id}`}
                            title="Set as default"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Copy className="w-3.5 h-3.5" />}
                          onClick={() => handleDuplicate(t.id)}
                          disabled={actionLoading === `dup-${t.id}`}
                          title="Duplicate"
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => handleDelete(t.id, t.name)}
                          disabled={actionLoading === `del-${t.id}`}
                          title="Delete"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <Link
                        to={`/app/templates/${t.id}/edit`}
                        className="text-xs font-medium text-primary-brand hover:text-primary-brand"
                      >
                        Edit template →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showPresetGallery && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] overflow-y-auto">
              <div className="p-6 border-b border-color-subtle flex items-center justify-between">
                <h2 className="text-xl font-semibold text-primary">Choose a starting template</h2>
                <button
                  onClick={() => setShowPresetGallery(false)}
                  className="text-tertiary hover:text-secondary text-tertiary dark:hover:text-tertiary"
                >
                  ✕
                </button>
            </div>
            <div className="p-6">
              <DocumentTemplateGallery onSelect={handlePresetSelect} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






