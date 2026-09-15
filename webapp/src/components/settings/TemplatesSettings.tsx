import { useState, useEffect } from "react";
import { getInvoiceTemplates, setDefaultInvoiceTemplate } from "../../api/client";
import type { InvoiceTemplateDTO } from "../../types/api";

export default function TemplatesSettings() {
  const [templates, setTemplates] = useState<InvoiceTemplateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getInvoiceTemplates();
        setTemplates(data.templates ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function setAsDefault(id: string) {
    setSettingDefault(id);
    try {
      await setDefaultInvoiceTemplate(id);
      setTemplates(templates.map((t) => ({ ...t, isDefault: t.id === id })));
    } catch {
      // ignore
    } finally {
      setSettingDefault(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Loading templates…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Templates</h2>
        <p className="text-sm text-slate-600 mt-1">
          Manage your invoice templates — set defaults, edit layouts, and organize your template
          library.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-semibold text-slate-900">Your Templates</h3>
        </div>
        <button
          onClick={() => window.location.href = "/app/templates"}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Manage Templates
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <div className="text-slate-400 text-3xl mb-2">📄</div>
          <h3 className="font-semibold text-slate-900">No templates yet</h3>
          <p className="text-sm text-slate-500 mt-1">
            Create templates in the Templates section to customize your invoice design.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-slate-900">{t.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">Revision {t.revision}, v{t.version}</p>
                </div>
                {t.isDefault && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800">
                    Default
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => window.location.href = `/app/templates`}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Edit
                </button>
                {!t.isDefault && (
                  <button
                    onClick={() => setAsDefault(t.id)}
                    disabled={settingDefault === t.id}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {settingDefault === t.id ? "Setting…" : "Set as Default"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
