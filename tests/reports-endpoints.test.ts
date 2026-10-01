import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { truncateTestDb, createTestBusiness, createTestUser, createTestCustomer } from "./helpers/db.js";
import { generateToken } from "../src/middleware/auth.js";
import { invoiceService } from "../src/services/invoice-service.js";
import { subscriptionService } from "../src/services/subscription.service.js";
import { subscriptionRepository } from "../src/repositories/subscription.repo.js";

const agent = request(app);

function authHeader(businessId: string, userId: string, email: string) {
  const token = generateToken(userId, businessId, email);
  return { Authorization: `Bearer ${token}` };
}

describe("Reports endpoints (integration)", () => {
  let businessId: string;
  let userId: string;
  let email: string;
  let headers: { Authorization: string };

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
    userId = biz.ownerId;
    email = `${userId}@example.com`;
    headers = authHeader(businessId, userId, email);

    const businessPlan = await subscriptionService.getPlan("business");
    if (!businessPlan) throw new Error("business plan not found");
    await subscriptionRepository.createSubscription({
      businessId,
      planId: businessPlan.id,
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }, 60000);

  it("GET /api/reports/dashboard returns summary, aging, and payment metrics", async () => {
    const res = await agent.get("/api/reports/dashboard").set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("agingBuckets");
    expect(res.body).toHaveProperty("paymentMetrics");
    expect(res.body.summary).toHaveProperty("totalInvoices");
    expect(res.body.summary).toHaveProperty("totalRevenue");
  }, 60000);

  it("GET /api/reports/revenue returns period breakdown", async () => {
    const res = await agent.get("/api/reports/revenue?dateFrom=2026-01-01&dateTo=2026-12-31").set(headers);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.byStatus)).toBe(true);
    expect(Array.isArray(res.body.byPeriod)).toBe(true);
    expect(res.body).toHaveProperty("summary");
  }, 60000);

  it("GET /api/reports/invoices returns invoices with status filter", async () => {
    const customerId = await createTestCustomer(businessId, "Report Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          { description: "Consulting", quantity: 1, unit: "hour", unitPrice: 100, discount: 0, discountType: "fixed", taxRate: 0.1, isTaxInclusive: false },
        ],
      },
      businessId,
      userId
    );
    await invoiceService.finalize(businessId, invoiceId, userId);

    const res = await agent.get("/api/reports/invoices?status=sent&status=paid").set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("invoices");
    expect(res.body).toHaveProperty("summary");
  }, 60000);

  it("GET /api/reports/payments returns provider and method breakdowns", async () => {
    const res = await agent.get("/api/reports/payments").set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body.summary).toHaveProperty("providerBreakdown");
    expect(res.body.summary).toHaveProperty("methodBreakdown");
  }, 60000);

  it("GET /api/reports/expenses returns category and monthly breakdowns", async () => {
    const res = await agent.get("/api/reports/expenses").set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("expenses");
    expect(res.body).toHaveProperty("summary");
    expect(res.body.summary).toHaveProperty("totalAmount");
    expect(res.body.summary).toHaveProperty("categoryBreakdown");
  }, 60000);

  it("GET /api/reports/clients returns client metrics", async () => {
    const customerId = await createTestCustomer(businessId, "Client Report Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          { description: "Service", quantity: 1, unit: "hour", unitPrice: 200, discount: 0, discountType: "fixed", taxRate: 0.1, isTaxInclusive: false },
        ],
      },
      businessId,
      userId
    );
    await invoiceService.finalize(businessId, invoiceId, userId);

    const res = await agent.get("/api/reports/clients").set(headers);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.clients)).toBe(true);
    expect(res.body.summary).toBeDefined();
  }, 60000);

  it("GET /api/reports/tax-summary returns rates with amounts", async () => {
    const customerId = await createTestCustomer(businessId, "Tax Summary Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          { description: "Service", quantity: 1, unit: "hour", unitPrice: 200, discount: 0, discountType: "fixed", taxRate: 0.1, isTaxInclusive: false },
        ],
      },
      businessId,
      userId
    );
    await invoiceService.finalize(businessId, invoiceId, userId);

    const res = await agent.get("/api/reports/tax-summary").set(headers);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.byRate)).toBe(true);
    expect(res.body.byRate.length).toBeGreaterThan(0);
    expect(res.body.byRate[0]).toHaveProperty("rate");
    expect(res.body.byRate[0]).toHaveProperty("tax_collected");
  }, 60000);

  it("GET /api/reports/profit-loss returns income and expense data", async () => {
    const res = await agent.get("/api/reports/profit-loss").set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("revenue");
    expect(res.body).toHaveProperty("expenses");
    expect(res.body).toHaveProperty("netIncome");
  }, 60000);

  it("GET /api/reports/aging returns buckets with current/overdue split", async () => {
    const customerId = await createTestCustomer(businessId, "Aging Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          { description: "Service", quantity: 1, unit: "hour", unitPrice: 200, discount: 0, discountType: "fixed", taxRate: 0, isTaxInclusive: false },
        ],
      },
      businessId,
      userId
    );
    await invoiceService.finalize(businessId, invoiceId, userId);

    const res = await agent.get("/api/reports/aging").set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("buckets");
    expect(Array.isArray(res.body.buckets)).toBe(true);
    expect(res.body.buckets.length).toBe(5);
    const bucketLabels = res.body.buckets.map((b: any) => b.bucket);
    expect(bucketLabels).toContain("current");
    expect(bucketLabels).toContain("1-30");
    expect(bucketLabels).toContain("31-60");
    expect(bucketLabels).toContain("61-90");
    expect(bucketLabels).toContain("90+");
    expect(res.body).toHaveProperty("summary");
    expect(res.body.summary).toHaveProperty("totalOutstanding");
  }, 60000);

  it("CSV export returns a blob with report data", async () => {
    const res = await agent.get("/api/reports/revenue/csv").set(headers);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
  }, 60000);

  it("Returns 403 for users without reports.expenses entitlement", async () => {
    const freePlan = await subscriptionService.getPlan("free");
    if (!freePlan) throw new Error("free plan not found");
    await subscriptionRepository.updateSubscriptionByBusinessId(businessId, { planId: freePlan.id, status: "active", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });

    const res = await agent.get("/api/reports/expenses").set(headers);
    expect(res.status).toBe(403);
  }, 60000);
});
