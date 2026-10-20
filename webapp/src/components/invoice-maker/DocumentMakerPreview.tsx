import { Download } from "lucide-react";
import { Button } from "@/components/ui";
import DocumentPreview from "@/components/DocumentPreview";
import type { CalculationResult } from "@/types/calculation";
import type { ApiBusiness, ApiCustomer } from "@/types/api";
import type { DocumentState, DocumentFormConfig, DocumentType } from "@/components/document";
import { docTypeLabel } from "@/components/document";

interface DocumentMakerPreviewProps {
  docType: DocumentType;
  state: DocumentState;
  calcResult: CalculationResult | null;
  formConfig: DocumentFormConfig;
  business: ApiBusiness | null;
  customers: ApiCustomer[];
  documentNumber: string;
  onDownloadPdf: () => void;
  canDownload: boolean;
  isGeneratingPdf?: boolean;
}

export function DocumentMakerPreview({
  docType,
  state,
  calcResult,
  formConfig,
  business,
  customers,
  documentNumber,
  onDownloadPdf,
  canDownload,
  isGeneratingPdf = false,
}: DocumentMakerPreviewProps) {
  const label = docTypeLabel(docType);

  if (!calcResult) {
    return (
      <div className="bg-surface border border-color rounded-lg p-8 text-center">
        <p className="text-tertiary">Enter item details to see a live {label.toLowerCase()} preview.</p>
      </div>
    );
  }

  const isCreditNote = formConfig.isCreditNote;
  const isPaymentVoucher = formConfig.isPaymentVoucher;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">Live Preview</h2>
        <div className="flex items-center gap-2">
          {documentNumber && (
            <span className="text-sm text-tertiary">{documentNumber}</span>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={onDownloadPdf}
            disabled={!canDownload || isGeneratingPdf}
            loading={isGeneratingPdf}
          >
            Download PDF
          </Button>
        </div>
      </div>

      <div className="border border-color rounded-lg overflow-hidden bg-white">
        <DocumentPreview
          documentType={formConfig.totalsCardType}
          documentNumber={documentNumber}
          calcResult={calcResult}
          business={business}
          issueDate={state.issueDate}
          dueDate={formConfig.showsDueDate ? state.dueDate : undefined}
          expiryDate={formConfig.showsExpiryDate ? state.expiryDate : undefined}
          poNumber={formConfig.showsPoNumber ? state.poNumber : undefined}
          customerId={state.customerId}
          customers={customers}
          paymentInstructions={isPaymentVoucher ? undefined : state.paymentInstructions}
          notes={state.notes}
          terms={state.terms}
          scopeOfWork={formConfig.isQuote ? state.scopeOfWork : undefined}
          signedAmounts={isCreditNote}
          reason={formConfig.showsReasonField ? state.reason : undefined}
          customReason={formConfig.showsReasonField ? state.customReason : undefined}
          referenceInvoiceNumber={formConfig.showsReferenceInvoice ? state.referenceInvoiceNumber : undefined}
          shippingDescription={formConfig.showsShippingFields ? state.shippingDescription : undefined}
          shippingAmount={formConfig.showsShippingFields ? state.shippingAmount : undefined}
          shippingTaxRate={formConfig.showsShippingFields ? state.shippingTaxRate : undefined}
          voucherDate={isPaymentVoucher ? (state.voucherDate ?? state.issueDate) : undefined}
          payeeName={isPaymentVoucher ? state.payeeName : undefined}
          payeeEmail={isPaymentVoucher ? state.payeeEmail : undefined}
          payeePhone={isPaymentVoucher ? state.payeePhone : undefined}
          referenceNumber={isPaymentVoucher ? state.referenceNumber : undefined}
          paymentMethod={isPaymentVoucher ? state.paymentMethod : undefined}
          paymentProvider={isPaymentVoucher ? state.paymentProvider : undefined}
        />
      </div>
    </div>
  );
}
