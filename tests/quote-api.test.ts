import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { truncateTestDb, createTestBusiness, createTestUser, createTestCustomer, createTestSubscription } from "./helpers/db.js";
import { generateToken } from "../src/middleware/auth.js";
import { query } from "../src/db/pool.js";

const agent = request(app);

function authHeader(businessId: string, userId: string, email: string) {
  const token = generateToken(userId, businessId, email);
  return { Authorization: `Bearer ${token}` };
}

describe("Quote API (integration)", () => {
  let business: { id: string; ownerId: string };
  let headers: { Authorization: string };
  let customerId: string;

  beforeEach(async () => {
    await truncateTestDb();
    business = await createTestBusiness();
    const user = await createTestUser({ businessId: business.id });
    headers = authHeader(business.id, user.id, user.email);
    customerId = await createTestCustomer(business.id, "Acme Corp");
    await createTestSubscription(business.id, "pro");
  });

  describe("POST /api/quotes", () => {
    it("creates a draft quote", async () => {
      const res = await agent.post("/api/quotes").set(headers).send({
        customerId,
        currency: "USD",
        items: [
          { description: "Consulting hours", quantity: 10, unitPrice: 100, taxRate: 0.1 },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.quoteId).toBeDefined();
    });

    it("creates a quote with deposit configuration", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId,
        currency: "USD",
        items: [{ description: "Work", quantity: 1, unitPrice: 1000 }],
        depositType: "percentage",
        depositValue: 50,
      });
      expect(createRes.status).toBe(201);

      const res = await agent.get(`/api/quotes/${createRes.body.quoteId}`).set(headers);
      expect(res.body.quote.depositType).toBe("percentage");
      expect(parseFloat(res.body.quote.depositValue)).toBe(50);
    });

    it("creates a quote with scope of work", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId,
        currency: "USD",
        items: [{ description: "Work", quantity: 1, unitPrice: 1000 }],
        scopeOfWork: "Phase 1: discovery and design. Phase 2: implementation.",
      });
      expect(createRes.status).toBe(201);

      const res = await agent.get(`/api/quotes/${createRes.body.quoteId}`).set(headers);
      expect(res.body.quote.scopeOfWork).toBe("Phase 1: discovery and design. Phase 2: implementation.");
    });

    it("returns 401 without auth", async () => {
      const res = await agent.post("/api/quotes").send({
        currency: "USD",
        items: [],
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/quotes", () => {
    it("returns quotes scoped to business", async () => {
      await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
      });
      const res = await agent.get("/api/quotes").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.quotes).toHaveLength(1);
      expect(res.body.quotes[0].currency).toBe("USD");
    });

    it("supports status filter", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
      });
      await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);

      const res = await agent.get("/api/quotes").set(headers).query({ status: "sent" });
      expect(res.body.quotes).toHaveLength(1);
      expect(res.body.quotes[0].status).toBe("sent");
    });
  });

  describe("GET /api/quotes/:id", () => {
    it("returns 404 for non-existent quote", async () => {
      const res = await agent.get("/api/quotes/00000000-0000-0000-0000-000000000099").set(headers);
      expect(res.status).toBe(404);
    });

    it("returns the quote with items", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 2, unitPrice: 50 }],
      });
      const res = await agent.get(`/api/quotes/${createRes.body.quoteId}`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.quote.items).toHaveLength(1);
      expect(res.body.quote.items[0].description).toBe("A");
    });
  });

  describe("finalize + accept/reject lifecycle", () => {
    it("finalizes a draft quote and generates a quote number", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
      });
      const res = await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.quoteNumber).toMatch(/^QOT-/);
    });

    it("accepts a sent quote", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
      });
      await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
      const res = await agent.post(`/api/quotes/${createRes.body.quoteId}/accept`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // Verify via GET that status changed
      const getRes = await agent.get(`/api/quotes/${createRes.body.quoteId}`).set(headers);
      expect(getRes.body.quote.status).toBe("accepted");
    });

    it("rejects a sent quote", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
      });
      await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
      const res = await agent.post(`/api/quotes/${createRes.body.quoteId}/reject`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const getRes = await agent.get(`/api/quotes/${createRes.body.quoteId}`).set(headers);
      expect(getRes.body.quote.status).toBe("rejected");
    });

    it("does not allow accepting a draft quote", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
      });
      const res = await agent.post(`/api/quotes/${createRes.body.quoteId}/accept`).set(headers);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/quotes/:id/pdf", () => {
    it("generates PDF for a finalized quote", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
      });
      await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
      const res = await agent.get(`/api/quotes/${createRes.body.quoteId}/pdf`).set(headers);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
    });
  });

  describe("POST /api/quotes/:id/convert", () => {
    it("converts a finalized quote to an invoice", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
      });
      await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
      const res = await agent.post(`/api/quotes/${createRes.body.quoteId}/convert`).set(headers);
      expect(res.status).toBe(201);
      expect(res.body.invoiceId).toBeDefined();
      expect(res.body.quoteNumber).toBeDefined();
    });
  });

  describe("POST /api/quotes/:id/send", () => {
    it("sends a finalized quote and returns public token", async () => {
      const createRes = await agent.post("/api/quotes").set(headers).send({
        customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
      });
      await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
      const res = await agent.post(`/api/quotes/${createRes.body.quoteId}/send`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(true);
      expect(res.body.publicToken).toBeDefined();
    });
  });
});

describe("Public Quote API (integration)", () => {
  let business: { id: string; ownerId: string };
  let headers: { Authorization: string };
  let customerId: string;

  beforeEach(async () => {
    await truncateTestDb();
    business = await createTestBusiness();
    const user = await createTestUser({ businessId: business.id });
    headers = authHeader(business.id, user.id, user.email);
    customerId = await createTestCustomer(business.id, "Acme Corp");
    await createTestSubscription(business.id, "pro");
  });

  it("GET /api/public/quotes/:token returns HTML", async () => {
    const createRes = await agent.post("/api/quotes").set(headers).send({
      customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
    });
    await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
    const sendRes = await agent.post(`/api/quotes/${createRes.body.quoteId}/send`).set(headers);
    const token = sendRes.body.publicToken;

    const res = await agent.get(`/api/public/quotes/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.html).toContain("QOT-2026");
    expect(res.body.html).toContain("Estimated Total");
  });

  it("POST /api/public/quotes/:token/accept accepts the quote", async () => {
    const createRes = await agent.post("/api/quotes").set(headers).send({
      customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
    });
    await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
    const sendRes = await agent.post(`/api/quotes/${createRes.body.quoteId}/send`).set(headers);
    const token = sendRes.body.publicToken;

    const res = await agent.post(`/api/public/quotes/${token}/accept`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /api/public/quotes/:token/reject rejects the quote", async () => {
    const createRes = await agent.post("/api/quotes").set(headers).send({
      customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
    });
    await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
    const sendRes = await agent.post(`/api/quotes/${createRes.body.quoteId}/send`).set(headers);
    const token = sendRes.body.publicToken;

    const res = await agent.post(`/api/public/quotes/${token}/reject`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /api/public/quotes/:token/deposit records a deposit payment", async () => {
    const createRes = await agent.post("/api/quotes").set(headers).send({
      customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 1000 }],
      depositType: "percentage", depositValue: 50,
    });
    await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
    const sendRes = await agent.post(`/api/quotes/${createRes.body.quoteId}/send`).set(headers);
    const token = sendRes.body.publicToken;

    const res = await agent.post(`/api/public/quotes/${token}/deposit`).send({ amount: 500 });
    expect(res.status).toBe(200);
    expect(parseFloat(res.body.remainingDeposit)).toBe(0);
    expect(res.body.depositPaid).toBe(true);
  });

  it("GET /api/public/quotes/:token/pdf returns a PDF", async () => {
    const createRes = await agent.post("/api/quotes").set(headers).send({
      customerId, currency: "USD", items: [{ description: "A", quantity: 1, unitPrice: 100 }],
    });
    await agent.post(`/api/quotes/${createRes.body.quoteId}/finalize`).set(headers);
    const sendRes = await agent.post(`/api/quotes/${createRes.body.quoteId}/send`).set(headers);
    const token = sendRes.body.publicToken;

    const res = await agent.get(`/api/public/quotes/${token}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
  });
});
