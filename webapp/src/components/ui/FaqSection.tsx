import { useState } from "react";
import type { FaqItem } from "../../data/landing";
import { Section, SectionHeader } from "./Section";

export interface FaqSectionProps {
  title?: string;
  subtitle?: string;
  items: FaqItem[];
  allowMultiple?: boolean;
  className?: string;
  id?: string;
}

export default function FaqSection({
  title = "Frequently asked questions",
  subtitle,
  items,
  allowMultiple = false,
  className,
  id,
}: FaqSectionProps) {
  const [open, setOpen] = useState<number | null>(0);

  function toggle(index: number) {
    if (allowMultiple) {
      setOpen((prev) => (prev === index ? null : index));
    } else {
      setOpen(open === index ? null : index);
    }
  }

  return (
    <Section bg="slate-50" className={className} id={id}>
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="mx-auto max-w-3xl divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {items.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.question} className="border-b border-slate-200 dark:border-slate-700 last:border-0">
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">Q{index + 1}</span>
                <span className="flex-1 font-medium text-slate-900 dark:text-slate-100">{item.question}</span>
                <span className={`text-sm text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out overflow-hidden"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-4 pt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.answer}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
