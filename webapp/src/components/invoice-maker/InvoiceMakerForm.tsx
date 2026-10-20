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
  type TaxRateOption,
} from "@/components/document";
import type { CalculationResult } from "@/types/calculation";
import type { ApiBusiness, ApiCustomer, ApiProduct } from "@/types/api";
import { SUPPORTED_CURRENCIES } from "@/types/currency";

interface InvoiceMakerFormProps {
  state: DocumentState;
  calcResult: CalculationResult | null;
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

export function InvoiceMakerForm({
  state,
  calcResult,
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
}: InvoiceMakerFormProps) {
  return (
    <div className="space-y-4">
      <SectionCard title="Invoice Details">
        <div className="p-4 space-y-4">
          <FormField
            label="Invoice Number"
            placeholder="INV-0001"
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
              label="Invoice Date"
              type="date"
              value={state.issueDate}
              onChange={(e) => onStateChange({ issueDate: e.target.value })}
            />
            <FormField
              label="Due Date"
              type="date"
              value={state.dueDate ?? ""}
              onChange={(e) => onStateChange({ dueDate: e.target.value })}
            />
          </div>

          <FormField
            label="P.O. Number"
            placeholder="Optional"
            value={state.poNumber ?? ""}
            onChange={(e) => onStateChange({ poNumber: e.target.value })}
          />
        </div>
      </SectionCard>

      <SectionCard title="Your Business">
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

      <SectionCard title="Bill To">
        <div className="p-4">
          {customers.length > 0 ? (
            <FormField
              label="Customer"
              select
              value={state.customerId}
              onChange={(e) => onStateChange({ customerId: e.target.value })}
              helperText={!state.customerId ? "Required" : undefined}
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

      <SectionCard
        title="Item or Service"
        action={
          <div className="flex gap-2">
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
          </div>
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
            isQuote={false}
            isCreditNote={false}
            onNotesChange={(v) => onStateChange({ notes: v })}
            onTermsChange={(v) => onStateChange({ terms: v })}
            onPaymentInstructionsChange={(v) => onStateChange({ paymentInstructions: v })}
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
