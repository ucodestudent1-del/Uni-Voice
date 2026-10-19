import { useState, useEffect, useRef } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import type { ConfirmationDialogProps } from "@/types/components";

export type { ConfirmationDialogProps };

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
   inputValue,
  onInputChange,
  inputRequiredMatch,
  isLoading = false,
}: ConfirmationDialogProps) {
  const [localInput, setLocalInput] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (firstFocusable ?? panelRef.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const effectiveInput = inputValue ?? localInput;
  const canConfirm = inputRequiredMatch ? effectiveInput === inputRequiredMatch : true;

  const handleConfirm = () => {
    const data: Record<string, string> = {};
    if (showInput) {
      data[inputLabel ?? "input"] = inputValue ?? localInput;
    }
    onConfirm(data);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
      role="presentation"
      onClick={(e) => {
        if (overlayRef.current === (e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        className="relative mx-4 w-full max-w-lg rounded-xl bg-surface shadow-xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-tertiary hover:text-primary hover:bg-surface-alt"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 pb-4">
          <h2 id="confirmation-dialog-title" className="text-lg font-semibold text-primary">{title}</h2>
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
            value={effectiveInput}
            onChange={(e) => {
              const val = e.target.value;
              onInputChange?.(val);
              setLocalInput(val);
            }}
            disabled={!!inputValue}
            className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary placeholder-target disabled:opacity-50"
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
