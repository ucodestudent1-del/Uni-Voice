import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DataTable from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";

interface TestRow {
  id: string;
  name: string;
  status?: string;
  amount?: string;
}

const columns: any[] = [
  { header: "Name", accessor: "name", sortable: true, align: "left" },
  { header: "Status", accessor: "status", sortable: false, align: "center" },
  { header: "Amount", accessor: "amount", sortable: true, align: "right" },
];

const data: TestRow[] = [
  { id: "1", name: "Invoice A", status: "paid", amount: "$100.00" },
  { id: "2", name: "Invoice B", status: "pending", amount: "$50.00" },
  { id: "3", name: "Invoice C", status: "paid", amount: "$75.00" },
];

function renderTable(props: Record<string, unknown> = {}) {
  return render(
    <DataTable
      columns={columns}
      data={data}
      rowKey="id"
      {...props}
    />
  );
}

function findButtonByIcon(container: HTMLElement, iconName: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((btn) => {
    const svg = btn.querySelector("svg");
    return svg?.getAttribute("class")?.includes(`lucide-${iconName.toLowerCase()}`) ?? false;
  });
}

describe("DataTable", () => {
  describe("rendering", () => {
    it("renders column headers", () => {
      renderTable();
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Amount")).toBeInTheDocument();
    });

    it("renders row data", () => {
      renderTable();
      expect(screen.getByText("Invoice A")).toBeInTheDocument();
      expect(screen.getByText("Invoice B")).toBeInTheDocument();
      expect(screen.getByText("Invoice C")).toBeInTheDocument();
    });

    it("renders cell values as strings when no custom cell", () => {
      renderTable();
      expect(screen.getAllByText("paid")).toHaveLength(2);
      expect(screen.getAllByText("pending")).toHaveLength(1);
    });

    it("renders actions column when actions provided", () => {
      renderTable({ actions: <Button>Action</Button> });
      expect(screen.getAllByText("Action").length).toBeGreaterThan(0);
    });
  });

  describe("empty state", () => {
    it("shows empty message when no data", () => {
      renderTable({ data: [] });
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("shows custom empty message", () => {
      renderTable({ data: [], emptyMessage: "Nothing here yet" });
      expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows loading spinner when loading", () => {
      renderTable({ isLoading: true, data: [] });
      expect(screen.getByText("Loading…")).toBeInTheDocument();
    });
  });

  describe("sorting", () => {
    it("calls onSort when sortable header is clicked", () => {
      const onSort = vi.fn();
      renderTable({ onSort });
      const header = screen.getByText("Name");
      fireEvent.click(header);
      expect(onSort).toHaveBeenCalledWith("name");
    });

    it("does not call onSort for non-sortable column", () => {
      const onSort = vi.fn();
      renderTable({ onSort });
      const header = screen.getByText("Status");
      fireEvent.click(header);
      expect(onSort).not.toHaveBeenCalled();
    });

    it("shows sort indicator for sorted column (ascending)", () => {
      renderTable({ onSort: vi.fn(), sortColumn: "name", sortOrder: "asc" });
      expect(screen.getByText("▲")).toBeInTheDocument();
    });

    it("shows sort indicator for sorted column (descending)", () => {
      renderTable({ onSort: vi.fn(), sortColumn: "name", sortOrder: "desc" });
      expect(screen.getByText("▼")).toBeInTheDocument();
    });

    it("sets aria-sort attribute on sortable header", () => {
      const { container } = renderTable({ onSort: vi.fn(), sortColumn: "name", sortOrder: "asc" });
      const headerCell = container.querySelector("th[aria-sort='ascending']");
      expect(headerCell).not.toBeNull();
    });
  });

  describe("row selection", () => {
    it("renders select-all checkbox when onSelectAll provided", () => {
      renderTable({ onSelectAll: vi.fn() });
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThanOrEqual(1);
    });

    it("calls onSelectRow when row checkbox clicked", () => {
      const onSelectRow = vi.fn();
      renderTable({ onSelectAll: vi.fn(), onSelectRow });
      const rowCheckbox = screen.getAllByRole("checkbox")[1];
      fireEvent.click(rowCheckbox);
      expect(onSelectRow).toHaveBeenCalledWith("1");
    });

    it("calls onSelectAll with true when select-all checkbox clicked (starts unchecked)", () => {
      const onSelectAll = vi.fn();
      renderTable({ onSelectAll });
      const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
      fireEvent.click(selectAllCheckbox);
      expect(onSelectAll).toHaveBeenCalledWith(true);
    });
  });

  describe("pagination", () => {
    it("does not show pagination when onPageChange is not provided", () => {
      renderTable({ onPageChange: undefined });
      expect(screen.queryByText(/page/)).not.toBeInTheDocument();
    });

    it("shows pagination when onPageChange is provided and totalPages > 1", () => {
      renderTable({ onPageChange: vi.fn(), pageSize: 2 });
      expect(screen.getByText(/page 1 of/)).toBeInTheDocument();
    });

    it("calls onPageChange when next page clicked", () => {
      const onPageChange = vi.fn();
      const { container } = renderTable({ onPageChange, pageSize: 2 });
      const nextButton = findButtonByIcon(container, "chevron-right");
      expect(nextButton).toBeDefined();
      fireEvent.click(nextButton!);
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it("disables first page button on page 1", () => {
      const { container } = renderTable({ onPageChange: vi.fn(), pageSize: 2 });
      const firstPageBtn = findButtonByIcon(container, "chevrons-left");
      expect(firstPageBtn).toBeDefined();
      expect(firstPageBtn).toBeDisabled();
    });
  });

  describe("row click", () => {
    it("calls onRowClick with row data when row clicked", () => {
      const onRowClick = vi.fn();
      renderTable({ onRowClick });
      fireEvent.click(screen.getByText("Invoice A"));
      expect(onRowClick).toHaveBeenCalledWith(data[0]);
    });

    it("adds cursor-pointer class when onRowClick is provided", () => {
      const { container } = renderTable({ onRowClick: vi.fn() });
      const firstRow = container.querySelector("tbody tr");
      expect(firstRow).toHaveClass("cursor-pointer");
    });
  });

  describe("custom cell rendering", () => {
    it("renders custom cell content when cell function provided", () => {
      const customColumns: any[] = [
        {
          header: "Name",
          accessor: "name",
          cell: (row: TestRow) => <strong key={row.id}>{row.name} (custom)</strong>,
        },
      ];
      render(<DataTable columns={customColumns} data={data} rowKey="id" />);
      expect(screen.getByText("Invoice A (custom)")).toBeInTheDocument();
    });

    it("renders null value as '—' in cells", () => {
      const customData = [{ id: "1", name: null, status: undefined, amount: "" }];
      const customColumns: any[] = [{ header: "Name", accessor: "name" }];
      render(<DataTable columns={customColumns} data={customData} rowKey="id" />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  describe("rowKey", () => {
    it("renders rows with id values", () => {
      const { container } = renderTable();
      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(3);
      expect(screen.getByText("Invoice A")).toBeInTheDocument();
    });

    it("uses custom rowKey function when provided", () => {
      render(
        <DataTable
          columns={columns}
          data={data}
          rowKey={(row) => `custom-${row.id}`}
        />
      );
      expect(screen.getByText("Invoice A")).toBeInTheDocument();
    });
  });
});
