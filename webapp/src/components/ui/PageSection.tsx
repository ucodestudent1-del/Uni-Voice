import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageSectionProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  divided?: boolean;
  padding?: "default" | "none" | "sm";
}

export function PageSection({
  title,
  description,
  action,
  children,
  className,
  headerClassName,
  bodyClassName,
  divided = true,
  padding = "default",
}: PageSectionProps) {
  const paddingClass = {
    default: "p-5",
    none: "p-0",
    sm: "p-4",
  }[padding];

  return (
    <section
      className={cn(
        "rounded-xl border bg-surface shadow-sm",
        divided && "border-color-subtle",
        className
      )}
    >
      {(title || description || action) && (
        <div
          className={cn(
            "flex items-center justify-between",
            padding === "default" && "px-5 pt-5 pb-3",
            padding === "sm" && "px-4 pt-4 pb-2",
            padding === "none" && "px-0 pt-0 pb-0",
            headerClassName
          )}
        >
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-sm font-semibold text-primary leading-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-secondary leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(padding, bodyClassName)}>{children}</div>
    </section>
  );
}

PageSection.displayName = "PageSection";

export default PageSection;
