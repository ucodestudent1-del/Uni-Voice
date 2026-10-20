import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FormField, FormTextareaField } from "@/components/ui";
import { SUPPORTED_CURRENCIES } from "@/types/currency";
import type { DocumentState, DocumentType } from "./document-types";

interface DocumentDetailsAccordionProps {
  docType: DocumentType;
  state: DocumentState;
  isFinalized: boolean;
  onStateChange: (patch: Partial<DocumentState>) => void;
}

export function DocumentDetailsAccordion({
  docType,
  state,
  isFinalized,
  onStateChange,
}: DocumentDetailsAccordionProps) {
  const [open, setOpen] = useState(false);

  const fc = getFormConfig(docType);

  return (
    <div className="border border-color rounded-lg bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        disabled={isFinalized}
      >
        <span className="text-sm font-medium text-primary">Document Details</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-tertiary" />
        ) : (
          <ChevronDown className="h-4 w-4 text-tertiary" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-color">
          {fc.showsCurrency && (
            <FormField
              label="Currency"
              select
              value={state.currency}
              onChange={(e) => onStateChange({ currency: e.target.value })}
              disabled={isFinalized}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            {fc.showsIssueDate && (
              <FormField
                label={fc.issueDateLabel}
                type="date"
                value={state.issueDate}
                onChange={(e) => onStateChange({ issueDate: e.target.value })}
                disabled={isFinalized}
              />
            )}

            {fc.showsDueDate && (
              <FormField
                label="Due Date"
                type="date"
                value={state.dueDate ?? ""}
                onChange={(e) => onStateChange({ dueDate: e.target.value })}
                disabled={isFinalized}
              />
            )}

            {fc.showsExpiryDate && (
              <FormField
                label="Expiry Date"
                type="date"
                value={state.expiryDate ?? ""}
                onChange={(e) => onStateChange({ expiryDate: e.target.value })}
                disabled={isFinalized}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {fc.showsPoNumber && (
              <FormField
                label="P.O. Number"
                value={state.poNumber ?? ""}
                onChange={(e) => onStateChange({ poNumber: e.target.value })}
                disabled={isFinalized}
              />
            )}

            {fc.showsPaymentTerms && (
              <FormField
                label="Payment Terms"
                value={state.paymentTerms ?? ""}
                onChange={(e) => onStateChange({ paymentTerms: e.target.value })}
                disabled={isFinalized}
              />
            )}

            {fc.showsDeliveryDate && (
              <FormField
                label="Delivery Date"
                type="date"
                value={state.deliveryDate ?? ""}
                onChange={(e) => onStateChange({ deliveryDate: e.target.value })}
                disabled={isFinalized}
              />
            )}

            {fc.showsInvoiceDiscount && (
              <div className="col-span-1">
                <FormField
                  label="Invoice Discount"
                  value={state.invoiceDiscount ?? "0"}
                  onChange={(e) => onStateChange({ invoiceDiscount: e.target.value })}
                  disabled={isFinalized}
                />
              </div>
            )}

            {fc.showsInvoiceDiscount && (
              <div className="col-span-1">
                <FormField
                  label="Discount Type"
                  select
                  value={state.invoiceDiscountType ?? "fixed"}
                  onChange={(e) =>
                    onStateChange({ invoiceDiscountType: e.target.value as "fixed" | "percentage" })
                  }
                  disabled={isFinalized}
                >
                  <option value="percentage">%</option>
                  <option value="fixed">$</option>
                </FormField>
              </div>
            )}

            {fc.showsQuoteDiscount && (
              <div className="col-span-1">
                <FormField
                  label="Quote Discount"
                  value={state.quoteDiscount ?? "0"}
                  onChange={(e) => onStateChange({ quoteDiscount: e.target.value })}
                  disabled={isFinalized}
                />
              </div>
            )}

            {fc.showsQuoteDiscount && (
              <div className="col-span-1">
                <FormField
                  label="Discount Type"
                  select
                  value={state.quoteDiscountType ?? "fixed"}
                  onChange={(e) =>
                    onStateChange({ quoteDiscountType: e.target.value as "fixed" | "percentage" })
                  }
                  disabled={isFinalized}
                >
                  <option value="percentage">%</option>
                  <option value="fixed">$</option>
                </FormField>
              </div>
            )}

            {fc.showsReferenceInvoice && (
              <FormField
                label="Reference Invoice"
                value={state.referenceInvoiceNumber ?? ""}
                onChange={(e) => onStateChange({ referenceInvoiceNumber: e.target.value })}
                disabled={isFinalized}
                helperText={state.referenceInvoiceId ? `Linked: ${state.referenceInvoiceId}` : undefined}
              />
            )}

            {fc.showsReason && (
              <FormField
                label="Reason"
                value={state.reason ?? ""}
                onChange={(e) => onStateChange({ reason: e.target.value })}
                disabled={isFinalized}
              />
            )}

            {fc.showsCustomReason && (
              <FormField
                label="Custom Reason"
                value={state.customReason ?? ""}
                onChange={(e) => onStateChange({ customReason: e.target.value })}
                disabled={isFinalized}
              />
            )}

            {fc.showsShippingDescription && (
              <FormField
                label="Shipping Description"
                value={state.shippingDescription ?? ""}
                onChange={(e) => onStateChange({ shippingDescription: e.target.value })}
                disabled={isFinalized}
              />
            )}

            {fc.showsShippingAmount && (
              <FormField
                label="Shipping Amount"
                value={state.shippingAmount ?? "0"}
                onChange={(e) => onStateChange({ shippingAmount: e.target.value })}
                disabled={isFinalized}
              />
            )}
          </div>

          {fc.showsNotesInAccordion && (
            <>
              <FormTextareaField
                label="Notes"
                placeholder="Additional notes for the customer..."
                value={state.notes}
                onChange={(e) => onStateChange({ notes: e.target.value })}
                disabled={isFinalized}
              />
              <FormTextareaField
                label="Terms"
                placeholder="Payment terms..."
                value={state.terms}
                onChange={(e) => onStateChange({ terms: e.target.value })}
                disabled={isFinalized}
              />
              {(fc.isQuote || fc.isPurchasedOrder) && (
                <>
                  <FormTextareaField
                    label="Scope of Work"
                    placeholder="Describe the work to be performed..."
                    value={state.scopeOfWork ?? ""}
                    onChange={(e) => onStateChange({ scopeOfWork: e.target.value })}
                    disabled={isFinalized}
                  />
                  <FormTextareaField
                    label="Internal Notes"
                    placeholder="Team-only notes (not visible to customer)..."
                    value={state.internalNotes ?? ""}
                    onChange={(e) => onStateChange({ internalNotes: e.target.value })}
                    disabled={isFinalized}
                  />
                </>
              )}
              {(fc.isPaymentVoucher || fc.isReceipt) && (
                <FormTextareaField
                  label="Payment Instructions"
                  placeholder="How should the customer pay..."
                  value={state.paymentInstructions ?? ""}
                  onChange={(e) => onStateChange({ paymentInstructions: e.target.value })}
                  disabled={isFinalized}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface FormConfigFlags {
  showsCurrency: boolean;
  showsIssueDate: boolean;
  showsDueDate: boolean;
  showsExpiryDate: boolean;
  showsPoNumber: boolean;
  showsPaymentTerms: boolean;
  showsDeliveryDate: boolean;
  showsInvoiceDiscount: boolean;
  showsQuoteDiscount: boolean;
  showsReferenceInvoice: boolean;
  showsReason: boolean;
  showsCustomReason: boolean;
  showsShippingDescription: boolean;
  showsShippingAmount: boolean;
  showsNotesInAccordion: boolean;
  isQuote: boolean;
  isPurchasedOrder: boolean;
  isPaymentVoucher: boolean;
  isReceipt: boolean;
  issueDateLabel: string;
}

function getFormConfig(docType: DocumentType): FormConfigFlags {
  switch (docType) {
    case "invoice":
      return {
        showsCurrency: true,
        showsIssueDate: true,
        showsDueDate: true,
        showsExpiryDate: false,
        showsPoNumber: true,
        showsPaymentTerms: true,
        showsDeliveryDate: false,
        showsInvoiceDiscount: true,
        showsQuoteDiscount: false,
        showsReferenceInvoice: false,
        showsReason: false,
        showsCustomReason: false,
        showsShippingDescription: false,
        showsShippingAmount: false,
        showsNotesInAccordion: false,
        isQuote: false,
        isPurchasedOrder: false,
        isPaymentVoucher: false,
        isReceipt: false,
        issueDateLabel: "Invoice Date",
      };

    case "quote":
      return {
        showsCurrency: true,
        showsIssueDate: true,
        showsDueDate: false,
        showsExpiryDate: true,
        showsPoNumber: true,
        showsPaymentTerms: false,
        showsDeliveryDate: false,
        showsInvoiceDiscount: false,
        showsQuoteDiscount: true,
        showsReferenceInvoice: false,
        showsReason: false,
        showsCustomReason: false,
        showsShippingDescription: false,
        showsShippingAmount: false,
        showsNotesInAccordion: true,
        isQuote: true,
        isPurchasedOrder: false,
        isPaymentVoucher: false,
        isReceipt: false,
        issueDateLabel: "Quote Date",
      };

    case "credit-note":
      return {
        showsCurrency: true,
        showsIssueDate: true,
        showsDueDate: false,
        showsExpiryDate: false,
        showsPoNumber: false,
        showsPaymentTerms: false,
        showsDeliveryDate: false,
        showsInvoiceDiscount: false,
        showsQuoteDiscount: false,
        showsReferenceInvoice: true,
        showsReason: true,
        showsCustomReason: true,
        showsShippingDescription: false,
        showsShippingAmount: false,
        showsNotesInAccordion: false,
        isQuote: false,
        isPurchasedOrder: false,
        isPaymentVoucher: false,
        isReceipt: false,
        issueDateLabel: "Issue Date",
      };

    case "debit-note":
      return {
        showsCurrency: true,
        showsIssueDate: true,
        showsDueDate: false,
        showsExpiryDate: false,
        showsPoNumber: false,
        showsPaymentTerms: false,
        showsDeliveryDate: false,
        showsInvoiceDiscount: false,
        showsQuoteDiscount: false,
        showsReferenceInvoice: true,
        showsReason: true,
        showsCustomReason: true,
        showsShippingDescription: false,
        showsShippingAmount: false,
        showsNotesInAccordion: false,
        isQuote: false,
        isPurchasedOrder: false,
        isPaymentVoucher: false,
        isReceipt: false,
        issueDateLabel: "Issue Date",
      };

    case "payment-voucher":
      return {
        showsCurrency: true,
        showsIssueDate: true,
        showsDueDate: false,
        showsExpiryDate: false,
        showsPoNumber: false,
        showsPaymentTerms: false,
        showsDeliveryDate: false,
        showsInvoiceDiscount: false,
        showsQuoteDiscount: false,
        showsReferenceInvoice: false,
        showsReason: false,
        showsCustomReason: false,
        showsShippingDescription: false,
        showsShippingAmount: false,
        showsNotesInAccordion: true,
        isQuote: false,
        isPurchasedOrder: false,
        isPaymentVoucher: true,
        isReceipt: false,
        issueDateLabel: "Voucher Date",
      };

    case "receipt":
      return {
        showsCurrency: true,
        showsIssueDate: true,
        showsDueDate: false,
        showsExpiryDate: false,
        showsPoNumber: false,
        showsPaymentTerms: false,
        showsDeliveryDate: false,
        showsInvoiceDiscount: false,
        showsQuoteDiscount: false,
        showsReferenceInvoice: false,
        showsReason: false,
        showsCustomReason: false,
        showsShippingDescription: false,
        showsShippingAmount: false,
        showsNotesInAccordion: true,
        isQuote: false,
        isPurchasedOrder: false,
        isPaymentVoucher: false,
        isReceipt: true,
        issueDateLabel: "Issued At",
      };

    case "purchase-order":
      return {
        showsCurrency: true,
        showsIssueDate: true,
        showsDueDate: false,
        showsExpiryDate: false,
        showsPoNumber: false,
        showsPaymentTerms: false,
        showsDeliveryDate: true,
        showsInvoiceDiscount: false,
        showsQuoteDiscount: false,
        showsReferenceInvoice: false,
        showsReason: false,
        showsCustomReason: false,
        showsShippingDescription: true,
        showsShippingAmount: true,
        showsNotesInAccordion: true,
        isQuote: false,
        isPurchasedOrder: true,
        isPaymentVoucher: false,
        isReceipt: false,
        issueDateLabel: "Order Date",
      };

    default:
      return {
        showsCurrency: true,
        showsIssueDate: true,
        showsDueDate: false,
        showsExpiryDate: false,
        showsPoNumber: false,
        showsPaymentTerms: false,
        showsDeliveryDate: false,
        showsInvoiceDiscount: false,
        showsQuoteDiscount: false,
        showsReferenceInvoice: false,
        showsReason: false,
        showsCustomReason: false,
        showsShippingDescription: false,
        showsShippingAmount: false,
        showsNotesInAccordion: false,
        isQuote: false,
        isPurchasedOrder: false,
        isPaymentVoucher: false,
        isReceipt: false,
        issueDateLabel: "Date",
      };
  }
}
