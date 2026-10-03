import { SUPPORTED_CURRENCIES } from "@/utils/currency";
import type { QuoteBuilderData } from "./types";

interface QuoteDetailsFormProps {
  data: QuoteBuilderData;
  onChange: (field: keyof QuoteBuilderData, value: any) => void;
  currencyLocked: boolean;
}

export function QuoteDetailsForm({ data, onChange, currencyLocked }: QuoteDetailsFormProps) {
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-medium text-secondary">Quote Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div>
          <label className="block text-xs font-medium text-tertiary uppercase mb-0.5">Due Date</label>
          <input
            type="date"
            value={data.dueDate}
            onChange={(e) => onChange("dueDate", e.target.value)}
            className="w-full rounded-lg border border-input-border bg-surface-alt px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
    </div>
  );
}
