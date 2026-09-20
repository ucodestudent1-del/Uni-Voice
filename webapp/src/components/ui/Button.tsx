import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  children?: ReactNode;
}

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm",
  secondary:
    "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-500",
  danger:
    "border border-red-300 text-red-700 hover:bg-red-50 focus:ring-red-500",
  ghost:
    "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-400",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs min-h-[32px]",
  md: "px-4 py-2.5 text-sm min-h-[44px]",
  lg: "px-5 py-3 text-[15px] font-semibold min-h-[44px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      children,
      icon,
      iconPosition = "left",
      ...props
    },
    ref,
  ) => {
    const isIconOnly = icon && !children;
    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${isIconOnly ? "px-2" : ""} ${className ?? ""}`;

    return (
      <button ref={ref} className={classes} type="button" {...props}>
        {icon && iconPosition === "left" && (
          <span aria-hidden="true" className="flex items-center">
            {icon}
          </span>
        )}
        {children}
        {icon && iconPosition === "right" && (
          <span aria-hidden="true" className="flex items-center">
            {icon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
