import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  FileText,
  Send,
  CheckCircle,
  Clock,
  Plus,
  DollarSign,
  Palette,
  BarChart3,
  Calendar,
  Users,
} from "lucide-react";
import {
  getProprietaryInvoices,
  getProprietaryQuotes,
  getProprietaryInvoiceStatusReport,
  getProprietaryRevenueReport,
  getProprietaryPaymentSummary,
} from "../api/client";
import { useQuery } from "@tanstack/react-query";
import { KPICard, Skeleton } from "@/components/ui";
import { formatCurrencyValue } from "@/lib/utils";
import { useMetaTags } from "@/hooks/useMetaTags";
import {
  StatusBadge,
  invoiceStatusConfig,
  quoteStatusConfig,
} from "@/components/ui";

function getGreeting(name: string | undefined): string {
  if (!name) return "Good day";
  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  return `${greeting}, ${name}`;
}

function deriveNameFromEmail(email: string | undefined): string {
  if (!email) return "";
  const local = email.split("@")[0];
  const name = local.split(/[._-]/)[0];
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

export default function ProprietaryDashboard() {
  useMetaTags({
    title: "Dashboard — DocForge",
    description: "Overview of your invoices, payments, and revenue.",
    noIndex: true,
  });

  const { user } = useAuth();
  const displayName = deriveNameFromEmail(user?.email);
  const greeting = useMemo(() => getGreeting(displayName), [displayName]);

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
  } = useQuery({
    queryKey: ["proprietary-invoices"],
    queryFn: () => getProprietaryInvoices({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: quotesData,
    isLoading: quotesLoading,
  } = useQuery({
    queryKey: ["proprietary-quotes"],
    queryFn: () => getProprietaryQuotes({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: statusReport,
  } = useQuery({
    queryKey: ["proprietary-status-report"],
    queryFn: () => getProprietaryInvoiceStatusReport(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: revenueData,
  } = useQuery({
    queryKey: ["proprietary-revenue"],
    queryFn: () =>
      getProprietaryRevenueReport({ dateFrom: "1970-01-01", groupBy: "month" }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: paymentSummaryData,
  } = useQuery({
    queryKey: ["proprietary-payment-summary"],
    queryFn: () => getProprietaryPaymentSummary(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const invoices = useMemo(() => invoicesData?.invoices ?? [], [invoicesData?.invoices]);
  const quotes = useMemo(() => quotesData?.quotes ?? [], [quotesData?.quotes]);

  const totalRevenue = useMemo(() => {
    const fromReport = (revenueData?.data ?? []).reduce(
      (sum: number, row: any) => sum + parseFloat(row.total || "0"),
      0,
    );
    if (fromReport > 0) return fromReport;
    const paidInvoices = invoices.filter((inv) => inv.status === "paid");
    return paidInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.total || "0"),
      0,
    );
  }, [invoices, revenueData]);

  const totalOutstanding = useMemo(() => {
    const outstandingInvoices = invoices.filter(
      (inv) => inv.status === "sent" || inv.status === "partially_paid" || inv.status === "overdue",
    );
    return outstandingInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.amount_due || inv.total || "0"),
      0,
    );
  }, [invoices]);

  const totalOverdue = useMemo(() => {
    const overdue = invoices.filter((inv) => inv.status === "overdue");
    return overdue.reduce(
      (sum, inv) => sum + parseFloat(inv.amount_due || inv.total || "0"),
      0,
    );
  }, [invoices]);

  const draftCount = invoices.filter((inv) => inv.status === "draft").length;
  const sentCount = invoices.filter((inv) => inv.status === "sent").length;
  const paidCount = invoices.filter((inv) => inv.status === "paid").length;

  const recentInvoices = invoices.slice(0, 5);
  const recentQuotes = quotes.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">{greeting}</h1>
          <p className="text-secondary mt-1">
            Here's your business financial overview at a glance.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/app/proprietary/branding"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-input-border text-secondary hover:bg-hover transition-colors"
          >
            <Palette className="h-4 w-4 mr-2" />
            Branding
          </Link>
          <Link
            to="/app/proprietary/reports"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-input-border text-secondary hover:bg-hover transition-colors"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Link>
          <Link
            to="/app/proprietary/recurring-invoices"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-input-border text-secondary hover:bg-hover transition-colors"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Recurring
          </Link>
          <Link
            to="/app/proprietary/email-templates"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-input-border text-secondary hover:bg-hover transition-colors"
          >
            <Send className="h-4 w-4 mr-2" />
            Email Templates
          </Link>
          <Link
            to="/app/proprietary/customers"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-input-border text-secondary hover:bg-hover transition-colors"
          >
            <Users className="h-4 w-4 mr-2" />
            Customers
          </Link>
          <Link
             to="/app/proprietary/invoices/new"
             className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-primary-action text-on-primary hover:bg-primary-hover transition-colors"
           >
             <Plus className="h-4 w-4 mr-2" />
             New Invoice
           </Link>
         </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrencyValue(totalRevenue)}
          icon={<DollarSign className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Outstanding"
          value={formatCurrencyValue(totalOutstanding)}
          icon={<Clock className="h-5 w-5" />}
          state="warning"
          variant="default"
        />
        <KPICard
          title="Overdue"
          value={formatCurrencyValue(totalOverdue)}
          icon={<Clock className="h-5 w-5" />}
          state="error"
          variant="default"
        />
        <KPICard
          title="Draft Invoices"
          value={draftCount.toString()}
          icon={<FileText className="h-5 w-5" />}
          variant="default"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Sent"
          value={sentCount.toString()}
          icon={<Send className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Paid"
          value={paidCount.toString()}
          icon={<CheckCircle className="h-5 w-5" />}
          state="success"
          variant="default"
        />
        <KPICard
          title="Active Quotes"
          value={recentQuotes.length.toString()}
          icon={<FileText className="h-5 w-5" />}
          variant="default"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Invoices</h2>
          {invoicesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : recentInvoices.length === 0 ? (
            <p className="text-secondary text-sm">No invoices yet. Create your first invoice to get started.</p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{inv.invoice_number || inv.id.slice(0, 8)}</p>
                      <p className="text-sm text-secondary">
                        {(inv as any).customer_name || "Unknown customer"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={inv.status || "draft"} config={invoiceStatusConfig} />
                    <span className="font-medium text-right min-w-[80px]">
                      {formatCurrencyValue(parseFloat(inv.total || "0"), inv.currency || "USD")}
                    </span>
                  </div>
                </div>
              ))}
              {recentInvoices.length > 0 && (
                <Link
                  to="/app/proprietary/documents"
                  className="block w-full text-center mt-2 px-3 py-1.5 text-sm text-secondary hover:text-primary hover:bg-muted rounded transition-colors"
                >
                  View all invoices
                </Link>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Quotes</h2>
          {quotesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : recentQuotes.length === 0 ? (
            <p className="text-secondary text-sm">No quotes yet.</p>
          ) : (
            <div className="space-y-2">
              {recentQuotes.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{q.quote_number || q.id.slice(0, 8)}</p>
                      <p className="text-sm text-secondary">
                        {(q as any).customer_name || "Unknown customer"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={q.status || "draft"} config={quoteStatusConfig} />
                    <span className="font-medium text-right min-w-[80px]">
                      {formatCurrencyValue(parseFloat(q.total || "0"), q.currency || "USD")}
                    </span>
                  </div>
                </div>
              ))}
              {recentQuotes.length > 0 && (
                <Link
                  to="/app/proprietary/documents"
                  className="block w-full text-center mt-2 px-3 py-1.5 text-sm text-secondary hover:text-primary hover:bg-muted rounded transition-colors"
                >
                  View all quotes
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Invoice Status Summary</h2>
        {statusReport?.data?.length ? (
          <div className="grid gap-2 md:grid-cols-5">
            {statusReport.data.map((item: any) => (
              <div key={item.status} className="p-3 border rounded-lg text-center">
                <p className="text-sm text-secondary">{item.status}</p>
                <p className="text-xl font-bold">{item.count}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrencyValue(parseFloat(item.total || "0"))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary text-sm">No invoice data available yet.</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Payment Summary</h2>
        {paymentSummaryData?.summary?.length ? (
          <div className="grid gap-2 md:grid-cols-3">
            {paymentSummaryData.summary.map((row: any) => (
              <div key={row.currency} className="p-3 border rounded-lg text-center">
                <p className="text-sm text-secondary">Received ({row.currency || "USD"})</p>
                <p className="text-xl font-bold">
                  {formatCurrencyValue(parseFloat(row.total_received || "0"), row.currency || "USD")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.total_payments} transactions
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary text-sm">No payments received yet.</p>
        )}
      </div>
    </div>
  );
}
