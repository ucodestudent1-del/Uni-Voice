import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, FileText, Quote as QuoteIcon, CreditCard } from "lucide-react";
import {
  Button,
  KPICard,
  StatusBadge,
  DataTable,
  EmptyState,
  Dialog,
  Skeleton,
} from "@/components/ui";
import type { ColumnDef } from "@/types/components";
import { formatDate } from "@/utils/format";
import { formatCurrencyValue } from "@/lib/utils";
import { getInvoices, getQuotes, getCreditNotes } from "@/api/client";
import type {
  ApiInvoiceListItem,
  ApiQuoteListItem,
  ApiCreditNoteListItem,
} from "@/types/api";
import {
  invoiceStatusConfig,
  quoteStatusConfig,
  creditNoteStatusConfig,
} from "@/components/ui";

type DocType = "invoice" | "quote" | "credit-note";

interface CreateOption {
  type: DocType;
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

const createOptions: CreateOption[] = [
  {
    type: "invoice",
    label: "Invoice",
    description: "Bill a customer for goods or services",
    icon: <FileText className="w-5 h-5" />,
    path: "/app/invoices/new",
  },
  {
    type: "quote",
    label: "Quote",
    description: "Provide a price estimate to a customer",
    icon: <QuoteIcon className="w-5 h-5" />,
    path: "/app/quotes/new",
  },
  {
    type: "credit-note",
    label: "Credit Note",
    description: "Issue a credit or refund to a customer",
    icon: <CreditCard className="w-5 h-5" />,
    path: "/app/credit-notes/new",
  },
];

export default function Documents() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"invoices" | "quotes" | "credit-notes">("invoices");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [invoices, setInvoices] = useState<ApiInvoiceListItem[]>([]);
  const [quotes, setQuotes] = useState<ApiQuoteListItem[]>([]);
  const [creditNotes, setCreditNotes] = useState<ApiCreditNoteListItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, quoteRes, cnRes] = await Promise.allSettled([
        getInvoices({ limit: 50 }),
        getQuotes({ limit: 50 }),
        getCreditNotes({ limit: 50 }),
      ]);

      if (invRes.status === "fulfilled") setInvoices(invRes.value.invoices ?? []);
      if (quoteRes.status === "fulfilled") setQuotes(quoteRes.value.quotes ?? []);
      if (cnRes.status === "fulfilled") setCreditNotes(cnRes.value.creditNotes ?? []);

      if (invRes.status === "rejected" && quoteRes.status === "rejected" && cnRes.status === "rejected") {
        setError("Could not load documents. Please try again.");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load documents"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreate = (docType: DocType) => {
    const option = createOptions.find((o) => o.type === docType);
    if (option) {
      navigate(option.path);
    }
  };

  const tabs = [
    { id: "invoices" as const, label: "Invoices", count: invoices.length },
    { id: "quotes" as const, label: "Quotes", count: quotes.length },
    { id: "credit-notes" as const, label: "Credit Notes", count: creditNotes.length },
  ];

  const invoiceColumns: ColumnDef<ApiInvoiceListItem>[] = [
    {
      header: "Invoice",
      accessor: "invoice_number" as const,
      cell: (row: ApiInvoiceListItem) => (
        <Link
          to={`/app/invoices/${row.id}/edit`}
          className="text-sm font-medium text-primary-brand hover:text-primary-hover"
        >
          {row.invoice_number || `#${row.id.slice(0, 8)}`}
        </Link>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Customer",
      accessor: "customer_name" as const,
      cell: (row: ApiInvoiceListItem) => (
        <span className="text-sm text-secondary">
          {row.customer_name || "—"}
        </span>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Date",
      accessor: "issue_date" as const,
      cell: (row: ApiInvoiceListItem) => (
        <span className="text-sm text-secondary">
          {row.issue_date ? formatDate(row.issue_date) : "—"}
        </span>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Total",
      accessor: "total" as const,
      cell: (row: ApiInvoiceListItem) => (
        <span className="text-sm font-medium text-primary font-tabular-nums">
          {formatCurrencyValue(row.total, row.currency)}
        </span>
      ),
      sortable: false,
      align: "right" as const,
    },
    {
      header: "Status",
      accessor: "status" as const,
      cell: (row: ApiInvoiceListItem) => (
        <StatusBadge
          status={row.status}
          config={invoiceStatusConfig}
          showIcon
          size="sm"
        />
      ),
      sortable: false,
      align: "center" as const,
    },
  ];

  const quoteColumns: ColumnDef<ApiQuoteListItem>[] = [
    {
      header: "Quote",
      accessor: "quote_number" as const,
      cell: (row: ApiQuoteListItem) => (
        <Link
          to={`/app/quotes/${row.id}/edit`}
          className="text-sm font-medium text-primary-brand hover:text-primary-hover"
        >
          {row.quote_number || `#${row.id.slice(0, 8)}`}
        </Link>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Customer",
      accessor: "customer_name" as const,
      cell: (row: ApiQuoteListItem) => (
        <span className="text-sm text-secondary">
          {row.customer_name || "—"}
        </span>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Expiry",
      accessor: "expiry_date" as const,
      cell: (row: ApiQuoteListItem) => (
        <span className="text-sm text-secondary">
          {row.expiry_date ? formatDate(row.expiry_date) : "—"}
        </span>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Total",
      accessor: "total" as const,
      cell: (row: ApiQuoteListItem) => (
        <span className="text-sm font-medium text-primary font-tabular-nums">
          {formatCurrencyValue(row.total, row.currency)}
        </span>
      ),
      sortable: false,
      align: "right" as const,
    },
    {
      header: "Status",
      accessor: "status" as const,
      cell: (row: ApiQuoteListItem) => (
        <StatusBadge
          status={row.status}
          config={quoteStatusConfig}
          showIcon
          size="sm"
        />
      ),
      sortable: false,
      align: "center" as const,
    },
  ];

  const creditNoteColumns: ColumnDef<ApiCreditNoteListItem>[] = [
    {
      header: "Credit Note",
      accessor: "credit_note_number" as const,
      cell: (row: ApiCreditNoteListItem) => (
        <Link
          to={`/app/credit-notes/${row.id}/edit`}
          className="text-sm font-medium text-primary-brand hover:text-primary-hover"
        >
          {row.credit_note_number || `#${row.id.slice(0, 8)}`}
        </Link>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Customer",
      accessor: "customer_name" as const,
      cell: (row: ApiCreditNoteListItem) => (
        <span className="text-sm text-secondary">
          {row.customer_name || "—"}
        </span>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Date",
      accessor: "issue_date" as const,
      cell: (row: ApiCreditNoteListItem) => (
        <span className="text-sm text-secondary">
          {row.issue_date ? formatDate(row.issue_date) : "—"}
        </span>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Total",
      accessor: "total" as const,
      cell: (row: ApiCreditNoteListItem) => (
        <span className="text-sm font-medium text-primary font-tabular-nums">
          {formatCurrencyValue(row.total, row.currency)}
        </span>
      ),
      sortable: false,
      align: "right" as const,
    },
    {
      header: "Status",
      accessor: "status" as const,
      cell: (row: ApiCreditNoteListItem) => (
        <StatusBadge
          status={row.status}
          config={creditNoteStatusConfig}
          showIcon
          size="sm"
        />
      ),
      sortable: false,
      align: "center" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Documents</h1>
          <p className="text-sm text-secondary mt-1">
            Manage your invoices, quotes, and credit notes in one place.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Document
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-error-border bg-error-bg p-4 text-error-text">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KPICard
          title="Invoices"
          value={invoices.length.toString()}
          icon={<FileText className="w-5 h-5" />}
          variant="stat"
          iconBackground="bg-primary-bg text-primary-brand"
        />
        <KPICard
          title="Quotes"
          value={quotes.length.toString()}
          icon={<QuoteIcon className="w-5 h-5" />}
          variant="stat"
          iconBackground="bg-info-bg text-info-text"
        />
        <KPICard
          title="Credit Notes"
          value={creditNotes.length.toString()}
          icon={<CreditCard className="w-5 h-5" />}
          variant="stat"
          iconBackground="bg-success-bg text-success-text"
        />
      </div>

      <div className="bg-surface rounded-xl border border-color">
        <div className="border-b border-color flex space-x-1 px-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-primary-bg text-primary-brand"
                  : "text-secondary hover:text-primary hover:bg-surface-alt"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 text-xs text-tertiary bg-surface-alt rounded-full px-2 py-0.5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          ) : activeTab === "invoices" ? (
            invoices.length > 0 ? (
              <DataTable
                columns={invoiceColumns}
                data={invoices}
                onRowClick={(row: ApiInvoiceListItem) => navigate(`/app/invoices/${row.id}/edit`)}
              />
            ) : (
              <EmptyState
                title="No invoices yet"
                description="Create your first invoice to get started."
                icon={<FileText className="h-10 w-10" />}
                actionLabel="Create Invoice"
                onAction={() => handleCreate("invoice")}
              />
            )
          ) : activeTab === "quotes" ? (
            quotes.length > 0 ? (
              <DataTable
                columns={quoteColumns}
                data={quotes}
                onRowClick={(row: ApiQuoteListItem) => navigate(`/app/quotes/${row.id}/edit`)}
              />
            ) : (
              <EmptyState
                title="No quotes yet"
                description="Create your first quote to get started."
                icon={<QuoteIcon className="h-10 w-10" />}
                actionLabel="Create Quote"
                onAction={() => handleCreate("quote")}
              />
            )
          ) : creditNotes.length > 0 ? (
            <DataTable
              columns={creditNoteColumns}
              data={creditNotes}
              onRowClick={(row: ApiCreditNoteListItem) => navigate(`/app/credit-notes/${row.id}/edit`)}
            />
          ) : (
            <EmptyState
              title="No credit notes yet"
              description="Create your first credit note to get started."
              icon={<CreditCard className="h-10 w-10" />}
              actionLabel="Create Credit Note"
              onAction={() => handleCreate("credit-note")}
            />
          )}
        </div>
      </div>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title="Create Document"
        description="Choose the type of document to create."
        size="md"
      >
        <div className="space-y-2">
          {createOptions.map((option) => (
            <button
              key={option.type}
              onClick={() => {
                handleCreate(option.type);
                setCreateDialogOpen(false);
              }}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-color hover:bg-surface-alt transition-colors text-left"
            >
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-bg text-primary-brand">
                {option.icon}
              </span>
              <div>
                <div className="font-medium text-primary">{option.label}</div>
                <div className="text-sm text-secondary">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
