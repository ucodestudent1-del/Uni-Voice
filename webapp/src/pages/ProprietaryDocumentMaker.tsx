import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalculationEngine } from "@/utils/calculation";
import type {
  InvoiceCalculationInput,
  LineItemInput,
  FeeInput,
  CalculationResult,
} from "@/types/calculation";
import type { CurrencyCode } from "@/types/currency";
import { useToast, Button } from "@/components/ui";
import {
  getProprietaryCustomers,
  getProprietaryInvoice,
  createProprietaryInvoice,
  updateProprietaryInvoice,
  getProprietaryQuote,
  createProprietaryQuote,
  updateProprietaryQuote,
  getProprietaryProducts,
  getTaxRates,
} from "../api/client";
import { formatCurrencyValue } from "@/lib/utils";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Decimal } from "decimal.js";

const calcEngine = new CalculationEngine();

const SUPPORTED_CURRENCIES: CurrencyCode[] = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"];

interface Customer {
  id: string;
  name: string;
  email?: string | null;
  default_currency?: string;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit_price: string;
  currency: string;
  tax_category?: string | null;
  tax_rate?: string | null;
  unit?: string | null;
}

interface TaxRate {
  id: string;
  name: string;
  rate: string;
  enabled: boolean;
}

function initialLineItem(): LineItemInput {
  return {
    description: "",
    quantity: 1,
    unit: "each",
    unitPrice: 0,
    discount: undefined,
    taxRate: 0,
    tax_name: null,
    isTaxInclusive: false,
    sortOrder: 0,
  };
}

type DocType = "invoice" | "quote";

export default function ProprietaryDocumentMaker({ docType }: { docType?: DocType }) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const effectiveDocType: DocType = docType || "invoice";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useMetaTags({
    title: isEditing
      ? `Edit ${effectiveDocType === "invoice" ? "Invoice" : "Quote"} — DocForge`
      : `New ${effectiveDocType === "invoice" ? "Invoice" : "Quote"} — DocForge`,
    description: `${effectiveDocType === "invoice" ? "Create or edit your invoice" : "Create or edit your quote"}. Add line items, set tax rates, and preview totals.`,
    noIndex: true,
  });

  const [customerId, setCustomerId] = useState<string | "">("");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState<string | "">("");
  const [dueDate, setDueDate] = useState<string | "">("");
  const [expiryDate, setExpiryDate] = useState<string | "">("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [items, setItems] = useState<LineItemInput[]>([initialLineItem()]);
  const [itemProductIds, setItemProductIds] = useState<(string | null)[]>([null]);
  const [fees, setFees] = useState<FeeInput[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState("");
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<"fixed" | "percentage">("percentage");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const { data: customersData } = useQuery({
    queryKey: ["proprietary-customers"],
    queryFn: () => getProprietaryCustomers({ limit: 200 }),
    staleTime: 300_000,
  });

  const { data: taxRatesData } = useQuery({
    queryKey: ["proprietary-tax-rates"],
    queryFn: () => getTaxRates(),
    staleTime: 300_000,
  });

  const { data: productsData } = useQuery({
    queryKey: ["proprietary-products"],
    queryFn: () => getProprietaryProducts({ limit: 200 }),
    staleTime: 300_000,
  });

  const { data: existingData } = useQuery({
    queryKey: ["proprietary-document-edit", id, effectiveDocType],
    queryFn: (() => {
      if (effectiveDocType === "invoice") return getProprietaryInvoice(id!);
      return getProprietaryQuote(id!);
    }) as any,
    enabled: Boolean(isEditing && id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (existingData) {
      const doc = (existingData as any).invoice ?? (existingData as any).quote;
      setCustomerId(doc.customer_id || "");
      setCurrency(doc.currency || "USD");
      setIssueDate(doc.issue_date || "");
      setDueDate(doc.due_date || "");
      setExpiryDate(doc.expiry_date || "");
      setNotes(doc.notes || "");
      setTerms(doc.terms || "");
      setPoNumber(doc.po_number || "");
      if (doc.scope_of_work) setScopeOfWork(doc.scope_of_work);
      if (doc.internal_notes) setInternalNotes(doc.internal_notes);

      if (doc.items && Array.isArray(doc.items)) {
        setItems(doc.items.map((item: any) => ({
          description: item.description || "",
          quantity: parseFloat(item.quantity) || 1,
          unit: item.unit || "each",
          unitPrice: parseFloat(item.unit_price) || 0,
          taxRate: parseFloat(item.tax_rate) || 0,
          tax_name: item.tax_name || null,
          isTaxInclusive: item.is_tax_inclusive || false,
          sortOrder: item.sort_order,
        })));
        setItemProductIds(doc.items.map((item: any) => item.product_id || null));
      }

      if (doc.fees && Array.isArray(doc.fees)) {
        setFees(doc.fees.map((f: any) => ({
          description: f.description,
          amount: parseFloat(f.amount) || 0,
          taxRate: parseFloat(f.tax_rate) || 0,
          tax_name: f.tax_name || null,
        })));
      }
    }
  }, [existingData, effectiveDocType]);

  const selectedCustomer = useMemo(
    () => customersData?.customers.find((c: Customer) => c.id === customerId),
    [customersData, customerId],
  );

  useEffect(() => {
    if (selectedCustomer?.default_currency && !isEditing) {
      setCurrency(selectedCustomer.default_currency);
    }
  }, [selectedCustomer, isEditing]);

  const calcInput = useMemo<InvoiceCalculationInput>(() => {
    const discount: { type: "fixed" | "percentage"; value: number } | undefined =
      invoiceDiscount && !isNaN(parseFloat(invoiceDiscount)) && parseFloat(invoiceDiscount) > 0
        ? { type: invoiceDiscountType, value: parseFloat(invoiceDiscount) }
        : undefined;

    const feesWithTax: FeeInput[] = fees.map((f) => ({
      description: f.description || "",
      amount: f.amount || 0,
      taxRate: f.taxRate || 0,
      tax_name: null,
    }));

    const shippingFee: FeeInput[] = [];

    return {
      currency: currency as CurrencyCode,
      lineItems: items.filter((item) => item.description.trim() !== ""),
      fees: [...(feesWithTax || []), ...shippingFee],
      discount,
    };
  }, [items, fees, currency, invoiceDiscount, invoiceDiscountType]);

  const calculation: CalculationResult = useMemo(() => {
    const emptyResult: CalculationResult = {
      currency: currency as CurrencyCode,
      decimalPlaces: 2,
      lineItems: [],
      fees: [],
      subtotal: new Decimal(0),
      discountTotal: new Decimal(0),
      taxableTotal: new Decimal(0),
      taxTotal: new Decimal(0),
      feeTotal: new Decimal(0),
      total: new Decimal(0),
      amountDue: new Decimal(0),
      amountPaid: new Decimal(0),
      isTaxInclusive: false,
      taxBreakdown: [],
    };

    try {
      if (calcInput.lineItems.length === 0) {
        return emptyResult;
      }
       return calcEngine.calculate(calcInput);
    } catch {
      return emptyResult;
    }
  }, [calcInput, currency]);

  const updateItem = (index: number, field: keyof LineItemInput, value: unknown) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, initialLineItem()]);
    setItemProductIds([...itemProductIds, null]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
    const newIds = [...itemProductIds];
    newIds.splice(index, 1);
    setItemProductIds(newIds);
  };

  const addProductAsItem = (product: Product) => {
    const newItem: LineItemInput = {
      description: product.name,
      quantity: 1,
      unit: product.unit || "each",
      unitPrice: parseFloat(product.unit_price || "0"),
      discount: undefined,
      taxRate: parseFloat(product.tax_rate || "0"),
      tax_name: product.tax_category || null,
      isTaxInclusive: false,
      sortOrder: items.length,
    };
    setItems([...items, newItem]);
    setItemProductIds([...itemProductIds, product.id]);
  };

  const addFee = () => {
    setFees([
      ...fees,
      { description: "", amount: 0, taxRate: 0, tax_name: null },
    ]);
  };

  const updateFee = (index: number, field: keyof FeeInput, value: unknown) => {
    const newFees = [...fees];
    newFees[index] = { ...newFees[index], [field]: value };
    setFees(newFees);
  };

  const removeFee = (index: number) => {
    const newFees = [...fees];
    newFees.splice(index, 1);
    setFees(newFees);
  };

  const getInputPayload = () => {
    const basePayload: any = {
      customerId: customerId || undefined,
      currency,
      issueDate: issueDate || undefined,
      notes: notes || undefined,
      terms: terms || undefined,
      paymentInstructions: undefined,
    };

    if (effectiveDocType === "invoice") {
      basePayload.dueDate = dueDate || undefined;
      basePayload.poNumber = poNumber || undefined;
    } else {
      basePayload.expiryDate = expiryDate || undefined;
      basePayload.scopeOfWork = scopeOfWork || undefined;
      basePayload.internalNotes = internalNotes || undefined;
      basePayload.paymentInstructions = terms || undefined;
    }

    basePayload.items = items
      .map((item, index) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxName: item.tax_name,
        isTaxInclusive: item.isTaxInclusive,
        productId: itemProductIds[index] || undefined,
      }))
      .filter((item) => item.description.trim() !== "");

    if (fees.length > 0) {
      basePayload.fees = fees.map((f) => ({
        description: f.description,
        amount: f.amount,
        taxRate: f.taxRate,
        taxName: f.tax_name,
      }));
    }

    if (invoiceDiscount && !isNaN(parseFloat(invoiceDiscount)) && parseFloat(invoiceDiscount) > 0) {
      basePayload.invoiceDiscount = parseFloat(invoiceDiscount);
      basePayload.invoiceDiscountType = invoiceDiscountType;
    }

    return basePayload;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = getInputPayload();
      if (isEditing) {
        if (effectiveDocType === "invoice") {
          return updateProprietaryInvoice(id!, payload);
        } else {
          return updateProprietaryQuote(id!, payload);
        }
      } else {
        if (effectiveDocType === "invoice") {
          return createProprietaryInvoice(payload);
        } else {
          return createProprietaryQuote(payload);
        }
      }
    },
    onSuccess: (data: any) => {
      const doc = effectiveDocType === "invoice" ? data.invoice : data.quote;
      queryClient.invalidateQueries({ queryKey: ["proprietary-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["proprietary-quotes"] });

      if (!isEditing) {
        const docId = doc.id;
        toast(
          `${effectiveDocType === "invoice" ? "Invoice" : "Quote"} created successfully.`,
          { title: "Created" },
        );
        navigate(`/app/proprietary/${effectiveDocType === "invoice" ? "invoices" : "quotes"}/${docId}/edit`);
      } else {
        toast(
          `${effectiveDocType === "invoice" ? "Invoice" : "Quote"} updated successfully.`,
          { title: "Saved" },
        );
      }
    },
    onError: (err: any) => {
      toast(err?.message || "Something went wrong. Please try again.", {
        title: "Error",
        type: "error",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.filter((i) => i.description.trim()).length === 0) {
      toast("Please add at least one line item.", {
        title: "Error",
        type: "error",
      });
      return;
    }
    saveMutation.mutate();
  };

  const taxRateOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: "0", label: "0.00% — Exempt" }];
    if (taxRatesData?.taxRates) {
      for (const t of taxRatesData.taxRates.filter((t: TaxRate) => t.enabled)) {
        opts.push({
          value: String(t.rate),
          label: `${String(t.rate)}% ${t.name ? `(${t.name})` : ""}`,
        });
      }
    }
    return opts;
  }, [taxRatesData]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-primary">
          {isEditing ? "Edit" : "New"} {effectiveDocType === "invoice" ? "Invoice" : "Quote"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? "Saving..."
              : isEditing
                ? "Update"
                : "Create Draft"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium">Customer</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select a customer...</option>
                {customersData?.customers.map((c: Customer) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.email && `(${c.email})`}
                  </option>
                ))}
              </select>
            </div>

            {effectiveDocType === "quote" && (
              <div className="space-y-3">
                <label className="block text-sm font-medium">Scope of Work</label>
                <textarea
                  value={scopeOfWork}
                  onChange={(e) => setScopeOfWork(e.target.value)}
                  placeholder="Describe the scope of work..."
                  className="w-full px-3 py-2 border rounded-lg h-24 resize-none"
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium">Line Items</label>
                <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                  + Add Item
                </Button>
              </div>

              {productsData?.products && productsData.products.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-secondary">
                    Add from product catalog
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const product = productsData.products.find(
                        (p: Product) => p.id === e.target.value,
                      );
                      if (product) addProductAsItem(product);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select a product or service...</option>
                    {productsData.products.map((p: Product) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.sku ? ` (${p.sku})` : ""} — {formatCurrencyValue(p.unit_price, p.currency)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Qty"
                        value={String(item.quantity)}
                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        placeholder="Unit"
                        value={item.unit}
                        onChange={(e) => updateItem(index, "unit", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Price"
                        value={String(item.unitPrice)}
                        onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-1">
                      <select
                        value={String(item.taxRate)}
                        onChange={(e) => updateItem(index, "taxRate", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      >
                        {taxRateOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {items.length > 1 && (
                      <div className="col-span-1">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="w-full px-2 py-1.5 text-red-600 hover:bg-red-50 rounded text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {fees.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm">Fees</h3>
                {fees.map((fee, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="Description"
                        value={fee.description}
                        onChange={(e) => updateFee(index, "description", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Amount"
                        value={String(fee.amount || 0)}
                        onChange={(e) => updateFee(index, "amount", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={String(fee.taxRate || 0)}
                        onChange={(e) => updateFee(index, "taxRate", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      >
                        {taxRateOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => removeFee(index)}
                        className="w-full px-2 py-1.5 text-red-600 hover:bg-red-50 rounded text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={addFee}
                className="text-sm text-primary hover:text-primary/80"
              >
                + Add Fee
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border rounded-lg p-4 bg-muted/30">
              <h3 className="font-medium mb-3">Totals</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Subtotal</span>
                  <span>{formatCurrencyValue(calculation.subtotal, currency)}</span>
                </div>
                {calculation.discountTotal.gt(0) && (
                  <div className="flex justify-between">
                    <span className="text-secondary">Discount</span>
                    <span className="text-red-600">-{formatCurrencyValue(calculation.discountTotal, currency)}</span>
                  </div>
                )}
                {calculation.taxTotal.gt(0) && (
                  <div className="flex justify-between">
                    <span className="text-secondary">Tax</span>
                    <span>{formatCurrencyValue(calculation.taxTotal, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrencyValue(calculation.total, currency)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-sm">Document Details</h3>

              <div className="space-y-2">
                <label className="block text-sm">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              {effectiveDocType === "invoice" && (
                <div className="space-y-2">
                  <label className="block text-sm">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              )}

              {effectiveDocType === "quote" && (
                <div className="space-y-2">
                  <label className="block text-sm">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              )}

              {effectiveDocType === "invoice" && (
                <div className="space-y-2">
                  <label className="block text-sm">PO Number</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="PO Number"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm">Invoice Discount</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={invoiceDiscount}
                    onChange={(e) => setInvoiceDiscount(e.target.value)}
                    className="flex-1 px-2 py-1.5 border rounded text-sm"
                  />
                  <select
                    value={invoiceDiscountType}
                    onChange={(e) => setInvoiceDiscountType(e.target.value as "fixed" | "percentage")}
                    className="px-2 py-1.5 border rounded text-sm w-24"
                  >
                    <option value="percentage">%</option>
                    <option value="fixed">$</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-sm">Additional Fields</h3>
              <div className="space-y-2">
                <label className="block text-sm">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 border rounded-lg text-sm h-20 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm">Terms</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Payment terms..."
                  className="w-full px-3 py-2 border rounded-lg text-sm h-20 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e as any);
            }}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? "Saving..."
              : isEditing
                ? "Update"
                : "Create Draft"}
          </Button>
        </div>
      </form>
    </div>
  );
}
