import { FileText } from "lucide-react";
import { Money } from "@/components/ui";
import { formatDate } from "@/utils/format";
import type { CalculationResult } from "@/types/calculation";
import type { ApiCustomer } from "@/types/api";

export type DocumentType = "invoice" | "quote" | "credit-note" | "receipt" | "purchase-order";

export interface DocumentPreviewProps {
  documentType: DocumentType;
  documentNumber?: string | null;
  calcResult: CalculationResult | null;
  issueDate?: string;
  dueDate?: string;
  expiryDate?: string;
  poNumber?: string;
  customerId?: string;
  customers?: ApiCustomer[];
  sourceInvoice?: {
    invoice_number?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    total?: string;
    amount_due?: string;
    currency: string;
  } | null;
  signedAmounts?: boolean;
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  invoice: "Invoice",
  quote: "Quote",
  "credit-note": "Credit Note",
  receipt: "Receipt",
  "purchase-order": "Purchase Order",
};

export default function DocumentPreview({
  documentType,
  documentNumber,
  calcResult,
  issueDate,
  dueDate,
  expiryDate,
  poNumber,
  customerId,
  customers = [],
  sourceInvoice = null,
  signedAmounts = false,
}: DocumentPreviewProps) {
  const label = DOCUMENT_LABELS[documentType];
  const currency = calcResult?.currency ?? sourceInvoice?.currency ?? "USD";

  const displayCustomer = (() => {
    if (sourceInvoice) {
      if (sourceInvoice.customer_name) {
        return {
          name: sourceInvoice.customer_name,
          email: sourceInvoice.customer_email ?? undefined,
          addressLine1: undefined,
        };
      }
      return null;
    }
    if (customerId) {
      const cust = customers.find((c) => c.id === customerId);
      if (cust) {
        return {
          name: cust.name ?? cust.email ?? null,
          email: cust.email ?? undefined,
          addressLine1: cust.address?.addressLine1 ?? undefined,
        };
      }
    }
    return null;
  })();

  if (!calcResult) {
    return (
      <div className="sticky top-0">
        <div className="border border-border rounded-lg p-6 bg-surface shadow">
          <h3 className="text-sm font-medium text-tertiary mb-4 uppercase tracking-wider">
            Live Preview
          </h3>
          <div className="text-center py-8 text-tertiary">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Add line items to see a preview</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0">
      <div className="border border-border rounded-lg p-6 bg-surface shadow">
        <h3 className="text-sm font-medium text-tertiary mb-4 uppercase tracking-wider">
          Live Preview
        </h3>

        <div className="text-sm">
          {/* Header */}
          <div className="mb-4">
            <div className="text-2xl font-bold text-primary flex items-center gap-2">
              <FileText className="h-6 w-6" />
              {label} {documentNumber ?? "(Unsaved)"}
            </div>
            {issueDate && (
              <div className="text-tertiary mt-1">
                <span className="font-medium">Issue date:</span> {formatDate(issueDate)}
              </div>
            )}
            {dueDate && (
              <div className="text-tertiary">
                <span className="font-medium">Due date:</span> {formatDate(dueDate)}
              </div>
            )}
            {poNumber && (
              <div className="text-tertiary">
                <span className="font-medium">PO:</span> {poNumber}
              </div>
            )}
            {expiryDate && (
              <div className="text-tertiary">
                <span className="font-medium">Expiry date:</span> {formatDate(expiryDate)}
              </div>
            )}
          </div>

          {/* Customer */}
          {displayCustomer && (
            <div className="mb-4">
              <div className="font-medium text-primary">
                {displayCustomer.name ?? "—"}
              </div>
              {displayCustomer.email && (
                <div className="text-tertiary">{displayCustomer.email}</div>
              )}
              {displayCustomer.addressLine1 && (
                <div className="text-tertiary">{displayCustomer.addressLine1}</div>
              )}
            </div>
          )}

          {/* Source Invoice (for credit notes) */}
          {sourceInvoice && documentType === "credit-note" && (
            <div className="mb-4">
              <div className="font-medium text-primary">
                {sourceInvoice.customer_name ?? "—"}
              </div>
              {sourceInvoice.customer_email && (
                <div className="text-tertiary">{sourceInvoice.customer_email}</div>
              )}
            </div>
          )}

          {/* Line Items Table */}
          <div className="mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1 text-tertiary font-medium">Description</th>
                  <th className="text-right py-1 text-tertiary font-medium">Qty</th>
                  <th className="text-right py-1 text-tertiary font-medium">Unit Price</th>
                  <th className="text-right py-1 text-tertiary font-medium">Tax</th>
                  <th className="text-right py-1 text-tertiary font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {calcResult.lineItems.map((li, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-1">{li.description}</td>
                    <td className="text-right py-1">{li.quantity.toFixed()}</td>
                    <td className="text-right py-1">{li.unitPrice.toFixed(2)}</td>
                    <td className="text-right py-1">{(li.taxRate.mul(100)).toFixed(2)}%</td>
                    <td className="text-right py-1 font-medium">
                      <Money amount={li.lineTotal} currency={currency} signed={signedAmounts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-border pt-2 space-y-1">
            <div className="flex justify-between text-tertiary">
              <span>Subtotal</span>
              <Money amount={calcResult.subtotal} currency={currency} />
            </div>
            {Number(calcResult.discountTotal.toFixed()) !== 0 && (
              <div className="flex justify-between text-tertiary">
                <span>Discount</span>
                <Money amount={calcResult.discountTotal.negated()} currency={currency} />
              </div>
            )}
            <div className="flex justify-between text-tertiary">
              <span>Tax</span>
              <Money amount={calcResult.taxTotal} currency={currency} />
            </div>
            {calcResult.fees.length > 0 && Number(calcResult.feeTotal.toFixed()) !== 0 && (
              <div className="flex justify-between text-tertiary">
                <span>Fees</span>
                <Money amount={calcResult.feeTotal} currency={currency} />
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t border-border">
              <span>Total</span>
              <Money amount={calcResult.total} currency={currency} signed={signedAmounts} />
            </div>
            {documentType === "invoice" && Number(calcResult.amountDue.toFixed()) !== 0 && (
              <div className="flex justify-between text-tertiary">
                <span>Amount Due</span>
                <Money amount={calcResult.amountDue} currency={currency} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
