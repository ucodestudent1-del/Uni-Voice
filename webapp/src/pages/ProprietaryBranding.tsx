import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Undo2, ArrowLeft } from "lucide-react";
import { Button, FormField, FormTextareaField, Skeleton } from "@/components/ui";
import {
  getProprietaryBranding,
  updateProprietaryBranding,
  getProprietaryBrandingPreview,
} from "@/api/client";
import { useToast } from "@/components/ui/ToastProvider";
import { useMetaTags } from "@/hooks/useMetaTags";

interface BrandingDraft {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl: string;
  logoWidthPx: string;
  logoHeightPx: string;
  invoiceTitle: string;
  invoiceSubtitle: string;
  footerText: string;
  showLogo: boolean;
  showPageNumbers: boolean;
  showQrCode: boolean;
  pdfPageSize: string;
  pdfMarginTopMm: string;
  pdfMarginRightMm: string;
  pdfMarginBottomMm: string;
  pdfMarginLeftMm: string;
}

const EMPTY_DRAFT: BrandingDraft = {
  primaryColor: "#ea5804",
  secondaryColor: "#2563eb",
  fontFamily: "",
  logoUrl: "",
  logoWidthPx: "",
  logoHeightPx: "",
  invoiceTitle: "",
  invoiceSubtitle: "",
  footerText: "",
  showLogo: true,
  showPageNumbers: true,
  showQrCode: false,
  pdfPageSize: "A4",
  pdfMarginTopMm: "24",
  pdfMarginRightMm: "24",
  pdfMarginBottomMm: "24",
  pdfMarginLeftMm: "24",
};

function draftFromBranding(b: any): BrandingDraft {
  return {
    primaryColor: b.primaryColor ?? "#ea5804",
    secondaryColor: b.secondaryColor ?? "#2563eb",
    fontFamily: b.fontFamily ?? "",
    logoUrl: b.logoUrl ?? "",
    logoWidthPx: b.logoWidthPx?.toString() ?? "",
    logoHeightPx: b.logoHeightPx?.toString() ?? "",
    invoiceTitle: b.invoiceTitle ?? "",
    invoiceSubtitle: b.invoiceSubtitle ?? "",
    footerText: b.footerText ?? "",
    showLogo: b.showLogo ?? true,
    showPageNumbers: b.showPageNumbers ?? true,
    showQrCode: b.showQrCode ?? false,
    pdfPageSize: b.pdfPageSize ?? "A4",
    pdfMarginTopMm: b.pdfMarginTopMm?.toString() ?? "24",
    pdfMarginRightMm: b.pdfMarginRightMm?.toString() ?? "24",
    pdfMarginBottomMm: b.pdfMarginBottomMm?.toString() ?? "24",
    pdfMarginLeftMm: b.pdfMarginLeftMm?.toString() ?? "24",
  };
}

function draftToPayload(d: BrandingDraft) {
  return {
    primaryColor: d.primaryColor || undefined,
    secondaryColor: d.secondaryColor || undefined,
    fontFamily: d.fontFamily || null,
    logoUrl: d.logoUrl || null,
    logoWidthPx: d.logoWidthPx ? parseInt(d.logoWidthPx) : null,
    logoHeightPx: d.logoHeightPx ? parseInt(d.logoHeightPx) : null,
    invoiceTitle: d.invoiceTitle || null,
    invoiceSubtitle: d.invoiceSubtitle || null,
    footerText: d.footerText || null,
    showLogo: d.showLogo,
    showPageNumbers: d.showPageNumbers,
    showQrCode: d.showQrCode,
    pdfPageSize: d.pdfPageSize,
    pdfMarginTopMm: parseInt(d.pdfMarginTopMm) || 0,
    pdfMarginRightMm: parseInt(d.pdfMarginRightMm) || 0,
    pdfMarginBottomMm: parseInt(d.pdfMarginBottomMm) || 0,
    pdfMarginLeftMm: parseInt(d.pdfMarginLeftMm) || 0,
  };
}

export default function ProprietaryBranding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [draft, setDraft] = useState<BrandingDraft>(EMPTY_DRAFT);
  const [savedDraft, setSavedDraft] = useState<BrandingDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  useMetaTags({
    title: "Branding — DocForge",
    description: "Customize logo, colors, fonts, and PDF layout for your documents.",
    noIndex: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getProprietaryBranding();
        if (cancelled) return;
        const next = draftFromBranding(data.branding);
        setDraft(next);
        setSavedDraft(next);
      } catch (err: any) {
        toast(err?.message || "Failed to load branding.", {
          title: "Error",
          type: "error",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(async () => {
      try {
        const data = await getProprietaryBrandingPreview(draftToPayload(draft));
        setPreviewHtml(data.html);
      } catch {
        // Preview failures are non-fatal
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [draft, loading]);

  function updateDraft(patch: Partial<BrandingDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  async function saveBranding() {
    setSaving(true);
    try {
      const data = await updateProprietaryBranding(draftToPayload(draft));
      const next = draftFromBranding(data.branding);
      setDraft(next);
      setSavedDraft(next);
      toast("Branding saved.", { title: "Success", type: "success" });
    } catch (err: any) {
      toast(err?.message || "Failed to save branding.", {
        title: "Error",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Skeleton className="h-8 w-8 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">Branding</h1>
          <p className="text-sm text-secondary mt-1">
            Customize how your invoices and quotes look on PDF and public pages.
          </p>
        </div>
        <div className="flex gap-3">
          <Button size="sm" variant="ghost" onClick={() => navigate("/app/proprietary")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button size="sm" variant="primary" onClick={saveBranding} loading={saving} disabled={!isDirty}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 border rounded-lg p-4">
          <h2 className="font-medium">Colors & Fonts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Primary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={draft.primaryColor || "#ea5804"}
                  onChange={(e) => updateDraft({ primaryColor: e.target.value })}
                  className="h-10 w-12 border rounded cursor-pointer"
                />
                <FormField
                  label=""
                  value={draft.primaryColor}
                  onChange={(e) => updateDraft({ primaryColor: e.target.value })}
                  placeholder="#ea5804"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Secondary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={draft.secondaryColor || "#2563eb"}
                  onChange={(e) => updateDraft({ secondaryColor: e.target.value })}
                  className="h-10 w-12 border rounded cursor-pointer"
                />
                <FormField
                  label=""
                  value={draft.secondaryColor}
                  onChange={(e) => updateDraft({ secondaryColor: e.target.value })}
                  placeholder="#2563eb"
                />
              </div>
            </div>
          </div>

          <FormField
            label="Font Family"
            value={draft.fontFamily}
            onChange={(e) => updateDraft({ fontFamily: e.target.value })}
            placeholder="e.g. Inter, Roboto, sans-serif"
          />
        </div>

        <div className="space-y-4 border rounded-lg p-4">
          <h2 className="font-medium">Logo</h2>
          <FormField
            label="Logo URL"
            value={draft.logoUrl}
            onChange={(e) => updateDraft({ logoUrl: e.target.value })}
            placeholder="https://example.com/logo.png"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Logo Width (px)"
              type="number"
              value={draft.logoWidthPx}
              onChange={(e) => updateDraft({ logoWidthPx: e.target.value })}
              placeholder="Auto"
            />
            <FormField
              label="Logo Height (px)"
              type="number"
              value={draft.logoHeightPx}
              onChange={(e) => updateDraft({ logoHeightPx: e.target.value })}
              placeholder="Auto"
            />
          </div>
          {draft.logoUrl && (
            <div className="flex items-center gap-3">
              <img
                src={draft.logoUrl}
                alt="Logo preview"
                style={{ height: draft.logoHeightPx ? `${draft.logoHeightPx}px` : "48px", width: "auto" }}
                className="border rounded"
              />
              <span className="text-xs text-secondary">Logo preview</span>
            </div>
          )}
        </div>

        <div className="space-y-4 border rounded-lg p-4">
          <h2 className="font-medium">Document Header</h2>
          <FormField
            label="Document Title"
            value={draft.invoiceTitle}
            onChange={(e) => updateDraft({ invoiceTitle: e.target.value })}
            placeholder="Invoice"
          />
          <FormField
            label="Document Subtitle"
            value={draft.invoiceSubtitle}
            onChange={(e) => updateDraft({ invoiceSubtitle: e.target.value })}
            placeholder="Custom subtitle"
          />
          <FormTextareaField
            label="Footer Text"
            value={draft.footerText}
            onChange={(e) => updateDraft({ footerText: e.target.value })}
            placeholder="Enter footer text..."
          />
        </div>

        <div className="space-y-4 border rounded-lg p-4">
          <h2 className="font-medium">PDF Layout</h2>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showLogo}
                onChange={(e) => updateDraft({ showLogo: e.target.checked })}
                className="rounded border-input-border"
              />
              <span className="text-sm text-secondary">Show logo</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showPageNumbers}
                onChange={(e) => updateDraft({ showPageNumbers: e.target.checked })}
                className="rounded border-input-border"
              />
              <span className="text-sm text-secondary">Show page numbers</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showQrCode}
                onChange={(e) => updateDraft({ showQrCode: e.target.checked })}
                className="rounded border-input-border"
              />
              <span className="text-sm text-secondary">Show QR code</span>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-secondary">Page Size</span>
            <select
              className="form-control mt-1 w-full"
              value={draft.pdfPageSize}
              onChange={(e) => updateDraft({ pdfPageSize: e.target.value })}
            >
              <option value="A4">A4 (210mm x 297mm)</option>
              <option value="Letter">US Letter (8.5in x 11in)</option>
              <option value="Legal">US Legal (8.5in x 14in)</option>
              <option value="Tabloid">Tabloid (11in x 17in)</option>
            </select>
          </label>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FormField
              label="Top (mm)"
              type="number"
              value={draft.pdfMarginTopMm}
              onChange={(e) => updateDraft({ pdfMarginTopMm: e.target.value })}
            />
            <FormField
              label="Right (mm)"
              type="number"
              value={draft.pdfMarginRightMm}
              onChange={(e) => updateDraft({ pdfMarginRightMm: e.target.value })}
            />
            <FormField
              label="Bottom (mm)"
              type="number"
              value={draft.pdfMarginBottomMm}
              onChange={(e) => updateDraft({ pdfMarginBottomMm: e.target.value })}
            />
            <FormField
              label="Left (mm)"
              type="number"
              value={draft.pdfMarginLeftMm}
              onChange={(e) => updateDraft({ pdfMarginLeftMm: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-medium">Preview</h2>
          <Button variant="ghost" size="sm" onClick={() => setDraft(savedDraft)} disabled={!isDirty}>
            <Undo2 className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
        {previewHtml ? (
          <iframe
            title="Branding Preview"
            srcDoc={previewHtml}
            className="w-full h-96 border rounded"
          />
        ) : (
          <p className="text-sm text-secondary">Generating preview…</p>
        )}
      </div>
    </div>
  );
}
