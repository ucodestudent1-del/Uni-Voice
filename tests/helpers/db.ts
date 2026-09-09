import { query, getClient } from "../../src/db/pool.js";
import { runMigrations, rollbackAll } from "../../src/db/migrate.js";
import bcrypt from "bcrypt";

export async function resetTestDb(): Promise<void> {
  await rollbackAll();
  await runMigrations();
}

export interface TestBusiness {
  id: string;
  ownerId: string;
}

export async function createTestBusiness(data?: Partial<{
  id: string;
  ownerId: string;
  name: string;
  countryCode: string;
  defaultCurrency: string;
}>): Promise<TestBusiness> {
  const id = data?.id ?? "00000000-0000-0000-0000-000000000001";
  const ownerId = data?.ownerId ?? "11111111-1111-1111-1111-111111111111";
  const name = data?.name ?? "Test Business";
  const countryCode = data?.countryCode ?? "US";
  const defaultCurrency = data?.defaultCurrency ?? "USD";
  const now = new Date().toISOString();
  await query(
    `INSERT INTO businesses (id, owner_id, name, country_code, default_currency, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [id, ownerId, name, countryCode, defaultCurrency, now]
  );
  await query(
    `INSERT INTO business_settings (business_id, default_currency, default_terms, default_notes, time_zone, locale, created_at, updated_at)
     VALUES ($1, $2, 'Net 30', 'Thank you for your business.', 'UTC', 'en-US', $3, $3)
     ON CONFLICT (business_id) DO UPDATE SET default_currency = EXCLUDED.default_currency`,
    [id, defaultCurrency, now]
  );
  return { id, ownerId };
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  businessId: string;
}

export async function createTestUser(data?: Partial<{
  id: string;
  email: string;
  password: string;
  name: string;
  businessId: string;
  countryCode: string;
  defaultCurrency: string;
}>): Promise<TestUser> {
  const id = data?.id ?? "11111111-1111-1111-1111-111111111111";
  const email = data?.email ?? `${id}@example.com`;
  const password = data?.password ?? "Password123!";
  const businessId = data?.businessId ?? "00000000-0000-0000-0000-000000000001";
  const countryCode = data?.countryCode ?? "US";
  const defaultCurrency = data?.defaultCurrency ?? "USD";
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 5);

  await query(
    `INSERT INTO users (id, email, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
    [id, email, passwordHash, now]
  );

  await query(
    `INSERT INTO businesses (id, owner_id, name, country_code, default_currency, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [businessId, id, "Test Business", countryCode, defaultCurrency, now]
  );

  return { id, email, password, businessId };
}

export async function createTestCustomer(businessId: string, name = "Test Customer"): Promise<string> {
  const id = "22222222-2222-2222-2222-222222222222";
  const now = new Date().toISOString();
  await query(
    `INSERT INTO customers (id, business_id, name, email, country_code, default_currency, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [id, businessId, name, "customer@example.com", "US", "USD", now]
  );
  return id;
}
