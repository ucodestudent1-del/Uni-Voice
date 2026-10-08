import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CheckCircle } from "lucide-react";
const accentBorderMap = {
    slate: "border-slate-400 dark:border-slate-500",
    primary: "border-primary-500",
    teal: "border-teal-500",
    amber: "border-amber-500",
};
export default function TemplateGallery({ items, onSelect, selectedId, className, }) {
    const handleSelect = (item) => (e) => {
        e.preventDefault();
        onSelect?.(item);
    };
    return (_jsx("div", { className: className ?? "", children: _jsx("div", { className: "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3", children: items.map((item) => {
                const isSelected = selectedId === item.id;
                const borderColor = accentBorderMap[item.color] ?? accentBorderMap.slate;
                return (_jsxs("button", { type: "button", onClick: handleSelect(item), className: `group relative flex flex-col text-left rounded-xl border-2 bg-surface p-5 shadow-sm transition-colors hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary ${isSelected ? `${borderColor} ring-2 ring-primary-500` : "border-color-subtle"}`, children: [isSelected && (_jsx("span", { className: "absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-primary-action px-2.5 py-1 text-xs font-medium text-on-primary", children: "Selected" })), _jsx("div", { className: "mb-4 rounded-lg overflow-hidden border border-color-subtle", children: item.preview }), _jsx("h3", { className: "text-lg font-semibold text-primary", children: item.name }), _jsx("p", { className: "mt-1 text-sm text-secondary flex-1", children: item.description }), _jsxs("div", { className: "mt-4 flex items-center gap-2 text-sm text-secondary", children: [_jsx(CheckCircle, { className: "h-4 w-4 text-success-text" }), _jsx("span", { children: "Responsive \u2022 Print-ready \u2022 Brandable" })] })] }, item.id));
            }) }) }));
}
