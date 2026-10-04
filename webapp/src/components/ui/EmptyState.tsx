import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { RefreshCw, AlertCircle } from "lucide-react";
import type { EmptyStateProps } from "@/types/components";

export type { EmptyStateProps };

type EmptyStateVariant = "default" | "compact" | "sidebar" | "loading" | "error";

export default function EmptyState({
  title,
  description,
  icon,
  actionLabel = "Create first",
  onAction,
  className,
  variant = "default",
}: EmptyStateProps & { variant?: EmptyStateVariant }) {
  const inner = (
    <div className={cn("flex flex-col items-center justify-center py-10 text-center", className)}>
      {icon && <div className="mb-4 text-tertiary">{icon}</div>}
      <h3 className="text-lg font-medium text-primary leading-tight">{title || "No items yet"}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-secondary leading-relaxed">{description}</p>}
      {onAction && (
        <Button variant="primary" size="md" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );

  if (variant === "compact") {
    return (
      <div className={cn("text-center py-6", className)}>
        {icon && <div className="mb-2 text-tertiary inline-flex">{icon}</div>}
        <p className="text-sm font-medium text-primary">{title || "No items yet"}</p>
        {description && <p className="text-xs text-secondary mt-1 leading-relaxed">{description}</p>}
        {onAction && (
          <Button variant="primary" size="sm" className="mt-2" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className={cn("py-8 text-center", className)}>
        {icon && <div className="mb-3 text-tertiary inline-flex">{icon}</div>}
        <p className="text-sm text-tertiary">{title || "No items yet"}</p>
        {onAction && (
          <Button variant="link" size="sm" className="mt-2" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }

  if (variant === "loading") {
    return (
      <div className={cn("flex flex-col items-center justify-center py-10 text-center", className)}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-4" />
        <p className="text-sm text-tertiary">{title || "Loading..."}</p>
        {description && <p className="mt-2 max-w-sm text-sm text-secondary leading-relaxed">{description}</p>}
      </div>
    );
  }

  if (variant === "error") {
    return (
      <div className={cn("flex flex-col items-center justify-center py-10 text-center", className)}>
        {icon && <div className="mb-4 text-error-text">{icon}</div>}
        <h3 className="text-lg font-medium text-error-text leading-tight">{title || "Something went wrong"}</h3>
        {description && <p className="mt-2 max-w-sm text-sm text-secondary leading-relaxed">{description}</p>}
        {onAction && (
          <Button variant="primary" size="md" className="mt-4" onClick={onAction}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }

  return inner;
}
