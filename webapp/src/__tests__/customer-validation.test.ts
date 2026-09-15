import { describe, it, expect } from "vitest";
import { CustomerFormSchema } from "../schemas/customer";

describe("CustomerFormSchema", () => {
  it("validates a complete customer form", () => {
    const result = CustomerFormSchema.safeParse({
      name: "Acme Corp",
      companyName: "Acme Inc",
      email: "billing@acme.example.com",
      phone: "555-1234",
      taxId: "12-3456789",
      addressLine1: "123 Business St",
      city: "New York",
      stateOrRegion: "NY",
      postalCode: "10001",
      countryCode: "US",
      notes: "Important client",
      status: "active",
      paymentTerms: 30,
    });
    expect(result.success).toBe(true);
  });

  it("requires name field", () => {
    const result = CustomerFormSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Customer name is required");
  });

  it("rejects empty name", () => {
    const result = CustomerFormSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = CustomerFormSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("validates email format", () => {
    const result = CustomerFormSchema.safeParse({ name: "Test", email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Invalid email address");
  });

  it("allows empty string for email", () => {
    const result = CustomerFormSchema.safeParse({ name: "Test", email: "" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("");
  });

  it("requires 2-letter country code", () => {
    const result = CustomerFormSchema.safeParse({ name: "Test", countryCode: "USA" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Country code required");
  });

  it("validates status enum", () => {
    const result = CustomerFormSchema.safeParse({ name: "Test", status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects negative payment terms", () => {
    const result = CustomerFormSchema.safeParse({ name: "Test", paymentTerms: -5 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Payment terms must be non-negative");
  });

  it("accepts all valid statuses", () => {
    for (const status of ["active", "inactive", "archived"]) {
      const result = CustomerFormSchema.safeParse({ name: "Test", status });
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(status);
    }
  });

  it("trims nothing (validation only, trimming happens in service)", () => {
    const result = CustomerFormSchema.safeParse({ name: "  Test  " });
    expect(result.success).toBe(true);
  });

  it("validates name max length", () => {
    const result = CustomerFormSchema.safeParse({ name: "x".repeat(256) });
    expect(result.success).toBe(false);
  });
});
