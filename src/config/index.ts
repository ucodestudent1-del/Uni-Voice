import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

if (process.env.APP_ENV !== "test") {
  dotenvConfig();
}

const cleanEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])
);

const rawAppEnv = process.env.APP_ENV;
const inferredAppEnv = (rawAppEnv === undefined
  ? process.env.NODE_ENV === "production"
    ? "production"
    : "development"
  : rawAppEnv) as "development" | "test" | "production";
const isProduction = inferredAppEnv === "production";
const developmentPublicBaseUrl = "http://localhost:5173";

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isLocalhostUrl(value: string): boolean {
  const url = parseHttpUrl(value);
  if (!url) return false;

  const hostname = url.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

const baseUrlSchema = z
  .string()
  .refine((value) => parseHttpUrl(value) !== null, "Must be a valid http or https URL")
  .refine(
    (value) => !isProduction || parseHttpUrl(value)?.protocol === "https:",
    "Must use https in production"
  )
  .refine(
    (value) => !isProduction || !isLocalhostUrl(value),
    "Localhost URLs are not allowed in production"
  )
  .transform((value) => value.replace(/\/+$/, ""));

const optionalUrlSchema = z
  .string()
  .refine((value) => parseHttpUrl(value) !== null, "Must be a valid http or https URL")
  .transform((value) => value.replace(/\/+$/, ""));

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default(inferredAppEnv),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: z.string().optional(),
  AUTH_MODE: z.enum(["dev", "jwt", "stub"]).default(isProduction ? "jwt" : "dev"),
  AUTH_JWT_SECRET: z.string()
    .refine((value) => !isProduction || value !== "dev-secret-change-me",
      "AUTH_JWT_SECRET must not be the default dev secret in production")
    .refine((value) => !isProduction || value.length >= 32,
      "AUTH_JWT_SECRET must be at least 32 characters in production")
    .default("dev-secret-change-me"),
  APP_PUBLIC_BASE_URL: baseUrlSchema.optional(),
  APP_FRONTEND_URL: baseUrlSchema.optional(),
  EMAIL_FROM: z.string().default("noreply@example.com"),
  EMAIL_PROVIDER: z.enum(["stub", "smtp", "sendgrid", "ses"]).default("stub"),
  SMS_PROVIDER: z.enum(["stub", "twilio"]).default("stub"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  PDF_PROVIDER: z.enum(["html", "stub"]).default("html"),
  PAYMENT_PROVIDER: z.enum(["stub", "stripe", "paypal"]).default("stub"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_SECRET: z.string().optional(),
  PAYPAL_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
  TAX_PROVIDER: z.enum(["manual", "avalara", "taxjar"]).default("manual"),
  AI_PROVIDER: z.enum(["stub", "openai", "anthropic"]).default("stub"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  AWS_SES_ACCESS_KEY_ID: z.string().optional(),
  AWS_SES_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SES_REGION: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: optionalUrlSchema.optional(),
  REDIS_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  FX_API_KEY: z.string().optional(),
  FX_API_PROVIDER: z.enum(["openexchangerates", "exchangerateapi"]).default("openexchangerates"),
  FX_BASE_CURRENCY: z.string().default("USD"),
  APP_DEFAULT_CURRENCY: z.string().default("USD"),
  AVALARA_ACCOUNT_ID: z.string().optional(),
  AVALARA_API_KEY: z.string().optional(),
  AVALARA_ENVIRONMENT: z.enum(["development", "production"]).default("development"),
  PROPRIETARY_MODE: z.enum(["true", "false"]).default("false"),
});

type Env = Omit<z.infer<typeof envSchema>, "APP_PUBLIC_BASE_URL"> & {
  APP_PUBLIC_BASE_URL: string;
};

let parsed: z.infer<typeof envSchema>;
try {
  parsed = envSchema.parse(cleanEnv);
} catch (e) {
  console.error("Invalid environment configuration:", e);
  process.exit(1);
}

if (isProduction && parsed.AUTH_MODE === "dev") {
  throw new Error(
    "AUTH_MODE=dev is not allowed in production. Set AUTH_MODE=jwt for real authentication.",
  );
}

if (isProduction && parsed.AUTH_MODE === "stub") {
  throw new Error(
    "AUTH_MODE=stub is not allowed in production. Set AUTH_MODE=jwt for real authentication.",
  );
}

if (isProduction && (!parsed.AUTH_JWT_SECRET || parsed.AUTH_JWT_SECRET === "dev-secret-change-me")) {
  throw new Error(
    "AUTH_JWT_SECRET is not set to a secure value in production. " +
      "Set AUTH_JWT_SECRET to a secure random value (min 32 characters).",
  );
}

if (isProduction && !parsed.REDIS_URL) {
  console.warn(
    "REDIS_URL is not set in production. " +
      "Redis is used for rate limiting, session revocation, PDF job queue, and report caching. " +
      "Some features may not work correctly.",
  );
}

if (isProduction && parsed.EMAIL_PROVIDER === "stub") {
  throw new Error(
    "EMAIL_PROVIDER=stub is not allowed in production. " +
      "Set EMAIL_PROVIDER to smtp, sendgrid, or ses so emails are actually delivered.",
  );
}

if (isProduction && parsed.PAYMENT_PROVIDER === "stripe" && !parsed.STRIPE_SECRET_KEY) {
  console.warn(
    "STRIPE_SECRET_KEY is not set. Payment processing endpoints will return errors when called. " +
      "Set STRIPE_SECRET_KEY in your environment to enable Stripe payments.",
  );
}

if (isProduction && parsed.PAYMENT_PROVIDER === "stub") {
  throw new Error(
    "PAYMENT_PROVIDER=stub is not allowed in production. " +
      "Payment endpoints will return placeholder responses. Set PAYMENT_PROVIDER=stripe or PAYMENT_PROVIDER=paypal.",
  );
}

if (isProduction && parsed.PAYMENT_PROVIDER === "paypal" && !parsed.PAYPAL_CLIENT_ID) {
  throw new Error(
    "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set. Payment processing endpoints will return errors when called.",
  );
}

function getRailwayPublicBaseUrl(domain: string | undefined): string | undefined {
  if (!domain) return undefined;

  const candidate = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  return parseHttpUrl(candidate)?.origin;
}

const railwayPublicBaseUrl = getRailwayPublicBaseUrl(process.env.RAILWAY_PUBLIC_DOMAIN);

const resolvedPublicBaseUrl = (
  parsed.APP_PUBLIC_BASE_URL ??
  (isProduction ? railwayPublicBaseUrl : developmentPublicBaseUrl)
)?.replace(/\/+$/, "");

if (
  !resolvedPublicBaseUrl ||
  parseHttpUrl(resolvedPublicBaseUrl) === null ||
  (isProduction && isLocalhostUrl(resolvedPublicBaseUrl))
) {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.warn(
      "Invalid environment configuration: APP_PUBLIC_BASE_URL is not a valid non-local http(s) URL in production. " +
        "Set APP_PUBLIC_BASE_URL to a valid HTTPS domain. Falling back to RAILWAY_PUBLIC_DOMAIN or default.",
    );
  }

  console.warn(
    "APP_PUBLIC_BASE_URL not configured; using fallback. OAuth callbacks and public links may be incorrect. Set APP_PUBLIC_BASE_URL for correct operation."
  );
}

const finalPublicBaseUrl =
  resolvedPublicBaseUrl ||
  (isProduction ? railwayPublicBaseUrl ?? "https://uni-voice-production.up.railway.app" : developmentPublicBaseUrl);

export const env: Env = {
  ...parsed,
  APP_PUBLIC_BASE_URL: finalPublicBaseUrl,
};

export const isTest = env.APP_ENV === "test";
export const isDev = env.APP_ENV === "development";
export const isProprietaryMode = env.PROPRIETARY_MODE === "true";
