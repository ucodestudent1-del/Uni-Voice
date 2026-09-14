import { describe, it, expect, beforeEach } from "vitest";
import {
  createEmptyDocument,
  InvoiceDocument,
  ComponentType,
} from "../document-model/types";
import {
  insertComponent,
  getChildren,
  findComponent,
} from "../document-model/document-operations";
import {
  initializeRegistry,
} from "../document-model";
import {
  ALL_PRESETS,
  BLANK_PRESET,
  PROFESSIONAL_PRESET,
  INDUSTRY_PRESETS,
  getPresetTemplate,
  validatePreset,
} from "../document-model/templates/preset-templates";
import { invoiceDocumentSchema } from "../document-model/schemas";

initializeRegistry();

describe("preset-templates", () => {
  describe("BLANK_PRESET", () => {
    it("produces a valid document", () => {
      const doc = BLANK_PRESET.build("biz-1");
      expect(validatePreset(doc)).toBe(true);
      expect(invoiceDocumentSchema.safeParse(doc).success).toBe(true);
    });

    it("has empty components", () => {
      const doc = BLANK_PRESET.build("biz-1");
      expect(Object.keys(doc.components).length).toBe(0);
    });

    it("has correct metadata", () => {
      expect(BLANK_PRESET.metadata.key).toBe("blank");
      expect(BLANK_PRESET.metadata.category).toBe("blank");
    });
  });

  describe("PROFESSIONAL_PRESET", () => {
    it("produces a valid document", () => {
      const doc = PROFESSIONAL_PRESET.build("biz-1");
      expect(validatePreset(doc)).toBe(true);
      expect(invoiceDocumentSchema.safeParse(doc).success).toBe(true);
    });

    it("contains core invoice components", () => {
      const doc = PROFESSIONAL_PRESET.build("biz-1");
      const allIds = Object.keys(doc.components);
      const types = allIds.map((id) => findComponent(doc, id)?.type);
      expect(types).toContain("lineItems");
      expect(types).toContain("subtotal");
      expect(types).toContain("total");
      expect(types).toContain("amountDue");
      expect(types).toContain("customerInfo");
      expect(types).toContain("businessInfo");
    });
  });

  describe("INDUSTRY_PRESETS", () => {
    it("has 10 industry presets", () => {
      expect(INDUSTRY_PRESETS).toHaveLength(10);
    });

    it.each(INDUSTRY_PRESETS.map((p) => [p.metadata.key, p]))(
      "produces a valid document for %s",
      (_key, preset) => {
        const doc = preset.build("biz-1");
        expect(validatePreset(doc)).toBe(true);
        expect(invoiceDocumentSchema.safeParse(doc).success).toBe(true);
      }
    );

    it.each(INDUSTRY_PRESETS.map((p) => [p.metadata.key, p]))(
      "%s has core invoice components",
      (key, preset) => {
        const doc = preset.build("biz-1");
        const allIds = Object.keys(doc.components);
        const types = allIds.map((id) => findComponent(doc, id)?.type).filter(Boolean);
        expect(types).toContain("lineItems");
        expect(types).toContain("subtotal");
        expect(types).toContain("total");
        expect(types).toContain("amountDue");
        expect(types).toContain("customerInfo");
        expect(types).toContain("businessInfo");
      }
    );

    it.each(INDUSTRY_PRESETS.map((p) => [p.metadata.key, p.metadata.industry, p]))(
      "%s has industry tag set to %s",
      (_key, industry, preset) => {
        expect(preset.metadata.industry).toBe(industry);
        expect(preset.metadata.category).toBe("industry");
      }
    );

    it("construction preset includes job_site and project custom fields", () => {
      const preset = getPresetTemplate("construction")!;
      const doc = preset.build("biz-1");
      const types = Object.keys(doc.components).map((id) => findComponent(doc, id)?.type);
      expect(types).toContain("customField");
    });

    it("consulting preset includes milestone select field", () => {
      const preset = getPresetTemplate("consulting")!;
      const doc = preset.build("biz-1");
      const customFields = Object.keys(doc.components)
        .map((id) => findComponent(doc, id))
        .filter((c) => c?.type === "customField") as any[];
      const milestoneField = customFields.find((f) => f?.props?.key === "milestone");
      expect(milestoneField).toBeDefined();
      expect(milestoneField.props.type).toBe("select");
      expect(milestoneField.props.options).toContain("Kickoff");
    });

    it("automotive preset includes VIN custom field", () => {
      const preset = getPresetTemplate("automotive")!;
      const doc = preset.build("biz-1");
      const customFields = Object.keys(doc.components)
        .map((id) => findComponent(doc, id))
        .filter((c) => c?.type === "customField") as any[];
      const vinField = customFields.find((f) => f?.props?.key === "vin");
      expect(vinField).toBeDefined();
      expect(vinField.props.type).toBe("text");
    });

    it("retail preset has discount column visible", () => {
      const preset = getPresetTemplate("retail")!;
      const doc = preset.build("biz-1");
      const lineItems = Object.keys(doc.components)
        .map((id) => findComponent(doc, id))
        .find((c) => c?.type === "lineItems") as any;
      expect(lineItems).toBeDefined();
      expect(lineItems.props.showDiscount).toBe(true);
    });

    it("all presets have version and updatedAt", () => {
      ALL_PRESETS.forEach((preset) => {
        const doc = preset.build("biz-1");
        expect(doc.version).toBeGreaterThanOrEqual(1);
        expect(doc.updatedAt).toBeDefined();
        expect(doc.createdAt).toBeDefined();
        expect(doc.businessId).toBe("biz-1");
      });
    });

    it("all presets have at least one row with columns", () => {
      ALL_PRESETS.forEach((preset) => {
        const doc = preset.build("biz-1");
        const rows = Object.keys(doc.rows);
        expect(rows.length).toBeGreaterThanOrEqual(1);
        const cols = Object.keys(doc.columns);
        expect(cols.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("getPresetTemplate", () => {
    it("returns the correct preset by key", () => {
      const preset = getPresetTemplate("construction");
      expect(preset).toBeDefined();
      expect(preset?.metadata.key).toBe("construction");
    });

    it("returns undefined for unknown key", () => {
      const preset = getPresetTemplate("nonexistent");
      expect(preset).toBeUndefined();
    });
  });

  describe("ALL_PRESETS", () => {
    it("includes blank, professional, and 10 industry presets", () => {
      expect(ALL_PRESETS.length).toBe(12);
      expect(ALL_PRESETS.find((p) => p.metadata.key === "blank")).toBeDefined();
      expect(ALL_PRESETS.find((p) => p.metadata.key === "professional")).toBeDefined();
      expect(ALL_PRESETS.filter((p) => p.metadata.category === "industry").length).toBe(10);
    });
  });
});
