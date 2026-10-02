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
      <label className="form-label">{label}</label>
      {description && <p className="form-helper-text">{description}</p>}
      {children}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}


