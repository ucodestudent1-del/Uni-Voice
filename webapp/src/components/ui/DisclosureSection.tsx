import React, { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DisclosureSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  summary?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DisclosureSection({
  title,
  icon,
  defaultOpen = false,
  summary,
  children,
  className,
  contentClassName,
}: DisclosureSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<string>("0px");

  useEffect(() => {
    if (open) {
      const el = contentRef.current;
      if (el) {
        const target = el.scrollHeight;
        setHeight(`${target}px`);
      }
    } else {
      setHeight("0px");
    }
  }, [open, children]);

  const handleToggle = () => setOpen((prev) => !prev);

  return (
    <div className={cn("rounded-xl border border-color bg-surface", className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-tertiary">{icon}</span>}
          <span className="font-medium text-primary">{title}</span>
          {summary && !open && (
            <span className="text-sm text-tertiary">{summary}</span>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-tertiary transition-transform" />
        ) : (
          <ChevronRight className="h-4 w-4 text-tertiary transition-transform" />
        )}
      </button>

      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ height, maxHeight: open ? "1000px" : "0px" }}
      >
        <div className={cn("px-4 pb-4", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}

DisclosureSection.displayName = "DisclosureSection";
