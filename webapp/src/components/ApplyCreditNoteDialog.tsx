import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { getInvoices } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import { cn } from "@/lib/utils";
import type { ApiInvoiceListItem, ApiInvoice, ApiCreditNote } from "../types/api";
import { Decimal } from "decimal.js";
import { Search, FileText } from "lucide-react";

interface ApplyCreditNoteDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (data: {
    invoiceId: string;
    amount?: string;
    applicationMethod?: "invoice_offset" | "balance_credit" | "refund";
  }) => void;
  creditNote: ApiCreditNote;
  referenceInvoice?: ApiInvoice | null;
}

const METHODS: Array<{
  value: "invoice_offset" | "balance_credit" | "refund";
  label: string;
  description: string;
}> = [
  {
    value: "invoice_offset",
    label: "Apply to Invoice",
    description: "Reduce the balance of an invoice by the credit amount.",
  },
  {
    value: "balance_credit",
    label: "Credit on Account",
    description: "Hold the credit on the customer's account for future use.",
  },
  {
    value: "refund",
    label: "Issue Refund",
    description: "Return the credit amount directly to the customer.",
  },
];

const DEBOUNCE_MS = 300;

export function ApplyCreditNoteDialog({
  open,
  onClose,
  onApply,
  creditNote,
  referenceInvoice,
}: ApplyCreditNoteDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<
    "invoice_offset" | "balance_credit" | "refund"
  >("invoice_offset");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ApiInvoiceListItem[]>([]);
  const [selectedInvoice, setSelectedInvoice] =
    useState<ApiInvoiceListItem | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [amount, setAmount] = useState("");

  const remaining = new Decimal(creditNote.amount_due || 0);
  const maxApply = remaining.isNegative() ? new Decimal(0) : remaining;

  useEffect(() => {
    if (selectedMethod !== "invoice_offset" || !open) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await getInvoices({
          search: searchQuery,
          limit: 20,
        });
        if (!controller.signal.aborted) {
          setSearchResults((res.invoices ?? []) as ApiInvoiceListItem[]);
        }
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, selectedMethod, open]);

  const handleApply = () => {
    if (selectedMethod === "invoice_offset" && !selectedInvoice) return;
    if (amount && new Decimal(amount).isNegative()) return;

    onApply({
      invoiceId: selectedInvoice?.id ?? creditNote.reference_invoice_id ?? "",
      amount: amount || undefined,
      applicationMethod: selectedMethod,
    });
  };

  const resetState = () => {
    setSelectedMethod("invoice_offset");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedInvoice(null);
    setAmount("");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleMethodChange = (
    value: "invoice_offset" | "balance_credit" | "refund"
  ) => {
    setSelectedMethod(value);
    if (value !== "invoice_offset") {
      setSelectedInvoice(null);
      setSearchResults([]);
      setSearchQuery("");
    }
  };

  const handleInvoiceSelect = (invoice: ApiInvoiceListItem) => {
    setSelectedInvoice(invoice);
    setSearchQuery("");
    setSearchResults([]);
  };

  const getAmountInputLabel = () => {
    if (selectedMethod === "refund") return "Refund Amount";
    if (selectedMethod === "balance_credit") return "Credit Amount";
    return selectedInvoice
      ? `Apply to ${selectedInvoice.invoice_number ?? "Invoice"}`
      : "Apply Amount";
  };

  const getDefaultAmountPlaceholder = () => {
    return maxApply.toFixed(2);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Apply Credit Note"
      description={`Apply up to ${formatCurrency(maxApply, creditNote.currency)} remaining credit from ${creditNote.credit_note_number ?? "this credit note"}.`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Method selector */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-primary">
            Application Method
          </legend>
          {METHODS.map((method) => {
            const isSelected = selectedMethod === method.value;
            return (
              <label
                key={method.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  isSelected
                    ? "border-primary-action bg-primary-bg/5"
                    : "border-color hover:bg-surface-alt"
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={method.value}
                  checked={isSelected}
                  onChange={() => handleMethodChange(method.value)}
                  className="mt-1 h-4 w-4 cursor-pointer text-primary-action focus:ring-primary"
                  aria-describedby={`method-desc-${method.value}`}
                />
                <div className="flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-primary-action" : "text-primary"
                    )}
                  >
                    {method.label}
                  </p>
                  <p
                    id={`method-desc-${method.value}`}
                    className="text-xs text-tertiary"
                  >
                    {method.description}
                  </p>
                </div>
              </label>
            );
          })}
        </fieldset>

        {/* Invoice selection (only for invoice_offset) */}
        {selectedMethod === "invoice_offset" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-primary">
              Select Invoice
            </label>

            {selectedInvoice ? (
              <div className="flex items-center justify-between rounded-lg border border-color bg-surface-alt p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-tertiary" />
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {selectedInvoice.invoice_number ?? "Unnamed Invoice"}
                    </p>
                    {selectedInvoice.customer_name && (
                      <p className="text-xs text-tertiary">
                        {selectedInvoice.customer_name}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="text-xs text-tertiary hover:text-primary"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search invoices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-input-border bg-surface pl-10 pr-3 py-2 text-sm text-primary placeholder-tertiary focus:border-primary-action focus:outline-none focus:ring-1 focus:ring-primary-action"
                  />
                </div>

                {searchQuery && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-color">
                    {searchLoading && (
                      <p className="p-3 text-sm text-tertiary">Searching…</p>
                    )}
                    {!searchLoading && searchResults.length === 0 && (
                      <p className="p-3 text-sm text-tertiary">
                        No invoices found
                      </p>
                    )}
                    {!searchLoading &&
                      searchResults.map((inv) => (
                        <button
                          key={inv.id}
                          onClick={() => handleInvoiceSelect(inv)}
                          className="w-full cursor-pointer rounded-lg p-3 text-left hover:bg-surface-alt first:rounded-t-lg last:rounded-b-lg last:border-0 border-b border-color-subtle"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-primary">
                                {inv.invoice_number ?? "Unnamed Invoice"}
                              </p>
                              {inv.customer_name && (
                                <p className="text-xs text-tertiary">
                                  {inv.customer_name}
                                </p>
                              )}
                            </div>
                            <div className="text-right font-tabular-nums">
                              <p className="text-sm text-primary">
                                {formatCurrency(inv.total, inv.currency)}
                              </p>
                              <p className="text-xs text-tertiary">
                                Due {formatDate(inv.due_date ?? undefined)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </>
            )}

            {!selectedInvoice && referenceInvoice && (
              <div className="border-t border-color-subtle pt-3">
                <button
                  onClick={() =>
                    handleInvoiceSelect({
                      id: referenceInvoice.id,
                      invoice_number:
                        referenceInvoice.invoice_number ?? null,
                      customer_name: referenceInvoice.customer_name ?? null,
                      customer_email: referenceInvoice.customer_email ?? null,
                      customer_id: referenceInvoice.customer_id ?? null,
                      status: referenceInvoice.status,
                      issue_date: referenceInvoice.issue_date ?? null,
                      due_date: referenceInvoice.due_date ?? null,
                      currency: referenceInvoice.currency,
                      total: referenceInvoice.total,
                      amount_paid: referenceInvoice.amount_paid ?? "0",
                      amount_due: referenceInvoice.amount_due ?? "0",
                    } as ApiInvoiceListItem)
                  }
                  className="flex w-full items-center gap-2 rounded-lg border border-primary-action/30 bg-primary-bg/5 p-3 text-left text-sm font-medium text-primary-action hover:bg-primary-bg/10"
                >
                  <FileText className="h-4 w-4" />
                  Use reference invoice (
                  {creditNote.reference_invoice_number ?? "unknown"})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Amount input */}
        <div className="space-y-2">
          <label
            htmlFor="apply-amount"
            className="block text-sm font-medium text-primary"
          >
            {getAmountInputLabel()}
          </label>
          <div className="relative">
            <input
              id="apply-amount"
              type="number"
              step="0.01"
              min="0"
              max={maxApply.toFixed(2)}
              placeholder={getDefaultAmountPlaceholder()}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-input-border bg-surface pl-3 pr-20 py-2 text-sm text-primary placeholder-tertiary focus:border-primary-action focus:outline-none focus:ring-1 focus:ring-primary-action font-tabular-nums"
            />
            <span className="absolute right-3 top-2.5 text-sm text-tertiary">
              {creditNote.currency.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-tertiary">
            Leave empty to apply the full remaining balance (
            {formatCurrency(maxApply, creditNote.currency)}).
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2 border-t border-color pt-4">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={
              (selectedMethod === "invoice_offset" && !selectedInvoice) ||
              (!!amount && new Decimal(amount).isNegative())
            }
          >
            Apply Credit Note
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
