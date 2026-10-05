import { useCallback } from "react";
import { analytics, type AnalyticsEventName } from "../lib/analytics";

export interface UseAnalyticsReturn {
  track: (eventName: AnalyticsEventName, properties?: Record<string, unknown>) => void;
  trackInvoiceCreated: (properties?: Record<string, unknown>) => void;
  trackComponentAdded: (properties?: Record<string, unknown>) => void;
  trackTemplateSelected: (properties?: Record<string, unknown>) => void;
  trackInvoiceSent: (properties?: Record<string, unknown>) => void;
  trackDraftAbandoned: (properties?: Record<string, unknown>) => void;
  trackAiParseAttempted: (properties?: Record<string, unknown>) => void;
  trackAiParseSuccess: (properties?: Record<string, unknown>) => void;
  trackAiParseFailed: (properties?: Record<string, unknown>) => void;
  trackQuickCreateStarted: (properties?: Record<string, unknown>) => void;
  trackQuickCreateCompleted: (properties?: Record<string, unknown>) => void;
  trackCustomerSelected: (properties?: Record<string, unknown>) => void;
  trackItemAdded: (properties?: Record<string, unknown>) => void;
  trackItemRemoved: (properties?: Record<string, unknown>) => void;
  trackDocumentDuplicateStarted: (properties?: Record<string, unknown>) => void;
  trackDocumentConvertStarted: (properties?: Record<string, unknown>) => void;
  trackCommandBarUsed: (properties?: Record<string, unknown>) => void;
  trackCatalogChipUsed: (properties?: Record<string, unknown>) => void;
  trackLastInvoiceUsed: (properties?: Record<string, unknown>) => void;
  trackFrequentlyInvoicedUsed: (properties?: Record<string, unknown>) => void;
  trackSpeedMetricsRecorded: (properties?: Record<string, unknown>) => void;
  trackAdvancedDetailsOpened: (properties?: Record<string, unknown>) => void;
}

export function useAnalytics(): UseAnalyticsReturn {
  const track = useCallback((eventName: AnalyticsEventName, properties?: Record<string, unknown>) => {
    try {
      analytics.trackEvent(eventName, properties);
    } catch {
      // no-op if analytics isn't available
    }
  }, []);

  const trackInvoiceCreated = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("invoice_created", properties);
    },
    [track]
  );

  const trackComponentAdded = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("component_added", properties);
    },
    [track]
  );

  const trackTemplateSelected = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("template_selected", properties);
    },
    [track]
  );

  const trackInvoiceSent = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("invoice_sent", properties);
    },
    [track]
  );

  const trackDraftAbandoned = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("draft_abandoned", properties);
    },
    [track]
  );

  const trackAiParseAttempted = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("ai_parse_attempted", properties);
    },
    [track]
  );

  const trackAiParseSuccess = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("ai_parse_success", properties);
    },
    [track]
  );

  const trackAiParseFailed = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("ai_parse_failed", properties);
    },
    [track]
  );

  const trackQuickCreateStarted = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("quick_create_started", properties);
    },
    [track]
  );

  const trackQuickCreateCompleted = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("quick_create_completed", properties);
    },
    [track]
  );

  const trackCustomerSelected = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("customer_selected", properties);
    },
    [track]
  );

  const trackItemAdded = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("item_added", properties);
    },
    [track]
  );

  const trackItemRemoved = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("item_removed", properties);
    },
    [track]
  );

  const trackDocumentDuplicateStarted = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("document_duplicate_started", properties);
    },
    [track]
  );

  const trackDocumentConvertStarted = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("document_convert_started", properties);
    },
    [track]
  );

  const trackCommandBarUsed = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("command_bar_used", properties);
    },
    [track]
  );

  const trackCatalogChipUsed = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("catalog_chip_used", properties);
    },
    [track]
  );

  const trackLastInvoiceUsed = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("last_invoice_used", properties);
    },
    [track]
  );

  const trackFrequentlyInvoicedUsed = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("frequently_invoiced_used", properties);
    },
    [track]
  );

  const trackSpeedMetricsRecorded = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("speed_metrics_recorded", properties);
    },
    [track]
  );

  const trackAdvancedDetailsOpened = useCallback(
    (properties: Record<string, unknown> = {}) => {
      track("advanced_details_opened", properties);
    },
    [track]
  );

  return {
    track,
    trackInvoiceCreated,
    trackComponentAdded,
    trackTemplateSelected,
    trackInvoiceSent,
    trackDraftAbandoned,
    trackAiParseAttempted,
    trackAiParseSuccess,
    trackAiParseFailed,
    trackQuickCreateStarted,
    trackQuickCreateCompleted,
    trackCustomerSelected,
    trackItemAdded,
    trackItemRemoved,
    trackDocumentDuplicateStarted,
    trackDocumentConvertStarted,
    trackCommandBarUsed,
    trackCatalogChipUsed,
    trackLastInvoiceUsed,
    trackFrequentlyInvoicedUsed,
    trackSpeedMetricsRecorded,
    trackAdvancedDetailsOpened,
  };
}

export default useAnalytics;
