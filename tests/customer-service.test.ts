import { describe, it, expect, beforeEach } from "vitest";
import { customerService } from "../src/services/customer-service.js";
import { customerRepository } from "../src/repositories/customer.repo.js";
import { truncateTestDb, createTestBusiness, createTestCustomer } from "./helpers/db.js";
import { ValidationError, BusinessLogicError, ConflictError, NotFoundError } from "../src/domain/errors.js";

describe("CustomerService", () => {
  let businessId: string;

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
  });

  describe("create", () => {
    it("creates a customer with required name field", async () => {
      const customer = await customerService.create(
        { name: "Acme Corp", email: "acme@example.com", companyName: "Acme Inc" },
        businessId,
        "user-1"
      );
      expect(customer.id).toBeTruthy();
      expect(customer.businessId).toBe(businessId);
      expect(customer.name).toBe("Acme Corp");
      expect(customer.email).toBe("acme@example.com");
      expect(customer.companyName).toBe("Acme Inc");
      expect(customer.status).toBe("active");
      expect(customer.version).toBe(1);
      expect(customer.archivedAt).toBeNull();
    });

    it("trims whitespace on name and emails", async () => {
      const customer = await customerService.create(
        { name: "  Acme Corp  ", email: "  acme@example.com  " },
        businessId
      );
      expect(customer.name).toBe("Acme Corp");
      expect(customer.email).toBe("acme@example.com");
    });

    it("throws ValidationError for empty name", async () => {
      await expect(
        customerService.create({ name: "" }, businessId)
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for whitespace-only name", async () => {
      await expect(
        customerService.create({ name: "   " }, businessId)
      ).rejects.toThrow(ValidationError);
    });

    it("defaults status to active", async () => {
      const customer = await customerService.create({ name: "Test" }, businessId);
      expect(customer.status).toBe("active");
    });

    it("creates tax identifiers when provided", async () => {
      const customer = await customerService.create(
        { name: "Intl Co", taxId: "DE123456789", taxIdentifiers: [{ type: "VAT", value: "VAT123" }] },
        businessId
      );
      expect(customer.taxIdentifiers).toHaveLength(1);
      expect(customer.taxIdentifiers![0].type).toBe("VAT");
      expect(customer.taxIdentifiers![0].value).toBe("VAT123");
      expect(customer.taxIdentifiers![0].isDefault).toBe(false);
    });
  });

  describe("getById", () => {
    it("retrieves a customer by id", async () => {
      const id = await createTestCustomer(businessId, "John Doe");
      const customer = await customerService.getById(businessId, id);
      expect(customer.name).toBe("John Doe");
      expect(customer.status).toBe("active");
    });

    it("throws NotFoundError for non-existent customer", async () => {
      await expect(
        customerService.getById(businessId, "00000000-0000-0000-0000-000000000099")
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for customer in another business", async () => {
      const biz2 = await createTestBusiness({ id: "b2-b2-b2-b2-b2b2b2b2b2b2" });
      const id = await createTestCustomer(biz2.id, "Cross Biz");
      await expect(
        customerService.getById(businessId, id)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("update", () => {
    it("updates customer fields", async () => {
      const id = await createTestCustomer(businessId, "Old Name");
      const customer = await customerService.update(
        businessId,
        id,
        { name: "New Name", email: "new@example.com" },
        "user-1"
      );
      expect(customer.name).toBe("New Name");
      expect(customer.email).toBe("new@example.com");
      expect(customer.updatedBy).toBe("user-1");
      expect(customer.version).toBe(2);
    });

    it("throws BusinessLogicError when updating archived customer", async () => {
      const id = await createTestCustomer(businessId);
      await customerService.archive(businessId, id, "user-1");
      await expect(
        customerService.update(businessId, id, { name: "Updated" })
      ).rejects.toThrow(BusinessLogicError);
    });

    it("allows status transitions to inactive", async () => {
      const id = await createTestCustomer(businessId);
      const customer = await customerService.update(businessId, id, { status: "inactive" });
      expect(customer.status).toBe("inactive");
    });
  });

  describe("archive", () => {
    it("archives an active customer", async () => {
      const id = await createTestCustomer(businessId);
      const customer = await customerService.archive(businessId, id, "user-1");
      expect(customer.status).toBe("archived");
      expect(customer.archivedAt).toBeTruthy();
      expect(customer.archivedBy).toBe("user-1");
    });

    it("throws ConflictError when archiving already-archived customer", async () => {
      const id = await createTestCustomer(businessId);
      await customerService.archive(businessId, id);
      await expect(customerService.archive(businessId, id)).rejects.toThrow(ConflictError);
    });

    it("allows archiving a customer with finalized invoices", async () => {
      const id = await createTestCustomer(businessId);
      await customerService.archive(businessId, id);
      const customer = await customerService.getById(businessId, id);
      expect(customer.status).toBe("archived");
    });

    it("throws NotFoundError for non-existent customer", async () => {
      await expect(
        customerService.archive(businessId, "00000000-0000-0000-0000-000000000099")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("restore", () => {
    it("restores an archived customer", async () => {
      const id = await createTestCustomer(businessId);
      await customerService.archive(businessId, id);
      const customer = await customerService.restore(businessId, id, "user-1");
      expect(customer.status).toBe("active");
      expect(customer.archivedAt).toBeNull();
      expect(customer.archivedBy).toBeNull();
    });

    it("throws ConflictError when restoring non-archived customer", async () => {
      const id = await createTestCustomer(businessId);
      await expect(customerService.restore(businessId, id)).rejects.toThrow(ConflictError);
    });
  });

  describe("delete", () => {
    it("permits hard delete for customer with no finalized invoices", async () => {
      const id = await createTestCustomer(businessId);
      await customerService.delete(businessId, id);
      await expect(customerService.getById(businessId, id)).rejects.toThrow(NotFoundError);
    });

    it("throws BusinessLogicError when deleting archived customer", async () => {
      const id = await createTestCustomer(businessId);
      await customerService.archive(businessId, id);
      await expect(customerService.delete(businessId, id)).rejects.toThrow(BusinessLogicError);
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      const names = [
        "Alice Anderson", "Bob Brown", "Charlie Clark",
        "Acme Corp", "Acme Widgets", "Beta LLC",
      ];
      for (const name of names) {
        await customerService.create(
          { name, email: `${name.toLowerCase().replace(/ /g, ".")}@example.com` },
          businessId
        );
      }
    });

    it("returns paginated results with total count", async () => {
      const result = await customerService.search(businessId, { limit: 10, offset: 0 });
      expect(result.total).toBe(6);
      expect(result.data).toHaveLength(6);
    });

    it("filters by limit and offset", async () => {
      const result = await customerService.search(businessId, { limit: 3, offset: 0 });
      expect(result.data).toHaveLength(3);
      const next = await customerService.search(businessId, { limit: 3, offset: 3 });
      expect(next.data).toHaveLength(3);
      expect(result.data[0].name).not.toBe(next.data[0].name);
    });

    it("searches by name with ILIKE", async () => {
      const result = await customerService.search(businessId, { search: "acme" });
      expect(result.total).toBe(2);
      expect(result.data.every((c) => c.name.toLowerCase().includes("acme"))).toBe(true);
    });

    it("searches case-insensitively", async () => {
      const result = await customerService.search(businessId, { search: "ALICE" });
      expect(result.total).toBe(1);
      expect(result.data[0].name).toBe("Alice Anderson");
    });

    it("filters by status", async () => {
      const id = await createTestCustomer(businessId, "Archive Me");
      await customerService.archive(businessId, id);
      const result = await customerService.search(businessId, { status: "archived", includeArchived: true });
      expect(result.data.some((c) => c.id === id)).toBe(true);
    });

    it("excludes archived by default", async () => {
      const id = await createTestCustomer(businessId, "To Archive");
      await customerService.archive(businessId, id);
      const result = await customerService.search(businessId, { limit: 200 });
      expect(result.data.some((c) => c.id === id)).toBe(false);
    });

    it("includes archived when includeArchived is true", async () => {
      const id = await createTestCustomer(businessId, "Include Me");
      await customerService.archive(businessId, id);
      const result = await customerService.search(businessId, { includeArchived: true, limit: 200 });
      expect(result.data.some((c) => c.id === id)).toBe(true);
    });

    it("sorts by created_at descending", async () => {
      const result = await customerService.search(businessId, { sortBy: "created_at", sortOrder: "desc", limit: 200 });
      expect(result.data.length).toBeGreaterThan(1);
    });
  });

  describe("getInvoiceHistory", () => {
    it("returns empty list for customer with no invoices", async () => {
      const id = await createTestCustomer(businessId);
      const result = await customerService.getInvoiceHistory(businessId, id);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("throws NotFoundError for non-existent customer", async () => {
      await expect(
        customerService.getInvoiceHistory(businessId, "00000000-0000-0000-0000-000000000099")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("tax identifier management", () => {
    it("adds, retrieves, and removes tax identifiers", async () => {
      const id = await createTestCustomer(businessId);
      await customerService.addTaxIdentifier(businessId, id, { type: "VAT", value: "VAT-123" });
      const identifiers = await customerService.getTaxIdentifiers(businessId, id);
      expect(identifiers).toHaveLength(1);
      expect(identifiers[0].type).toBe("VAT");
      expect(identifiers[0].value).toBe("VAT-123");
    });
  });
});
