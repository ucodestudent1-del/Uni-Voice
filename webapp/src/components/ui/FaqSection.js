import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Section, SectionHeader } from "./Section";
export default function FaqSection({ title = "Frequently asked questions", subtitle, items, allowMultiple = false, className, id, }) {
    const [open, setOpen] = useState(0);
    function toggle(index) {
        if (allowMultiple) {
            setOpen((prev) => (prev === index ? null : index));
        }
        else {
            setOpen(open === index ? null : index);
        }
    }
    return (_jsxs(Section, { bg: "slate-50", className: className, id: id, children: [_jsx(SectionHeader, { title: title, subtitle: subtitle }), _jsx("div", { className: "mx-auto max-w-3xl divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-color-subtle border-color bg-surface", children: items.map((item, index) => {
                    const isOpen = open === index;
                    return (_jsxs("div", { className: "border-b border-color-subtle border-color last:border-0", children: [_jsxs("button", { type: "button", onClick: () => toggle(index), "aria-expanded": isOpen, className: "flex w-full items-center gap-3 px-5 py-4 text-left text-secondary hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary", children: [_jsxs("span", { className: "text-sm font-medium text-primary-brand text-primary-brand", children: ["Q", index + 1] }), _jsx("span", { className: "flex-1 font-medium text-primary", children: item.question }), _jsx("span", { className: `text-sm text-tertiary transition-transform ${isOpen ? "rotate-180" : ""}`, children: "\u25BC" })] }), _jsx("div", { className: "grid transition-[grid-template-rows] duration-300 ease-in-out overflow-hidden", style: { gridTemplateRows: isOpen ? "1fr" : "0fr" }, children: _jsx("div", { className: "overflow-hidden", children: _jsx("div", { className: "px-5 pb-4 pt-1 text-sm text-tertiary leading-relaxed", children: item.answer }) }) })] }, item.question));
                }) })] }));
}
