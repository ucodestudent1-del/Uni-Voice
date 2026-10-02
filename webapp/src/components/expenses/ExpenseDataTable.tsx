import { Edit2, Trash2, Eye } from "lucide-react";
import { DataTable, Button } from "@/components/ui";
import type { ColumnDef } from "@/types/components";
import ExpenseCategoryBadge from "./ExpenseCategoryBadge";
import type { ApiExpense } from "@/types/api";
import { formatCurrencyValue } from "@/lib/utils";

export interface ExpenseDataTableProps {
  expenses: ApiExpense[];
  total: number;
  pageSize: number;
  currentPage: number;
  loading?: boolean;
  sortColumn?: string | null;
  sortOrder?: "asc" | "desc";
  onSort?: (column: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onEdit: (expense: ApiExpense) => void;
  onDelete: (expense: ApiExpense) => void;
  onRowClick?: (expense: ApiExpense) => void;
  selectedRows?: Set<string>;
  onSelectRow?: (id: string) => void;
  onSelectAll?: (selected: boolean) => void;
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
}

export default function ExpenseDataTable({
  expenses,
  total,
  pageSize,
  currentPage,
  loading = false,
  sortColumn = null,
  sortOrder = "asc",
  onSort,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
  onRowClick,
  selectedRows,
  onSelectRow,
  onSelectAll,
  selectAllChecked = false,
  selectAllIndeterminate = false,
}: ExpenseDataTableProps) {
  const columns: ColumnDef<ApiExpense>[] = [
    {
      header: "Date",
      accessor: "expense_date",
      sortable: true,
      cell: (_row, value) => {
        if (!value) return "—";
        return new Date(value as string).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      },
    },
    {
      header: "Description",
      accessor: "description",
      cell: (row, value) => {
        const exp = row as ApiExpense;
        return (
          <div className="flex flex-col min-w-[120px]">
            <span className="text-sm font-medium text-primary truncate">
              {value as string}
            </span>
            {exp.notes && (
              <span className="text-xs text-secondary line-clamp-1 max-w-xs">
                {exp.notes}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Category",
      accessor: "category",
      sortable: true,
      cell: (_row, value) => (
        <ExpenseCategoryBadge category={value as ApiExpense["category"]} />
      ),
    },
    {
      header: "Vendor",
      accessor: "vendor",
      cell: (_row, value) => (
        <span className="text-sm text-primary truncate max-w-[140px] block">
          {value ? String(value) : "—"}
        </span>
      ),
    },
    {
      header: "Payment",
      accessor: "payment_method",
      cell: (_row, value) => (
        <span className="text-sm text-secondary">
          {value
            ? String(value).charAt(0).toUpperCase() +
              String(value).slice(1).replace("_", " ")
            : "—"}
        </span>
      ),
    },
    {
      header: "Amount",
      accessor: "amount",
      align: "right",
      sortable: true,
      cell: (row, _value) => {
        const exp = row as ApiExpense;
        return (
          <span className="font-tabular-nums">
            {formatCurrencyValue(exp.amount, exp.currency)}
          </span>
        );
      },
    },
    {
      header: "Status",
      accessor: "is_billable",
      align: "center",
      sortable: false,
      cell: (row, value) => {
        const exp = row as ApiExpense;
        let label = "Paid";
        let className = "text-xs font-medium status-tertiary-bg status-tertiary-text";
        if (exp.is_reimbursed) {
          label = "Reimbursed";
          className = "text-xs font-medium status-success-bg status-success-text";
        } else if (exp.is_reimbursable) {
          label = "Needs Reimbursement";
          className = "text-xs font-medium status-error-bg status-error-text";
        } else if (value) {
          label = "Billable";
          className = "text-xs font-medium status-warning-bg status-warning-text";
        }
        return <span className={className}>{label}</span>;
      },
    },
    {
      header: "",
      accessor: "id",
      align: "center",
      sortable: false,
      cell: (row, _value) => {
        const exp = row as ApiExpense;
        return (
          <div
            className="flex items-center justify-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              icon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => onEdit(exp)}
              title="Edit expense"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => onDelete(exp)}
              title="Delete expense"
            />
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={expenses}
      totalRows={total}
      pageSize={pageSize}
      currentPage={currentPage}
      isLoading={loading}
      emptyMessage="No expenses found. Try adjusting your search or filters."
      rowKey="id"
      onRowClick={onRowClick}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      sortColumn={sortColumn}
      sortOrder={sortOrder}
      onSort={onSort}
      selectedRows={selectedRows}
      onSelectRow={onSelectRow}
      onSelectAll={onSelectAll}
      selectAllChecked={selectAllChecked}
      selectAllIndeterminate={selectAllIndeterminate}
    />
  );
}
