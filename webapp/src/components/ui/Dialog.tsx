import {
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  children: ReactNode;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
}

const sizeClasses: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-[90vw] md:max-w-4xl",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  className,
  children,
  closeOnOverlayClick = true,
  showCloseButton = true,
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleOverlayClick = (e: globalThis.MouseEvent) => {
    if (closeOnOverlayClick && overlayRef.current === (e.target as Node)) {
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key === "Tab" && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    const overlay = overlayRef.current;
    const panel = panelRef.current;

    if (overlay) {
      overlay.addEventListener("mousedown", handleOverlayClick);
    }

    const firstFocusable = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (firstFocusable ?? panel)?.focus();

    return () => {
      overlay?.removeEventListener("mousedown", handleOverlayClick);
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? "dialog-description" : undefined}
        className={cn(
          "relative w-full rounded-xl border bg-surface shadow-xl outline-none",
          sizeClasses[size],
          className
        )}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start justify-between p-6 pb-4">
          <h2
            id="dialog-title"
            className="text-lg font-semibold text-primary"
          >
            {title}
          </h2>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {description && (
          <p
            id="dialog-description"
            className="px-6 pb-4 text-sm text-secondary"
          >
            {description}
          </p>
        )}
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

Dialog.displayName = "Dialog";

export default Dialog;
