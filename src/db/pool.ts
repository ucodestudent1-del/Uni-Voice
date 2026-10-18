import pkg from "pg";
import { env, isTest } from "../config/index.js";
import { AsyncLocalStorage } from "async_hooks";
import { logger } from "../utils/logger.js";

const { Pool } = pkg;

const connectionString = isTest && env.DATABASE_URL_TEST ? env.DATABASE_URL_TEST : env.DATABASE_URL;

const sslConfig =
  env.APP_ENV === "production"
    ? { rejectUnauthorized: false } as const
    : undefined;

export const pool = new Pool({
  connectionString,
  ssl: sslConfig,
  max: isTest ? 5 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: isTest ? 5000 : 15000,
  statement_timeout: isTest ? 30000 : 30000,
  query_timeout: isTest ? 30000 : 30000,
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle pg client (pool will attempt reconnect)");
});

interface RequestContext {
  requestId: string;
  queryCount: number;
  slowQueries: { text: string; ms: number }[];
  subscriptionContextCache?: Map<string, unknown>;
}

const requestStore = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestStore.getStore();
}

export function getRequestId(): string | undefined {
  return requestStore.getStore()?.requestId;
}

export async function runWithRequestContext<T>(fn: (() => Promise<T>) | (() => T), requestId?: string): Promise<T | undefined> {
  const ctx: RequestContext = { requestId: requestId ?? `req-${Date.now()}`, queryCount: 0, slowQueries: [] };
  try {
    return await requestStore.run(ctx, async () => {
      return await Promise.resolve(fn());
    });
  } catch (e) {
    logger.error({ err: e }, "Error in request context");
    throw e;
  }
}

const SLOW_QUERY_THRESHOLD = 500;

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const res = await pool.query(text, params as never);
  const ms = Date.now() - start;
  const ctx = requestStore.getStore();
  if (ctx) {
    ctx.queryCount++;
    if (ms > SLOW_QUERY_THRESHOLD) {
      ctx.slowQueries.push({ text: text.slice(0, 100), ms });
    }
  }
  if (ms > 1000) {
    console.warn(`Slow query (${ms}ms): ${text.slice(0, 100)}`);
  }
  return res;
}

export async function getClient() {
  return await pool.connect();
}

export async function closePool(): Promise<void> {
  await pool.end();
}
