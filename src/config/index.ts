import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig();

const cleanEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])
);

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: z.string().optional(),
  AUTH_MODE: z.enum(["dev", "jwt", "stub"]).default("dev"),
  AUTH_JWT_SECRET: z.string().default("dev-secret-change-me"),
  APP_PUBLIC_BASE_URL: z.string().default("http://localhost:4000"),
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
});

type Env = z.infer<typeof envSchema>;

let parsed: Env;
try {
  parsed = envSchema.parse(cleanEnv);
} catch (e) {
  console.error("Invalid environment configuration:", e);
  process.exit(1);
}

export const env = parsed;

export const isTest = env.APP_ENV === "test";
export const isDev = env.APP_ENV === "development";
