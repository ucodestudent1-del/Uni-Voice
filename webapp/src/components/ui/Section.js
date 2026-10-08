import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Section({ children, className, id, bg = "white", inner, }) {
    const bgClass = {
        white: "bg-surface",
        "slate-50": "bg-page",
        "slate-100": "bg-page-alt",
    }[bg];
    return (_jsx("section", { id: id, className: `${bgClass} ${inner ? "py-12" : "py-16"} ${className ?? ""}`, children: _jsx("div", { className: "container mx-auto px-4 sm:px-6 lg:px-8", children: children }) }));
}
export function SectionHeader({ title, subtitle, align = "center", className, }) {
    const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
    return (_jsxs("div", { className: `mb-10 ${alignClass} ${className ?? ""}`, children: [_jsx("h2", { className: "text-3xl font-bold text-primary sm:text-4xl leading-tight", children: title }), subtitle && _jsx("p", { className: "mt-3 text-base text-secondary max-w-2xl leading-relaxed", children: subtitle })] }));
}
