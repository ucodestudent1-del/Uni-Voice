import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  getProprietaryInvoices,
  getProprietaryQuotes,
  getProprietaryInvoicePdf,
  getProprietaryQuotePdf,
} from "../api/client";
import { useQuery } from "@tanstack/react-query";
import { Button, Skeleton, StatusBadge, invoiceStatusConfig, quoteStatusConfig, DataTable } from "@/components/ui";
import { formatCurrencyValue } from "@/lib/utils";
import { useMetaTags } from "@/hooks/useMetaTags";
import type { ColumnDef } from "@/types/components";

type DocType = "invoice" | "quote";

interface ListItem {
  id: string;
  doc_number?: string | null;
  customer_name?: string | null;
  status: string;
  total: string;
  currency: string;
  amount_due?: string;
  is_finalized?: boolean;
  date?: string;
}

export default function ProprietaryDocuments() {
  useMetaTags({
    title: "Documents — DocForge",
    description: "Manage your invoices and quotes.",
    noIndex: true,
  });

  const [docType, setDocType] = useState<DocType>("invoice");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const STATUS_OPTIONS = docType === "invoice"
    ? ["", "draft", "sent", "paid", "partially_paid", "overdue", "void"]
    : ["", "draft", "sent", "accepted", "converted", "expired"];

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ["proprietary-invoices-list", { search }],
    queryFn: () => getProprietaryInvoices({ search, limit: 100 }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: quotesData,
    isLoading: quotesLoading,
    refetch: refetchQuotes,
  } = useQuery({
    queryKey: ["proprietary-quotes-list", { search }],
    queryFn: () => getProprietaryQuotes({ search, limit: 100 }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const invoices: ListItem[] = useMemo(() => {
    return (invoicesData?.invoices ?? []).map((inv: any) => ({
      id: inv.id,
      doc_number: inv.invoice_number,
      customer_name: inv.customer_name,
      status: inv.status,
      total: inv.total,
      currency: inv.currency,
      amount_due: inv.amount_due,
      is_finalized: (inv as any).is_finalized ?? false,
      date: inv.created_at,
    }));
  }, [invoicesData?.invoices]);

  const quotes: ListItem[] = useMemo(() => {
    return (quotesData?.quotes ?? []).map((q: any) => ({
      id: q.id,
      doc_number: q.quote_number,
      customer_name: q.customer_name,
      status: q.status,
      total: q.total,
      currency: q.currency,
      amount_due: q.amount_due,
      is_finalized: q.is_finalized ?? false,
      date: q.created_at,
    }));
  }, [quotesData?.quotes]);

  const currentDocs = useMemo(() => {
    const base = docType === "invoice" ? invoices : quotes;
    return base.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false;
      return true;
    });
  }, [docType, invoices, quotes, statusFilter]);
  const isLoading = docType === "invoice" ? invoicesLoading : quotesLoading;

  const downloadPdf = async (id: string) => {
    try {
      const blob =
        docType === "invoice"
          ? await getProprietaryInvoicePdf(id)
          : await getProprietaryQuotePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docType}-${id.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download PDF:", err);
    }
  };

  const columns: ColumnDef<ListItem>[] = [
    {
      header: "Document #",
      accessor: (row) => (
        <Link
          to={`/app/proprietary/${docType === "invoice" ? "invoices" : "quotes"}/${row.id}/edit`}
          className="font-medium text-primary hover:underline"
        >
          {row.doc_number || row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      header: "Customer",
      accessor: "customer_name",
    },
    {
      header: "Status",
      accessor: (row) => (
        <StatusBadge
          status={row.status}
          config={docType === "invoice" ? invoiceStatusConfig : quoteStatusConfig}
        />
      ),
    },
    {
      header: "Total",
      accessor: (row) =>
        formatCurrencyValue(row.total, row.currency || "USD"),
    },
    {
      header: "",
      accessor: (row) => (
        <div className="flex gap-2 justify-end">
          {row.is_finalized && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => downloadPdf(row.id)}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-primary">Documents</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {STATUS_OPTIONS.map((val) => (
              <button
                key={val || "all"}
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-1.5 text-sm rounded transition-all ${
                  statusFilter === val
                    ? "bg-primary text-primary-foreground"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {val ? val.charAt(0).toUpperCase() + val.replace("_", " ").slice(1) : "All"}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setDocType("invoice")}
              className={`px-3 py-1.5 text-sm rounded transition-all ${
                docType === "invoice"
                  ? "bg-primary text-primary-foreground"
                  : "text-secondary hover:text-primary"
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => setDocType("quote")}
              className={`px-3 py-1.5 text-sm rounded transition-all ${
                docType === "quote"
                  ? "bg-primary text-primary-foreground"
                  : "text-secondary hover:text-primary"
              }`}
            >
              Quotes
            </button>
          </div>
          <Link
            to={`/app/proprietary/${docType === "invoice" ? "invoices/new" : "quotes/new"}`}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-primary-action text-on-primary hover:bg-primary-hover transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            New {docType === "invoice" ? "Invoice" : "Quote"}
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (docType === "invoice") refetchInvoices();
              else refetchQuotes();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <DataTable columns={columns} data={currentDocs} rowKey="id" />
      )}
    </div>
  );
}
