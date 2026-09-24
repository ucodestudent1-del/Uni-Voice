import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { BreadcrumbItem, PageHeaderProps } from "@/types/components";

export { BreadcrumbItem, PageHeaderProps };

export default function PageHeader({
  title,
  breadcrumbs,
  description,
  primaryAction,
  secondaryActions,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="breadcrumbs" className="mb-3 flex items-center gap-1 text-xs text-tertiary">
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {crumb.to && i < breadcrumbs.length - 1 ? (
                <Link to={crumb.to} className="text-tertiary hover:text-primary">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-tertiary">{crumb.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-primary">{title}</h1>
          {description && <p className="mt-1 text-sm text-secondary">{description}</p>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {secondaryActions}
          {actions}
          {primaryAction}
        </div>
      </div>
    </div>
  );
}
