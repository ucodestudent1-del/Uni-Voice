import { Download, Send } from "lucide-react";
import { Button } from "@/components/ui";
import DocumentPreview from "@/components/DocumentPreview";
import type { CalculationResult } from "@/types/calculation";
import type { ApiBusiness, ApiCustomer } from "@/types/api";
import type { DocumentState } from "@/components/document";

interface InvoiceMakerPreviewProps {
  state: DocumentState;
  calcResult: CalculationResult | null;
  business: ApiBusiness | null;
  customers: ApiCustomer[];
  onSend?: () => void;
  onDownloadPdf: () => void;
  canDownload: boolean;
  isGeneratingPdf?: boolean;
}

export function InvoiceMakerPreview({
  state,
  calcResult,
  business,
  customers,
  onSend,
  onDownloadPdf,
  canDownload,
  isGeneratingPdf = false,
}: InvoiceMakerPreviewProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-tertiary uppercase tracking-wider">
          Live Preview
        </h3>
        <div className="flex items-center gap-2">
          {onSend && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Send className="h-4 w-4" />}
              onClick={onSend}
              title="Send document"
            >
              Send
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={onDownloadPdf}
            disabled={!canDownload || isGeneratingPdf}
            loading={isGeneratingPdf}
            title={canDownload ? "Download PDF" : "Save draft first to enable PDF download"}
          >
            Download PDF
          </Button>
        </div>
      </div>

      <div className="border border-color rounded-lg bg-surface shadow overflow-auto">
        <DocumentPreview
          documentType="invoice"
          documentNumber={state.invoiceNumber ?? "INV-0001"}
          calcResult={calcResult}
          business={business}
          issueDate={state.issueDate}
          dueDate={state.dueDate}
          poNumber={state.poNumber}
          customerId={state.customerId}
          customers={customers}
          paymentInstructions={state.paymentInstructions}
          notes={state.notes}
          terms={state.terms}
          referenceInvoiceNumber={state.referenceInvoiceNumber}
          shippingDescription={state.shippingDescription}
          shippingAmount={state.shippingAmount}
          shippingTaxRate={state.shippingTaxRate}
        />
      </div>
    </div>
  );
}
