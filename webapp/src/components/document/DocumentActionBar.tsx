import { Save, Send, FileText } from "lucide-react";
import { Button } from "@/components/ui";
import type { SaveState } from "@/components/document/document-types";

interface DocumentActionBarProps {
  isFinalized: boolean;
  saveState: SaveState;
  isFinalizing: boolean;
  isSending: boolean;
  onSave: () => void;
  onFinalize: () => void;
  onSend: () => void;
}

export function DocumentActionBar({
  isFinalized,
  saveState,
  isFinalizing,
  isSending,
  onSave,
  onFinalize,
  onSend,
}: DocumentActionBarProps) {
  const isSaving = saveState === "saving";

  return (
    <div className="flex items-center gap-3">
      {!isFinalized && (
        <Button
          variant="ghost"
          size="sm"
          icon={<Save className="h-4 w-4" />}
          onClick={onSave}
          loading={isSaving}
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
          loading={isFinalizing}
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
          loading={isSending}
        >
          Send
        </Button>
      )}
    </div>
  );
}
