import { describe, it, expect, beforeEach } from "vitest";
import { expenseRepository } from "../src/repositories/expense.repo.js";
import { truncateTestDb, createTestBusiness } from "./helpers/db.js";
import { Decimal } from "decimal.js";

describe("ExpenseRepository", () => {
  let businessId: string;

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
  });

  describe("create", () => {
    it("creates an expense with required fields", async () => {
      const expense = await expenseRepository.create(businessId, {
        description: "Office Supplies",
        amount: new Decimal("25.50"),
        currency: "USD",
        category: "supplies",
        paymentMethod: "credit_card",
      });

      expect(expense.id).toBeTruthy();
      expect(expense.businessId).toBe(businessId);
      expect(expense.description).toBe("Office Supplies");
      expect(expense.amount).toBe("25.50");
      expect(expense.currency).toBe("USD");
      expect(expense.category).toBe("supplies");
      expect(expense.paymentMethod).toBe("credit_card");
      expect(expense.isBillable).toBe(false);
      expect(expense.isReimbursed).toBe(false);
    });

    it("throws BusinessLogicError for negative amounts", async () => {
      await expect(
        expenseRepository.create(businessId, {
          description: "Test",
          amount: new Decimal("-5.00"),
        })
      ).rejects.toThrow("Expense amount must be >= 0");
    });
  });

  describe("findById", () => {
    it("throws NotFoundError for non-existent expense", async () => {
      await expect(
        expenseRepository.findById(businessId, "00000000-0000-0000-0000-000000000099")
      ).rejects.toThrow("not found");
    });

    it("finds an existing expense", async () => {
      const created = await expenseRepository.create(businessId, {
        description: "Test Expense",
        amount: new Decimal("10.00"),
      });

      const found = await expenseRepository.findById(businessId, created.id);
      expect(found.description).toBe("Test Expense");
    });
  });

  describe("findMany", () => {
    beforeEach(async () => {
      await expenseRepository.create(businessId, {
        description: "First Expense",
        amount: new Decimal("100.00"),
        category: "supplies",
      });
      await expenseRepository.create(businessId, {
        description: "Second Expense",
        amount: new Decimal("50.00"),
        category: "travel",
      });
    });

    it("returns expenses for the business", async () => {
      const result = await expenseRepository.findMany(businessId);
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it("filters by category", async () => {
      const result = await expenseRepository.findMany(businessId, {
        category: "supplies",
      });
      expect(result.total).toBe(1);
      expect(result.data[0].category).toBe("supplies");
    });

    it("search filters by description", async () => {
      const result = await expenseRepository.findMany(businessId, {
        search: "First",
      });
      expect(result.total).toBe(1);
      expect(result.data[0].description).toBe("First Expense");
    });

    it("isBillable filter works", async () => {
      await expenseRepository.update(businessId, (await expenseRepository.findMany(businessId)).data[0].id, {
        isBillable: true,
      });
      const result = await expenseRepository.findMany(businessId, {
        isBillable: true,
      });
      expect(result.total).toBe(1);
    });

    it("supports sorting by amount desc", async () => {
      const result = await expenseRepository.findMany(businessId, {
        sortBy: "amount",
        sortOrder: "desc",
      });
      expect(result.data[0].description).toBe("First Expense");
      expect(result.data[1].description).toBe("Second Expense");
    });
  });

  describe("update", () => {
    it("updates an expense", async () => {
      const created = await expenseRepository.create(businessId, {
        description: "Original",
        amount: new Decimal("10.00"),
      });

      const updated = await expenseRepository.update(businessId, created.id, {
        description: "Updated",
        isBillable: true,
      });

      expect(updated.description).toBe("Updated");
      expect(updated.isBillable).toBe(true);
    });
  });

  describe("delete", () => {
    it("deletes an expense", async () => {
      const created = await expenseRepository.create(businessId, {
        description: "To Delete",
        amount: new Decimal("5.00"),
      });

      await expenseRepository.delete(businessId, created.id);

      await expect(
        expenseRepository.findById(businessId, created.id)
      ).rejects.toThrow("not found");
    });
  });

  describe("getCategoryBreakdown", () => {
    beforeEach(async () => {
      await expenseRepository.create(businessId, {
        description: "Office Supplies",
        amount: new Decimal("80.00"),
        category: "supplies",
      });
      await expenseRepository.create(businessId, {
        description: "Flight Tickets",
        amount: new Decimal("20.00"),
        category: "travel",
      });
    });

    it("returns category breakdown with totals and counts", async () => {
      const breakdown = await expenseRepository.getCategoryBreakdown(businessId);
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].category).toBe("supplies");
      expect(breakdown[0].total).toBe("80.00");
      expect(breakdown[0].count).toBe(1);
      expect(breakdown[0].percentage).toBe(80);
      expect(breakdown[1].category).toBe("travel");
      expect(breakdown[1].percentage).toBe(20);
    });

    it("returns empty array when no expenses", async () => {
      const breakdown = await expenseRepository.getCategoryBreakdown("00000000-0000-0000-0000-000000000099");
      expect(breakdown).toHaveLength(0);
    });
  });

  describe("getMonthlyTrend", () => {
    it("returns monthly trend data", async () => {
      await expenseRepository.create(businessId, {
        description: "Test Expense",
        amount: new Decimal("100.00"),
        category: "supplies",
      });
      await expenseRepository.create(businessId, {
        description: "Another Expense",
        amount: new Decimal("50.00"),
        category: "travel",
      });

      const trend = await expenseRepository.getMonthlyTrend(businessId, 12);
      expect(trend.length).toBeGreaterThan(0);
      const currentMonth = trend[trend.length - 1];
      expect(currentMonth.amount).toBe("150.00");
      expect(currentMonth.count).toBe(2);
      expect(currentMonth.period).toMatch(/^\d{4}-\d{2}$/);
    });

    it("respects date range filters", async () => {
      await expenseRepository.create(businessId, {
        description: "Recent",
        amount: new Decimal("10.00"),
        category: "supplies",
      });

      const trend = await expenseRepository.getMonthlyTrend(businessId, 3, {
        dateFrom: new Date("2020-01-01"),
        dateTo: new Date("2020-01-31"),
      });
      expect(trend).toHaveLength(0);
    });
  });

  describe("getSummary", () => {
    it("returns summary with correct totals", async () => {
      await expenseRepository.create(businessId, {
        description: "Billable Expense",
        amount: new Decimal("100.00"),
        isBillable: true,
      });
      await expenseRepository.create(businessId, {
        description: "Non-billable",
        amount: new Decimal("50.00"),
        isBillable: false,
      });

      const summary = await expenseRepository.getSummary(businessId);
      expect(summary.totalAmount).toBe("150.00");
      expect(summary.billableAmount).toBe("100.00");
      expect(summary.count).toBe(2);
    });
  });
});
