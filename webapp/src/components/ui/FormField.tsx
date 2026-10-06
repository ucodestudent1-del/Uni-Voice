import { type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type FormFieldVariant = "default" | "filter";

export interface FormFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helperText?: string;
  error?: string;
  variant?: FormFieldVariant;
  labelClassName?: string;
  inputClassName?: string;
  errorIcon?: ReactNode;
  select?: boolean;
  children?: ReactNode;
}

export interface FormTextareaFieldProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  variant?: FormFieldVariant;
  labelClassName?: string;
  textareaClassName?: string;
}

const variantClasses: Record<FormFieldVariant, string> = {
  default: "form-control",
  filter: "filter-input",
};

export function FormField({
  label,
  helperText,
  error,
  variant = "default",
  className,
  labelClassName,
  inputClassName,
  select,
  children,
  disabled,
  id,
  ...props
}: FormFieldProps) {
  const inputId = id ?? `form-field-${Math.random().toString(36).slice(2, 11)}`;
  const hasError = Boolean(error);
  const describedBy = helperText || error ? `${inputId}-description` : undefined;

  const inputClasses = cn(
    variantClasses[variant],
    "w-full",
    hasError && "border-error-border focus:ring-error",
    disabled && "disabled-state",
    inputClassName
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            "block text-xs font-medium text-secondary",
            variant === "filter" && "filter-label",
            labelClassName
          )}
        >
          {label}
        </label>
      )}
      {select ? (
        <select
          {...props as SelectHTMLAttributes<HTMLSelectElement>}
          id={inputId}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cn(inputClasses, "appearance-none")}
        >
          {children}
        </select>
      ) : (
        <input
          {...props}
          id={inputId}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={inputClasses}
        />
      )}
      {helperText && (
        <p id={`${inputId}-description`} className="text-xs text-tertiary">
          {helperText}
        </p>
      )}
      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-1 text-xs text-error-text"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

FormField.displayName = "FormField";

export function FormTextareaField({
  label,
  helperText,
  error,
  variant = "default",
  className,
  labelClassName,
  textareaClassName,
  disabled,
  id,
  ...props
}: FormTextareaFieldProps) {
  const textareaId = id ?? `form-textarea-${Math.random().toString(36).slice(2, 11)}`;
  const hasError = Boolean(error);
  const describedBy = helperText || error ? `${textareaId}-description` : undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label
          htmlFor={textareaId}
          className={cn(
            "block text-xs font-medium text-secondary",
            variant === "filter" && "filter-label",
            labelClassName
          )}
        >
          {label}
        </label>
      )}
      <textarea
        {...props}
        id={textareaId}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-[5rem] w-full rounded-lg border px-3 py-2 text-sm text-primary",
          "bg-input border-input placeholder-target",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
          hasError && "border-error-border focus:ring-error",
          disabled && "disabled-state",
          textareaClassName
        )}
      />
      {helperText && (
        <p id={`${textareaId}-description`} className="text-xs text-tertiary">
          {helperText}
        </p>
      )}
      {error && (
        <p
          id={`${textareaId}-error`}
          className="mt-1 text-xs text-error-text"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

FormTextareaField.displayName = "FormTextareaField";
