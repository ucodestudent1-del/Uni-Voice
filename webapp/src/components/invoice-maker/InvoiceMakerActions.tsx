import { Download, Save, Copy } from "lucide-react";
import { Button } from "@/components/ui";
import type { SaveState } from "@/components/document";

interface InvoiceMakerActionsProps {
  saveState: SaveState;
  isSaving: boolean;
  hasSaved: boolean;
  isGeneratingPdf: boolean;
  onSaveDraft: () => void;
  onDownloadPdf: () => void;
  onDuplicate: () => void;
}

export function InvoiceMakerActions({
  saveState,
  isSaving,
  hasSaved,
  isGeneratingPdf,
  onSaveDraft,
  onDownloadPdf,
  onDuplicate,
}: InvoiceMakerActionsProps) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-color">
      <Button
        variant="primary"
        size="sm"
        icon={<Download className="h-4 w-4" />}
        onClick={onDownloadPdf}
        disabled={!hasSaved || isGeneratingPdf}
        loading={isGeneratingPdf}
      >
        Download PDF
      </Button>

      <Button
        variant="ghost"
        size="sm"
        icon={<Save className="h-4 w-4" />}
        onClick={onSaveDraft}
        loading={isSaving}
      >
        {hasSaved ? "Save Draft" : "Save as Draft"}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        icon={<Copy className="h-4 w-4" />}
        onClick={onDuplicate}
        disabled={!hasSaved}
      >
        Duplicate
      </Button>

      {saveState === "saving" && (
        <span className="text-sm text-tertiary">Saving…</span>
      )}
      {saveState === "saved" && (
        <span className="text-sm text-success">Saved</span>
      )}
      {saveState === "error" && (
        <span className="text-sm text-error">Save failed</span>
      )}
    </div>
  );
}
