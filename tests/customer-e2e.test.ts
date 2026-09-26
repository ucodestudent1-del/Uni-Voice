import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index.js";
import request from "supertest";
import { truncateTestDb, createTestBusiness, createTestUser } from "./helpers/db.js";
import { generateToken } from "../src/middleware/auth.js";
import { query } from "../src/db/pool.js";

const agent = request(app);

function authHeader(businessId: string, userId: string, email: string) {
  const token = generateToken(userId, businessId, email);
  return { Authorization: `Bearer ${token}` };
}

describe("Customer → Invoice e2e", () => {
  let businessId: string;
  let userId: string;
  let headers: { Authorization: string };

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
    const user = await createTestUser({ businessId });
    userId = user.id;
    headers = authHeader(businessId, userId, user.email);
  });

  it("creates a customer, creates an invoice referencing it, finalizes, and links invoice back to customer", async () => {
    // 1. Create customer
    const custRes = await agent.post("/api/customers").set(headers).send({
      name: "Acme Corp",
      email: "billing@acme.example.com",
      companyName: "Acme Incorporated",
      phone: "555-0100",
      addressLine1: "123 Business St",
      city: "New York",
      stateOrRegion: "NY",
      postalCode: "10001",
      countryCode: "US",
      defaultCurrency: "USD",
      taxId: "12-3456789",
    });
    expect(custRes.status).toBe(201);
    const customerId = custRes.body.customer.id;

    // 2. Create invoice referencing customer
    const invRes = await agent.post("/api/invoices").set(headers).send({
      customerId,
      currency: "USD",
      notes: "E2E test invoice",
      terms: "Net 30",
      issueDate: new Date().toISOString(),
      items: [
        {
          description: "Web Development",
          quantity: "10",
          unit: "hours",
          unitPrice: "150.00",
          taxRate: "0.1",
          isTaxInclusive: false,
        },
      ],
    });
    expect(invRes.status).toBe(201);
    const invoiceId = invRes.body.invoiceId;

    // 3. Verify invoice references customer
    const getInvRes = await agent.get(`/api/invoices/${invoiceId}`).set(headers);
    expect(getInvRes.status).toBe(200);
    expect(getInvRes.body.invoice.customerId).toBe(customerId);

    // 4. Finalize invoice
    const finalizeRes = await agent.post(`/api/invoices/${invoiceId}/finalize`).set(headers);
    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.invoiceNumber).toBeTruthy();
    expect(finalizeRes.body.invoiceNumber.startsWith("INV-")).toBe(true);

    // 5. Verify customer invoice history shows the finalized invoice
    const historyRes = await agent.get(`/api/customers/${customerId}/invoices`).set(headers);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.total).toBe(1);
    expect(historyRes.body.data[0].invoiceNumber).toBe(finalizeRes.body.invoiceNumber);
    expect(historyRes.body.data[0].finalizedAt).toBeTruthy();

    // 6. Verify customer summary reflects invoice
    const summaryRes = await agent.get(`/api/customers/${customerId}/summary`).set(headers);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.summary.totalInvoiceCount).toBe(1);
    expect(summaryRes.body.summary.finalizedInvoiceCount).toBe(1);
    expect(parseFloat(summaryRes.body.summary.totalBilled)).toBeGreaterThan(0);

    // 7. Archive customer — should succeed (no destructive delete of invoice)
    const archiveRes = await agent.post(`/api/customers/${customerId}/archive`).set(headers);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.customer.status).toBe("archived");

    // 8. Verify invoice still exists and references the (now archived) customer
    const invStillRes = await agent.get(`/api/invoices/${invoiceId}`).set(headers);
    expect(invStillRes.status).toBe(200);
    expect(invStillRes.body.invoice.customerId).toBe(customerId);
    expect(invStillRes.body.invoice.status).toBe("draft");

    // 9. Verify search still finds archived customer with includeArchived
    const searchRes = await agent.get("/api/customers").set(headers).query({ search: "acme", includeArchived: true });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.some((c: any) => c.id === customerId)).toBe(true);

    // 10. Verify archived customer does NOT appear in default search
    const defaultSearchRes = await agent.get("/api/customers").set(headers).query({ search: "acme" });
    expect(defaultSearchRes.body.data.some((c: any) => c.id === customerId)).toBe(false);
  });

  it("prevents archiving a customer when it would break invoice references", async () => {
    // Create customer and invoice with finalized invoice
    const custRes = await agent.post("/api/customers").set(headers).send({ name: "Important Client" });
    const customerId = custRes.body.customer.id;

    const invRes = await agent.post("/api/invoices").set(headers).send({
      customerId,
      currency: "USD",
      issueDate: new Date().toISOString(),
      items: [{ description: "Service", quantity: "1", unitPrice: "100.00", taxRate: "0", isTaxInclusive: false }],
    });
    const invoiceId = invRes.body.invoiceId;
    await agent.post(`/api/invoices/${invoiceId}/finalize`).set(headers);

    // Archive should succeed (preserving invoice data via soft-delete)
    const archiveRes = await agent.post(`/api/customers/${customerId}/archive`).set(headers);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.customer.status).toBe("archived");

    // Invoice should still be accessible
    const invRes2 = await agent.get(`/api/invoices/${invoiceId}`).set(headers);
    expect(invRes2.status).toBe(200);
    expect(invRes2.body.invoice.isFinalized).toBe(true);
    expect(invRes2.body.invoice.customerId).toBe(customerId);
  });

  it("verifies tenant isolation: customer not visible across businesses", async () => {
    // Create customer in business A
    const custRes = await agent.post("/api/customers").set(headers).send({ name: "Private Customer" });
    const customerId = custRes.body.customer.id;

    // Create business B and user
    const biz2 = await createTestBusiness({ id: "00000000-0000-0000-0000-000000000002" });
    const user2 = await createTestUser({ id: "11111111-1111-1111-1111-111111111112", email: "t2@test.com", businessId: biz2.id });
    const headers2 = authHeader(biz2.id, user2.id, user2.email);

    // Business B should not see customer from business A
    const res = await agent.get(`/api/customers/${customerId}`).set(headers2);
    expect(res.status).toBe(404);

    // Business B should not be able to archive customer from business A
    const res2 = await agent.post(`/api/customers/${customerId}/archive`).set(headers2);
    expect(res2.status).toBe(404);

    // Verify via direct DB that status is still active
    const dbRes = await query("SELECT status FROM customers WHERE id = $1", [customerId]);
    expect(dbRes.rows[0].status).toBe("active");
  });
});
