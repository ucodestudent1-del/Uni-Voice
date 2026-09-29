import { describe, it, expect } from "vitest";
import {
  isInvoiceOverdue,
  getInvoiceDisplayStatus,
  getCustomerPrimaryContact,
  customerHasBalance,
  formatAddressLines,
  getCustomerInitials,
  getCustomerBillingSnapshot,
  getCustomerDisplayName,
  getInvoiceAmountDue,
  getInvoiceReference,
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

describe("formatAddressLines", () => {
  const address = {
    addressLine1: "123 Main St",
    addressLine2: "Suite 400",
    city: "New York",
    stateOrRegion: "NY",
    postalCode: "10001",
    countryCode: "US",
    taxId: null,
  };

  it("builds one line per address component and merges locality", () => {
    expect(formatAddressLines(address)).toEqual([
      "123 Main St",
      "Suite 400",
      "New York, NY 10001",
      "US",
    ]);
  });

  it("omits a missing postal code", () => {
    expect(formatAddressLines({ ...address, postalCode: null })).toContain("New York, NY");
  });

  it("omits blank optional lines", () => {
    expect(formatAddressLines({ ...address, addressLine2: null })).not.toContain("Suite 400");
  });

  it("returns an empty array when no address is present", () => {
    expect(formatAddressLines(null)).toEqual([]);
    expect(formatAddressLines(undefined)).toEqual([]);
  });
});

describe("getCustomerInitials", () => {
  it("prefers the company name", () => {
    expect(getCustomerInitials({ name: "Jane Doe", companyName: "Acme Inc" })).toBe("AI");
  });

  it("uses first and last name when no company exists", () => {
    expect(getCustomerInitials({ name: "Jane Doe", companyName: null })).toBe("JD");
  });

  it("takes the first two letters of a single word", () => {
    expect(getCustomerInitials({ name: "Acme", companyName: null })).toBe("AC");
  });

  it("ignores punctuation when building the monogram", () => {
    expect(getCustomerInitials({ name: "O'Brien & Sons", companyName: null })).toBe("OS");
  });

  it("falls back to a marker when no name is available", () => {
    expect(getCustomerInitials({ name: "   ", companyName: null })).toBe("?");
  });
});

describe("getCustomerDisplayName", () => {
  it("prefers the company name", () => {
    expect(getCustomerDisplayName({ name: "Jane Doe", companyName: "Acme Inc" })).toBe("Acme Inc");
  });

  it("falls back to the contact name", () => {
    expect(getCustomerDisplayName({ name: "Jane Doe", companyName: null })).toBe("Jane Doe");
  });

  it("falls back to a placeholder when both are blank", () => {
    expect(getCustomerDisplayName({ name: "", companyName: null })).toBe("Unnamed customer");
  });
});

describe("getCustomerBillingSnapshot", () => {
  const base = {
    totalInvoiceCount: 0,
    finalizedInvoiceCount: 0,
    totalBilled: "0",
    totalPaid: "0",
    totalOutstanding: "0",
    totalOverdue: "0",
  };

  it("reports never_invoiced when there are no invoices", () => {
    const snapshot = getCustomerBillingSnapshot(base);
    expect(snapshot.state).toBe("never_invoiced");
    expect(snapshot.label).toBe("No invoices issued yet");
  });

  it("reports settled when nothing is outstanding", () => {
    const snapshot = getCustomerBillingSnapshot({
      ...base,
      totalInvoiceCount: 3,
      finalizedInvoiceCount: 3,
      totalBilled: "900.00",
      totalPaid: "900.00",
    });
    expect(snapshot.state).toBe("settled");
    expect(snapshot.label).toBe("All invoices paid");
    expect(snapshot.openInvoiceCount).toBe(0);
  });

  it("reports outstanding and counts open invoices", () => {
    const snapshot = getCustomerBillingSnapshot({
      ...base,
      totalInvoiceCount: 4,
      finalizedInvoiceCount: 2,
      totalBilled: "1200.00",
      totalPaid: "700.00",
      totalOutstanding: "500.00",
    });
    expect(snapshot.state).toBe("outstanding");
    expect(snapshot.label).toBe("2 invoices awaiting payment");
    expect(snapshot.openInvoiceCount).toBe(2);
    expect(snapshot.outstanding).toBe("500.00");
  });

  it("uses the singular form for a single open invoice", () => {
    const snapshot = getCustomerBillingSnapshot({
      ...base,
      totalInvoiceCount: 1,
      finalizedInvoiceCount: 0,
      totalBilled: "150.00",
      totalOutstanding: "150.00",
    });
    expect(snapshot.label).toBe("1 invoice awaiting payment");
  });

  it("treats overdue as the most urgent state", () => {
    const snapshot = getCustomerBillingSnapshot({
      ...base,
      totalInvoiceCount: 3,
      finalizedInvoiceCount: 2,
      totalBilled: "800.00",
      totalPaid: "300.00",
      totalOutstanding: "500.00",
      totalOverdue: "200.00",
    });
    expect(snapshot.state).toBe("overdue");
    expect(snapshot.overdue).toBe("200.00");
  });

  it("normalises missing amounts to 0.00", () => {
    const snapshot = getCustomerBillingSnapshot({
      ...base,
      totalBilled: undefined as unknown as string,
      totalPaid: null as unknown as string,
    });
    expect(snapshot.billed).toBe("0.00");
    expect(snapshot.paid).toBe("0.00");
  });
});

describe("getInvoiceAmountDue", () => {
  it("prefers amountDue when positive", () => {
    expect(getInvoiceAmountDue({ amountDue: "120.50", total: "200.00" })).toBe("120.50");
  });

  it("falls back to the total when amountDue is zero", () => {
    expect(getInvoiceAmountDue({ amountDue: "0.00", total: "200.00" })).toBe("200.00");
  });

  it("falls back to the total when amountDue is missing", () => {
    expect(getInvoiceAmountDue({ amountDue: undefined as unknown as string, total: "75.00" })).toBe("75.00");
  });
});

describe("getInvoiceReference", () => {
  it("uses the invoice number when assigned", () => {
    expect(getInvoiceReference({ id: "a1b2c3d4e5f6", invoiceNumber: "INV-1042" })).toBe("INV-1042");
  });

  it("falls back to a draft reference", () => {
    expect(getInvoiceReference({ id: "a1b2c3d4e5f6", invoiceNumber: null })).toBe("Draft #a1b2c3d4");
  });
});
