import { useState, useCallback } from "react";
import {
  Button,
  FormField,
  FormTextareaField,
  StatusBadge,
  Dialog,
} from "@/components/ui";
import {
  debitNoteStatusConfig,
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
  createDebitNote,
  finalizeDebitNote,
  sendDebitNote,
  cancelDebitNote,
  voidDebitNote,
  getDebitNotePdf,
  type ApiCreateDebitNoteInput,
} from "@/api/client";
import { formatCurrencyValue } from "@/lib/utils";
import { useMetaTags } from "@/hooks/useMetaTags";

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: number;
  taxName: string | null;
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CHF"];

interface SendDialogData {
  to: string;
  cc: string;
  bcc: string;
}

export default function DebitNoteGenerator() {
  useMetaTags({
    title: "Debit Note Generator — DocForge",
    description: "Create and send professional debit notes. Automatic tax calculations and currency conversion.",
    noIndex: true,
  });

  const { toast } = useToast();

  const [debitNoteId, setDebitNoteId] = useState<string>("");
  const [debitNoteNumber, setDebitNoteNumber] = useState<string>("");
  const [status, setStatus] = useState<string>("draft");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const [sendData, setSendData] = useState<SendDialogData>({
    to: "",
    cc: "",
    bcc: "",
  });

  const [basicFields, setBasicFields] = useState({
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date().toISOString().split("T")[0],
    currency: "USD",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerAddressLine1: "",
    customerAddressLine2: "",
    customerCity: "",
    customerStateOrRegion: "",
    customerPostalCode: "",
    customerCountryCode: "",
    customerTaxId: "",
    referenceInvoiceNumber: "",
    reason: "",
    notes: "",
    terms: "",
    paymentInstructions: "",
  });

  const [items, setItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      description: "",
      quantity: "1",
      unit: "each",
      unitPrice: "0.00",
      taxRate: 0,
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

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        taxRate: 0,
        taxName: null,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    if (!basicFields.customerName.trim()) {
      toast("Customer name is required", { type: "error" });
      return;
    }

    const validItems = items.filter((item) => item.description.trim() !== "");
    if (validItems.length === 0) {
      toast("At least one line item is required", { type: "error" });
      return;
    }

    setSaveDialogOpen(false);
    setIsSubmitting(true);

    const data: ApiCreateDebitNoteInput = {
      issueDate: basicFields.issueDate,
      dueDate: basicFields.dueDate,
      currency: basicFields.currency,
      customerName: basicFields.customerName,
      customerEmail: basicFields.customerEmail || null,
      customerPhone: basicFields.customerPhone || null,
      customerAddressLine1: basicFields.customerAddressLine1 || null,
      customerAddressLine2: basicFields.customerAddressLine2 || null,
      customerCity: basicFields.customerCity || null,
      customerStateOrRegion: basicFields.customerStateOrRegion || null,
      customerPostalCode: basicFields.customerPostalCode || null,
      customerCountryCode: basicFields.customerCountryCode || null,
      customerTaxId: basicFields.customerTaxId || null,
      referenceInvoiceNumber: basicFields.referenceInvoiceNumber || null,
      reason: basicFields.reason || null,
      notes: basicFields.notes || null,
      terms: basicFields.terms || null,
      paymentInstructions: basicFields.paymentInstructions || null,
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
      const result = await createDebitNote(data);
      const note = result.debitNote;
      setDebitNoteId(note.id);
      setDebitNoteNumber(note.debit_note_number || "");
      setStatus(note.status);
      toast("Debit note created successfully", { type: "success" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to create debit note", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeAndSend = useCallback(async () => {
    if (status === "draft") {
      if (!debitNoteId) {
        toast("Please save the debit note first", { type: "error" });
        return;
      }

      setIsFinalizing(true);
      try {
        const result = await finalizeDebitNote(debitNoteId);
        setDebitNoteNumber(result.debitNoteNumber);
        setStatus(result.debitNote.status);
        toast("Debit note finalized successfully", { type: "success" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        toast(err.response?.data?.error || "Failed to finalize debit note", { type: "error" });
        return;
      } finally {
        setIsFinalizing(false);
      }
    }

    if (status === "finalized" || status === "sent") {
      await handleDownloadPdf();
      return;
    }

    if (status === "finalized") {
      setSendDialogOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, debitNoteId, toast]);

  const handleSend = async () => {
    setSendDialogOpen(false);
    if (!debitNoteId) return;

    setIsSending(true);
    try {
      const result = await sendDebitNote(debitNoteId, {
        to: sendData.to,
        cc: sendData.cc ? sendData.cc.split(",").map((e) => e.trim()).filter(Boolean) : [],
        bcc: sendData.bcc ? sendData.bcc.split(",").map((e) => e.trim()).filter(Boolean) : [],
      });
      setStatus(result.status);
      toast("Debit note sent successfully", { type: "success" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to send debit note", { type: "error" });
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!debitNoteId) {
      toast("Please save the debit note first", { type: "error" });
      return;
    }
    try {
      const blob = await getDebitNotePdf(debitNoteId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = debitNoteNumber
        ? `DebitNote-${debitNoteNumber}.pdf`
        : "DebitNote.pdf";
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast("PDF downloaded successfully", { type: "success" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to download PDF", { type: "error" });
    }
  }, [debitNoteId, debitNoteNumber, toast]);

  const handleCancel = async () => {
    if (!debitNoteId) {
      toast("Please save the debit note first", { type: "error" });
      return;
    }
    if (status === "draft") {
      toast("Nothing to cancel — debit note is in draft status", { type: "error" });
      return;
    }
    try {
      await cancelDebitNote(debitNoteId, "Cancelled by user");
      setStatus("cancelled");
      toast("Debit note cancelled", { type: "success" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to cancel debit note", { type: "error" });
    }
  };

  const handleVoid = async () => {
    if (!debitNoteId) {
      toast("Please save the debit note first", { type: "error" });
      return;
    }
    if (status === "draft" || status === "cancelled") {
      toast(`Cannot void debit note in ${status} status`, { type: "error" });
      return;
    }
    try {
      await voidDebitNote(debitNoteId, "Voided by user");
      setStatus("void");
      toast("Debit note voided", { type: "success" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to void debit note", { type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Debit Note Generator</h1>
          <p className="text-sm text-secondary mt-1">
            Create a debit note for additional charges to a customer and send via email.
          </p>
        </div>
        {debitNoteNumber && status !== "draft" && (
          <StatusBadge
            status={status}
            config={debitNoteStatusConfig}
            showIcon
            size="md"
          />
        )}
      </div>

      {/* Debit Note Number Display */}
      {debitNoteNumber && (
        <div className="rounded-xl border border-color-subtle bg-surface-alt p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-tertiary uppercase">Debit Note Number</span>
              <p className="text-lg font-semibold text-primary mt-1">{debitNoteNumber}</p>
            </div>
            {status === "finalized" && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Customer & Basic Info Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Details */}
        <div className="bg-surface rounded-xl border border-color-subtle p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">Customer Details</h2>
          <FormField
            label="Customer Name"
            placeholder="Enter customer name"
            value={basicFields.customerName}
            onChange={(e) => setBasicFields({ ...basicFields, customerName: e.target.value })}
            required
          />
          <FormField
            label="Customer Email"
            placeholder="customer@example.com"
            value={basicFields.customerEmail}
            onChange={(e) => setBasicFields({ ...basicFields, customerEmail: e.target.value })}
          />
          <FormField
            label="Customer Phone"
            placeholder="+1 (555) 123-4567"
            value={basicFields.customerPhone}
            onChange={(e) => setBasicFields({ ...basicFields, customerPhone: e.target.value })}
          />
          <FormField
            label="Tax ID"
            placeholder="Tax ID / VAT number"
            value={basicFields.customerTaxId}
            onChange={(e) => setBasicFields({ ...basicFields, customerTaxId: e.target.value })}
          />
          <FormField
            label="Address Line 1"
            placeholder="Street address"
            value={basicFields.customerAddressLine1}
            onChange={(e) => setBasicFields({ ...basicFields, customerAddressLine1: e.target.value })}
          />
          <FormField
            label="Address Line 2"
            placeholder="Apt, Suite, etc. (optional)"
            value={basicFields.customerAddressLine2}
            onChange={(e) => setBasicFields({ ...basicFields, customerAddressLine2: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="City"
              value={basicFields.customerCity}
              onChange={(e) => setBasicFields({ ...basicFields, customerCity: e.target.value })}
            />
            <FormField
              label="State / Region"
              value={basicFields.customerStateOrRegion}
              onChange={(e) => setBasicFields({ ...basicFields, customerStateOrRegion: e.target.value })}
            />
            <FormField
              label="Postal Code"
              value={basicFields.customerPostalCode}
              onChange={(e) => setBasicFields({ ...basicFields, customerPostalCode: e.target.value })}
            />
            <FormField
              label="Country Code"
              placeholder="US"
              value={basicFields.customerCountryCode}
              onChange={(e) => setBasicFields({ ...basicFields, customerCountryCode: e.target.value })}
            />
          </div>
        </div>

        {/* Debit Note Info */}
        <div className="bg-surface rounded-xl border border-color-subtle p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">Debit Note Information</h2>
          <FormField
            label="Issue Date"
            type="date"
            value={basicFields.issueDate}
            onChange={(e) => setBasicFields({ ...basicFields, issueDate: e.target.value })}
          />
          <FormField
            label="Due Date"
            type="date"
            value={basicFields.dueDate}
            onChange={(e) => setBasicFields({ ...basicFields, dueDate: e.target.value })}
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
            label="Reference Invoice Number"
            placeholder="Invoice this note relates to"
            value={basicFields.referenceInvoiceNumber}
            onChange={(e) => setBasicFields({ ...basicFields, referenceInvoiceNumber: e.target.value })}
          />
           <FormTextareaField
             label="Reason"
             placeholder="Why is this debit note being issued?"
             value={basicFields.reason}
             onChange={(e) => setBasicFields({ ...basicFields, reason: e.target.value })}
             rows={3}
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
                  placeholder="What is being charged for?"
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
                  onChange={(e) => updateItem(item.id, "taxRate", Number(e.target.value) || 0)}
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
            placeholder="Additional notes for the customer..."
            value={basicFields.notes}
            onChange={(e) => setBasicFields({ ...basicFields, notes: e.target.value })}
            rows={3}
          />
          <FormTextareaField
            label="Payment Instructions"
            placeholder="How should the customer pay?"
            value={basicFields.paymentInstructions}
            onChange={(e) => setBasicFields({ ...basicFields, paymentInstructions: e.target.value })}
            rows={3}
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
            disabled={isSubmitting || !!debitNoteId}
          >
            {isSubmitting ? "Saving..." : debitNoteId ? "Saved" : "Save Debit Note"}
          </Button>
          <Button
            variant={status === "draft" || status === "finalized" ? "primary" : "secondary"}
            icon={<Download className="w-4 h-4" />}
            onClick={handleFinalizeAndSend}
            disabled={isFinalizing || isSubmitting || isSending || !debitNoteId}
          >
            {isFinalizing ? "Finalizing..." : status === "draft" ? "Finalize & Send" : status === "finalized" ? "Send Email" : "Download PDF"}
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
        title="Save Debit Note"
        description="Save this debit note to create a record and generate a number."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Are you sure you want to save this debit note? Once saved, you can finalize
            it to generate a number and send it to your customer.
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
              {isSubmitting ? "Saving..." : "Save Debit Note"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        title="Send Debit Note"
        description="Send the finalized debit note to your customer via email."
        size="md"
      >
        <div className="space-y-4">
          <FormField
            label="To"
            placeholder="customer@example.com"
            value={sendData.to}
            onChange={(e) => setSendData({ ...sendData, to: e.target.value })}
            required
          />
          <FormField
            label="CC"
            placeholder="cc@example.com (comma-separated)"
            value={sendData.cc}
            onChange={(e) => setSendData({ ...sendData, cc: e.target.value })}
          />
          <FormField
            label="BCC"
            placeholder="bcc@example.com (comma-separated)"
            value={sendData.bcc}
            onChange={(e) => setSendData({ ...sendData, bcc: e.target.value })}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSendDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSend}
              disabled={isSending || !sendData.to}
            >
              {isSending ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

