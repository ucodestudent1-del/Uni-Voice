import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Section, SectionHeader } from "./Section";
import { Calculator, FileLock, Shield, Globe, Clock, FileText } from "lucide-react";
const iconMap = {
    calculator: Calculator,
    "document-lock": FileLock,
    "shield-lock": Shield,
    "globe-currency": Globe,
    "clock-arrow": Clock,
    "document-sparkle": FileText,
};
export default function FeaturesSection({ title, subtitle, features, align = "center", className, id, }) {
    return (_jsxs(Section, { className: className, id: id, children: [_jsx(SectionHeader, { title: title, subtitle: subtitle, align: align }), _jsx("div", { className: "mx-auto max-w-5xl space-y-4", children: features.map((feature) => {
                    const Icon = iconMap[feature.icon];
                    return (_jsxs("div", { className: "flex flex-col gap-6 rounded-xl border border-color-subtle bg-surface p-6 md:flex-row md:items-start", children: [_jsx("div", { className: "flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-bg text-primary", children: _jsx(Icon, { className: "h-6 w-6" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-xl font-semibold text-primary", children: feature.title }), _jsx("p", { className: "mt-2 text-secondary", children: feature.description }), feature.details] })] }, feature.title));
                }) })] }));
}
