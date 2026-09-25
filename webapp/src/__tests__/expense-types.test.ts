import { describe, it, expect } from "vitest";
import {
  EXPENSE_CATEGORY_CONFIG,
  EXPENSE_CATEGORY_OPTIONS,
} from "@/components/expenses/ExpenseCategoryBadge";
import type { ExpensesCategory } from "@/types/expenses";

describe("expense-types", () => {
  describe("EXPENSE_CATEGORY_CONFIG", () => {
    it("has entries for all 12 categories", () => {
      const categories: ExpensesCategory[] = [
        "supplies", "software", "meals", "travel", "office", "marketing",
        "utilities", "professional_fees", "taxes", "insurance", "equipment", "other",
      ];
      expect(Object.keys(EXPENSE_CATEGORY_CONFIG)).toEqual(
        expect.arrayContaining(categories)
      );
      expect(Object.keys(EXPENSE_CATEGORY_CONFIG).length).toBe(12);
    });

    it("every category has a label, color, and icon", () => {
      for (const config of Object.values(EXPENSE_CATEGORY_CONFIG)) {
        expect(config.label).toBeTruthy();
        expect(config.icon).toBeTruthy();
        expect(["primary", "secondary", "success", "warning", "error", "tertiary", "info"]).toContain(
          config.color
        );
      }
    });

    it("provides human-readable labels", () => {
      expect(EXPENSE_CATEGORY_CONFIG.supplies.label).toBe("Supplies");
      expect(EXPENSE_CATEGORY_CONFIG.professional_fees.label).toBe("Professional Fees");
      expect(EXPENSE_CATEGORY_CONFIG.other.label).toBe("Other");
    });
  });
});
