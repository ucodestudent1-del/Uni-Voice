import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data?: Record<string, string>) => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  showInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  inputRequiredMatch?: string;
  isLoading?: boolean;
}

export default function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  showInput = false,
  inputLabel,
  inputPlaceholder = "",
  inputValue = "",
  onInputChange,
  inputRequiredMatch,
  isLoading = false,
}: ConfirmationDialogProps) {
  const [localInput, setLocalInput] = useState("");

  if (!open) return null;

  const canConfirm = inputRequiredMatch
    ? localInput === inputRequiredMatch
    : true;

  const handleConfirm = () => {
    const data: Record<string, string> = {};
    if (showInput) {
      data[inputLabel ?? "input"] = inputValue ?? localInput;
    }
    onConfirm(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="relative mx-4 w-full max-w-lg rounded-xl bg-surface shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-tertiary hover:text-primary hover:bg-surface-alt"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          {message && <p className="mt-2 text-sm text-secondary">{message}</p>}
        </div>

        {showInput && (
          <div className="px-6 pb-4">
            <label className="block text-sm font-medium text-secondary mb-1">
              {inputLabel}
              {inputRequiredMatch && (
                <span className="text-xs text-tertiary block mt-0.5">
                  Type "{inputRequiredMatch}" to confirm
                </span>
              )}
            </label>
            <input
              type="text"
              value={inputValue ?? localInput}
              onChange={(e) => {
                onInputChange?.(e.target.value);
                setLocalInput(e.target.value);
              }}
              disabled={!!inputValue}
              className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              placeholder={inputPlaceholder}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-color-subtle p-6 pt-4">
          <Button variant="secondary" size="md" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            size="md"
            onClick={handleConfirm}
            disabled={isLoading || !canConfirm}
            className={destructive ? "status-error-text" : undefined}
          >
            {isLoading ? "Processing…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmationDialog };
