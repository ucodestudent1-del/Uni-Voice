import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { analytics } from "../lib/analytics";
import { useAnalytics } from "../hooks/useAnalytics";

describe("analytics", () => {
  beforeEach(() => {
    analytics.flush();
  });

  describe("trackEvent", () => {
    it("records an event with properties", () => {
      analytics.trackEvent("invoice_created", { customerId: "cust-1" });
      const events = analytics.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe("invoice_created");
      expect(events[0].properties).toEqual({ customerId: "cust-1" });
      expect(events[0].timestamp).toBeGreaterThan(0);
    });

    it("handles events without properties", () => {
      analytics.trackEvent("component_added");
      const events = analytics.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe("component_added");
      expect(events[0].properties).toEqual({});
    });

    it("respects max buffer size", () => {
      for (let i = 0; i < 1001; i++) {
        analytics.trackEvent("component_added");
      }
      const events = analytics.getEvents();
      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });

  describe("flush", () => {
    it("clears the event buffer", () => {
      analytics.trackEvent("invoice_created");
      analytics.trackEvent("invoice_sent");
      expect(analytics.getEvents().length).toBe(2);
      analytics.flush();
      expect(analytics.getEvents()).toHaveLength(0);
    });
  });

  describe("ANALYTICS_EVENTS", () => {
    it("includes all expected event names", async () => {
      const mod = await import("../lib/analytics");
      expect(mod.ANALYTICS_EVENTS).toContain("template_selected");
      expect(mod.ANALYTICS_EVENTS).toContain("component_added");
      expect(mod.ANALYTICS_EVENTS).toContain("component_deleted");
      expect(mod.ANALYTICS_EVENTS).toContain("component_duplicated");
      expect(mod.ANALYTICS_EVENTS).toContain("invoice_created");
      expect(mod.ANALYTICS_EVENTS).toContain("invoice_saved");
      expect(mod.ANALYTICS_EVENTS).toContain("invoice_finalized");
      expect(mod.ANALYTICS_EVENTS).toContain("invoice_sent");
      expect(mod.ANALYTICS_EVENTS).toContain("draft_abandoned");
      expect(mod.ANALYTICS_EVENTS).toContain("undo_performed");
      expect(mod.ANALYTICS_EVENTS).toContain("redo_performed");
    });
  });
});

describe("useAnalytics hook", () => {
  beforeEach(() => {
    analytics.flush();
  });

  it("exports all tracking functions", () => {
    const { result } = renderHook(() => useAnalytics());
    expect(typeof result.current.track).toBe("function");
    expect(typeof result.current.trackInvoiceCreated).toBe("function");
    expect(typeof result.current.trackComponentAdded).toBe("function");
    expect(typeof result.current.trackTemplateSelected).toBe("function");
    expect(typeof result.current.trackInvoiceSent).toBe("function");
    expect(typeof result.current.trackDraftAbandoned).toBe("function");
  });

  it("trackInvoiceCreated calls track with invoice_created", () => {
    const spy = vi.spyOn(analytics, "trackEvent");
    const { result } = renderHook(() => useAnalytics());
    result.current.trackInvoiceCreated({ invoiceId: "inv-1" });
    expect(spy).toHaveBeenCalledWith("invoice_created", { invoiceId: "inv-1" });
    spy.mockRestore();
  });

  it("trackTemplateSelected calls track with template_selected", () => {
    const spy = vi.spyOn(analytics, "trackEvent");
    const { result } = renderHook(() => useAnalytics());
    result.current.trackTemplateSelected({ templateKey: "professional" });
    expect(spy).toHaveBeenCalledWith("template_selected", { templateKey: "professional" });
    spy.mockRestore();
  });

  it("trackComponentAdded calls track with component_added", () => {
    const spy = vi.spyOn(analytics, "trackEvent");
    const { result } = renderHook(() => useAnalytics());
    result.current.trackComponentAdded({ componentType: "lineItems" });
    expect(spy).toHaveBeenCalledWith("component_added", { componentType: "lineItems" });
    spy.mockRestore();
  });

  it("trackInvoiceSent calls track with invoice_sent", () => {
    const spy = vi.spyOn(analytics, "trackEvent");
    const { result } = renderHook(() => useAnalytics());
    result.current.trackInvoiceSent({ invoiceId: "inv-1" });
    expect(spy).toHaveBeenCalledWith("invoice_sent", { invoiceId: "inv-1" });
    spy.mockRestore();
  });

  it("trackDraftAbandoned calls track with draft_abandoned", () => {
    const spy = vi.spyOn(analytics, "trackEvent");
    const { result } = renderHook(() => useAnalytics());
    result.current.trackDraftAbandoned({ reason: "user_navigated_away" });
    expect(spy).toHaveBeenCalledWith("draft_abandoned", { reason: "user_navigated_away" });
    spy.mockRestore();
  });

  it("track handles errors gracefully", () => {
    const spy = vi.spyOn(analytics, "trackEvent").mockImplementation(() => {
      throw new Error("analytics unavailable");
    });
    const { result } = renderHook(() => useAnalytics());
    expect(() => result.current.trackInvoiceCreated()).not.toThrow();
    spy.mockRestore();
  });
});
