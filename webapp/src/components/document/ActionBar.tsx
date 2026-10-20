import { useState } from "react";
import { Save, Send, FileText, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { PresetSelector } from "@/components/document";
import type { DocumentType, DocumentState } from "./document-types";

interface ActionBarProps {
  docType: DocumentType;
  isFinalized: boolean;
  isSaving: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  showPresetSelector: boolean;
  state: DocumentState;
  onSave: () => void;
  onFinalize: () => void;
  onSend: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onApplyPreset: (data: Record<string, unknown>) => void;
}

export function ActionBar({
  docType,
  isFinalized,
  isSaving,
  saveState,
  showPresetSelector,
  state,
  onSave,
  onFinalize,
  onSend,
  onDuplicate,
  onDelete,
  onApplyPreset,
}: ActionBarProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {!isFinalized && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Save className="h-4 w-4" />}
            onClick={onSave}
            loading={isSaving}
            type="button"
          >
            Save Draft
          </Button>
        )}

        {!isFinalized && (
          <Button
            variant="primary"
            size="sm"
            icon={<FileText className="h-4 w-4" />}
            onClick={onFinalize}
            type="button"
          >
            Finalize
          </Button>
        )}

        {isFinalized && (
          <Button
            variant="primary"
            size="sm"
            icon={<Send className="h-4 w-4" />}
            onClick={onSend}
            type="button"
          >
            Send
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {saveState === "saved" && !isSaving && (
          <span className="text-xs text-tertiary">Saved</span>
        )}

        {showPresetSelector && (
          <PresetSelector
            docType={docType}
            onApply={onApplyPreset}
            currentData={state}
            disabled={isFinalized}
          />
        )}

        <Button
          variant="ghost"
          size="sm"
          icon={<Copy className="h-4 w-4" />}
          onClick={onDuplicate}
          type="button"
        >
          Duplicate
        </Button>

        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 className="h-4 w-4" />}
          onClick={() => setDeleteConfirmOpen(true)}
          type="button"
        >
          Delete
        </Button>
      </div>

      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-surface border border-color rounded-lg p-4 max-w-sm mx-4">
            <h3 className="font-medium mb-2">Delete Document?</h3>
            <p className="text-sm text-tertiary mb-4">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onDelete();
                  setDeleteConfirmOpen(false);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
