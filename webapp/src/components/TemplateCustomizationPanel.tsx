import React, { useMemo } from "react";
import {
  InvoiceDocument,
  AnyComponent,
  ComponentType,
  ParentId,
  getChildren,
} from "../document-model";
import { useEditor } from "../document-model/editor/EditorContext";

function findComponentByType(doc: InvoiceDocument, type: ComponentType): AnyComponent | undefined {
  return Object.values(doc.components).find((c) => c.type === type);
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapseSection({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span className="text-slate-400 text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && children}
    </div>
  );
}

interface TemplateCustomizationPanelProps {
  businessLogoUrl?: string | null;
  onLogoUrlChange?: (url: string) => void;
}

export const TemplateCustomizationPanel: React.FC<TemplateCustomizationPanelProps> = ({
  businessLogoUrl,
  onLogoUrlChange,
}) => {
  const { document: doc, setSettings, updateComponent, insertComponent } = useEditor();

  const businessInfo = useMemo(() => findComponentByType(doc, "businessInfo"), [doc]);
  const customerInfo = useMemo(() => findComponentByType(doc, "customerInfo"), [doc]);
  const paymentTerms = useMemo(() => findComponentByType(doc, "paymentTerms"), [doc]);
  const notesComp = useMemo(() => findComponentByType(doc, "notes"), [doc]);
  const termsComp = useMemo(() => findComponentByType(doc, "terms"), [doc]);

  const handleSettingChange = (settings: Partial<InvoiceDocument["settings"]>) => {
    setSettings(settings);
  };

  const handleProps = (comp: AnyComponent | undefined, props: Record<string, unknown>) => {
    if (!comp) return;
    updateComponent(comp.id, props);
  };

  const handleAddComponent = (type: ComponentType, parentId: ParentId, props: Record<string, unknown>) => {
    return () => {
      const siblings = getChildren(doc, parentId);
      insertComponent({ type, parentId, index: siblings.length, props });
    };
  };

  const FONT_OPTIONS = [
    { value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", label: "System UI" },
    { value: "Georgia, serif", label: "Serif" },
    { value: "'Courier New', monospace", label: "Monospace" },
    { value: "'Helvetica Neue', Arial, sans-serif", label: "Helvetica" },
    { value: "'Times New Roman', serif", label: "Times New Roman" },
  ];

  const PAGE_SIZE_OPTIONS = [
    { value: "A4", label: "A4 (210 x 297mm)" },
    { value: "Letter", label: "US Letter (8.5 x 11in)" },
    { value: "Legal", label: "Legal (8.5 x 14in)" },
  ];

  const BI_FIELDS: { key: string; label: string }[] = [
    { key: "showName", label: "Name" },
    { key: "showEmail", label: "Email" },
    { key: "showPhone", label: "Phone" },
    { key: "showWebsite", label: "Website" },
    { key: "showAddress", label: "Address" },
    { key: "showLogo", label: "Logo" },
  ];

  const CI_FIELDS: { key: string; label: string }[] = [
    { key: "showName", label: "Name" },
    { key: "showCompany", label: "Company" },
    { key: "showEmail", label: "Email" },
    { key: "showAddress", label: "Address" },
    { key: "showPhone", label: "Phone" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-1 divide-y divide-slate-100">
        <CollapseSection title="Brand" defaultOpen={false}>
          <div className="px-4 pb-3 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={doc.settings.defaultColor}
                  onChange={(e) => handleSettingChange({ defaultColor: e.target.value })}
                  className="w-11 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={doc.settings.defaultColor}
                  onChange={(e) => handleSettingChange({ defaultColor: e.target.value })}
                  className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {businessInfo && (
              <>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean((businessInfo.props as Record<string, unknown>).showLogo)}
                    onChange={(e) => handleProps(businessInfo, { showLogo: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  Show Logo
                </label>

                {businessInfo && (businessInfo.props as Record<string, unknown>).showLogo && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL</label>
                    <input
                      type="url"
                      value={businessLogoUrl ?? ""}
                      onChange={(e) => onLogoUrlChange?.(e.target.value)}
                      placeholder="https://..."
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </CollapseSection>

        <CollapseSection title="Typography" defaultOpen={false}>
          <div className="px-4 pb-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Font Family</label>
              <select
                value={doc.settings.defaultFont}
                onChange={(e) => handleSettingChange({ defaultFont: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Font Size ({doc.settings.defaultFontSize}px)</label>
              <input
                type="range"
                min="8"
                max="24"
                value={doc.settings.defaultFontSize}
                onChange={(e) => handleSettingChange({ defaultFontSize: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </CollapseSection>

        <CollapseSection title="Page Setup" defaultOpen={false}>
          <div className="px-4 pb-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Page Size</label>
              <select
                value={doc.settings.pageSize}
                onChange={(e) => handleSettingChange({ pageSize: e.target.value as any })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PAGE_SIZE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Orientation</label>
              <select
                value={doc.settings.orientation}
                onChange={(e) => handleSettingChange({ orientation: e.target.value as any })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Top ({doc.settings.margins.top}px)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={doc.settings.margins.top}
                  onChange={(e) => handleSettingChange({ margins: { ...doc.settings.margins, top: Number(e.target.value) } })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bottom ({doc.settings.margins.bottom}px)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={doc.settings.margins.bottom}
                  onChange={(e) => handleSettingChange({ margins: { ...doc.settings.margins, bottom: Number(e.target.value) } })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Left ({doc.settings.margins.left}px)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={doc.settings.margins.left}
                  onChange={(e) => handleSettingChange({ margins: { ...doc.settings.margins, left: Number(e.target.value) } })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Right ({doc.settings.margins.right}px)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={doc.settings.margins.right}
                  onChange={(e) => handleSettingChange({ margins: { ...doc.settings.margins, right: Number(e.target.value) } })}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </CollapseSection>

        {businessInfo && (
          <CollapseSection title="Business Details" defaultOpen={false}>
            <div className="px-4 pb-3 grid grid-cols-2 gap-2">
              {BI_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean((businessInfo.props as Record<string, unknown>)[f.key])}
                    onChange={(e) => handleProps(businessInfo, { [f.key]: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </CollapseSection>
        )}

        {customerInfo && (
          <CollapseSection title="Customer Details" defaultOpen={false}>
            <div className="px-4 pb-3 grid grid-cols-2 gap-2">
              {CI_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean((customerInfo.props as Record<string, unknown>)[f.key])}
                    onChange={(e) => handleProps(customerInfo, { [f.key]: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </CollapseSection>
        )}

        <CollapseSection title="Payment Terms" defaultOpen={false}>
          <div className="px-4 pb-3 space-y-3">
            {paymentTerms ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Terms Content</label>
                <input
                  type="text"
                  value={String((paymentTerms.props as { content?: string }).content || "Net 30")}
                  onChange={(e) => handleProps(paymentTerms, { content: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAddComponent("paymentTerms", doc.rootSectionId, { content: "Net 30", label: "Payment Terms" })}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                + Add Payment Terms
              </button>
            )}
          </div>
        </CollapseSection>

        <CollapseSection title="Notes" defaultOpen={false}>
          <div className="px-4 pb-3 space-y-3">
            {notesComp ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
                  <input
                    type="text"
                    value={String((notesComp.props as { label?: string }).label || "Notes")}
                    onChange={(e) => handleProps(notesComp, { label: e.target.value || undefined })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Content</label>
                  <textarea
                    value={String((notesComp.props as { content?: string }).content || "")}
                    onChange={(e) => handleProps(notesComp, { content: e.target.value })}
                    rows={3}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={handleAddComponent("notes", doc.rootSectionId, { content: "Thank you for your business!", label: "Notes" })}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                + Add Notes Section
              </button>
            )}
          </div>
        </CollapseSection>

        <CollapseSection title="Terms" defaultOpen={false}>
          <div className="px-4 pb-3 space-y-3">
            {termsComp ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
                  <input
                    type="text"
                    value={String((termsComp.props as { label?: string }).label || "Terms")}
                    onChange={(e) => handleProps(termsComp, { label: e.target.value || undefined })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Content</label>
                  <textarea
                    value={String((termsComp.props as { content?: string }).content || "")}
                    onChange={(e) => handleProps(termsComp, { content: e.target.value })}
                    rows={3}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={handleAddComponent("terms", doc.rootSectionId, { content: "Payment due within 30 days.", label: "Terms" })}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                + Add Terms Section
              </button>
            )}
          </div>
        </CollapseSection>
      </div>
    </div>
  );
};

export default TemplateCustomizationPanel;
