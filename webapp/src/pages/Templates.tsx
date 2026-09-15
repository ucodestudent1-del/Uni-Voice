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
import { initializeRegistry, type InvoiceDocument } from "../document-model";
import TemplatePreview from "../components/TemplatePreview";
import DocumentTemplateGallery from "../components/DocumentTemplateGallery";
import type { ApiBusiness, InvoiceTemplateDTO } from "../types/api";

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

  useEffect(() => {
    initializeRegistry();
    loadTemplates();
    getBusiness().then((d) => setBusiness(d.business)).catch(() => {});
  }, []);

  async function loadTemplates() {
    try {
      const data = await getInvoiceTemplates({ limit: 50 });
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
    draft: { bg: "bg-amber-100", text: "text-amber-800", label: "Draft" },
    published: { bg: "bg-green-100", text: "text-green-800", label: "Live" },
    archived: { bg: "bg-slate-100", text: "text-slate-800", label: "Archived" },
  };

  if (loading) {
    return <div className="text-center py-20 text-slate-500">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose a preset to get started or customize an existing template.
          </p>
        </div>
        <button
          onClick={() => setShowPresetGallery(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <span aria-hidden="true">+</span>
          New Template
        </button>
      </div>

      {templates.length === 0 && !showPresetGallery && (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-slate-400 mb-4">No templates yet</p>
          <button
            onClick={() => setShowPresetGallery(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <span aria-hidden="true">+</span>
            Create from preset
          </button>
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
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group transition-shadow hover:shadow-md"
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
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800">
                        Default
                      </span>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-slate-900">{t.name}</h3>
                  {t.description && <p className="mt-1 text-sm text-slate-500 line-clamp-2">{t.description}</p>}
                  {t.industry && (
                    <span className="mt-2 inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {t.industry}
                    </span>
                  )}

                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1">
                      {t.lifecycle === "draft" && (
                        <button
                          onClick={() => handleLifecycle(t.id, t.lifecycle)}
                          disabled={actionLoading === `lc-${t.id}`}
                          className="text-primary-600 hover:text-primary-700 font-medium"
                          title="Publish"
                        >
                          Publish
                        </button>
                      )}
                      {t.lifecycle === "published" && (
                        <button
                          onClick={() => handleLifecycle(t.id, t.lifecycle)}
                          disabled={actionLoading === `lc-${t.id}`}
                          className="text-slate-600 hover:text-slate-900 font-medium"
                          title="Archive"
                        >
                          Archive
                        </button>
                      )}
                      {!isDefault && (
                        <button
                          onClick={() => handleSetDefault(t.id)}
                          disabled={actionLoading === `default-${t.id}`}
                          className="text-slate-600 hover:text-slate-900 font-medium"
                          title="Set as default"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(t.id)}
                        disabled={actionLoading === `dup-${t.id}`}
                        className="text-slate-600 hover:text-slate-900 font-medium"
                        title="Duplicate"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        disabled={actionLoading === `del-${t.id}`}
                        className="text-red-500 hover:text-red-700 font-medium"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-2">
                    <Link
                      to={`/app/templates/${t.id}/edit`}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Choose a starting template</h2>
              <button
                onClick={() => setShowPresetGallery(false)}
                className="text-slate-400 hover:text-slate-600"
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
