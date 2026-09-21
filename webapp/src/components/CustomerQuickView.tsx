import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { X, Phone, Mail, MapPin, FileText, Plus } from "lucide-react";
import { getCustomerSummary, createInvoice as apiCreateInvoice } from "../api/client";
import type { ApiCustomerSummary } from "../types/api";
import { formatCurrency } from "../utils/format";

interface CustomerQuickViewProps {
  customerId: string;
  customerName: string;
  currency?: string;
  onClose: () => void;
}

export default function CustomerQuickView({
  customerId,
  customerName,
  currency = "USD",
  onClose,
}: CustomerQuickViewProps) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ApiCustomerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSummary();
    // Close on Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [customerId]);

  async function loadSummary() {
    setLoading(true);
    try {
      const data = await getCustomerSummary(customerId);
      setSummary(data.summary);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvoice() {
    if (!summary?.customer) return;
    setCreating(true);
    try {
      const res = await apiCreateInvoice({
        customerId: summary.customer.id,
        currency: summary.customer.defaultCurrency || currency,
        items: [
          {
            description: "",
            quantity: "1",
            unit: "each",
            unitPrice: "0.00",
            taxRate: "0",
            isTaxInclusive: false,
          },
        ],
      });
      onClose();
      navigate(`/app/invoices/${res.invoiceId}/edit`);
    } catch {
      // ignore — surface via native alert for field use
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${customerName}`}
        className="fixed inset-y-0 bottom-0 z-50 w-full max-w-md ml-auto md:ml-0 md:mr-0 md:top-16 md:bottom-16 md:w-96 shadow-xl bg-surface-alt flex flex-col rounded-t-2xl md:rounded-l-2xl md:rounded-r-none border-l border-color-subtle animate-in slide-in-from-bottom duration-200"
      >
        <div className="flex items-center justify-between p-4 border-b border-color-subtle bg-surface rounded-t-2xl md:rounded-tl-2xl">
          <h2 className="text-lg font-semibold text-primary">{customerName}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-secondary hover:text-secondary hover:bg-surface-alt"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-tertiary">Loading…</div>
          ) : !summary ? (
            <div className="text-center py-10 text-tertiary">Could not load details.</div>
          ) : (
            <>
              {/* Contact */}
              <div className="bg-surface rounded-lg border border-color-subtle p-3 text-sm">
                <h3 className="text-xs font-medium text-secondary uppercase mb-2">Contact</h3>
                <ul className="space-y-1.5 text-secondary">
                  {summary.customer.email && (
                    <li className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-tertiary" />
                      <span>{summary.customer.email}</span>
                    </li>
                  )}
                  {summary.customer.phone && (
                    <li className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-tertiary" />
                      <span>{summary.customer.phone}</span>
                    </li>
                  )}
                  {summary.customer.address && (
                    <li className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-tertiary mt-0.5" />
                      <span>
                        {[
                          summary.customer.address.addressLine1,
                          summary.customer.address.addressLine2,
                          summary.customer.address.city,
                          summary.customer.address.stateOrRegion,
                          summary.customer.address.postalCode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Financial summary */}
              <div className="bg-surface rounded-lg border border-color-subtle p-3">
                <h3 className="text-xs font-medium text-secondary uppercase mb-2">Financial</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-tertiary">Invoiced</dt>
                    <dd className="font-medium text-primary">
                      {formatCurrency(summary.totalBilled || "0", summary.customer.defaultCurrency || currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tertiary">Paid</dt>
                    <dd className="font-medium status-success-text">
                      {formatCurrency(summary.totalPaid || "0", summary.customer.defaultCurrency || currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tertiary">Outstanding</dt>
                    <dd className="font-medium text-primary">
                      {formatCurrency(summary.totalOutstanding || "0", summary.customer.defaultCurrency || currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tertiary">Overdue</dt>
                    <dd className="font-medium status-error-text">
                      {formatCurrency(summary.totalOverdue || "0", summary.customer.defaultCurrency || currency)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Recent invoices */}
              <div className="bg-surface rounded-lg border border-color-subtle p-3">
                <h3 className="text-xs font-medium text-secondary uppercase mb-2">Recent Invoices</h3>
                {summary.invoices.length === 0 ? (
                  <p className="text-xs text-tertiary">No invoices yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {summary.invoices.slice(0, 3).map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between text-sm">
                        <Link
                          to={`/app/invoices/${inv.id}`}
                          onClick={onClose}
                          className="text-primary hover:text-primary-brand font-medium"
                        >
                          {inv.invoiceNumber || `#${inv.id.slice(0, 8)}`}
                        </Link>
                        <span className="text-secondary">
                          {formatCurrency(inv.amountDue || inv.total, inv.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-color-subtle bg-surface rounded-b-2xl md:rounded-bl-2xl">
          <button
            onClick={() => summary?.customer && handleCreateInvoice()}
            disabled={creating || !summary?.customer}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {creating ? "Creating…" : "Create Invoice"}
          </button>
          <Link
            to={`/app/customers/${customerId}`}
            onClick={onClose}
            className="mt-2 inline-flex items-center justify-center gap-2 w-full rounded-lg border border-input-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
          >
            <FileText className="w-4 h-4" />
            View Full Profile
          </Link>
        </div>
      </div>
    </>
  );
}




