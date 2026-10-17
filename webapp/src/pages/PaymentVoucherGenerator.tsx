import { useState, useCallback } from "react";
import {
  Button,
  FormField,
  FormTextareaField,
  StatusBadge,
  Dialog,
} from "@/components/ui";
import {
  paymentVoucherStatusConfig,
} from "@/components/ui";
import {
  Download,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createPaymentVoucher,
  finalizePaymentVoucher,
  cancelPaymentVoucher,
  voidPaymentVoucher,
  getPaymentVoucherPdf,
  type ApiCreatePaymentVoucherInput,
} from "@/api/client";
import { formatCurrencyValue } from "@/lib/utils";
import { useMetaTags } from "@/hooks/useMetaTags";

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  taxName: string | null;
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CHF"];

export default function PaymentVoucherGenerator() {
  useMetaTags({
    title: "Payment Voucher Generator — InvoiceFlow",
    description: "Create and manage payment vouchers for business expenses. Automatic calculations and multi-currency support.",
    noIndex: true,
  });

  const { toast } = useToast();

  const [voucherId, setVoucherId] = useState<string>("");
  const [voucherNumber, setVoucherNumber] = useState<string>("");
  const [status, setStatus] = useState<string>("draft");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const [basicFields, setBasicFields] = useState({
    voucherDate: new Date().toISOString().split("T")[0],
    currency: "USD",
    payeeName: "",
    payeeEmail: "",
    payeePhone: "",
    payeeAddressLine1: "",
    payeeAddressLine2: "",
    payeeCity: "",
    payeeStateOrRegion: "",
    payeePostalCode: "",
    payeeCountryCode: "",
    payeeTaxId: "",
    referenceNumber: "",
    paymentMethod: "",
    paymentProvider: "",
    notes: "",
    terms: "",
   });

  const [items, setItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      description: "",
      quantity: "1",
      unit: "each",
      unitPrice: "0.00",
      taxRate: "0",
      taxName: null,
    },
  ]);

  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unitPrice || 0);
    return sum + qty * price;
  }, 0);

  const taxTotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unitPrice || 0);
    const rate = Number(item.taxRate || 0);
    return sum + qty * price * rate / 100;
  }, 0);

  const total = subtotal + taxTotal;

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: "1",
        unit: "each",
        unitPrice: "0.00",
        taxRate: "0",
        taxName: null,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    if (!basicFields.payeeName.trim()) {
      toast("Payee name is required", { type: "error" });
      return;
    }

    const validItems = items.filter((item) => item.description.trim() !== "");
    if (validItems.length === 0) {
      toast("At least one line item is required", { type: "error" });
      return;
    }

    setSaveDialogOpen(false);
    setIsSubmitting(true);

    const data: ApiCreatePaymentVoucherInput = {
      voucherDate: basicFields.voucherDate,
      currency: basicFields.currency,
      payeeName: basicFields.payeeName,
      payeeEmail: basicFields.payeeEmail || null,
      payeePhone: basicFields.payeePhone || null,
      payeeAddressLine1: basicFields.payeeAddressLine1 || null,
      payeeAddressLine2: basicFields.payeeAddressLine2 || null,
      payeeCity: basicFields.payeeCity || null,
      payeeStateOrRegion: basicFields.payeeStateOrRegion || null,
      payeePostalCode: basicFields.payeePostalCode || null,
      payeeCountryCode: basicFields.payeeCountryCode || null,
      payeeTaxId: basicFields.payeeTaxId || null,
      referenceNumber: basicFields.referenceNumber || null,
      paymentMethod: basicFields.paymentMethod || null,
      paymentProvider: basicFields.paymentProvider || null,
      notes: basicFields.notes || null,
      terms: basicFields.terms || null,
      items: validItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxName: item.taxName,
      })),
    };

    try {
      const result = await createPaymentVoucher(data);
      const voucher = result.voucher;
      setVoucherId(voucher.id);
      setVoucherNumber(voucher.payment_voucher_number || "");
      setStatus(voucher.status);
      toast("Payment voucher created successfully", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to create payment voucher", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeAndSend = useCallback(async () => {
    if (status !== "draft") {
      handleDownloadPdf();
      return;
    }

    if (!voucherId) {
      toast("Please save the voucher first", { type: "error" });
      return;
    }

    setIsFinalizing(true);
    try {
      const result = await finalizePaymentVoucher(voucherId);
      setVoucherNumber(result.voucherNumber);
      setStatus(result.voucher.status);
      toast("Payment voucher finalized successfully", { type: "success" });
      await handleDownloadPdf();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to finalize payment voucher", { type: "error" });
    } finally {
      setIsFinalizing(false);
    }
  }, [status, toast]);

  const handleDownloadPdf = useCallback(async () => {
    if (!voucherId) {
      toast("Please save the voucher first", { type: "error" });
      return;
    }
    try {
      const blob = await getPaymentVoucherPdf(voucherId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = voucherNumber
        ? `PaymentVoucher-${voucherNumber}.pdf`
        : "PaymentVoucher.pdf";
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast("PDF downloaded successfully", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to download PDF", { type: "error" });
    }
  }, [voucherNumber, toast]);

  const handleCancel = async () => {
    if (!voucherId) {
      toast("Please save the voucher first", { type: "error" });
      return;
    }
    if (status === "draft") {
      toast("Nothing to cancel — voucher is in draft status", { type: "error" });
      return;
    }
    try {
      await cancelPaymentVoucher(voucherId, "Cancelled by user");
      setStatus("cancelled");
      toast("Payment voucher cancelled", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to cancel payment voucher", { type: "error" });
    }
  };

  const handleVoid = async () => {
    if (!voucherId) {
      toast("Please save the voucher first", { type: "error" });
      return;
    }
    if (status === "draft" || status === "cancelled") {
      toast(`Cannot void voucher in ${status} status`, { type: "error" });
      return;
    }
    try {
      await voidPaymentVoucher(voucherId, "Voided by user");
      setStatus("void");
      toast("Payment voucher voided", { type: "success" });
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to void payment voucher", { type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Payment Voucher Generator</h1>
          <p className="text-sm text-secondary mt-1">
            Create and download a professional payment voucher for business payments.
          </p>
        </div>
        {voucherNumber && status !== "draft" && (
          <StatusBadge
            status={status}
            config={paymentVoucherStatusConfig}
            showIcon
            size="md"
          />
        )}
      </div>

      {/* Voucher Number Display */}
      {voucherNumber && (
        <div className="rounded-xl border border-color-subtle bg-surface-alt p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-tertiary uppercase">Voucher Number</span>
              <p className="text-lg font-semibold text-primary mt-1">{voucherNumber}</p>
            </div>
          </div>
        </div>
      )}

      {/* Payee & Basic Info Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payee Details */}
        <div className="bg-surface rounded-xl border border-color-subtle p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">Payee Details</h2>
          <FormField
            label="Payee Name"
            placeholder="Enter payee name"
            value={basicFields.payeeName}
            onChange={(e) => setBasicFields({ ...basicFields, payeeName: e.target.value })}
            required
          />
          <FormField
            label="Payee Email"
            placeholder="payee@example.com"
            value={basicFields.payeeEmail}
            onChange={(e) => setBasicFields({ ...basicFields, payeeEmail: e.target.value })}
          />
          <FormField
            label="Payee Phone"
            placeholder="+1 (555) 123-4567"
            value={basicFields.payeePhone}
            onChange={(e) => setBasicFields({ ...basicFields, payeePhone: e.target.value })}
          />
          <FormField
            label="Tax ID"
            placeholder="Tax ID / VAT number"
            value={basicFields.payeeTaxId}
            onChange={(e) => setBasicFields({ ...basicFields, payeeTaxId: e.target.value })}
          />
          <FormField
            label="Address Line 1"
            placeholder="Street address"
            value={basicFields.payeeAddressLine1}
            onChange={(e) => setBasicFields({ ...basicFields, payeeAddressLine1: e.target.value })}
          />
          <FormField
            label="Address Line 2"
            placeholder="Apt, Suite, etc. (optional)"
            value={basicFields.payeeAddressLine2}
            onChange={(e) => setBasicFields({ ...basicFields, payeeAddressLine2: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="City"
              value={basicFields.payeeCity}
              onChange={(e) => setBasicFields({ ...basicFields, payeeCity: e.target.value })}
            />
            <FormField
              label="State / Region"
              value={basicFields.payeeStateOrRegion}
              onChange={(e) => setBasicFields({ ...basicFields, payeeStateOrRegion: e.target.value })}
            />
            <FormField
              label="Postal Code"
              value={basicFields.payeePostalCode}
              onChange={(e) => setBasicFields({ ...basicFields, payeePostalCode: e.target.value })}
            />
            <FormField
              label="Country Code"
              placeholder="US"
              value={basicFields.payeeCountryCode}
              onChange={(e) => setBasicFields({ ...basicFields, payeeCountryCode: e.target.value })}
            />
          </div>
        </div>

        {/* Voucher Info */}
        <div className="bg-surface rounded-xl border border-color-subtle p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">Voucher Information</h2>
          <FormField
            label="Voucher Date"
            type="date"
            value={basicFields.voucherDate}
            onChange={(e) => setBasicFields({ ...basicFields, voucherDate: e.target.value })}
          />
          <FormField
            label="Currency"
            select
            value={basicFields.currency}
            onChange={(e) => setBasicFields({ ...basicFields, currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </FormField>
          <FormField
            label="Reference Number"
            placeholder="Optional reference / PO number"
            value={basicFields.referenceNumber}
            onChange={(e) => setBasicFields({ ...basicFields, referenceNumber: e.target.value })}
          />
          <FormField
            label="Payment Method"
            placeholder="Cash, Bank Transfer, Check, etc."
            value={basicFields.paymentMethod}
            onChange={(e) => setBasicFields({ ...basicFields, paymentMethod: e.target.value })}
          />
          <FormField
            label="Payment Provider"
            placeholder="Optional provider name"
            value={basicFields.paymentProvider}
            onChange={(e) => setBasicFields({ ...basicFields, paymentProvider: e.target.value })}
          />
        </div>
      </div>

      {/* Line Items Section */}
      <div className="bg-surface rounded-xl border border-color-subtle p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">Line Items</h2>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={addItem}
          >
            Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-2 items-end p-3 bg-surface-alt rounded-lg"
            >
              <div className="col-span-4">
                <FormField
                  label={index === 0 ? "Description" : ""}
                  placeholder="What was paid for?"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  inputClassName="text-sm"
                />
              </div>
              <div className="col-span-1">
                <FormField
                  label={index === 0 ? "Qty" : ""}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                  inputClassName="text-sm"
                />
              </div>
              <div className="col-span-2">
                <FormField
                  label={index === 0 ? "Unit" : ""}
                  value={item.unit}
                  onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                  inputClassName="text-sm"
                />
              </div>
              <div className="col-span-2">
                <FormField
                  label={index === 0 ? "Unit Price" : ""}
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                  inputClassName="text-sm"
                />
              </div>
              <div className="col-span-2">
                <FormField
                  label={index === 0 ? "Tax Rate (%)" : ""}
                  value={item.taxRate}
                  onChange={(e) => updateItem(item.id, "taxRate", e.target.value)}
                  inputClassName="text-sm"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="rounded-lg p-1.5 text-tertiary hover:bg-error-bg hover:text-error-text"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes & Terms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border border-color-subtle p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">Notes & Terms</h2>
           <FormTextareaField
             label="Notes"
             placeholder="Additional notes for the payee..."
             value={basicFields.notes}
             onChange={(e) => setBasicFields({ ...basicFields, notes: e.target.value })}
             rows={4}
           />
           <FormTextareaField
             label="Terms"
             placeholder="Payment terms..."
             value={basicFields.terms}
             onChange={(e) => setBasicFields({ ...basicFields, terms: e.target.value })}
             rows={3}
           />
        </div>

        {/* Totals Card */}
        <div className="bg-surface rounded-xl border border-color-subtle p-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Totals</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-tertiary">Subtotal</span>
              <span className="text-primary font-tabular-nums">
                {formatCurrencyValue(subtotal, basicFields.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-tertiary">Tax Total</span>
              <span className="text-primary font-tabular-nums">
                {formatCurrencyValue(taxTotal, basicFields.currency)}
              </span>
            </div>
            <div className="border-t border-color-subtle pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-primary font-semibold">Total</span>
                <span className="text-primary font-bold font-tabular-nums text-lg">
                  {formatCurrencyValue(total, basicFields.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t border-color-subtle">
        <div className="flex gap-3">
          <Button
            variant="primary"
            icon={<Save className="w-4 h-4" />}
            onClick={() => setSaveDialogOpen(true)}
            disabled={isSubmitting || !!voucherId}
          >
            {isSubmitting ? "Saving..." : voucherId ? "Saved" : "Save Voucher"}
          </Button>
          <Button
            variant={status === "draft" ? "primary" : "secondary"}
            icon={<Download className="w-4 h-4" />}
            onClick={handleFinalizeAndSend}
            disabled={isFinalizing || isSubmitting || !voucherId}
          >
            {isFinalizing ? "Generating..." : status === "draft" ? "Finalize & Download PDF" : "Download PDF"}
          </Button>
          {status !== "draft" && status !== "cancelled" && (
            <>
              <Button
                variant="danger"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                variant="warning"
                icon={<X className="w-4 h-4" />}
                onClick={handleVoid}
              >
                Void
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Save Confirmation Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        title="Save Payment Voucher"
        description="Save this payment voucher to generate a number and issue it."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Are you sure you want to save this payment voucher? Once saved, you can finalize
            it to generate a voucher number and download the PDF.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSaveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Voucher"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
