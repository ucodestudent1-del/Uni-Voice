import { describe, it, expect } from "vitest";
import {
  getCacheKey,
  invalidateCache,
  invalidateCacheByKey,
} from "../api/client";
import {
  formatDuration,
  buildProjectSearchParams,
  buildInvoiceSearchParams,
  buildCreditNoteSearchParams,
} from "../api/client";

describe("API client cache utilities", () => {
  describe("getCacheKey", () => {
    it("returns the url when no params provided", () => {
      expect(getCacheKey("/api/invoices")).toBe("/api/invoices");
    });

    it("returns the url when params have only undefined/null values", () => {
      const key = getCacheKey("/api/invoices", { status: undefined, page: null });
      expect(key).toBe("/api/invoices");
    });

    it("builds a query string from params sorted alphabetically", () => {
      const key = getCacheKey("/api/invoices", { status: "open", page: "1", sort: "desc" });
      expect(key).toBe("/api/invoices?page=1&sort=desc&status=open");
    });

    it("filters out undefined and null values", () => {
      const key = getCacheKey("/api/invoices", { status: "open", page: undefined, sort: null });
      expect(key).toBe("/api/invoices?status=open");
    });

    it("handles empty params object", () => {
      expect(getCacheKey("/api/invoices", {})).toBe("/api/invoices");
    });

    it("converts non-string values to string", () => {
      const key = getCacheKey("/api/invoices", { limit: 50, offset: 0 });
      expect(key).toBe("/api/invoices?limit=50&offset=0");
    });
  });

  describe("invalidateCache", () => {
    it("clears the entire cache when called with no pattern", () => {
      const key = getCacheKey("/api/test", { a: "1" });
      invalidateCache();
    });

    it("clears cache without throwing when pattern provided", () => {
      invalidateCache("/api/invoices*");
    });

    it("handles non-matching pattern gracefully", () => {
      invalidateCache("/api/nonexistent*");
    });
  });

  describe("invalidateCacheByKey", () => {
    it("clears cache entries matching the url prefix", () => {
      invalidateCacheByKey("/api/invoices/123");
    });

    it("handles non-matching url gracefully", () => {
      invalidateCacheByKey("/api/nonexistent/123");
    });
  });
});

describe("formatDuration", () => {
  it("returns '0h 0m' for zero", () => {
    expect(formatDuration(0)).toBe("0h 0m");
  });

  it("returns '0h 0m' for undefined", () => {
    expect(formatDuration(undefined as unknown as number)).toBe("0h 0m");
  });

  it("formats hours and minutes correctly", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });

  it("formats hours only", () => {
    expect(formatDuration(120)).toBe("2h 0m");
  });

  it("formats minutes only", () => {
    expect(formatDuration(45)).toBe("0h 45m");
  });

  it("formats large duration", () => {
    expect(formatDuration(1500)).toBe("25h 0m");
  });
});

describe("buildProjectSearchParams", () => {
  it("returns empty object for empty params", () => {
    expect(buildProjectSearchParams({})).toEqual({});
  });

  it("includes only defined params", () => {
    const result = buildProjectSearchParams({
      limit: 10,
      offset: 0,
      status: "active",
    });
    expect(result).toEqual({ limit: 10, offset: 0, status: "active" });
  });

  it("omits undefined params", () => {
    const result = buildProjectSearchParams({
      limit: undefined,
      status: "active",
    });
    expect(result).toEqual({ status: "active" });
  });

  it("includes all supported params", () => {
    const result = buildProjectSearchParams({
      limit: 10,
      offset: 20,
      search: "test",
      status: "active",
      customerId: "cust-1",
      tagId: "tag-1",
      includeArchived: true,
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(Object.keys(result).sort()).toEqual([
      "customerId",
      "includeArchived",
      "limit",
      "offset",
      "search",
      "sortBy",
      "sortOrder",
      "status",
      "tagId",
    ]);
  });

  it("handles boolean includeArchived", () => {
    const result = buildProjectSearchParams({ includeArchived: false });
    expect(result).toEqual({ includeArchived: false });
  });
});

describe("buildInvoiceSearchParams", () => {
  it("returns empty object for empty params", () => {
    expect(buildInvoiceSearchParams({})).toEqual({});
  });

  it("maps camelCase to snake_case", () => {
    const result = buildInvoiceSearchParams({
      paymentState: "paid",
      customerId: "cust-1",
      minAmount: "100",
    });
    expect(result).toEqual({
      payment_state: "paid",
      customer_id: "cust-1",
      min_amount: "100",
    });
  });

  it("includes basic params as-is", () => {
    const result = buildInvoiceSearchParams({
      limit: 25,
      status: "sent",
      search: "invoice",
      currency: "USD",
      sortBy: "date",
      sortOrder: "desc",
    });
    expect(result).toEqual({
      limit: 25,
      status: "sent",
      search: "invoice",
      currency: "USD",
      sort_by: "date",
      sort_order: "desc",
    });
  });

  it("handles date range params", () => {
    const result = buildInvoiceSearchParams({
      issueDateFrom: "2024-01-01",
      issueDateTo: "2024-12-31",
      dueDateFrom: "2024-02-01",
      dueDateTo: "2024-12-30",
    });
    expect(result).toEqual({
      issue_date_from: "2024-01-01",
      issue_date_to: "2024-12-31",
      due_date_from: "2024-02-01",
      due_date_to: "2024-12-30",
    });
  });
});

describe("buildCreditNoteSearchParams", () => {
  it("returns empty object for empty params", () => {
    expect(buildCreditNoteSearchParams({})).toEqual({});
  });

  it("maps camelCase to snake_case for relevant params", () => {
    const result = buildCreditNoteSearchParams({
      customerId: "cust-1",
      sortBy: "date",
      sortOrder: "asc",
    });
    expect(result).toEqual({
      customer_id: "cust-1",
      sort_by: "date",
      sort_order: "asc",
    });
  });

  it("includes basic params", () => {
    const result = buildCreditNoteSearchParams({
      limit: 25,
      status: "posted",
      search: "credit",
      currency: "EUR",
    });
    expect(result).toEqual({
      limit: 25,
      status: "posted",
      search: "credit",
      currency: "EUR",
    });
  });
});
