import { describe, it, expect, beforeEach } from "vitest";
import { invoiceNumberService } from "../src/services/numbering/service.js";
import { resetTestDb, createTestBusiness } from "./helpers/db.js";
import { query } from "../src/db/pool.js";

describe("InvoiceNumberService", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("creates a sequence and generates INV-YYYY-000001", async () => {
    const biz = await createTestBusiness();
    const result = await invoiceNumberService.generate(biz.id, new Date("2026-01-15"));
    // sequence started at next_number=1; the assigned value claimed is 1
    expect(result.assignedNumber).toBe(1);
    expect(result.number).toBe("INV-2026-000001");
    expect(result.config.prefix).toBe("INV");
    expect(result.config.padding).toBe(6);
    expect(result.config.includesYear).toBe(true);
  });

  it("increments atomically and never reuses a number", async () => {
    const biz = await createTestBusiness();
    const results = await Promise.all(
      Array.from({ length: 10 }).map((_, i) => invoiceNumberService.generate(biz.id, new Date("2026-03-10")))
    );
    const assigned = results.map((r) => r.assignedNumber).sort((a, b) => a - b);
    expect(assigned).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const formatted = results.map((r) => r.number);
    const unique = new Set(formatted);
    expect(unique.size).toBe(10);
    expect(formatted).toContain("INV-2026-000001");
    expect(formatted).toContain("INV-2026-000010");
  });

  it("uses configured prefix and padding", async () => {
    const biz = await createTestBusiness();
    await invoiceNumberService.updateSequenceConfig(biz.id, { prefix: "EST", padding: 4, includesYear: false });
    const result = await invoiceNumberService.generate(biz.id);
    expect(result.number).toBe("EST-0001");
  });

  it("isolates sequences per business", async () => {
    const biz1 = await createTestBusiness({ id: "10000000-0000-0000-0000-000000000001", name: "B1" });
    const biz2 = await createTestBusiness({ id: "20000000-0000-0000-0000-000000000002", name: "B2" });
    const r1 = await invoiceNumberService.generate(biz1.id);
    const r2 = await invoiceNumberService.generate(biz2.id);
    expect(r1.number).toBe("INV-2026-000001");
    expect(r2.number).toBe("INV-2026-000001");
  });

  it("persists next_number after generation", async () => {
    const biz = await createTestBusiness();
    await invoiceNumberService.generate(biz.id);
    const res = await query("SELECT next_number FROM invoice_number_sequences WHERE business_id = $1", [biz.id]);
    expect(Number(res.rows[0].next_number)).toBe(2);
  });
});
