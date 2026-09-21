import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "link";
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
    "bg-primary-action text-on-primary hover:bg-primary-hover focus:ring-primary",
  secondary:
    "border border-input-border text-secondary hover:bg-hover focus:ring-primary",
  danger:
    "border border-error-border text-error-text bg-error-bg hover:bg-error-bg focus:ring-error",
  ghost:
    "text-secondary hover:text-primary hover:bg-hover focus:ring-primary",
  link:
    "text-primary-brand hover:text-primary hover:underline bg-transparent focus:ring-primary",
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

export const buttonSizeClasses = sizeClasses;
