import { useState, useEffect } from "react";
import { Button, FormField, FormTextareaField } from "@/components/ui";
import { getBranding, updateBranding, generateBrandingPreview, type ApiBranding, type ApiBrandingInput } from "@/api/client";
import { useToast } from "@/components/ui/ToastProvider";
import { Save, Undo2 } from "lucide-react";

interface BrandingEditorProps {
  onBrandingChange?: (branding: ApiBranding) => void;
}

export default function BrandingEditor({ onBrandingChange }: BrandingEditorProps) {
  const [branding, setBranding] = useState<ApiBranding | null>(null);
  const [draft, setDraft] = useState<ApiBrandingInput>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadBranding();
  }, []);

  useEffect(() => {
    if (draft && Object.keys(draft).length > 0) {
      const timer = setTimeout(() => {
        generatePreview();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [draft]);

  async function loadBranding() {
    try {
      const data = await getBranding();
      setBranding(data.branding);
      setDraft({
        primaryColor: data.branding.primaryColor,
        secondaryColor: data.branding.secondaryColor,
        fontFamily: data.branding.fontFamily,
        logoUrl: data.branding.logoUrl,
        logoWidthPx: data.branding.logoWidthPx,
        logoHeightPx: data.branding.logoHeightPx,
        invoiceTitle: data.branding.invoiceTitle,
        invoiceSubtitle: data.branding.invoiceSubtitle,
        footerText: data.branding.footerText,
        showLogo: data.branding.showLogo,
        showPageNumbers: data.branding.showPageNumbers,
        showQrCode: data.branding.showQrCode,
        pdfPageSize: data.branding.pdfPageSize,
        pdfMarginTopMm: data.branding.pdfMarginTopMm,
        pdfMarginRightMm: data.branding.pdfMarginRightMm,
        pdfMarginBottomMm: data.branding.pdfMarginBottomMm,
        pdfMarginLeftMm: data.branding.pdfMarginLeftMm,
      });
      onBrandingChange?.(data.branding);
    } catch {
      toast("Failed to load branding", { type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function saveBranding() {
    setSaving(true);
    try {
      const data = await updateBranding(draft);
      setBranding(data.branding);
      onBrandingChange?.(data.branding);
      toast("Branding saved", { type: "success" });
    } catch {
      toast("Failed to save branding", { type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function generatePreview() {
    try {
      const data = await generateBrandingPreview(draft);
      setPreviewHtml(data.html);
    } catch {
      toast("Failed to generate preview", { type: "error" });
    }
  }

  function updateDraft(patch: ApiBrandingInput) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  if (loading) {
    return <div className="p-4 text-secondary">Loading branding...</div>;
  }

  if (!branding) {
    return <div className="p-4 text-tertiary">No branding data available</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Primary Color"
          value={draft.primaryColor ?? ""}
          onChange={(e) => updateDraft({ primaryColor: e.target.value })}
          placeholder="#2563eb"
        />
        <FormField
          label="Secondary Color"
          value={draft.secondaryColor ?? ""}
          onChange={(e) => updateDraft({ secondaryColor: e.target.value })}
          placeholder="#ea5804"
        />
      </div>

      <FormField
        label="Font Family"
        value={draft.fontFamily ?? ""}
        onChange={(e) => updateDraft({ fontFamily: e.target.value || null })}
        placeholder="e.g. Inter, Roboto, sans-serif"
      />

      <FormField
        label="Logo URL"
        value={draft.logoUrl ?? ""}
        onChange={(e) => updateDraft({ logoUrl: e.target.value || null })}
        placeholder="https://example.com/logo.png"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Logo Width (px)"
          type="number"
          value={draft.logoWidthPx?.toString() ?? ""}
          onChange={(e) =>
            updateDraft({ logoWidthPx: e.target.value ? parseInt(e.target.value) : null })
          }
          placeholder="Auto"
        />
        <FormField
          label="Logo Height (px)"
          type="number"
          value={draft.logoHeightPx?.toString() ?? ""}
          onChange={(e) =>
            updateDraft({ logoHeightPx: e.target.value ? parseInt(e.target.value) : null })
          }
          placeholder="Auto"
        />
      </div>

      <FormField
        label="Invoice Title"
        value={draft.invoiceTitle ?? ""}
        onChange={(e) => updateDraft({ invoiceTitle: e.target.value || null })}
        placeholder="Invoice"
      />

      <FormField
        label="Invoice Subtitle"
        value={draft.invoiceSubtitle ?? ""}
        onChange={(e) => updateDraft({ invoiceSubtitle: e.target.value || null })}
        placeholder="Custom subtitle"
      />

      <FormTextareaField
        label="Footer Text"
        value={draft.footerText ?? ""}
        onChange={(e) => updateDraft({ footerText: e.target.value || null })}
        placeholder="Enter footer text..."
      />

      <div className="space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.showLogo ?? true}
            onChange={(e) => updateDraft({ showLogo: e.target.checked })}
            className="rounded border-input-border"
          />
          <span className="text-sm text-secondary">Show logo on invoices</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.showPageNumbers ?? true}
            onChange={(e) => updateDraft({ showPageNumbers: e.target.checked })}
            className="rounded border-input-border"
          />
          <span className="text-sm text-secondary">Show page numbers</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.showQrCode ?? false}
            onChange={(e) => updateDraft({ showQrCode: e.target.checked })}
            className="rounded border-input-border"
          />
          <span className="text-sm text-secondary">Show QR code on invoices</span>
        </label>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-secondary">PDF Page Size</span>
          <select
            className="form-control mt-1 w-full"
            value={draft.pdfPageSize ?? "A4"}
            onChange={(e) => updateDraft({ pdfPageSize: e.target.value })}
          >
            <option value="A4">A4 (210mm x 297mm)</option>
            <option value="A3">A3 (297mm x 420mm)</option>
            <option value="Letter">US Letter (8.5" x 11")</option>
            <option value="Legal">US Legal (8.5" x 14")</option>
          </select>
        </label>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField
            label="Top (mm)"
            type="number"
            value={draft.pdfMarginTopMm?.toString() ?? "24"}
            onChange={(e) => updateDraft({ pdfMarginTopMm: parseInt(e.target.value) || 24 })}
          />
          <FormField
            label="Right (mm)"
            type="number"
            value={draft.pdfMarginRightMm?.toString() ?? "24"}
            onChange={(e) => updateDraft({ pdfMarginRightMm: parseInt(e.target.value) || 24 })}
          />
          <FormField
            label="Bottom (mm)"
            type="number"
            value={draft.pdfMarginBottomMm?.toString() ?? "24"}
            onChange={(e) => updateDraft({ pdfMarginBottomMm: parseInt(e.target.value) || 24 })}
          />
          <FormField
            label="Left (mm)"
            type="number"
            value={draft.pdfMarginLeftMm?.toString() ?? "24"}
            onChange={(e) => updateDraft({ pdfMarginLeftMm: parseInt(e.target.value) || 24 })}
          />
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t border-color-subtle">
        <Button variant="ghost" onClick={() => setDraft({})}>
          <Undo2 className="w-4 h-4 mr-2" />
          Reset
        </Button>
        <Button variant="primary" onClick={saveBranding} loading={saving}>
          <Save className="w-4 h-4 mr-2" />
          Save Branding
        </Button>
      </div>

      {previewHtml && (
        <div className="border border-color-subtle rounded-lg p-4">
          <h4 className="text-sm font-medium text-secondary mb-2">Preview</h4>
          <iframe
            title="Branding Preview"
            srcDoc={previewHtml}
            className="w-full h-64 border rounded"
          />
        </div>
      )}
    </div>
  );
}
