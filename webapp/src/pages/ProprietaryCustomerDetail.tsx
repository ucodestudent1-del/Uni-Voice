import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, FileText, Edit, Send } from "lucide-react";
import {
  getProprietaryCustomer,
  getProprietaryCustomerTotalSummary,
  getProprietaryCustomerInvoiceHistory,
  markProprietaryInvoicePaid,
  getProprietaryInvoiceShareLink,
  type ApiInvoiceListItem,
} from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, DataTable, StatusBadge, KPICard, Skeleton, customerStatusConfig, invoiceStatusConfig, useToast } from "@/components/ui";
import { formatCurrencyValue } from "@/lib/utils";
import { useMetaTags } from "@/hooks/useMetaTags";
import type { ColumnDef } from "@/types/components";

interface CustomerDetail {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  tax_id?: string | null;
  address?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateOrRegion?: string | null;
    postalCode?: string | null;
    countryCode?: string | null;
  };
  country_code?: string | null;
  default_currency?: string | null;
  notes?: string | null;
  status: string;
  payment_terms?: number | null;
  created_at: string;
  updated_at: string;
}

export default function ProprietaryCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useMetaTags({
    title: "Customer Details — DocForge",
    description: "View customer details and invoice history.",
    noIndex: true,
  });

  const {
    data: customerData,
    isLoading: customerLoading,
  } = useQuery({
    queryKey: ["proprietary-customer", id],
    queryFn: () => getProprietaryCustomer(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: summaryData,
    isLoading: summaryLoading,
  } = useQuery({
    queryKey: ["proprietary-customer-summary", id],
    queryFn: () => getProprietaryCustomerTotalSummary(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["proprietary-customer-invoices", id],
    queryFn: () => getProprietaryCustomerInvoiceHistory(id!, { limit: 100 }),
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ invoiceId, amount }: { invoiceId: string; amount: number }) =>
      markProprietaryInvoicePaid(invoiceId, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-customer-invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["proprietary-customer-summary", id] });
      toast("Payment recorded.", { title: "Success", type: "success" });
    },
    onError: () => toast("Failed to record payment.", { title: "Error", type: "error" }),
  });

  const customer: CustomerDetail | undefined = customerData?.customer;
  const summary = summaryData?.summary;
  const invoices: ApiInvoiceListItem[] = historyData?.invoices ?? [];

  const columns: ColumnDef<ApiInvoiceListItem>[] = [
    {
      header: "Invoice #",
      accessor: (row: any) => (
        <Link
          to={`/app/proprietary/invoices/${row.id}/edit`}
          className="font-medium text-primary hover:underline"
        >
          {row.invoice_number || row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      header: "Date",
      accessor: (row: any) => row.issue_date || row.created_at || "—",
    },
    {
      header: "Status",
      accessor: (row: any) => (
        <StatusBadge status={row.status || "draft"} config={invoiceStatusConfig} size="sm" />
      ),
    },
    {
      header: "Total",
      accessor: (row: any) => formatCurrencyValue(row.total, row.currency || "USD"),
    },
    {
      header: "Outstanding",
      accessor: (row: any) => formatCurrencyValue(row.amount_due || row.total || 0, row.currency || "USD"),
    },
    {
      header: "Actions",
      accessor: (row: any) => (
        <div className="flex gap-2 justify-end">
          <button
            onClick={async () => {
              try {
                await getProprietaryInvoiceShareLink(row.id);
                toast("Share link generated.", { title: "Success", type: "info" });
              } catch {
                toast("Failed to generate share link.", { title: "Error", type: "error" });
              }
            }}
            className="text-secondary hover:text-primary"
            title="Share link"
          >
            <Send className="h-4 w-4" />
          </button>
          {!row.is_finalized && row.status !== "paid" && (
            <button
              onClick={() => markPaidMutation.mutate({ invoiceId: row.id, amount: parseFloat(row.total || "0") })}
              className="text-secondary hover:text-primary"
              title="Mark paid"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const formatAddress = (customer: CustomerDetail) => {
    const addr = customer.address || {};
    const parts = [addr.addressLine1, addr.addressLine2, addr.city, addr.stateOrRegion, addr.postalCode, addr.countryCode || customer.country_code];
    return parts.filter(Boolean).join(", ") || "—";
  };

  if (customerLoading || !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => navigate("/app/proprietary")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate("/app/proprietary/customers")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Customers
        </Button>
        <h1 className="text-2xl font-bold text-primary">{customer.name}</h1>
        <div className="ml-auto">
          <StatusBadge status={customer.status || "active"} config={customerStatusConfig} size="sm" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Total Invoiced"
          value={formatCurrencyValue(summary?.totalBilled ?? 0)}
          icon={<FileText className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Total Paid"
          value={formatCurrencyValue(summary?.totalPaid ?? 0)}
          icon={<FileText className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Outstanding"
          value={formatCurrencyValue(summary?.totalOutstanding ?? 0)}
          icon={<FileText className="h-5 w-5" />}
          variant="default"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-3">Customer Details</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-secondary">Name</span>
              <p className="font-medium">{customer.name}</p>
              {customer.company_name && <p className="text-sm text-secondary">{customer.company_name}</p>}
            </div>
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="text-sm hover:underline">
                  {customer.email}
                </a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{customer.phone}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-sm">{formatAddress(customer)}</span>
            </div>
            {customer.tax_id && (
              <div>
                <span className="text-sm text-secondary">Tax ID</span>
                <p className="font-medium">{customer.tax_id}</p>
              </div>
            )}
            {customer.notes && (
              <div>
                <span className="text-sm text-secondary">Notes</span>
                <p className="text-sm">{customer.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Financial Summary</h2>
          {summaryLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : summary ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-secondary">Invoices</span>
                <span className="font-medium">{summary.totalInvoiceCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-secondary">Finalized</span>
                <span className="font-medium">{summary.finalizedInvoiceCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-secondary">Total Paid</span>
                <span className="font-medium">{formatCurrencyValue(summary.totalPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-secondary">Total Overdue</span>
                <span className="font-medium text-red-600">{formatCurrencyValue(summary.totalOverdue)}</span>
              </div>
              {summary.averagePaymentDays !== null && (
                <div className="flex justify-between">
                  <span className="text-sm text-secondary">Avg. Payment Days</span>
                  <span className="font-medium">{Math.round(summary.averagePaymentDays)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-secondary text-sm">No financial data available.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
          <div className="flex gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-secondary">
              {summary?.totalInvoiceCount ?? invoices.length} total invoices
            </span>
          </div>
        </div>
        {historyLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : invoices.length === 0 ? (
          <p className="text-secondary text-sm">No invoices for this customer.</p>
        ) : (
          <DataTable columns={columns} data={invoices} rowKey="id" />
        )}
      </div>
    </div>
  );
}
