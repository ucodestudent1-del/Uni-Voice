import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { truncateTestDb, createTestBusiness, createTestUser, createTestCustomer } from "./helpers/db.js";
import { generateToken } from "../src/middleware/auth.js";
import { invoiceService } from "../src/services/invoice-service.js";
import { NotFoundError, BusinessLogicError } from "../src/domain/errors.js";

const agent = request(app);

function authHeader(businessId: string, userId: string, email: string) {
  const token = generateToken(userId, businessId, email);
  return { Authorization: `Bearer ${token}` };
}

async function createTestInvoiceWithItems(
  businessId: string,
  customerId: string,
  options: { currency?: string } = {}
): Promise<Record<string, unknown>> {
  const currency = options.currency ?? "USD";
  const invoice = await invoiceService.create(businessId, {
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
  });

  return invoice as Record<string, unknown>;
}

describe("Credit Note API (integration)", () => {
  let business: { id: string; ownerId: string };
  let user: { id: string; email: string };
  let headers: { Authorization: string };
  let invoiceId: string;

  beforeEach(async () => {
    await truncateTestDb();
    business = await createTestBusiness();
    user = await createTestUser({ businessId: business.id });
    headers = authHeader(business.id, user.id, user.email);

    const customerId = await createTestCustomer(business.id, "Test Customer");
    const invoice = await createTestInvoiceWithItems(business.id, customerId);
    invoiceId = invoice.id as string;
  });

  describe("POST /api/credit-notes/draft", () => {
    it("creates a credit note draft with items", async () => {
      const res = await agent
        .post("/api/credit-notes/draft")
        .set(headers)
        .send({
          invoiceId,
          reason: "Return due to damage",
          items: [
            {
              description: "Returned Product",
              quantity: 1,
              unit: "each",
              unitPrice: "100.00",
              taxRate: 0.1,
              taxName: "VAT",
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.creditNote.status).toBe("draft");
      expect(res.body.creditNote.is_finalized).toBe(false);
      expect(res.body.creditNote.reason).toBe("Return due to damage");

      const cnRes = await agent.get(`/api/credit-notes/${res.body.creditNote.id}`).set(headers);
      expect(cnRes.body.creditNote.items).toHaveLength(1);
      expect(cnRes.body.creditNote.items[0].description).toBe("Returned Product");
    });

    it("calculates totals correctly in draft", async () => {
      const res = await agent
        .post("/api/credit-notes/draft")
        .set(headers)
        .send({
          invoiceId,
          items: [
            {
              description: "Product A",
              quantity: 2,
              unit: "each",
              unitPrice: "100.00",
              taxRate: 0.1,
              taxName: "VAT",
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(parseFloat(res.body.creditNote.subtotal)).toBeCloseTo(200, 2);
      expect(parseFloat(res.body.creditNote.tax_total)).toBeCloseTo(20, 2);
      expect(parseFloat(res.body.creditNote.total)).toBeCloseTo(220, 2);
      expect(parseFloat(res.body.creditNote.amount_due)).toBeCloseTo(220, 2);
    });

    it("returns 404 when reference invoice does not exist", async () => {
      const res = await agent
        .post("/api/credit-notes/draft")
        .set(headers)
        .send({
          invoiceId: "00000000-0000-0000-0000-000000000099",
          items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
        });

      expect(res.status).toBe(404);
    });

    it("returns 400 without business context", async () => {
      const token = generateToken("user-no-biz", undefined, "no-biz@example.com");
      const res = await agent
        .post("/api/credit-notes/draft")
        .set({ Authorization: `Bearer ${token}` })
        .send({ invoiceId, items: [] });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/credit-notes", () => {
    it("creates a finalized credit note directly with a number", async () => {
      const res = await agent
        .post("/api/credit-notes")
        .set(headers)
        .send({
          invoiceId,
          reason: "Partial refund",
          items: [
            {
              description: "Refunded Item",
              quantity: 1,
              unit: "each",
              unitPrice: "50.00",
              taxRate: 0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.creditNote.status).toBe("finalized");
      expect(res.body.creditNote.is_finalized).toBe(true);
      expect(res.body.creditNote.credit_note_number).toBeTruthy();
    });

    it("logs a credit_note_created event with finalized status", async () => {
      const res = await agent
        .post("/api/credit-notes")
        .set(headers)
        .send({
          invoiceId,
          reason: "Full refund",
          items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "100.00", taxRate: 0 }],
        });

      const cnId = res.body.creditNote.id;
      const eventsRes = await agent.get(`/api/credit-notes/${cnId}/events`).set(headers);
      const events = eventsRes.body.events;
      expect(events).toContainEqual(
        expect.objectContaining({ event_type: "credit_note_created" })
      );
    });
  });

  describe("GET /api/credit-notes", () => {
    it("returns empty list initially", async () => {
      const res = await agent.get("/api/credit-notes").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.creditNotes).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });

    it("lists credit notes with tenant isolation", async () => {
      await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      const biz2 = await createTestBusiness({
        id: "00000000-0000-0000-0000-000000000002",
        ownerId: "11111111-1111-1111-1111-111111111112",
      });
      const user2 = await createTestUser({
        id: "11111111-1111-1111-1111-111111111112",
        email: "user2@test.com",
        businessId: biz2.id,
      });
      const headers2 = authHeader(biz2.id, user2.id, user2.email);

      const res2 = await agent.get("/api/credit-notes").set(headers2);
      expect(res2.body.creditNotes).toHaveLength(0);
    });

    it("filters by status", async () => {
      await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      const resDraft = await agent.get("/api/credit-notes").set(headers).query({ status: "draft" });
      expect(resDraft.body.total).toBe(0);

      const resFinalized = await agent.get("/api/credit-notes").set(headers).query({ status: "finalized" });
      expect(resFinalized.body.total).toBe(1);
    });

    it("supports search by credit note number", async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      const cnNumber = createRes.body.creditNote.credit_note_number;

      const res = await agent.get("/api/credit-notes").set(headers).query({ search: cnNumber });
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it("supports pagination", async () => {
      for (let i = 0; i < 3; i++) {
        await agent.post("/api/credit-notes").set(headers).send({
          invoiceId,
          items: [{ description: `Item ${i}`, quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
        });
      }

      const res = await agent.get("/api/credit-notes").set(headers).query({ limit: 2, offset: 0 });
      expect(res.body.creditNotes).toHaveLength(2);
      expect(res.body.total).toBe(3);
      expect(res.body.limit).toBe(2);
    });
  });

  describe("GET /api/credit-notes/:id", () => {
    let cnId: string;

    beforeEach(async () => {
      const res = await agent
        .post("/api/credit-notes/draft")
        .set(headers)
        .send({
          invoiceId,
          reason: "Test reason",
          items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
        });
      cnId = res.body.creditNote.id;
    });

    it("returns a credit note by id", async () => {
      const res = await agent.get(`/api/credit-notes/${cnId}`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.creditNote.id).toBe(cnId);
      expect(res.body.creditNote.reason).toBe("Test reason");
    });

    it("returns 404 for non-existent credit note", async () => {
      const res = await agent
        .get("/api/credit-notes/00000000-0000-0000-0000-000000000099")
        .set(headers);
      expect(res.status).toBe(404);
    });

    it("returns 404 for credit note in another business", async () => {
      const biz2 = await createTestBusiness({
        id: "00000000-0000-0000-0000-000000000002",
        ownerId: "11111111-1111-1111-1111-111111111112",
      });
      const user2 = await createTestUser({
        id: "11111111-1111-1111-1111-111111111112",
        email: "user2@test.com",
        businessId: biz2.id,
      });
      const headers2 = authHeader(biz2.id, user2.id, user2.email);

      const res = await agent.get(`/api/credit-notes/${cnId}`).set(headers2);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/credit-notes/:id/events", () => {
    it("returns events for a credit note", async () => {
      const draftRes = await agent
        .post("/api/credit-notes/draft")
        .set(headers)
        .send({
          invoiceId,
          items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
        });
      const cnId = draftRes.body.creditNote.id;

      await agent.patch(`/api/credit-notes/${cnId}/finalize`).set(headers);

      const res = await agent.get(`/api/credit-notes/${cnId}/events`).set(headers);
      expect(res.status).toBe(200);
      const eventTypes = res.body.events.map((e: { event_type: string }) => e.event_type);
      expect(eventTypes).toContain("credit_note_created");
      expect(eventTypes).toContain("credit_note_finalized");
    });

    it("returns empty events for non-existent credit note", async () => {
      const res = await agent
        .get("/api/credit-notes/00000000-0000-0000-0000-000000000099/events")
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });

  describe("PATCH /api/credit-notes/:id/finalize", () => {
    it("finalizes a draft credit note and assigns a number", async () => {
      const draftRes = await agent
        .post("/api/credit-notes/draft")
        .set(headers)
        .send({
          invoiceId,
          reason: "Return",
          items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
        });
      const cnId = draftRes.body.creditNote.id;

      const res = await agent.patch(`/api/credit-notes/${cnId}/finalize`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.creditNoteNumber).toBeTruthy();
      expect(res.body.creditNote.status).toBe("finalized");
    });

    it("rejects finalizing a non-draft credit note", async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      const cnId = createRes.body.creditNote.id;

      const res = await agent.patch(`/api/credit-notes/${cnId}/finalize`).set(headers);
      expect(res.status).toBe(422);
    });

    it("returns 404 for finalizing non-existent credit note", async () => {
      const res = await agent
        .patch("/api/credit-notes/00000000-0000-0000-0000-000000000099/finalize")
        .set(headers);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/credit-notes/:id/apply", () => {
    let finalizedCnId: string;
    let targetInvoiceId: string;

    beforeEach(async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [
          {
            description: "Refund",
            quantity: 1,
            unit: "each",
            unitPrice: "100.00",
            taxRate: 0,
          },
        ],
      });
      finalizedCnId = createRes.body.creditNote.id;

      const customerRes = await agent.get("/api/customers").set(headers).query({ search: "Test Customer" });
      const customerId = customerRes.body.data[0].id;

      const inv = await createTestInvoiceWithItems(business.id, customerId);
      targetInvoiceId = inv.id as string;
    });

    it("applies credit note to an invoice", async () => {
      const res = await agent
        .post(`/api/credit-notes/${finalizedCnId}/apply`)
        .set(headers)
        .send({ invoiceId: targetInvoiceId, amount: "50.00" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(parseFloat(res.body.remaining)).toBeCloseTo(170, 2);
    });

    it("records application method as invoice_offset by default", async () => {
      const res = await agent
        .post(`/api/credit-notes/${finalizedCnId}/apply`)
        .set(headers)
        .send({ invoiceId: targetInvoiceId, amount: "50.00" });

      expect(res.body.ok).toBe(true);

      const cnRes = await agent.get(`/api/credit-notes/${finalizedCnId}`).set(headers);
      const app = cnRes.body.creditNote.applications[0];
      const metadata = typeof app.metadata === "string" ? JSON.parse(app.metadata) : app.metadata;
      expect(metadata.application_method).toBe("invoice_offset");
    });

    it("records application method as balance_credit", async () => {
      await agent
        .post(`/api/credit-notes/${finalizedCnId}/apply`)
        .set(headers)
        .send({ invoiceId: targetInvoiceId, amount: "30.00", applicationMethod: "balance_credit" });

      const cnRes = await agent.get(`/api/credit-notes/${finalizedCnId}`).set(headers);
      const app = cnRes.body.creditNote.applications[0];
      const metadata = typeof app.metadata === "string" ? JSON.parse(app.metadata) : app.metadata;
      expect(metadata.application_method).toBe("balance_credit");
    });

    it("rejects applying from a non-finalized credit note", async () => {
      const draftRes = await agent
        .post("/api/credit-notes/draft")
        .set(headers)
        .send({
          invoiceId,
          items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
        });
      const draftCnId = draftRes.body.creditNote.id;

      const res = await agent
        .post(`/api/credit-notes/${draftCnId}/apply`)
        .set(headers)
        .send({ invoiceId: targetInvoiceId, amount: "30.00" });

      expect(res.status).toBe(422);
    });

    it("rejects applying more than remaining credit", async () => {
      const res = await agent
        .post(`/api/credit-notes/${finalizedCnId}/apply`)
        .set(headers)
        .send({ invoiceId: targetInvoiceId, amount: "200.00" });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/remaining credit/i);
    });

    it("rejects applying with amount <= 0", async () => {
      const res = await agent
        .post(`/api/credit-notes/${finalizedCnId}/apply`)
        .set(headers)
        .send({ invoiceId: targetInvoiceId, amount: "0" });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/must be greater than 0/i);
    });

    it("returns 404 for applying to non-existent credit note", async () => {
      const res = await agent
        .post("/api/credit-notes/00000000-0000-0000-0000-000000000099/apply")
        .set(headers)
        .send({ invoiceId: targetInvoiceId, amount: "50.00" });

      expect(res.status).toBe(404);
    });

    it("returns 404 when invoice customer does not match", async () => {
      const biz2 = await createTestBusiness({
        id: "00000000-0000-0000-0000-000000000002",
        ownerId: "11111111-1111-1111-1111-111111111112",
      });
      const cust2Id = await createTestCustomer(biz2.id, "Other Customer");
      const otherInvoice = await createTestInvoiceWithItems(biz2.id, cust2Id);

      const res = await agent
        .post(`/api/credit-notes/${finalizedCnId}/apply`)
        .set(headers)
        .send({ invoiceId: otherInvoice.id, amount: "50.00" });

      expect(res.status).toBe(404);
    });

    it("updates credit note status to applied when fully applied", async () => {
      await agent
        .post(`/api/credit-notes/${finalizedCnId}/apply`)
        .set(headers)
        .send({ invoiceId: targetInvoiceId, amount: "100.00" });

      const cnRes = await agent.get(`/api/credit-notes/${finalizedCnId}`).set(headers);
      expect(cnRes.body.creditNote.status).toBe("applied");
      expect(parseFloat(cnRes.body.creditNote.amount_due)).toBe(0);
    });

    it("updates credit note status to partially_applied when partially applied", async () => {
      await agent
        .post(`/api/credit-notes/${finalizedCnId}/apply`)
        .set(headers)
        .send({ invoiceId: targetInvoiceId, amount: "50.00" });

      const cnRes = await agent.get(`/api/credit-notes/${finalizedCnId}`).set(headers);
      expect(cnRes.body.creditNote.status).toBe("partially_applied");
      expect(parseFloat(cnRes.body.creditNote.applied_total)).toBeCloseTo(50, 2);
      expect(parseFloat(cnRes.body.creditNote.amount_due)).toBeCloseTo(50, 2);
    });
  });

  describe("POST /api/credit-notes/:id/cancel", () => {
    it("cancels a draft credit note", async () => {
      const draftRes = await agent
        .post("/api/credit-notes/draft")
        .set(headers)
        .send({
          invoiceId,
          reason: "Test",
          items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
        });
      const cnId = draftRes.body.creditNote.id;

      const res = await agent
        .post(`/api/credit-notes/${cnId}/cancel`)
        .set(headers)
        .send({ reason: "Mistake" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const cnRes = await agent.get(`/api/credit-notes/${cnId}`).set(headers);
      expect(cnRes.body.creditNote.status).toBe("cancelled");
      expect(cnRes.body.creditNote.cancelled_reason).toBe("Mistake");
    });

    it("cancels a finalized credit note", async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      const cnId = createRes.body.creditNote.id;

      const res = await agent
        .post(`/api/credit-notes/${cnId}/cancel`)
        .set(headers)
        .send({ reason: "Customer request" });

      expect(res.status).toBe(200);
      const cnRes = await agent.get(`/api/credit-notes/${cnId}`).set(headers);
      expect(cnRes.body.creditNote.status).toBe("cancelled");
    });

    it("rejects cancelling an already voided credit note", async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      const cnId = createRes.body.creditNote.id;

      await agent
        .post(`/api/credit-notes/${cnId}/void`)
        .set(headers)
        .send({ reason: "Wrong" });

      const res = await agent
        .post(`/api/credit-notes/${cnId}/cancel`)
        .set(headers)
        .send({ reason: "Try again" });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/cannot cancel credit note in void/i);
    });

    it("returns 404 for non-existent credit note", async () => {
      const res = await agent
        .post("/api/credit-notes/00000000-0000-0000-0000-000000000099/cancel")
        .set(headers)
        .send({ reason: "Test" });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/credit-notes/:id/void", () => {
    it("voids a finalized credit note", async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      const cnId = createRes.body.creditNote.id;

      const res = await agent
        .post(`/api/credit-notes/${cnId}/void`)
        .set(headers)
        .send({ reason: "Incorrect amount" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const cnRes = await agent.get(`/api/credit-notes/${cnId}`).set(headers);
      expect(cnRes.body.creditNote.status).toBe("void");
      expect(cnRes.body.creditNote.void_reason).toBe("Incorrect amount");
    });

    it("voids a draft credit note", async () => {
      const draftRes = await agent
        .post("/api/credit-notes/draft")
        .set(headers)
        .send({
          invoiceId,
          items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
        });
      const cnId = draftRes.body.creditNote.id;

      const res = await agent
        .post(`/api/credit-notes/${cnId}/void`)
        .set(headers)
        .send({ reason: "Changed mind" });

      expect(res.status).toBe(200);
      const cnRes = await agent.get(`/api/credit-notes/${cnId}`).set(headers);
      expect(cnRes.body.creditNote.status).toBe("void");
    });

    it("rejects voiding an already cancelled credit note", async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      const cnId = createRes.body.creditNote.id;

      await agent
        .post(`/api/credit-notes/${cnId}/cancel`)
        .set(headers)
        .send({ reason: "Cancel" });

      const res = await agent
        .post(`/api/credit-notes/${cnId}/void`)
        .set(headers)
        .send({ reason: "Void" });

      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/already cancelled/i);
    });

    it("returns 404 for non-existent credit note", async () => {
      const res = await agent
        .post("/api/credit-notes/00000000-0000-0000-0000-000000000099/void")
        .set(headers)
        .send({ reason: "Test" });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/credit-notes/:id/send", () => {
    it("sends a finalized credit note and updates status to sent", async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      const cnId = createRes.body.creditNote.id;

      const res = await agent
        .post(`/api/credit-notes/${cnId}/send`)
        .set(headers)
        .send({ to: "customer@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe("sent");

      const cnRes = await agent.get(`/api/credit-notes/${cnId}`).set(headers);
      expect(cnRes.body.creditNote.status).toBe("sent");
    });
  });

  describe("GET /api/credit-notes/:id/pdf", () => {
    it("generates a PDF for a credit note", async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      const cnId = createRes.body.creditNote.id;

      const res = await agent.get(`/api/credit-notes/${cnId}/pdf`).set(headers);
      expect(res.status).toBe(200);
       expect(res.headers["content-type"]).toContain("application/pdf");
     }, 180000);
  });

  describe("GET /api/credit-notes/:id/share-link", () => {
    it("generates a public share link for a credit note", async () => {
      const createRes = await agent.post("/api/credit-notes").set(headers).send({
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      const cnId = createRes.body.creditNote.id;

      const res = await agent.post(`/api/credit-notes/${cnId}/share-link`).set(headers);
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.url).toContain("/credit-notes/");
    });
  });
});

describe("Credit Note Service (unit)", () => {
  let businessId: string;
  let customerId: string;
  let invoiceId: string;
  let userId: string;

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
    const user = await createTestUser({ businessId });
    userId = user.id;
    customerId = await createTestCustomer(businessId);
    const invoice = await createTestInvoiceWithItems(businessId, customerId);
    invoiceId = invoice.id as string;
  });

  describe("createCreditNoteDraft", () => {
    it("creates a draft credit note", async () => {
      const cn = await invoiceService.createCreditNoteDraft(businessId, userId, {
        invoiceId,
        reason: "Damage",
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      expect(cn.status).toBe("draft");
      expect(cn.is_finalized).toBe(false);
      expect(cn.credit_note_number).toBeNull();
    });

    it("throws NotFoundError for non-existent invoice", async () => {
      await expect(
        invoiceService.createCreditNoteDraft(businessId, userId, {
          invoiceId: "00000000-0000-0000-0000-000000000099",
          items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("finalizeCreditNote", () => {
    it("finalizes a draft and assigns a number", async () => {
      const cn = await invoiceService.createCreditNoteDraft(businessId, userId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      const result = await invoiceService.finalizeCreditNote(businessId, cn.id as string, userId);
      expect(result.creditNoteNumber).toBeTruthy();
      expect(result.creditNote.status).toBe("finalized");
    });

    it("throws BusinessLogicError when finalizing non-draft", async () => {
      const cn = await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      await expect(
        invoiceService.finalizeCreditNote(businessId, cn.id as string, userId)
      ).rejects.toThrow(BusinessLogicError);
    });

    it("throws NotFoundError for non-existent credit note", async () => {
      await expect(
        invoiceService.finalizeCreditNote(businessId, "00000000-0000-0000-0000-000000000099", userId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("cancelCreditNote", () => {
    it("cancels a finalized credit note", async () => {
      const cn = await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      const result = await invoiceService.cancelCreditNote(businessId, cn.id as string, userId, "Customer error");
      expect(result.ok).toBe(true);

      const found = await invoiceService.getCreditNoteById(businessId, cn.id as string);
      expect(found?.status).toBe("cancelled");
    });

    it("throws BusinessLogicError when cancelling already voided", async () => {
      const cn = await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      await invoiceService.voidCreditNote(businessId, cn.id as string, userId, "Wrong");

      await expect(
        invoiceService.cancelCreditNote(businessId, cn.id as string, userId, "Try cancel")
      ).rejects.toThrow(BusinessLogicError);
    });
  });

  describe("voidCreditNote", () => {
    it("voids a finalized credit note", async () => {
      const cn = await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

       const result = await invoiceService.voidCreditNote(businessId, cn.id as string, userId, "Incorrect");
      expect(result.ok).toBe(true);

      const found = await invoiceService.getCreditNoteById(businessId, cn.id as string);
      expect(found?.status).toBe("void");
    });

    it("throws BusinessLogicError when voiding already cancelled", async () => {
      const cn = await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

       await invoiceService.cancelCreditNote(businessId, cn.id as string, userId, "Cancel reason");

      await expect(
        invoiceService.voidCreditNote(businessId, cn.id as string, userId, "Void reason")
      ).rejects.toThrow(BusinessLogicError);
    });
  });

  describe("getCreditNoteEvents", () => {
    it("returns events for a credit note", async () => {
      const cn = await invoiceService.createCreditNoteDraft(businessId, userId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      const { events } = await invoiceService.getCreditNoteEvents(businessId, cn.id as string);
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe("credit_note_created");
    });

    it("returns paginated events", async () => {
      const cn = await invoiceService.createCreditNoteDraft(businessId, userId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      const { events, total } = await invoiceService.getCreditNoteEvents(businessId, cn.id as string, 10, 0);
      expect(total).toBe(1);
      expect(events).toHaveLength(1);
    });
  });

  describe("applyCreditNote", () => {
    let cnId: string;
    let targetInvoiceId: string;

    beforeEach(async () => {
      const cn = await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Refund", quantity: 1, unit: "each", unitPrice: "100.00", taxRate: 0 }],
      });
      cnId = cn.id as string;

      const inv = await createTestInvoiceWithItems(businessId, customerId);
      targetInvoiceId = inv.id as string;
    });

    it("applies credit note to an invoice", async () => {
      const result = await invoiceService.applyCreditNote(businessId, cnId, {
        invoiceId: targetInvoiceId,
        amount: "50.00",
      });

      expect(result.ok).toBe(true);
    });

    it("records the application method in metadata", async () => {
      await invoiceService.applyCreditNote(businessId, cnId, {
        invoiceId: targetInvoiceId,
        amount: "50.00",
        applicationMethod: "balance_credit",
      });

      const found = await invoiceService.getCreditNoteById(businessId, cnId);
      const apps = found?.applications as Array<{ metadata: unknown }> | undefined;
      const app = apps?.[0];
      const metadata = typeof app?.metadata === "string" ? JSON.parse(app.metadata) : app?.metadata;
      expect((metadata as Record<string, unknown>)?.application_method).toBe("balance_credit");
    });

     it("throws BusinessLogicError for non-finalized credit note", async () => {
      const draftCn = await invoiceService.createCreditNoteDraft(businessId, userId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      await expect(
        invoiceService.applyCreditNote(businessId, draftCn.id as string, {
          invoiceId: targetInvoiceId,
          amount: "50.00",
        })
      ).rejects.toThrow(BusinessLogicError);
    });

    it("throws BusinessLogicError when exceeding remaining credit", async () => {
      await expect(
        invoiceService.applyCreditNote(businessId, cnId, {
          invoiceId: targetInvoiceId,
          amount: "200.00",
        })
      ).rejects.toThrow(BusinessLogicError);
    });
  });

  describe("listCreditNotes", () => {
    it("returns credit notes for a business", async () => {
      await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Item 1", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });
      await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Item 2", quantity: 1, unit: "each", unitPrice: "75.00", taxRate: 0 }],
      });

      const result = await invoiceService.listCreditNotes(businessId, { limit: 50, offset: 0 });
      expect(result.total).toBe(2);
      expect(result.creditNotes).toHaveLength(2);
    });

    it("filters by status", async () => {
      await invoiceService.createCreditNoteDraft(businessId, userId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      const result = await invoiceService.listCreditNotes(businessId, { status: "finalized", limit: 50, offset: 0 });
      expect(result.total).toBe(0);
    });

    it("isolates credit notes by tenant", async () => {
      await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      const biz2 = await createTestBusiness({
        id: "00000000-0000-0000-0000-000000000002",
        ownerId: "11111111-1111-1111-1111-111111111112",
      });

      const result = await invoiceService.listCreditNotes(biz2.id, { limit: 50, offset: 0 });
      expect(result.total).toBe(0);
    });
  });

  describe("getCreditNoteById", () => {
    it("returns a credit note with items", async () => {
      const cn = await invoiceService.createCreditNoteDraft(businessId, userId, {
        invoiceId,
        reason: "Return",
        items: [
          { description: "Item A", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 },
          { description: "Item B", quantity: 2, unit: "each", unitPrice: "25.00", taxRate: 0.1 },
        ],
      });

      const found = await invoiceService.getCreditNoteById(businessId, cn.id as string);
      expect(found).not.toBeNull();
      expect(found?.items).toHaveLength(2);
      expect(found?.reason).toBe("Return");
      expect(found?.events).toHaveLength(1);
    });

    it("returns null for non-existent credit note", async () => {
      const found = await invoiceService.getCreditNoteById(businessId, "00000000-0000-0000-0000-000000000099");
      expect(found).toBeNull();
    });

    it("returns null for credit note in different business", async () => {
      const cn = await invoiceService.createCreditNote(businessId, {
        invoiceId,
        items: [{ description: "Item", quantity: 1, unit: "each", unitPrice: "50.00", taxRate: 0 }],
      });

      const biz2 = await createTestBusiness({
        id: "00000000-0000-0000-0000-000000000002",
        ownerId: "11111111-1111-1111-1111-111111111112",
      });

      const found = await invoiceService.getCreditNoteById(biz2.id, cn.id as string);
      expect(found).toBeNull();
    });
  });
});
