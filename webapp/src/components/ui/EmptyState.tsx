import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { EmptyStateProps } from "@/types/components";

export { EmptyStateProps };

export default function EmptyState({
  title = "No items yet",
  description,
  icon,
  actionLabel = "Create first",
  onAction,
  className,
  variant = "default",
}: EmptyStateProps) {
  const inner = (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {icon && <div className="mb-4 text-tertiary">{icon}</div>}
      <h3 className="text-lg font-medium text-primary">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-tertiary">{description}</p>}
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
        <p className="text-sm text-tertiary">{title}</p>
        {description && <p className="text-xs text-tertiary mt-1">{description}</p>}
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
        <p className="text-sm text-tertiary">{title}</p>
        {onAction && (
          <Button variant="link" size="sm" className="mt-2" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }

  return inner;
}
