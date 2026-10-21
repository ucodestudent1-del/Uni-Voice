import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, FileText, Quote as QuoteIcon, CreditCard, Receipt, ShoppingCart } from "lucide-react";
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
import {
  getInvoices,
  getQuotes,
  getCreditNotes,
  getReceipts,
  getPurchaseOrders,
} from "@/api/client";
import type {
  ApiInvoiceListItem,
  ApiQuoteListItem,
  ApiCreditNoteListItem,
  ApiPurchaseOrderListItem,
} from "@/types/api";
import type { ApiReceipt } from "@/api/client";
import {
  invoiceStatusConfig,
  quoteStatusConfig,
  creditNoteStatusConfig,
  receiptStatusConfig,
  purchaseOrderStatusConfig,
} from "@/components/ui";

type DocType = "invoice" | "quote" | "credit-note" | "payment-voucher" | "debit-note" | "purchase-order" | "recurring-invoice" | "delivery-note" | "packing-slip" | "pro-forma-invoice" | "estimate";

interface CreateOption {
  type: DocType;
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

import { useMetaTags } from "@/hooks/useMetaTags";

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
  {
    type: "payment-voucher",
    label: "Payment Voucher",
    description: "Record a business payment to a payee",
    icon: <Receipt className="w-5 h-5" />,
    path: "/app/payment-vouchers/new",
  },
  {
    type: "debit-note",
    label: "Debit Note",
    description: "Charge a customer for additional amount owed",
    icon: <FileText className="w-5 h-5" />,
    path: "/app/debit-notes/new",
  },
  {
    type: "purchase-order",
    label: "Purchase Order",
    description: "Record a purchase order to a supplier",
    icon: <ShoppingCart className="w-5 h-5" />,
    path: "/app/purchase-orders/new",
  },
  {
    type: "recurring-invoice",
    label: "Recurring Invoice",
    description: "Set up automated recurring billing",
    icon: <FileText className="w-5 h-5" />,
    path: "/app/recurring-invoices/new",
  },
  {
    type: "delivery-note",
    label: "Delivery Note",
    description: "Document goods shipped to a customer",
    icon: <FileText className="w-5 h-5" />,
    path: "/app/delivery-notes/new",
  },
  {
    type: "packing-slip",
    label: "Packing Slip",
    description: "Detail items in a shipment",
    icon: <FileText className="w-5 h-5" />,
    path: "/app/packing-slips/new",
  },
  {
    type: "pro-forma-invoice",
    label: "Pro Forma Invoice",
    description: "Issue a preliminary invoice for international trade",
    icon: <FileText className="w-5 h-5" />,
    path: "/app/pro-forma-invoices/new",
  },
  {
    type: "estimate",
    label: "Estimate",
    description: "Provide an estimated price to a customer",
    icon: <FileText className="w-5 h-5" />,
    path: "/app/estimates/new",
  },
];

export default function Documents() {
  useMetaTags({
    title: "Documents — DocForge",
    description: "Manage your invoices, quotes, credit notes, and debit notes. Create, send, and track all your business documents.",
    noIndex: true,
  });

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"invoices" | "quotes" | "credit-notes" | "purchase-orders" | "receipts">("invoices");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [invoices, setInvoices] = useState<ApiInvoiceListItem[]>([]);
  const [quotes, setQuotes] = useState<ApiQuoteListItem[]>([]);
  const [creditNotes, setCreditNotes] = useState<ApiCreditNoteListItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<ApiPurchaseOrderListItem[]>([]);
  const [receipts, setReceipts] = useState<ApiReceipt[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, quoteRes, cnRes, poRes, rcptRes] = await Promise.allSettled([
        getInvoices({ limit: 50 }),
        getQuotes({ limit: 50 }),
        getCreditNotes({ limit: 50 }),
        getPurchaseOrders({ limit: 50 }),
        getReceipts({ limit: 50 }),
      ]);

      if (invRes.status === "fulfilled") setInvoices(invRes.value.invoices ?? []);
      if (quoteRes.status === "fulfilled") setQuotes(quoteRes.value.quotes ?? []);
      if (cnRes.status === "fulfilled") setCreditNotes(cnRes.value.creditNotes ?? []);
      if (poRes.status === "fulfilled") setPurchaseOrders(poRes.value.purchaseOrders ?? []);
      if (rcptRes.status === "fulfilled") setReceipts(rcptRes.value.receipts ?? []);

      if (invRes.status === "rejected" && quoteRes.status === "rejected" && cnRes.status === "rejected" && poRes.status === "rejected" && rcptRes.status === "rejected") {
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
    { id: "purchase-orders" as const, label: "Purchase Orders", count: purchaseOrders.length },
    { id: "receipts" as const, label: "Receipts", count: receipts.length },
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
      header: "Reference Invoice",
      accessor: (row: ApiCreditNoteListItem) => row.reference_invoice_number ?? null,
      cell: (row: ApiCreditNoteListItem) => (
        <span className="text-sm text-secondary">
          {row.reference_invoice_number || "—"}
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
      header: "Amount",
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
      header: "Applied",
      accessor: "applied_total" as const,
      cell: (row: ApiCreditNoteListItem) => (
        <span className="text-sm font-tabular-nums text-secondary">
          {formatCurrencyValue(row.applied_total, row.currency)}
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

  const purchaseOrderColumns: ColumnDef<ApiPurchaseOrderListItem>[] = [
    {
      header: "P.O. #",
      accessor: "purchase_order_number" as const,
      cell: (row: ApiPurchaseOrderListItem) => (
        <Link
          to={`/app/purchase-orders/${row.id}/edit`}
          className="text-sm font-medium text-primary-brand hover:text-primary-hover"
        >
          {row.purchase_order_number || `#${row.id.slice(0, 8)}`}
        </Link>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Supplier",
      accessor: "supplier_name" as const,
      cell: (row: ApiPurchaseOrderListItem) => (
        <span className="text-sm text-secondary">
          {row.supplier_name || "—"}
        </span>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Date",
      accessor: "issue_date" as const,
      cell: (row: ApiPurchaseOrderListItem) => (
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
      cell: (row: ApiPurchaseOrderListItem) => (
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
      cell: (row: ApiPurchaseOrderListItem) => (
        <StatusBadge
          status={row.status}
          config={purchaseOrderStatusConfig}
          showIcon
          size="sm"
        />
      ),
      sortable: false,
      align: "center" as const,
    },
  ];

  const receiptColumns: ColumnDef<ApiReceipt>[] = [
    {
      header: "Receipt",
      accessor: "receipt_number" as const,
      cell: (row: ApiReceipt) => (
        <Link
          to={`/app/receipts/${row.id}/edit`}
          className="text-sm font-medium text-primary-brand hover:text-primary-hover"
        >
          {row.receipt_number || `#${row.id.slice(0, 8)}`}
        </Link>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Customer",
      accessor: "customer_name" as const,
      cell: (row: ApiReceipt) => (
        <span className="text-sm text-secondary">
          {row.customer_name || "—"}
        </span>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Amount",
      accessor: "amount" as const,
      cell: (row: ApiReceipt) => (
        <span className="text-sm font-medium text-primary font-tabular-nums">
          {formatCurrencyValue(row.amount, row.currency)}
        </span>
      ),
      sortable: false,
      align: "right" as const,
    },
    {
      header: "Date",
      accessor: "issued_at" as const,
      cell: (row: ApiReceipt) => (
        <span className="text-sm text-secondary">
          {row.issued_at ? formatDate(row.issued_at) : "—"}
        </span>
      ),
      sortable: false,
      align: "left" as const,
    },
    {
      header: "Status",
      accessor: "status" as const,
      cell: (row: ApiReceipt) => (
        <StatusBadge
          status={row.status}
          config={receiptStatusConfig}
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
            Manage your invoices, quotes, credit notes, debit notes, payment vouchers, purchase orders, and receipts in one place.
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

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-5">
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
        <KPICard
          title="Purchase Orders"
          value={purchaseOrders.length.toString()}
          icon={<ShoppingCart className="w-5 h-5" />}
          variant="stat"
          iconBackground="bg-warning-bg text-warning-text"
        />
        <KPICard
          title="Receipts"
          value={receipts.length.toString()}
          icon={<Receipt className="w-5 h-5" />}
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
           ) : activeTab === "purchase-orders" ? (
             purchaseOrders.length > 0 ? (
               <DataTable
                 columns={purchaseOrderColumns}
                 data={purchaseOrders}
                 onRowClick={(row: ApiPurchaseOrderListItem) => navigate(`/app/purchase-orders/${row.id}/edit`)}
               />
             ) : (
               <EmptyState
                 title="No purchase orders yet"
                 description="Create your first purchase order to get started."
                 icon={<ShoppingCart className="h-10 w-10" />}
                 actionLabel="Create Purchase Order"
                 onAction={() => handleCreate("purchase-order")}
               />
             )
           ) : activeTab === "receipts" ? (
             receipts.length > 0 ? (
               <DataTable
                 columns={receiptColumns}
                 data={receipts}
                 onRowClick={(row: ApiReceipt) => navigate(`/app/receipts/${row.id}/edit`)}
               />
             ) : (
               <EmptyState
                 title="No receipts yet"
                 description="Receipts are generated when payments are recorded."
                 icon={<Receipt className="h-10 w-10" />}
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

