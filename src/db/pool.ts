import pkg from "pg";
import { env, isTest } from "../config/index.js";

const { Pool } = pkg;

const connectionString = isTest && env.DATABASE_URL_TEST ? env.DATABASE_URL_TEST : env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle pg client", err);
  process.exit(-1);
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const res = await pool.query(text, params as never);
  const ms = Date.now() - start;
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
