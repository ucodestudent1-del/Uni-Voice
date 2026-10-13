import { useState, useEffect } from "react";
import { generateBrandingPreview, type ApiBrandingInput } from "@/api/client";
import { useToast } from "@/components/ui/ToastProvider";
import { Loader2 } from "lucide-react";

interface BrandingPreviewProps {
  input: ApiBrandingInput;
}

export default function BrandingPreview({ input }: BrandingPreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (Object.keys(input).length > 0) {
      generatePreview();
    }
  }, [input]);

  async function generatePreview() {
    setLoading(true);
    setError(null);
    try {
      const data = await generateBrandingPreview(input);
      setHtml(data.html);
    } catch {
      setError("Failed to generate preview");
      toast("Preview generation failed", { type: "error" });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 border border-color-subtle rounded-lg bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 border border-color-subtle rounded-lg bg-surface">
        <p className="text-error-text">{error}</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex items-center justify-center h-64 border border-color-subtle rounded-lg bg-surface">
        <p className="text-tertiary">No preview available</p>
      </div>
    );
  }

  return (
    <div className="border border-color-subtle rounded-lg overflow-hidden">
      <iframe
        title="Branding Preview"
        srcDoc={html}
        className="w-full h-80"
        sandbox="allow-same-origin"
      />
    </div>
  );
}
