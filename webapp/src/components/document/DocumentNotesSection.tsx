import { FormTextareaField } from "@/components/ui";

interface DocumentNotesSectionProps {
  notes: string;
  terms: string;
  paymentInstructions?: string;
  scopeOfWork?: string;
  internalNotes?: string;
  isQuote?: boolean;
  isCreditNote?: boolean;
  showPaymentInstructions?: boolean;
  onNotesChange: (v: string) => void;
  onTermsChange: (v: string) => void;
  onPaymentInstructionsChange?: (v: string) => void;
  onScopeOfWorkChange?: (v: string) => void;
  onInternalNotesChange?: (v: string) => void;
  disabled?: boolean;
}

export function DocumentNotesSection({
  notes,
  terms,
  paymentInstructions,
  scopeOfWork,
  internalNotes,
  isQuote = false,
  isCreditNote = false,
  showPaymentInstructions = true,
  onNotesChange,
  onTermsChange,
  onPaymentInstructionsChange,
  onScopeOfWorkChange,
  onInternalNotesChange,
  disabled = false,
}: DocumentNotesSectionProps) {
  return (
    <div className="space-y-3">
      {isQuote && onScopeOfWorkChange && (
        <FormTextareaField
          label="Scope of Work"
          placeholder="Describe the work to be performed..."
          value={scopeOfWork ?? ""}
          onChange={(e) => onScopeOfWorkChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {onPaymentInstructionsChange && showPaymentInstructions && (
        <FormTextareaField
          label="Payment Instructions"
          placeholder="How should the customer pay..."
          value={paymentInstructions ?? ""}
          onChange={(e) => onPaymentInstructionsChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {isQuote && onInternalNotesChange && (
        <FormTextareaField
          label="Internal Notes"
          placeholder="Team-only notes (not visible to customer)..."
          value={internalNotes ?? ""}
          onChange={(e) => onInternalNotesChange(e.target.value)}
          disabled={disabled}
        />
      )}

      <FormTextareaField
        label="Notes"
        placeholder={
          isCreditNote
            ? "Additional notes for the credit note..."
            : "Additional notes for the customer..."
        }
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        disabled={disabled}
      />

      <FormTextareaField
        label="Terms"
        placeholder="Payment terms..."
        value={terms}
        onChange={(e) => onTermsChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
