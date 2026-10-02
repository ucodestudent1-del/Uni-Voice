import { useState, useEffect, useRef } from "react";
import { X, Upload, FileText, Image as ImageIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EXPENSE_CATEGORY_OPTIONS } from "./ExpenseCategoryBadge";
import CustomerSelector from "@/components/CustomerSelector";
import ProjectSelector from "@/components/ProjectSelector";
import type { ApiExpense } from "@/types/api";
import { uploadExpenseReceipt } from "@/api/client";
import { useToast } from "@/components/ui/ToastProvider";

const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "check", "other"];

export interface ExpenseFormData {
  description: string;
  amount: string;
  tax_amount: string;
  category: string;
  expense_date: string;
  payment_method: string;
  vendor: string;
  customer_id: string | null;
  project_id: string | null;
  receipt_url: string;
  receipt_file: File | null;
  receipt_preview: string | null;
  notes: string;
  is_billable: boolean;
  is_reimbursable: boolean;
  is_reimbursed: boolean;
}

export interface ExpenseFormProps {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  initialData?: Partial<ApiExpense> | null;
  saving?: boolean;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
}

export default function ExpenseForm({
  open,
  onClose,
  editingId,
  initialData,
  saving = false,
  onSubmit,
}: ExpenseFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ExpenseFormData>({
    description: "",
    amount: "",
    tax_amount: "",
    category: "other",
    expense_date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    vendor: "",
    customer_id: null,
    project_id: null,
    receipt_url: "",
    receipt_file: null,
    receipt_preview: null,
    notes: "",
    is_billable: false,
    is_reimbursable: false,
    is_reimbursed: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && initialData) {
      setFormData({
        description: initialData.description ?? "",
        amount: initialData.amount ?? "",
        tax_amount: (initialData as any).tax_amount ?? "",
        category: initialData.category ?? "other",
        expense_date: initialData.expense_date
          ? new Date(initialData.expense_date).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        payment_method: initialData.payment_method ?? "cash",
        vendor: initialData.vendor ?? "",
        customer_id: initialData.customer_id ?? null,
        project_id: initialData.project_id ?? null,
        receipt_url: initialData.receipt_url ?? "",
        receipt_file: null,
        receipt_preview: null,
        notes: initialData.notes ?? "",
        is_billable: initialData.is_billable ?? false,
        is_reimbursable: (initialData as any).is_reimbursable ?? false,
        is_reimbursed: initialData.is_reimbursed ?? false,
      });
      setErrors({});
    }
  }, [open, initialData]);

  if (!open) return null;

  const isImage = (url: string): boolean => {
    return url.match(/\.(jpg|jpeg|png|gif|webp)$/i) !== null;
  };

  const isPdf = (url: string): boolean => {
    return url.match(/\.(pdf)$/i) !== null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast("Please upload a JPG, PNG, or PDF file.", { type: "error" });
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast("File size must be under 10MB.", { type: "error" });
      return;
    }

    const preview = URL.createObjectURL(file);
    setFormData((prev) => ({
      ...prev,
      receipt_file: file,
      receipt_preview: preview,
    }));
  };

  const handleFileUpload = async () => {
    if (!formData.receipt_file || !editingId) return;
    setUploading(true);
    try {
      const res = await uploadExpenseReceipt(editingId, formData.receipt_file);
      const receipts = res.receipts;
      if (receipts && receipts.length > 0) {
        const url = receipts[0].file_path;
        setFormData((prev) => ({
          ...prev,
          receipt_url: url,
          receipt_file: null,
          receipt_preview: null,
        }));
        toast("Receipt uploaded successfully", { type: "success" });
      }
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to upload receipt", { type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }
    if (!formData.amount || parseFloat(formData.amount) < 0) {
      newErrors.amount = "Amount must be a positive number";
    }
    if (!formData.expense_date) {
      newErrors.expense_date = "Date is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (saving) return;

    try {
      await onSubmit(formData);
    } catch (err: any) {
      const msg =
        err.response?.data?.error || "Failed to save expense";
      toast(msg, { type: "error" });
      setErrors({ submit: msg });
    }
  };

  const handleClose = () => {
    if (formData.receipt_preview) {
      URL.revokeObjectURL(formData.receipt_preview);
    }
    setFormData({
      description: "",
      amount: "",
      tax_amount: "",
      category: "other",
      expense_date: new Date().toISOString().slice(0, 10),
      payment_method: "cash",
      vendor: "",
      customer_id: null,
      project_id: null,
      receipt_url: "",
      receipt_file: null,
      receipt_preview: null,
      notes: "",
      is_billable: false,
      is_reimbursable: false,
      is_reimbursed: false,
    });
    setErrors({});
    onClose();
  };

  const handleReceiptUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, receipt_url: e.target.value }));
  };

  const clearReceiptPreview = () => {
    if (formData.receipt_preview) {
      URL.revokeObjectURL(formData.receipt_preview);
    }
    setFormData((prev) => ({
      ...prev,
      receipt_file: null,
      receipt_preview: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center overflow-y-auto py-8">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-3xl mx-4 my-8 border border-color">
        <div className="flex items-center justify-between p-6 border-b border-color-subtle">
          <h3 className="text-lg font-semibold text-primary">
            {editingId ? "Edit Expense" : "Add Expense"}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-tertiary hover:text-primary hover:bg-surface-alt transition-colors"
            aria-label="Close"
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errors.submit && (
            <div className="rounded-lg status-error-bg border status-error-border px-4 py-3 text-sm text-error-text">
              {errors.submit}
            </div>
          )}

          <div>
            <label className="form-label">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className={`w-full rounded-lg border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.description ? "border-error" : "border-input-border"
              }`}
              placeholder="What was this expense for?"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-error-text">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className={`w-full rounded-lg border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary font-tabular-nums ${
                  errors.amount ? "border-error" : "border-input-border"
                }`}
                placeholder="0.00"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-error-text">{errors.amount}</p>
              )}
            </div>

            <div>
              <label className="form-label">
                Tax Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.tax_amount}
                onChange={(e) =>
                  setFormData({ ...formData, tax_amount: e.target.value })
                }
                className="w-full rounded-lg border bg-input px-3 py-2 text-sm text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary font-tabular-nums border-input-border"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="form-label">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="form-select"
              >
                {EXPENSE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.icon} {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">
                Date *
              </label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) =>
                  setFormData({ ...formData, expense_date: e.target.value })
                }
                className={`w-full rounded-lg border bg-input px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.expense_date ? "border-error" : "border-input-border"
                }`}
              />
              {errors.expense_date && (
                <p className="mt-1 text-xs text-error-text">{errors.expense_date}</p>
              )}
            </div>

            <div>
              <label className="form-label">
                Payment Method
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) =>
                  setFormData({ ...formData, payment_method: e.target.value })
                }
                className="form-select"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1).replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">
                Vendor
              </label>
              <input
                type="text"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="form-control"
                placeholder="Who was this paid to?"
              />
            </div>
          </div>

          <div>
            <label className="form-label">
              Receipt
            </label>
            <div className="border-2 border-dashed border-color-subtle rounded-lg p-4 text-center">
              {formData.receipt_preview ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    {isImage(formData.receipt_url) ? (
                      <img
                        src={formData.receipt_preview}
                        alt="Receipt preview"
                        className="max-h-32 max-w-full rounded"
                      />
                    ) : (
                      <FileText className="w-12 h-12 text-tertiary" />
                    )}
                  </div>
                  <p className="text-xs text-tertiary">
                    {formData.receipt_file?.name || "New file selected"}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearReceiptPreview}
                      disabled={saving || uploading}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : formData.receipt_url ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    {isImage(formData.receipt_url) ? (
                      <img
                        src={formData.receipt_url}
                        alt="Receipt"
                        className="max-h-32 max-w-full rounded"
                      />
                    ) : isPdf(formData.receipt_url) ? (
                      <FileText className="w-12 h-12 text-tertiary" />
                    ) : (
                      <iframe
                        src={formData.receipt_url}
                        title="Receipt"
                        className="max-h-32 max-w-full rounded"
                      />
                    )}
                  </div>
                  <p className="text-xs text-tertiary">Receipt attached</p>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 text-tertiary mx-auto mb-2" />
                  <p className="text-sm text-secondary mb-1">
                    Drag & drop or click to upload
                  </p>
                  <p className="text-xs text-tertiary mb-2">
                    JPG, PNG, GIF, WebP, or PDF (max 10MB)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving || uploading}
                    icon={<Upload className="w-4 h-4" />}
                  >
                    Choose File
                  </Button>
                  <p className="text-xs text-tertiary mt-2">
                    Or paste a receipt URL below
                  </p>
                  <input
                    type="url"
                    value={formData.receipt_url}
                    onChange={handleReceiptUrlChange}
                    className="form-control mt-2"
                    placeholder="https://..."
                    disabled={saving || uploading}
                  />
                  {editingId && formData.receipt_url === "" && (
                    <p className="text-xs text-tertiary mt-1">
                      After saving, you can upload receipts directly.
                    </p>
                  )}
                </>
              )}
            </div>

            {editingId && formData.receipt_file && formData.receipt_url === "" && (
              <div className="mt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleFileUpload}
                  disabled={saving || uploading}
                  icon={<Upload className="w-4 h-4" />}
                >
                  {uploading ? "Uploading…" : "Upload Receipt"}
                </Button>
              </div>
            )}
          </div>

          <div>
            <label className="form-label">
              Customer
            </label>
            <CustomerSelector
              value={formData.customer_id ?? undefined}
              onChange={(val) => setFormData({ ...formData, customer_id: val ?? null })}
              placeholder="Assign to a customer"
            />
          </div>

          <div>
            <label className="form-label">
              Project
            </label>
            <ProjectSelector
              value={formData.project_id ?? undefined}
              onChange={(val) => setFormData({ ...formData, project_id: val ?? null })}
              placeholder="Assign to a project"
            />
          </div>

          <div>
            <label className="form-label">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
              className="form-control"
              placeholder="Additional details..."
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:gap-6 gap-3 pt-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_billable}
                onChange={(e) =>
                  setFormData({ ...formData, is_billable: e.target.checked })
                }
                className="rounded border-input-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-secondary">Billable</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_reimbursable}
                onChange={(e) =>
                  setFormData({ ...formData, is_reimbursable: e.target.checked })
                }
                className="rounded border-input-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-secondary">Reimbursable</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_reimbursed}
                onChange={(e) =>
                  setFormData({ ...formData, is_reimbursed: e.target.checked })
                }
                className="rounded border-input-border text-primary focus:ring-primary"
                disabled={!formData.is_reimbursable}
              />
              <span className="text-sm text-secondary">Reimbursed</span>
            </label>
          </div>
        </form>

        <div className="flex justify-end gap-3 p-6 border-t border-color-subtle">
          <Button
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={saving || uploading || !formData.description || !formData.amount}
            onClick={(e) => handleSubmit(e)}
          >
            {saving ? "Saving…" : editingId ? "Update" : "Save Expense"}
          </Button>
        </div>
      </div>
    </div>
  );
}
