import type { ReactNode } from "react";

type SectionBg = "white" | "slate-50" | "slate-100";

const bgClass: Record<SectionBg, string> = {
  white: "bg-white",
  "slate-50": "bg-slate-50",
  "slate-100": "bg-slate-100",
};

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
  bg?: SectionBg;
  inner?: boolean;
}) {
  return (
    <section id={id} className={`${bgClass[bg]} ${inner ? "py-12" : "py-16"} ${className ?? ""}`}>
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
      <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-slate-600">{subtitle}</p>}
    </div>
  );
}
