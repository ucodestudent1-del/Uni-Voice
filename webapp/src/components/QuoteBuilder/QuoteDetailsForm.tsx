import { SUPPORTED_CURRENCIES } from "@/utils/currency";
import type { QuoteBuilderData } from "./types";
import { PaymentTermsWithCustomField, computeDueDateFromTerms } from "@/components/ui/PaymentTermsField";

interface QuoteDetailsFormProps {
  data: QuoteBuilderData;
  onChange: (field: keyof QuoteBuilderData, value: any) => void;
  currencyLocked: boolean;
}

export function QuoteDetailsForm({ data, onChange, currencyLocked }: QuoteDetailsFormProps) {
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-medium text-secondary">Quote Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Currency</label>
          <select
            value={data.currency}
            onChange={(e) => onChange("currency", e.target.value)}
            disabled={currencyLocked}
            className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            {SUPPORTED_CURRENCIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {currencyLocked && (
            <p className="text-xs text-tertiary mt-1">Locked after adding line items</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Issue Date</label>
          <input
            type="date"
            value={data.issueDate}
            onChange={(e) => onChange("issueDate", e.target.value)}
            className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="block">
          <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Payment Terms</label>
          <PaymentTermsWithCustomField
            issueDate={data.issueDate}
            dueDate={data.dueDate}
            terms={data.invoiceTerms ?? "Net 30"}
            onTermsChange={(terms) => {
              onChange("invoiceTerms", terms);
              if (terms !== "Custom" && data.issueDate) {
                const newDue = computeDueDateFromTerms(data.issueDate, terms);
                if (newDue) onChange("dueDate", newDue);
              }
            }}
            onDueDateChange={(dueDate) => {
              onChange("dueDate", dueDate);
              onChange("invoiceTerms", "Custom");
            }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Expiry Date</label>
          <input
            type="date"
            value={data.expiryDate ?? ""}
            onChange={(e) => onChange("expiryDate", e.target.value || null)}
            className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Quote Discount</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select
            value={data.discount.type}
            onChange={(e) => onChange("discount", { ...data.discount, type: e.target.value as any })}
            className="rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="none">None</option>
            <option value="fixed">Fixed amount</option>
            <option value="percentage">Percentage</option>
          </select>
          {data.discount.type !== "none" && (
            <input
              type="number"
              min="0"
              step="0.01"
              value={data.discount.value}
              onChange={(e) => onChange("discount", { ...data.discount, value: e.target.value })}
              className="rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </div>
      </div>

       <div>
         <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Notes</label>
         <textarea
           value={data.notes}
           onChange={(e) => onChange("notes", e.target.value)}
           placeholder="Additional notes for the customer"
           rows={3}
           className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
         />
       </div>

       <div>
         <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Internal Notes</label>
         <textarea
           value={data.internalNotes}
           onChange={(e) => onChange("internalNotes", e.target.value)}
           placeholder="Internal notes visible only to your team"
           rows={3}
           className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
         />
       </div>

       <div>
        <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Terms</label>
        <textarea
          value={data.terms}
          onChange={(e) => onChange("terms", e.target.value)}
          placeholder="Payment terms and conditions"
          rows={3}
          className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        />
      </div>

        <div>
          <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Payment Instructions</label>
          <textarea
            value={data.paymentInstructions}
            onChange={(e) => onChange("paymentInstructions", e.target.value)}
            placeholder="How the customer should pay"
            rows={2}
            className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Scope of Work</label>
          <textarea
            value={data.scopeOfWork}
            onChange={(e) => onChange("scopeOfWork", e.target.value)}
            placeholder="Detailed description of work, materials, deliverables, and timeline"
            rows={4}
            className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Deposit Required</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={data.depositType}
              onChange={(e) => onChange("depositType", e.target.value as any)}
              className="rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="none">None</option>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
            {data.depositType !== "none" && (
              <>
                <input
                  type="number"
                  min="0"
                  step={data.depositType === "percentage" ? "0.01" : "0.01"}
                  max={data.depositType === "percentage" ? "100" : undefined}
                  value={data.depositValue}
                  onChange={(e) => onChange("depositValue", e.target.value)}
                  placeholder={data.depositType === "percentage" ? "50" : "0.00"}
                  className="rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {data.depositType === "percentage" && <span className="text-xs text-tertiary self-center">%</span>}
              </>
            )}
          </div>
          {data.depositType !== "none" && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Deposit Due Date</label>
              <input
                type="date"
                value={data.depositDueDate ?? ""}
                onChange={(e) => onChange("depositDueDate", e.target.value || null)}
                className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
    </div>
  );
}
