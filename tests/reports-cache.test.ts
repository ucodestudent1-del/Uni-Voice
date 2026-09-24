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

describe("Reports cache (integration)", () => {
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

  it("caches revenue report and invalidates on invoice finalize", async () => {
    const firstRes = await agent.get("/api/reports/revenue").set(headers);
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.report).toHaveLength(0);

    const customerId = await createTestCustomer(businessId, "Test Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          {
            description: "Consulting",
            quantity: 1,
            unit: "hour",
            unitPrice: 100,
            discount: 0,
            discountType: "fixed",
            taxRate: 0.1,
            isTaxInclusive: false,
          },
        ],
      },
      businessId,
      userId
    );

    await invoiceService.finalize(businessId, invoiceId, userId);

    const secondRes = await agent.get("/api/reports/revenue").set(headers);
    expect(secondRes.status).toBe(200);
    const draftRow = secondRes.body.report.find((r: any) => r.status === "draft");
    expect(draftRow).toBeDefined();
    expect(Number(draftRow.total_amount)).toBeCloseTo(110, 1);
  }, 60000);

  it("caches tax-summary report and invalidates on invoice finalize", async () => {
    const customerId = await createTestCustomer(businessId, "Tax Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          {
            description: "Service",
            quantity: 1,
            unit: "hour",
            unitPrice: 200,
            discount: 0,
            discountType: "fixed",
            taxRate: 0.1,
            isTaxInclusive: false,
          },
        ],
      },
      businessId,
      userId
    );

    const emptyRes = await agent.get("/api/reports/tax-summary").set(headers);
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.report).toHaveLength(0);

    await invoiceService.finalize(businessId, invoiceId, userId);

    const populatedRes = await agent.get("/api/reports/tax-summary").set(headers);
    expect(populatedRes.status).toBe(200);
    expect(populatedRes.body.report).toHaveLength(1);
    expect(Number(populatedRes.body.report[0].tax_total)).toBeCloseTo(20, 1);
  }, 60000);

  it("caches dashboard and invalidates on invoice finalize", async () => {
    const dashboardRes = await agent.get("/api/dashboard/enhanced").set(headers);
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.summary).toBeDefined();

    const customerId = await createTestCustomer(businessId, "Dashboard Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          {
            description: "Widget",
            quantity: 2,
            unit: "each",
            unitPrice: 50,
            discount: 0,
            discountType: "fixed",
            taxRate: 0.1,
            isTaxInclusive: false,
          },
        ],
      },
      businessId,
      userId
    );

    await invoiceService.finalize(businessId, invoiceId, userId);

    const invalidatedRes = await agent.get("/api/dashboard/enhanced").set(headers);
    expect(invalidatedRes.status).toBe(200);
    expect(invalidatedRes.body.summary.totalInvoices).toBeGreaterThan(0);
  }, 60000);
});
