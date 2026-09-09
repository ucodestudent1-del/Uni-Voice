import { useState } from "react";
import type { FaqItem } from "../../data/landing";
import { Section, SectionHeader } from "./Section";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

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
      <div className="mx-auto max-w-3xl divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {items.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.question} className="border-b border-slate-200 last:border-0">
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <span className="text-sm font-medium text-primary-600">Q{index + 1}</span>
                <span className="flex-1 font-medium text-slate-900">{item.question}</span>
                <ChevronDownIcon
                  className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out overflow-hidden"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-4 pt-1 text-sm text-slate-600 leading-relaxed">
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
