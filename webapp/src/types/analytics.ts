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

let eventBuffer: AnalyticsEvent[] = [];

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
    } catch {
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
