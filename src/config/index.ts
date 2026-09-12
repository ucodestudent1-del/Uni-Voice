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
const developmentPublicBaseUrl = "http://localhost:4000";

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function getRailwayPublicBaseUrl(domain: string | undefined): string | undefined {
  if (!domain) return undefined;

  const candidate = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  return parseHttpUrl(candidate)?.origin;
}

const railwayPublicBaseUrl = getRailwayPublicBaseUrl(process.env.RAILWAY_PUBLIC_DOMAIN);

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

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default(inferredAppEnv),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: z.string().optional(),
  AUTH_MODE: z.enum(["dev", "jwt", "stub"]).default("dev"),
  AUTH_JWT_SECRET: z.string().default("dev-secret-change-me"),
  APP_PUBLIC_BASE_URL: baseUrlSchema.optional(),
  APP_FRONTEND_URL: baseUrlSchema.optional(),
  EMAIL_FROM: z.string().default("noreply@example.com"),
  EMAIL_PROVIDER: z.enum(["stub", "smtp", "sendgrid", "ses"]).default("stub"),
  PDF_PROVIDER: z.enum(["html", "stub"]).default("html"),
  PAYMENT_PROVIDER: z.enum(["stub", "stripe", "paypal"]).default("stub"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TAX_PROVIDER: z.enum(["manual", "avalara", "taxjar"]).default("manual"),
  AI_PROVIDER: z.enum(["stub", "openai", "anthropic"]).default("stub"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: baseUrlSchema.optional(),
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
