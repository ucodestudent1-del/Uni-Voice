import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  X,
  Mail,
  Phone,
  MapPin,
  FileText,
  Plus,
  Pencil,
  Building2,
  CalendarDays,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Landmark,
} from "lucide-react";
import { getCustomerSummary, createInvoice as apiCreateInvoice } from "../api/client";
import type { ApiCustomer, ApiCustomerSummary, ApiCustomerInvoiceSummary } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";
import {
  formatAddressLines,
  getCustomerBillingSnapshot,
  getCustomerDisplayName,
  getCustomerInitials,
  getInvoiceAmountDue,
  getInvoiceDisplayStatus,
  getInvoiceReference,
} from "../utils/customer";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";
import InvoiceStatusBadge from "./InvoiceStatusBadge";
import CustomerStatusBadge from "./CustomerStatusBadge";

interface CustomerQuickViewProps {
  /** Full customer row so identity renders immediately while the summary loads. */
  customer: ApiCustomer;
  onClose: () => void;
  onEdit?: (customer: ApiCustomer) => void;
}

export default function CustomerQuickView({ customer, onClose, onEdit }: CustomerQuickViewProps) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ApiCustomerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const currency = summary?.customer.defaultCurrency || customer.defaultCurrency || "USD";
  const billing = useMemo(
    () => (summary ? getCustomerBillingSnapshot(summary) : null),
    [summary]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    getCustomerSummary(customer.id)
      .then((data) => {
        if (active) setSummary(data.summary);
      })
      .catch(() => {
        if (active) {
          setSummary(null);
          setLoadError("We couldn't load this customer's billing summary.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [customer.id, onClose]);

  async function handleCreateInvoice() {
    setCreating(true);
    try {
      const res = await apiCreateInvoice({
        customerId: customer.id,
        currency,
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
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create invoice");
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
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${getCustomerDisplayName(customer)}`}
        className="fixed inset-y-0 bottom-0 z-50 flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-l border-color-subtle bg-surface shadow-xl animate-in slide-in-from-bottom duration-200 md:ml-auto md:bottom-16 md:top-16 md:rounded-l-2xl md:rounded-r-none md:w-[26rem]"
      >
        <PanelHeader customer={customer} onClose={onClose} />

        <div className="flex-1 overflow-y-auto">
          <Section title="Contact" icon={<Mail className="h-3.5 w-3.5" />}>
            <ContactList customer={customer} />
          </Section>

          <Section title="Billing" icon={<Receipt className="h-3.5 w-3.5" />}>
            {loading ? (
              <BillingSkeleton />
            ) : !summary || !billing ? (
              <InlineNotice tone="error" icon={<AlertCircle className="h-3.5 w-3.5" />}>
                {loadError ?? "Billing summary unavailable."}
              </InlineNotice>
            ) : (
              <BillingSummary
                billing={billing}
                currency={currency}
                invoiceCount={summary.totalInvoiceCount}
              />
            )}
          </Section>

          <Section
            title="Recent invoices"
            icon={<FileText className="h-3.5 w-3.5" />}
            action={
              summary && summary.totalInvoiceCount > (summary.invoices?.length ?? 0) ? (
                <Link
                  to={`/app/customers/${customer.id}`}
                  onClick={onClose}
                  className="text-xs font-medium text-primary-brand hover:underline"
                >
                  View all
                </Link>
              ) : null
            }
          >
            {loading ? (
              <InvoiceSkeleton />
            ) : !summary ? (
              <InlineNotice tone="muted" icon={<AlertCircle className="h-3.5 w-3.5" />}>
                Invoice history is unavailable right now.
              </InlineNotice>
            ) : (summary.invoices?.length ?? 0) === 0 ? (
              <InlineNotice tone="muted" icon={<Receipt className="h-3.5 w-3.5" />}>
                No invoices yet. Create the first invoice to start tracking this account.
              </InlineNotice>
            ) : (
              <InvoiceList invoices={summary.invoices} defaultCurrency={currency} />
            )}
          </Section>
        </div>

        <div className="border-t border-color-subtle bg-surface p-4 md:rounded-bl-2xl">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => (onEdit ? onEdit(customer) : navigate(`/app/customers/${customer.id}`))}
              className="w-full"
            >
              Edit details
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleCreateInvoice}
              disabled={creating}
              className="w-full"
            >
              {creating ? "Creating…" : "New invoice"}
            </Button>
          </div>
          <Link
            to={`/app/customers/${customer.id}`}
            onClick={onClose}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-primary-brand hover:bg-surface-alt"
          >
            <Building2 className="h-4 w-4" />
            Open full profile
          </Link>
        </div>
      </aside>
    </>
  );
}

function PanelHeader({ customer, onClose }: { customer: ApiCustomer; onClose: () => void }) {
  const displayName = getCustomerDisplayName(customer);
  const subName = customer.companyName ? customer.name : null;
  const created = formatDate(customer.createdAt);

  return (
    <div className="border-b border-color-subtle bg-surface-alt px-4 py-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-bg text-sm font-semibold text-primary-brand"
        >
          {getCustomerInitials(customer)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-primary" title={displayName}>
            {displayName}
          </h2>
          {subName && (
            <p className="truncate text-sm text-secondary" title={subName}>
              {subName}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <CustomerStatusBadge status={customer.status} />
            {created && (
              <span className="inline-flex items-center gap-1 text-xs text-tertiary">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                Customer since {created}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-tertiary">
              <Landmark className="h-3 w-3" aria-hidden="true" />
              {customer.defaultCurrency || "USD"}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close customer details"
          className="rounded-lg p-1.5 text-tertiary hover:bg-surface hover:text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-color-subtle px-4 py-4 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-tertiary">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailRow({
  icon,
  label,
  children,
  muted = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="mt-0.5 shrink-0 text-tertiary" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-tertiary">{label}</p>
        <div className={cn("mt-0.5 text-sm break-words", muted ? "text-tertiary" : "text-primary")}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ContactList({ customer }: { customer: ApiCustomer }) {
  const addressLines = formatAddressLines(customer.address);
  const hasContact = Boolean(customer.email || customer.phone);

  return (
    <div className="divide-y divide-color-subtle">
      <DetailRow icon={<Mail className="h-4 w-4" />} label="Email">
        {customer.email ? (
          <a href={`mailto:${customer.email}`} className="text-primary-brand hover:underline break-all">
            {customer.email}
          </a>
        ) : (
          <span className="text-tertiary">Not provided</span>
        )}
      </DetailRow>

      <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone">
        {customer.phone ? (
          <a href={`tel:${customer.phone}`} className="text-primary-brand hover:underline">
            {customer.phone}
          </a>
        ) : (
          <span className="text-tertiary">Not provided</span>
        )}
      </DetailRow>

      <DetailRow icon={<MapPin className="h-4 w-4" />} label="Billing address">
        {addressLines.length > 0 ? (
          <address className="not-italic leading-relaxed">
            {addressLines.map((line, i) => (
              <span key={line + i} className="block">
                {line}
              </span>
            ))}
          </address>
        ) : (
          <span className="text-tertiary">No billing address on file</span>
        )}
      </DetailRow>

      {customer.taxId && (
        <DetailRow icon={<FileText className="h-4 w-4" />} label="Tax ID">
          {customer.taxId}
        </DetailRow>
      )}

      {customer.paymentTerms ? (
        <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Payment terms">
          Net {customer.paymentTerms}
        </DetailRow>
      ) : null}

      {customer.notes ? (
        <DetailRow icon={<Pencil className="h-4 w-4" />} label="Notes" muted>
          {customer.notes}
        </DetailRow>
      ) : null}

      {!hasContact && addressLines.length === 0 && !customer.taxId && !customer.notes ? (
        <p className="py-2 text-sm text-tertiary">
          No contact details recorded. Use “Edit details” to add an email, phone, or address.
        </p>
      ) : null}
    </div>
  );
}

function BillingSummary({
  billing,
  currency,
  invoiceCount,
}: {
  billing: ReturnType<typeof getCustomerBillingSnapshot>;
  currency: string;
  invoiceCount: number;
}) {
  const hasOutstanding = new Decimal(billing.outstanding).gt(0);
  const hasOverdue = new Decimal(billing.overdue).gt(0);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-lg border p-3",
          hasOverdue
            ? "border-error-border bg-error-bg"
            : hasOutstanding
            ? "border-warning-border bg-warning-bg"
            : "border-success-border bg-success-bg"
        )}
      >
        <div className="flex items-center gap-2">
          {hasOverdue || hasOutstanding ? (
            <AlertCircle className={cn("h-4 w-4", hasOverdue ? "text-error-text" : "text-warning-text")} />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success-text" />
          )}
          <p
            className={cn(
              "text-xs font-medium",
              hasOverdue ? "text-error-text" : hasOutstanding ? "text-warning-text" : "text-success-text"
            )}
          >
            {billing.label}
          </p>
        </div>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-primary">
          {formatCurrency(billing.outstanding, currency)}
        </p>
        <p className="mt-0.5 text-xs text-secondary">
          {hasOutstanding ? "Outstanding balance" : "Nothing outstanding"}
          {invoiceCount > 0 && ` · ${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"} on file`}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg border border-color-subtle bg-surface-alt px-2.5 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-tertiary">Invoiced</dt>
          <dd className="mt-0.5 truncate font-medium text-primary" title={formatCurrency(billing.billed, currency)}>
            {formatCurrency(billing.billed, currency)}
          </dd>
        </div>
        <div className="rounded-lg border border-color-subtle bg-surface-alt px-2.5 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-tertiary">Paid</dt>
          <dd className="mt-0.5 truncate font-medium status-success-text" title={formatCurrency(billing.paid, currency)}>
            {formatCurrency(billing.paid, currency)}
          </dd>
        </div>
        <div className="rounded-lg border border-color-subtle bg-surface-alt px-2.5 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-tertiary">Overdue</dt>
          <dd
            className={cn("mt-0.5 truncate font-medium", hasOverdue ? "status-error-text" : "text-tertiary")}
            title={formatCurrency(billing.overdue, currency)}
          >
            {hasOverdue ? formatCurrency(billing.overdue, currency) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function InvoiceList({
  invoices,
  defaultCurrency,
}: {
  invoices: ApiCustomerInvoiceSummary[];
  defaultCurrency: string;
}) {
  return (
    <ul className="divide-y divide-color-subtle">
      {invoices.slice(0, 4).map((inv) => (
        <InvoiceRow key={inv.id} invoice={inv} defaultCurrency={defaultCurrency} />
      ))}
    </ul>
  );
}

function InvoiceRow({
  invoice,
  defaultCurrency,
}: {
  invoice: ApiCustomerInvoiceSummary;
  defaultCurrency: string;
}) {
  const status = getInvoiceDisplayStatus(invoice);
  const currency = invoice.currency || defaultCurrency;
  const due = getInvoiceAmountDue(invoice);
  const hasDue = new Decimal(due).gt(0);
  const issued = formatDate(invoice.issueDate ?? invoice.createdAt);
  const dueDate = invoice.dueDate ? formatDate(invoice.dueDate) : null;

  return (
    <li className="py-2.5 first:pt-1 last:pb-0">
      <Link
        to={`/app/invoices/${invoice.id}`}
        className="group block rounded-lg px-1 py-1 -mx-1 hover:bg-surface-alt"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-primary group-hover:text-primary-brand">
              {getInvoiceReference(invoice)}
            </p>
            <p className="mt-0.5 text-xs text-tertiary">
              {issued ? `Issued ${issued}` : "Not issued"}
              {dueDate ? ` · Due ${dueDate}` : ""}
            </p>
          </div>
          <p className={cn("shrink-0 text-sm font-medium", hasDue ? "text-primary" : "status-success-text")}>
            {hasDue ? formatCurrency(due, currency) : formatCurrency(invoice.total, currency)}
          </p>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <InvoiceStatusBadge status={status} isOverdue={status === "overdue"} />
          {hasDue && (
            <span className="text-xs text-secondary">
              {formatCurrency(invoice.amountPaid ?? 0, currency)} paid
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function InlineNotice({
  icon,
  children,
  tone = "muted",
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border border-color-subtle bg-surface-alt px-3 py-2.5 text-sm",
        tone === "error" ? "status-error-text" : "text-tertiary"
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span>{children}</span>
    </p>
  );
}

function BillingSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      <div className="rounded-lg border border-color-subtle bg-surface-alt p-3">
        <div className="h-3 w-24 rounded bg-surface" />
        <div className="mt-2 h-7 w-32 rounded bg-surface" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-color-subtle bg-surface-alt px-2.5 py-2">
            <div className="h-2.5 w-12 rounded bg-surface" />
            <div className="mt-1.5 h-4 w-16 rounded bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-color-subtle p-2.5">
          <div className="h-3.5 w-24 rounded bg-surface-alt" />
          <div className="mt-2 h-2.5 w-32 rounded bg-surface-alt" />
        </div>
      ))}
    </div>
  );
}
