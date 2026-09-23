import { subscriptionRepository } from "../repositories/subscription.repo.js";
import type { PlanCode, Plan, BusinessSubscription, EntitlementCheck } from "../domain/subscription.js";
import { rowToDate } from "../repositories/helpers.js";
import { getRequestContext } from "../db/pool.js";

const TIER_HIERARCHY: Record<PlanCode, number> = { free: 0, pro: 1, scale: 2, business: 3 };

export interface SubscriptionContext {
  businessId: string;
  plan: Plan;
  subscription: BusinessSubscription;
}

export class SubscriptionService {
  private planCache = new Map<string, Plan>();

  async ensureDefaults(): Promise<void> {
    this.planCache.clear();
    const plans = [
      { code: "free" as PlanCode, name: "Free", description: "Make professional invoices", price: 0, sortOrder: 0 },
      { code: "pro" as PlanCode, name: "Pro", description: "Automate your invoicing", price: 19, sortOrder: 1 },
      { code: "scale" as PlanCode, name: "Scale", description: "Growth tools and automation", price: 30, sortOrder: 2 },
      { code: "business" as PlanCode, name: "Business", description: "Manage your billing and financial workflow", price: 49, sortOrder: 3 },
    ];

    for (const p of plans) {
      const existing = await subscriptionRepository.findPlanByCode(p.code);
      if (!existing) {
        await subscriptionRepository.createPlan(p);
      } else {
        this.planCache.set(p.code, existing);
      }
    }

    const featureFlags = [
      { code: "invoices.create", name: "Create Invoices", category: "invoicing", isPremium: false, requiresPlan: undefined as PlanCode | undefined, metadata: {} },
      { code: "invoices.unlimited", name: "Unlimited Invoices", category: "invoicing", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: { freeLimit: 10 } },
      { code: "invoices.history", name: "Invoice History", category: "invoicing", isPremium: false, requiresPlan: undefined, metadata: {} },
      { code: "invoices.advanced_history", name: "Advanced Invoice History", category: "invoicing", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "customers.create", name: "Create Customers", category: "customers", isPremium: false, requiresPlan: undefined, metadata: {} },
      { code: "customers.unlimited", name: "Unlimited Customers", category: "customers", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: { freeLimit: 5 } },
      { code: "customers.advanced", name: "Advanced Customer Management", category: "customers", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "products.create", name: "Create Products", category: "products", isPremium: false, requiresPlan: undefined, metadata: {} },
      { code: "products.catalog", name: "Product Catalog", category: "products", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "templates.premium", name: "Premium Templates", category: "templates", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "templates.custom_branding", name: "Custom Branding (Logo, Colors, Fonts)", category: "templates", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "templates.no_branding", name: "Remove App Branding", category: "templates", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "invoices.recurring", name: "Recurring Invoices", category: "automation", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "invoices.scheduled", name: "Scheduled Invoices", category: "automation", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "invoices.duplicate", name: "Duplicate Invoices", category: "automation", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "reminders.automated", name: "Automated Payment Reminders", category: "automation", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "payments.links", name: "Payment Links", category: "payments", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "payments.tracking", name: "Payment Status Tracking", category: "payments", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "invoices.custom_terms", name: "Custom Payment Terms", category: "invoicing", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "tax.multiple_rates", name: "Multiple Tax Rates", category: "tax", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "tax.advanced", name: "Advanced Tax Management", category: "tax", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "cloud.sync", name: "Cloud Backup / Sync", category: "data", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "export.csv", name: "CSV/Excel Export", category: "exports", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "export.bulk", name: "Bulk Export", category: "exports", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "quotes.create", name: "Create Quotes/Estimates", category: "quotes", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "quotes.convert", name: "Convert Quote to Invoice", category: "quotes", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "purchase_orders.create", name: "Purchase Orders", category: "purchase_orders", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "receipts.create", name: "Receipts", category: "receipts", isPremium: true, requiresPlan: "scale" as PlanCode, metadata: {} },
      { code: "credit_notes.create", name: "Credit Notes / Refunds", category: "credit_notes", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "statements.customer", name: "Customer Statements", category: "reports", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "reports.revenue", name: "Revenue Dashboard", category: "reports", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "reports.analytics", name: "Paid/Unpaid Analytics", category: "reports", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "reports.tax_summary", name: "Tax Summaries", category: "reports", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "reports.income", name: "Income Reports", category: "reports", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "expenses.tracking", name: "Expense Tracking", category: "expenses", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "reports.profit_loss", name: "Profit & Loss Reporting", category: "reports", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "invoices.custom_fields", name: "Custom Invoice Fields", category: "invoicing", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "documents.custom_numbering", name: "Custom Document Numbering", category: "documents", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "templates.advanced_pdf", name: "Advanced PDF Customization", category: "templates", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "data.backup_export", name: "Data Backup / Export", category: "data", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "api.access", name: "API / Integration Access", category: "integrations", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "business.multiple", name: "Multiple Businesses / Brands", category: "business", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
      { code: "presets.saved", name: "Saved Invoice Presets", category: "invoicing", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "invoices.autonumber", name: "Automatic Invoice Numbering", category: "invoicing", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
      { code: "invoices.multicurrency", name: "Multiple Currencies", category: "invoicing", isPremium: false, requiresPlan: undefined, metadata: {} },
      { code: "invoices.pdf_download", name: "PDF Generation & Download", category: "invoicing", isPremium: false, requiresPlan: undefined, metadata: {} },
      { code: "invoices.basic_templates", name: "Basic Templates", category: "templates", isPremium: false, requiresPlan: undefined, metadata: {} },
      { code: "invoices.basic_customization", name: "Basic Customization", category: "templates", isPremium: false, requiresPlan: undefined, metadata: {} },
      { code: "invoices.status_tracking", name: "Invoice Status Tracking", category: "invoicing", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
       { code: "invoices.late_tracking", name: "Late Payment Tracking", category: "reports", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
       { code: "projects.create", name: "Create Projects", category: "projects", isPremium: false, requiresPlan: undefined as PlanCode | undefined, metadata: {} },
       { code: "projects.unlimited", name: "Unlimited Projects", category: "projects", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: { freeLimit: 5 } },
       { code: "projects.budget_tracking", name: "Project Budget & Financial Tracking", category: "projects", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
       { code: "projects.team_assignment", name: "Project Team Assignment", category: "projects", isPremium: true, requiresPlan: "business" as PlanCode, metadata: {} },
       { code: "projects.invoicing", name: "Create Invoices from Projects", category: "projects", isPremium: true, requiresPlan: "pro" as PlanCode, metadata: {} },
    ];

    for (const f of featureFlags) {
      await subscriptionRepository.upsertFeatureFlag(f);
    }
  }

  async getSubscriptionContext(businessId: string): Promise<SubscriptionContext> {
    const ctx = getRequestContext();
    const cached = ctx?.subscriptionContextCache?.get(businessId) as SubscriptionContext | undefined;
    if (cached) return cached;

    let result = await subscriptionRepository.findSubscriptionWithPlan(businessId);
    if (!result) {
      const freePlan = await this.getPlan("free");
      if (!freePlan) throw new Error("Default plans not initialized");
      const created = await subscriptionRepository.createSubscription({
        businessId,
        planId: freePlan.id,
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      if (!created) {
        // A concurrent request created the subscription; fetch the existing one.
        result = await subscriptionRepository.findSubscriptionWithPlan(businessId);
      } else {
        result = { subscription: created, plan: freePlan };
      }
    }
    if (!result) throw new Error("Failed to create or retrieve subscription");
    const context: SubscriptionContext = { businessId, plan: result.plan, subscription: result.subscription };
    if (ctx) {
      if (!ctx.subscriptionContextCache) ctx.subscriptionContextCache = new Map();
      ctx.subscriptionContextCache.set(businessId, context);
    }
    return context;
  }

  async checkFeature(businessId: string, featureCode: string, context?: SubscriptionContext): Promise<EntitlementCheck> {
    const ctx = context ?? await this.getSubscriptionContext(businessId);
    const planLevel = TIER_HIERARCHY[ctx.plan.code];

    const flag = await subscriptionRepository.findFeatureFlagByCode(featureCode);
    if (!flag) {
      return { featureCode, allowed: true, reason: "Feature not registered; defaulting to allowed" };
    }

    if (!flag.isPremium) {
      return { featureCode, allowed: true };
    }

    const requiredPlan = flag.requiresPlan;
    if (!requiredPlan) {
      return { featureCode, allowed: true };
    }

    const requiredLevel = TIER_HIERARCHY[requiredPlan];
    if (planLevel < requiredLevel) {
      return {
        featureCode,
        allowed: false,
        reason: `Requires ${requiredPlan} plan (current: ${ctx.plan.code})`,
      };
    }

    return { featureCode, allowed: true };
  }

  async checkUsageLimit(businessId: string, featureCode: string, periodStart?: Date, context?: SubscriptionContext): Promise<EntitlementCheck> {
    if (!context) await this.getSubscriptionContext(businessId);
    const now = new Date();
    const start = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);

    const quota = await subscriptionRepository.getUsageQuota(businessId, featureCode, start);
    const limitCount = quota?.limitCount ?? -1;

    if (limitCount === -1) {
      return { featureCode, allowed: true, limitCount: -1, usedCount: quota?.usedCount ?? 0, remaining: -1 };
    }

    const used = quota?.usedCount ?? 0;
    if (used >= limitCount) {
      return {
        featureCode,
        allowed: false,
        reason: `Usage limit reached (${used}/${limitCount}). Upgrade to continue.`,
        limitCount,
        usedCount: used,
        remaining: 0,
      };
    }

    return {
      featureCode,
      allowed: true,
      limitCount,
      usedCount: used,
      remaining: limitCount - used,
    };
  }

  async incrementUsage(businessId: string, featureCode: string, periodStart?: Date): Promise<void> {
    const now = new Date();
    const start = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const existing = await subscriptionRepository.getUsageQuota(businessId, featureCode, start);
    const limitCount = existing?.limitCount ?? -1;

    await subscriptionRepository.incrementUsage(businessId, featureCode, start, end, limitCount);
  }

  async upgradeBusiness(businessId: string, targetPlanCode: PlanCode): Promise<BusinessSubscription> {
    const ctx = await this.getSubscriptionContext(businessId);
    const targetPlan = await this.getPlan(targetPlanCode);
    if (!targetPlan) throw new Error(`Plan ${targetPlanCode} not found`);

    if (TIER_HIERARCHY[targetPlanCode] <= TIER_HIERARCHY[ctx.plan.code]) {
      throw new Error(`Cannot downgrade from ${ctx.plan.code} to ${targetPlanCode} via this endpoint`);
    }

    return subscriptionRepository.changePlan(businessId, targetPlan.id, ctx.plan.code, targetPlanCode);
  }

  async downgradeBusiness(businessId: string, targetPlanCode: PlanCode): Promise<BusinessSubscription> {
    const ctx = await this.getSubscriptionContext(businessId);
    const targetPlan = await this.getPlan(targetPlanCode);
    if (!targetPlan) throw new Error(`Plan ${targetPlanCode} not found`);

    if (TIER_HIERARCHY[targetPlanCode] >= TIER_HIERARCHY[ctx.plan.code]) {
      throw new Error(`Cannot upgrade from ${ctx.plan.code} to ${targetPlanCode} via this endpoint`);
    }

    return subscriptionRepository.changePlan(businessId, targetPlan.id, ctx.plan.code, targetPlanCode);
  }

  async getPlan(code: PlanCode): Promise<Plan | null> {
    if (this.planCache.has(code)) return this.planCache.get(code)!;
    const plan = await subscriptionRepository.findPlanByCode(code);
    if (plan) this.planCache.set(code, plan);
    return plan;
  }

  async getPlanById(planId: string): Promise<Plan | null> {
    if (this.planCache.has(planId)) return this.planCache.get(planId)!;
    const plan = await subscriptionRepository.findPlanById(planId);
    if (plan) this.planCache.set(planId, plan);
    return plan;
  }

  private rowToPlan(r: Record<string, unknown>): Plan {
    return {
      id: r.id as string,
      code: r.code as Plan["code"],
      name: r.name as string,
      description: r.description as string | null,
      price: Number(r.price_monthly),
      currency: r.currency as string,
      isActive: Boolean(r.is_active),
      sortOrder: Number(r.sort_order),
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }
}

export const subscriptionService = new SubscriptionService();
