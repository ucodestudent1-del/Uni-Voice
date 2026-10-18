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
  AUTH_JWT_SECRET: z.string().default("dev-secret-change-me"),
  APP_PUBLIC_BASE_URL: baseUrlSchema.optional(),
  APP_FRONTEND_URL: baseUrlSchema.optional(),
  EMAIL_FROM: z.string().default("noreply@example.com"),
  EMAIL_PROVIDER: z.enum(["stub", "smtp", "sendgrid", "ses"]).default("stub"),
  SMS_PROVIDER: z.enum(["stub", "twilio"]).default("stub"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  PDF_PROVIDER: z.enum(["html", "stub"]).default("html"),
  PAYMENT_PROVIDER: z.enum(["stub", "stripe"]).default("stub"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
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
  console.error("Invalid environment configuration: AUTH_MODE=dev is not allowed in production. Use AUTH_MODE=jwt.");
  process.exit(1);
}

if (isProduction && parsed.AUTH_MODE === "stub") {
  console.error(
    "Invalid environment configuration: AUTH_MODE=stub is not allowed in production. " +
      "Use AUTH_MODE=jwt for real authentication."
  );
  process.exit(1);
}

if (isProduction && (!parsed.AUTH_JWT_SECRET || parsed.AUTH_JWT_SECRET === "dev-secret-change-me")) {
  console.error("Invalid environment configuration: AUTH_JWT_SECRET must be set to a secure value in production (cannot use the default dev secret).");
  process.exit(1);
}

if (isProduction && !parsed.REDIS_URL) {
  console.error(
    "Invalid environment configuration: REDIS_URL is required in production. " +
      "Redis is used for rate limiting, session revocation, PDF job queue, and report caching."
  );
  process.exit(1);
}

if (isProduction && parsed.EMAIL_PROVIDER === "stub") {
  console.error(
    "Invalid environment configuration: EMAIL_PROVIDER=stub is not allowed in production. " +
      "Set EMAIL_PROVIDER to smtp, sendgrid, or ses so emails are actually delivered."
  );
  process.exit(1);
}

if (isProduction && parsed.PAYMENT_PROVIDER === "stripe" && !parsed.STRIPE_SECRET_KEY) {
  console.warn(
    "STRIPE_SECRET_KEY is not set. Payment processing endpoints will return errors when called. " +
      "Set STRIPE_SECRET_KEY in your environment to enable Stripe payments.",
  );
}

if (isProduction && parsed.PAYMENT_PROVIDER === "stub") {
  console.warn(
    "PAYMENT_PROVIDER=stub is not recommended in production. " +
      "Payment endpoints will return placeholder responses. Set PAYMENT_PROVIDER=stripe and provide STRIPE_SECRET_KEY for real payments.",
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
    console.error(
      "Invalid environment configuration: APP_PUBLIC_BASE_URL must be a non-local http(s) URL in production. Set APP_PUBLIC_BASE_URL or RAILWAY_PUBLIC_DOMAIN."
    );
    process.exit(1);
  }

  console.warn(
    "APP_PUBLIC_BASE_URL not configured; using fallback. OAuth callbacks and public links may be incorrect."
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
