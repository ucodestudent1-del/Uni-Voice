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
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {description && <p className="text-xs text-slate-500 mb-2">{description}</p>}
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
