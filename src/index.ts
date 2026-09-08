import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { env, isDev } from "./config/index.js";
import { query } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { subscriptionService } from "./services/subscription.service.js";
import { requireAuth, AuthRequest, generateToken } from "./middleware/auth.js";
import { requireEntitlement, requireUsageLimit } from "./middleware/entitlement.js";
import { invoiceService } from "./services/invoice-service.js";
import { businessRepository } from "./repositories/business.repo.js";
import { customerRepository } from "./repositories/customer.repo.js";
import { productRepository } from "./repositories/product.repo.js";
import { invoiceRepository } from "./repositories/invoice.repo.js";
import { subscriptionRepository } from "./repositories/subscription.repo.js";
import { logger } from "./utils/logger.js";
import { stripeService } from "./services/payments/stripe-service.js";
import bcrypt from "bcrypt";

const app = express();

app.use(helmet());
app.use(cors({ origin: isDev ? true : env.APP_PUBLIC_BASE_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
if (isDev) app.use(morgan("dev"));

// Health
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", env: env.APP_ENV, timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({
    name: "universal-invoice-generator",
    version: "1.0.0",
    status: "ok",
    docs: "/api/health",
    endpoints: ["/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/plans", "/api/invoices", "/api/customers", "/api/products"],
  });
});

// ============================================================================
// AUTH
// ============================================================================
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length) return res.status(409).json({ error: "User already exists" });

  const userId = crypto.randomUUID();
  const businessId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 10);

  await query("BEGIN");
  try {
    await query(
      `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1,$2,$3,$4,$4)`,
      [userId, email, passwordHash, now]
    );
    await query(
      `INSERT INTO businesses (id, owner_id, name, country_code, default_currency, created_at, updated_at) VALUES ($1,$2,$3,'US','USD',$4,$4)`,
      [businessId, userId, name || "My Business", now]
    );
    await query(
      `INSERT INTO business_settings (business_id, default_currency, time_zone, locale, created_at, updated_at) VALUES ($1,'USD','UTC','en-US',$2,$2)`,
      [businessId, now]
    );
    await query("COMMIT");
  } catch (e) {
    await query("ROLLBACK");
    throw e;
  }

  const token = generateToken(userId, businessId, email);
  res.status(201).json({ token, user: { id: userId, businessId, email } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const result = await query("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
  if (!result.rows.length) return res.status(401).json({ error: "Invalid credentials" });

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const subResult = await query("SELECT business_id FROM businesses WHERE owner_id = $1 LIMIT 1", [user.id]);
  const businessId = subResult.rows[0]?.business_id;

  const token = generateToken(user.id, businessId, user.email);
  res.json({ token, user: { id: user.id, businessId, email: user.email } });
});

app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const sub = await subscriptionRepository.findSubscriptionByBusinessId(req.user!.businessId!);
  const plan = sub ? await subscriptionService.getPlanById(sub.planId) : null;
  res.json({ user: req.user, subscription: sub, plan });
});

// ============================================================================
// PLANS & SUBSCRIPTIONS
// ============================================================================
app.get("/api/plans", async (_req, res) => {
  const plans = await subscriptionRepository.listPlans();
  res.json({ plans });
});

app.get("/api/subscription/current", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const ctx = await subscriptionService.getSubscriptionContext(req.user!.businessId);
  const plan = await subscriptionService.getPlanById(ctx.subscription.planId);
  res.json({ subscription: ctx.subscription, plan });
});

app.post("/api/subscription/upgrade", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { planCode, billingCycle } = req.body;
  if (!planCode) return res.status(400).json({ error: "planCode required" });

  const plans = await subscriptionRepository.listPlans();
  const plan = plans.find((p: any) => p.code === planCode);
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const business = await businessRepository.findById(req.user!.businessId, req.user!.id);
  const cycle = billingCycle ?? "monthly";

  const session = await stripeService.createCheckoutSession({
    planId: plan.id,
    planCode: plan.code,
    planName: plan.name,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    currency: plan.currency,
    billingCycle: cycle,
    businessId: req.user!.businessId,
    customerEmail: business.email ?? undefined,
    successUrl: `${env.APP_PUBLIC_BASE_URL}/plans?success=true`,
    cancelUrl: `${env.APP_PUBLIC_BASE_URL}/plans?canceled=true`,
  });

  res.json({ checkoutUrl: session.url, sessionId: session.sessionId });
});

app.post("/api/subscription/downgrade", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { planCode } = req.body;
  if (!planCode) return res.status(400).json({ error: "planCode required" });

  const sub = await subscriptionService.downgradeBusiness(req.user!.businessId, planCode);
  const plan = await subscriptionService.getPlanById(sub.planId);
  res.json({ subscription: sub, plan });
});

app.get("/api/stripe/config", async (_req, res) => {
  res.json({ publishableKey: env.STRIPE_PUBLISHABLE_KEY });
});

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req: express.Request, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    return res.status(400).send("Missing stripe-signature");
  }

  try {
    const event = await stripeService.constructWebhookEvent(req.body as Buffer, signature);
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (err: any) {
    logger.error({ err }, "Stripe webhook failed");
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.get("/api/subscription/events", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const events = await subscriptionRepository.getSubscriptionEvents(req.user!.businessId);
  res.json({ events });
});

// ============================================================================
// BUSINESSES
// ============================================================================
app.get("/api/businesses/current", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const business = await businessRepository.findById(req.user!.businessId, req.user.id);
  res.json({ business });
});

app.patch("/api/businesses/current", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const business = await businessRepository.update(req.user!.businessId, req.body, req.user.id);
  res.json({ business });
});

// ============================================================================
// CUSTOMERS
// ============================================================================
app.get("/api/customers", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const customers = await customerRepository.findMany(req.user!.businessId, limit, offset);
  res.json({ customers, limit, offset });
});

app.post("/api/customers", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await requireUsageLimit("customers.unlimited", true)(req as any, res, async () => {
    const customer = await customerRepository.create(req.user!.businessId!, req.body);
    res.status(201).json({ customer });
  });
});

app.get("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const customer = await customerRepository.findById(req.user!.businessId, req.params.id);
  res.json({ customer });
});

app.patch("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const customer = await customerRepository.update(req.user!.businessId, req.params.id, req.body);
  res.json({ customer });
});

app.delete("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await customerRepository.delete(req.user!.businessId, req.params.id);
  res.status(204).send();
});

// ============================================================================
// PRODUCTS
// ============================================================================
app.get("/api/products", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const products = await productRepository.findMany(req.user!.businessId, limit, offset);
  res.json({ products, limit, offset });
});

app.post("/api/products", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const product = await productRepository.create(req.user!.businessId, req.body);
  res.status(201).json({ product });
});

app.get("/api/products/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const product = await productRepository.findById(req.user!.businessId, req.params.id);
  res.json({ product });
});

app.patch("/api/products/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const product = await productRepository.update(req.user!.businessId, req.params.id, req.body);
  res.json({ product });
});

app.delete("/api/products/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await productRepository.delete(req.user!.businessId, req.params.id);
  res.status(204).send();
});

// ============================================================================
// INVOICES
// ============================================================================
app.get("/api/invoices", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const status = req.query.status as string | undefined;
  const customerId = req.query.customerId as string | undefined;
  const invoices = await invoiceRepository.findMany(req.user!.businessId, { status, customerId, limit, offset });
  res.json({ invoices, limit, offset });
});

app.post("/api/invoices", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await requireUsageLimit("invoices.unlimited", true)(req as any, res, async () => {
    const invoiceId = await invoiceService.createDraft(req.body, req.user!.businessId!, req.user!.id);
    res.status(201).json({ invoiceId });
  });
});

app.get("/api/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const summary = await invoiceService.getInvoice(req.user!.businessId, req.params.id);
  res.json(summary);
});

app.patch("/api/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const id = await invoiceService.updateDraft(req.user!.businessId, req.params.id, req.body, req.user.id);
  res.json({ invoiceId: id });
});

app.put("/api/invoices/:id/items", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await invoiceService.setItems(req.user!.businessId, req.params.id, req.body as any, req.user.id);
  res.json({ ok: true });
});

app.put("/api/invoices/:id/fees", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await invoiceService.setFees(req.user!.businessId, req.params.id, req.body as any, req.user.id);
  res.json({ ok: true });
});

app.post("/api/invoices/:id/finalize", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await invoiceService.finalize(req.user!.businessId, req.params.id, req.user.id);
  res.json(result);
});

app.post("/api/invoices/:id/send", requireAuth, requireEntitlement("reminders.automated"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await invoiceService.send(req.user!.businessId, req.params.id, req.user.id);
  res.json({ ok: true });
});

app.post("/api/invoices/:id/pdf", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const pdf = await invoiceService.generatePdf(req.user!.businessId, req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${req.params.id}.pdf`);
  res.send(pdf);
});

app.get("/api/invoices/:id/events", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const events = await invoiceRepository.getEvents(req.params.id, req.user!.businessId);
  res.json({ events });
});

app.post("/api/invoices/:id/duplicate", requireAuth, requireEntitlement("invoices.duplicate"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const original = await invoiceRepository.findById(req.user!.businessId, req.params.id);
  const newId = await invoiceService.createDraft({
    customerId: original.customerId,
    currency: original.currency,
    notes: original.notes,
    terms: original.terms,
    templateId: original.templateId,
    paymentInstructions: original.paymentInstructions,
    items: original.items.map((it) => ({
      productId: it.productId,
      description: it.description,
      quantity: Number(it.quantity),
      unit: it.unit,
      unitPrice: Number(it.unitPrice),
      discount: Number(it.discount),
      discountType: it.discountType,
      taxRate: Number(it.taxRate),
      isTaxInclusive: it.isTaxInclusive,
    })),
    fees: original.fees.map((f) => ({
      description: f.description,
      amount: Number(f.amount),
      taxRate: Number(f.taxRate),
    })),
  }, req.user!.businessId, req.user.id);
  res.status(201).json({ invoiceId: newId });
});

// ============================================================================
// QUOTES (Business tier)
// ============================================================================
app.get("/api/quotes", requireAuth, requireEntitlement("quotes.create"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await query("SELECT * FROM quotes WHERE business_id = $1 ORDER BY created_at DESC LIMIT 200", [req.user!.businessId]);
  res.json({ quotes: result.rows });
});

app.post("/api/quotes", requireAuth, requireEntitlement("quotes.create"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO quotes (id, business_id, customer_id, currency, issue_date, due_date, notes, terms, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
    [id, req.user!.businessId, req.body.customerId, req.body.currency ?? "USD", req.body.issueDate?.toISOString(), req.body.dueDate?.toISOString(), req.body.notes, req.body.terms, now]
  );
  res.status(201).json({ quoteId: id });
});

app.post("/api/quotes/:id/convert", requireAuth, requireEntitlement("quotes.convert"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const quoteResult = await query("SELECT * FROM quotes WHERE id = $1 AND business_id = $2", [req.params.id, req.user!.businessId]);
  if (!quoteResult.rows.length) return res.status(404).json({ error: "Quote not found" });

  const quote = quoteResult.rows[0];
  const invoiceId = await invoiceService.createDraft({
    customerId: quote.customer_id,
    currency: quote.currency,
    notes: quote.notes,
    terms: quote.terms,
  }, req.user!.businessId, req.user.id);

  await query("UPDATE quotes SET converted_invoice_id = $1, status = 'accepted', updated_at = NOW() WHERE id = $2", [invoiceId, req.params.id]);
  res.status(201).json({ invoiceId });
});

// ============================================================================
// RECURRING INVOICES (Pro tier)
// ============================================================================
app.get("/api/recurring", requireAuth, requireEntitlement("invoices.recurring"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await query("SELECT * FROM recurring_invoices WHERE business_id = $1 ORDER BY created_at DESC LIMIT 200", [req.user!.businessId]);
  res.json({ recurringInvoices: result.rows });
});

app.post("/api/recurring", requireAuth, requireEntitlement("invoices.recurring"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await query(
    `INSERT INTO recurring_invoices (id, business_id, customer_id, name, frequency, interval_count, next_generation_at, end_date, currency, notes, terms, is_active, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,
    [id, req.user!.businessId, req.body.customerId, req.body.name, req.body.frequency, req.body.intervalCount ?? 1,
     req.body.nextGenerationAt?.toISOString(), req.body.endDate?.toISOString(), req.body.currency ?? "USD",
     req.body.notes, req.body.terms, req.body.isActive ?? true, now]
  );
  res.status(201).json({ recurringInvoiceId: id });
});

// ============================================================================
// REPORTS (Business tier)
// ============================================================================
app.get("/api/reports/revenue", requireAuth, requireEntitlement("reports.revenue"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await query(
    `SELECT status, COUNT(*) as count, SUM(total) as total_amount, SUM(amount_paid) as paid_amount
     FROM invoices WHERE business_id = $1 GROUP BY status ORDER BY status`,
    [req.user!.businessId]
  );
  res.json({ report: result.rows });
});

app.get("/api/reports/tax-summary", requireAuth, requireEntitlement("reports.tax_summary"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await query(
    `SELECT DATE_TRUNC('month', created_at) as month, SUM(tax_total) as tax_total
     FROM invoices WHERE business_id = $1 AND is_finalized = TRUE GROUP BY month ORDER BY month DESC LIMIT 12`,
    [req.user!.businessId]
  );
  res.json({ report: result.rows });
});

// ============================================================================
// EXPORTS (Pro/Business tier)
// ============================================================================
app.get("/api/export/invoices/csv", requireAuth, requireEntitlement("export.csv"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await query("SELECT * FROM invoices WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1000", [req.user!.businessId]);
  const headers = ["id", "invoice_number", "status", "customer_id", "currency", "total", "amount_paid", "amount_due", "issue_date", "due_date", "created_at"];
  const csvRows = [headers.join(",")];
  for (const row of result.rows) {
    csvRows.push(headers.map((h) => JSON.stringify(row[h] ?? "")).join(","));
  }
  const csv = csvRows.join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=invoices.csv");
  res.send(csv);
});

// ============================================================================
// FEATURE FLAGS
// ============================================================================
app.get("/api/features", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const ctx = await subscriptionService.getSubscriptionContext(req.user!.businessId);
  const flags = await subscriptionRepository.listPremiumFeatureFlags(ctx.plan.code);
  const allFlags = await subscriptionRepository.listFeatureFlags();
  res.json({ plan: ctx.plan.code, features: allFlags, premium: flags });
});

// ============================================================================
// STRIPE WEBHOOK HANDLER
// ============================================================================
async function handleStripeEvent(event: any): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const businessId = session.metadata?.businessId;
      const planId = session.metadata?.planId;
      const planCode = session.metadata?.planCode;
      const billingCycle = session.metadata?.billingCycle;

      if (!businessId || !planId) {
        logger.warn("Missing metadata in checkout.session.completed");
        return;
      }

      const sub = await subscriptionRepository.findSubscriptionByBusinessId(businessId);
      if (sub) {
        const stripeSubscriptionId = session.subscription;
        await subscriptionRepository.updateSubscriptionByBusinessId(businessId, {
          planId,
          status: "active",
          billingCycle: billingCycle ?? "monthly",
          stripeSubscriptionId: stripeSubscriptionId ?? null,
        });
        await subscriptionRepository.recordSubscriptionEvent(
          businessId,
          sub.id,
          "checkout_completed",
          undefined,
          planCode,
          { stripeSessionId: session.id }
        );
      }
      break;
    }
    case "customer.subscription.updated": {
      const stripeSub = event.data.object;
      const businessId = await findBusinessByStripeSubscriptionId(stripeSub.id);
      if (!businessId) {
        logger.warn({ subscription: stripeSub.id }, "Business not found for Stripe subscription");
        return;
      }

      const sub = await subscriptionRepository.findSubscriptionByBusinessId(businessId);
      if (!sub) return;

      const status = stripeSub.status === "active" ? "active" :
                     stripeSub.status === "past_due" ? "past_due" :
                     stripeSub.status === "canceled" ? "cancelled" : "active";

      await subscriptionRepository.updateSubscriptionByBusinessId(businessId, { status: status as any });
      await subscriptionRepository.recordSubscriptionEvent(
        businessId,
        sub.id,
        "subscription_updated",
        undefined,
        undefined,
        { stripeStatus: stripeSub.status }
      );
      break;
    }
    case "customer.subscription.deleted": {
      const stripeSub = event.data.object;
      const businessId = await findBusinessByStripeSubscriptionId(stripeSub.id);
      if (!businessId) return;

      const sub = await subscriptionRepository.findSubscriptionByBusinessId(businessId);
      if (!sub) return;

      await subscriptionRepository.updateSubscriptionByBusinessId(businessId, { status: "cancelled" });
      await subscriptionRepository.recordSubscriptionEvent(
        businessId,
        sub.id,
        "subscription_cancelled",
        undefined,
        "free",
        { stripeSubscriptionId: stripeSub.id }
      );

      const freePlan = await subscriptionRepository.findPlanByCode("free");
      if (freePlan) {
        await subscriptionRepository.updateSubscriptionByBusinessId(businessId, { planId: freePlan.id });
      }
      break;
    }
    default:
      logger.info(`Unhandled Stripe event type: ${event.type}`);
  }
}

async function findBusinessByStripeSubscriptionId(stripeSubscriptionId: string): Promise<string | null> {
  const res = await query(
    `SELECT business_id FROM business_subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
    [stripeSubscriptionId]
  );
  if (!res.rows.length) return null;
  return res.rows[0].business_id as string;
}

// ============================================================================
// FRONTEND FALLBACK (production SPA)
// ============================================================================
const FRONTEND_DIST = path.join(process.cwd(), "webapp", "dist");

if (!isDev) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  if (err instanceof Error && "statusCode" in err) {
    return res.status((err as any).statusCode).json({ error: err.message, code: (err as any).code });
  }
  res.status(500).json({ error: "Internal server error" });
});

const PORT = env.PORT;

async function start() {
  await runMigrations();
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT} (env=${env.APP_ENV})`);
    subscriptionService.ensureDefaults().catch((e) => logger.error({ err: e }, "Failed to seed defaults"));
  });
}

start();

export default app;
