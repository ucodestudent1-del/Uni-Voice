import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  ArrowLeft,
  Save,
} from "lucide-react";
import {
  getProprietaryRecurringInvoices,
  getProprietaryRecurringInvoice,
  createProprietaryRecurringInvoice,
  updateProprietaryRecurringInvoice,
  deleteProprietaryRecurringInvoice,
  activateProprietaryRecurringInvoice,
  deactivateProprietaryRecurringInvoice,
  type RecurringInvoice,
  type RecurringInvoiceInput,
} from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useToast,
  Skeleton,
  Button,
  DataTable,
  StatusBadge,
} from "@/components/ui";
import type { ColumnDef } from "@/types/components";
import { useMetaTags } from "@/hooks/useMetaTags";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "daily", label: "Daily" },
] as const;

export default function ProprietaryRecurringInvoices() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isEditing = Boolean(id);

  useMetaTags({
    title: "Recurring Invoices — DocForge",
    description: "Manage your recurring invoice schedules.",
    noIndex: true,
  });

  const {
    data: listData,
    isLoading: listLoading,
  } = useQuery({
    queryKey: ["proprietary-recurring-invoices"],
    queryFn: () => getProprietaryRecurringInvoices(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: editData,
    isLoading: editLoading,
  } = useQuery({
    queryKey: ["proprietary-recurring-invoice", id],
    queryFn: () => getProprietaryRecurringInvoice(id!),
    enabled: Boolean(isEditing && id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: RecurringInvoiceInput) => createProprietaryRecurringInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-recurring-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["proprietary-recurring-invoice", id] });
      toast("Recurring invoice created.", { title: "Created", type: "success" });
      navigate("/app/proprietary/recurring-invoices");
    },
    onError: () => toast("Failed to create recurring invoice.", { title: "Error", type: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id: recId, data }: { id: string; data: Partial<RecurringInvoiceInput> }) =>
      updateProprietaryRecurringInvoice(recId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-recurring-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["proprietary-recurring-invoice", id] });
      toast("Recurring invoice updated.", { title: "Saved", type: "success" });
    },
    onError: () => toast("Failed to update recurring invoice.", { title: "Error", type: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (recId: string) => deleteProprietaryRecurringInvoice(recId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-recurring-invoices"] });
      toast("Recurring invoice deleted.", { title: "Deleted", type: "success" });
    },
    onError: () => toast("Failed to delete recurring invoice.", { title: "Error", type: "error" }),
  });

  const activateMutation = useMutation({
    mutationFn: (recId: string) => activateProprietaryRecurringInvoice(recId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-recurring-invoices"] });
      toast("Recurring invoice activated.", { title: "Activated", type: "success" });
    },
    onError: () => toast("Failed to activate.", { title: "Error", type: "error" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (recId: string) => deactivateProprietaryRecurringInvoice(recId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietary-recurring-invoices"] });
      toast("Recurring invoice deactivated.", { title: "Deactivated", type: "info" });
    },
    onError: () => toast("Failed to deactivate.", { title: "Error", type: "error" }),
  });

  const recurringInvoices: RecurringInvoice[] = listData?.recurringInvoices ?? [];

  const columns: ColumnDef<RecurringInvoice>[] = [
    {
      header: "Name",
      accessor: (row) => (
        <Link
          to={`/app/proprietary/recurring-invoices/${row.id}/edit`}
          className="font-medium text-primary hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      header: "Customer",
      accessor: "customer_name",
    },
    {
      header: "Frequency",
      accessor: (row) =>
        `${FREQUENCY_OPTIONS.find((f) => f.value === row.frequency)?.label ?? row.frequency} (every ${row.interval_count})`,
    },
    {
      header: "Next Generation",
      accessor: (row) => row.next_generation_at ?? "—",
    },
    {
      header: "Status",
      accessor: (row) => <StatusBadge status={row.status} config={recurringStatusConfig} />,
    },
    {
      header: "Actions",
      accessor: (row) => (
        <div className="flex gap-2 justify-end">
          {row.is_active ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deactivateMutation.mutate(row.id)}
              title="Deactivate"
            >
              <Pause className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => activateMutation.mutate(row.id)}
              title="Activate"
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Link
            to={`/app/proprietary/recurring-invoices/${row.id}/edit`}
            className="text-secondary hover:text-primary"
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </Link>
          <button
            onClick={() => deleteMutation.mutate(row.id)}
            className="text-red-600 hover:bg-red-50 rounded p-1"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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
        <h1 className="text-2xl font-bold text-primary">Recurring Invoices</h1>
      </div>

      {isEditing ? (
        <RecurringInvoiceForm
          id={id!}
          editData={editData}
          isLoading={editLoading}
          onCreate={createMutation.mutate}
          onUpdate={updateMutation.mutate}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onCancel={() => navigate("/app/proprietary/recurring-invoices")}
        />
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p className="text-secondary">
              Schedule recurring invoices for automatic generation.
            </p>
            <Link
              to="/app/proprietary/recurring-invoices/new"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-primary-action text-on-primary hover:bg-primary-hover transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Link>
          </div>

          {listLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : recurringInvoices.length === 0 ? (
            <p className="text-secondary text-sm">No recurring invoice schedules yet.</p>
          ) : (
            <DataTable columns={columns} data={recurringInvoices} rowKey="id" />
          )}
        </>
      )}
    </div>
  );
}

const recurringStatusConfig = {
  getConfig: (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      draft: { label: "Draft", className: "status-warning-bg status-warning-text" },
      active: { label: "Active", className: "status-success-bg status-success-text" },
      cancelled: { label: "Cancelled", className: "status-tertiary-bg status-tertiary-text" },
      void: { label: "Void", className: "status-tertiary-bg status-tertiary-text" },
    };
    return configs[status] ?? configs.draft;
  },
  configs: {
    draft: { label: "Draft", className: "status-warning-bg status-warning-text" },
    active: { label: "Active", className: "status-success-bg status-success-text" },
    cancelled: { label: "Cancelled", className: "status-tertiary-bg status-tertiary-text" },
    void: { label: "Void", className: "status-tertiary-bg status-tertiary-text" },
  },
};

interface FormProps {
  id?: string;
  editData: { recurringInvoice?: RecurringInvoice; items?: any[] } | undefined;
  isLoading: boolean;
  onCreate: (data: RecurringInvoiceInput) => void;
  onUpdate: (params: { id: string; data: Partial<RecurringInvoiceInput> }) => void;
  isSubmitting: boolean;
  onCancel: () => void;
}

function RecurringInvoiceForm({ id, editData, isLoading, onCreate, onUpdate, isSubmitting, onCancel }: FormProps) {
  const [name, setName] = useState((editData?.recurringInvoice?.name) ?? "");
  const [frequency, setFrequency] = useState(editData?.recurringInvoice?.frequency ?? "monthly");
  const [intervalCount, setIntervalCount] = useState(editData?.recurringInvoice?.interval_count ?? 1);
  const [nextGenerationAt, setNextGenerationAt] = useState(
    editData?.recurringInvoice?.next_generation_at?.slice(0, 10) ?? "",
  );
  const [endDate, setEndDate] = useState(editData?.recurringInvoice?.end_date?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(editData?.recurringInvoice?.notes ?? "");
  const [terms, setTerms] = useState(editData?.recurringInvoice?.terms ?? "");
  const [currency, setCurrency] = useState(editData?.recurringInvoice?.currency ?? "USD");
  const [autoSend, setAutoSend] = useState(editData?.recurringInvoice?.auto_send ?? false);

  const [items, setItems] = useState(
    editData?.items?.map((i: any) => ({
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unit_price,
      taxRate: i.tax_rate,
      taxName: i.tax_name,
    })) ?? [{ description: "", quantity: 1, unit: "each", unitPrice: 0, taxRate: 0, taxName: null }],
  );

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const updateItem = (idx: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit: "each", unitPrice: 0, taxRate: 0, taxName: null }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    const newItems = [...items];
    newItems.splice(idx, 1);
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: RecurringInvoiceInput = {
      name,
      customerId: editData?.recurringInvoice?.customer_id ?? null,
      frequency,
      intervalCount,
      nextGenerationAt,
      endDate: endDate || null,
      currency,
      notes: notes || null,
      terms: terms || null,
      autoSend,
      items: items.filter((i) => i.description.trim() !== ""),
    };

    if (id) {
      onUpdate({ id, data: payload });
    } else {
      onCreate(payload);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monthly Retainer"
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as any)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Interval</label>
          <input
            type="number"
            min={1}
            value={intervalCount}
            onChange={(e) => setIntervalCount(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Next Generation Date</label>
          <input
            type="date"
            value={nextGenerationAt}
            onChange={(e) => setNextGenerationAt(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">End Date (optional)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
              className="rounded border-input-border"
            />
            <span className="text-sm text-secondary">Auto-send generated invoices</span>
          </label>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium">Line Items</label>
              <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                + Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Qty"
                      value={String(item.quantity)}
                      onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Price"
                      value={String(item.unitPrice)}
                      onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Tax %"
                      value={String(item.taxRate)}
                      onChange={(e) => updateItem(idx, "taxRate", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                  </div>
                  <div className="col-span-1">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="w-full px-2 py-1.5 text-red-600 hover:bg-red-50 rounded text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
              className="w-full px-3 py-2 border rounded-lg h-20 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Terms</label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Payment terms..."
              className="w-full px-3 py-2 border rounded-lg h-20 resize-none"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
          <Save className="h-4 w-4 mr-2" />
          {id ? "Save Changes" : "Create Schedule"}
        </Button>
      </div>
    </form>
  );
}
