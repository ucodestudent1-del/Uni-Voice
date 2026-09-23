import { describe, it, expect, beforeEach } from "vitest";
import { invoiceService } from "../src/services/invoice-service.js";
import { truncateTestDb, createTestBusiness } from "./helpers/db.js";
import { query } from "../src/db/pool.js";

describe("Invoice default terms", () => {
  let businessId: string;

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
  }, 60000);

  it("applies business default_terms when creating a draft without explicit terms", async () => {
    const invoiceId = await invoiceService.createDraft(
      { currency: "USD", notes: "Test" },
      businessId,
      "11111111-1111-1111-1111-111111111111"
    );

    const summary = await invoiceService.getInvoice(businessId, invoiceId);
    expect(summary.invoice.terms).toBe("Net 30");
  });

  it("uses explicit terms over business default_terms", async () => {
    const invoiceId = await invoiceService.createDraft(
      { currency: "USD", terms: "Payment due on receipt" },
      businessId,
      "11111111-1111-1111-1111-111111111111"
    );

    const summary = await invoiceService.getInvoice(businessId, invoiceId);
    expect(summary.invoice.terms).toBe("Payment due on receipt");
  });

  it("falls back to SaaS default terms when business default_terms is NULL", async () => {
    await query(`UPDATE business_settings SET default_terms = NULL WHERE business_id = $1`, [businessId]);
    await query(`UPDATE business_settings SET default_notes = NULL WHERE business_id = $1`, [businessId]);

    const invoiceId = await invoiceService.createDraft(
      { currency: "USD" },
      businessId,
      "11111111-1111-1111-1111-111111111111"
    );

    const summary = await invoiceService.getInvoice(businessId, invoiceId);
    expect(summary.invoice.terms).not.toBeNull();
    expect(summary.invoice.terms).toContain("Payment Terms");
    expect(summary.invoice.terms).toContain("non-refundable");
    expect(summary.invoice.terms).toContain("30 days");
  });

  it("applies business default_notes when creating a draft without explicit notes", async () => {
    const invoiceId = await invoiceService.createDraft(
      { currency: "USD" },
      businessId,
      "11111111-1111-1111-1111-111111111111"
    );

    const summary = await invoiceService.getInvoice(businessId, invoiceId);
    expect(summary.invoice.notes).toBe("Thank you for your business.");
  });
});
