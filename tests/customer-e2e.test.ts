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

describe("Customer e2e", () => {
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

  it("creates a customer, archives, and verifies search behavior", async () => {
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

    // 2. Retrieve customer
    const getRes = await agent.get(`/api/customers/${customerId}`).set(headers);
    expect(getRes.status).toBe(200);
    expect(getRes.body.customer.email).toBe("billing@acme.example.com");

    // 3. Archive customer
    const archiveRes = await agent.post(`/api/customers/${customerId}/archive`).set(headers);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.customer.status).toBe("archived");

    // 4. Verify search still finds archived customer with includeArchived
    const searchRes = await agent.get("/api/customers").set(headers).query({ search: "acme", includeArchived: true });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.some((c: any) => c.id === customerId)).toBe(true);

    // 5. Verify archived customer does NOT appear in default search
    const defaultSearchRes = await agent.get("/api/customers").set(headers).query({ search: "acme" });
    expect(defaultSearchRes.body.data.some((c: any) => c.id === customerId)).toBe(false);

    // 6. Restore customer
    const restoreRes = await agent.post(`/api/customers/${customerId}/restore`).set(headers);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.customer.status).toBe("active");
  });

  it("verifies tenant isolation: customer not visible across businesses", async () => {
    const custRes = await agent.post("/api/customers").set(headers).send({ name: "Private Customer" });
    const customerId = custRes.body.customer.id;

    const biz2 = await createTestBusiness({ id: "00000000-0000-0000-0000-000000000002" });
    const user2 = await createTestUser({ id: "11111111-1111-1111-1111-111111111112", email: "t2@test.com", businessId: biz2.id });
    const headers2 = authHeader(biz2.id, user2.id, user2.email);

    const res = await agent.get(`/api/customers/${customerId}`).set(headers2);
    expect(res.status).toBe(404);

    const res2 = await agent.post(`/api/customers/${customerId}/archive`).set(headers2);
    expect(res2.status).toBe(404);

    const dbRes = await query("SELECT status FROM customers WHERE id = $1", [customerId]);
    expect(dbRes.rows[0].status).toBe("active");
  });
});
