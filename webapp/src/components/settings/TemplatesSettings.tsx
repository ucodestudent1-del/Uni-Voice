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
    return <div className="text-sm text-secondary">Loading templates…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Templates</h2>
        <p className="text-sm text-secondary mt-1">
          Manage your invoice templates — set defaults, edit layouts, and organize your template
          library.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-semibold text-primary">Your Templates</h3>
        </div>
        <button
          onClick={() => window.location.href = "/app/templates"}
          className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          Manage Templates
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-color-subtle bg-surface p-8 text-center">
          <div className="text-tertiary text-3xl mb-2">📄</div>
          <h3 className="font-semibold text-primary">No templates yet</h3>
          <p className="text-sm text-secondary mt-1">
            Create templates in the Templates section to customize your invoice design.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-color-subtle bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-primary">{t.name}</h4>
                  <p className="text-xs text-secondary mt-1">Revision {t.revision}, v{t.version}</p>
                </div>
                {t.isDefault && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary-bg text-primary-brand">
                    Default
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => window.location.href = `/app/templates`}
                  className="w-full rounded-lg border border-input-border px-3 py-1.5 text-sm text-secondary hover:bg-surface-alt"
                >
                  Edit
                </button>
                {!t.isDefault && (
                  <button
                    onClick={() => setAsDefault(t.id)}
                    disabled={settingDefault === t.id}
                    className="w-full rounded-lg border border-input-border px-3 py-1.5 text-sm text-secondary hover:bg-surface-alt disabled:opacity-50"
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





