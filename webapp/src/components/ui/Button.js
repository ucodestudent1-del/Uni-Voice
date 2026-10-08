import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
const baseClasses = "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
const variantClasses = {
    primary: "bg-primary-action text-on-primary hover:bg-primary-hover focus:ring-primary",
    secondary: "border border-input-border text-secondary hover:bg-hover focus:ring-primary",
    danger: "border border-error-border text-error-text bg-error-bg hover:bg-error-bg focus:ring-error",
    warning: "border border-warning-border text-warning-text bg-warning-bg hover:bg-warning-bg focus:ring-warning",
    ghost: "text-secondary hover:text-primary hover:bg-hover focus:ring-primary",
    link: "text-primary-brand hover:text-primary hover:underline bg-transparent focus:ring-primary",
};
const sizeClasses = {
    sm: "px-3 py-2 text-xs min-h-[36px]",
    md: "px-4 py-2 text-sm min-h-[40px]",
    lg: "px-5 py-2.5 text-sm font-semibold min-h-[44px]",
};
export const Button = forwardRef(({ className, variant = "primary", size = "md", children, icon, iconPosition = "left", loading = false, disabled, ...props }, ref) => {
    const isIconOnly = (icon || loading) && !children;
    const isDisabled = disabled || loading;
    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${isIconOnly ? "px-2" : ""} ${className ?? ""}`;
    return (_jsxs("button", { ref: ref, className: classes, type: "button", disabled: isDisabled, "aria-busy": loading || undefined, ...props, children: [loading && iconPosition === "left" && (_jsx("span", { "aria-hidden": "true", className: "flex items-center", children: _jsx(Loader2, { className: "animate-spin" }) })), !loading && icon && iconPosition === "left" && (_jsx("span", { "aria-hidden": "true", className: "flex items-center", children: icon })), children, !loading && icon && iconPosition === "right" && (_jsx("span", { "aria-hidden": "true", className: "flex items-center", children: icon }))] }));
});
Button.displayName = "Button";
export const buttonSizeClasses = sizeClasses;
