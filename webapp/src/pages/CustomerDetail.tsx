import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import {
  getCustomer,
  getCustomerSummary,
  archiveCustomer,
  restoreCustomer,
} from "../api/client";
import FeatureGate from "../components/FeatureGate";
import CustomerStatusBadge from "../components/CustomerStatusBadge";
import CustomerForm from "../components/CustomerForm";
import { formatCurrency } from "../utils/format";
import { useMetaTags } from "@/hooks/useMetaTags";
import type { ApiCustomer, ApiCustomerSummary } from "../types/api";

export default function CustomerDetail() {
  useMetaTags({
    title: "Customer Profile — DocForge",
    description: "View customer details, invoice history, and outstanding balances.",
    noIndex: true,
  });

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<ApiCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadCustomer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadCustomer() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomer(id);
      setCustomer(data.customer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive() {
    if (!customer || !confirm(`Archive ${customer.name}? This is reversible.`)) return;
    try {
      await archiveCustomer(customer.id);
      await loadCustomer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to archive customer");
    }
  }

  async function handleRestore() {
    if (!customer) return;
    try {
      await restoreCustomer(customer.id);
      await loadCustomer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to restore customer");
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-secondary">Loading customer...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="status-error-text">{error}</p>
        <button
          onClick={() => navigate("/app/customers")}
          className="mt-4 text-sm text-primary-brand hover:text-primary-brand"
        >
          Back to Customers
        </button>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/customers")}
            className="text-secondary hover:text-secondary"
          >
            &larr; Customers
          </button>
          <h1 className="text-2xl font-bold text-primary">{customer.name}</h1>
          <CustomerStatusBadge status={customer.status} />
        </div>
        <div className="flex items-center gap-2">
          <FeatureGate feature="customers.edit" requiredPlan="free" fallback={null}>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-input-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
            >
              Edit
            </button>
          </FeatureGate>
          {customer.status === "archived" ? (
            <button
              onClick={handleRestore}
              className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={handleArchive}
              className="rounded-lg status-error-text px-4 py-2 text-sm font-medium text-on-primary hover:status-error-text"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <CustomerForm
          customer={customer}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadCustomer(); }}
        />
      )}

      <CustomerDetailContent customer={customer} />
    </div>
  );
}

function CustomerDetailContent({ customer }: { customer: ApiCustomer }) {
  const [summary, setSummary] = useState<ApiCustomerSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    loadSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  async function loadSummary() {
    try {
      const data = await getCustomerSummary(customer.id);
      setSummary(data.summary);
    } catch {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  const currency = summary?.customer.defaultCurrency || customer.defaultCurrency || "USD";
  const totalInvoiceCount = summary?.totalInvoiceCount ?? 0;
  const finalizedCount = summary?.finalizedInvoiceCount ?? 0;
  const averagePaymentDays = summary?.averagePaymentDays ?? undefined;

  return (
    <>
      {renderFinancialSummary(summary, loadingSummary, currency, totalInvoiceCount, finalizedCount, averagePaymentDays)}


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-surface rounded-xl border border-color-subtle p-6">
            <h3 className="text-sm font-medium text-secondary uppercase mb-4">Contact Information</h3>
            <dl className="space-y-3">
              <InfoRow label="Name" value={customer.name} />
              {customer.companyName && <InfoRow label="Company" value={customer.companyName} />}
              {customer.email && <InfoRow label="Email" value={customer.email} />}
              {customer.phone && <InfoRow label="Phone" value={customer.phone} />}
              {customer.taxId && <InfoRow label="Tax ID" value={customer.taxId} />}
              {customer.paymentTerms && <InfoRow label="Payment Terms" value={`${customer.paymentTerms} days`} />}
              <InfoRow
                label="Address"
                value={
                  [
                    customer.address?.addressLine1,
                    customer.address?.addressLine2,
                    customer.address?.city,
                    customer.address?.stateOrRegion,
                    customer.address?.postalCode,
                    customer.address?.countryCode,
                  ].filter(Boolean).join(", ") || "”"
                }
              />
              {customer.notes && <InfoRow label="Notes" value={customer.notes} preWrap />}
            </dl>
          </div>

          {customer.taxIdentifiers && customer.taxIdentifiers.length > 0 && (
            <div className="bg-surface rounded-xl border border-color-subtle p-6">
              <h3 className="text-sm font-medium text-secondary uppercase mb-4">Tax Identifiers</h3>
              <ul className="space-y-2">
                {customer.taxIdentifiers.map((ti) => (
                  <li key={ti.id} className="flex justify-between">
                    <span className="text-sm text-primary">{ti.type}: {ti.value}</span>
                    {ti.isDefault && <span className="text-xs text-secondary">Default</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value, preWrap }: { label: string; value: string; preWrap?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className={`text-sm text-primary ${preWrap ? "whitespace-pre-wrap" : ""}`}>{value}</dd>
    </div>
  );
}

function FinancialSummaryCard({
  title, value, subtitle, color,
}: {
  title: string; value: string; subtitle?: string; color?: "primary" | "green" | "red" | "slate";
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const colorClasses: Record<string, string> = {
    primary: "bg-primary-bg text-primary-brand",
    green: "status-success-bg status-success-text",
    red: "status-error-bg status-error-text",
    slate: "bg-surface-alt text-secondary",
  };
  return (
    <div className="bg-surface rounded-xl border border-color-subtle p-5 shadow-sm">
      <p className="text-xs font-medium text-secondary uppercase">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color === "red" ? "status-error-text" : "text-primary"}`}>
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-secondary">{subtitle}</p>}
    </div>
  );
}

function renderFinancialSummary(
  summary: ApiCustomerSummary | null,
  loading: boolean,
  currency: string,
  totalInvoiceCount: number,
  finalizedCount: number,
  averagePaymentDays?: number
) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-color-subtle p-5 animate-pulse">
            <div className="h-3 w-20 bg-surface-alt rounded mb-2" />
            <div className="h-7 w-24 bg-surface-alt rounded mb-1" />
            <div className="h-3 w-16 bg-surface-alt rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-surface rounded-xl border border-color-subtle p-6">
        <p className="text-sm text-secondary">Financial summary unavailable.</p>
      </div>
    );
  }

  const hasOutstanding = new Decimal(summary.totalOutstanding ?? 0).gt(0);
  const hasOverdue = new Decimal(summary.totalOverdue ?? 0).gt(0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <FinancialSummaryCard
        title="Total Invoiced"
        value={formatCurrency(summary.totalBilled, currency)}
        subtitle={`${totalInvoiceCount} invoice${totalInvoiceCount !== 1 ? "s" : ""}`}
        color="primary"
      />
      <FinancialSummaryCard
        title="Total Paid"
        value={formatCurrency(summary.totalPaid, currency)}
        subtitle={`${finalizedCount} finalized invoices`}
        color="green"
      />
      <FinancialSummaryCard
        title="Outstanding Balance"
        value={formatCurrency(summary.totalOutstanding || "0", currency)}
        subtitle={hasOutstanding ? "Awaiting payment" : "All paid"}
        color={hasOutstanding ? "red" : "slate"}
      />
      <FinancialSummaryCard
        title="Overdue Balance"
        value={hasOverdue ? formatCurrency(summary.totalOverdue || "0", currency) : "”"}
        subtitle={hasOverdue ? "Past due" : "None overdue"}
        color={hasOverdue ? "red" : "slate"}
      />
      {averagePaymentDays !== undefined && (
        <FinancialSummaryCard
          title="Avg. Payment Time"
          value={`${averagePaymentDays} days`}
          subtitle="Time to receive payment"
          color="slate"
        />
      )}
    </div>
  );
}






