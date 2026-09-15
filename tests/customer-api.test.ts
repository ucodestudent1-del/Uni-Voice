import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { resetTestDb, createTestBusiness, createTestUser } from "./helpers/db.js";
import { generateToken } from "../src/middleware/auth.js";
import { query } from "../src/db/pool.js";

const agent = request(app);

function authHeader(businessId: string, userId: string, email: string) {
  const token = generateToken(userId, businessId, email);
  return { Authorization: `Bearer ${token}` };
}

describe("Customer API (integration)", () => {
  let business: { id: string; ownerId: string };
  let headers: { Authorization: string };

  beforeEach(async () => {
    await resetTestDb();
    business = await createTestBusiness();
    const user = await createTestUser({ businessId: business.id });
    headers = authHeader(business.id, user.id, user.email);
  });

  describe("GET /api/customers", () => {
    it("returns 401 without auth token", async () => {
      const res = await agent.get("/api/customers");
      expect(res.status).toBe(401);
    });

    it("returns empty list for new business", async () => {
      const res = await agent.get("/api/customers").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });

    it("lists customers scoped to the authenticated business", async () => {
      await agent.post("/api/customers").set(headers).send({ name: "Customer A" });
      const res = await agent.get("/api/customers").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Customer A");
      expect(res.body.data[0].businessId).toBe(business.id);
    });

    it("returns 400 without business context", async () => {
      const token = generateToken("user-no-biz", undefined, "no-biz@example.com");
      const res = await agent.get("/api/customers").set({ Authorization: `Bearer ${token}` });
      expect(res.status).toBe(400);
    });

    it("supports search param", async () => {
      await agent.post("/api/customers").set(headers).send({ name: "Alpha" });
      await agent.post("/api/customers").set(headers).send({ name: "Beta" });
      const res = await agent.get("/api/customers").set(headers).query({ search: "alpha" });
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].name).toBe("Alpha");
    });

    it("supports status filter", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "To Archive" });
      const id = body.customer.id;
      await agent.post(`/api/customers/${id}/archive`).set(headers);
      const res = await agent.get("/api/customers").set(headers).query({ status: "archived", includeArchived: true });
      expect(res.body.data.some((c: any) => c.id === id)).toBe(true);
    });

    it("supports pagination params", async () => {
      for (let i = 0; i < 5; i++) {
        await agent.post("/api/customers").set(headers).send({ name: `Cust ${i}` });
      }
      const res = await agent.get("/api/customers").set(headers).query({ limit: 3, offset: 0 });
      expect(res.body.data).toHaveLength(3);
      expect(res.body.limit).toBe(3);
      expect(res.body.total).toBe(5);
    });
  });

  describe("POST /api/customers", () => {
    it("creates a customer and returns 201", async () => {
      const res = await agent.post("/api/customers").set(headers).send({
        name: "New Customer",
        email: "new@example.com",
        phone: "555-1234",
        companyName: "New Co",
      });
      expect(res.status).toBe(201);
      expect(res.body.customer.name).toBe("New Customer");
      expect(res.body.customer.email).toBe("new@example.com");
      expect(res.body.customer.status).toBe("active");
    });

    it("returns 400 when name is missing", async () => {
      const res = await agent.post("/api/customers").set(headers).send({});
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid email", async () => {
      const res = await agent.post("/api/customers").set(headers).send({ name: "Test", email: "not-an-email" });
      expect(res.status).toBe(400);
    });

    it("isolates customers per business (tenant isolation)", async () => {
      await agent.post("/api/customers").set(headers).send({ name: "Biz1 Customer" });
      const biz2 = await createTestBusiness({ id: "biz2-biz2-biz2-biz2-biz2b2b2b" });
      const user2 = await createTestUser({ id: "user2-id", email: "user2@test.com", businessId: biz2.id });
      const headers2 = authHeader(biz2.id, user2.id, user2.email);
      const res = await agent.get("/api/customers").set(headers2);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("GET /api/customers/:id", () => {
    it("returns customer by id", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "Detail Customer" });
      const res = await agent.get(`/api/customers/${body.customer.id}`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.customer.name).toBe("Detail Customer");
    });

    it("returns 404 for non-existent customer", async () => {
      const res = await agent.get("/api/customers/00000000-0000-0000-0000-000000000099").set(headers);
      expect(res.status).toBe(404);
    });

    it("returns 404 for customer in another business", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "Other Biz Customer" });
      const biz2 = await createTestBusiness({ id: "biz2-again", name: "B2" });
      const user2 = await createTestUser({ id: "user2-again", email: "user2-again@test.com", businessId: biz2.id });
      const headers2 = authHeader(biz2.id, user2.id, user2.email);
      const res = await agent.get(`/api/customers/${body.customer.id}`).set(headers2);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/customers/:id", () => {
    it("updates customer fields", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "Original" });
      const res = await agent.patch(`/api/customers/${body.customer.id}`).set(headers).send({ name: "Updated", email: "updated@example.com" });
      expect(res.status).toBe(200);
      expect(res.body.customer.name).toBe("Updated");
      expect(res.body.customer.email).toBe("updated@example.com");
      expect(res.body.customer.updatedBy).toBeTruthy();
    });

    it("returns 404 for non-existent customer", async () => {
      const res = await agent.patch("/api/customers/00000000-0000-0000-0000-000000000099").set(headers).send({ name: "X" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/customers/:id (archive)", () => {
    it("archives customer instead of hard-deleting", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "To Delete" });
      const res = await agent.delete(`/api/customers/${body.customer.id}`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.archived).toBe(true);
      const getRes = await agent.get(`/api/customers/${body.customer.id}`).set(headers);
      expect(getRes.body.customer.status).toBe("archived");
    });
  });

  describe("POST /api/customers/:id/archive", () => {
    it("archives a customer", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "Archive Target" });
      const res = await agent.post(`/api/customers/${body.customer.id}/archive`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.customer.status).toBe("archived");
    });

    it("returns 409 when already archived", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "Already Archived" });
      await agent.post(`/api/customers/${body.customer.id}/archive`).set(headers);
      const res = await agent.post(`/api/customers/${body.customer.id}/archive`).set(headers);
      expect(res.status).toBe(409);
    });

    it("returns 404 for non-existent customer", async () => {
      const res = await agent.post("/api/customers/00000000-0000-0000-0000-000000000099/archive").set(headers);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/customers/:id/restore", () => {
    it("restores an archived customer", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "Restore Me" });
      await agent.post(`/api/customers/${body.customer.id}/archive`).set(headers);
      const res = await agent.post(`/api/customers/${body.customer.id}/restore`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.customer.status).toBe("active");
      expect(res.body.customer.archivedAt).toBeNull();
    });

    it("returns 409 when customer is not archived", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "Not Archived" });
      const res = await agent.post(`/api/customers/${body.customer.id}/restore`).set(headers);
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/customers/:id/invoices", () => {
    it("returns empty invoice list for new customer", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "No Invoices" });
      const res = await agent.get(`/api/customers/${body.customer.id}/invoices`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });

  describe("GET /api/customers/:id/summary", () => {
    it("returns customer summary with invoice stats", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "Summary Customer" });
      const res = await agent.get(`/api/customers/${body.customer.id}/summary`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.summary.customer.name).toBe("Summary Customer");
      expect(res.body.summary.totalInvoiceCount).toBe(0);
      expect(res.body.summary.finalizedInvoiceCount).toBe(0);
    });
  });

  describe("GET /api/customers/:id/events", () => {
    it("returns audit events for a customer", async () => {
      const { body } = await agent.post("/api/customers").set(headers).send({ name: "Event Customer" });
      await agent.post(`/api/customers/${body.customer.id}/archive`).set(headers);
      const res = await agent.get(`/api/customers/${body.customer.id}/events`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThan(0);
      const eventTypes = res.body.events.map((e: any) => e.event_type);
      expect(eventTypes).toContain("created");
      expect(eventTypes).toContain("archived");
    });
  });

  describe("GET /api/customers/:id/invoices with actual invoices", () => {
    it("returns finalized invoices linked to the customer", async () => {
      const { body: custBody } = await agent.post("/api/customers").set(headers).send({ name: "Invoice Customer" });
      const customerId = custBody.customer.id;

      const { body: invBody } = await agent.post("/api/invoices").set(headers).send({
        customerId,
        currency: "USD",
        notes: "Test invoice",
      });
      const invoiceId = invBody.invoiceId;

      await agent.post(`/api/invoices/${invoiceId}/finalize`).set(headers);

      const res = await agent.get(`/api/customers/${customerId}/invoices`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].invoiceNumber).toBeTruthy();
      expect(res.body.data[0].finalizedAt).toBeTruthy();
    });
  });
});
