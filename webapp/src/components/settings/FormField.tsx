import React from "react";

interface FormFieldProps {
  label: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}

export default function FormField({ label, description, error, children, fullWidth = true }: FormFieldProps) {
  return (
    <div className={fullWidth ? "w-full" : ""}>
      <label className="block text-sm font-medium text-secondary text-secondary mb-1">{label}</label>
      {description && <p className="text-xs text-secondary text-tertiary mb-2">{description}</p>}
      {children}
      {error && <p className="mt-1 text-xs status-error-text">{error}</p>}
    </div>
  );
}


