import { useCallback } from "react";
import { analytics, type AnalyticsEventName } from "../lib/analytics";

export interface UseAnalyticsReturn {
  track: (eventName: AnalyticsEventName, properties?: Record<string, unknown>) => void;
  trackInvoiceCreated: (properties?: Record<string, unknown>) => void;
  trackComponentAdded: (properties?: Record<string, unknown>) => void;
  trackTemplateSelected: (properties?: Record<string, unknown>) => void;
  trackInvoiceSent: (properties?: Record<string, unknown>) => void;
  trackDraftAbandoned: (properties?: Record<string, unknown>) => void;
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

  return {
    track,
    trackInvoiceCreated,
    trackComponentAdded,
    trackTemplateSelected,
    trackInvoiceSent,
    trackDraftAbandoned,
  };
}

export default useAnalytics;
