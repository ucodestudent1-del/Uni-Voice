import React, { useState, useCallback } from "react";
import { Clock, Copy, Trash2 } from "lucide-react";
import { getProgressiveAutofill, getFrequentlyInvoiced } from "../api/client";
import { useAnalytics } from "../hooks/useAnalytics";
import { Button } from "./ui/Button";
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
        currency: autofill?.currency || "USD",
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
          <Button
            variant="secondary"
            size="md"
            className="w-full justify-start gap-3 px-4 py-3"
            loading={loading || action === "populate"}
            onClick={handleQuickRepeat}
          >
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-bg text-primary-brand">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary">
                  {loading ? "Loading…" : "Quick repeat"}
                </span>
                {lastInvoice && (
                  <span className="text-xs text-tertiary bg-surface-alt px-2 py-0.5 rounded">
                    Last invoice: {(lastInvoice as any)?.invoiceNumber || formatDate(lastInvoice.sentAt || new Date())}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm text-secondary truncate">
                {loading
                  ? "Preparing your next invoice…"
                  : lastInvoice?.customer.name
                    ? `${lastInvoice.customer.name} — ${formatCurrency(lastInvoice.total)}`
                    : "Repeat your last invoice details"}
              </div>
            </div>
          </Button>
        </div>

        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={handleDismiss}
            aria-label="Don't show again"
          />
        )}
      </div>

      {error && (
        <div className="mt-2 text-xs text-error-text status-error-bg px-3 py-1.5 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}

export default QuickRepeatBanner;

