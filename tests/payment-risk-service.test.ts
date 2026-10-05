import { describe, it, expect } from "vitest";
import {
  PaymentRiskService,
  type RiskProfile,
  type RiskScoreResult,
} from "../src/services/payment-risk-service.js";

describe("PaymentRiskService.computeScore", () => {
  const service = new PaymentRiskService();

  const makeProfile = (overrides: Partial<RiskProfile>): RiskProfile => ({
    businessId: "biz-test",
    customerId: "cust-1",
    avgPaymentDays: 30,
    medianPaymentDays: 28,
    paymentStdDev: 15,
    collectionRate: 85,
    disputeRate: 5,
    invoiceCount: 10,
    paidInvoiceCount: 8,
    lastPaidAt: new Date("2026-01-01"),
    ...overrides,
  });

  it("produces a low score for fast-paying customers", () => {
    const profile = makeProfile({
      avgPaymentDays: 5,
      paymentStdDev: 2,
      collectionRate: 98,
      disputeRate: 0,
    });
    const result = service.computeScore(profile, profile.customerId);
    expect(result.score).toBeLessThan(30);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBe(0.9);
  });

  it("produces a high score for slow-paying, high-dispute customers", () => {
    const profile = makeProfile({
      avgPaymentDays: 90,
      paymentStdDev: 30,
      collectionRate: 50,
      disputeRate: 25,
    });
    const result = service.computeScore(profile, profile.customerId);
    expect(result.score).toBeGreaterThan(70);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.factors.avgPaymentDays).toBe(90);
  });

  it("caps total score at 100 even with extreme worst-case values", () => {
    const profile = makeProfile({
      avgPaymentDays: 365,
      paymentStdDev: 100,
      collectionRate: 0,
      disputeRate: 100,
    });
    const result = service.computeScore(profile, profile.customerId);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThan(90);
  });

  it("produces a low score for immediate payment customers", () => {
    const profile = makeProfile({
      avgPaymentDays: 0,
      paymentStdDev: 0,
      collectionRate: 100,
      disputeRate: 0,
    });
    const result = service.computeScore(profile, profile.customerId);
    expect(result.score).toBeLessThan(20);
  });

  it("adjusts confidence based on invoice count", () => {
    const highConfidence = service.computeScore(makeProfile({ invoiceCount: 15 }), "cust-1");
    expect(highConfidence.confidence).toBe(0.9);

    const midConfidence = service.computeScore(makeProfile({ invoiceCount: 5 }), "cust-1");
    expect(midConfidence.confidence).toBe(0.7);

    const lowConfidence = service.computeScore(makeProfile({ invoiceCount: 1 }), "cust-1");
    expect(lowConfidence.confidence).toBe(0.5);

    const noData = service.computeScore(makeProfile({ invoiceCount: 0 }), null);
    expect(noData.confidence).toBe(0.3);
  });

  it("includes customer_id in factors when provided", () => {
    const profile = makeProfile({});
    const withCustomer = service.computeScore(profile, "cust-123");
    expect(withCustomer.factors.customerId).toBe("cust-123");

    const withoutCustomer = service.computeScore(profile, null);
    expect(withoutCustomer.factors.customerId).toBeUndefined();
  });

  it("returns model version in result", () => {
    const result = service.computeScore(makeProfile({}), "cust-1");
    expect(result.modelVersion).toBeDefined();
    expect(typeof result.modelVersion).toBe("string");
    expect(result.modelVersion.length).toBeGreaterThan(0);
  });
});
