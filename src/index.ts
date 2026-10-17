import express, { NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Decimal } from "decimal.js";
import { env, isDev, isTest } from "./config/index.js";
import * as Sentry from "@sentry/node";
import { parsePagination } from "./utils/pagination.js";
import { validateDocumentTextInput } from "./utils/document-validation.js";
import { query, runWithRequestContext, getRequestContext } from "./db/pool.js";
import { getRedisSendCommand } from "./db/redis.js";
import { runMigrations } from "./db/migrate.js";
import { subscriptionService } from "./services/subscription.service.js";
import {
  requireAuth,
  optionalAuth,
  AuthRequest,
  generateTokenPair,
  consumeRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  setAccessTokenCookie,
  clearAccessTokenCookie,
} from "./middleware/auth.js";
import { revokeAccessToken } from "./services/auth/token-denylist.js";
import { idempotencyKey } from "./middleware/idempotency.js";
import {
  requireEntitlement,
  requireUsageLimit,
} from "./middleware/entitlement.js";
import { requireRole } from "./middleware/rbac.js";
import {
  reportsCache,
} from "./services/reports-cache.js";
import {
  reportsService,
  type ReportFilters,
} from "./services/reports-service.js";
import { twoFactorService } from "./services/auth/two-factor.service.js";
import { oauthService } from "./services/auth/oauth.service.js";
import { smsService, buildPaymentLinkSms } from "./services/sms/sms-service.js";
import { receiptService } from "./services/receipt-service.js";
import { speedOptimizationService } from "./services/speed-optimization-service.js";
import { invoiceService } from "./services/invoice-service.js";
import { paymentVoucherService } from "./services/payment-voucher-service.js";
import { debitNoteService } from "./services/debit-note-service.js";
import { z } from "zod";
import { AiParseDocumentType } from "./services/ai-service.js";
import { quoteService } from "./services/quote-service.js";
quoteService.setInvoiceService(invoiceService);
import { taxRuleService } from "./services/tax-rule-service.js";
import { discountRuleService } from "./services/discount-rule-service.js";
import { brandingService } from "./services/branding-service.js";
import {
  TaxRuleCreateSchema,
  TaxRuleUpdateSchema,
  TaxRuleSearchParamsSchema,
} from "./domain/schemas/tax-rule.js";
import {
  DiscountRuleCreateSchema,
  DiscountRuleUpdateSchema,
  DiscountRuleSearchParamsSchema,
} from "./domain/schemas/discount-rule.js";
import { BrandingInputSchema } from "./domain/schemas/branding.js";

const Route = (express as any).Route;
import { customerService } from "./services/customer-service.js";
import { businessRepository } from "./repositories/business.repo.js";
import { productRepository } from "./repositories/product.repo.js";
import { productServiceRepository } from "./repositories/product-service.repo.js";
import { productServiceService } from "./services/product-service/product-service.js";
import { customerRepository } from "./repositories/customer.repo.js";
import { receiptRepository } from "./repositories/receipt.repo.js";
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
} from "./domain/schemas/customer.js";
import {
  CreateProductServiceSchema,
  UpdateProductServiceSchema,
  CatalogSearchSchema,
  CatalogSelectionSchema,
  BulkCatalogSchema,
} from "./schemas/product-service.js";
import { aiService } from "./services/ai-service.js";
import { projectService } from "./services/project-service.js";
import { projectTimeEntryService } from "./services/project-time-service.js";
import {
  ProjectTimeEntryCreateSchema,
  ProjectTimeEntryUpdateSchema,
  ProjectTimeEntrySearchSchema,
  ProjectNoteCreateSchema,
} from "./domain/schemas/project-time-entry.js";
import { hashPassword, verifyPassword, validatePasswordPolicy, checkPasswordBreach } from "./services/auth/password.js";
import { camelToSnake } from "./utils/case-conversion.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", isDev ? true : 1);
const frontendBaseUrl = env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL;

// In Express 4, async route handlers/middleware that throw or reject are not
// automatically caught and passed to the error handler. This wrapper patches
// all Route methods to auto-catch async rejections and forward them to next().
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
const routeProto = Route.prototype as Record<string, (...args: any[]) => any>;
for (const method of HTTP_METHODS) {
  const original = routeProto[method];
  routeProto[method] = function (this: any, path: string, ...handlers: any[]) {
    const wrapped = handlers.map((h) => {
      if (typeof h === "function" && h.length < 4) {
        return (req: any, res: any, next: any) => {
          try {
            Promise.resolve(h(req, res, next)).catch(next);
          } catch (err) {
            next(err);
          }
        };
      }
      return h;
    });
    return original.call(this, path, ...wrapped);
  };
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://js.stripe.com",
          "https://static.sentry-sdks.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https:", "data:"],
        connectSrc: [
          "'self'",
          "https://api.stripe.com",
          "https://sentry.io",
          "https://plausible.io",
        ],
        frameSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://hooks.stripe.com",
          "https://sentry.io",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: isDev ? [] : ["'none'"],
      },
    },
    hsts: isDev
      ? undefined
      : {
          maxAge: 63072000,
          includeSubDomains: true,
          preload: true,
        },
    xPoweredBy: true,
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(cors({ origin: isDev ? true : frontendBaseUrl, credentials: true, maxAge: isDev ? undefined : 86400 }));
app.use(express.json({ limit: isDev ? "10mb" : "1mb" }));
app.use(express.urlencoded({ extended: true }));
if (isDev) app.use(morgan("dev"));

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration({
        shouldHandleError(error) {
          const statusCode = (error as any)?.statusCode;
          return !statusCode || statusCode >= 500;
        },
      }),
    ],
    tracesSampleRate: isDev ? 0 : 0.1,
    beforeSend(event) {
      if (event.request && event.request.headers) {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(event.request.headers)) {
          if (key !== "authorization" && key !== "cookie") {
            headers[key] = value as string;
          }
        }
        event.request.headers = headers;
      }
      return event;
    },
  });
  Sentry.setupExpressErrorHandler(app);
  logger.info("Sentry error tracking initialized");
}

const QUERY_COUNT_LOG_THRESHOLD = 10;
const REQUEST_DURATION_LOG_THRESHOLD_MS = 1000;

app.use((req, res, next) => {
  const url = req.url;
  if (!url.startsWith("/api/")) return next();
  const start = Date.now();
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
  res.setHeader("x-request-id", requestId);
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      logger.error(
        { url: req.url, method: req.method, requestId },
        "Request timed out — possible unhandled async error",
      );
      res
        .status(500)
        .json({ error: "Request timed out", code: "REQUEST_TIMEOUT" });
    }
  }, 20000);
  res.on("finish", () => clearTimeout(timeout));
  res.on("close", () => clearTimeout(timeout));
  const done = () => {
    const ms = Date.now() - start;
    const ctx = getRequestContext();
    if (ctx) {
      if (
        ctx.queryCount > QUERY_COUNT_LOG_THRESHOLD ||
        ctx.slowQueries.length > 0
      ) {
        const slowList = ctx.slowQueries
          .map((s) => `${s.ms}ms ${s.text}`)
          .join("; ");
        console.warn(
          `Request ${req.method} ${url} [${requestId}] took ${ms}ms, ${ctx.queryCount} queries` +
            (ctx.slowQueries.length
              ? ` (${ctx.slowQueries.length} slow: ${slowList})`
              : ""),
        );
      }
    } else if (ms > REQUEST_DURATION_LOG_THRESHOLD_MS) {
      console.warn(`Request ${req.method} ${url} [${requestId}] took ${ms}ms`);
    }
  };
  res.on("finish", done);
  res.on("close", done);
  runWithRequestContext(() => next(), requestId).catch((err) => {
    logger.error(
      { err, requestId, url: req.url, method: req.method },
      "Unhandled error in request pipeline",
    );
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
    }
  });
});

function getCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.substring(name.length + 1));
}

// Health
// ============================================================================
// RATE LIMITING
// ============================================================================
function createRateLimitStore() {
  const sendCommand = getRedisSendCommand();
  if (sendCommand) {
    return new RedisStore({ sendCommand, prefix: "rl:" });
  }
  return undefined;
}

const rateLimitStore = !isDev ? createRateLimitStore() : undefined;

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: "Too many attempts. Please try again later.",
    code: "RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDev ? () => true : undefined,
  store: rateLimitStore,
});

const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 300,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDev ? () => true : undefined,
  store: rateLimitStore,
});

const oauthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDev ? () => true : undefined,
  store: rateLimitStore,
});

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 30,
  message: {
    error: "Too many AI parse requests. Please try again later.",
    code: "AI_RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDev ? () => true : undefined,
  store: rateLimitStore,
});

const documentCreateRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 30,
  message: {
    error: "Too many document creation requests. Please try again later.",
    code: "DOCUMENT_RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDev ? () => true : undefined,
  store: rateLimitStore,
});

const emailSendRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 20,
  message: {
    error: "Too many email send requests. Please try again later.",
    code: "EMAIL_RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isDev ? () => true : undefined,
  store: rateLimitStore,
});

app.use("/api", generalRateLimiter);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    env: env.APP_ENV,
    timestamp: new Date().toISOString(),
  });
});

if (isDev) {
  app.get("/", (_req, res) => {
    res.json({
      name: "universal-invoice-generator",
      version: "1.0.0",
      status: "ok",
      docs: "/api/health",
      endpoints: [
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/me",
        "/api/plans",
        "/api/customers",
        "/api/products",
        "/api/projects",
      ],
    });
  });
}

// ============================================================================
// AUTH
// ============================================================================
app.post("/api/auth/register", authRateLimiter, async (req, res) => {
  const { email, password, name, countryCode, defaultCurrency } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "email and password required" });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email address is required" });
  }

  const passwordValidation = validatePasswordPolicy(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({
      error: "Password does not meet policy requirements",
      violations: passwordValidation.violations,
    });
  }

  const existing = await query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (existing.rows.length)
    return res.status(409).json({ error: "User already exists" });

  const breachCheck = await checkPasswordBreach(password);
  if (breachCheck.breached) {
    return res.status(400).json({
      error:
        "Password found in data breach. Please choose a different password.",
      breachCount: breachCheck.count,
    });
  }

   const userId = crypto.randomUUID();
  const businessId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  await query("BEGIN");
  try {
    await query(
      `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1,$2,$3,$4,$4)`,
      [userId, email, passwordHash, now],
    );
    await query(
      `INSERT INTO businesses (id, owner_id, name, country_code, default_currency, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)`,
      [
        businessId,
        userId,
        name || "My Business",
        countryCode || "US",
        defaultCurrency || "USD",
        now,
      ],
    );
    await query(
      `INSERT INTO business_settings (business_id, default_currency, time_zone, locale, created_at, updated_at) VALUES ($1,'USD','UTC','en-US',$2,$2)`,
      [businessId, now],
    );
    await query(
      `INSERT INTO business_users (business_id, user_id, role, status, invited_by, invited_at, accepted_at, created_at, updated_at)
       VALUES ($1, $2, 'owner', 'active', $2, $3, $3, $3, $3)`,
      [businessId, userId, now],
    );
    await query("COMMIT");
  } catch (e) {
    await query("ROLLBACK");
    throw e;
  }

   await onboardingService.ensureSteps(businessId);
  const { accessToken, refreshToken } = await generateTokenPair({
    userId,
    businessId,
    email,
  });
  setRefreshTokenCookie(res, refreshToken);
  setAccessTokenCookie(res, accessToken);
  res
    .status(201)
    .json({
      user: {
        id: userId,
        businessId,
        email,
        countryCode: countryCode || "US",
        defaultCurrency: defaultCurrency || "USD",
        role: "owner",
      },
    });
});

app.post("/api/auth/login", authRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "email and password required" });

  const result = await query(
    "SELECT id, email, password_hash, two_factor_enabled, two_factor_method FROM users WHERE email = $1",
    [email],
  );
  if (!result.rows.length)
    return res.status(401).json({ error: "Invalid credentials" });

  const user = result.rows[0];
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const subResult = await query(
    "SELECT id AS business_id FROM businesses WHERE owner_id = $1 LIMIT 1",
    [user.id],
  );
  const businessId = subResult.rows[0]?.business_id;

   // If 2FA is enabled, do NOT issue a token yet — require a second factor.
   if (user.two_factor_enabled) {
     return res.json({
       requiresTwoFactor: true,
       twoFactorMethod: user.two_factor_method ?? "totp",
       user: { id: user.id, businessId, email: user.email, role: "owner" },
     });
   }

  const { accessToken, refreshToken } = await generateTokenPair({
    userId: user.id,
    businessId,
    email: user.email,
  });
  setRefreshTokenCookie(res, refreshToken);
  setAccessTokenCookie(res, accessToken);
  const roleRes = await query(
    `SELECT 'owner'::text as role FROM businesses WHERE id = $1 AND owner_id = $2
     UNION ALL
     SELECT role::text FROM business_users WHERE business_id = $1 AND user_id = $2 AND status = 'active'
     LIMIT 1`,
    [businessId, user.id],
  );
  const role = roleRes.rows[0]?.role ?? "owner";
  res.json({ user: { id: user.id, businessId, email: user.email, role } });
});

app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const businessId = req.user.businessId;
    const sub = businessId
      ? await subscriptionRepository.findSubscriptionByBusinessId(businessId)
      : null;
    const plan = sub ? await subscriptionService.getPlanById(sub.planId) : null;
    const twoFactor = await twoFactorService.getStatus(req.user.id);
    const onboarding = businessId
      ? await onboardingService.getProgress(businessId)
      : null;
    let role: string | null = null;
    if (businessId) {
      const roleRes = await query(
        `SELECT 'owner'::text as role FROM businesses WHERE id = $1 AND owner_id = $2
         UNION ALL
         SELECT role::text FROM business_users WHERE business_id = $1 AND user_id = $2 AND status = 'active'
         LIMIT 1`,
        [businessId, req.user.id],
      );
      role = roleRes.rows[0]?.role ?? null;
    }
    res.json({
      user: { ...req.user, role },
      subscription: sub,
      plan,
      twoFactor,
      onboarding,
    });
  } catch (err) {
    handleAuthError(err, res);
  }
});

app.patch("/api/auth/profile", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { email } = req.body;
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
      values,
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    handleAuthError(err, res);
  }
});

app.post(
  "/api/auth/change-password",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ error: "currentPassword and newPassword required" });

    const passwordValidation = validatePasswordPolicy(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: "New password does not meet policy requirements",
        violations: passwordValidation.violations,
      });
    }

    try {
      const userRow = await query(
        "SELECT password_hash FROM users WHERE id = $1",
        [req.user!.id],
      );
      if (!userRow.rows.length)
        return res.status(404).json({ error: "User not found" });
      const valid = await verifyPassword(
        currentPassword,
        userRow.rows[0].password_hash,
      );
      if (!valid)
        return res.status(400).json({ error: "Current password is incorrect" });
      const hash = await hashPassword(newPassword);
      await query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [hash, req.user!.id],
      );
      res.json({ changed: true });
    } catch (err) {
      handleAuthError(err, res);
    }
  },
);

// ============================================================================
// ACTIVE SESSIONS
// ============================================================================
app.get("/api/auth/sessions", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const result = await query(
    "SELECT id, session_token, ip_address, user_agent, created_at, last_seen FROM user_sessions WHERE user_id = $1 ORDER BY last_seen DESC",
    [req.user!.id],
  );
  res.json({ sessions: result.rows });
});

app.delete(
  "/api/auth/sessions/:sessionId",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const result = await query(
      "DELETE FROM user_sessions WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.sessionId, req.user!.id],
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Session not found" });
    res.json({ revoked: true });
  },
);

// ============================================================================
// TOKEN REFRESH & LOGOUT
// ============================================================================
app.post("/api/auth/refresh", async (req: AuthRequest, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  const result = await consumeRefreshToken(
    refreshToken,
    req.ip,
    req.get("user-agent") || undefined,
  );

  if (!result) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  const { userId } = result;
  const userRes = await query(
    "SELECT id, email FROM users WHERE id = $1",
    [userId],
  );
  if (!userRes.rows.length) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ error: "User not found" });
  }

  const user = userRes.rows[0];
  const subResult = await query(
    "SELECT id AS business_id FROM businesses WHERE owner_id = $1 LIMIT 1",
    [user.id],
  );
  const businessId = subResult.rows[0]?.business_id;

  const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair({
    userId: user.id,
    businessId,
    email: user.email,
  });
   setRefreshTokenCookie(res, newRefreshToken);
   setAccessTokenCookie(res, accessToken);

    res.json({ user: { id: user.id, businessId, email: user.email, role: businessId ? "owner" : null } });
 });

  app.post("/api/auth/logout", async (req: AuthRequest, res) => {
    const accessToken = req.cookies?.accessToken || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
    if (accessToken) {
      await revokeAccessToken(accessToken, 15 * 60);
    }
    clearRefreshTokenCookie(res);
    clearAccessTokenCookie(res);
    res.json({ loggedOut: true });
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
app.post("/api/auth/2fa/verify", authRateLimiter, async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code)
    return res.status(400).json({ error: "email and code required" });

  try {
    const userRes = await query(
      "SELECT id, email FROM users WHERE email = $1",
      [email],
    );
    if (!userRes.rows.length)
      return res.status(401).json({ error: "Invalid code" });
    const u = userRes.rows[0];

    const subResult = await query(
      "SELECT id AS business_id FROM businesses WHERE owner_id = $1 LIMIT 1",
      [u.id],
    );
    const businessId = subResult.rows[0]?.business_id;

    const result = await twoFactorService.verifyLogin(
      u.id,
      u.email,
      businessId,
      code,
      req.ip,
    );
      if (result.refreshToken) {
        setRefreshTokenCookie(res, result.refreshToken);
      }
      setAccessTokenCookie(res, result.token);
      res.json({
        user: result.user,
        usedRecoveryCode: result.usedRecoveryCode,
      });
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
    const result = await twoFactorService.setup(
      req.user!.id,
      req.user!.email ?? "",
    );
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
app.post(
  "/api/auth/2fa/recovery-codes/regenerate",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const codes = await twoFactorService.regenerateRecoveryCodes(
        req.user!.id,
      );
      res.json({ recoveryCodes: codes });
    } catch (err) {
      handleAuthError(err, res);
    }
  },
);

// ============================================================================
// OAUTH 2.0 (Google Sign-In)
// ============================================================================
app.get("/api/auth/oauth/google", oauthRateLimiter, (req, res) => {
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

app.get("/api/auth/oauth/google/callback", oauthRateLimiter, async (req, res) => {
  const { code, error, error_description, state } = req.query as Record<
    string,
    string
  >;

  const stateCookie = getCookie(req.headers.cookie, "oauth_state");
  res.clearCookie("oauth_state", {
    httpOnly: true,
    sameSite: "lax",
    secure: !isDev,
  });

  if (error) {
    return res.redirect(
      `${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/login?oauth_error=${encodeURIComponent(error_description || error)}`,
    );
  }

  if (!code) {
    return res.redirect(
      `${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/login?oauth_error=no_code`,
    );
  }

  if (!state || !stateCookie || state !== stateCookie) {
    return res.redirect(
      `${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/login?oauth_error=${encodeURIComponent("Invalid or missing OAuth state parameter")}`,
    );
  }

  try {
    const result = await oauthService.handleCallback(code);
    if (result.refreshToken) {
      setRefreshTokenCookie(res, result.refreshToken);
    }
    setAccessTokenCookie(res, result.token);
    const redirectUrl = `${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/auth/callback`;
    res.redirect(redirectUrl);
  } catch (err: any) {
    const message =
      err instanceof Error ? err.message : "OAuth authentication failed";
    logger.error({ err, code }, "Google OAuth callback failed");
    res.redirect(
      `${env.APP_FRONTEND_URL || env.APP_PUBLIC_BASE_URL}/login?oauth_error=${encodeURIComponent(message)}`,
    );
  }
});

// ============================================================================
// ONBOARDING
// ============================================================================
app.get("/api/onboarding", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const progress = await onboardingService.getProgress(req.user!.businessId);
  res.json(progress);
});

app.post(
  "/api/onboarding/step/:step/complete",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { step } = req.params;
    try {
      const updated = await onboardingService.completeStep(
        req.user!.businessId,
        step,
      );
      const progress = await onboardingService.getProgress(
        req.user!.businessId,
      );
      res.json({ step: updated, progress });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

app.post(
  "/api/onboarding/step/:step/start",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { step } = req.params;
    try {
      const updated = await onboardingService.startStep(
        req.user!.businessId,
        step,
      );
      res.json({ step: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

app.post(
  "/api/onboarding/step/:step/skip",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { step } = req.params;
    try {
      const updated = await onboardingService.skipStep(
        req.user!.businessId,
        step,
      );
      const progress = await onboardingService.getProgress(
        req.user!.businessId,
      );
      res.json({ step: updated, progress });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },
);

app.post(
  "/api/onboarding/complete",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const steps = await onboardingRepository.findByBusinessId(
      req.user!.businessId,
    );
    for (const s of steps) {
      if (s.status !== "completed" && s.step !== "complete") {
        await onboardingRepository.updateStepStatus(
          req.user!.businessId,
          s.step,
          "completed",
        );
      }
    }
    await onboardingRepository.markComplete(req.user!.businessId);
    const progress = await onboardingService.getProgress(req.user!.businessId);
    res.json(progress);
  },
);

// ============================================================================
// PLANS & SUBSCRIPTIONS
// ============================================================================
app.get("/api/plans", async (_req, res) => {
  const plans = await subscriptionRepository.listPlans();
  res.json(camelToSnake({ plans }));
});

app.get(
  "/api/subscription/current",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const ctx = await subscriptionService.getSubscriptionContext(
      req.user!.businessId,
    );
    const plan = await subscriptionService.getPlanById(ctx.subscription.planId);
    res.json(camelToSnake({ subscription: ctx.subscription, plan }));
  },
);

app.post(
  "/api/subscription/upgrade",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { planCode } = req.body;
    if (!planCode) return res.status(400).json({ error: "planCode required" });

    const plans = await subscriptionRepository.listPlans();
    const plan = plans.find((p: any) => p.code === planCode);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const business = await businessRepository.findById(
      req.user!.businessId,
      req.user!.id,
    );

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
  },
);

app.post(
  "/api/subscription/downgrade",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { planCode } = req.body;
    if (!planCode) return res.status(400).json({ error: "planCode required" });

    const sub = await subscriptionService.downgradeBusiness(
      req.user!.businessId,
      planCode,
    );
    const plan = await subscriptionService.getPlanById(sub.planId);
    res.json(camelToSnake({ subscription: sub, plan }));
  },
);

app.post(
  "/api/subscription/cancel",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const ctx = await subscriptionService.getSubscriptionContext(
      req.user!.businessId,
    );
    if (ctx.subscription.stripeSubscriptionId) {
      try {
        await stripeService.cancelSubscription(
          ctx.subscription.stripeSubscriptionId,
        );
      } catch (e) {
        logger.warn(
          { err: e },
          "Failed to cancel Stripe subscription; cancelling locally",
        );
      }
    }
    const freePlan = await subscriptionRepository.findPlanByCode("free");
    const updated = await subscriptionRepository.updateSubscriptionByBusinessId(
      req.user!.businessId,
      {
        planId: freePlan?.id,
        status: "cancelled",
        cancelledAt: new Date(),
      },
    );
    await subscriptionRepository.recordSubscriptionEvent(
      req.user!.businessId,
      updated.id,
      "subscription_cancelled",
      ctx.plan.code,
      "free",
    );
    const plan = freePlan ?? ctx.plan;
    res.json(camelToSnake({ subscription: updated, plan }));
  },
);

app.get(
  "/api/subscription/payment-methods",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    res.json({ paymentMethods: [], stripeConfigured: !!env.STRIPE_SECRET_KEY });
  },
);

app.get("/api/stripe/config", async (_req, res) => {
  res.json({ publishableKey: env.STRIPE_PUBLISHABLE_KEY });
});

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req: express.Request, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      return res.status(400).send("Missing stripe-signature");
    }

    try {
      const event = await stripeService.constructWebhookEvent(
        req.body as Buffer,
        signature,
      );
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook failed");
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  },
);

app.get(
  "/api/subscription/events",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const events = await subscriptionRepository.getSubscriptionEvents(
      req.user!.businessId,
    );
    res.json({ events });
  },
);

// ============================================================================
// BUSINESSES
// ============================================================================
app.get(
  "/api/businesses/current",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const business = await businessRepository.findById(
      req.user!.businessId,
      req.user.id,
    );
    res.json({ business });
  },
);

app.patch(
  "/api/businesses/current",
  requireAuth,
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const business = await businessRepository.update(
      req.user!.businessId,
      req.body,
      req.user.id,
    );
    res.json({ business });
  },
);

// ============================================================================
// CUSTOMERS
// ============================================================================
app.get("/api/customers", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const parsed = CustomerSearchQuerySchema.parse(req.query);
  const enrich = parsed.enrich ?? false;
  const result = enrich
    ? await customerService.searchEnriched(req.user!.businessId, parsed)
    : await customerService.search(req.user!.businessId, parsed);
  res.json({
    data: result.data,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
});

app.post(
  "/api/customers/import",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const parsed = CustomerImportSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.message });
    const result = await customerService.importFromCsv(
      req.user!.businessId,
      parsed.data.csv,
      req.user!.id,
    );
    res.json(result);
  },
);

app.post("/api/customers", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    await requireUsageLimit("customers.unlimited", true)(
      req as any,
      res,
      async () => {
        const parsed = CustomerCreateSchema.parse(req.body);
        const customer = await customerService.create(
          parsed,
          req.user!.businessId!,
          req.user!.id,
        );
        res.status(201).json({ customer });
      },
    );
  } catch (err) {
    next(err);
  }
});

app.get("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const customer = await customerService.getById(
    req.user!.businessId,
    req.params.id,
  );
  res.json({ customer });
});

app.patch("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const parsed = CustomerUpdateSchema.parse(req.body);
  const customer = await customerService.update(
    req.user!.businessId,
    req.params.id,
    parsed,
    req.user!.id,
  );
  res.json({ customer });
});

app.delete("/api/customers/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  await customerService.archive(
    req.user!.businessId,
    req.params.id,
    req.user!.id,
  );
  res.json({ archived: true });
});

app.post(
  "/api/customers/:id/archive",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const customer = await customerService.archive(
      req.user!.businessId,
      req.params.id,
      req.user!.id,
    );
    res.json({ customer });
  },
);

app.post(
  "/api/customers/:id/restore",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const customer = await customerService.restore(
      req.user!.businessId,
      req.params.id,
      req.user!.id,
    );
    res.json({ customer });
  },
);

app.get(
  "/api/customers/:id/summary",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const summary = await customerService.getSummary(
      req.user!.businessId,
      req.params.id,
    );
    res.json({ summary });
  },
);

app.get(
  "/api/customers/:id/balance",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const balance = await customerRepository.getBalance(
      req.user!.businessId,
      req.params.id,
    );
    res.json({ balance });
  },
);

app.get(
  "/api/customers/:id/events",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const events = await customerService.getEvents(
      req.user!.businessId,
      req.params.id,
      limit,
    );
    res.json({ events });
  },
);

app.get("/api/customers/export", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const csv = await customerService.exportToCsv(req.user!.businessId);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="customers.csv"');
  res.send(csv);
});

// ============================================================================
// PRODUCTS
// ============================================================================
app.get("/api/products", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const products = await productRepository.findMany(
    req.user!.businessId,
    limit,
    offset,
  );
  res.json({ products, limit, offset });
});

app.post("/api/products", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const product = await productRepository.create(
    req.user!.businessId,
    req.body,
  );
  res.status(201).json({ product });
});

app.get("/api/products/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const product = await productRepository.findById(
    req.user!.businessId,
    req.params.id,
  );
  res.json({ product });
});

app.patch("/api/products/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const product = await productRepository.update(
    req.user!.businessId,
    req.params.id,
    req.body,
  );
  res.json({ product });
});

app.delete("/api/products/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  await productRepository.delete(req.user!.businessId, req.params.id);
  res.status(204).send();
});

// ============================================================================
// CATALOG (Product/Service domain)
// ============================================================================
app.get("/api/catalog", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
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
  const result = await productServiceService.search(
    req.user!.businessId,
    params,
  );
  res.json(result);
});

app.post("/api/catalog", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const parsed = CreateProductServiceSchema.parse(req.body);
  const item = await productServiceService.create(
    req.user!.businessId,
    parsed,
    req.user.id,
  );
  res.status(201).json({ item });
});

app.get(
  "/api/catalog/selection",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const params = CatalogSelectionSchema.parse({
      search: req.query.search,
      type: req.query.type,
      onlyActive: req.query.onlyActive,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    const items = await productServiceService.getForSelection(
      req.user!.businessId,
      params,
    );
    res.json({ items });
  },
);

app.post("/api/catalog/bulk", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const parsed = BulkCatalogSchema.parse(req.body);
  const result = await productServiceService.bulk(
    req.user!.businessId,
    parsed.items,
    parsed.conflictStrategy,
  );
  res.json(result);
});

app.get("/api/catalog/stats", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const counts = await productServiceService.countByStatus(
    req.user!.businessId,
  );
  res.json({ counts });
});

app.get("/api/catalog/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const item = await productServiceService.getById(
    req.user!.businessId,
    req.params.id,
  );
  res.json({ item });
});

app.patch("/api/catalog/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const parsed = UpdateProductServiceSchema.parse(req.body);
  const item = await productServiceService.update(
    req.user!.businessId,
    req.params.id,
    parsed,
    req.body.version ?? undefined,
  );
  res.json({ item });
});

app.post(
  "/api/catalog/:id/archive",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const item = await productServiceService.archive(
      req.user!.businessId,
      req.params.id,
    );
    res.json({ item });
  },
);

app.post(
  "/api/catalog/:id/restore",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const item = await productServiceService.restore(
      req.user!.businessId,
      req.params.id,
    );
    res.json({ item });
  },
);

app.get(
  "/api/catalog/sku/:sku/check",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const existing = await productServiceRepository.findBySku(
      req.user!.businessId,
      req.params.sku,
    );
    res.json({ available: !existing, exists: !!existing });
  },
);

// ============================================================================
// INVOICES
// ============================================================================

app.post("/api/invoices", documentCreateRateLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    validateDocumentTextInput(req.body);
    const invoice = await invoiceService.create(
      req.user!.businessId,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ invoice });
  } catch (err) {
    next(err);
  }
});

app.get("/api/invoices", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const pagination = parsePagination(req.query);
    const result = await invoiceService.findMany(req.user!.businessId, {
      limit: pagination.limit,
      offset: pagination.offset,
      status: req.query.status,
      search: req.query.search,
      customerId: req.query.customerId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get(
  "/api/invoices/:id",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const invoice = await invoiceService.findById(
        req.user!.businessId,
        req.params.id,
      );
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      res.json({ invoice });
    } catch (err) {
      next(err);
    }
  },
);

app.patch(
  "/api/invoices/:id",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const invoice = await invoiceService.update(
        req.user!.businessId,
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.json({ invoice });
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/invoices/:id/finalize",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.finalize(
        req.user!.businessId,
        req.params.id,
        req.user!.id,
      );
      res.json({
        invoice: result.invoice,
        invoiceNumber: result.invoiceNumber,
      });
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/invoices/:id/send",
  emailSendRateLimiter,
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.send(
        req.user!.businessId,
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/invoices/:id/record-payment",
  requireAuth,
  idempotencyKey,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const invoice = await invoiceService.recordPayment(
        req.user!.businessId,
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.json({ invoice });
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/invoices/:id/cancel",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const { reason } = req.body;
      const invoice = await invoiceService.cancel(
        req.user!.businessId,
        req.params.id,
        reason ?? "",
        req.user!.id,
      );
      res.json({ invoice });
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/invoices/:id/void",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const { reason } = req.body;
      const invoice = await invoiceService.void(
        req.user!.businessId,
        req.params.id,
        reason ?? "",
        req.user!.id,
      );
      res.json({ invoice });
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/invoices/:id/send-reminder",
  emailSendRateLimiter,
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.sendReminder(
        req.user!.businessId,
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/invoices/:id/duplicate",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const invoice = await invoiceService.duplicate(
        req.user!.businessId,
        req.params.id,
        req.user!.id,
      );
      res.status(201).json({ invoice });
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/invoices/:id/pdf",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const invoice = await invoiceService.findById(
        req.user!.businessId,
        req.params.id,
      );
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      const cacheKey = `pdf:invoice:${req.params.id}`;
      const cachedPdf = await reportsCache.get(cacheKey);
      if (cachedPdf) {
        res.set("Content-Type", "application/pdf");
        res.set("X-Content-Type-Options", "nosniff");
        res.set(
          "Content-Disposition",
           `attachment; filename="Invoice-${invoice.invoice_number ?? req.params.id}.pdf"`,
         );
         return res.send(cachedPdf);
       }

       const pdf = await invoiceService.generatePdf(
         req.user!.businessId,
         req.params.id,
         invoice,
       );

       if (pdf && pdf.length > 0) {
         await reportsCache.set(cacheKey, pdf);
       }

       res.set("Content-Type", "application/pdf");
        res.set("X-Content-Type-Options", "nosniff");
       res.set(
         "Content-Disposition",
         `attachment; filename="Invoice-${invoice.invoice_number ?? req.params.id}.pdf"`,
       );
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/invoices/:id/share-link",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const invoice = await invoiceService.findById(
        req.user!.businessId,
        req.params.id,
      );
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      if (!invoice.public_token) {
        const token = crypto.randomUUID().slice(0, 32);
        await query(
          `UPDATE invoices SET public_token = $1, public_token_expires_at = NOW() + INTERVAL '30 days'
         WHERE id = $2 AND business_id = $3`,
          [token, req.params.id, req.user!.businessId],
        );
        invoice.public_token = token;
        invoice.public_token_expires_at = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString();
      }

      const url = `${env.APP_FRONTEND_URL || "http://localhost:5173"}/invoice/${invoice.public_token}`;
      res.json({
        url,
        token: invoice.public_token,
        expiresAt: invoice.public_token_expires_at,
      });
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/invoices/:id/events",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.getInvoiceEvents(
        req.user!.businessId,
        req.params.id,
      );
      res.json({ events: result });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// PUBLIC INVOICE VIEW
// ============================================================================

app.get("/api/public/invoice/:token", async (req: AuthRequest, res, next) => {
  try {
    const invoice = await invoiceService.findByPublicToken(req.params.token);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

app.post("/api/public/payments/:token", async (req: AuthRequest, res, next) => {
  try {
    const invoice = await invoiceService.findByPublicToken(req.params.token);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const amountDue = new Decimal(String(invoice.amount_due ?? invoice.total ?? 0));
    if (amountDue.lte(0)) {
      return res.status(400).json({ error: "Invoice has no outstanding balance" });
    }

    const successUrl = req.body.successUrl || `${env.APP_FRONTEND_URL || "http://localhost:5173"}/invoice/paid?token=${req.params.token}`;
    const cancelUrl = req.body.cancelUrl || `${env.APP_FRONTEND_URL || "http://localhost:5173"}/invoice/${req.params.token}`;

    const result = await invoiceService.createPaymentSession(
      invoice.business_id as string,
      invoice.id as string,
      successUrl,
      cancelUrl
    );

    res.json({ url: result.url });
  } catch (err: any) {
    if (err?.message?.includes("not configured") || err?.code === "STRIPE_NOT_CONFIGURED") {
      return res.status(503).json({ error: "Payment processing is not configured" });
    }
    next(err);
  }
});

// ============================================================================
// CREDIT NOTES
// ============================================================================
// CREDIT NOTES
// ============================================================================

app.post(
  "/api/credit-notes/draft",
  documentCreateRateLimiter,
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.createCreditNoteDraft(
        req.user!.businessId,
        req.user!.id,
        req.body,
      );
      res.status(201).json({ creditNote: result });
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/credit-notes",
  documentCreateRateLimiter,
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.createCreditNote(
        req.user!.businessId,
        req.body,
        req.user!.id,
      );
      res.status(201).json({ creditNote: result });
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/credit-notes",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const pagination = parsePagination(req.query);
      const result = await invoiceService.listCreditNotes(
        req.user!.businessId,
        {
          invoiceId: req.query.invoiceId as string | undefined,
          status: req.query.status as string | undefined,
          customerId: req.query.customerId as string | undefined,
          search: req.query.search as string | undefined,
          dateFrom: req.query.dateFrom as string | undefined,
          dateTo: req.query.dateTo as string | undefined,
          limit: pagination.limit,
          offset: pagination.offset,
          sortBy: req.query.sortBy as string | undefined,
          sortOrder: (req.query.sortOrder as "asc" | "desc" | undefined) ?? "desc",
        },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/credit-notes/:id",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const creditNote = await invoiceService.getCreditNoteById(
        req.user!.businessId,
        req.params.id,
      );
      if (!creditNote)
        return res.status(404).json({ error: "Credit note not found" });
      res.json({ creditNote });
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/credit-notes/:id/events",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.getCreditNoteEvents(
        req.user!.businessId,
        req.params.id,
        Number(req.query.limit ?? 100),
        Number(req.query.offset ?? 0),
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.patch(
  "/api/credit-notes/:id/finalize",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.finalizeCreditNote(
        req.user!.businessId,
        req.params.id,
        req.user!.id,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/credit-notes/:id/send",
  emailSendRateLimiter,
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.sendCreditNote(
        req.user!.businessId,
        req.params.id,
        req.body,
        req.user!.id,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/credit-notes/:id/apply",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.applyCreditNote(
        req.user!.businessId,
        req.params.id,
        {
          invoiceId: req.body.invoiceId,
          amount: req.body.amount,
          applicationMethod: req.body.applicationMethod,
        },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/credit-notes/:id/cancel",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.cancelCreditNote(
        req.user!.businessId,
        req.params.id,
        req.user!.id,
        req.body?.reason ?? "",
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/credit-notes/:id/void",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const result = await invoiceService.voidCreditNote(
        req.user!.businessId,
        req.params.id,
        req.user!.id,
        req.body?.reason ?? "",
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/credit-notes/:id/pdf",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const creditNote = await invoiceService.getCreditNoteById(
        req.user!.businessId,
        req.params.id,
      );
      if (!creditNote)
        return res.status(404).json({ error: "Credit note not found" });
      const pdf = await invoiceService.generateCreditNotePdf(
        req.user!.businessId,
        req.params.id,
        creditNote,
      );
      res.set("Content-Type", "application/pdf");
        res.set("X-Content-Type-Options", "nosniff");
      res.set(
        "Content-Disposition",
         `attachment; filename="CreditNote-${creditNote.credit_note_number ?? req.params.id}.pdf"`,
      );
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/credit-notes/:id/share-link",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const creditNote = await invoiceService.getCreditNoteById(
        req.user!.businessId,
        req.params.id,
      );
      if (!creditNote)
        return res.status(404).json({ error: "Credit note not found" });

      if (!creditNote.public_token) {
        const token = crypto.randomUUID().slice(0, 32);
        await query(
          `UPDATE credit_notes SET public_token = $1, public_token_expires_at = NOW() + INTERVAL '30 days'
         WHERE id = $2 AND business_id = $3`,
          [token, req.params.id, req.user!.businessId],
        );
        creditNote.public_token = token;
      }

      res.json({
        token: creditNote.public_token,
        url: `${env.APP_PUBLIC_BASE_URL}/credit-notes/${creditNote.public_token}`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// QUOTES
// ============================================================================

app.get("/api/quotes", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const pagination = parsePagination(req.query);
    const result = await quoteService.findMany(req.user!.businessId, {
      limit: pagination.limit,
      offset: pagination.offset,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      customerId: req.query.customerId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get("/api/quotes/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const quote = await quoteService.findById(req.user!.businessId, req.params.id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes", documentCreateRateLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const quote = await quoteService.create(
      req.user!.businessId,
      req.body,
      req.user!.id
    );
    res.status(201).json({ quote });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/quotes/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const quote = await quoteService.update(
      req.user!.businessId,
      req.params.id,
      req.body,
      req.user!.id
    );
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes/:id/finalize", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const result = await quoteService.finalize(
      req.user!.businessId,
      req.params.id,
      req.user!.id
    );
    res.json({
      quote: result.quote,
      quoteNumber: result.quoteNumber,
      status: result.status,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes/:id/send", emailSendRateLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const result = await quoteService.send(
      req.user!.businessId,
      req.params.id,
      req.body,
      req.user!.id
    );
    const quote = await quoteService.findById(req.user!.businessId, req.params.id);
    res.json({
      success: result.success,
      messageId: result.messageId,
      status: result.status,
      sentAt: new Date().toISOString(),
      quote,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes/:id/accept", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const quote = await quoteService.accept(req.user!.businessId, req.params.id, req.user!.id);
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes/:id/reject", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const quote = await quoteService.reject(req.user!.businessId, req.params.id, req.user!.id);
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes/:id/expire", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const quote = await quoteService.expire(req.user!.businessId, req.params.id);
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes/:id/cancel", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const { reason } = req.body;
    const quote = await quoteService.cancel(
      req.user!.businessId,
      req.params.id,
      reason ?? "",
      req.user!.id
    );
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes/:id/void", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const { reason } = req.body;
    const quote = await quoteService.void(
      req.user!.businessId,
      req.params.id,
      reason ?? "",
      req.user!.id
    );
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes/:id/duplicate", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const quote = await quoteService.duplicate(
      req.user!.businessId,
      req.params.id,
      req.user!.id
    );
    res.status(201).json({ quote });
  } catch (err) {
    next(err);
  }
});

app.post("/api/quotes/:id/convert-to-invoice", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const result = await quoteService.convertToInvoice(
      req.user!.businessId,
      req.params.id,
      req.user!.id
    );
    res.json({
      quote: result.quote,
      invoiceId: result.invoiceId,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/quotes/:id/pdf", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const quote = await quoteService.findById(req.user!.businessId, req.params.id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    const pdf = await quoteService.generatePdf(
      req.user!.businessId,
      req.params.id,
      quote
    );
    res.set("Content-Type", "application/pdf");
        res.set("X-Content-Type-Options", "nosniff");
    res.set(
      "Content-Disposition",
       `attachment; filename="Quote-${(quote as any).quote_number ?? req.params.id}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

app.get("/api/quotes/:id/share-link", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const link = await quoteService.createShareLink(req.user!.businessId, req.params.id);
    res.json({
      token: link.token,
      url: link.url,
      expiresAt: link.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/quotes/:id/events", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const result = await quoteService.getEvents(
      req.user!.businessId,
      req.params.id,
      req.query.limit ? Number(req.query.limit) : undefined,
      req.query.offset ? Number(req.query.offset) : undefined
    );    res.json({ events: result.events, total: result.total });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PAYMENT VOUCHERS
// ============================================================================
app.post("/api/payment-vouchers", documentCreateRateLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const voucher = await paymentVoucherService.create(
      req.user!.businessId,
      req.body,
      req.user!.id
    );
    res.status(201).json({ voucher });
  } catch (err) {
    next(err);
  }
});

app.get("/api/payment-vouchers", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const result = await paymentVoucherService.findMany(
      req.user!.businessId,
      {
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        sortOrder: req.query.sortOrder as string | undefined,
        sortBy: req.query.sortBy as string | undefined,
      }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get("/api/payment-vouchers/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const voucher = await paymentVoucherService.findById(
      req.user!.businessId,
      req.params.id
    );
    if (!voucher) return res.status(404).json({ error: "Payment voucher not found" });
    res.json({ voucher });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/payment-vouchers/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const voucher = await paymentVoucherService.update(
      req.user!.businessId,
      req.params.id,
      req.body,
      req.user!.id
    );
    res.json({ voucher });
  } catch (err) {
    next(err);
  }
});

app.post("/api/payment-vouchers/:id/finalize", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const result = await paymentVoucherService.finalize(
      req.user!.businessId,
      req.params.id,
      req.user!.id
    );
    res.json({ voucher: result.voucher, voucherNumber: result.voucherNumber });
  } catch (err) {
    next(err);
  }
});

app.post("/api/payment-vouchers/:id/cancel", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const voucher = await paymentVoucherService.cancel(
      req.user!.businessId,
      req.params.id,
      req.body.reason ?? "",
      req.user!.id
    );
    res.json({ voucher });
  } catch (err) {
    next(err);
  }
});

app.post("/api/payment-vouchers/:id/void", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const voucher = await paymentVoucherService.void(
      req.user!.businessId,
      req.params.id,
      req.body.reason ?? "",
      req.user!.id
    );
    res.json({ voucher });
  } catch (err) {
    next(err);
  }
});

app.get("/api/payment-vouchers/:id/pdf", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const voucher = await paymentVoucherService.findById(
      req.user!.businessId,
      req.params.id
    );
    if (!voucher) return res.status(404).json({ error: "Payment voucher not found" });

    const pdf = await paymentVoucherService.generatePdf(
      req.user!.businessId,
      req.params.id,
      voucher
    );
    res.set("Content-Type", "application/pdf");
        res.set("X-Content-Type-Options", "nosniff");
    res.set(
      "Content-Disposition",
       `attachment; filename="PaymentVoucher-${(voucher as any).payment_voucher_number ?? req.params.id}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

app.get("/api/payment-vouchers/:id/events", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const events = await paymentVoucherService.getEvents(
      req.user!.businessId,
      req.params.id,
      req.query.limit ? Number(req.query.limit) : undefined,
      req.query.offset ? Number(req.query.offset) : undefined
    );
    res.json({ events, total: events.length });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DEBIT NOTES
// ============================================================================
app.post("/api/debit-notes", documentCreateRateLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const note = await debitNoteService.create(
      req.user!.businessId,
      req.body,
      req.user!.id
    );
    res.status(201).json({ debitNote: note });
  } catch (err) {
    next(err);
  }
});

app.get("/api/debit-notes", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const result = await debitNoteService.findMany(
      req.user!.businessId,
      {
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        customerId: req.query.customerId as string | undefined,
        sortOrder: req.query.sortOrder as string | undefined,
        sortBy: req.query.sortBy as string | undefined,
      }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get("/api/debit-notes/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const note = await debitNoteService.findById(
      req.user!.businessId,
      req.params.id
    );
    if (!note) return res.status(404).json({ error: "Debit note not found" });
    res.json({ debitNote: note });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/debit-notes/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const note = await debitNoteService.update(
      req.user!.businessId,
      req.params.id,
      req.body,
      req.user!.id
    );
    res.json({ debitNote: note });
  } catch (err) {
    next(err);
  }
});

app.post("/api/debit-notes/:id/finalize", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const result = await debitNoteService.finalize(
      req.user!.businessId,
      req.params.id,
      req.user!.id
    );
    res.json({ debitNote: result.debitNote, debitNoteNumber: result.debitNoteNumber });
  } catch (err) {
    next(err);
  }
});

app.post("/api/debit-notes/:id/send", emailSendRateLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const result = await debitNoteService.send(
      req.user!.businessId,
      req.params.id,
      req.body,
      req.user!.id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post("/api/debit-notes/:id/cancel", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const note = await debitNoteService.cancel(
      req.user!.businessId,
      req.params.id,
      req.body.reason ?? "",
      req.user!.id
    );
    res.json({ debitNote: note });
  } catch (err) {
    next(err);
  }
});

app.post("/api/debit-notes/:id/void", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const note = await debitNoteService.void(
      req.user!.businessId,
      req.params.id,
      req.body.reason ?? "",
      req.user!.id
    );
    res.json({ debitNote: note });
  } catch (err) {
    next(err);
  }
});

app.get("/api/debit-notes/:id/pdf", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const note = await debitNoteService.findById(
      req.user!.businessId,
      req.params.id
    );
    if (!note) return res.status(404).json({ error: "Debit note not found" });

    const pdf = await debitNoteService.generatePdf(
      req.user!.businessId,
      req.params.id,
      note
    );
    res.set("Content-Type", "application/pdf");
        res.set("X-Content-Type-Options", "nosniff");
    res.set(
      "Content-Disposition",
       `attachment; filename="DebitNote-${(note as any).debit_note_number ?? req.params.id}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

app.get("/api/debit-notes/:id/events", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const events = await debitNoteService.getEvents(
      req.user!.businessId,
      req.params.id,
      req.query.limit ? Number(req.query.limit) : undefined,
      req.query.offset ? Number(req.query.offset) : undefined
    );
    res.json({ events, total: events.length });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PUBLIC QUOTE VIEW
// ============================================================================

app.get("/api/public/quote/:token", async (req: AuthRequest, res, next) => {
  try {
    const quote = await quoteService.findByPublicToken(req.params.token);
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    res.json({ quote });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// SPEED OPTIMIZATION API (Predictive UX)
// ============================================================================

app.get(
  "/api/suggested-actions",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const actions = await speedOptimizationService.getQuickActions(
      req.user!.businessId,
      req.user!.id,
    );
    res.json(actions);
  },
);

app.post(
  "/api/parse-command-line",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { input } = req.body;
    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Input text is required" });
    }

    let products: any[] = [];
    try {
      const productsRes = await productRepository.findMany(
        req.user!.businessId,
        200,
        0,
      );
      products = productsRes || [];
    } catch {
      products = [];
    }

    const parsed = speedOptimizationService.parseCommandLineItem(
      input,
      products as any,
    );
    res.json({ parsed });
  },
);

app.get(
  "/api/progressive-autofill",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { customerId } = req.query;
    const autofill = await speedOptimizationService.getProgressiveAutofill(
      req.user!.businessId,
      customerId as string | undefined,
    );
    res.json(autofill);
  },
);

// Record a user interaction for adaptive UI learning
app.post("/api/interaction-log", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const { actionType, targetField, durationMs, valueFrom, valueTo, sessionId } =
    req.body;
  try {
    await speedOptimizationService.logInteraction(
      req.user!.businessId,
      req.user!.id,
      actionType,
      targetField,
      durationMs,
      valueFrom,
      valueTo,
      sessionId,
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to log interaction" });
  }
});

// ============================================================================
// RECEIPTS (Business tier)
// ============================================================================
app.get(
  "/api/receipts",
  requireAuth,
  requireEntitlement("receipts.create"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const result = await receiptService.listResponse(req.user!.businessId, {
      status: req.query.status as string | undefined,
      paymentId: req.query.paymentId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      search: req.query.search as string | undefined,
      provider: req.query.provider as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json(result);
  },
);

app.get(
  "/api/receipts/summary",
  requireAuth,
  requireEntitlement("receipts.create"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const businessId = req.user!.businessId;

    const monthStart = new Date();
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setDate(1);

    const metricsRes = await query(
      `SELECT
       COALESCE(SUM(r.amount), 0) AS total_receipts,
       COALESCE(SUM(CASE WHEN r.issued_at >= $2 THEN r.amount ELSE 0 END), 0) AS receipts_this_month,
       COALESCE(SUM(CASE WHEN r.status = 'issued' THEN r.amount ELSE 0 END), 0) AS issued_amount,
       COALESCE(SUM(CASE WHEN r.status = 'sent' THEN r.amount ELSE 0 END), 0) AS sent_amount,
       COALESCE(SUM(CASE WHEN r.status = 'failed' THEN r.amount ELSE 0 END), 0) AS failed_amount,
       COUNT(*) AS total_count,
       COUNT(CASE WHEN r.status = 'issued' THEN 1 END) AS issued_count,
       COUNT(CASE WHEN r.status = 'sent' THEN 1 END) AS sent_count,
       COUNT(CASE WHEN r.status = 'failed' THEN 1 END) AS failed_count,
       COALESCE(MAX(r.currency), 'USD') AS currency
     FROM receipts r
     WHERE r.business_id = $1`,
      [businessId, monthStart.toISOString()],
    );

    const row = metricsRes.rows[0];
    res.json({
      totalReceipts: String(row.total_receipts ?? "0"),
      receiptsThisMonth: String(row.receipts_this_month ?? "0"),
      issuedAmount: String(row.issued_amount ?? "0"),
      sentAmount: String(row.sent_amount ?? "0"),
      failedAmount: String(row.failed_amount ?? "0"),
      totalCount: Number(row.total_count ?? 0),
      issuedCount: Number(row.issued_count ?? 0),
      sentCount: Number(row.sent_count ?? 0),
      failedCount: Number(row.failed_count ?? 0),
      currency: row.currency ?? "USD",
    });
  },
);

app.get(
  "/api/receipts/:id",
  requireAuth,
  requireEntitlement("receipts.create"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const receipt = await receiptService.getResponse(
      req.user!.businessId,
      req.params.id,
    );
    res.json({ receipt });
  },
);

app.get(
  "/api/receipts/:id/pdf",
  requireAuth,
  requireEntitlement("receipts.create"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const cached = await receiptRepository.findById(
      req.user!.businessId,
      req.params.id,
    );
    if (cached.pdf) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt-${cached.receiptNumber ?? req.params.id}.pdf`,
    );
      res.send(cached.pdf);
      return;
    }
    const { pdf, receiptNumber } = await receiptService.generatePdfWithMeta(
      cached.id,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt-${receiptNumber ?? req.params.id}.pdf`,
    );
    res.send(pdf);
  },
);

app.post(
  "/api/receipts/:id/email",
  emailSendRateLimiter,
  requireAuth,
  requireEntitlement("receipts.create"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const receipt = await receiptService.getById(
      req.user!.businessId,
      req.params.id,
    );
    const result = await receiptService.sendReceiptEmail(receipt.id, {
      email: req.body.email,
      name: req.body.name,
      subject: req.body.subject,
      message: req.body.message,
    });
    res.json({ ok: true, ...result });
  },
);

app.get(
  "/api/receipts/:id/detail",
  requireAuth,
  requireEntitlement("receipts.create"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const receiptDetail = await receiptService.getDetailResponse(
      req.user!.businessId,
      req.params.id,
    );
    res.json({ receipt: receiptDetail });
  },
);

// ============================================================================
// REPORTS (Business tier)
// ============================================================================
app.get(
  "/api/reports/dashboard",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const cacheKey = `dashboard:${req.user!.businessId}`;
    const cached = await reportsCache.get(cacheKey);
    if (cached) return res.json(cached);
    const businessId = req.user!.businessId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [summary, volumeTrend, paymentMetrics] = await Promise.all([
      reportsService.getDashboardSummary(businessId),
      reportsService.getVolumeTrend(businessId, 1),
      reportsService.getPaymentMetrics(businessId, monthStart),
    ]);

    const response = {
      summary,
      agingBuckets: [],
      paymentMetrics: paymentMetrics ?? {
        averagePaymentTimeDays: 0,
        collectionRate: 0,
        totalInvoiced: "0",
        totalPaid: "0",
        totalOutstanding: "0",
        totalOverdue: "0",
      },
      volumeTrend,
    };
     reportsCache.set(cacheKey, response);
    res.json(response);
  },
);

app.get(
  "/api/reports/volume-trend",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const cacheKey = `volume-trend:${req.user!.businessId}`;
    const cached = await reportsCache.get(cacheKey);
    if (cached) return res.json(cached);
    const months = Math.min(Number(req.query.months ?? 3), 12);
    const period = (req.query.period as string) ?? "month";
    const validPeriod =
      period === "day" || period === "week" || period === "month"
        ? period
        : "month";
    const result = await reportsService.getVolumeTrend(
      req.user!.businessId,
      months,
      validPeriod,
    );
    await reportsCache.set(cacheKey, result);
    res.json(result);
  },
);

app.get(
  "/api/reports/payment-metrics",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const cacheKey = `payment-metrics:${req.user!.businessId}`;
    const cached = await reportsCache.get(cacheKey);
    if (cached) return res.json(cached);
    const monthStart = new Date();
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setDate(1);
    const result = await reportsService.getPaymentMetrics(
      req.user!.businessId,
      monthStart,
    );
    if (result) {
      await reportsCache.set(cacheKey, result);
      res.json(result);
    } else {
      res.status(404).json(null);
    }
  },
);

app.get("/api/reports/aging", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const result = await reportsService.getAgingReport(req.user!.businessId);
  if (result) {
    res.json(result);
  } else {
    res.status(404).json(null);
  }
});

app.get(
  "/api/reports/revenue",
  requireAuth,
  requireEntitlement("reports.revenue"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const filters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      customerId: req.query.customerId as string | undefined,
      status: req.query.status as string | string[] | undefined,
    };
    const result = await reportsService.getRevenueReport(
      req.user!.businessId,
      filters,
    );
    res.json(result);
  },
);

app.get(
  "/api/reports/payments",
  requireAuth,
  requireEntitlement("reports.payments"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const status = req.query.status;
    const filters: ReportFilters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      provider: req.query.provider as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as string | undefined as
        "asc" | "desc" | undefined,
    };
    if (status) {
      filters.paymentStatus = Array.isArray(status)
        ? status.map((s) => String(s))
        : [String(status)];
    }
    const result = await reportsService.getPaymentsReport(
      req.user!.businessId,
      filters,
    );
    res.json(result);
  },
);

app.get(
  "/api/reports/clients",
  requireAuth,
  requireEntitlement("reports.clients"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const filters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    };
    const result = await reportsService.getClientsReport(
      req.user!.businessId,
      filters,
    );
    res.json(result);
  },
);

app.get(
  "/api/reports/tax-summary",
  requireAuth,
  requireEntitlement("reports.tax_summary"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const filters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const result = await reportsService.getTaxSummaryReport(
      req.user!.businessId,
      filters,
    );
    res.json(result);
  },
);

app.get(
  "/api/reports/profit-loss",
  requireAuth,
  requireEntitlement("reports.profit_loss"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const filters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const result = await reportsService.getProfitLossReport(
      req.user!.businessId,
      filters,
    );
    res.json(result);
  },
);

// ============================================================================
// PAYMENT RISK SCORING API (Autonomous AR)
// ============================================================================
// Removed: payment risk scoring routes depend on invoices which have been removed.

// Report CSV export endpoints
app.get(
  "/api/reports/revenue/csv",
  requireAuth,
  requireEntitlement("export.csv"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const report = await reportsService.getRevenueReport(req.user!.businessId, {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      customerId: req.query.customerId as string | undefined,
    });
    const headers = [
      "status",
      "count",
      "total_amount",
      "paid_amount",
      "outstanding_amount",
    ];
    const rows = [headers.join(",")];
    for (const r of report.byStatus) {
      rows.push(
        headers
          .map((h) => JSON.stringify(String(r[h as keyof typeof r] ?? "")))
          .join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=revenue-report.csv",
    );
    res.send(rows.join("\n"));
  },
);

app.get(
  "/api/reports/payments/csv",
  requireAuth,
  requireEntitlement("export.csv"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const report = await reportsService.getPaymentsReport(
      req.user!.businessId,
      {
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        provider: req.query.provider as string | undefined,
      },
    );
    const headers = [
      "paid_at",
      "invoice_number",
      "customer_name",
      "amount",
      "currency",
      "status",
      "method",
      "provider",
    ];
    const rows = [headers.join(",")];
    for (const r of report.payments) {
      rows.push(
        headers
          .map((h) => JSON.stringify(String((r as any)[h] ?? "")))
          .join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=payments-report.csv",
    );
    res.send(rows.join("\n"));
  },
);

app.get(
  "/api/reports/clients/csv",
  requireAuth,
  requireEntitlement("export.csv"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const report = await reportsService.getClientsReport(req.user!.businessId);
    const headers = [
      "name",
      "company_name",
      "email",
      "phone",
      "country_code",
      "invoice_count",
      "total_invoiced",
      "total_paid",
      "total_outstanding",
      "last_invoice_date",
    ];
    const rows = [headers.join(",")];
    for (const r of report.clients) {
      rows.push(
        headers
          .map((h) => JSON.stringify(String((r as any)[h] ?? "")))
          .join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=clients-report.csv",
    );
    res.send(rows.join("\n"));
  },
);

app.get(
  "/api/reports/tax-summary/csv",
  requireAuth,
  requireEntitlement("export.csv"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const filters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const report = await reportsService.getTaxSummaryReport(
      req.user!.businessId,
      filters,
    );
    const headers = [
      "period",
      "tax_collected",
      "taxable_amount",
      "invoice_count",
      "currency",
    ];
    const rows = [headers.join(",")];
    for (const r of report.byPeriod) {
      rows.push(
        headers
          .map((h) => JSON.stringify(String((r as any)[h] ?? "")))
          .join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=tax-summary-report.csv",
    );
    res.send(rows.join("\n"));
  },
);

app.get(
  "/api/reports/profit-loss/csv",
  requireAuth,
  requireEntitlement("export.csv"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const filters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const report = await reportsService.getProfitLossReport(
      req.user!.businessId,
      filters,
    );
    const headers = ["category", "amount", "count"];
    const rows = [headers.join(",")];
    rows.push(
      headers
        .map((h) => JSON.stringify(String((report.revenue as any)[h] ?? "")))
        .join(","),
    );
    rows.push(["net_income", report.netIncome ?? "", ""].join(","));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=profit-loss-report.csv",
    );
    res.send(rows.join("\n"));
  },
);

// ============================================================================
// REMINDER TEMPLATES
// ============================================================================
app.get(
  "/api/reminder-templates",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const result = await query(
      "SELECT id, business_id, name, subject_template AS subject, body_template AS message, is_default, created_at, updated_at FROM email_templates WHERE business_id = $1 ORDER BY created_at DESC",
      [req.user!.businessId],
    );
    res.json({ templates: result.rows });
  },
);

app.post(
  "/api/reminder-templates",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { name, subject, message } = req.body;
    if (!name || !subject || !message)
      return res
        .status(400)
        .json({ error: "name, subject, and message are required" });
    const result = await query(
      `INSERT INTO email_templates (id, business_id, template_type, name, subject_template, body_template, locale, is_active, is_default, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'reminder', $2, $3, $4, 'en-US', true, false, NOW(), NOW())
     RETURNING id, business_id, name, subject_template AS subject, body_template AS message, is_default, created_at, updated_at`,
      [req.user!.businessId, name, subject, message],
    );
    res.status(201).json({ template: result.rows[0] });
  },
);

app.patch(
  "/api/reminder-templates/:id",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { name, subject, message } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [req.user!.businessId, req.params.id];
    let i = 3;
    if (name !== undefined) {
      updates.push(`name = $${i++}`);
      values.push(name);
    }
    if (subject !== undefined) {
      updates.push(`subject_template = $${i++}`);
      values.push(subject);
    }
    if (message !== undefined) {
      updates.push(`body_template = $${i++}`);
      values.push(message);
    }
    if (updates.length === 0)
      return res.status(400).json({ error: "No fields to update" });
    const result = await query(
      `UPDATE email_templates SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${i++} AND business_id = $1
     RETURNING id, business_id, name, subject_template AS subject, body_template AS message, is_default, created_at, updated_at`,
      [...values, req.params.id],
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Template not found" });
    res.json({ template: result.rows[0] });
  },
);

app.delete(
  "/api/reminder-templates/:id",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const result = await query(
      "DELETE FROM email_templates WHERE id = $1 AND business_id = $2 AND template_type = 'reminder' RETURNING id",
      [req.params.id, req.user!.businessId],
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Template not found" });
    res.json({ deleted: true });
  },
);

app.get("/api/features", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const ctx = await subscriptionService.getSubscriptionContext(
    req.user!.businessId,
  );
  const flags = await subscriptionRepository.listPremiumFeatureFlags(
    ctx.plan.code,
  );
  const allFlags = await subscriptionRepository.listFeatureFlags();
  res.json(
    camelToSnake({ plan: ctx.plan.code, features: allFlags, premium: flags }),
  );
});

// ============================================================================
// TEMPLATES (CRUD for invoice templates)
// ============================================================================
app.get("/api/templates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const templates = await templateRepository.findMany(
    req.user!.businessId,
    limit,
    offset,
  );
  res.json({ templates, limit, offset });
});

app.post("/api/templates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const template = await templateRepository.create(req.user!.businessId, {
    name: req.body.name ?? "Untitled Template",
    htmlTemplate: req.body.htmlTemplate ?? "",
    config: req.body.config ?? {},
    isDefault: req.body.isDefault ?? false,
  });
  res.status(201).json({ template });
});

app.get(
  "/api/templates/default",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const template = await templateRepository.findDefault(req.user!.businessId);
    res.json({ template });
  },
);

app.get("/api/templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const template = await templateRepository.findById(
    req.user!.businessId,
    req.params.id,
  );
  res.json({ template });
});

app.patch("/api/templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const template = await templateRepository.update(
    req.user!.businessId,
    req.params.id,
    req.body,
  );
  res.json({ template });
});

app.delete("/api/templates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  await templateRepository.delete(req.user!.businessId, req.params.id);
  res.status(204).send();
});

// ============================================================================
// DOCUMENT TEMPLATES (structured InvoiceDocument JSON layouts)
// ============================================================================
app.get(
  "/api/document-templates",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const industry = req.query.industry
      ? String(req.query.industry)
      : undefined;
    const isDefault =
      req.query.isDefault !== undefined
        ? Boolean(req.query.isDefault)
        : undefined;
    const templates = await documentTemplateRepository.findMany(
      req.user!.businessId,
      {
        industry,
        isDefault,
        limit,
        offset,
      },
    );
    res.json({ templates, limit, offset });
  },
);

app.post(
  "/api/document-templates",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const parsed = DocumentTemplateInputSchema.parse(req.body);
    const template = await documentTemplateRepository.create(
      req.user!.businessId,
      parsed,
      req.user!.id,
    );
    res.status(201).json({ template });
  },
);

app.get(
  "/api/document-templates/default",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const industry = req.query.industry ? String(req.query.industry) : null;
    const template = industry
      ? await documentTemplateRepository.findDefaultByIndustry(
          req.user!.businessId,
          industry,
        )
      : await documentTemplateRepository.findDefault(req.user!.businessId);
    res.json({ template });
  },
);

app.get(
  "/api/document-templates/:id",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const template = await documentTemplateRepository.findById(
      req.user!.businessId,
      req.params.id,
    );
    res.json({ template });
  },
);

app.patch(
  "/api/document-templates/:id",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const parsed = DocumentTemplateUpdateSchema.parse(req.body);
    const template = await documentTemplateRepository.update(
      req.user!.businessId,
      req.params.id,
      parsed,
    );
    res.json({ template });
  },
);

app.delete(
  "/api/document-templates/:id",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    await documentTemplateRepository.delete(
      req.user!.businessId,
      req.params.id,
    );
    res.status(204).send();
  },
);

app.post(
  "/api/document-templates/:id/duplicate",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const template = await documentTemplateRepository.duplicate(
      req.user!.businessId,
      req.params.id,
      req.user!.id,
    );
    res.status(201).json({ template });
  },
);

app.post(
  "/api/document-templates/:id/set-default",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const template = await documentTemplateRepository.setDefault(
      req.user!.businessId,
      req.params.id,
    );
    res.json({ template });
  },
);

// ============================================================================
// AI DOCUMENT PARSING (natural-language to structured fields)
// ============================================================================
const AiParseDocumentTypeSchema = z.enum(["invoice", "quote", "credit_note", "receipt", "purchase_order"]);

app.post(
  "/api/ai/parse-document",
  requireAuth,
  aiRateLimiter,
  requireEntitlement("ai.document_parsing"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });

    const text = req.body?.text;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "text is required" });
    }

    const documentType = AiParseDocumentTypeSchema.optional().parse(req.body?.documentType) ?? "invoice";

    const result = await aiService.parseDocument(text, {
      businessId: req.user!.businessId,
      documentType: documentType as AiParseDocumentType,
    });

    res.json(result);
  },
);

// ============================================================================
// INVOICE TEMPLATES (canonical lifecycle + versioning) — Removed
// ============================================================================

// ============================================================================
// PROJECTS
// ============================================================================
app.get("/api/projects", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
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
  res.json(
    camelToSnake({
      projects: result.data,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    }),
  );
});
app.post("/api/projects", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    await requireUsageLimit("projects.unlimited", true)(
      req as any,
      res,
      async () => {
        const parsed = ProjectCreateSchema.parse(req.body);
        const businessId = req.user?.businessId;
        if (!businessId)
          return res.status(400).json({ error: "No business context" });
        const project = await projectService.create(
          parsed,
          businessId,
          req.user!.id,
        );
        res.status(201).json(camelToSnake({ project }));
      },
    );
  } catch (err) {
    next(err);
  }
});

app.get("/api/projects/search", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const search = req.query.q as string | undefined;
  const projects = await projectService.searchForSelection(
    req.user!.businessId,
    search,
  );
  res.json(camelToSnake({ projects }));
});

app.get("/api/projects/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const summary = await projectService.getSummary(
    req.user!.businessId,
    req.params.id,
  );
  res.json(
    camelToSnake({
      project: summary.project,
      customer: summary.customer,
      tags: summary.tags,
      teamMembers: summary.teamMembers,
      financialSummary: summary.financialSummary,
    }),
  );
});

app.patch("/api/projects/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const parsed = ProjectUpdateSchema.parse(req.body);
  const project = await projectService.update(
    req.user!.businessId,
    req.params.id,
    parsed,
    req.user!.id,
  );
  res.json(camelToSnake({ project }));
});

app.post(
  "/api/projects/:id/status",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });
    const project = await projectService.updateStatus(
      req.user!.businessId,
      req.params.id,
      status,
      req.user!.id,
    );
    res.json(camelToSnake({ project }));
  },
);

app.post(
  "/api/projects/:id/archive",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const project = await projectService.archive(
      req.user!.businessId,
      req.params.id,
      req.user!.id,
    );
    res.json(camelToSnake({ project }));
  },
);

app.post(
  "/api/projects/:id/restore",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const project = await projectService.restore(
      req.user!.businessId,
      req.params.id,
      req.user!.id,
    );
    res.json(camelToSnake({ project }));
  },
);

app.delete("/api/projects/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  await projectService.delete(req.user!.businessId, req.params.id);
  res.status(204).send();
});

app.get(
  "/api/projects/:id/financial-summary",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const summary = await projectService.getFinancialSummary(
      req.user!.businessId,
      req.params.id,
    );
    res.json(camelToSnake({ summary }));
  },
);

app.get(
  "/api/projects/:id/events",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const events = await projectService.getEvents(
      req.user!.businessId,
      req.params.id,
      limit,
    );
    res.json(camelToSnake({ events }));
  },
);

// Project tags
app.get("/api/projects/tags", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const tags = await projectService.getTagsByBusiness(req.user!.businessId);
  res.json(camelToSnake({ tags }));
});

app.post(
  "/api/projects/:id/tags",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: "tag name required" });
    const tag = await projectService.addTag(
      req.user!.businessId,
      req.params.id,
      name,
      color,
    );
    res.status(201).json(camelToSnake({ tag }));
  },
);

app.delete(
  "/api/projects/:id/tags/:tagId",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    await projectService.removeTag(
      req.user!.businessId,
      req.params.id,
      req.params.tagId,
    );
    res.status(204).send();
  },
);

// Project team members
app.get(
  "/api/projects/:id/team",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const members = await projectService.getTeamMembers(
      req.user!.businessId,
      req.params.id,
    );
    res.json(camelToSnake({ members }));
  },
);

app.post(
  "/api/projects/:id/team",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { userId, role } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const member = await projectService.addTeamMember(
      req.user!.businessId,
      req.params.id,
      userId,
      role,
      req.user!.id,
    );
    res.status(201).json(camelToSnake({ member }));
  },
);

app.delete(
  "/api/projects/:id/team/:userId",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    await projectService.removeTeamMember(
      req.user!.businessId,
      req.params.id,
      req.params.userId,
    );
    res.status(204).send();
  },
);

// ============================================================================
// PROJECT TIME TRACKING
// ============================================================================

app.post(
  "/api/projects/:projectId/time-entries",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const parsed = ProjectTimeEntryCreateSchema.parse(req.body);
      const entry = await projectTimeEntryService.create(
        req.user!.businessId,
        req.params.projectId,
        parsed,
        req.user!.id,
      );
      res.status(201).json(camelToSnake({ entry }));
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/projects/:projectId/time-entries",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const parsed = ProjectTimeEntrySearchSchema.parse({
        ...req.query,
        limit: req.query.limit ?? 50,
        offset: req.query.offset ?? 0,
      });
      const result = await projectTimeEntryService.getProjectEntries(
        req.user!.businessId,
        req.params.projectId,
        parsed,
      );
      res.json(
        camelToSnake({
          entries: result.data,
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

app.patch(
  "/api/time-entries/:id",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const parsed = ProjectTimeEntryUpdateSchema.parse(req.body);
      const entry = await projectTimeEntryService.update(
        req.user!.businessId,
        req.params.id,
        parsed,
      );
      res.json(camelToSnake({ entry }));
    } catch (err) {
      next(err);
    }
  },
);

app.delete(
  "/api/time-entries/:id",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      await projectTimeEntryService.delete(req.user!.businessId, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/time-entries/:id/start",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const entry = await projectTimeEntryService.startTimer(
        req.user!.businessId,
        req.body.projectId,
        req.body,
        req.user!.id,
      );
      res.status(201).json({ entry });
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/api/time-entries/:id/stop",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const entry = await projectTimeEntryService.stopTimer(
        req.user!.businessId,
        req.params.id,
        req.user!.id,
      );
      res.json({ entry });
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/projects/:projectId/time-entries/summary",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const summary = await projectTimeEntryService.getSummary(
        req.user!.businessId,
        req.params.projectId,
        req.query.currency as string | undefined,
      );
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  },
);

// Project notes
app.post(
  "/api/projects/:projectId/notes",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const parsed = ProjectNoteCreateSchema.parse(req.body);
      const note = await projectTimeEntryService.addNote(
        req.user!.businessId,
        req.params.projectId,
        parsed,
        req.user!.id,
      );
      res.status(201).json({ note });
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/projects/:projectId/notes",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Number(req.query.offset ?? 0);
      const result = await projectTimeEntryService.getNotes(
        req.user!.businessId,
        req.params.projectId,
        limit,
        offset,
      );
      res.json({ notes: result.data, total: result.total, limit, offset });
    } catch (err) {
      next(err);
    }
  },
);

app.delete(
  "/api/projects/:projectId/notes/:noteId",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      await projectTimeEntryService.deleteNote(
        req.user!.businessId,
        req.params.projectId,
        req.params.noteId,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// BUSINESS SETTINGS (branding, defaults, payment config)
// ============================================================================
app.get(
  "/api/businesses/current/settings",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const result = await query(
      `SELECT business_id, default_currency, default_tax_rate, default_terms, default_notes,
     time_zone, locale, pdf_template_id, payment_provider, payment_provider_config,
     reminders_enabled, overdue_reminder_days, late_fee_type, late_fee_value,
     late_fee_period_days, default_bank_details, default_payment_portal_url,
     tax_exemption, delivery_details, warranty_info, return_policy,
     created_at, updated_at
     FROM business_settings WHERE business_id = $1`,
      [req.user!.businessId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Business settings not found" });
    }
    res.json({ settings: result.rows[0] });
  },
);

app.patch(
  "/api/businesses/current/settings",
  requireAuth,
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const allowedFields = [
      "default_currency",
      "default_tax_rate",
      "default_terms",
      "default_notes",
      "time_zone",
      "locale",
      "pdf_template_id",
      "payment_provider",
      "payment_provider_config",
      "reminders_enabled",
      "overdue_reminder_days",
      "late_fee_type",
      "late_fee_value",
      "late_fee_period_days",
      "default_bank_details",
      "default_payment_portal_url",
      "tax_exemption",
      "delivery_details",
      "warranty_info",
      "return_policy",
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
      payment_provider_config, reminders_enabled, overdue_reminder_days, late_fee_type, late_fee_value,
      late_fee_period_days, default_bank_details, default_payment_portal_url,
      tax_exemption, delivery_details, warranty_info, return_policy,
      created_at, updated_at`,
      values,
    );
    res.json({ settings: result.rows[0] });
  },
);

// ============================================================================
// BUSINESS REMINDER SETTINGS (JSONB)
// ============================================================================
app.get(
  "/api/businesses/current/settings/reminders",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const settings = await businessRepository.getReminderSettings(
      req.user!.businessId,
    );
    res.json({ settings });
  },
);

app.patch(
  "/api/businesses/current/settings/reminders",
  requireAuth,
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { enabled, beforeDue, afterDue } = req.body;
    await businessRepository.updateReminderSettings(req.user!.businessId, {
      enabled: enabled ?? undefined,
      beforeDue: beforeDue ?? undefined,
      afterDue: afterDue ?? undefined,
    });
    const settings = await businessRepository.getReminderSettings(
      req.user!.businessId,
    );
    res.json({ settings });
  },
);

// ============================================================================
// TEAM & RBAC (Business tier)
// ============================================================================
app.get(
  "/api/businesses/current/team",
  requireAuth,
  requireEntitlement("business.multiple"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const team = (
      await query(
        `SELECT bu.id, bu.business_id, bu.user_id, bu.role, bu.invited_email, bu.status, bu.invited_by, bu.invited_at, bu.accepted_at, bu.created_at, bu.updated_at,
            u.name, u.email
     FROM business_users bu LEFT JOIN users u ON u.id = bu.user_id
     WHERE bu.business_id = $1 ORDER BY bu.created_at DESC`,
        [req.user!.businessId],
      )
    ).rows.map((r: any) => ({
      id: r.id,
      business_id: r.business_id,
      user_id: r.user_id,
      email: r.email ?? r.invited_email,
      name: r.name ?? null,
      role: r.role,
      status: r.status,
      invited_by: r.invited_by,
      invited_at: r.invited_at,
      accepted_at: r.accepted_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    res.json({ team });
  },
);

app.post(
  "/api/businesses/current/team",
  requireAuth,
  requireEntitlement("business.multiple"),
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { email, role, message } = req.body;
    if (!email || !role)
      return res.status(400).json({ error: "email and role are required" });
    const allowedRoles = ["owner", "admin", "member", "viewer"];
    if (!allowedRoles.includes(role))
      return res.status(400).json({ error: "Invalid role" });

    const existing = await query(
      `SELECT id FROM business_users WHERE business_id = $1 AND (invited_email = $2 OR user_id IN (SELECT id FROM users WHERE email = $2)) LIMIT 1`,
      [req.user!.businessId, email],
    );
    if (existing.rows.length) {
      return res
        .status(409)
        .json({ error: "User already invited to this business" });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invRes = await query(
      `INSERT INTO business_users (business_id, user_id, invited_email, role, status, invited_by, invited_at)
     VALUES ($1, NULL, $2, $3, 'invited', $4, NOW())
     RETURNING id`,
      [req.user!.businessId, email, role, req.user!.id],
    );
    await query(
      `INSERT INTO business_invitations (business_id, email, role, status, token, invited_by, expires_at)
     VALUES ($1, $2, $3, 'pending', $4, $5, $6)`,
      [req.user!.businessId, email, role, token, req.user!.id, expiresAt],
    );
    void message;
    res.status(201).json({ memberId: invRes.rows[0].id, inviteToken: token });
  },
);

app.patch(
  "/api/businesses/current/team/:memberId",
  requireAuth,
  requireEntitlement("business.multiple"),
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const { role } = req.body;
    if (role && !["owner", "admin", "member", "viewer"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (role) {
      sets.push(`role = $${i++}`);
      vals.push(role);
    }
    if (!sets.length)
      return res.status(400).json({ error: "No valid fields to update" });
    vals.push(req.params.memberId, req.user!.businessId);
    const result = await query(
      `UPDATE business_users SET ${sets.join(", ")}, updated_at = NOW()
     WHERE id = $${i++} AND business_id = $${i++} RETURNING id`,
      vals,
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Team member not found" });
    res.json({ ok: true });
  },
);

app.post(
  "/api/businesses/current/team/:memberId/resend",
  requireAuth,
  requireEntitlement("business.multiple"),
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const member = await query(
      `SELECT invited_email, role FROM business_users WHERE id = $1 AND business_id = $2`,
      [req.params.memberId, req.user!.businessId],
    );
    if (!member.rows.length)
      return res.status(404).json({ error: "Team member not found" });
    res.json({
      ok: true,
      message: `Invite resent to ${member.rows[0].invited_email}`,
    });
  },
);

app.delete(
  "/api/businesses/current/team/:memberId",
  requireAuth,
  requireEntitlement("business.multiple"),
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    const result = await query(
      `DELETE FROM business_users WHERE id = $1 AND business_id = $2 RETURNING id`,
      [req.params.memberId, req.user!.businessId],
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Team member not found" });
    res.json({ removed: true });
  },
);

// Global payments list (all payments for the business, paginated)
app.get("/api/payments", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const status = req.query.status as string | undefined;
  const provider = req.query.provider as string | undefined;
  const search = (req.query.search as string | undefined) || undefined;

  const where: string[] = ["p.business_id = $1"];
  const vals: any[] = [req.user!.businessId];
  let i = 2;
  if (status) {
    where.push(`p.status = $${i++}`);
    vals.push(status);
  }
  if (provider) {
    where.push(`p.provider = $${i++}`);
    vals.push(provider);
  }
  if (search) {
    where.push(`(p.provider_payment_id ILIKE $${i})`);
    vals.push(`%${search}%`);
    i++;
  }

  const listRes = await query(
    `SELECT p.id, p.amount, p.currency, p.status, p.method, p.provider,
            p.provider_payment_id, p.paid_at, p.idempotency_key, p.created_at, p.updated_at
      FROM payments p
      WHERE ${where.join(" AND ")}
      ORDER BY p.created_at DESC
      LIMIT $${i++} OFFSET $${i++}`,
    [...vals, limit, offset],
  );

  const countRes = await query(
    `SELECT COUNT(*)::int AS total
      FROM payments p
      WHERE ${where.join(" AND ")}`,
    vals,
  );

  res.json({
    payments: listRes.rows,
    total: countRes.rows[0]?.total ?? 0,
    limit,
    offset,
  });
});

// Payment summary metrics for dashboard KPIs
app.get("/api/payments/summary", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const businessId = req.user!.businessId;

  const monthStart = new Date();
  monthStart.setHours(0, 0, 0, 0);
  monthStart.setDate(1);

  const metricsRes = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END), 0) AS total_payments,
       COALESCE(SUM(CASE WHEN p.status = 'succeeded' AND p.paid_at >= $2 THEN p.amount ELSE 0 END), 0) AS payments_this_month,
       COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) AS pending_payments,
       COALESCE(SUM(CASE WHEN p.status = 'failed' THEN p.amount ELSE 0 END), 0) AS failed_payments,
       COALESCE(SUM(CASE WHEN p.status = 'refunded' OR p.status = 'partially_refunded' THEN p.amount ELSE 0 END), 0) AS refunds,
       COUNT(CASE WHEN p.status = 'succeeded' THEN 1 END) AS total_payment_count,
       COUNT(CASE WHEN p.status = 'pending' THEN 1 END) AS pending_count,
       COUNT(CASE WHEN p.status = 'failed' THEN 1 END) AS failed_count,
       COUNT(CASE WHEN p.status = 'refunded' OR p.status = 'partially_refunded' THEN 1 END) AS refund_count,
       COALESCE(MAX(p.currency), 'USD') AS currency
     FROM payments p
     WHERE p.business_id = $1`,
    [businessId, monthStart.toISOString()],
  );

  const row = metricsRes.rows[0];
  res.json({
    totalPayments: String(row.total_payments ?? "0"),
    paymentsThisMonth: String(row.payments_this_month ?? "0"),
    pendingPayments: String(row.pending_payments ?? "0"),
    failedPayments: String(row.failed_payments ?? "0"),
    refunds: String(row.refunds ?? "0"),
    totalPaymentCount: Number(row.total_payment_count ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    refundCount: Number(row.refund_count ?? 0),
    currency: row.currency ?? "USD",
  });
});

// Single payment detail with payment events timeline
app.get("/api/payments/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });

  const paymentRes = await query(
    `SELECT p.*, b.name as business_name, b.email as business_email, b.phone as business_phone
     FROM payments p
     JOIN businesses b ON b.id = p.business_id
     WHERE p.id = $1 AND p.business_id = $2`,
    [req.params.id, req.user!.businessId],
  );

  if (!paymentRes.rows.length)
    return res.status(404).json({ error: "Payment not found" });
  const payment = paymentRes.rows[0];

  const eventsRes = await query(
    `SELECT event_type, status, amount, metadata, created_at
     FROM payment_events
     WHERE payment_id = $1
     ORDER BY created_at ASC`,
    [req.params.id],
  );

  res.json({ payment, events: eventsRes.rows });
});

app.get("/api/tax-rates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const result = await query(
    "SELECT * FROM business_tax_rates WHERE business_id = $1 ORDER BY name",
    [req.user!.businessId],
  );
  res.json({ taxRates: result.rows });
});

app.post("/api/tax-rates", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const { name, code, rate, type, country_code, region, is_compound, enabled } =
    req.body;
  if (!name || !rate)
    return res.status(400).json({ error: "name and rate are required" });
  const result = await query(
    `INSERT INTO business_tax_rates (business_id, name, code, rate, type, country_code, region, is_compound, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      req.user!.businessId,
      name,
      code,
      rate,
      type ?? "percentage",
      country_code,
      region,
      is_compound ?? false,
      enabled ?? true,
    ],
  );
  res.status(201).json({ taxRate: result.rows[0] });
});

app.patch("/api/tax-rates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const allowedFields = [
    "name",
    "code",
    "rate",
    "type",
    "country_code",
    "region",
    "is_compound",
    "enabled",
  ];
  const updates: string[] = [];
  const values: unknown[] = [req.user!.businessId, req.params.id];
  let i = 3;
  for (const [key, val] of Object.entries(req.body)) {
    if (!allowedFields.includes(key)) continue;
    updates.push(`${key} = $${i++}`);
    values.push(val);
  }
  if (updates.length === 0)
    return res.status(400).json({ error: "No valid fields to update" });
  const result = await query(
    `UPDATE business_tax_rates SET ${updates.join(", ")} WHERE business_id = $1 AND id = $2 RETURNING *`,
    values,
  );
  if (!result.rows.length)
    return res.status(404).json({ error: "Tax rate not found" });
  res.json({ taxRate: result.rows[0] });
});

app.delete("/api/tax-rates/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  const result = await query(
    "DELETE FROM business_tax_rates WHERE business_id = $1 AND id = $2 RETURNING id",
    [req.user!.businessId, req.params.id],
  );
  if (!result.rows.length)
    return res.status(404).json({ error: "Tax rate not found" });
  res.json({ deleted: true });
});

// ============================================================================
// STRIPE WEBHOOK HANDLER
// ============================================================================
async function handleStripeEvent(event: any): Promise<void> {
  const eventId = event.id;
  const idempotencyKey = `stripe_webhook:${eventId}`;

  const existing = await query(
    `SELECT id FROM payment_events WHERE idempotency_key = $1 LIMIT 1`,
    [idempotencyKey],
  );
  if (existing.rows.length) {
    logger.info({ eventId, eventType: event.type }, "Stripe webhook event already processed — skipping");
    return;
  }

  await query(
    `INSERT INTO payment_events (business_id, payment_id, amount, currency, status, method, reference, idempotency_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      event.data.object?.metadata?.businessId ?? null,
      null,
      0,
      "USD",
      "processed",
      "stripe",
      eventId,
      idempotencyKey,
    ],
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const businessId = session.metadata?.businessId;
      const invoiceId = session.metadata?.invoiceId;
      const planId = session.metadata?.planId;

      if (invoiceId) {
        try {
          await invoiceService.recordPaymentFromStripeSession(session.id);
          logger.info({ sessionId: session.id, invoiceId }, "Recorded payment from Stripe checkout session");
        } catch (err) {
          logger.error({ err, sessionId: session.id, invoiceId }, "Failed to record payment from Stripe checkout session");
        }
        break;
      }

      if (!businessId || !planId) {
        logger.warn("Missing metadata in checkout.session.completed");
        return;
      }

      const planCode = session.metadata?.planCode;
      const billingCycle = session.metadata?.billingCycle;

      const sub =
        await subscriptionRepository.findSubscriptionByBusinessId(businessId);
      if (sub) {
        const stripeSubscriptionId = session.subscription;
        await subscriptionRepository.updateSubscriptionByBusinessId(
          businessId,
          {
            planId,
            status: "active",
            billingCycle: billingCycle ?? "monthly",
            stripeSubscriptionId: stripeSubscriptionId ?? null,
          },
        );
        await subscriptionRepository.recordSubscriptionEvent(
          businessId,
          sub.id,
          "checkout_completed",
          undefined,
          planCode,
          { stripeSessionId: session.id },
        );
      }
      break;
    }
    case "customer.subscription.updated": {
      const stripeSub = event.data.object;
      const businessId = await findBusinessByStripeSubscriptionId(stripeSub.id);
      if (!businessId) {
        logger.warn(
          { subscription: stripeSub.id },
          "Business not found for Stripe subscription",
        );
        return;
      }

      const sub =
        await subscriptionRepository.findSubscriptionByBusinessId(businessId);
      if (!sub) return;

      const status =
        stripeSub.status === "active"
          ? "active"
          : stripeSub.status === "past_due"
            ? "past_due"
            : stripeSub.status === "canceled"
              ? "cancelled"
              : "active";

      await subscriptionRepository.updateSubscriptionByBusinessId(businessId, {
        status: status as any,
      });
      await subscriptionRepository.recordSubscriptionEvent(
        businessId,
        sub.id,
        "subscription_updated",
        undefined,
        undefined,
        { stripeStatus: stripeSub.status },
      );
      break;
    }
    case "customer.subscription.deleted": {
      const stripeSub = event.data.object;
      const businessId = await findBusinessByStripeSubscriptionId(stripeSub.id);
      if (!businessId) return;

      const sub =
        await subscriptionRepository.findSubscriptionByBusinessId(businessId);
      if (!sub) return;

      await subscriptionRepository.updateSubscriptionByBusinessId(businessId, {
        status: "cancelled",
      });
      await subscriptionRepository.recordSubscriptionEvent(
        businessId,
        sub.id,
        "subscription_cancelled",
        undefined,
        "free",
        { stripeSubscriptionId: stripeSub.id },
      );

      const freePlan = await subscriptionRepository.findPlanByCode("free");
      if (freePlan) {
        await subscriptionRepository.updateSubscriptionByBusinessId(
          businessId,
          { planId: freePlan.id },
        );
      }
      break;
    }
    default:
      if (
        event.type.startsWith("payment_intent.") ||
        event.type.startsWith("charge.")
      ) {
        logger.info(
          `Payment event received but invoice reconciliation was removed: ${event.type}`,
        );
        return;
      }
      logger.info(`Unhandled Stripe event type: ${event.type}`);
  }
}

async function findBusinessByStripeSubscriptionId(
  stripeSubscriptionId: string,
): Promise<string | null> {
  const res = await query(
    `SELECT business_id FROM business_subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
    [stripeSubscriptionId],
  );
  if (!res.rows.length) return null;
  return res.rows[0].business_id as string;
}

// ============================================================================
// TAX RULES
// ============================================================================

app.post("/api/tax-rules", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const parsed = TaxRuleCreateSchema.parse(req.body);
    const rule = await taxRuleService.create(req.user!.businessId, parsed);
    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
});

app.get("/api/tax-rules", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const params = TaxRuleSearchParamsSchema.parse({
      limit: req.query.limit,
      offset: req.query.offset,
      enabled: req.query.enabled,
    });
    const rules = await taxRuleService.findMany(req.user!.businessId, params);
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

app.get("/api/tax-rules/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const rule = await taxRuleService.findById(req.user!.businessId, req.params.id);
    if (!rule) return res.status(404).json({ error: "Tax rule not found" });
    res.json({ rule });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/tax-rules/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const parsed = TaxRuleUpdateSchema.parse(req.body);
    const rule = await taxRuleService.update(req.user!.businessId, req.params.id, parsed);
    res.json({ rule });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/tax-rules/:id", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    await taxRuleService.delete(req.user!.businessId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

app.post(
  "/api/tax-rules/:id/evaluate",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const rule = await taxRuleService.findById(req.user!.businessId, req.params.id);
      if (!rule) return res.status(404).json({ error: "Tax rule not found" });
      const evaluated = taxRuleService.evaluateRule(rule, req.body);
      res.json({ matched: evaluated });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// DISCOUNT RULES
// ============================================================================

app.post("/api/discount-rules", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const parsed = DiscountRuleCreateSchema.parse(req.body);
    const rule = await discountRuleService.create(req.user!.businessId, parsed);
    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
});

app.get("/api/discount-rules", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const params = DiscountRuleSearchParamsSchema.parse({
      limit: req.query.limit,
      offset: req.query.offset,
      active: req.query.active,
    });
    const rules = await discountRuleService.findMany(req.user!.businessId, params);
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

app.get(
  "/api/discount-rules/:id",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const rule = await discountRuleService.findById(req.user!.businessId, req.params.id);
      if (!rule) return res.status(404).json({ error: "Discount rule not found" });
      res.json({ rule });
    } catch (err) {
      next(err);
    }
  },
);

app.patch(
  "/api/discount-rules/:id",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const parsed = DiscountRuleUpdateSchema.parse(req.body);
      const rule = await discountRuleService.update(req.user!.businessId, req.params.id, parsed);
      res.json({ rule });
    } catch (err) {
      next(err);
    }
  },
);

app.delete(
  "/api/discount-rules/:id",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      await discountRuleService.delete(req.user!.businessId, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// BRANDING
// ============================================================================

app.get("/api/branding", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const branding = await brandingService.get(req.user!.businessId);
    res.json({ branding });
  } catch (err) {
    next(err);
  }
});

app.post("/api/branding", requireAuth, async (req: AuthRequest, res, next) => {
  if (!req.user?.businessId)
    return res.status(400).json({ error: "No business context" });
  try {
    const parsed = BrandingInputSchema.parse(req.body);
    const branding = await brandingService.update(req.user!.businessId, parsed);
    res.json({ branding });
  } catch (err) {
    next(err);
  }
});

app.post(
  "/api/branding/preview",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    if (!req.user?.businessId)
      return res.status(400).json({ error: "No business context" });
    try {
      const parsed = BrandingInputSchema.parse(req.body);
      const html = await brandingService.generatePreviewHtml(req.user!.businessId, parsed);
      res.json({ html });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// FRONTEND FALLBACK (production SPA)
// ============================================================================
const FRONTEND_DIST = path.join(process.cwd(), "webapp", "dist");

function setAssetHeaders(res: express.Response, filePath: string) {
  const relativePath = path.relative(FRONTEND_DIST, filePath);
  const isAsset =
    relativePath.startsWith(`assets${path.sep}`) ||
    relativePath.startsWith("assets/");
  if (isAsset) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
}

function setNoCacheHeaders(res: express.Response) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

if (!isDev) {
  const assetsDir = path.join(FRONTEND_DIST, "assets");

  app.use(
    "/assets",
    express.static(assetsDir, {
      maxAge: "1y",
      immutable: true,
      setHeaders: setAssetHeaders,
    }),
  );

  app.use(
    express.static(FRONTEND_DIST, {
      maxAge: 0,
      setHeaders(res, filePath) {
        const parsed = path.parse(filePath);
        if (parsed.ext === ".html" || parsed.name === "manifest") {
          setNoCacheHeaders(res);
        }
      },
    }),
  );

  app.get("*", (_req, res) => {
    setNoCacheHeaders(res);
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================
app.use(
  (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    const err = new Error("Resource not found") as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    next(err);
  },
);

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const ctx = getRequestContext();
    const requestId = ctx?.requestId ?? (req.headers["x-request-id"] as string) ?? "unknown";
    if (!res.headersSent) {
      res.setHeader("X-Request-ID", requestId);
    }
    if (err instanceof Error && "statusCode" in err) {
      const e = err as {
        statusCode: number;
        code?: string;
        message: string;
        context?: Record<string, unknown>;
      };
      if (e.statusCode >= 400 && e.statusCode < 500) {
        logger.info(
          { err, requestId, url: req.url, method: req.method },
          "Client error",
        );
      } else {
        logger.error(
          { err, requestId, url: req.url, method: req.method },
          "Server error",
        );
      }
      return res
        .status(e.statusCode)
        .json({
          error: e.message,
          code: e.code,
          requestId,
          ...(e.context ? { context: e.context } : {}),
        });
    }
    if (err.name === "ZodError") {
      logger.info(
        { err, requestId, url: req.url, method: req.method },
        "Validation error",
      );
      return res
        .status(400)
        .json({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          requestId,
          issues: (err as any).issues,
        });
    }
    logger.error(
      { err, requestId, url: req.url, method: req.method },
      "Unhandled error",
    );
    res
      .status(500)
      .json({ error: "Internal server error", code: "INTERNAL_ERROR", requestId });
  },
);

process.on("unhandledRejection", (reason) => {
  logger.error(
    { err: reason },
    "Unhandled promise rejection — server will continue running",
  );
  if (env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — server will continue running");
  if (env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
});

const PORT = env.PORT;

async function start() {
  if (!isDev && !existsSync(FRONTEND_DIST)) {
    logger.error(
      `Frontend dist not found at ${FRONTEND_DIST}. Ensure the frontend is built before starting the server.`,
    );
    process.exit(1);
  }
  await runMigrations();
  server = app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT} (env=${env.APP_ENV})`);
    subscriptionService
      .ensureDefaults()
      .catch((e) => logger.error({ err: e }, "Failed to seed defaults"));
  });

  if (env.REDIS_URL) {
    const { startPdfWorker } = await import("./services/pdf-job-service.js");
    startPdfWorker().catch((e) =>
      logger.error({ err: e }, "Failed to start PDF worker"),
    );
  }
}

// ============================================================================
// SERVER STARTUP
// ============================================================================
let server: ReturnType<typeof app.listen> | null = null;

if (!isTest) {
  start().catch((err) => {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  });
}

// Graceful shutdown — close server, DB pool, and PDF service on SIGTERM/SIGINT
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal} — shutting down gracefully...`);

  if (server) {
    server.close((err) => {
      if (err) {
        logger.error({ err }, "Error closing server");
        process.exit(1);
      }
      logger.info("HTTP server closed.");
    });
  }

  try {
    const { closePool } = await import("./db/pool.js");
    await closePool();
    logger.info("Database pool closed.");
  } catch (err) {
    logger.error({ err }, "Error closing database pool");
  }

  try {
    const { pdfService } = await import("./services/pdf/pdf-service.js");
    await pdfService.close();
    logger.info("PDF service closed.");
  } catch (err) {
    logger.error({ err }, "Error closing PDF service");
  }

  setTimeout(() => {
    logger.error("Could not close connections gracefully — forcing exit.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
