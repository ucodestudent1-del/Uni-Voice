export const ANALYTICS_EVENTS = [
  "template_selected",
  "component_added",
  "component_deleted",
  "component_duplicated",
  "invoice_created",
  "invoice_saved",
  "invoice_finalized",
  "invoice_sent",
  "draft_abandoned",
  "undo_performed",
  "redo_performed",
  "ai_parse_attempted",
  "ai_parse_success",
  "ai_parse_failed",
  "quick_create_started",
  "quick_create_completed",
  "customer_selected",
  "item_added",
  "item_removed",
  "document_duplicate_started",
  "document_convert_started",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export interface AnalyticsEvent {
  name: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

export interface Analytics {
  trackEvent(eventName: string, properties?: Record<string, unknown>): void;
  getEvents(): AnalyticsEvent[];
  flush(): void;
}

const EVENT_BUFFER_SIZE = 1000;
const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
const PLAUSIBLE_API = "https://plausible.io/api/event";

let eventBuffer: AnalyticsEvent[] = [];

function plausibleTrack(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined" || !PLAUSIBLE_DOMAIN) return;
  const props: Record<string, unknown> = { ...(properties ?? {}) };
  const nav = navigator as Navigator & { connection?: { effectiveType: string } };
  if (nav.connection?.effectiveType) {
    props.effectiveConnectionType = nav.connection.effectiveType;
  }
  const payload: Record<string, unknown> = {
    name: eventName,
    domain: PLAUSIBLE_DOMAIN,
    props,
  };
  if (navigator.sendBeacon) {
    navigator.sendBeacon(PLAUSIBLE_API, JSON.stringify(payload));
  } else {
    void fetch(PLAUSIBLE_API, {
      method: "POST",
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }
}

export const analytics: Analytics = {
  trackEvent(eventName, properties) {
    try {
      const event: AnalyticsEvent = {
        name: eventName,
        properties: properties ?? {},
        timestamp: Date.now(),
      };
      eventBuffer.push(event);
      if (eventBuffer.length > EVENT_BUFFER_SIZE) {
        eventBuffer = eventBuffer.slice(eventBuffer.length - EVENT_BUFFER_SIZE);
      }
      plausibleTrack(eventName, properties);
    } catch (err) {
      console.warn("Failed to track analytics event:", err);
    }
  },

  getEvents() {
    return [...eventBuffer];
  },

  flush() {
    eventBuffer = [];
  },
};

export default analytics;
