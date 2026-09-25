import { useNavigate } from "react-router-dom";
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
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onEdit: (expense: ApiExpense) => void;
  onDelete: (expense: ApiExpense) => void;
}

export default function ExpenseDataTable({
  expenses,
  total,
  pageSize,
  currentPage,
  loading = false,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
}: ExpenseDataTableProps) {
  const navigate = useNavigate();

  const columns: ColumnDef<ApiExpense>[] = [
    {
      header: "Date",
      accessor: "expense_date",
      cell: (row, value) => {
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
          <div className="flex flex-col">
            <span className="text-sm font-medium text-primary">{value as string}</span>
            {exp.notes && (
              <span className="text-xs text-tertiary line-clamp-1 max-w-xs">
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
      cell: (_row, value) => (
        <ExpenseCategoryBadge category={value as ApiExpense["category"]} />
      ),
    },
    {
      header: "Amount",
      accessor: "amount",
      align: "right",
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
      header: "Payment Method",
      accessor: "payment_method",
      cell: (_row, value) => (
        <span className="text-sm text-tertiary">
          {value
            ? String(value).charAt(0).toUpperCase() +
              String(value).slice(1).replace("_", " ")
            : "—"}
        </span>
      ),
    },
    {
      header: "Billable",
      accessor: "is_billable",
      align: "center",
      cell: (_row, value) => (
        <span
          className={
            value
              ? "text-xs font-medium text-success-text"
              : "text-xs text-tertiary"
          }
        >
          {value ? "Yes" : "No"}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: "id",
      align: "center",
      sortable: false,
      cell: (row, _value) => {
        const exp = row as ApiExpense;
        return (
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={<Eye className="w-3.5 h-3.5" />}
              onClick={() => navigate(`/app/expenses/${exp.id}`)}
              title="View expense"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => onEdit(exp)}
              title="Edit expense"
            />
            <Button
              variant="danger"
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
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      isLoading={loading}
      emptyMessage="No expenses found. Try adjusting your search or filters."
      rowKey="id"
    />
  );
}
