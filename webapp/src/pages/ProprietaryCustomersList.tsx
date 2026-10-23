import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ArrowLeft, PlusCircle } from "lucide-react";
import {
   getProprietaryCustomers,
} from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Button, DataTable, StatusBadge, Skeleton, customerStatusConfig } from "@/components/ui";
import { useMetaTags } from "@/hooks/useMetaTags";
import type { ColumnDef } from "@/types/components";

interface CustomerRow {
  id: string;
  name: string;
  email?: string | null;
  company_name?: string | null;
  companyName?: string | null;
  status: string;
  phone?: string | null;
  tax_id?: string | null;
  total_outstanding?: string;
  total_invoiced?: string;
  created_at?: string;
}

export default function ProprietaryCustomersList() {
  const navigate = useNavigate();

  useMetaTags({
    title: "Customers — DocForge",
    description: "Manage your customers.",
    noIndex: true,
  });

  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["proprietary-customers", { search }],
    queryFn: () => getProprietaryCustomers({ search, limit: 100 }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const customers: CustomerRow[] = useMemo(() => {
    return (data?.customers ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      company_name: c.company_name,
      companyName: c.company_name,
      status: c.status,
      phone: c.phone,
      tax_id: c.tax_id,
      created_at: c.created_at,
    }));
  }, [data?.customers]);

  const columns: ColumnDef<CustomerRow>[] = [
    {
      header: "Name",
      accessor: (row) => (
        <Link
          to={`/app/proprietary/customers/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      header: "Email",
      accessor: "email",
    },
    {
      header: "Company",
      accessor: (row) => row.company_name || row.companyName || "—",
    },
    {
      header: "Status",
      accessor: (row) => (
        <StatusBadge status={row.status || "active"} config={customerStatusConfig} size="sm" />
      ),
    },
    {
      header: "",
      accessor: (row) => (
        <Link
          to={`/app/proprietary/customers/${row.id}`}
          className="text-secondary hover:text-primary"
          title="View details"
        >
          <PlusCircle className="h-4 w-4" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate("/app/proprietary")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-primary">Customers</h1>
      </div>

      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border rounded-lg text-sm w-full"
          />
        </div>
        <div className="text-sm text-secondary">
          {customers.length} customer{customers.length !== 1 ? "s" : ""}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : customers.length === 0 ? (
        <p className="text-secondary text-sm">No customers found.</p>
      ) : (
        <DataTable columns={columns} data={customers} rowKey="id" />
      )}
    </div>
  );
}
