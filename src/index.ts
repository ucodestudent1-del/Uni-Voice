import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { env, isDev, isTest } from "./config/index.js";
import { query, runWithRequestContext, getRequestContext } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { subscriptionService } from "./services/subscription.service.js";
import { requireAuth, optionalAuth, AuthRequest, generateToken } from "./middleware/auth.js";
import { requireEntitlement, requireUsageLimit } from "./middleware/entitlement.js";
import { twoFactorService } from "./services/auth/two-factor.service.js";
import { oauthService } from "./services/auth/oauth.service.js";
import { invoiceService } from "./services/invoice-service.js";
import { customerService } from "./services/customer-service.js";
import { invoiceNumberService } from "./services/numbering/service.js";
import { businessRepository } from "./repositories/business.repo.js";
import { customerRepository } from "./repositories/customer.repo.js";
import { productRepository } from "./repositories/product.repo.js";
import { productServiceRepository } from "./repositories/product-service.repo.js";
import { productServiceService } from "./services/product-service/product-service.js";
import { invoiceRepository, type InvoiceListOptions, type InvoiceListItem } from "./repositories/invoice.repo.js";
import { templateRepository } from "./repositories/template.repo.js";
import { documentTemplateRepository } from "./repositories/document-template.repo.js";
import { subscriptionRepository } from "./repositories/subscription.repo.js";
import { onboardingRepository } from "./repositories/onboarding.repo.js";
import { onboardingService } from "./services/onboarding.service.js";
import { logger } from "./utils/logger.js";
import { stripeService } from "./services/payments/stripe-service.js";
import {
  DocumentTemplateInputSchema,
  DocumentTemplateUpdateSchema,
} from "./domain/schemas/document-template.js";
import {
  ProjectCreateSchema,
  ProjectUpdateSchema,
  ProjectSearchQuerySchema,
} from "./domain/schemas/project.js";
import {
  CustomerCreateSchema,
  CustomerUpdateSchema,
  CustomerSearchQuerySchema,
  CustomerImportSchema,
  CustomerSchema,
} from "./domain/schemas/customer.js";
import {
  CreateProductServiceSchema,
  UpdateProductServiceSchema,
  CatalogSearchSchema,
  CatalogSelectionSchema,
  BulkCatalogSchema,
} from "./schemas/product-service.js";
import {
  InvoiceTemplateCreateRequestSchema,
  InvoiceTemplateUpdateRequestSchema,
  InvoiceTemplatePublishRequestSchema,
  InvoiceTemplateListParamsSchema,
} from "./schemas/invoice-template-dto.js";
import { invoiceTemplateService } from "./services/templates/invoice-template-service.js";
import { projectService } from "./services/project-service.js";
import { projectTimeEntryService } from "./services/project-time-service.js";
import {
  ProjectTimeEntryCreateSchema,
  ProjectTimeEntryUpdateSchema,
  ProjectTimeEntrySearchSchema,
  ProjectNoteCreateSchema,
} from "./domain/schemas/project-time-entry.js";
import { expenseService } from "./services/expense-service.js";
import {
  ExpenseCreateSchema,
  ExpenseUpdateSchema,
  ExpenseSearchSchema,
} from "./domain/schemas/expense.js";
import bcrypt from "bcrypt";
import { Decimal } from "decimal.js";

const app = express();
const frontendBaseUrl = env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL;

app.use(helmet());
app.use(cors({ origin: isDev ? true : frontendBaseUrl, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
if (isDev) app.use(morgan("dev"));

const QUERY_COUNT_LOG_THRESHOLD = 10;
const REQUEST_DURATION_LOG_THRESHOLD_MS = 1000;

app.use((req, res, next) => {
  const url = req.url;
  if (!url.startsWith("/api/")) return next();
  const start = Date.now();
  const done = () => {
    const ms = Date.now() - start;
    const ctx = getRequestContext();
    if (ctx) {
      if (ctx.queryCount > QUERY_COUNT_LOG_THRESHOLD || ctx.slowQueries.length > 0) {
        const slowList = ctx.slowQueries.map((s) => `${s.ms}ms ${s.text}`).join("; ");
        console.warn(
          `Request ${req.method} ${url} took ${ms}ms, ${ctx.queryCount} queries` +
            (ctx.slowQueries.length ? ` (${ctx.slowQueries.length} slow: ${slowList})` : "")
        );
      }
    } else if (ms > REQUEST_DURATION_LOG_THRESHOLD_MS) {
      console.warn(`Request ${req.method} ${url} took ${ms}ms`);
    }
  };
  res.on("finish", done);
  res.on("close", done);
  runWithRequestContext(() => next());
});

function getCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.substring(name.length + 1));
}

// Health
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", env: env.APP_ENV, timestamp: new Date().toISOString() });
});

if (isDev) {
  app.get("/", (_req, res) => {
    res.json({
      name: "universal-invoice-generator",
      version: "1.0.0",
      status: "ok",
      docs: "/api/health",
       endpoints: ["/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/plans", "/api/invoices", "/api/customers", "/api/products", "/api/projects"],
    });
  });
}

// ============================================================================
// AUTH
// ============================================================================
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, countryCode, defaultCurrency } = req.body;
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
    `INSERT INTO businesses (id, owner_id, name, country_code, default_currency, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)`,
    [businessId, userId, name || "My Business", countryCode || "US", defaultCurrency || "USD", now]
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

  await onboardingService.ensureSteps(businessId);
  const token = generateToken(userId, businessId, email);
  res.status(201).json({ token, user: { id: userId, businessId, email, countryCode: countryCode || "US", defaultCurrency: defaultCurrency || "USD" } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const result = await query(
    "SELECT id, email, password_hash, two_factor_enabled, two_factor_method FROM users WHERE email = $1",
    [email]
  );
  if (!result.rows.length) return res.status(401).json({ error: "Invalid credentials" });

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const subResult = await query("SELECT id AS business_id FROM businesses WHERE owner_id = $1 LIMIT 1", [user.id]);
  const businessId = subResult.rows[0]?.business_id;

  // If 2FA is enabled, do NOT issue a token yet — require a second factor.
  if (user.two_factor_enabled) {
    return res.json({
      requiresTwoFactor: true,
      twoFactorMethod: user.two_factor_method ?? "totp",
      user: { id: user.id, businessId, email: user.email },
    });
  }

  const token = generateToken(user.id, businessId, user.email);
  res.json({ token, user: { id: user.id, businessId, email: user.email } });
});

app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const sub = await subscriptionRepository.findSubscriptionByBusinessId(req.user!.businessId!);
    const plan = sub ? await subscriptionService.getPlanById(sub.planId) : null;
    const twoFactor = await twoFactorService.getStatus(req.user!.id);
    const onboarding = await onboardingService.getProgress(req.user!.businessId!);
    res.json({ user: req.user, subscription: sub, plan, twoFactor, onboarding });
  } catch (err) {
    handleAuthError(err, res);
  }
});

app.patch("/api/auth/profile", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { email, name } = req.body;
  try {
    const updates: string[] = [];
    const values: unknown[] = [req.user!.id];
    let i = 2;
    if (email) {
      updates.push(`email = $${i++}`);
      values.push(email);
    }
    if (updates.length === 0) return res.json({ user: req.user });
    const result = await query(
      `UPDATE users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING id, email, created_at`,
      values
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    handleAuthError(err, res);
  }
});

app.post("/api/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "currentPassword and newPassword required" });
  try {
    const userRow = await query("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
    if (!userRow.rows.length) return res.status(404).json({ error: "User not found" });
    const valid = await bcrypt.compare(currentPassword, userRow.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: "Current password is incorrect" });
    const hash = await bcrypt.hash(newPassword, 10);
    await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, req.user!.id]);
    res.json({ changed: true });
  } catch (err) {
    handleAuthError(err, res);
  }
});

// ============================================================================
// ACTIVE SESSIONS
// ============================================================================
app.get("/api/auth/sessions", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const result = await query(
    "SELECT id, session_token, ip_address, user_agent, created_at, last_seen FROM user_sessions WHERE user_id = $1 ORDER BY last_seen DESC",
    [req.user!.id]
  );
  res.json({ sessions: result.rows });
});

app.delete("/api/auth/sessions/:sessionId", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const result = await query(
    "DELETE FROM user_sessions WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.sessionId, req.user!.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Session not found" });
  res.json({ revoked: true });
});

// ============================================================================
// TWO-FACTOR AUTHENTICATION (TOTP / authenticator app)
// ============================================================================
function handleAuthError(err: unknown, res: express.Response) {
  if (err instanceof Error && "statusCode" in err) {
    const e = err as { statusCode: number; code?: string; message: string };
    return res.status(e.statusCode).json({ error: e.message, code: e.code });
  }
  return res.status(500).json({ error: "Internal server error" });
}

// Second factor verification during login (no session token yet).
// Accepts the code from an authenticator app OR a one-time recovery code.
app.post("/api/auth/2fa/verify", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "email and code required" });

  try {
    const userRes = await query("SELECT id, email FROM users WHERE email = $1", [email]);
    if (!userRes.rows.length) return res.status(401).json({ error: "Invalid code" });
    const u = userRes.rows[0];

    const subResult = await query("SELECT id AS business_id FROM businesses WHERE owner_id = $1 LIMIT 1", [u.id]);
    const businessId = subResult.rows[0]?.business_id;

    const result = await twoFactorService.verifyLogin(u.id, u.email, businessId, code, req.ip);
    res.json({ token: result.token, user: result.user, usedRecoveryCode: result.usedRecoveryCode });
  } catch (err) {
    handleAuthError(err, res);
  }
});

// 2FA management (protected, requires an existing authenticated session)
app.get("/api/auth/2fa/status", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const status = await twoFactorService.getStatus(req.user!.id);
    const summary = await twoFactorService.getRecoverySummary(req.user!.id);
    res.json({ status, recoveryCodes: summary });
  } catch (err) {
    handleAuthError(err, res);
  }
});

// Begin setup: generates a TOTP secret (pending, not yet enabled).
app.post("/api/auth/2fa/setup", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await twoFactorService.setup(req.user!.id, req.user!.email ?? "");
    res.json(result);
  } catch (err) {
    handleAuthError(err, res);
  }
});

// Confirm setup: verifies a code against the pending secret, then enables 2FA.
app.post("/api/auth/2fa/enable", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "code required" });
  try {
    const result = await twoFactorService.enable(req.user!.id, code);
    res.json(result);
  } catch (err) {
    handleAuthError(err, res);
  }
});

// Disable 2FA (clears secret + recovery codes).
app.delete("/api/auth/2fa", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const result = await twoFactorService.disable(req.user!.id);
    res.json(result);
  } catch (err) {
    handleAuthError(err, res);
  }
});

// Regenerate recovery codes (e.g. after using them all). Requires 2FA enabled.
app.post("/api/auth/2fa/recovery-codes/regenerate", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const codes = await twoFactorService.regenerateRecoveryCodes(req.user!.id);
    res.json({ recoveryCodes: codes });
  } catch (err) {
    handleAuthError(err, res);
  }
});

// ============================================================================
// OAUTH 2.0 (Google Sign-In)
// ============================================================================
app.get("/api/auth/oauth/google", (req, res) => {
  if (!oauthService.isEnabled()) {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  }
  const state = crypto.randomUUID();
  res.cookie("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 5 * 60 * 1000,
    secure: !isDev,
  });
  const url = oauthService.generateAuthUrl(state);
  res.redirect(url);
});

app.get("/api/auth/oauth/google/callback", async (req, res) => {
  const { code, error, error_description, state } = req.query as Record<string, string>;

  const stateCookie = getCookie(req.headers.cookie, "oauth_state");
  res.clearCookie("oauth_state", { httpOnly: true, sameSite: "lax", secure: !isDev });

  if (error) {
    return res.redirect(
      `${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/login?oauth_error=${encodeURIComponent(error_description || error)}`
    );
  }

  if (!code) {
    return res.redirect(`${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/login?oauth_error=no_code`);
  }

  if (!state || !stateCookie || state !== stateCookie) {
    return res.redirect(
      `${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/login?oauth_error=${encodeURIComponent("Invalid or missing OAuth state parameter")}`
    );
  }

  try {
    const result = await oauthService.handleCallback(code);
    const redirectUrl = new URL(`${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/auth/callback`);
    redirectUrl.hash = `token=${encodeURIComponent(result.token)}`;
    redirectUrl.searchParams.set("userId", result.user.id);
    redirectUrl.searchParams.set("email", result.user.email);
    res.redirect(redirectUrl.toString());
  } catch (err: any) {
    const message = err instanceof Error ? err.message : "OAuth authentication failed";
    logger.error({ err, code }, "Google OAuth callback failed");
    res.redirect(`${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/login?oauth_error=${encodeURIComponent(message)}`);
  }
});

// ============================================================================
// ONBOARDING
// ============================================================================
app.get("/api/onboarding", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const progress = await onboardingService.getProgress(req.user!.businessId);
  res.json(progress);
});

app.post("/api/onboarding/step/:step/complete", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { step } = req.params;
  try {
    const updated = await onboardingService.completeStep(req.user!.businessId, step);
    const progress = await onboardingService.getProgress(req.user!.businessId);
    res.json({ step: updated, progress });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/onboarding/step/:step/start", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { step } = req.params;
  try {
    const updated = await onboardingService.startStep(req.user!.businessId, step);
    res.json({ step: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/onboarding/step/:step/skip", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { step } = req.params;
  try {
    const updated = await onboardingService.skipStep(req.user!.businessId, step);
    const progress = await onboardingService.getProgress(req.user!.businessId);
    res.json({ step: updated, progress });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/onboarding/complete", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const steps = await onboardingRepository.findByBusinessId(req.user!.businessId);
  for (const s of steps) {
    if (s.status !== "completed" && s.step !== "complete") {
      await onboardingRepository.updateStepStatus(req.user!.businessId, s.step, "completed");
    }
  }
  await onboardingRepository.markComplete(req.user!.businessId);
  const progress = await onboardingService.getProgress(req.user!.businessId);
  res.json(progress);
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
  const { planCode } = req.body;
  if (!planCode) return res.status(400).json({ error: "planCode required" });

  const plans = await subscriptionRepository.listPlans();
  const plan = plans.find((p: any) => p.code === planCode);
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const business = await businessRepository.findById(req.user!.businessId, req.user!.id);

  const session = await stripeService.createCheckoutSession({
    planId: plan.id,
    planCode: plan.code,
    planName: plan.name,
    price: plan.price,
    currency: plan.currency,
    businessId: req.user!.businessId,
    customerEmail: business.email ?? undefined,
    successUrl: `${frontendBaseUrl}/plans?success=true`,
    cancelUrl: `${frontendBaseUrl}/plans?canceled=true`,
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

app.post("/api/subscription/cancel", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const ctx = await subscriptionService.getSubscriptionContext(req.user!.businessId);
  if (ctx.subscription.stripeSubscriptionId) {
    try {
      await stripeService.cancelSubscription(ctx.subscription.stripeSubscriptionId);
    } catch (e) {
      logger.warn({ err: e }, "Failed to cancel Stripe subscription; cancelling locally");
    }
  }
  const freePlan = await subscriptionRepository.findPlanByCode("free");
  const updated = await subscriptionRepository.updateSubscriptionByBusinessId(req.user!.businessId, {
    planId: freePlan?.id,
    status: "cancelled",
    cancelledAt: new Date(),
  });
  await subscriptionRepository.recordSubscriptionEvent(
    req.user!.businessId, updated.id, "subscription_cancelled", ctx.plan.code, "free"
  );
  const plan = freePlan ?? ctx.plan;
  res.json({ subscription: updated, plan });
});

app.get("/api/subscription/invoices", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const ctx = await subscriptionService.getSubscriptionContext(req.user!.businessId);
  const invoices: any[] = [];
  if (ctx.subscription.stripeSubscriptionId && env.STRIPE_SECRET_KEY) {
    try {
      const stripeInvoices = await stripeService.getSubscriptionInvoices(ctx.subscription.stripeSubscriptionId);
      invoices.push(...stripeInvoices);
    } catch (e) {
      logger.warn({ err: e }, "Failed to fetch Stripe invoices");
    }
  }
  res.json({ invoices });
});

app.get("/api/subscription/payment-methods", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  res.json({ paymentMethods: [], stripeConfigured: !!env.STRIPE_SECRET_KEY });
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
  const parsed = CustomerSearchQuerySchema.parse(req.query);
  const enrich = parsed.enrich ?? false;
  const result = enrich
    ? await customerService.searchEnriched(req.user!.businessId, parsed)
    : await customerService.search(req.user!.businessId, parsed);
  res.json({ data: result.data, total: result.total, limit: result.limit, offset: result.offset });
});

app.post("/api/customers/import", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = CustomerImportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const result = await customerService.importFromCsv(req.user!.businessId, parsed.data.csv, req.user!.id);
  res.json(result);
});

app.post("/api/customers", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    await requireUsageLimit("customers.unlimited", true)(req as any, res, async () => {
      const parsed = CustomerCreateSchema.parse(req.body);
      const customer = await customerService.create(parsed, req.user!.businessId!, req.user!.id);
      res.status(201).json({ customer });
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const customer = await customerService.getById(req.user!.businessId, req.params.id);
  res.json({ customer });
});

app.patch("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = CustomerUpdateSchema.parse(req.body);
  const customer = await customerService.update(req.user!.businessId, req.params.id, parsed, req.user!.id);
  res.json({ customer });
});

app.delete("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await customerService.archive(req.user!.businessId, req.params.id, req.user!.id);
  res.json({ archived: true });
});

app.post("/api/customers/:id/archive", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const customer = await customerService.archive(req.user!.businessId, req.params.id, req.user!.id);
  res.json({ customer });
});

app.post("/api/customers/:id/restore", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const customer = await customerService.restore(req.user!.businessId, req.params.id, req.user!.id);
  res.json({ customer });
});

app.get("/api/customers/:id/invoices", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const status = req.query.status as string | undefined;
  const result = await customerService.getInvoiceHistory(req.user!.businessId, req.params.id, { limit, offset, status });
  res.json(result);
});

app.get("/api/customers/:id/summary", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const summary = await customerService.getSummary(req.user!.businessId, req.params.id);
  res.json({ summary });
});

app.get("/api/customers/:id/events", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const events = await customerService.getEvents(req.user!.businessId, req.params.id, limit);
  res.json({ events });
});

app.get("/api/customers/export", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const csv = await customerService.exportToCsv(req.user!.businessId);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="customers.csv"');
  res.send(csv);
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
// CATALOG (Product/Service domain)
// ============================================================================
app.get("/api/catalog", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const params = CatalogSearchSchema.parse({
    search: req.query.search,
    type: req.query.type,
    status: req.query.status,
    taxCategory: req.query.taxCategory,
    hasSku: req.query.hasSku,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
    limit: req.query.limit,
    offset: req.query.offset,
  });
  const result = await productServiceService.search(req.user!.businessId, params);
  res.json(result);
});

app.post("/api/catalog", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = CreateProductServiceSchema.parse(req.body);
  const item = await productServiceService.create(req.user!.businessId, parsed, req.user.id);
  res.status(201).json({ item });
});

app.get("/api/catalog/selection", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const params = CatalogSelectionSchema.parse({
    search: req.query.search,
    type: req.query.type,
    onlyActive: req.query.onlyActive,
    limit: req.query.limit,
    offset: req.query.offset,
  });
  const items = await productServiceService.getForSelection(req.user!.businessId, params);
  res.json({ items });
});

app.post("/api/catalog/bulk", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = BulkCatalogSchema.parse(req.body);
  const result = await productServiceService.bulk(
    req.user!.businessId,
    parsed.items,
    parsed.conflictStrategy
  );
  res.json(result);
});

app.get("/api/catalog/stats", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const counts = await productServiceService.countByStatus(req.user!.businessId);
  res.json({ counts });
});

app.get("/api/catalog/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const item = await productServiceService.getById(req.user!.businessId, req.params.id);
  res.json({ item });
});

app.patch("/api/catalog/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = UpdateProductServiceSchema.parse(req.body);
  const item = await productServiceService.update(req.user!.businessId, req.params.id, parsed, req.body.version ?? undefined);
  res.json({ item });
});

app.post("/api/catalog/:id/archive", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const item = await productServiceService.archive(req.user!.businessId, req.params.id);
  res.json({ item });
});

app.post("/api/catalog/:id/restore", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const item = await productServiceService.restore(req.user!.businessId, req.params.id);
  res.json({ item });
});

app.get("/api/catalog/sku/:sku/check", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const existing = await productServiceRepository.findBySku(req.user!.businessId, req.params.sku);
  res.json({ available: !existing, exists: !!existing });
});

// ============================================================================
// INVOICES
// ============================================================================
app.get("/api/invoices", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const q = req.query;
  const opts: InvoiceListOptions = {
    status: q.status as string | undefined,
    customerId: (q.customerId ?? q.customer_id) as string | undefined,
    projectId: (q.projectId ?? q.project_id) as string | undefined,
    invoiceNumber: q.invoice_number as string | undefined,
    currency: q.currency as string | undefined,
    minAmount: q.min_amount ? Number(q.min_amount) : undefined,
    maxAmount: q.max_amount ? Number(q.max_amount) : undefined,
    issueDateFrom: q.issue_date_from as string | undefined,
    issueDateTo: q.issue_date_to as string | undefined,
    dueDateFrom: q.due_date_from as string | undefined,
    dueDateTo: q.due_date_to as string | undefined,
    search: q.search as string | undefined,
    paymentState: q.payment_state as string | undefined,
    limit: q.limit ? Number(q.limit) : undefined,
    offset: q.offset ? Number(q.offset) : undefined,
    sortBy: (q.sortBy ?? q.sort_by) as string | undefined,
    sortOrder: (q.sortOrder ?? q.sort_order) as "asc" | "desc" | undefined,
  };
  const page = await invoiceRepository.findManyPage(req.user!.businessId, opts);
  const invoices = page.data.map((inv: InvoiceListItem) => ({
    id: inv.id,
    business_id: inv.businessId,
    customer_id: inv.customerId,
    project_id: inv.projectId,
    invoice_number: inv.invoiceNumber,
    status: inv.status,
    issue_date: inv.issueDate instanceof Date ? inv.issueDate.toISOString().split("T")[0] : inv.issueDate ?? null,
    due_date: inv.dueDate instanceof Date ? inv.dueDate.toISOString().split("T")[0] : inv.dueDate ?? null,
    currency: inv.currency,
    exchange_rate: inv.exchangeRate ?? null,
    subtotal: String(inv.subtotal ?? 0),
    discount_total: String(inv.discountTotal ?? 0),
    tax_total: String(inv.taxTotal ?? 0),
    fee_total: String(inv.feeTotal ?? 0),
    total: String(inv.total ?? 0),
    amount_paid: String(inv.amountPaid ?? 0),
    amount_due: String(inv.amountDue ?? 0),
    credit_applied: String(inv.creditApplied ?? 0),
    deposit_amount: String(inv.depositAmount ?? 0),
    deposit_type: inv.depositType ?? "none",
    deposit_due_date: inv.depositDueDate instanceof Date ? inv.depositDueDate.toISOString().split("T")[0] : inv.depositDueDate ?? null,
    deposit_payment_purpose: inv.depositPaymentPurpose ?? null,
    notes: inv.notes ?? null,
    terms: inv.terms ?? null,
    template_id: inv.templateId ?? null,
    public_token: inv.publicToken ?? null,
    public_token_expires_at: inv.publicTokenExpiresAt ?? null,
    payment_instructions: inv.paymentInstructions ?? null,
    is_finalized: inv.isFinalized ?? false,
    finalized_at: inv.finalizedAt ?? null,
    sent_at: inv.sentAt ?? null,
    viewed_at: inv.viewedAt ?? null,
    paid_at: inv.paidAt ?? null,
    cancelled_at: inv.cancelledAt ?? null,
    cancelled_reason: inv.cancelledReason ?? null,
    version: inv.version ?? 1,
    created_at: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
    updated_at: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : inv.updatedAt,
    created_by: inv.createdBy ?? null,
    updated_by: inv.updatedBy ?? null,
    customer_name: inv.customer_name ?? null,
    customer_email: inv.customer_email ?? null,
  }));
  res.json({ invoices, total: page.total, limit: page.limit, offset: page.offset });
});

app.post("/api/invoices", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    await requireUsageLimit("invoices.unlimited", true)(req as any, res, async () => {
      const invoiceId = await invoiceService.createDraft(req.body, req.user!.businessId!, req.user!.id);
      res.status(201).json({ invoiceId });
    });
  } catch (err) {
    next(err);
  }
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

app.post("/api/invoices/:id/send-reminder", requireAuth, requireEntitlement("reminders.automated"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await invoiceService.sendReminder(req.user!.businessId, req.params.id, req.user.id);
  res.json({ ok: true });
});

app.post("/api/invoices/:id/cancel", requireAuth, requireEntitlement("invoices.cancel"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { reason } = req.body;
  await invoiceService.cancel(req.user!.businessId, req.params.id, req.user.id, reason);
  res.json({ ok: true });
});

app.post("/api/invoices/:id/void", requireAuth, requireEntitlement("invoices.void"), async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { reason } = req.body;
  await invoiceService.void(req.user!.businessId, req.params.id, req.user.id, reason);
  res.json({ ok: true });
});

app.post("/api/invoices/:id/payment-intent", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await invoiceService.createPaymentIntent(req.user!.businessId, req.params.id);
  res.json(result);
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

app.delete("/api/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const invoice = await invoiceRepository.findById(req.user!.businessId, req.params.id);
  if (invoice.isFinalized) return res.status(400).json({ error: "Cannot delete a finalized invoice" });
  await query("DELETE FROM invoices WHERE id = $1 AND business_id = $2", [req.params.id, req.user!.businessId]);
  res.status(204).send();
});

app.get("/api/dashboard", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const data = await invoiceService.getDashboardData(req.user!.businessId);
  res.json(data);
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
      catalogName: it.catalogName,
      catalogSku: it.catalogSku,
      catalogTaxCategory: it.catalogTaxCategory,
      catalogUnitPrice: it.catalogUnitPrice,
      catalogTaxRate: it.catalogTaxRate,
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

app.get("/api/reports/volume-trend", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const monthsParam = Number(req.query.months ?? 1);
  const months = Number.isInteger(monthsParam) && monthsParam > 0 && monthsParam <= 24 ? monthsParam : 1;
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const result = await query(
    `SELECT
      TO_CHAR(date_trunc('month', COALESCE(issue_date, created_at)), 'YYYY-MM') as period,
      COUNT(*) as count,
      COALESCE(SUM(total), 0) as invoiced,
      COALESCE(SUM(amount_paid), 0) as paid
     FROM invoices
     WHERE business_id = $1
       AND (issue_date IS NULL OR issue_date >= $2 OR created_at >= $2)
     GROUP BY date_trunc('month', COALESCE(issue_date, created_at))
     ORDER BY period ASC`,
    [req.user!.businessId, cutoff.toISOString()]
  );
  res.json(result.rows);
});

// ============================================================================
// ENHANCED DASHBOARD
// ============================================================================
app.get("/api/dashboard/enhanced", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const invoices = await invoiceRepository.findForDashboard(req.user!.businessId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const agingBuckets = [
    { bucket: "current" as const, count: 0, amount: "0" },
    { bucket: "1-30" as const, count: 0, amount: "0" },
    { bucket: "31-60" as const, count: 0, amount: "0" },
    { bucket: "61-90" as const, count: 0, amount: "0" },
    { bucket: "90+" as const, count: 0, amount: "0" },
  ];
  let totalInvoiced = new Decimal(0);
  let totalPaid = new Decimal(0);
  let totalOutstanding = new Decimal(0);
  let totalOverdue = new Decimal(0);
  let totalPaidThisMonth = new Decimal(0);
  let count = 0;
  let paidInvoiceCount = 0;
  let totalPaymentDays = 0;

  for (const inv of invoices) {
    const total = new Decimal(inv.total || 0);
    const amountPaid = new Decimal(inv.amount_paid || 0);
    const amountDue = new Decimal(inv.amount_due || 0);
    totalInvoiced = totalInvoiced.plus(total);
    totalPaid = totalPaid.plus(amountPaid);
    
    if (inv.paid_at && new Date(inv.paid_at) >= monthStart) {
      totalPaidThisMonth = totalPaidThisMonth.plus(amountPaid);
    }

    if (amountDue.gt(0)) {
      totalOutstanding = totalOutstanding.plus(amountDue);
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      const createdDate = inv.created_at ? new Date(inv.created_at) : now;
      const referenceDate = dueDate ?? createdDate;
      const daysOverdue = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue > 90) {
        agingBuckets[4].count++;
        agingBuckets[4].amount = new Decimal(agingBuckets[4].amount).plus(amountDue).toString();
      } else if (daysOverdue > 60) {
        agingBuckets[3].count++;
        agingBuckets[3].amount = new Decimal(agingBuckets[3].amount).plus(amountDue).toString();
      } else if (daysOverdue > 30) {
        agingBuckets[2].count++;
        agingBuckets[2].amount = new Decimal(agingBuckets[2].amount).plus(amountDue).toString();
      } else if (daysOverdue >= 0) {
        agingBuckets[1].count++;
        agingBuckets[1].amount = new Decimal(agingBuckets[1].amount).plus(amountDue).toString();
      } else {
        agingBuckets[0].count++;
        agingBuckets[0].amount = new Decimal(agingBuckets[0].amount).plus(amountDue).toString();
      }
      
      if (daysOverdue > 0) {
        totalOverdue = totalOverdue.plus(amountDue);
      }
    }
    
    if (inv.status === "paid" && inv.paid_at && inv.created_at) {
      const paidAt = new Date(inv.paid_at);
      const createdAt = new Date(inv.created_at);
      const paymentDays = Math.floor((paidAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (paymentDays >= 0) {
        totalPaymentDays += paymentDays;
        paidInvoiceCount++;
      }
    }
    
    count++;
  }

  const volumeTrend = invoices
    .filter((i) => i.created_at)
    .reduce<{ period: string; invoiced: string; paid: string; count: number }[]>((acc, inv) => {
      const date = new Date(inv.created_at);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = acc.find((a) => a.period === period);
      if (existing) {
        existing.invoiced = new Decimal(existing.invoiced).plus(inv.total || 0).toString();
        existing.paid = new Decimal(existing.paid).plus(inv.amount_paid || 0).toString();
        existing.count++;
      } else {
        acc.push({
          period,
          invoiced: String(inv.total || 0),
          paid: String(inv.amount_paid || 0),
          count: 1,
        });
      }
      return acc;
    }, [])
    .sort((a, b) => a.period.localeCompare(b.period));

  const averagePaymentTimeDays = paidInvoiceCount > 0 ? Math.round(totalPaymentDays / paidInvoiceCount) : 0;
  const collectionRate = totalInvoiced.gt(0) ? Math.round((totalPaid.div(totalInvoiced).toNumber() * 100)) : 0;

  res.json({
    summary: {
      totalOutstanding: totalOutstanding.toString(),
      totalOverdue: totalOverdue.toString(),
      totalPaidThisMonth: totalPaidThisMonth.toString(),
      totalRevenue: totalInvoiced.toString(),
      draftCount: invoices.filter((i) => i.status === "draft").length,
      overdueCount: invoices.filter((i) => i.status === "overdue").length,
      sentCount: invoices.filter((i) => i.status === "sent").length,
      paidCount: invoices.filter((i) => i.status === "paid").length,
      totalInvoices: count,
    },
    agingBuckets,
    paymentMetrics: {
      averagePaymentTimeDays,
      collectionRate,
      totalInvoiced: totalInvoiced.toString(),
      totalPaid: totalPaid.toString(),
      totalOutstanding: totalOutstanding.toString(),
      totalOverdue: totalOverdue.toString(),
    },
    volumeTrend,
  });
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
// TEMPLATES (CRUD for invoice templates)
// ============================================================================
app.get("/api/templates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const templates = await templateRepository.findMany(req.user!.businessId, limit, offset);
  res.json({ templates, limit, offset });
});

app.post("/api/templates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await templateRepository.create(req.user!.businessId, {
    name: req.body.name ?? "Untitled Template",
    htmlTemplate: req.body.htmlTemplate ?? "",
    config: req.body.config ?? {},
    isDefault: req.body.isDefault ?? false,
  });
  res.status(201).json({ template });
});

app.get("/api/templates/default", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await templateRepository.findDefault(req.user!.businessId);
  res.json({ template });
});

app.get("/api/templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await templateRepository.findById(req.user!.businessId, req.params.id);
  res.json({ template });
});

app.patch("/api/templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await templateRepository.update(req.user!.businessId, req.params.id, req.body);
  res.json({ template });
});

app.delete("/api/templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await templateRepository.delete(req.user!.businessId, req.params.id);
  res.status(204).send();
});

// ============================================================================
// DOCUMENT TEMPLATES (structured InvoiceDocument JSON layouts)
// ============================================================================
app.get("/api/document-templates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const industry = req.query.industry ? String(req.query.industry) : undefined;
  const isDefault = req.query.isDefault !== undefined ? Boolean(req.query.isDefault) : undefined;
  const templates = await documentTemplateRepository.findMany(req.user!.businessId, {
    industry,
    isDefault,
    limit,
    offset,
  });
  res.json({ templates, limit, offset });
});

app.post("/api/document-templates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = DocumentTemplateInputSchema.parse(req.body);
  const template = await documentTemplateRepository.create(
    req.user!.businessId,
    parsed,
    req.user!.id
  );
  res.status(201).json({ template });
});

app.get("/api/document-templates/default", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const industry = req.query.industry ? String(req.query.industry) : null;
  const template = industry
    ? await documentTemplateRepository.findDefaultByIndustry(req.user!.businessId, industry)
    : await documentTemplateRepository.findDefault(req.user!.businessId);
  res.json({ template });
});

app.get("/api/document-templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await documentTemplateRepository.findById(req.user!.businessId, req.params.id);
  res.json({ template });
});

app.patch("/api/document-templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = DocumentTemplateUpdateSchema.parse(req.body);
  const template = await documentTemplateRepository.update(
    req.user!.businessId,
    req.params.id,
    parsed
  );
  res.json({ template });
});

app.delete("/api/document-templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await documentTemplateRepository.delete(req.user!.businessId, req.params.id);
  res.status(204).send();
});

app.post("/api/document-templates/:id/duplicate", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await documentTemplateRepository.duplicate(
    req.user!.businessId,
    req.params.id,
    req.user!.id
  );
  res.status(201).json({ template });
});

app.post("/api/document-templates/:id/set-default", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await documentTemplateRepository.setDefault(req.user!.businessId, req.params.id);
  res.json({ template });
});

// ============================================================================
// INVOICE TEMPLATES (canonical lifecycle + versioning)
// ============================================================================
app.get("/api/invoice-templates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = InvoiceTemplateListParamsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const templates = await invoiceTemplateService.listTemplates(req.user!.businessId, {
    industry: parsed.data.industry ?? null,
    isDefault: parsed.data.isDefault,
    lifecycle: parsed.data.lifecycle,
    documentType: parsed.data.documentType,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });
  res.json({ templates, limit: parsed.data.limit, offset: parsed.data.offset });
});

app.post("/api/invoice-templates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = InvoiceTemplateCreateRequestSchema.parse(req.body);
  const template = await invoiceTemplateService.create(req.user!.businessId, parsed, req.user!.id);
  res.status(201).json({ template });
});

app.get("/api/invoice-templates/default", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const industry = req.query.industry ? String(req.query.industry) : undefined;
  const documentType = req.query.documentType ? String(req.query.documentType) : undefined;
  const template = await invoiceTemplateService.getDefaultTemplate(req.user!.businessId, industry, documentType);
  res.json({ template });
});

app.get("/api/invoice-templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await invoiceTemplateService.getTemplate(req.user!.businessId, req.params.id);
  res.json({ template });
});

app.patch("/api/invoice-templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = InvoiceTemplateUpdateRequestSchema.parse(req.body);
  const template = await invoiceTemplateService.updateTemplate(
    req.user!.businessId,
    req.params.id,
    parsed,
    req.user!.id
  );
  res.json({ template });
});

app.delete("/api/invoice-templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await invoiceTemplateService.deleteTemplate(req.user!.businessId, req.params.id);
  res.status(204).send();
});

app.post("/api/invoice-templates/:id/duplicate", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await invoiceTemplateService.duplicateTemplate(
    req.user!.businessId,
    req.params.id,
    req.user!.id
  );
  res.status(201).json({ template });
});

app.post("/api/invoice-templates/:id/set-default", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await invoiceTemplateService.setDefault(req.user!.businessId, req.params.id);
  res.json({ template });
});

app.post("/api/invoice-templates/:id/publish", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = InvoiceTemplatePublishRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const template = await invoiceTemplateService.publish(
    req.user!.businessId,
    req.params.id,
    parsed.data.changeSummary ? { changeSummary: parsed.data.changeSummary } : undefined,
    req.user!.id
  );
  res.json({ template });
});

app.post("/api/invoice-templates/:id/archive", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await invoiceTemplateService.archive(req.user!.businessId, req.params.id, req.user!.id);
  res.json({ template });
});

app.post("/api/invoice-templates/:id/unarchive", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await invoiceTemplateService.unarchive(req.user!.businessId, req.params.id, req.user!.id);
  res.json({ template });
});

app.get("/api/invoice-templates/:id/revisions", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const revisions = await invoiceTemplateService.getRevisions(req.user!.businessId, req.params.id);
  res.json({ revisions });
});

app.get("/api/invoice-templates/:id/revisions/:revision", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const revision = Number(req.params.revision);
  if (!Number.isInteger(revision) || revision < 1) {
    return res.status(400).json({ error: "Invalid revision number" });
  }
  const rev = await invoiceTemplateService.getRevision(req.user!.businessId, req.params.id, revision);
  res.json({ revision: rev });
});

app.post("/api/invoice-templates/:id/revisions/:revision/restore", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const revision = Number(req.params.revision);
  if (!Number.isInteger(revision) || revision < 1) {
    return res.status(400).json({ error: "Invalid revision number" });
  }
  const template = await invoiceTemplateService.restoreRevision(
    req.user!.businessId,
    req.params.id,
    revision,
    req.user!.id
  );
  res.json({ template });
});

app.get("/api/invoice-templates/:id/with-revisions", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const template = await invoiceTemplateService.getWithRevisions(req.user!.businessId, req.params.id);
  res.json({ template });
});

app.post("/api/invoice-templates/:id/migrate", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const targetVersion = req.body.targetVersion as string | undefined;
  const result = await invoiceTemplateService.migrateSchema(
    req.user!.businessId,
    req.params.id,
    targetVersion
  );
  res.json({ template: result.template, migrated: result.migrated });
});

app.post("/api/invoice-templates/:id/render", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const html = await invoiceTemplateService.renderToHtml(
    req.user!.businessId,
    req.params.id,
    req.body
  );
  res.json({ html });
});

app.get("/api/invoice-templates/:id/usage", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const count = await invoiceTemplateService.getUsageCount(req.user!.businessId, req.params.id);
  res.json({ templateId: req.params.id, usageCount: count });
});

app.post("/api/invoice-templates/:id/permissions", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await invoiceTemplateService.setPermission(
    req.user!.businessId,
    req.params.id,
    req.body.userId,
    req.body.permission
  );
  res.status(201).json({ ok: true });
});

app.get("/api/invoice-templates/:id/permissions", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const permissions = await invoiceTemplateService.getPermissions(req.user!.businessId, req.params.id);
  res.json({ permissions });
});

app.post("/api/invoice-templates/:id/usage", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await invoiceTemplateService.recordUsage(
    req.user!.businessId,
    req.params.id,
    req.body.invoiceId ?? null
  );
  res.status(201).json({ ok: true });
});

// ============================================================================
// PROJECTS
// ============================================================================
app.get("/api/projects", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = ProjectSearchQuerySchema.parse({
    search: req.query.search,
    status: req.query.status,
    customerId: req.query.customerId,
    tagId: req.query.tagId,
    includeArchived: req.query.includeArchived,
    limit: req.query.limit ?? 50,
    offset: req.query.offset ?? 0,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
  });
  const result = await projectService.search(req.user!.businessId, {
    search: parsed.search,
    status: parsed.status,
    customerId: parsed.customerId,
    tagId: parsed.tagId,
    includeArchived: parsed.includeArchived,
    limit: parsed.limit,
    offset: parsed.offset,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  });
  res.json({ projects: result.data, total: result.total, limit: result.limit, offset: result.offset });
});

app.post("/api/projects", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    await requireUsageLimit("projects.unlimited", true)(req as any, res, async () => {
      const parsed = ProjectCreateSchema.parse(req.body);
      const businessId = req.user?.businessId;
      if (!businessId) return res.status(400).json({ error: "No business context" });
      const project = await projectService.create(parsed, businessId, req.user!.id);
      res.status(201).json({ project });
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/projects/search", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const search = req.query.q as string | undefined;
  const projects = await projectService.searchForSelection(req.user!.businessId, search);
  res.json({ projects });
});

app.get("/api/projects/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const summary = await projectService.getSummary(req.user!.businessId, req.params.id);
  res.json({ project: summary.project, customer: summary.customer, tags: summary.tags, teamMembers: summary.teamMembers, financialSummary: summary.financialSummary });
});

app.patch("/api/projects/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const parsed = ProjectUpdateSchema.parse(req.body);
  const project = await projectService.update(req.user!.businessId, req.params.id, parsed, req.user!.id);
  res.json({ project });
});

app.post("/api/projects/:id/status", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status required" });
  const project = await projectService.updateStatus(req.user!.businessId, req.params.id, status, req.user!.id);
  res.json({ project });
});

app.post("/api/projects/:id/archive", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const project = await projectService.archive(req.user!.businessId, req.params.id, req.user!.id);
  res.json({ project });
});

app.post("/api/projects/:id/restore", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const project = await projectService.restore(req.user!.businessId, req.params.id, req.user!.id);
  res.json({ project });
});

app.delete("/api/projects/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await projectService.delete(req.user!.businessId, req.params.id);
  res.status(204).send();
});

app.post("/api/projects/:id/invoice", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await projectService.createInvoiceFromProject(req.user!.businessId, req.params.id, req.body, req.user!.id);
  res.status(201).json(result);
});

app.get("/api/projects/:id/invoices", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const status = req.query.status as string | undefined;
  const result = await projectService.getInvoices(req.user!.businessId, req.params.id, { limit, offset, status });
  res.json({ invoices: result.data, total: result.total, limit, offset });
});

app.get("/api/projects/:id/financial-summary", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const summary = await projectService.getFinancialSummary(req.user!.businessId, req.params.id);
  res.json({ summary });
});

app.get("/api/projects/:id/events", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const events = await projectService.getEvents(req.user!.businessId, req.params.id, limit);
  res.json({ events });
});

// Project tags
app.get("/api/projects/tags", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const tags = await projectService.getTagsByBusiness(req.user!.businessId);
  res.json({ tags });
});

app.post("/api/projects/:id/tags", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: "tag name required" });
  const tag = await projectService.addTag(req.user!.businessId, req.params.id, name, color);
  res.status(201).json({ tag });
});

app.delete("/api/projects/:id/tags/:tagId", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await projectService.removeTag(req.user!.businessId, req.params.id, req.params.tagId);
  res.status(204).send();
});

// Project team members
app.get("/api/projects/:id/team", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const members = await projectService.getTeamMembers(req.user!.businessId, req.params.id);
  res.json({ members });
});

app.post("/api/projects/:id/team", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { userId, role } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const member = await projectService.addTeamMember(req.user!.businessId, req.params.id, userId, role, req.user!.id);
  res.status(201).json({ member });
});

app.delete("/api/projects/:id/team/:userId", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await projectService.removeTeamMember(req.user!.businessId, req.params.id, req.params.userId);
  res.status(204).send();
});

// ============================================================================
// PROJECT TIME TRACKING
// ============================================================================

app.post("/api/projects/:projectId/time-entries", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    const parsed = ProjectTimeEntryCreateSchema.parse(req.body);
    const entry = await projectTimeEntryService.create(
      req.user!.businessId,
      req.params.projectId,
      parsed,
      req.user!.id
    );
    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
});

app.get("/api/projects/:projectId/time-entries", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    const parsed = ProjectTimeEntrySearchSchema.parse({
      ...req.query,
      limit: req.query.limit ?? 50,
      offset: req.query.offset ?? 0,
    });
    const result = await projectTimeEntryService.getProjectEntries(
      req.user!.businessId,
      req.params.projectId,
      parsed
    );
    res.json({ entries: result.data, total: result.total, limit: result.limit, offset: result.offset });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/time-entries/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    const parsed = ProjectTimeEntryUpdateSchema.parse(req.body);
    const entry = await projectTimeEntryService.update(
      req.user!.businessId,
      req.params.id,
      parsed
    );
    res.json({ entry });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/time-entries/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    await projectTimeEntryService.delete(req.user!.businessId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

app.post("/api/time-entries/:id/start", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    const entry = await projectTimeEntryService.startTimer(
      req.user!.businessId,
      req.body.projectId,
      req.body,
      req.user!.id
    );
    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
});

app.post("/api/time-entries/:id/stop", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    const entry = await projectTimeEntryService.stopTimer(
      req.user!.businessId,
      req.params.id,
      req.user!.id
    );
    res.json({ entry });
  } catch (err) {
    next(err);
  }
});

app.get("/api/projects/:projectId/time-entries/summary", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    const summary = await projectTimeEntryService.getSummary(
      req.user!.businessId,
      req.params.projectId,
      req.query.currency as string | undefined
    );
    res.json({ summary });
  } catch (err) {
    next(err);
  }
});

// Project notes
app.post("/api/projects/:projectId/notes", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    const parsed = ProjectNoteCreateSchema.parse(req.body);
    const note = await projectTimeEntryService.addNote(
      req.user!.businessId,
      req.params.projectId,
      parsed,
      req.user!.id
    );
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
});

app.get("/api/projects/:projectId/notes", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const result = await projectTimeEntryService.getNotes(
      req.user!.businessId,
      req.params.projectId,
      limit,
      offset
    );
    res.json({ notes: result.data, total: result.total, limit, offset });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/projects/:projectId/notes/:noteId", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  try {
    await projectTimeEntryService.deleteNote(
      req.user!.businessId,
      req.params.projectId,
      req.params.noteId
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// EXPENSE TRACKING (Business tier)
// ============================================================================
app.get(
  "/api/expenses",
  requireAuth,
  requireEntitlement("expenses.tracking"),
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
    try {
      const parsed = ExpenseSearchSchema.parse({
        ...req.query,
        limit: req.query.limit ?? 50,
        offset: req.query.offset ?? 0,
      });
      const result = await expenseService.list(req.user!.businessId, parsed);
      res.json({ expenses: result.data, total: result.total, limit: result.limit, offset: result.offset });
    } catch (err) {
      next(err);
    }
  }
);

app.post(
  "/api/expenses",
  requireAuth,
  requireEntitlement("expenses.tracking"),
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
    try {
      const parsed = ExpenseCreateSchema.parse(req.body);
      const expense = await expenseService.create(req.user!.businessId, parsed, req.user!.id);
      res.status(201).json({ expense });
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  "/api/expenses/:id",
  requireAuth,
  requireEntitlement("expenses.tracking"),
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
    try {
      const expense = await expenseService.getById(req.user!.businessId, req.params.id);
      res.json({ expense });
    } catch (err) {
      next(err);
    }
  }
);

app.patch(
  "/api/expenses/:id",
  requireAuth,
  requireEntitlement("expenses.tracking"),
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
    try {
      const parsed = ExpenseUpdateSchema.parse(req.body);
      const expense = await expenseService.update(req.user!.businessId, req.params.id, parsed);
      res.json({ expense });
    } catch (err) {
      next(err);
    }
  }
);

app.delete(
  "/api/expenses/:id",
  requireAuth,
  requireEntitlement("expenses.tracking"),
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
    try {
      await expenseService.delete(req.user!.businessId, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  "/api/expenses/summary",
  requireAuth,
  requireEntitlement("expenses.tracking"),
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
    try {
      const parsed = ExpenseSearchSchema.parse({
        ...req.query,
        limit: req.query.limit ?? 50,
        offset: req.query.offset ?? 0,
      });
      const summary = await expenseService.getSummary(req.user!.businessId, parsed);
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// NUMBER SEQUENCES (invoice numbering config)
// ============================================================================
app.get("/api/businesses/current/numbering", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await query(
    "SELECT * FROM invoice_number_sequences WHERE business_id = $1",
    [req.user!.businessId]
  );
  if (!result.rows.length) {
    return res.json({ sequence: null });
  }
  res.json({ sequence: result.rows[0] });
});

app.patch("/api/businesses/current/numbering", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  await invoiceNumberService.updateSequenceConfig(req.user!.businessId, req.body);
  res.json({ ok: true });
});

// ============================================================================
// BUSINESS SETTINGS (branding, defaults, payment config)
// ============================================================================
app.get("/api/businesses/current/settings", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await query(
    `SELECT business_id, default_currency, default_tax_rate, default_terms, default_notes,
     time_zone, locale, pdf_template_id, payment_provider, payment_provider_config,
     reminders_enabled, overdue_reminder_days, reminders_before_due, reminders_after_due,
     created_at, updated_at
     FROM business_settings WHERE business_id = $1`,
    [req.user!.businessId]
  );
  if (!result.rows.length) {
    return res.status(404).json({ error: "Business settings not found" });
  }
  res.json({ settings: result.rows[0] });
});

app.patch("/api/businesses/current/settings", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const allowedFields = [
    "default_currency", "default_tax_rate", "default_terms", "default_notes",
    "time_zone", "locale", "pdf_template_id", "payment_provider",
    "payment_provider_config", "reminders_enabled", "overdue_reminder_days",
  ];
  const updates: string[] = [];
  const values: unknown[] = [req.user!.businessId];
  let i = 2;
  for (const [key, val] of Object.entries(req.body)) {
    if (!allowedFields.includes(key)) continue;
    updates.push(`${key} = $${i++}`);
    values.push(val);
  }
  if (updates.length === 0) return res.json({ settings: null });
  updates.push(`updated_at = NOW()`);
  const result = await query(
    `UPDATE business_settings SET ${updates.join(", ")}
     WHERE business_id = $1 RETURNING business_id, default_currency, default_tax_rate,
     default_terms, default_notes, time_zone, locale, pdf_template_id, payment_provider,
     payment_provider_config, reminders_enabled, overdue_reminder_days, created_at, updated_at`,
    values
  );
  res.json({ settings: result.rows[0] });
});

// ============================================================================
// BUSINESS REMINDER SETTINGS (JSONB)
// ============================================================================
app.get("/api/businesses/current/settings/reminders", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const settings = await businessRepository.getReminderSettings(req.user!.businessId);
  res.json({ settings });
});

app.patch("/api/businesses/current/settings/reminders", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { enabled, beforeDue, afterDue } = req.body;
  await businessRepository.updateReminderSettings(req.user!.businessId, {
    enabled: enabled ?? undefined,
    beforeDue: beforeDue ?? undefined,
    afterDue: afterDue ?? undefined,
  });
  const settings = await businessRepository.getReminderSettings(req.user!.businessId);
  res.json({ settings });
});

// ============================================================================
// TAX RATES CRUD
// ============================================================================
// ============================================================================
app.get("/api/invoices/:id/payments", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const payments = await invoiceRepository.findPayments(req.params.id, req.user!.businessId);
  res.json({ payments });
});

app.post("/api/invoices/:id/payments", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { amount, provider = "stub", providerPaymentId, idempotencyKey } = req.body;
  if (!amount) return res.status(400).json({ error: "amount required" });
  await invoiceService.recordPayment(
    req.user!.businessId,
    req.params.id,
    amount,
    provider,
    providerPaymentId,
    idempotencyKey
  );
  res.status(201).json({ ok: true });
});

// ============================================================================
// TAX RATES
// ============================================================================
app.get("/api/tax-rates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await query(
    "SELECT * FROM business_tax_rates WHERE business_id = $1 ORDER BY name",
    [req.user!.businessId]
  );
  res.json({ taxRates: result.rows });
});

app.post("/api/tax-rates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const { name, code, rate, type, country_code, region, is_compound, enabled } = req.body;
  if (!name || !rate) return res.status(400).json({ error: "name and rate are required" });
  const result = await query(
    `INSERT INTO business_tax_rates (business_id, name, code, rate, type, country_code, region, is_compound, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user!.businessId, name, code, rate, type ?? "percentage", country_code, region, is_compound ?? false, enabled ?? true]
  );
  res.status(201).json({ taxRate: result.rows[0] });
});

app.patch("/api/tax-rates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const allowedFields = ["name", "code", "rate", "type", "country_code", "region", "is_compound", "enabled"];
  const updates: string[] = [];
  const values: unknown[] = [req.user!.businessId, req.params.id];
  let i = 3;
  for (const [key, val] of Object.entries(req.body)) {
    if (!allowedFields.includes(key)) continue;
    updates.push(`${key} = $${i++}`);
    values.push(val);
  }
  if (updates.length === 0) return res.status(400).json({ error: "No valid fields to update" });
  const result = await query(
    `UPDATE business_tax_rates SET ${updates.join(", ")} WHERE business_id = $1 AND id = $2 RETURNING *`,
    values
  );
  if (!result.rows.length) return res.status(404).json({ error: "Tax rate not found" });
  res.json({ taxRate: result.rows[0] });
});

app.delete("/api/tax-rates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId) return res.status(400).json({ error: "No business context" });
  const result = await query(
    "DELETE FROM business_tax_rates WHERE business_id = $1 AND id = $2 RETURNING id",
    [req.user!.businessId, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Tax rate not found" });
  res.json({ deleted: true });
});

// ============================================================================
// PUBLIC INVOICE VIEW (customer-facing, no auth required)
// ============================================================================
app.get("/api/public/invoices/:token", optionalAuth, async (req: AuthRequest, res) => {
  const { invoice, html } = await invoiceService.getPublicInvoice(req.params.token);
  res.json({ invoice, html });
});

app.get("/api/public/invoices/:token/pdf", optionalAuth, async (req: AuthRequest, res) => {
  const invoice = await invoiceRepository.findByPublicToken(undefined, req.params.token);
  const pdf = await invoiceService.generatePdf(invoice.businessId, invoice.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoice.invoiceNumber ?? invoice.id}.pdf`);
  res.send(pdf);
});

app.post("/api/public/invoices/:token/view", optionalAuth, async (req: AuthRequest, res) => {
  const invoiceId = await invoiceService.recordView(req.params.token);
  res.json({ invoiceId });
});

app.post("/api/public/invoices/:token/pay", optionalAuth, async (req: AuthRequest, res) => {
  const { amount, provider = "stub", idempotencyKey } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "Valid amount required" });
  try {
    await invoiceService.recordPublicPayment(req.params.token, amount, provider, idempotencyKey);
    res.status(201).json({ ok: true });
  } catch (err: any) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
    } else {
      res.status(400).json({ error: err.message || "Payment failed" });
    }
  }
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
    const e = err as { statusCode: number; code?: string; message: string; context?: Record<string, unknown> };
    return res.status(e.statusCode).json({ error: e.message, code: e.code, ...(e.context ? { context: e.context } : {}) });
  }
  res.status(500).json({ error: "Internal server error" });
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection — server will continue running");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — server will continue running");
});

const PORT = env.PORT;

async function start() {
  await runMigrations();
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT} (env=${env.APP_ENV})`);
    subscriptionService.ensureDefaults().catch((e) => logger.error({ err: e }, "Failed to seed defaults"));
    processOverdueJob();
  });
}

let overdueJobRunning = false;
function processOverdueJob() {
  if (overdueJobRunning) return;
  overdueJobRunning = true;
  invoiceService.processOverdueInvoices().then((count) => {
    if (count > 0) logger.info(`Processed ${count} overdue invoices`);
  }).catch((e) => logger.error({ err: e }, "Overdue processing failed"));
  
  invoiceService.processAutomatedReminders().then((count) => {
    if (count > 0) logger.info(`Sent ${count} automated reminders`);
  }).catch((e) => logger.error({ err: e }, "Automated reminder processing failed"));
  
  overdueJobRunning = false;
  setTimeout(processOverdueJob, 15 * 60 * 1000);
}

if (!isTest) {
  start();
}

export default app;
