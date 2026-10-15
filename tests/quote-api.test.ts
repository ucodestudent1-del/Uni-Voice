import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { truncateTestDb, createTestBusiness, createTestUser, createTestCustomer } from "./helpers/db.js";
import { generateToken } from "../src/middleware/auth.js";
import { quoteService } from "../src/services/quote-service.js";
import { NotFoundError, BusinessLogicError } from "../src/domain/errors.js";

const agent = request(app);

function authHeader(businessId: string, userId: string, email: string) {
  const token = generateToken(userId, businessId, email);
  return { Authorization: `Bearer ${token}` };
}

async function createTestQuote(
  businessId: string,
  customerId: string,
  options: { currency?: string } = {}
): Promise<Record<string, unknown>> {
  const currency = options.currency ?? "USD";
  const quote = await quoteService.create(businessId, {
    customerId,
    currency,
    items: [
      {
        description: "Test Product",
        quantity: 2,
        unit: "each",
        unitPrice: "100.00",
        taxRate: 0.1,
        taxName: "VAT",
      },
    ],
    fees: [
      {
        description: "Shipping",
        amount: "10.00",
        taxRate: 0.1,
        taxName: "VAT",
      },
    ],
  });

  return quote as Record<string, unknown>;
}

describe("Quote API (integration)", () => {
  let business: { id: string; ownerId: string };
  let user: { id: string; email: string };
  let headers: { Authorization: string };
  let customerId: string;
  let quoteId: string;

  beforeEach(async () => {
    await truncateTestDb();
    business = await createTestBusiness();
    user = await createTestUser({ businessId: business.id });
    headers = authHeader(business.id, user.id, user.email);
    customerId = await createTestCustomer(business.id, "Test Customer");

    const quote = await createTestQuote(business.id, customerId);
    quoteId = quote.id as string;
  });

  describe("POST /api/quotes", () => {
    it("creates a quote draft with items and fees", async () => {
      const res = await agent
        .post("/api/quotes")
        .set(headers)
        .send({
          customerId,
          currency: "USD",
          items: [
            {
              description: "Consulting Service",
              quantity: 3,
              unit: "hour",
              unitPrice: "150.00",
              taxRate: 0.1,
              taxName: "VAT",
            },
          ],
          fees: [
            {
              description: "Processing Fee",
              amount: "25.00",
              taxRate: 0.1,
              taxName: "VAT",
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.quote.status).toBe("draft");
      expect(res.body.quote.is_finalized).toBe(false);
      expect(res.body.quote.quote_number).toBeNull();
      expect(res.body.quote.items).toHaveLength(1);
      expect(res.body.quote.items[0].description).toBe("Consulting Service");
      expect(res.body.quote.fees).toHaveLength(1);
      expect(res.body.quote.fees[0].description).toBe("Processing Fee");
    });

    it("calculates totals correctly on creation", async () => {
      const res = await agent
        .post("/api/quotes")
        .set(headers)
        .send({
          customerId,
          currency: "USD",
          items: [
            {
              description: "Widget",
              quantity: 2,
              unit: "each",
              unitPrice: "50.00",
              taxRate: 0.1,
              taxName: "VAT",
            },
          ],
        });

      expect(res.status).toBe(201);
      const quote = res.body.quote;
      expect(quote.subtotal).toBe("100.00");
      expect(quote.tax_total).toBe("10.00");
      expect(quote.total).toBe("110.00");
      expect(quote.amount_due).toBe("0.00");
    });

    it("returns 400 when no business context", async () => {
      const res = await agent.post("/api/quotes").set({ Authorization: `Bearer ${generateToken(user.id)}` }).send({
        currency: "USD",
        items: [],
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/quotes", () => {
    it("returns empty list initially", async () => {
      await truncateTestDb();
      await createTestBusiness();
      const testUser = await createTestUser();
      const res = await agent
        .get("/api/quotes")
        .set(authHeader(business.id, testUser.id, testUser.email));

      expect(res.status).toBe(200);
      expect(res.body.quotes).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it("lists quotes with tenant isolation", async () => {
      const res = await agent
        .get("/api/quotes")
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.quotes).toHaveLength(1);
      expect(res.body.quotes[0].status).toBe("draft");
      expect(res.body.total).toBe(1);
    });

    it("supports search by quote number", async () => {
      const finalized = await quoteService.finalize(business.id, quoteId, user.id);
      const quoteNumber = finalized.quoteNumber;

      const res = await agent
        .get(`/api/quotes?search=${quoteNumber}`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.quotes).toHaveLength(1);
    });
  });

  describe("GET /api/quotes/:id", () => {
    it("returns a quote by id", async () => {
      const res = await agent.get(`/api/quotes/${quoteId}`).set(headers);

      expect(res.status).toBe(200);
      expect(res.body.quote.id).toBe(quoteId);
      expect(res.body.quote.items).toHaveLength(1);
      expect(res.body.quote.fees).toHaveLength(1);
    });

    it("returns 404 for non-existent quote", async () => {
      const res = await agent.get("/api/quotes/00000000-0000-0000-0000-000000000099").set(headers);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/quotes/:id", () => {
    it("updates quote fields", async () => {
      const res = await agent
        .patch(`/api/quotes/${quoteId}`)
        .set(headers)
        .send({
          notes: "Updated notes",
          terms: "Updated terms",
          internalNotes: "Internal note",
        });

      expect(res.status).toBe(200);
      expect(res.body.quote.notes).toBe("Updated notes");
      expect(res.body.quote.terms).toBe("Updated terms");
      expect(res.body.quote.internal_notes).toBe("Internal note");
    });

    it("recalculates totals when items change", async () => {
      const res = await agent
        .patch(`/api/quotes/${quoteId}`)
        .set(headers)
        .send({
          items: [
            {
              description: "New Item",
              quantity: 5,
              unit: "each",
              unitPrice: "20.00",
              taxRate: 0.1,
              taxName: "VAT",
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.quote.items[0].description).toBe("New Item");
      expect(res.body.quote.subtotal).toBe("100.00");
      expect(res.body.quote.tax_total).toBe("10.00");
      expect(res.body.quote.total).toBe("110.00");
    });

    it("rejects updating a finalized quote", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);

      const res = await agent
        .patch(`/api/quotes/${quoteId}`)
        .set(headers)
        .send({ notes: "cannot edit" });

      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/quotes/:id/finalize", () => {
    it("finalizes a draft quote and assigns a number", async () => {
      const res = await agent
        .post(`/api/quotes/${quoteId}/finalize`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.quoteNumber).toBeDefined();
      expect(res.body.quote.is_finalized).toBe(true);
      expect(res.body.quote.finalized_at).toBeDefined();
      expect(res.body.quote.quote_number).toBeDefined();
    });

    it("rejects finalizing a non-draft quote", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);

      const res = await agent
        .post(`/api/quotes/${quoteId}/finalize`)
        .set(headers);

      expect(res.status).toBe(422);
    });

    it("returns 404 for non-existent quote", async () => {
      const res = await agent
        .post("/api/quotes/00000000-0000-0000-0000-000000000099/finalize")
        .set(headers);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/quotes/:id/send", () => {
    it("sends a finalized quote", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);

      const res = await agent
        .post(`/api/quotes/${quoteId}/send`)
        .set(headers)
        .send({
          to: "customer@example.com",
          subject: "Test Quote",
          message: "Please review this quote",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messageId).toBeDefined();
      expect(res.body.status).toBe("sent");
      expect(res.body.quote).toBeDefined();
      expect(res.body.quote.sent_at).toBeDefined();
    });

    it("rejects sending a non-finalized quote", async () => {
      const res = await agent
        .post(`/api/quotes/${quoteId}/send`)
        .set(headers)
        .send({ to: "customer@example.com" });

      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/quotes/:id/accept", () => {
    it("accepts a sent quote", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);
      await quoteService.send(business.id, quoteId, { to: "customer@example.com" }, user.id);

      const res = await agent.post(`/api/quotes/${quoteId}/accept`).set(headers);

      expect(res.status).toBe(200);
      expect(res.body.quote.status).toBe("accepted");
      expect(res.body.quote.accepted_at).toBeDefined();
    });
  });

  describe("POST /api/quotes/:id/reject", () => {
    it("rejects a sent quote", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);
      await quoteService.send(business.id, quoteId, { to: "customer@example.com" }, user.id);

      const res = await agent.post(`/api/quotes/${quoteId}/reject`).set(headers);

      expect(res.status).toBe(200);
      expect(res.body.quote.status).toBe("rejected");
    });
  });

  describe("POST /api/quotes/:id/expire", () => {
    it("expires a sent quote", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);
      await quoteService.send(business.id, quoteId, { to: "customer@example.com" }, user.id);

      const res = await agent.post(`/api/quotes/${quoteId}/expire`).set(headers);

      expect(res.status).toBe(200);
      expect(res.body.quote.status).toBe("expired");
    });
  });

  describe("POST /api/quotes/:id/cancel", () => {
    it("cancels a draft quote with reason", async () => {
      const res = await agent
        .post(`/api/quotes/${quoteId}/cancel`)
        .set(headers)
        .send({ reason: "Customer requested cancellation" });

      expect(res.status).toBe(200);
      expect(res.body.quote.status).toBe("cancelled");
      expect(res.body.quote.cancelled_at).toBeDefined();
    });
  });

  describe("POST /api/quotes/:id/duplicate", () => {
    it("duplicates a quote", async () => {
      const res = await agent.post(`/api/quotes/${quoteId}/duplicate`).set(headers);

      expect(res.status).toBe(201);
      expect(res.body.quote.id).not.toBe(quoteId);
      expect(res.body.quote.status).toBe("draft");
      expect(res.body.quote.is_finalized).toBe(false);
      expect(res.body.quote.items).toHaveLength(1);
    });
  });

  describe("POST /api/quotes/:id/convert-to-invoice", () => {
    it("converts a quote to an invoice", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);

      const res = await agent
        .post(`/api/quotes/${quoteId}/convert-to-invoice`)
        .set(headers);

      expect(res.status).toBe(200);
      expect(res.body.invoiceId).toBeDefined();
      expect(res.body.quote.status).toBe("converted");
      expect(res.body.quote.converted_invoice_id).toBe(res.body.invoiceId);
    });

    it("rejects converting a non-finalized quote", async () => {
      const res = await agent
        .post(`/api/quotes/${quoteId}/convert-to-invoice`)
        .set(headers);

      expect(res.status).toBe(422);
    });
  });

  describe("GET /api/quotes/:id/pdf", () => {
    it("generates a PDF for a quote", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);

      const res = await agent.get(`/api/quotes/${quoteId}/pdf`).set(headers);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
    });
  });

  describe("GET /api/quotes/:id/share-link", () => {
    it("creates a share link for a quote", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);

      const res = await agent.get(`/api/quotes/${quoteId}/share-link`).set(headers);

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.url).toBeDefined();
      expect(res.body.expiresAt).toBeDefined();
    });

    it("returns existing share link on second call", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);

      const res1 = await agent.get(`/api/quotes/${quoteId}/share-link`).set(headers);
      const res2 = await agent.get(`/api/quotes/${quoteId}/share-link`).set(headers);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.token).toBe(res2.body.token);
    });
  });

  describe("GET /api/quotes/:id/events", () => {
    it("returns events for a quote", async () => {
      const res = await agent.get(`/api/quotes/${quoteId}/events`).set(headers);

      expect(res.status).toBe(200);
      expect(res.body.events).toBeDefined();
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBeGreaterThan(0);
    });

    it("logs events during lifecycle", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);
      await agent.post(`/api/quotes/${quoteId}/finalize`).set(headers);

      const res = await agent.get(`/api/quotes/${quoteId}/events`).set(headers);

      expect(res.status).toBe(200);
      const eventTypes = res.body.events.map((e: { event_type: string }) => e.event_type);
      expect(eventTypes).toContain("quote_created");
      expect(eventTypes).toContain("quote_finalized");
      expect(eventTypes).toContain("quote_number_assigned");
    });
  });

  describe("GET /api/public/quote/:token", () => {
    it("returns a quote by public token", async () => {
      await quoteService.finalize(business.id, quoteId, user.id);
      const link = await quoteService.createShareLink(business.id, quoteId);

      const res = await agent.get(`/api/public/quote/${link.token}`);

      expect(res.status).toBe(200);
      expect(res.body.quote.id).toBe(quoteId);
      expect(res.body.quote.business).toBeDefined();
    });

    it("returns 404 for invalid token", async () => {
      const res = await agent.get("/api/public/quote/invalid-token");
      expect(res.status).toBe(404);
    });
  });

  describe("State machine", () => {
    it("does not allow transitioning from draft to accepted directly", async () => {
      const res = await agent.post(`/api/quotes/${quoteId}/accept`).set(headers);
      expect(res.status).toBe(422);
    });

    it("does not allow transitioning from cancelled to accepted", async () => {
      await quoteService.cancel(business.id, quoteId, "test", user.id);

      const res = await agent.post(`/api/quotes/${quoteId}/accept`).set(headers);
      expect(res.status).toBe(422);
    });
  });
});
