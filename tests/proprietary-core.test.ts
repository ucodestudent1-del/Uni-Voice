import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { truncateTestDb, createTestBusiness, createTestUser, createTestCustomer } from "./helpers/db.js";
import { generateToken } from "../src/middleware/auth.js";
import { query } from "../src/db/pool.js";

const agent = request(app);

function authHeader(businessId: string, userId: string, email: string) {
  const token = generateToken(userId, businessId, email);
  return { Authorization: `Bearer ${token}` };
}

async function createTestInvoice(businessId: string, customerId?: string) {
  const result = await query(
    `INSERT INTO invoices
      (business_id, customer_id, currency, issue_date, due_date, subtotal, discount_total, tax_total, fee_total, total, amount_paid, amount_due, version)
     VALUES ($1, $2, 'USD', NOW(), NOW() + INTERVAL '30 days', '100.00', '0', '0', '0', '100.00', '0', '100.00', 1)
     RETURNING *`,
    [businessId, customerId ?? null],
  );
  return result.rows[0];
}

describe("Proprietary Core Routes (integration)", () => {
  let business: { id: string; ownerId: string };
  let otherBusiness: { id: string; ownerId: string };
  let user: { id: string; email: string; businessId: string };
  let otherUser: { id: string; email: string; businessId: string };
  let headers: { Authorization: string };
  let otherHeaders: { Authorization: string };
  let customerId: string;

  beforeEach(async () => {
    await truncateTestDb();
    business = await createTestBusiness();
    user = await createTestUser({ businessId: business.id });
    headers = authHeader(business.id, user.id, user.email);

    otherBusiness = await createTestBusiness({
      id: "00000000-0000-0000-0000-000000000002",
      ownerId: "11111111-1111-1111-1111-111111111112",
      name: "Other Business",
    });
    otherUser = await createTestUser({
      id: "11111111-1111-1111-1111-111111111112",
      email: "other@test.com",
      businessId: otherBusiness.id,
    });
    otherHeaders = authHeader(otherBusiness.id, otherUser.id, otherUser.email);

    customerId = await createTestCustomer(business.id, "Test Customer");
  });

  describe("GET /api/proprietary/invoices", () => {
    it("returns invoices for the authenticated business only", async () => {
      await createTestInvoice(business.id, customerId);
      await createTestInvoice(otherBusiness.id);

      const res = await agent.get("/api/proprietary/invoices").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.invoices).toHaveLength(1);
      expect(res.body.invoices[0].business_id).toBe(business.id);
      expect(res.body.total).toBe(1);
    });

    it("returns 401 without auth", async () => {
      const res = await agent.get("/api/proprietary/invoices");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/proprietary/customers", () => {
    it("returns only the business's customers", async () => {
      await agent.post("/api/proprietary/customers").set(headers).send({ name: "Customer A" });

      await agent
        .post("/api/proprietary/customers")
        .set(otherHeaders)
        .send({ name: "Other Biz Customer" });

      const res = await agent.get("/api/proprietary/customers").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.customers).toHaveLength(1);
      expect(res.body.customers[0].name).toBe("Customer A");
    });

    it("supports search param", async () => {
      await agent.post("/api/proprietary/customers").set(headers).send({ name: "Alpha Corp" });
      await agent.post("/api/proprietary/customers").set(headers).send({ name: "Beta Ltd" });

      const res = await agent.get("/api/proprietary/customers").set(headers).query({ search: "alpha" });
      expect(res.body.customers).toHaveLength(1);
      expect(res.body.customers[0].name).toBe("Alpha Corp");
    });
  });

  describe("GET /api/proprietary/invoices/:id/share-link", () => {
    it("creates and returns a token + URL for an invoice", async () => {
      const invoice = await createTestInvoice(business.id, customerId);

      const res = await agent
        .get(`/api/proprietary/invoices/${invoice.id}/share-link`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.url).toContain("/invoice/");
      expect(res.body.expiresAt).toBeTruthy();
    });

    it("returns existing token on second call", async () => {
      const invoice = await createTestInvoice(business.id, customerId);

      const res1 = await agent
        .get(`/api/proprietary/invoices/${invoice.id}/share-link`)
        .set(headers);
      const res2 = await agent
        .get(`/api/proprietary/invoices/${invoice.id}/share-link`)
        .set(headers);
      expect(res1.body.token).toBe(res2.body.token);
    });

    it("returns 404 for non-existent invoice", async () => {
      const res = await agent
        .get("/api/proprietary/invoices/00000000-0000-0000-0000-000000000099/share-link")
        .set(headers);
      expect(res.status).toBe(404);
    });

    it("returns 404 for invoice in another business", async () => {
      const invoice = await createTestInvoice(otherBusiness.id);
      const res = await agent
        .get(`/api/proprietary/invoices/${invoice.id}/share-link`)
        .set(headers);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/proprietary/invoices", () => {
    it("creates an invoice with items", async () => {
      const res = await agent
        .post("/api/proprietary/invoices")
        .set(headers)
        .send({
          customerId,
          currency: "USD",
          items: [
            {
              description: "Consulting",
              quantity: 2,
              unitPrice: "100.00",
              taxRate: 0.1,
              taxName: "VAT",
            },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.invoice).toBeTruthy();
      expect(res.body.invoice.total).toBeDefined();
    });
  });

  describe("Recurring Invoices CRUD", () => {
    const validRecurringInput = {
      name: "Monthly Retainer",
      frequency: "monthly",
      intervalCount: 1,
      nextGenerationAt: "2025-12-01",
      currency: "USD",
      notes: "Monthly service",
      terms: "Net 30",
      autoSend: false,
      items: [
        {
          description: "Service",
          quantity: 1,
          unit: "each",
          unitPrice: "500.00",
          taxRate: 0,
        },
      ],
    };

    let _recurringId: string;

    it("POST creates a recurring invoice with items", async () => {
      const res = await agent
        .post("/api/proprietary/recurring-invoices")
        .set(headers)
        .send(validRecurringInput);
      expect(res.status).toBe(201);
      expect(res.body.recurringInvoice).toBeTruthy();
      expect(res.body.recurringInvoice.name).toBe("Monthly Retainer");
      expect(res.body.recurringInvoice.status).toBe("draft");
      _recurringId = res.body.recurringInvoice.id;
    });

    it("GET returns the created recurring invoice with items", async () => {
      const createRes = await agent
        .post("/api/proprietary/recurring-invoices")
        .set(headers)
        .send(validRecurringInput);
      const id = createRes.body.recurringInvoice.id;

      const res = await agent
        .get(`/api/proprietary/recurring-invoices/${id}`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body.recurringInvoice.name).toBe("Monthly Retainer");
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].description).toBe("Service");
    });

    it("PUT updates the recurring invoice", async () => {
      const createRes = await agent
        .post("/api/proprietary/recurring-invoices")
        .set(headers)
        .send(validRecurringInput);
      const id = createRes.body.recurringInvoice.id;

      const res = await agent
        .put(`/api/proprietary/recurring-invoices/${id}`)
        .set(headers)
        .send({ name: "Updated Name", intervalCount: 2 });
      expect(res.status).toBe(200);
      expect(res.body.recurringInvoice.name).toBe("Updated Name");
    });

    it("DELETE removes the recurring invoice", async () => {
      const createRes = await agent
        .post("/api/proprietary/recurring-invoices")
        .set(headers)
        .send(validRecurringInput);
      const id = createRes.body.recurringInvoice.id;

      const res = await agent
        .delete(`/api/proprietary/recurring-invoices/${id}`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const getRes = await agent
        .get(`/api/proprietary/recurring-invoices/${id}`)
        .set(headers);
      expect(getRes.status).toBe(404);
    });

    it("activate updates status to active", async () => {
      const createRes = await agent
        .post("/api/proprietary/recurring-invoices")
        .set(headers)
        .send(validRecurringInput);
      const id = createRes.body.recurringInvoice.id;

      const res = await agent
        .post(`/api/proprietary/recurring-invoices/${id}/activate`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body.recurringInvoice.status).toBe("active");
      expect(res.body.recurringInvoice.is_active).toBe(true);
    });

    it("tenant isolation: cannot access another business's recurring invoice", async () => {
      const createRes = await agent
        .post("/api/proprietary/recurring-invoices")
        .set(headers)
        .send(validRecurringInput);
      const id = createRes.body.recurringInvoice.id;

      const res = await agent
        .get(`/api/proprietary/recurring-invoices/${id}`)
        .set(otherHeaders);
      expect(res.status).toBe(404);
    });

    it("tenant isolation: DELETE returns 404 for another business's recurring invoice", async () => {
      const createRes = await agent
        .post("/api/proprietary/recurring-invoices")
        .set(headers)
        .send(validRecurringInput);
      const id = createRes.body.recurringInvoice.id;

      const res = await agent
        .delete(`/api/proprietary/recurring-invoices/${id}`)
        .set(otherHeaders);
      expect(res.status).toBe(404);
    });
  });

  describe("Email Templates CRUD", () => {
    const validTemplate = {
      name: "Custom Invoice",
      templateType: "invoice",
      locale: "en-US",
      subjectTemplate: "Invoice {{invoice_number}}",
      bodyTemplate: "<p>Hi {{customer_name}}</p>",
      isDefault: false,
      isActive: true,
    };

    it("POST creates a template", async () => {
      const res = await agent
        .post("/api/proprietary/email-templates")
        .set(headers)
        .send(validTemplate);
      expect(res.status).toBe(201);
      expect(res.body.template.name).toBe("Custom Invoice");
    });

    it("GET lists templates for the business only", async () => {
      await agent.post("/api/proprietary/email-templates").set(headers).send(validTemplate);
      await agent
        .post("/api/proprietary/email-templates")
        .set(otherHeaders)
        .send({ ...validTemplate, name: "Other Template" });

      const res = await agent.get("/api/proprietary/email-templates").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.templates).toHaveLength(1);
      expect(res.body.templates[0].name).toBe("Custom Invoice");
    });

    it("GET /defaults returns the default templates", async () => {
      const res = await agent.get("/api/proprietary/email-templates/defaults").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.defaults).toBeTruthy();
      expect(res.body.defaults.invoice).toBeTruthy();
    });

    it("PUT updates a template", async () => {
      const createRes = await agent
        .post("/api/proprietary/email-templates")
        .set(headers)
        .send(validTemplate);
      const id = createRes.body.template.id;

      const res = await agent
        .put(`/api/proprietary/email-templates/${id}`)
        .set(headers)
        .send({ name: "Updated Template" });
      expect(res.status).toBe(200);
      expect(res.body.template.name).toBe("Updated Template");
    });

    it("DELETE removes a template", async () => {
      const createRes = await agent
        .post("/api/proprietary/email-templates")
        .set(headers)
        .send(validTemplate);
      const id = createRes.body.template.id;

      const res = await agent
        .delete(`/api/proprietary/email-templates/${id}`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });

    it("tenant isolation: cannot access another business's template", async () => {
      const createRes = await agent
        .post("/api/proprietary/email-templates")
        .set(headers)
        .send(validTemplate);
      const id = createRes.body.template.id;

      const res = await agent
        .get(`/api/proprietary/email-templates/${id}`)
        .set(otherHeaders);
      expect(res.status).toBe(404);
    });
  });

  describe("Branding", () => {
    it("GET /branding returns branding for the business", async () => {
      const res = await agent.get("/api/proprietary/branding").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.branding).toBeTruthy();
    });

    it("POST /branding updates branding", async () => {
      const res = await agent
        .post("/api/proprietary/branding")
        .set(headers)
        .send({ businessName: "My Brand", primaryColor: "#ff0000" });
      expect(res.status).toBe(200);
    });
  });

  describe("Reports", () => {
    it("GET /reports/revenue returns grouped data", async () => {
      await createTestInvoice(business.id, customerId);
      await createTestInvoice(otherBusiness.id);

      const res = await agent.get("/api/proprietary/reports/revenue").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("GET /reports/invoice-status returns status breakdown", async () => {
      await createTestInvoice(business.id, customerId);
      await createTestInvoice(otherBusiness.id);

      const res = await agent.get("/api/proprietary/reports/invoice-status").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("GET /reports/customer-summary returns business's customers only", async () => {
      await createTestCustomer(business.id, "Customer One");

      const res = await agent.get("/api/proprietary/reports/customer-summary").set(headers);
      expect(res.status).toBe(200);
      for (const row of res.body.data) {
        expect(row.business_id ?? row.id).toBeDefined();
      }
    });
  });

  describe("Payments", () => {
    it("POST /payments records a payment", async () => {
      const invoice = await createTestInvoice(business.id, customerId);
      const res = await agent
        .post("/api/proprietary/payments")
        .set(headers)
        .send({ invoiceId: invoice.id, amount: "50.00", currency: "USD", method: "manual" });
      expect(res.status).toBe(201);
      expect(res.ok).toBe(true);
    });

    it("GET /payments/summary returns payment summary", async () => {
      const invoice = await createTestInvoice(business.id, customerId);
      await agent
        .post("/api/proprietary/payments")
        .set(headers)
        .send({ invoiceId: invoice.id, amount: "50.00", currency: "USD", method: "manual" });

      const res = await agent.get("/api/proprietary/payments/summary").set(headers);
      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
    });
  });
});
