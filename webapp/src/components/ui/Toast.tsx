import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import type { ToastProps, ToastType } from "@/types/components";

export type { ToastProps, ToastType };

const iconMap: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const typeClasses: Record<ToastType, string> = {
  success: "border-success-border bg-success-bg text-success-text",
  error: "border-error-border bg-error-bg text-error-text",
  info: "border-info-border bg-info-bg text-info-text",
  warning: "border-warning-border bg-warning-bg text-warning-text",
};

function Toast({ id, type = "info", title, message, actionLabel, onAction, duration = 5000, onDismiss }: ToastProps & { onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(true);
  const Icon = iconMap[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(id), 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, id, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(id), 200);
  };

  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg transition-all",
        typeClasses[type],
        {
          "translate-x-0 opacity-100 scale-100": visible,
          "translate-x-full opacity-0 scale-95": !visible,
        }
      )}
      role="alert"
      aria-live={type === "error" || type === "warning" ? "assertive" : "polite"}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        {title && <p className="text-sm font-medium">{title}</p>}
        <p className="text-sm">{message}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-xs font-medium underline hover:opacity-80"
        >
          {actionLabel}
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="rounded-lg p-1 text-tertiary hover:bg-surface-alt hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default Toast;
