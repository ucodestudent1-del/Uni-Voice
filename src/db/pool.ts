import pkg from "pg";
import { env, isTest } from "../config/index.js";
import { AsyncLocalStorage } from "async_hooks";

const { Pool } = pkg;

const connectionString = isTest && env.DATABASE_URL_TEST ? env.DATABASE_URL_TEST : env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  max: isTest ? 1 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle pg client", err);
  if (!isTest) {
    process.exit(-1);
  }
});

interface RequestContext {
  queryCount: number;
  slowQueries: { text: string; ms: number }[];
}

const requestStore = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestStore.getStore();
}

export function runWithRequestContext<T>(fn: (() => Promise<T>) | (() => T)): Promise<T | undefined> {
  const ctx: RequestContext = { queryCount: 0, slowQueries: [] };
  return requestStore.run(ctx, () => Promise.resolve().then(fn));
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
