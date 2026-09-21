import type { ReactNode } from "react";

export function Section({
  children,
  className,
  id,
  bg = "white",
  inner,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  bg?: "white" | "slate-50" | "slate-100";
  inner?: boolean;
}) {
  const bgClass = {
    white: "bg-surface",
    "slate-50": "bg-page",
    "slate-100": "bg-page-alt",
  }[bg];

  return (
    <section id={id} className={`${bgClass} ${inner ? "py-12" : "py-16"} ${className ?? ""}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  align = "center",
  className,
}: {
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`mb-12 ${alignClass} ${className ?? ""}`}>
      <h2 className="text-3xl font-bold text-primary sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-secondary">{subtitle}</p>}
    </div>
  );
}
