import { query } from "../db/pool.js";
import type { Plan, FeatureFlag, BusinessSubscription, UsageQuota, SubscriptionEvent, PlanCode, SubscriptionStatus } from "../domain/subscription.js";
import { rowToDate } from "./helpers.js";

export interface PlanInput {
  code: PlanCode;
  name: string;
  description?: string | null;
  priceMonthly: number;
  priceYearly: number;
  currency?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface SubscriptionInput {
  businessId: string;
  planId: string;
  status?: SubscriptionStatus;
  billingCycle?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date | null;
  stripeSubscriptionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UsageQuotaInput {
  businessId: string;
  featureCode: string;
  periodStart: Date;
  periodEnd: Date;
  limitCount: number;
  metadata?: Record<string, unknown>;
}

export class SubscriptionRepository {
  // Plans
  async createPlan(input: PlanInput): Promise<Plan> {
    const res = await query(
      `INSERT INTO plans (code, name, description, price_monthly, price_yearly, currency, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [input.code, input.name, input.description, input.priceMonthly, input.priceYearly, input.currency ?? "USD", input.isActive ?? true, input.sortOrder ?? 0]
    );
    return this.rowToPlan(res.rows[0]);
  }

  async findPlanByCode(code: PlanCode): Promise<Plan | null> {
    const res = await query("SELECT * FROM plans WHERE code = $1", [code]);
    if (!res.rows.length) return null;
    return this.rowToPlan(res.rows[0]);
  }

  async listPlans(): Promise<Plan[]> {
    const res = await query("SELECT * FROM plans ORDER BY sort_order, code");
    return res.rows.map((r) => this.rowToPlan(r));
  }

  async updatePlan(planId: string, input: Partial<PlanInput>): Promise<Plan> {
    const fields: string[] = [];
    const vals: unknown[] = [planId];
    let i = 2;
    for (const [key, val] of Object.entries(input)) {
      if (key === "priceMonthly") fields.push(`price_monthly = $${i++}`);
      else if (key === "priceYearly") fields.push(`price_yearly = $${i++}`);
      else if (key === "sortOrder") fields.push(`sort_order = $${i++}`);
      else fields.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }
    fields.push("updated_at = NOW()");
    const res = await query(`UPDATE plans SET ${fields.join(", ")} WHERE id = $1 RETURNING *`, vals);
    if (!res.rows.length) throw new Error("Plan not found");
    return this.rowToPlan(res.rows[0]);
  }

  private rowToPlan(r: Record<string, unknown>): Plan {
    return {
      id: r.id as string,
      code: r.code as Plan["code"],
      name: r.name as string,
      description: r.description as string | null,
      priceMonthly: Number(r.price_monthly),
      priceYearly: Number(r.price_yearly),
      currency: r.currency as string,
      isActive: Boolean(r.is_active),
      sortOrder: Number(r.sort_order),
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }

  // Feature Flags
  async createFeatureFlag(input: { code: string; name: string; description?: string | null; category?: string; isPremium?: boolean; requiresPlan?: PlanCode; metadata?: Record<string, unknown> }): Promise<FeatureFlag> {
    const res = await query(
      `INSERT INTO feature_flags (code, name, description, category, is_premium, requires_plan, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [input.code, input.name, input.description, input.category ?? "general", input.isPremium ?? false, input.requiresPlan ?? null, JSON.stringify(input.metadata ?? {})]
    );
    return this.rowToFeatureFlag(res.rows[0]);
  }

  async findFeatureFlagByCode(code: string): Promise<FeatureFlag | null> {
    const res = await query("SELECT * FROM feature_flags WHERE code = $1", [code]);
    if (!res.rows.length) return null;
    return this.rowToFeatureFlag(res.rows[0]);
  }

  async listFeatureFlags(): Promise<FeatureFlag[]> {
    const res = await query("SELECT * FROM feature_flags ORDER BY category, code");
    return res.rows.map((r) => this.rowToFeatureFlag(r));
  }

  async listPremiumFeatureFlags(planCode: PlanCode): Promise<FeatureFlag[]> {
    const res = await query(
      `SELECT * FROM feature_flags WHERE is_premium = TRUE AND (requires_plan IS NULL OR requires_plan <= $1::subscription_plan) ORDER BY category, code`,
      [planCode]
    );
    return res.rows.map((r) => this.rowToFeatureFlag(r));
  }

  private rowToFeatureFlag(r: Record<string, unknown>): FeatureFlag {
    return {
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      description: r.description as string | null,
      category: r.category as string,
      isPremium: Boolean(r.is_premium),
      requiresPlan: r.requires_plan as FeatureFlag["requiresPlan"],
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }

  // Business Subscriptions
  async createSubscription(input: SubscriptionInput): Promise<BusinessSubscription> {
    const res = await query(
      `INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_ends_at, stripe_subscription_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        input.businessId, input.planId, input.status ?? "active", input.billingCycle ?? "monthly",
        input.currentPeriodStart?.toISOString() ?? new Date().toISOString(),
        input.currentPeriodEnd?.toISOString() ?? new Date().toISOString(),
        input.trialEndsAt?.toISOString() ?? null,
        input.stripeSubscriptionId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    return this.rowToSubscription(res.rows[0]);
  }

  async findSubscriptionByBusinessId(businessId: string): Promise<BusinessSubscription | null> {
    const res = await query("SELECT * FROM business_subscriptions WHERE business_id = $1", [businessId]);
    if (!res.rows.length) return null;
    return this.rowToSubscription(res.rows[0]);
  }

  async updateSubscription(subscriptionId: string, input: Partial<SubscriptionInput>): Promise<BusinessSubscription> {
    const fields: string[] = [];
    const vals: unknown[] = [subscriptionId];
    let i = 2;
    for (const [key, val] of Object.entries(input)) {
      if (key === "currentPeriodStart") fields.push(`current_period_start = $${i++}`);
      else if (key === "currentPeriodEnd") fields.push(`current_period_end = $${i++}`);
      else if (key === "trialEndsAt") fields.push(`trial_ends_at = $${i++}`);
      else if (key === "stripeSubscriptionId") fields.push(`stripe_subscription_id = $${i++}`);
      else fields.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }
    fields.push("updated_at = NOW()");
    const res = await query(`UPDATE business_subscriptions SET ${fields.join(", ")} WHERE id = $1 RETURNING *`, vals);
    if (!res.rows.length) throw new Error("Subscription not found");
    return this.rowToSubscription(res.rows[0]);
  }

  async updateSubscriptionByBusinessId(businessId: string, input: Partial<SubscriptionInput>): Promise<BusinessSubscription> {
    const fields: string[] = [];
    const vals: unknown[] = [businessId];
    let i = 2;
    for (const [key, val] of Object.entries(input)) {
      if (key === "currentPeriodStart") fields.push(`current_period_start = $${i++}`);
      else if (key === "currentPeriodEnd") fields.push(`current_period_end = $${i++}`);
      else if (key === "trialEndsAt") fields.push(`trial_ends_at = $${i++}`);
      else if (key === "stripeSubscriptionId") fields.push(`stripe_subscription_id = $${i++}`);
      else fields.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }
    fields.push("updated_at = NOW()");
    const res = await query(`UPDATE business_subscriptions SET ${fields.join(", ")} WHERE business_id = $1 RETURNING *`, vals);
    if (!res.rows.length) throw new Error("Subscription not found");
    return this.rowToSubscription(res.rows[0]);
  }

  async changePlan(businessId: string, newPlanId: string, fromPlan: PlanCode, toPlan: PlanCode): Promise<BusinessSubscription> {
    const sub = await this.updateSubscriptionByBusinessId(businessId, { planId: newPlanId, status: "active" });
    await this.recordSubscriptionEvent(businessId, sub.id, "plan_changed", fromPlan, toPlan);
    return sub;
  }

  private rowToSubscription(r: Record<string, unknown>): BusinessSubscription {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      planId: r.plan_id as string,
      status: r.status as BusinessSubscription["status"],
      billingCycle: r.billing_cycle as string,
      currentPeriodStart: rowToDate(r.current_period_start)!,
      currentPeriodEnd: rowToDate(r.current_period_end)!,
      trialEndsAt: rowToDate(r.trial_ends_at),
      cancelledAt: rowToDate(r.cancelled_at),
      stripeSubscriptionId: r.stripe_subscription_id as string | null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }

  // Usage Quotas
  async incrementUsage(businessId: string, featureCode: string, periodStart: Date, periodEnd: Date, limitCount: number): Promise<UsageQuota> {
    const res = await query(
      `INSERT INTO usage_quotas (business_id, feature_code, period_start, period_end, used_count, limit_count)
       VALUES ($1,$2,$3,$4,1,$5)
       ON CONFLICT (business_id, feature_code, period_start)
       DO UPDATE SET used_count = usage_quotas.used_count + 1, updated_at = NOW()
       RETURNING *`,
      [businessId, featureCode, periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10), limitCount]
    );
    return this.rowToUsageQuota(res.rows[0]);
  }

  async getUsageQuota(businessId: string, featureCode: string, periodStart: Date): Promise<UsageQuota | null> {
    const res = await query(
      `SELECT * FROM usage_quotas WHERE business_id = $1 AND feature_code = $2 AND period_start = $3`,
      [businessId, featureCode, periodStart.toISOString().slice(0, 10)]
    );
    if (!res.rows.length) return null;
    return this.rowToUsageQuota(res.rows[0]);
  }

  async upsertUsageQuota(input: UsageQuotaInput): Promise<UsageQuota> {
    const res = await query(
      `INSERT INTO usage_quotas (business_id, feature_code, period_start, period_end, used_count, limit_count, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (business_id, feature_code, period_start)
       DO UPDATE SET limit_count = EXCLUDED.limit_count, metadata = EXCLUDED.metadata, updated_at = NOW()
       RETURNING *`,
      [input.businessId, input.featureCode, input.periodStart.toISOString().slice(0, 10), input.periodEnd.toISOString().slice(0, 10), 0, input.limitCount, JSON.stringify(input.metadata ?? {})]
    );
    return this.rowToUsageQuota(res.rows[0]);
  }

  private rowToUsageQuota(r: Record<string, unknown>): UsageQuota {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      featureCode: r.feature_code as string,
      periodStart: rowToDate(r.period_start)!,
      periodEnd: rowToDate(r.period_end)!,
      usedCount: Number(r.used_count),
      limitCount: Number(r.limit_count),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }

  // Subscription Events
  async recordSubscriptionEvent(businessId: string, subscriptionId: string, eventType: string, fromPlan?: PlanCode, toPlan?: PlanCode, metadata?: Record<string, unknown>): Promise<SubscriptionEvent> {
    const res = await query(
      `INSERT INTO subscription_events (business_id, subscription_id, event_type, from_plan, to_plan, metadata)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [businessId, subscriptionId, eventType, fromPlan ?? null, toPlan ?? null, JSON.stringify(metadata ?? {})]
    );
    return this.rowToSubscriptionEvent(res.rows[0]);
  }

  async getSubscriptionEvents(businessId: string, limit = 50): Promise<SubscriptionEvent[]> {
    const res = await query(
      `SELECT * FROM subscription_events WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [businessId, limit]
    );
    return res.rows.map((r) => this.rowToSubscriptionEvent(r));
  }

  private rowToSubscriptionEvent(r: Record<string, unknown>): SubscriptionEvent {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      subscriptionId: r.subscription_id as string,
      eventType: r.event_type as string,
      fromPlan: r.from_plan as PlanCode | undefined,
      toPlan: r.to_plan as PlanCode | undefined,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: rowToDate(r.created_at)!,
    };
  }
}

export const subscriptionRepository = new SubscriptionRepository();
