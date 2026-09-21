import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface ColumnDef<TData> {
  header: ReactNode;
  accessor: keyof TData | ((row: TData) => unknown);
  cell?: (row: TData, value: unknown) => ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

export interface DataTableProps<TData> extends HTMLAttributes<HTMLDivElement> {
  columns: ColumnDef<TData>[];
  data: TData[];
  sortColumn?: string | null;
  sortOrder?: "asc" | "desc";
  onSort?: (column: string) => void;
  totalRows?: number;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  rowKey?: keyof TData | ((row: TData) => string);
  selectedRows?: Set<string>;
  onSelectRow?: (id: string) => void;
  onSelectAll?: (selected: boolean) => void;
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  actions?: ReactNode;
  rowClassName?: (row: TData) => string;
}

function getCellValue<TData>(row: TData, column: ColumnDef<TData>): unknown {
  if (typeof column.accessor === "function") return column.accessor(row);
  return row[column.accessor as keyof TData];
}

function DataTableInner<TData extends Record<string, any>>(
  {
    columns,
    data,
    sortColumn = null,
    sortOrder = "asc",
    onSort,
    totalRows,
    pageSize = 25,
    currentPage = 1,
    onPageChange,
    pageSizeOptions = [10, 25, 50, 100],
    onPageSizeChange,
    isLoading = false,
    emptyMessage = "No data available",
    rowKey = "id",
    selectedRows,
    onSelectRow,
    onSelectAll,
    selectAllChecked = false,
    selectAllIndeterminate = false,
    actions,
    rowClassName,
    className,
    ...rest
  }: DataTableProps<TData>,
  ref: React.Ref<HTMLDivElement>
) {
  const total = totalRows ?? data.length;
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

  const getRowId = (row: TData, index: number): string => {
    if (typeof rowKey === "function") return rowKey(row);
    const val = row[rowKey as keyof TData];
    return String(val ?? index);
  };

  return (
    <div ref={ref} className={cn("w-full", className)} {...rest}>
      <div className="overflow-x-auto rounded-lg border border-color bg-surface">
        <table className="w-full border-collapse">
          <thead>
            {Array.from({ length: 1 }).map(() => (
              <tr key="header" className="bg-surface-alt border-b border-color">
                {onSelectAll && (
                  <th className="text-center text-xs font-medium text-tertiary uppercase py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      checked={selectAllChecked}
                      ref={(el) => {
                        if (el) (el as HTMLInputElement).indeterminate = selectAllIndeterminate;
                      }}
                      onChange={(e) => onSelectAll?.(e.target.checked)}
                      aria-label="Select all"
                    />
                  </th>
                )}
                {columns.map((col, i) => {
                  const isSortable = col.sortable !== false && onSort && typeof col.accessor === "string";
                  const isSorted = sortColumn === (col.accessor as string);
                  const align = col.align ?? "left";
                  return (
                    <th
                      key={String(col.accessor ?? i)}
                      className={cn(
                        "text-xs font-medium text-tertiary uppercase py-3 px-4 whitespace-nowrap",
                        {
                          "text-left": align === "left",
                          "text-center": align === "center",
                          "text-right": align === "right",
                          "cursor-pointer select-none hover:bg-surface": !!isSortable,
                        },
                        col.className
                      )}
                      onClick={isSortable ? () => onSort!(col.accessor as string) : undefined}
                      aria-sort={isSortable && isSorted ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <span className="flex items-center gap-1">
                        {col.header}
                        {isSortable && isSorted && (
                          <span className="text-xs">{sortOrder === "asc" ? "▲" : "▼"}</span>
                        )}
                      </span>
                    </th>
                  );
                })}
                {actions && <th className="text-center text-xs font-medium text-tertiary uppercase py-3 px-2 w-16">Actions</th>}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + (onSelectAll ? 1 : 0) + (actions ? 1 : 0)} className="py-12 text-center text-tertiary">
                  <div className="inline-flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading…
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onSelectAll ? 1 : 0) + (actions ? 1 : 0)} className="py-12 text-center text-tertiary">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => {
                const rowId = getRowId(row, rowIndex);
                return (
                  <tr
                    key={rowId}
                    className={cn(
                      "border-b border-color-subtle last:border-b-0 hover:bg-surface-alt transition-colors",
                      rowClassName?.(row)
                    )}
                  >
                    {onSelectAll && (
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRows?.has(rowId) ?? false}
                          onChange={(e) => onSelectRow?.(rowId)}
                          aria-label={`Select row ${rowId}`}
                        />
                      </td>
                    )}
                    {columns.map((col, colIndex) => {
                      const value = getCellValue(row, col);
                      const align = col.align ?? "left";
                      return (
                        <td
                          key={String(col.accessor ?? colIndex)}
                          className={cn(
                            "py-3 px-4 text-sm align-top",
                            {
                              "text-left": align === "left",
                              "text-center": align === "center",
                              "text-right": align === "right",
                            }
                          )}
                        >
                          {col.cell ? col.cell(row, value) : String(value ?? "—")}
                        </td>
                      );
                    })}
                    {actions && <td className="py-2 px-2 text-center">{actions}</td>}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="flex-1 text-sm text-tertiary">
            page {currentPage} of {totalPages} • {total} rows
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="rounded-lg border border-input-border bg-input px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronsLeft className="h-4 w-4" />}
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="px-2"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronLeft className="h-4 w-4" />}
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronRight className="h-4 w-4" />}
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-2"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronsRight className="h-4 w-4" />}
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-2"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const DataTable = forwardRef(DataTableInner) as <TData extends Record<string, any>>(
  props: DataTableProps<TData> & { ref?: React.Ref<HTMLDivElement> }
) => React.ReactElement;

export default DataTable;
