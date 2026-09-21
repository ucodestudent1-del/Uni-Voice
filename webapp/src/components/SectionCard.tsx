import type { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function SectionCard({ title, action, children, className = "" }: SectionCardProps) {
  return (
    <div className={`bg-surface rounded-xl border border-color overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-primary">{title}</h3>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
