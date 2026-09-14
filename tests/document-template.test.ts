import { describe, it, expect, beforeEach } from "vitest";
import { documentTemplateRepository } from "../src/repositories/document-template.repo.js";
import { resetTestDb, createTestBusiness } from "./helpers/db.js";

const BUSINESS_A = "00000000-0000-0000-0000-000000000001";
const BUSINESS_B = "00000000-0000-0000-0000-000000000002";
const USER_A = "11111111-1111-1111-1111-111111111111";

const sampleDocument = {
  business: { name: "Acme Corp" },
  lineItems: [{ description: "Service", quantity: 1, unitPrice: 100, taxRate: 0.1 }],
  totals: { subtotal: 100, taxTotal: 10, total: 110 },
  metadata: { currency: "USD" },
};

describe("DocumentTemplateRepository (DB integration)", () => {
  beforeEach(async () => {
    await resetTestDb();
    await createTestBusiness({ id: BUSINESS_A, ownerId: USER_A });
    await createTestBusiness({ id: BUSINESS_B, ownerId: USER_A });
  });

  describe("create / findById", () => {
    it("creates a template and retrieves it by id", async () => {
      const created = await documentTemplateRepository.create(BUSINESS_A, {
        name: "Standard Invoice",
        document: sampleDocument,
      });

      expect(created.id).toBeTruthy();
      expect(created.businessId).toBe(BUSINESS_A);
      expect(created.name).toBe("Standard Invoice");
      expect(created.revision).toBe(1);
      expect(created.version).toBe(1);
      expect(created.isDefault).toBe(false);
      expect(created.isActive).toBe(true);
      expect(created.document).toEqual(sampleDocument);

      const found = await documentTemplateRepository.findById(BUSINESS_A, created.id);
      expect(found).toEqual(created);
    });

    it("throws when the template does not exist", async () => {
      await expect(
        documentTemplateRepository.findById(BUSINESS_A, "00000000-0000-0000-0000-000000009999")
      ).rejects.toThrow("not found or access denied");
    });
  });

  describe("findMany", () => {
    it("lists all templates for a business", async () => {
      await documentTemplateRepository.create(BUSINESS_A, { name: "T1", document: sampleDocument });
      await documentTemplateRepository.create(BUSINESS_A, { name: "T2", document: sampleDocument });

      const templates = await documentTemplateRepository.findMany(BUSINESS_A);
      expect(templates).toHaveLength(2);
    });

    it("filters by industry", async () => {
      await documentTemplateRepository.create(BUSINESS_A, {
        name: "Retail",
        industry: "retail",
        document: sampleDocument,
      });
      await documentTemplateRepository.create(BUSINESS_A, {
        name: "Services",
        industry: "services",
        document: sampleDocument,
      });

      const retail = await documentTemplateRepository.findMany(BUSINESS_A, { industry: "retail" });
      expect(retail).toHaveLength(1);
      expect(retail[0].industry).toBe("retail");
    });

    it("filters by isDefault", async () => {
      await documentTemplateRepository.create(BUSINESS_A, { name: "Default", document: sampleDocument, is_default: true });
      await documentTemplateRepository.create(BUSINESS_A, { name: "Other", document: sampleDocument, is_default: false });

      const defaults = await documentTemplateRepository.findMany(BUSINESS_A, { isDefault: true });
      expect(defaults).toHaveLength(1);
      expect(defaults[0].isDefault).toBe(true);
    });
  });

  describe("tenant isolation", () => {
    it("business A cannot see business B templates", async () => {
      const created = await documentTemplateRepository.create(BUSINESS_B, {
        name: "B Template",
        document: sampleDocument,
      });

      const aTemplates = await documentTemplateRepository.findMany(BUSINESS_A);
      expect(aTemplates).toHaveLength(0);

      await expect(
        documentTemplateRepository.findById(BUSINESS_A, created.id)
      ).rejects.toThrow("not found or access denied");
    });

    it("setDefault for business B does not affect business A", async () => {
      const aTemplate = await documentTemplateRepository.create(BUSINESS_A, {
        name: "A Template",
        document: sampleDocument,
        is_default: true,
      });
      const bTemplate = await documentTemplateRepository.create(BUSINESS_B, {
        name: "B Template",
        document: sampleDocument,
      });

      await documentTemplateRepository.setDefault(BUSINESS_B, bTemplate.id);

      const aTemplates = await documentTemplateRepository.findMany(BUSINESS_A, { isDefault: true });
      expect(aTemplates).toHaveLength(1);
      expect(aTemplates[0].id).toBe(aTemplate.id);
      expect(aTemplates[0].isDefault).toBe(true);
    });
  });

  describe("update", () => {
    it("updates name, description, industry, and config", async () => {
      const created = await documentTemplateRepository.create(BUSINESS_A, {
        name: "Original",
        document: sampleDocument,
      });

      const updated = await documentTemplateRepository.update(BUSINESS_A, created.id, {
        name: "Renamed",
        description: "Updated description",
        industry: "retail",
        config: { theme: "dark" },
      });

      expect(updated.name).toBe("Renamed");
      expect(updated.description).toBe("Updated description");
      expect(updated.industry).toBe("retail");
      expect(updated.config).toEqual({ theme: "dark" });
    });

    it("throws when updating a non-existent template", async () => {
      await expect(
        documentTemplateRepository.update(BUSINESS_A, "00000000-0000-0000-0000-000000009999", { name: "X" })
      ).rejects.toThrow("not found or access denied");
    });

    it("cannot update another business's template", async () => {
      const created = await documentTemplateRepository.create(BUSINESS_B, {
        name: "B Template",
        document: sampleDocument,
      });

      await expect(
        documentTemplateRepository.update(BUSINESS_A, created.id, { name: "Hijack" })
      ).rejects.toThrow("not found or access denied");
    });
  });

  describe("duplicate", () => {
    it("creates a copy with incremented revision and version", async () => {
      const created = await documentTemplateRepository.create(BUSINESS_A, {
        name: "Original",
        industry: "retail",
        document: sampleDocument,
        config: { foo: "bar" },
      });

      const copy = await documentTemplateRepository.duplicate(BUSINESS_A, created.id);

      expect(copy.id).not.toBe(created.id);
      expect(copy.name).toBe("Original (Copy)");
      expect(copy.revision).toBe(2);
      expect(copy.version).toBe(2);
      expect(copy.industry).toBe("retail");
      expect(copy.document).toEqual(sampleDocument);
      expect(copy.config).toEqual({ foo: "bar" });
      expect(copy.isDefault).toBe(false);
    });

    it("throws when duplicating a non-owned template", async () => {
      const created = await documentTemplateRepository.create(BUSINESS_B, {
        name: "B Template",
        document: sampleDocument,
      });

      await expect(
        documentTemplateRepository.duplicate(BUSINESS_A, created.id)
      ).rejects.toThrow("not found or access denied");
    });
  });

  describe("delete", () => {
    it("deletes a template", async () => {
      const created = await documentTemplateRepository.create(BUSINESS_A, {
        name: "To Delete",
        document: sampleDocument,
      });

      await documentTemplateRepository.delete(BUSINESS_A, created.id);

      await expect(
        documentTemplateRepository.findById(BUSINESS_A, created.id)
      ).rejects.toThrow("not found or access denied");
    });

    it("throws when deleting a non-existent template", async () => {
      await expect(
        documentTemplateRepository.delete(BUSINESS_A, "00000000-0000-0000-0000-000000009999")
      ).rejects.toThrow("not found or access denied");
    });
  });

  describe("findDefault / findDefaultByIndustry", () => {
    it("findDefault returns the default for a business", async () => {
      await documentTemplateRepository.create(BUSINESS_A, { name: "Non-default", document: sampleDocument });
      const def = await documentTemplateRepository.create(BUSINESS_A, {
        name: "Default Template",
        document: sampleDocument,
        is_default: true,
      });

      const found = await documentTemplateRepository.findDefault(BUSINESS_A);
      expect(found?.id).toBe(def.id);
      expect(found?.isDefault).toBe(true);
    });

    it("findDefault returns null when no default exists", async () => {
      await documentTemplateRepository.create(BUSINESS_A, { name: "Non-default", document: sampleDocument });

      const found = await documentTemplateRepository.findDefault(BUSINESS_A);
      expect(found).toBeNull();
    });

    it("findDefaultByIndustry returns industry-specific default or falls back", async () => {
      const industryDefault = await documentTemplateRepository.create(BUSINESS_A, {
        name: "Retail Default",
        industry: "retail",
        document: sampleDocument,
        is_default: true,
      });

      const found = await documentTemplateRepository.findDefaultByIndustry(BUSINESS_A, "retail");
      expect(found?.id).toBe(industryDefault.id);

      const nonMatch = await documentTemplateRepository.findDefaultByIndustry(BUSINESS_A, "services");
      expect(nonMatch?.id).toBe(industryDefault.id);

      await documentTemplateRepository.delete(BUSINESS_A, industryDefault.id);
      const noDefault = await documentTemplateRepository.findDefaultByIndustry(BUSINESS_A, "retail");
      expect(noDefault).toBeNull();
    });
  });

  describe("setDefault", () => {
    it("sets a template as default and clears previous defaults", async () => {
      const t1 = await documentTemplateRepository.create(BUSINESS_A, {
        name: "T1", document: sampleDocument, is_default: true,
      });
      const t2 = await documentTemplateRepository.create(BUSINESS_A, {
        name: "T2", document: sampleDocument,
      });

      const updated = await documentTemplateRepository.setDefault(BUSINESS_A, t2.id);
      expect(updated.isDefault).toBe(true);

      const t1Refreshed = await documentTemplateRepository.findById(BUSINESS_A, t1.id);
      expect(t1Refreshed.isDefault).toBe(false);

      const defaults = await documentTemplateRepository.findMany(BUSINESS_A, { isDefault: true });
      expect(defaults).toHaveLength(1);
      expect(defaults[0].id).toBe(t2.id);
    });
  });
});
