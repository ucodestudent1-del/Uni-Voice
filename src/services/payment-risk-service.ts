import { query } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { invoiceRepository } from "../repositories/invoice.repo.js";

export interface CustomerPaymentHistory {
  customerId: string | null;
  customerName: string | null;
  invoices: Array<{
    id: string;
    total: number;
    amountDue: number;
    dueDate: Date | null;
    sentAt: Date | null;
    paidAt: Date | null;
    status: string;
    createdAt: Date;
  }>;
}

export interface RiskScoreResult {
  score: number;
  factors: Record<string, unknown>;
  confidence: number;
  modelVersion: string;
}

export interface RiskProfile {
  businessId: string;
  customerId: string | null;
  avgPaymentDays: number;
  medianPaymentDays: number;
  paymentStdDev: number;
  collectionRate: number;
  disputeRate: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  lastPaidAt: Date | null;
}

const MODEL_VERSION = "1.0.0";

const INDUSTRY_DEFAULTS: Record<string, RiskProfile> = {
  default: {
    businessId: "",
    customerId: null,
    avgPaymentDays: 30,
    medianPaymentDays: 28,
    paymentStdDev: 15,
    collectionRate: 85,
    disputeRate: 5,
    invoiceCount: 0,
    paidInvoiceCount: 0,
    lastPaidAt: null,
  },
};

export class PaymentRiskService {
  /**
   * Compute a risk score (0-100) for a single invoice based on customer payment history.
   * 0 = lowest risk, 100 = highest risk.
   */
  async scoreInvoice(
    businessId: string,
    invoiceId: string,
    customerId: string | null | undefined
  ): Promise<RiskScoreResult> {
    if (!customerId) {
      return {
        score: 50,
        factors: { reason: "no_customer", message: "Customer not linked — using business average" },
        confidence: 0.3,
        modelVersion: MODEL_VERSION,
      };
    }

    const profile = await this.getCustomerRiskProfile(businessId, customerId);

    if (profile.invoiceCount === 0) {
      const bizAvg = await this.getBusinessAverage(businessId);
      return this.computeScore(bizAvg, null);
    }

    return this.computeScore(profile, profile.customerId);
  }

  /**
   * Batch score all outstanding invoices for a business.
   * Runs as a background job (cron_create).
   */
  async batchScoreBusiness(businessId: string): Promise<{ scored: number; failed: number }> {
    let scored = 0;
    let failed = 0;

    try {
      const invoices = await invoiceRepository.getOutstandingInvoicesForScoring(businessId);

      const customerIds = Array.from(new Set(invoices.map(i => i.customerId).filter(Boolean)));
      const profiles = new Map<string, RiskProfile>();

      for (const cid of customerIds as string[]) {
        const p = await this.getCustomerRiskProfile(businessId, cid);
        profiles.set(cid, p);
      }

      for (const inv of invoices) {
        try {
          const profile = inv.customerId ? profiles.get(inv.customerId) : null;
          let scoreResult: RiskScoreResult;
          if (profile) {
            scoreResult = this.computeScore(profile, profile.customerId);
          } else {
            scoreResult = await this.scoreInvoice(businessId, inv.id, inv.customerId);
          }

          await invoiceRepository.updateRiskScore(inv.id, businessId, scoreResult.score, scoreResult.factors);
          scored++;
        } catch (err) {
          logger.warn({ err, invoiceId: inv.id }, "Failed to score invoice risk");
          failed++;
        }
      }

      logger.info({ businessId, scored, failed }, "Batch risk scoring complete");
    } catch (err) {
      logger.error({ err, businessId }, "Batch risk scoring failed");
    }

    return { scored, failed };
  }

  /**
   * Get all risk-scored invoices for dashboard/aging report display.
   */
  async getRiskScoredInvoices(businessId: string, limit = 50) {
    return invoiceRepository.getRiskScoredInvoices(businessId, limit);
  }

  /**
   * Get or compute the risk profile for a specific customer.
   * Falls back to business average when customer has no paid invoices.
   */
  private async getCustomerRiskProfile(businessId: string, customerId: string): Promise<RiskProfile> {
    const cached = await invoiceRepository.getCustomerPaymentProfile(businessId, customerId);
    if (cached && cached.invoiceCount >= 3) {
      return { businessId, customerId, ...cached };
    }

    // Build profile from raw invoice data
    return this.buildRiskProfile(businessId, customerId);
  }

  private async getBusinessAverage(businessId: string): Promise<RiskProfile> {
    const metrics = await invoiceRepository.getPaymentMetrics(businessId, new Date());
    return {
      businessId,
      customerId: null,
      avgPaymentDays: metrics.averagePaymentTimeDays,
      medianPaymentDays: metrics.averagePaymentTimeDays,
      paymentStdDev: 20,
      collectionRate: metrics.collectionRate,
      disputeRate: 5,
      invoiceCount: metrics.paidInvoiceCount,
      paidInvoiceCount: metrics.paidInvoiceCount,
      lastPaidAt: null,
    };
  }

  private async buildRiskProfile(businessId: string, customerId: string): Promise<RiskProfile> {
    const res = await query(
      `SELECT i.total, i.amount_due, i.due_date, i.sent_at, i.paid_at, i.status, i.created_at
       FROM invoices i
       WHERE i.business_id = $1 AND i.customer_id = $2
         AND i.is_finalized = TRUE`,
      [businessId, customerId]
    );

    const invoices = res.rows;
    const paidInvoices = invoices.filter(
      (i) => i.paid_at && (i.status === "paid" || i.status === "partially_paid")
    );

    const paymentTimes = paidInvoices.map((i) => {
      const sent = i.sent_at ? new Date(i.sent_at) : new Date(i.created_at);
      const paid = new Date(i.paid_at);
      return Math.max(0, (paid.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24));
    });

    let avgPaymentDays = 0;
    let medianPaymentDays = 0;
    let paymentStdDev = 0;
    let lastPaidAt: Date | null = null;

    if (paymentTimes.length > 0) {
      const sorted = [...paymentTimes].sort((a, b) => a - b);
      avgPaymentDays = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      medianPaymentDays = sorted[Math.floor(sorted.length / 2)];
      const variance = sorted.reduce((sum, v) => sum + Math.pow(v - avgPaymentDays, 2), 0) / sorted.length;
      paymentStdDev = Math.sqrt(variance);
      lastPaidAt = new Date(Math.max(...paidInvoices.map((i) => new Date(i.paid_at).getTime())));
    }

    const disputeRes = await query(
      `SELECT COUNT(*) as disputes, COUNT(DISTINCT i.id) as total
       FROM invoices i
       LEFT JOIN credit_notes cn ON cn.reference_invoice_id = i.id
       WHERE i.business_id = $1 AND i.customer_id = $2`,
      [businessId, customerId]
    );
    const disputeCount = Number(disputeRes.rows[0]?.disputes ?? 0);
    const totalInvoiceCount = Number(disputeRes.rows[0]?.total ?? invoices.length);
    const disputeRate = totalInvoiceCount > 0 ? (disputeCount / totalInvoiceCount) * 100 : 0;

    const collectionRate = invoices.length > 0
      ? (paidInvoices.length / invoices.length) * 100
      : 0;

    const profile: RiskProfile = {
      businessId,
      customerId,
      avgPaymentDays,
      medianPaymentDays,
      paymentStdDev,
      collectionRate,
      disputeRate,
      invoiceCount: invoices.length,
      paidInvoiceCount: paidInvoices.length,
      lastPaidAt,
    };

    // Persist profile for future fast lookups
    try {
      await invoiceRepository.upsertCustomerPaymentProfile(businessId, customerId, {
        avgPaymentDays: Number(avgPaymentDays.toFixed(2)),
        medianPaymentDays: Number(medianPaymentDays.toFixed(2)),
        paymentStdDev: Number(paymentStdDev.toFixed(2)),
        collectionRate: Number(collectionRate.toFixed(2)),
        disputeRate: Number(disputeRate.toFixed(2)),
        invoiceCount: invoices.length,
        paidInvoiceCount: paidInvoices.length,
        lastPaidAt,
      });
    } catch (err) {
      logger.debug({ err, customerId }, "Failed to persist payment profile");
    }

    return profile;
  }

  /**
  /**
   * Compute risk score from a payment profile using weighted heuristics.
   *
   * Features:
   * 1. avg_payment_days vs standard terms (30d) — primary driver
   * 2. collection_rate — secondary driver
   * 3. dispute_rate — penalty factor
   * 4. payment_std_dev — consistency indicator
   * 5. invoice_count — data sufficiency (affects confidence)
   */
  computeScore(profile: RiskProfile, customerId: string | null): RiskScoreResult {
    const STANDARD_TERMS_DAYS = 30;

    // Component 1: Payment latency (0-55 points)
    const latencyRatio = profile.avgPaymentDays / STANDARD_TERMS_DAYS;
    const latencyScore = Math.min(55, Math.max(0, latencyRatio * 40 + 15));

    // Component 2: Collection rate (0-25 points)
    const collectionScore = (100 - profile.collectionRate) * 0.25;

    // Component 3: Dispute rate (0-10 points)
    const disputeScore = Math.min(10, profile.disputeRate * 2);

    // Component 4: Payment inconsistency (0-10 points)
    const consistencyScore = Math.min(10, profile.paymentStdDev / 15);

    const rawScore = latencyScore + collectionScore + disputeScore + consistencyScore;
    const score = Math.round(Math.min(100, Math.max(0, rawScore)));

    // Confidence based on data sufficiency
    let confidence: number;
    if (profile.invoiceCount >= 10) {
      confidence = 0.9;
    } else if (profile.invoiceCount >= 3) {
      confidence = 0.7;
    } else if (profile.invoiceCount > 0) {
      confidence = 0.5;
    } else {
      confidence = 0.3;
    }

    const factors: Record<string, unknown> = {
      avgPaymentDays: Math.round(profile.avgPaymentDays),
      standardTermsDays: STANDARD_TERMS_DAYS,
      collectionRate: Math.round(profile.collectionRate),
      disputeRate: Math.round(profile.disputeRate),
      paymentStdDev: Math.round(profile.paymentStdDev),
      invoiceCount: profile.invoiceCount,
      confidence,
    };

    if (customerId) {
      factors.customerId = customerId;
    }

    return {
      score,
      factors,
      confidence,
      modelVersion: MODEL_VERSION,
    };
  }
}

export const paymentRiskService = new PaymentRiskService();

// Re-export for cron usage
export { paymentRiskService as default };
