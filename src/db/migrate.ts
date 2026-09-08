import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, getClient } from "./pool.js";
import { logger } from "../utils/logger.js";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

interface Migration {
  name: string;
  sql: string;
}

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getRunMigrations(): Promise<Set<string>> {
  const res = await query("SELECT name FROM migrations");
  return new Set(res.rows.map((r) => r.name));
}

export async function loadMigrations(): Promise<Migration[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const migrations: Migration[] = [];
  for (const file of files) {
    const name = file;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    migrations.push({ name, sql });
  }
  return migrations;
}

export async function runMigrations() {
  await ensureMigrationsTable();
  const migrations = await loadMigrations();
  const run = await getRunMigrations();

  for (const m of migrations) {
    if (run.has(m.name)) {
      logger.info(`Migration already applied: ${m.name}`);
      continue;
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query(m.sql);
      await client.query("INSERT INTO migrations (name) VALUES ($1)", [m.name]);
      await client.query("COMMIT");
      logger.info(`Applied migration: ${m.name}`);
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed migration: ${m.name}`);
      throw e;
    } finally {
      client.release();
    }
  }
  logger.info(`Completed ${migrations.length} migrations`);
}

export async function rollbackAll() {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%'`
    );
    const tables = res.rows.map((r) => r.tablename);
    for (const t of tables) {
      await client.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    }
    await client.query(
      `DROP TYPE IF EXISTS invoice_status, payment_status, email_status, quote_status, recurring_frequency, invoice_event_type, subscription_plan, subscription_status CASCADE`
    );
    await client.query("COMMIT");
    logger.info(`Dropped ${tables.length} tables (rollback)`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const doReset = args.includes("--reset");
  const main = async () => {
    if (doReset) {
      await rollbackAll();
    }
    await runMigrations();
    process.exit(0);
  };
  main().catch((e) => {
    logger.error({ err: e }, "Migration failed:");
    process.exit(1);
  });
}
