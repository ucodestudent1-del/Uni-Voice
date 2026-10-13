import { describe, it, expect, beforeEach } from "vitest";
import { discountRuleService } from "../src/services/discount-rule-service.js";
import { truncateTestDb, createTestBusiness } from "./helpers/db.js";
import { NotFoundError } from "../src/domain/errors.js";

describe("DiscountRuleService", () => {
  let businessId: string;

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
  });

  describe("create", () => {
    it("creates a discount rule with minimal fields", async () => {
      const rule = await discountRuleService.create(businessId, {
        name: "Bulk Discount",
        type: "percentage",
        value: 10,
      });

      expect(rule.id).toBeTruthy();
      expect(rule.businessId).toBe(businessId);
      expect(rule.name).toBe("Bulk Discount");
      expect(rule.type).toBe("percentage");
      expect(rule.scope).toBe("invoice");
      expect(rule.isActive).toBe(true);
    });

    it("creates a fixed discount rule", async () => {
      const rule = await discountRuleService.create(businessId, {
        name: "Fixed Discount",
        type: "fixed",
        value: 25,
        scope: "line_item",
        minAmount: 100,
        maxDiscount: 100,
      });

      expect(rule.type).toBe("fixed");
      expect(rule.scope).toBe("line_item");
      expect(rule.minAmount).toMatch(/^100/);
      expect(rule.maxDiscount).toMatch(/^100/);
    });

    it("throws ConflictError for duplicate name", async () => {
      await discountRuleService.create(businessId, { name: "Discount", value: 10 });
      await expect(
        discountRuleService.create(businessId, { name: "Discount", value: 5 })
      ).rejects.toThrow(/already exists/);
    });
  });

  describe("findById", () => {
    it("returns a discount rule by id", async () => {
      const created = await discountRuleService.create(businessId, {
        name: "Seasonal",
        value: 15,
      });
      const found = await discountRuleService.findById(businessId, created.id);

      expect(found).not.toBeNull();
      expect(found!.name).toBe("Seasonal");
      expect(found!.value).toMatch(/^15/);
    });

    it("returns null for rule from different business", async () => {
      const created = await discountRuleService.create(businessId, { name: "VAT", value: 10 });
      const biz2 = await createTestBusiness({
        id: "00000000-0000-0000-0000-000000000002",
        ownerId: "22222222-2222-2222-2222-222222222222",
      });

      const found = await discountRuleService.findById(biz2.id, created.id);
      expect(found).toBeNull();
    });
  });

  describe("findMany", () => {
    it("returns all discount rules for a business", async () => {
      await discountRuleService.create(businessId, { name: "Rule A", value: 10 });
      await discountRuleService.create(businessId, { name: "Rule B", value: 20 });

      const result = await discountRuleService.findMany(businessId, {
        limit: 50,
        offset: 0,
        active: true,
      });

      expect(result.total).toBe(2);
      expect(result.discountRules).toHaveLength(2);
    });

    it("filters by active status", async () => {
      await discountRuleService.create(businessId, { name: "Active", value: 10, isActive: true });
      await discountRuleService.create(businessId, { name: "Inactive", value: 20, isActive: false });

      const result = await discountRuleService.findMany(businessId, {
        limit: 50,
        offset: 0,
        active: true,
      });

      expect(result.total).toBe(1);
      expect(result.discountRules[0].name).toBe("Active");
    });
  });

  describe("update", () => {
    it("updates a discount rule", async () => {
      const created = await discountRuleService.create(businessId, {
        name: "Original",
        value: 10,
      });
      const updated = await discountRuleService.update(businessId, created.id, {
        name: "Updated",
        value: 20,
        minAmount: 50,
        maxDiscount: 100,
      });

      expect(updated.name).toBe("Updated");
      expect(updated.value).toMatch(/^20/);
      expect(updated.minAmount).toMatch(/^50/);
      expect(updated.maxDiscount).toMatch(/^100/);
    });

    it("throws NotFoundError for non-existent rule", async () => {
      await expect(
        discountRuleService.update(businessId, "00000000-0000-0000-0000-000000000000", { value: 10 })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("delete", () => {
    it("deletes a discount rule", async () => {
      const created = await discountRuleService.create(businessId, { name: "To Delete", value: 10 });
      await discountRuleService.delete(businessId, created.id);

      const found = await discountRuleService.findById(businessId, created.id);
      expect(found).toBeNull();
    });
  });

  describe("evaluate", () => {
    it("applies active rules within time window", async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      const past = new Date(now.getTime() - 86400000);

      await discountRuleService.create(businessId, {
        name: "Active Rule",
        value: 10,
        isActive: true,
        startsAt: now.toISOString(),
        endsAt: future.toISOString(),
      });
      await discountRuleService.create(businessId, {
        name: "Expired Rule",
        value: 20,
        isActive: true,
        startsAt: past.toISOString(),
        endsAt: past.toISOString(),
      });
      await discountRuleService.create(businessId, {
        name: "Inactive Rule",
        value: 30,
        isActive: false,
      });

      const result = await discountRuleService.evaluate(
        { currency: "USD", subtotal: "1000", lineItems: [] },
        businessId
      );

      expect(result.applicableRules).toHaveLength(1);
      expect(result.applicableRules[0].name).toBe("Active Rule");
    });

    it("does not apply rules below minimum amount", async () => {
      await discountRuleService.create(businessId, {
        name: "High Min",
        value: 10,
        minAmount: 500,
      });

      const result = await discountRuleService.evaluate(
        { currency: "USD", subtotal: "100", lineItems: [] },
        businessId
      );

      expect(result.applicableRules).toHaveLength(0);
    });

    it("computes total discount correctly", async () => {
      await discountRuleService.create(businessId, {
        name: "10% Off",
        type: "percentage",
        value: 10,
        scope: "invoice",
      });

      const result = await discountRuleService.evaluate(
        { currency: "USD", subtotal: "100", lineItems: [] },
        businessId
      );

      expect(result.applicableRules).toHaveLength(1);
      expect(result.totalDiscount.toFixed(2)).toBe("10.00");
    });

    it("caps discount at maxDiscount", async () => {
      await discountRuleService.create(businessId, {
        name: "Capped",
        type: "percentage",
        value: 20,
        scope: "invoice",
        maxDiscount: 10,
      });

      const result = await discountRuleService.evaluate(
        { currency: "USD", subtotal: "100", lineItems: [] },
        businessId
      );

      expect(result.totalDiscount.toFixed(2)).toBe("10.00");
    });
  });
});
