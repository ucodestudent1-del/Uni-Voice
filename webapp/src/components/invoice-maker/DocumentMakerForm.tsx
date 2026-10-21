import { Plus } from "lucide-react";
import { FormField, Button } from "@/components/ui";
import SectionCard from "@/components/SectionCard";
import {
  SimpleDocumentLineItems,
  DocumentTotalsCard,
  DocumentFees,
  DocumentNotesSection,
  ItemEntryDrawer,
  type DocumentLineItem,
  type DocumentFee,
  type DocumentState,
  type DocumentFormConfig,
  type TaxRateOption,
} from "@/components/document";
import type { CalculationResult } from "@/types/calculation";
import type { ApiBusiness, ApiCustomer, ApiProduct } from "@/types/api";
import type { DocumentType } from "@/components/document";
import { SUPPORTED_CURRENCIES } from "@/types/currency";

interface DocumentMakerFormProps {
  docType: DocumentType;
  state: DocumentState;
  calcResult: CalculationResult | null;
  formConfig: DocumentFormConfig;
  business: ApiBusiness | null;
  customers: ApiCustomer[];
  taxRateOptions: TaxRateOption[];
  products: ApiProduct[];
  itemDrawerOpen: boolean;
  onItemDrawerClose: () => void;
  onItemDrawerSave: (item: DocumentLineItem) => void;
  onAddItem: () => void;
  onUpdateItem: (idx: number, field: keyof DocumentLineItem, value: unknown) => void;
  onRemoveItem: (idx: number) => void;
  onDuplicateItem: (idx: number) => void;
  onAddFee: () => void;
  onRemoveFee: (idx: number) => void;
  onUpdateFee: (idx: number, field: keyof DocumentFee, value: string) => void;
  onDiscountChange: (value: string) => void;
  onDiscountTypeChange: (value: "fixed" | "percentage") => void;
  onStateChange: (patch: Partial<DocumentState>) => void;
}

const docTypeLabels: Record<DocumentType, string> = {
  invoice: "Invoice",
  quote: "Quotation",
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

export function DocumentMakerForm({
  docType,
  state,
  calcResult,
  formConfig,
  business,
  customers,
  taxRateOptions,
  products,
  itemDrawerOpen,
  onItemDrawerClose,
  onItemDrawerSave,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onDuplicateItem,
  onAddFee,
  onRemoveFee,
  onUpdateFee,
  onDiscountChange,
  onDiscountTypeChange,
  onStateChange,
}: DocumentMakerFormProps) {
  const title = docTypeLabels[docType] ?? "Document";
  const numberFieldLabel = `${title} Number`;
  const customerLabel = formConfig.showsSupplierSection ? "Supplier" : "Bill To";
  const numberPlaceholder = formConfig.isInvoice
    ? "INV-0001"
    : formConfig.isQuote
      ? "QUO-0001"
      : formConfig.isCreditNote
        ? "CRN-0001"
        : formConfig.isDebitNote
          ? "DN-0001"
          : formConfig.isPaymentVoucher
            ? "PV-0001"
            : "PO-0001";

  return (
    <div className="space-y-4">
      <SectionCard title={`${title} Details`}>
        <div className="p-4 space-y-4">
          <FormField
            label={numberFieldLabel}
            placeholder={numberPlaceholder}
            value={state.invoiceNumber ?? ""}
            onChange={(e) => onStateChange({ invoiceNumber: e.target.value })}
            helperText="Backend will assign a number on save if left blank"
          />

          <FormField
            label="Currency"
            select
            value={state.currency}
            onChange={(e) => onStateChange({ currency: e.target.value })}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={formConfig.isPaymentVoucher ? "Voucher Date" : `${title} Date`}
              type="date"
              value={state.voucherDate ?? state.issueDate}
              onChange={(e) =>
                onStateChange(
                  formConfig.isPaymentVoucher
                    ? { voucherDate: e.target.value }
                    : { issueDate: e.target.value },
                )
              }
            />

            {formConfig.showsExpiryDate && (
              <FormField
                label="Expiry Date"
                type="date"
                value={state.expiryDate ?? ""}
                onChange={(e) => onStateChange({ expiryDate: e.target.value })}
              />
            )}

            {formConfig.showsDueDate && (
              <FormField
                label="Due Date"
                type="date"
                value={state.dueDate ?? ""}
                onChange={(e) => onStateChange({ dueDate: e.target.value })}
              />
            )}

            {formConfig.showsDeliveryDate && (
              <FormField
                label="Delivery Date"
                type="date"
                value={state.deliveryDate ?? ""}
                onChange={(e) => onStateChange({ deliveryDate: e.target.value })}
              />
            )}
          </div>

          {formConfig.showsPoNumber && (
            <FormField
              label="P.O. Number"
              placeholder="Optional"
              value={state.poNumber ?? ""}
              onChange={(e) => onStateChange({ poNumber: e.target.value })}
            />
          )}
        </div>
      </SectionCard>

      <SectionCard title={formConfig.showsSupplierSection ? "Your Business (Supplier)" : "Your Business"}>
        <div className="p-4 space-y-3">
          {business?.legalName || business?.name ? (
            <>
              <div className="font-medium text-primary">
                {business.legalName || business.name}
              </div>
              {business.email && (
                <div className="text-sm text-tertiary">{business.email}</div>
              )}
              {business.phone && (
                <div className="text-sm text-tertiary">{business.phone}</div>
              )}
              {business.website && (
                <a
                  href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
                  className="text-sm text-secondary hover:text-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {business.website}
                </a>
              )}
            </>
          ) : (
            <div className="text-sm text-tertiary">
              Set up your business details in settings to display them here.
            </div>
          )}
        </div>
      </SectionCard>

      {!formConfig.showsPayeeSection && (
        <SectionCard title={customerLabel}>
          <div className="p-4">
            {customers.length > 0 ? (
              <FormField
                label={(formConfig.requiresCustomer ?? true) ? "Customer" : "Customer (optional)"}
                select
                value={state.customerId}
                onChange={(e) => onStateChange({ customerId: e.target.value })}
                helperText={!state.customerId && (formConfig.requiresCustomer ?? true) ? "Required" : undefined}
              >
                <option value="">Select a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.email ?? c.id}
                  </option>
                ))}
              </FormField>
            ) : (
              <FormField
                label="Customer Name"
                placeholder="Enter customer name"
                value={state.customerName ?? ""}
                onChange={(e) => onStateChange({ customerName: e.target.value })}
                helperText="No saved customers yet"
              />
            )}
          </div>
        </SectionCard>
      )}

      {formConfig.showsPayeeSection && (
        <SectionCard title="Payee">
          <div className="p-4 space-y-4">
            <FormField
              label="Payee Name"
              placeholder="Enter payee name"
              value={state.payeeName ?? ""}
              onChange={(e) => onStateChange({ payeeName: e.target.value })}
              helperText="Required"
            />
            <FormField
              label="Payee Email"
              placeholder="payee@example.com"
              value={state.payeeEmail ?? ""}
              onChange={(e) => onStateChange({ payeeEmail: e.target.value })}
            />
            <FormField
              label="Payee Phone"
              placeholder="+1-555-1234"
              value={state.payeePhone ?? ""}
              onChange={(e) => onStateChange({ payeePhone: e.target.value })}
            />
          </div>
        </SectionCard>
      )}

      {formConfig.showsReferenceInvoice && (
        <SectionCard title="Reference">
          <div className="p-4 space-y-4">
            <FormField
              label="Reference Invoice ID"
              placeholder="Optional"
              value={state.referenceInvoiceId ?? ""}
              onChange={(e) => onStateChange({ referenceInvoiceId: e.target.value })}
            />
            {formConfig.showsReasonField && (
              <FormField
                label="Reason"
                placeholder="Enter reason"
                value={state.reason ?? ""}
                onChange={(e) => onStateChange({ reason: e.target.value })}
              />
            )}
            {formConfig.showsReasonField && state.reason === "other" && (
              <FormField
                label="Custom Reason"
                placeholder="Enter custom reason"
                value={state.customReason ?? ""}
                onChange={(e) => onStateChange({ customReason: e.target.value })}
              />
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Item or Service"
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              onItemDrawerSave({} as DocumentLineItem);
              onItemDrawerClose();
            }}
          >
            Add Item
          </Button>
        }
      >
        <div className="p-4">
          <SimpleDocumentLineItems
            items={state.items}
            isFinalized={false}
            taxRateOptions={taxRateOptions}
            onUpdate={onUpdateItem}
            onRemove={onRemoveItem}
            onDuplicate={onDuplicateItem}
            onAdd={onAddItem}
          />
        </div>
      </SectionCard>

      <SectionCard title="Totals">
        <div className="p-4">
          <DocumentTotalsCard
            calcResult={calcResult}
            currency={state.currency}
            invoiceDiscount={state.invoiceDiscount ?? "0"}
            invoiceDiscountType={state.invoiceDiscountType ?? "fixed"}
            onDiscountChange={onDiscountChange}
            onDiscountTypeChange={onDiscountTypeChange}
            isFinalized={false}
          />
        </div>
      </SectionCard>

      <SectionCard title="Fees">
        <div className="p-4">
          <DocumentFees
            fees={state.fees}
            isFinalized={false}
            taxRateOptions={taxRateOptions}
            onUpdate={onUpdateFee}
            onRemove={onRemoveFee}
            onAdd={onAddFee}
          />
        </div>
      </SectionCard>

      <SectionCard title="Notes & Terms">
        <div className="p-4">
          <DocumentNotesSection
            notes={state.notes ?? ""}
            terms={state.terms ?? ""}
            paymentInstructions={state.paymentInstructions ?? ""}
            isQuote={formConfig.isQuote}
            isCreditNote={formConfig.isCreditNote}
            onNotesChange={(v) => onStateChange({ notes: v })}
            onTermsChange={(v) => onStateChange({ terms: v })}
            onPaymentInstructionsChange={(v) => onStateChange({ paymentInstructions: v })}
            onScopeOfWorkChange={(v) => onStateChange({ scopeOfWork: v })}
            onInternalNotesChange={(v) => onStateChange({ internalNotes: v })}
            disabled={false}
          />
        </div>
      </SectionCard>

      <ItemEntryDrawer
        open={itemDrawerOpen}
        onClose={onItemDrawerClose}
        item={null}
        onSave={onItemDrawerSave}
        taxRateOptions={taxRateOptions}
        products={products}
      />
    </div>
  );
}
