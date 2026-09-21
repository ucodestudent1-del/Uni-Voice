import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps {
  id: string;
  type?: ToastType;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

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

export default function Toast({ id, type = "info", title, message, actionLabel, onAction, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const Icon = iconMap[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg transition-all",
        typeClasses[type],
        {
          "translate-x-0 opacity-100": visible,
          "translate-x-full opacity-0": !visible,
        }
      )}
      role="alert"
      aria-live={type === "error" || type === "warning" ? "assertive" : "polite"}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
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
        onClick={() => setVisible(false)}
        className="rounded-lg p-1 hover:bg-surface-alt/20"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
