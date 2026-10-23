 
import { useState } from "react";
import { Copy, FileDown } from "lucide-react";
import { Button, Dialog, useToast } from "@/components/ui";
import {
  convertDocument,
  getAvailableConversions,
  type DocumentTypeParam,
  type ConvertDocumentResult,
} from "@/api/client";

interface DocumentConverterProps {
  open: boolean;
  onClose: () => void;
  docType: DocumentTypeParam;
  docId: string;
  onConversionComplete?: (result: ConvertDocumentResult) => void;
}

const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF",
  csv: "CSV",
  html: "HTML",
  markdown: "Markdown",
  xml: "XML",
};

const DOCUMENT_TYPE_LABELS: Record<DocumentTypeParam, string> = {
  invoice: "Invoice",
  quote: "Quote",
  "credit-note": "Credit Note",
  "debit-note": "Debit Note",
  "payment-voucher": "Payment Voucher",
  receipt: "Receipt",
  "purchase-order": "Purchase Order",
  "recurring-invoice": "Recurring Invoice",
  "delivery-note": "Delivery Note",
  "packing-slip": "Packing Slip",
  "pro-forma-invoice": "Pro Forma Invoice",
  estimate: "Estimate",
};

export function DocumentConverter({
  open,
  onClose,
  docType,
  docId,
  onConversionComplete,
}: DocumentConverterProps) {
  const { toast } = useToast();
  const [targetType, setTargetType] = useState<DocumentTypeParam | "">("");
  const [availableConversions, setAvailableConversions] = useState<DocumentTypeParam[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>("pdf");
  const [exporting, setExporting] = useState(false);

  const loadConversions = async () => {
    if (loaded) return;
    try {
      const res = await getAvailableConversions(docType, docId);
      setAvailableConversions(res.conversions);
    } catch {
      toast("Failed to load available conversions", { type: "error" });
    } finally {
      setLoaded(true);
    }
  };

  if (open && !loaded) {
    loadConversions();
  }

  const handleConvert = async () => {
    if (!targetType) {
      toast("Please select a target document type", { type: "error" });
      return;
    }

    setLoading(true);
    try {
      const result = await convertDocument({
        docType,
        docId,
        targetType: targetType as DocumentTypeParam,
        copyItems: true,
        copyCustomer: true,
      });
      toast(
        `Converted to ${DOCUMENT_TYPE_LABELS[targetType as DocumentTypeParam]} successfully`,
        { type: "success" },
      );
      onConversionComplete?.(result);
      onClose();
    } catch (err: any) {
      toast(err?.message ?? "Failed to convert document", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          docId,
          format: exportFormat,
        }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docType}-${docId}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast(`Exported as ${FORMAT_LABELS[exportFormat] ?? exportFormat}`, {
        type: "success",
      });
    } catch {
      toast("Failed to export document", { type: "error" });
    } finally {
      setExporting(false);
    }
  };

  const canConvert = availableConversions.length > 0;

  const content = (
    <div className="space-y-4">
      <p className="text-sm text-secondary">
        Convert this {DOCUMENT_TYPE_LABELS[docType]} to another document type,
        or export it in a different format.
      </p>

      {canConvert ? (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Convert to document type
            </label>
            <select
              className="form-select w-full"
              value={targetType}
              onChange={(e) =>
                setTargetType(e.target.value as DocumentTypeParam | "")
              }
              disabled={loading}
            >
              <option value="">Select a target type...</option>
              {availableConversions.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <p className="text-xs text-tertiary">
              Creates a new draft document of the selected type with fields
              mapped from this document.
            </p>
          </div>

          <Button
            onClick={handleConvert}
            loading={loading}
            disabled={!targetType}
            className="w-full"
          >
            <Copy className="h-4 w-4" />
            Convert to {targetType ? DOCUMENT_TYPE_LABELS[targetType] : ""}
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Export as format
            </label>
            <select
              className="form-select w-full"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              disabled={exporting}
            >
              {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleExport}
            loading={exporting}
            className="w-full"
          >
            <FileDown className="h-4 w-4" />
            Export as {FORMAT_LABELS[exportFormat] ?? exportFormat}
          </Button>

          <p className="text-xs text-tertiary text-center">
            No conversions available for this document type.
          </p>
        </>
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Convert Document"
      description={`Convert this ${DOCUMENT_TYPE_LABELS[docType]} to another document type, or export in a different format.`}
      size="md"
    >
      {content}
    </Dialog>
  );
}
