import { FileText, Globe, Phone, Mail, MapPin, CreditCard } from "lucide-react";
import { Money, StatusBadge, paymentStatusConfig } from "@/components/ui";
import { formatDate, formatTaxRateWithName, formatCurrency } from "@/utils/format";
import type { CalculationResult } from "@/types/calculation";
import type { ApiCustomer, ApiBusiness } from "@/types/api";

export type DocumentType = "invoice" | "credit-note" | "receipt" | "purchase-order" | "quote";

export interface DocumentPreviewProps {
  documentType: DocumentType;
  documentNumber?: string | null;
  calcResult: CalculationResult | null;
  business?: ApiBusiness | null;
  issueDate?: string;
  dueDate?: string;
  expiryDate?: string;
  poNumber?: string;
  projectReference?: string;
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
  paymentInstructions?: string;
  notes?: string;
  terms?: string;
  scopeOfWork?: string;
  footerText?: string;
  signedAmounts?: boolean;
  reason?: string | null;
  shippingDescription?: string;
  shippingAmount?: string;
  shippingTaxRate?: string;
  status?: string;
  paymentState?: string | null;
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  invoice: "Invoice",
  "credit-note": "Credit Note",
  receipt: "Receipt",
  "purchase-order": "Purchase Order",
  quote: "Quotation",
};

function AddressLines({ line1, line2, city, state, postal, country }: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
  country?: string | null;
}) {
  return (
    <>
      {line1 && <div>{line1}</div>}
      {line2 && <div>{line2}</div>}
      {(city || state || postal) && (
        <div>{[city, state, postal].filter(Boolean).join(", ")}</div>
      )}
      {country && <div>{country}</div>}
    </>
  );
}

export default function DocumentPreview({
  documentType,
  documentNumber,
  calcResult,
  business,
  issueDate,
  dueDate,
  expiryDate,
  poNumber,
  projectReference,
  customerId,
  customers = [],
  sourceInvoice = null,
  paymentInstructions,
  notes,
  terms,
  scopeOfWork,
  footerText,
  signedAmounts = false,
  reason,
  shippingDescription,
  shippingAmount,
  shippingTaxRate,
  status,
  paymentState,
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
          addressLine2: cust.address?.addressLine2 ?? undefined,
          city: cust.address?.city ?? undefined,
          state: cust.address?.stateOrRegion ?? undefined,
          postal: cust.address?.postalCode ?? undefined,
          country: cust.address?.countryCode ?? undefined,
                  taxId: cust.taxId ?? undefined,
          phone: cust.phone ?? undefined,
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

        <div className="text-sm print:text-xs">
          {/* Section 1: Business Information + Invoice Header */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b border-border">
            <div className="flex items-start gap-3">
              {business?.logoUrl && (
                <img src={business.logoUrl} alt={business.name} className="h-12 w-12 object-contain rounded" />
              )}
              <div>
                <div className="font-bold text-lg text-primary">{business?.legalName || business?.name}</div>
                {business?.email && (
                  <div className="text-tertiary flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3" />
                    {business.email}
                  </div>
                )}
                {(business?.phone || business?.website) && (
                  <div className="text-tertiary flex flex-col mt-0.5">
                    {business.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {business.phone}
                      </span>
                    )}
                    {business.website && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {business.website}
                      </span>
                    )}
                  </div>
                )}
                {(business?.addressLine1 || business?.city || business?.stateOrRegion || business?.postalCode) && (
                  <div className="text-tertiary flex items-start gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                    <AddressLines
                      line1={business?.addressLine1}
                      line2={business?.addressLine2}
                      city={business?.city}
                      state={business?.stateOrRegion}
                      postal={business?.postalCode}
                      country={business?.countryCode}
                    />
                  </div>
                )}
                {(business?.taxId || business?.registrationNumber) && (
                  <div className="text-tertiary mt-0.5">
                    <span className="font-medium">Tax ID:</span> {business.taxId || business.registrationNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Invoice Details */}
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{label.toUpperCase()}</div>
              {status && (
                <div className="mt-1 flex justify-end">
                  <StatusBadge
                    status={status}
                    showIcon
                    size="sm"
                    className="whitespace-nowrap"
                  />
                </div>
              )}
              <div className="text-xl font-bold text-primary mt-1">
                {documentNumber ?? "(Unsaved)"}
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
              {expiryDate && documentType === "quote" && (
                <div className="text-tertiary">
                  <span className="font-medium">Expiry date:</span> {formatDate(expiryDate)}
                </div>
              )}
              {currency && (
                <div className="text-tertiary">
                  <span className="font-medium">Currency:</span> {currency}
                </div>
              )}
              {poNumber && (
                <div className="text-tertiary">
                  <span className="font-medium">PO Number:</span> {poNumber}
                </div>
              )}
              {projectReference && (
                <div className="text-tertiary">
                  <span className="font-medium">Project:</span> {projectReference}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Bill To */}
          {displayCustomer && (
            <div className="mb-6">
              <h4 className="font-medium text-primary mb-1.5">Bill To</h4>
              <div>
                <div className="font-medium text-primary">{displayCustomer.name ?? "—"}</div>
                {displayCustomer.email && (
                  <div className="text-tertiary flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3" />
                    {displayCustomer.email}
                  </div>
                )}
                {(displayCustomer.addressLine1 || displayCustomer.city || displayCustomer.state || displayCustomer.postal) && (
                  <div className="text-tertiary flex items-start gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                    <AddressLines
                      line1={displayCustomer.addressLine1}
                      line2={displayCustomer.addressLine2}
                      city={displayCustomer.city}
                      state={displayCustomer.state}
                      postal={displayCustomer.postal}
                      country={displayCustomer.country}
                    />
                  </div>
                )}
                {displayCustomer.taxId && (
                  <div className="text-tertiary mt-0.5">
                    <span className="font-medium">Tax ID:</span> {displayCustomer.taxId}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Credit Note Reason */}
          {documentType === "credit-note" && reason && (
            <div className="mb-6">
              <h4 className="font-medium text-primary mb-1.5 flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                Reason
              </h4>
              <div className="text-tertiary">{reason}</div>
            </div>
          )}

          {/* Credit Note Reference Invoice */}
          {documentType === "credit-note" && sourceInvoice && (
            <div className="mb-6">
              <h4 className="font-medium text-primary mb-1.5">Reference Invoice</h4>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span className="text-tertiary">Invoice</span>
                  <span className="text-primary font-medium">
                    {sourceInvoice.invoice_number || "#—"}
                  </span>
                </div>
                {sourceInvoice.customer_name && (
                  <div className="flex justify-between mt-0.5">
                    <span className="text-tertiary">Customer</span>
                    <span className="text-primary">{sourceInvoice.customer_name}</span>
                  </div>
                )}
                {sourceInvoice.total && (
                  <div className="flex justify-between mt-0.5">
                    <span className="text-tertiary">Total</span>
                    <span className="text-primary">
                      {formatCurrency(sourceInvoice.total, sourceInvoice.currency)}
                    </span>
                  </div>
                )}
                {sourceInvoice.amount_due && (
                  <div className="flex justify-between mt-0.5">
                    <span className="text-tertiary">Amount Due</span>
                    <span className="text-primary">
                      {formatCurrency(sourceInvoice.amount_due, sourceInvoice.currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shipping (Invoice only) */}
          {documentType === "invoice" && shippingDescription && (
            <div className="mb-6">
              <h4 className="font-medium text-primary mb-1.5">Shipping</h4>
              <div className="text-sm text-tertiary">
                <div>{shippingDescription}</div>
                {shippingAmount && (
                  <div className="mt-0.5">
                    <span className="font-medium">Amount:</span> {formatCurrency(shippingAmount, currency)}
                  </div>
                )}
                {shippingTaxRate && (
                  <div className="mt-0.5">
                    <span className="font-medium">Tax:</span> {formatTaxRateWithName(shippingTaxRate, "")}
                  </div>
                )}
              </div>
            </div>
          )}

           {/* Section 4: Line Items */}
          <div className="mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-tertiary font-medium">Description</th>
                  <th className="text-right py-1.5 text-tertiary font-medium">Qty</th>
                  <th className="text-right py-1.5 text-tertiary font-medium">Unit Price</th>
                  <th className="text-right py-1.5 text-tertiary font-medium">Tax</th>
                  <th className="text-right py-1.5 text-tertiary font-medium">Discount</th>
                  <th className="text-right py-1.5 text-tertiary font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {calcResult.lineItems.map((li, idx) => (
                  <tr key={`${li.description}-${li.quantity.toFixed()}-${li.unitPrice.toFixed()}-${idx}`} className="border-b border-border/50">
                    <td className="py-1.5">{li.description}</td>
                    <td className="text-right py-1.5">{li.quantity.toFixed()}</td>
                    <td className="text-right py-1.5">
                      <Money amount={li.unitPrice} currency={currency} />
                    </td>
                    <td className="text-right py-1.5 text-tertiary">
                      {formatTaxRateWithName(li.taxRate.toFixed(), li.tax_name)}
                    </td>
                    <td className="text-right py-1.5 text-tertiary">
                      {li.discountAmount.isZero() ? "—" : <Money amount={li.discountAmount.negated()} currency={currency} />}
                    </td>
                    <td className="text-right py-1.5 font-medium">
                      <Money amount={li.lineTotal} currency={currency} signed={signedAmounts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>

           {/* Section 5: Financial Summary */}
          <div className="border-t border-border pt-2 space-y-1 mb-6">
            <div className="flex justify-between text-tertiary">
              <span>Subtotal</span>
              <Money amount={calcResult.subtotal} currency={currency} />
            </div>
            {!calcResult.discountTotal.isZero() && (
              <div className="flex justify-between text-tertiary">
                <span>Discount</span>
                <Money amount={calcResult.discountTotal.negated()} currency={currency} />
              </div>
            )}
            {calcResult.fees.length > 0 && !calcResult.feeTotal.isZero() && (
              <>
                {calcResult.fees.map((fee, idx) => (
                  <div key={idx} className="flex justify-between text-tertiary">
                    <span>{fee.description}</span>
                    <Money amount={fee.feeTotal} currency={currency} signed={signedAmounts} />
                  </div>
                ))}
                <div className="flex justify-between text-tertiary">
                  <span>Fees</span>
                  <Money amount={calcResult.feeTotal} currency={currency} signed={signedAmounts} />
                </div>
              </>
            )}
            {!calcResult.taxBreakdown.length && !calcResult.taxTotal.isZero() && (
              <div className="flex justify-between text-tertiary">
                <span>Tax</span>
                <Money amount={calcResult.taxTotal} currency={currency} signed={signedAmounts} />
              </div>
            )}
            {calcResult.taxBreakdown.length > 0 && !calcResult.taxTotal.isZero() &&
              calcResult.taxBreakdown.map((tb, idx) => (
                <div key={idx} className="flex justify-between text-tertiary">
                  <span>
                    Tax ({formatTaxRateWithName(tb.rate.toFixed(), tb.name)})
                  </span>
                  <Money amount={tb.taxAmount} currency={currency} signed={signedAmounts} />
                </div>
              ))}
            {!calcResult.amountPaid.isZero() && (
              <div className="flex justify-between text-tertiary">
                <span>Amount Paid</span>
                <Money amount={calcResult.amountPaid.negated()} currency={currency} />
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold text-primary pt-2 border-t border-border">
               <span>{`Total ${label}`}</span>
               <Money amount={calcResult.total} currency={currency} signed={signedAmounts} />
             </div>
              {documentType === "invoice" && !calcResult.amountDue.isZero() && (
                <div className="flex justify-between text-lg font-bold text-primary">
                  <span>Amount Due</span>
                  <Money amount={calcResult.amountDue} currency={currency} />
                </div>
              )}
              {documentType === "invoice" && paymentState && (
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm text-tertiary">Payment</span>
                  <StatusBadge
                    status={paymentState}
                    config={paymentStatusConfig}
                    showIcon
                    size="sm"
                  />
                </div>
              )}
             {documentType === "quote" && expiryDate && (
               <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t border-border">
                 <span>Expires</span>
                 <span className="text-tertiary font-normal">{formatDate(expiryDate)}</span>
               </div>
             )}
           </div>

           {/* Section 6: Scope of Work (Quote only) */}
           {scopeOfWork && documentType === "quote" && (
             <div className="mb-6">
               <h4 className="font-medium text-primary mb-1.5 flex items-center gap-1.5">
                 <FileText className="h-4 w-4" />
                 Scope of Work
               </h4>
               <div className="text-tertiary whitespace-pre-line">{scopeOfWork}</div>
             </div>
           )}

           {/* Section 6: Payment Information */}
          {paymentInstructions && (
            <div className="mb-6">
              <h4 className="font-medium text-primary mb-1.5 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" />
                Payment Information
              </h4>
              <div className="text-tertiary whitespace-pre-line">{paymentInstructions}</div>
            </div>
          )}

          {/* Section 7: Notes and Terms */}
          {(notes || terms) && (
            <div className="mb-6 space-y-2 border-t border-border pt-3">
              {notes && (
                <div>
                  <h4 className="font-medium text-primary mb-1">Notes</h4>
                  <div className="text-tertiary whitespace-pre-line">{notes}</div>
                </div>
              )}
              {terms && (
                <div>
                  <h4 className="font-medium text-primary mb-1">Terms</h4>
                  <div className="text-tertiary whitespace-pre-line">{terms}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 8: Footer */}
      {footerText && (
        <div className="border-t border-border pt-3 mt-4">
          <div className="text-tertiary text-xs whitespace-pre-line">
            {footerText}
          </div>
        </div>
      )}
    </div>
  );
}
