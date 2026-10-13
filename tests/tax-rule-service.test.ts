import { describe, it, expect, beforeEach } from "vitest";
import { taxRuleService } from "../src/services/tax-rule-service.js";
import { truncateTestDb, createTestBusiness } from "./helpers/db.js";
import { ConflictError, NotFoundError } from "../src/domain/errors.js";

describe("TaxRuleService", () => {
  let businessId: string;

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
  });

  describe("create", () => {
    it("creates a tax rule with minimal fields", async () => {
      const rule = await taxRuleService.create(businessId, {
        name: "Standard VAT",
        rate: 0.2,
      });

      expect(rule.id).toBeTruthy();
      expect(rule.businessId).toBe(businessId);
      expect(rule.name).toBe("Standard VAT");
      expect(Number(rule.rate)).toBeCloseTo(0.2, 4);
      expect(rule.type).toBe("percentage");
      expect(rule.enabled).toBe(true);
      expect(rule.isCompound).toBe(false);
      expect(rule.isDefault).toBe(false);
      expect(rule.conditions).toEqual([]);
    });

    it("creates a tax rule with conditions", async () => {
      const rule = await taxRuleService.create(businessId, {
        name: "US Tax",
        rate: 0.08,
        countryCode: "US",
        conditions: [
          { field: "customer_country", operator: "equals", value: "US" },
        ],
      });

      expect(rule.conditions).toHaveLength(1);
      expect(rule.conditions![0].field).toBe("customer_country");
      expect(rule.conditions![0].operator).toBe("equals");
      expect(rule.conditions![0].value).toBe("US");
    });

    it("throws ConflictError for duplicate name", async () => {
      await taxRuleService.create(businessId, { name: "VAT", rate: 0.2 });
      await expect(
        taxRuleService.create(businessId, { name: "VAT", rate: 0.1 })
      ).rejects.toThrow(ConflictError);
    });

    it("allows same name for different businesses", async () => {
      const biz2 = await createTestBusiness({
        id: "00000000-0000-0000-0000-000000000002",
        ownerId: "22222222-2222-2222-2222-222222222222",
      });

      const rule1 = await taxRuleService.create(businessId, { name: "VAT", rate: 0.2 });
      const rule2 = await taxRuleService.create(biz2.id, { name: "VAT", rate: 0.2 });

      expect(rule1.id).not.toBe(rule2.id);
      expect(rule1.businessId).toBe(businessId);
      expect(rule2.businessId).toBe(biz2.id);
    });
  });

  describe("findById", () => {
    it("returns a tax rule by id", async () => {
      const created = await taxRuleService.create(businessId, { name: "VAT", rate: 0.2 });
      const found = await taxRuleService.findById(businessId, created.id);

      expect(found).not.toBeNull();
      expect(found!.name).toBe("VAT");
      expect(Number(found!.rate)).toBeCloseTo(0.2, 4);
    });

    it("returns null for non-existent rule id", async () => {
      const found = await taxRuleService.findById(businessId, "00000000-0000-0000-0000-000000000000");
      expect(found).toBeNull();
    });

    it("returns null for rule from different business", async () => {
      const created = await taxRuleService.create(businessId, { name: "VAT", rate: 0.2 });
      const biz2 = await createTestBusiness({
        id: "00000000-0000-0000-0000-000000000002",
        ownerId: "22222222-2222-2222-2222-222222222222",
      });

      const found = await taxRuleService.findById(biz2.id, created.id);
      expect(found).toBeNull();
    });
  });

  describe("findMany", () => {
    it("returns all tax rules for a business", async () => {
      await taxRuleService.create(businessId, { name: "VAT", rate: 0.2 });
      await taxRuleService.create(businessId, { name: "GST", rate: 0.1 });

      const result = await taxRuleService.findMany(businessId, {
        limit: 50,
        offset: 0,
        enabled: true,
      });

      expect(result.total).toBe(2);
      expect(result.taxRules).toHaveLength(2);
      expect(result.taxRules.map((r) => r.name).sort()).toEqual(["GST", "VAT"]);
    });

    it("filters by enabled status", async () => {
      await taxRuleService.create(businessId, { name: "Active", rate: 0.1, enabled: true });
      await taxRuleService.create(businessId, { name: "Disabled", rate: 0.2, enabled: false });

      const result = await taxRuleService.findMany(businessId, {
        limit: 50,
        offset: 0,
        enabled: true,
      });

      expect(result.total).toBe(1);
      expect(result.taxRules[0].name).toBe("Active");
    });

    it("respects pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await taxRuleService.create(businessId, { name: `Rule${i}`, rate: 0.1 });
      }

      const result = await taxRuleService.findMany(businessId, {
        limit: 2,
        offset: 0,
        enabled: true,
      });

      expect(result.total).toBe(5);
      expect(result.taxRules).toHaveLength(2);

      const result2 = await taxRuleService.findMany(businessId, {
        limit: 2,
        offset: 2,
        enabled: true,
      });
      expect(result2.taxRules).toHaveLength(2);
    });
  });

  describe("update", () => {
    it("updates a tax rule", async () => {
      const created = await taxRuleService.create(businessId, { name: "VAT", rate: 0.2 });
      const updated = await taxRuleService.update(businessId, created.id, {
        rate: 0.21,
        code: "VAT21",
      });

      expect(Number(updated.rate)).toBeCloseTo(0.21, 4);
      expect(updated.code).toBe("VAT21");
      expect(updated.name).toBe("VAT");
    });

    it("updates conditions", async () => {
      const created = await taxRuleService.create(businessId, { name: "VAT", rate: 0.2 });
      const updated = await taxRuleService.update(businessId, created.id, {
        conditions: [
          { field: "customer_country", operator: "equals", value: "US" },
          { field: "total_amount_min", operator: "greater_than", value: "100" },
        ],
      });

      expect(updated.conditions).toHaveLength(2);
      expect(updated.conditions![0].field).toBe("customer_country");
      expect(updated.conditions![1].field).toBe("total_amount_min");
    });

    it("throws NotFoundError for non-existent rule", async () => {
      await expect(
        taxRuleService.update(businessId, "00000000-0000-0000-0000-000000000000", { rate: 0.1 })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("delete", () => {
    it("deletes a tax rule", async () => {
      const created = await taxRuleService.create(businessId, { name: "VAT", rate: 0.2 });
      await taxRuleService.delete(businessId, created.id);

      const found = await taxRuleService.findById(businessId, created.id);
      expect(found).toBeNull();
    });

    it("throws NotFoundError for non-existent rule", async () => {
      await expect(
        taxRuleService.delete(businessId, "00000000-0000-0000-0000-000000000000")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("evaluate", () => {
    it("returns default rules when no conditions match", async () => {
      await taxRuleService.create(businessId, {
        name: "Default Tax",
        rate: 0.1,
        isDefault: true,
      });
      await taxRuleService.create(businessId, {
        name: "US Tax",
        rate: 0.08,
        conditions: [{ field: "customer_country", operator: "equals", value: "US" }],
      });

      const applicable = await taxRuleService.evaluate(
        { currency: "USD" },
        businessId
      );

      expect(applicable).toHaveLength(1);
      expect(applicable[0].name).toBe("Default Tax");
    });

    it("returns matching rules based on conditions", async () => {
      await taxRuleService.create(businessId, {
        name: "US Tax",
        rate: 0.08,
        conditions: [{ field: "customer_country", operator: "equals", value: "US" }],
      });
      await taxRuleService.create(businessId, {
        name: "EU Tax",
        rate: 0.2,
        conditions: [{ field: "customer_country", operator: "equals", value: "DE" }],
      });

      const applicable = await taxRuleService.evaluate(
        { currency: "USD", customerCountry: "US" },
        businessId
      );

      expect(applicable).toHaveLength(1);
      expect(applicable[0].name).toBe("US Tax");
    });
  });

  describe("evaluateRule", () => {
    it("evaluates a rule against a context", async () => {
      const rule = await taxRuleService.create(businessId, {
        name: "US Tax",
        rate: 0.08,
        conditions: [
          { field: "customer_country", operator: "equals", value: "US" },
          { field: "total_amount_min", operator: "greater_than", value: "50" },
        ],
      });

      const result = taxRuleService.evaluateRule(rule, {
        customerCountry: "US",
        currency: "USD",
        totalAmount: "100",
      });

      expect(result.matched).toBe(true);
      expect(result.matchedConditions).toBe(2);
    });

    it("returns false when conditions do not match", async () => {
      const rule = await taxRuleService.create(businessId, {
        name: "US Tax",
        rate: 0.08,
        conditions: [{ field: "customer_country", operator: "equals", value: "US" }],
      });

      const result = taxRuleService.evaluateRule(rule, {
        customerCountry: "GB",
        currency: "USD",
      });

      expect(result.matched).toBe(false);
      expect(result.matchedConditions).toBe(0);
    });
  });
});
