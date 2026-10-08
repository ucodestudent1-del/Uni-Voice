import React, { useEffect, useMemo } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { FormField } from "./FormField";

export interface PaymentTermsOption {
  value: string;
  label: string;
  daysFromIssue: number | null;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export const PAYMENT_TERMS_OPTIONS: PaymentTermsOption[] = [
  { value: "Due on receipt", label: "Due on receipt", daysFromIssue: 0, icon: Clock, description: "Payment due immediately" },
  { value: "Net 7", label: "Net 7", daysFromIssue: 7, icon: CalendarDays, description: "Due in 7 days" },
  { value: "Net 14", label: "Net 14", daysFromIssue: 14, icon: CalendarDays, description: "Due in 14 days" },
  { value: "Net 30", label: "Net 30", daysFromIssue: 30, icon: CalendarDays, description: "Due in 30 days" },
  { value: "Net 60", label: "Net 60", daysFromIssue: 60, icon: CalendarDays, description: "Due in 60 days" },
  { value: "Net 90", label: "Net 90", daysFromIssue: 90, icon: CalendarDays, description: "Due in 90 days" },
  { value: "Custom", label: "Custom", daysFromIssue: null, icon: CalendarDays, description: "Set a custom due date" },
];

export interface PaymentTermsFieldProps {
  label?: string;
  value: string;
  issueDate?: string | null;
  onChange: (terms: string) => void;
  onDueDateChange?: (dueDate: string | null) => void;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  showCustomDueDate?: boolean;
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function PaymentTermsField({
  label = "Payment Terms",
  value,
  issueDate,
  onChange,
  onDueDateChange,
  disabled = false,
  className,
  selectClassName,
  showCustomDueDate = true,
}: PaymentTermsFieldProps) {
  const selected = PAYMENT_TERMS_OPTIONS.find((opt) => opt.value === value) ?? null;

  const handleTermsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    const opt = PAYMENT_TERMS_OPTIONS.find((o) => o.value === newVal);
    if (opt && opt.daysFromIssue !== null && issueDate) {
      const dueDate = addDaysISO(issueDate, opt.daysFromIssue);
      onDueDateChange?.(dueDate);
    }
  };

  const effectiveValue = value || "Net 30";
  const isCustom = effectiveValue === "Custom";

  return (
    <FormField
      label={label}
      labelClassName="uppercase"
      value={effectiveValue}
      onChange={handleTermsChange as any}
      select
      disabled={disabled}
      className={className}
      inputClassName={selectClassName}
    >
      {PAYMENT_TERMS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </FormField>
  );
}

PaymentTermsField.displayName = "PaymentTermsField";

export function computeDueDateFromTerms(issueDate: string | null | undefined, terms: string): string | null {
  if (!issueDate) return null;
  const opt = PAYMENT_TERMS_OPTIONS.find((o) => o.value === terms);
  if (!opt || opt.daysFromIssue === null) return null;
  return addDaysISO(issueDate, opt.daysFromIssue);
}

export function resolveTermsFromDueDate(issueDate: string | null | undefined, dueDate: string | null | undefined): string {
  if (!issueDate || !dueDate) return "Net 30";
  const issue = new Date(issueDate);
  const due = new Date(dueDate);
  const diffDays = Math.round((due.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Due on receipt";

  const exactMatch = PAYMENT_TERMS_OPTIONS.find(
    (opt) => opt.daysFromIssue === diffDays && opt.value !== "Custom"
  );
  if (exactMatch) return exactMatch.value;

  return "Custom";
}

export function PaymentTermsWithCustomField({
  issueDate,
  dueDate,
  terms,
  onTermsChange,
  onDueDateChange,
  disabled,
  label = "Payment Terms",
  className,
  selectClassName,
}: {
  issueDate: string | null | undefined;
  dueDate: string | null | undefined;
  terms: string;
  onTermsChange: (terms: string) => void;
  onDueDateChange: (dueDate: string | null) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  selectClassName?: string;
}) {
  const resolvedTerms = useMemo(() => {
    if (!terms) {
      if (issueDate && dueDate) return resolveTermsFromDueDate(issueDate, dueDate);
      return "Net 30";
    }
    return terms;
  }, [terms, issueDate, dueDate]);

  const isCustom = resolvedTerms === "Custom";

  useEffect(() => {
    if (!terms) {
      const resolved = resolveTermsFromDueDate(issueDate, dueDate);
      if (resolved !== terms) {
        onTermsChange(resolved);
      }
    }
  }, [terms, issueDate, dueDate, onTermsChange, onDueDateChange]);

  const handleTermsChange = (newTerms: string) => {
    onTermsChange(newTerms);
    if (newTerms !== "Custom" && issueDate) {
      const newDue = computeDueDateFromTerms(issueDate, newTerms);
      if (newDue && newDue !== dueDate) {
        onDueDateChange(newDue);
      }
    }
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDueDateChange(e.target.value || null);
  };

  return (
    <>
      <PaymentTermsField
        label={label}
        value={resolvedTerms}
        issueDate={issueDate ?? undefined}
        onChange={handleTermsChange}
        onDueDateChange={onDueDateChange}
        disabled={disabled}
        className={className}
        selectClassName={selectClassName}
      />
      {isCustom && (
        <FormField
          label="Due Date"
          labelClassName="uppercase"
          type="date"
          value={dueDate?.split("T")[0] ?? ""}
          onChange={handleDueDateChange}
          disabled={disabled}
          className={className}
          inputClassName={selectClassName}
        />
      )}
    </>
  );
}

PaymentTermsWithCustomField.displayName = "PaymentTermsWithCustomField";
