import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InvoiceCardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  padding?: "default" | "none" | "sm" | "lg";
  bordered?: boolean;
  hover?: boolean;
}

export function InvoiceCard({
  title,
  description,
  action,
  children,
  className,
  headerClassName,
  bodyClassName,
  padding = "default",
  bordered = true,
  hover = false,
}: InvoiceCardProps) {
  const bodyPaddingClass = {
    default: "p-5",
    none: "p-0",
    sm: "p-4",
    lg: "p-6",
  }[padding];

  const headerPaddingClass = {
    default: "px-5 pt-5 pb-3",
    none: "px-0 pt-0 pb-0",
    sm: "px-4 pt-4 pb-2",
    lg: "px-6 pt-6 pb-4",
  }[padding];

  return (
    <div
      className={cn(
        "rounded-xl bg-surface transition-colors",
        bordered && "border border-color",
        hover && "hover:border-color-strong",
        className
      )}
    >
      {(title || description || action) && (
        <div
          className={cn(
            "flex items-center justify-between",
            headerPaddingClass,
            headerClassName
          )}
        >
          <div className="min-w-0 flex-1">
            {title && <h3 className="invoice-section-heading">{title}</h3>}
            {description && <p className="invoice-body-text mt-1">{description}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(bodyPaddingClass, bodyClassName)}>{children}</div>
    </div>
  );
}

InvoiceCard.displayName = "InvoiceCard";

export default InvoiceCard;
