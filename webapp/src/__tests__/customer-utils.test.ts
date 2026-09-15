import { describe, it, expect } from "vitest";
import {
  isInvoiceOverdue,
  getInvoiceDisplayStatus,
  getCustomerPrimaryContact,
  customerHasBalance,
} from "../utils/customer";
import type { ApiCustomer } from "../types/api";

function makeCustomer(over: Partial<ApiCustomer> = {}): ApiCustomer {
  return {
    id: "cust-1",
    businessId: "biz-1",
    name: "Acme Corp",
    companyName: "Acme Inc",
    email: "billing@acme.example.com",
    phone: "555-1234",
    taxId: null,
    address: {
      addressLine1: "123 Main St",
      addressLine2: null,
      city: "New York",
      stateOrRegion: null,
      postalCode: null,
      countryCode: "US",
      taxId: null,
    },
    countryCode: "US",
    defaultCurrency: "USD",
    notes: null,
    status: "active",
    paymentTerms: null,
    taxIdentifiers: [],
    billingAddressId: null,
    shippingAddressId: null,
    archivedAt: null,
    archivedBy: null,
    updatedBy: null,
    version: 1,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...over,
  } as ApiCustomer;
}

describe("isInvoiceOverdue", () => {
  const past = new Date("2024-01-01T00:00:00Z");

  it("returns true for an open invoice past due with a balance", () => {
    expect(
      isInvoiceOverdue({
        status: "sent",
        dueDate: "2020-01-01T00:00:00Z",
        amountDue: "100.00",
        now: past,
      })
    ).toBe(true);
  });

  it("returns false for a paid invoice even if past due", () => {
    expect(
      isInvoiceOverdue({
        status: "paid",
        dueDate: "2020-01-01T00:00:00Z",
        amountDue: "0.00",
        now: past,
      })
    ).toBe(false);
  });

  it("returns false when amountDue is zero", () => {
    expect(
      isInvoiceOverdue({
        status: "sent",
        dueDate: "2020-01-01T00:00:00Z",
        amountDue: "0",
        now: past,
      })
    ).toBe(false);
  });

  it("returns false when there is no due date", () => {
    expect(
      isInvoiceOverdue({
        status: "sent",
        dueDate: null,
        amountDue: "100.00",
        now: past,
      })
    ).toBe(false);
  });

  it("returns false when the due date is in the future", () => {
    expect(
      isInvoiceOverdue({
        status: "sent",
        dueDate: "2099-01-01T00:00:00Z",
        amountDue: "100.00",
        now: past,
      })
    ).toBe(false);
  });

  it("returns false for cancelled/void invoices", () => {
    expect(
      isInvoiceOverdue({ status: "cancelled", dueDate: "2020-01-01T00:00:00Z", amountDue: "100.00", now: past })
    ).toBe(false);
    expect(
      isInvoiceOverdue({ status: "void", dueDate: "2020-01-01T00:00:00Z", amountDue: "100.00", now: past })
    ).toBe(false);
  });

  it("uses current time when now is omitted", () => {
    expect(
      isInvoiceOverdue({
        status: "sent",
        dueDate: "2020-01-01T00:00:00Z",
        amountDue: "100.00",
      })
    ).toBe(true);
  });
});

describe("getInvoiceDisplayStatus", () => {
  it("returns overdue for open past-due invoices", () => {
    expect(
      getInvoiceDisplayStatus({
        status: "sent",
        dueDate: "2020-01-01T00:00:00Z",
        amountDue: "100.00",
      })
    ).toBe("overdue");
  });

  it("preserves the stored overdue status", () => {
    expect(
      getInvoiceDisplayStatus({
        status: "overdue",
        dueDate: "2020-01-01T00:00:00Z",
        amountDue: "100.00",
      })
    ).toBe("overdue");
  });

  it("returns the stored status when not overdue", () => {
    expect(
      getInvoiceDisplayStatus({
        status: "sent",
        dueDate: "2099-01-01T00:00:00Z",
        amountDue: "100.00",
      })
    ).toBe("sent");
  });

  it("returns paid as-is", () => {
    expect(
      getInvoiceDisplayStatus({
        status: "paid",
        dueDate: null,
        amountDue: "0.00",
      })
    ).toBe("paid");
  });
});

describe("getCustomerPrimaryContact", () => {
  it("combines email and phone", () => {
    expect(getCustomerPrimaryContact(makeCustomer())).toBe("billing@acme.example.com • 555-1234");
  });

  it("returns only email when no phone", () => {
    expect(getCustomerPrimaryContact(makeCustomer({ phone: null }))).toBe("billing@acme.example.com");
  });

  it("returns only phone when no email", () => {
    expect(getCustomerPrimaryContact(makeCustomer({ email: null }))).toBe("555-1234");
  });

  it("returns null when neither is present", () => {
    expect(getCustomerPrimaryContact(makeCustomer({ email: null, phone: null }))).toBeNull();
  });
});

describe("customerHasBalance", () => {
  it("returns true when outstanding is positive", () => {
    expect(customerHasBalance(makeCustomer({ totalOutstanding: "250.00" }))).toBe(true);
  });

  it("returns false when outstanding is zero", () => {
    expect(customerHasBalance(makeCustomer({ totalOutstanding: "0" }))).toBe(false);
  });

  it("returns false when outstanding is undefined", () => {
    expect(customerHasBalance(makeCustomer({ totalOutstanding: undefined }))).toBe(false);
  });
});
