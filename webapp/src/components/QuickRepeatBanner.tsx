import React, { useState, useCallback } from "react";
import { Clock, Copy, Trash2 } from "lucide-react";
import { getProgressiveAutofill, getFrequentlyInvoiced } from "../api/client";
import { useAnalytics } from "../hooks/useAnalytics";
import type { ApiLastInvoice, ApiProgressiveAutofill } from "../api/client";

interface QuickRepeatBannerProps<T> {
  businessId: string;
  customerId?: string;
  onPopulate: (data: Partial<T>) => void;
  onDismiss?: () => void;
}

const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
};

const formatDate = (dateStr: string | Date): string => {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

export function QuickRepeatBanner<T>({
  businessId,
  customerId,
  onPopulate,
  onDismiss,
}: QuickRepeatBannerProps<T>) {
  const [lastInvoice, setLastInvoice] = useState<ApiLastInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"none" | "populate" | "dismiss">("none");
  const { track, trackLastInvoiceUsed } = useAnalytics();

  const handleQuickRepeat = useCallback(async () => {
    if (action === "dismiss") return;
    setLoading(true);
    setError(null);
    try {
      const autofill = await getProgressiveAutofill(customerId).catch(() => null as ApiProgressiveAutofill | null);
      const frequent = await getFrequentlyInvoiced(5).catch(() => ({ items: [] }));

      setLastInvoice(null);

      const populateData: Record<string, any> = {
        currency: (autofill?.currency || "USD"),
        notes: autofill?.notes || undefined,
        terms: autofill?.terms || undefined,
        paymentInstructions: autofill?.paymentInstructions || undefined,
        taxRate: autofill?.taxRate || "0",
      };

      if (autofill?.customerId) {
        populateData.customerId = autofill.customerId;
      }

      onPopulate(populateData as Partial<T>);

      trackLastInvoiceUsed({
        source: "quick_repeat_banner",
        customerId: autofill?.customerId,
      });

      track("quick_create_started", { source: "quick_repeat_banner" });
    } catch (err: any) {
      setError(err?.message || "Failed to load last invoice");
    } finally {
      setLoading(false);
    }
  }, [action, customerId, onPopulate, track, trackLastInvoiceUsed]);

  const handlePopulate = () => {
    if (!lastInvoice) return;
    const populateData: Record<string, any> = {
      currency: lastInvoice.currency || "USD",
      notes: lastInvoice.notes,
      terms: lastInvoice.terms,
      paymentInstructions: lastInvoice.paymentInstructions,
      taxRate: lastInvoice.items?.[0]?.taxRate || "0",
    };
    if (lastInvoice.customer?.id) {
      populateData.customerId = lastInvoice.customer.id;
    }
    onPopulate(populateData as Partial<T>);
    trackLastInvoiceUsed({ source: "quick_repeat_populate" });
  };

  const handleDismiss = () => {
    setAction("dismiss");
    onDismiss?.();
    track("draft_abandoned", { reason: "banner_dismissed" });
  };

  if (action === "dismiss") return null;

  return (
    <div className="relative">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <button
            onClick={handleQuickRepeat}
            disabled={loading || action === "populate"}
            className="w-full flex items-center gap-3 px-4 py-3 text-left bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl hover:from-blue-100/50 hover:to-indigo-100/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">
                  {loading ? "Loading..." : "Quick repeat"}
                </span>
                {lastInvoice && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Last invoice: {(
                      lastInvoice as any
                    )?.invoiceNumber ||
                    formatDate(lastInvoice?.sentAt || new Date())}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm text-slate-600 truncate">
                {loading
                  ? "Preparing your next invoice..."
                  : lastInvoice?.customer.name
                    ? `${lastInvoice.customer.name} — ${formatCurrency(lastInvoice.total)}`
                    : "Repeat your last invoice details"}
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <Copy className="h-4 w-4 text-slate-600" />
            </div>
          </button>
        </div>

        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Don't show again"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}

export default QuickRepeatBanner;
