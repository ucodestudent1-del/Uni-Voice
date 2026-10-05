import React, { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, FileText, Calendar, Clock, Hash, Link, Info } from "lucide-react";
import { useAnalytics } from "../hooks/useAnalytics";
import type { WorkspaceInvoiceData } from "./InvoiceWorkspace";

interface AdvancedDetailsAccordionProps {
  data: WorkspaceInvoiceData;
  onChange: (data: Partial<WorkspaceInvoiceData>) => void;
  defaultOpen?: boolean;
  compact?: boolean;
}

const EXPENSE_CATEGORIES = [
  "Professional Services",
  "Software & Tools",
  "Travel",
  "Office Supplies",
  "Marketing",
  "Training",
  "Legal",
  "Consulting",
  "Other",
];

const INVOICE_TERMS = [
  "Due on receipt",
  "Net 15",
  "Net 30",
  "Net 60",
  "2/10 Net 30",
  "Custom",
];

export function AdvancedDetailsAccordion({
  data,
  onChange,
  defaultOpen = false,
  compact = false,
}: AdvancedDetailsAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<"details" | "payment">("details");
  const { track, trackAdvancedDetailsOpened } = useAnalytics();

  const handleToggle = useCallback(() => {
    if (!open) {
      trackAdvancedDetailsOpened({ isMobile: compact });
      track("advanced_details_opened", { isMobile: compact });
    }
    setOpen((prev) => !prev);
  }, [open, track, trackAdvancedDetailsOpened, compact]);

  const handleChange = useCallback(
    (field: string, value: any) => {
      onChange({ [field]: value } as any);
    },
    [onChange]
  );

  return (
    <div className={`border border-slate-200 rounded-xl bg-white ${compact ? "" : "mt-4"}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-t-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-slate-600" />
          <span className="font-medium text-slate-700">Advanced details</span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400 transition-transform" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <div className="flex gap-2 mt-3 mb-4">
            {(["details", "payment"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? "bg-blue-100 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab === "details" ? "Details" : "Payment"}
              </button>
            ))}
          </div>

          {activeTab === "details" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    PO Number
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={data.poNumber || ""}
                      onChange={(e) => handleChange("poNumber", e.target.value)}
                      placeholder="PO number"
                      className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Invoice category
                  </label>
                  <select
                    value={data.invoiceCategory || ""}
                    onChange={(e) => handleChange("invoiceCategory", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="">Select category</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Invoice terms
                  </label>
                  <select
                    value={data.invoiceTerms || ""}
                    onChange={(e) => handleChange("invoiceTerms", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  >
                    <option value="">Default</option>
                    {INVOICE_TERMS.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Source / Link
                  </label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="url"
                      value={data.sourceUrl || ""}
                      onChange={(e) => handleChange("sourceUrl", e.target.value)}
                      placeholder="https://..."
                      className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "payment" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Payment reference
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={data.paymentReference || ""}
                      onChange={(e) => handleChange("paymentReference", e.target.value)}
                      placeholder="Payment reference"
                      className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Payment portal URL
                  </label>
                  <input
                    type="url"
                    value={data.paymentPortalUrl || ""}
                    onChange={(e) => handleChange("paymentPortalUrl", e.target.value)}
                    placeholder="https://pay.example.com/..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bank account details
                  </label>
                  <textarea
                    value={data.bankDetails || ""}
                    onChange={(e) => handleChange("bankDetails", e.target.value)}
                    placeholder="Account name, number, routing..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdvancedDetailsAccordion;
