import { query } from "../db/pool.js";
import type { Business } from "../domain/models/index.js";
import { rowToDate } from "./helpers.js";
import { ValidationError } from "../domain/errors.js";

export interface BusinessInput {
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateOrRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  defaultCurrency?: string;
  logoUrl?: string | null;
  ownerId?: string;
  version?: number;
}

export class BusinessRepository {
  async create(input: BusinessInput, ownerId: string): Promise<Business> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError("Business name is required");
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await query(
      `INSERT INTO businesses (id, owner_id, name, legal_name, email, phone, website, tax_id, registration_number,
        address_line_1, address_line_2, city, state_or_region, postal_code, country_code, default_currency, logo_url, version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,1,$18,$18)
       RETURNING *`,
      [
        id, ownerId, input.name, input.legalName, input.email, input.phone, input.website,
        input.taxId, input.registrationNumber, input.addressLine1, input.addressLine2,
        input.city, input.stateOrRegion, input.postalCode, input.countryCode ?? "US",
        input.defaultCurrency ?? "USD", input.logoUrl, now,
      ]
    );
    // seed default settings + numbering sequence
    await query(
      `INSERT INTO business_settings (business_id, default_currency, time_zone, locale, created_at, updated_at)
       VALUES ($1, $2, 'UTC', 'en-US', $3, $3)
       ON CONFLICT (business_id) DO NOTHING`,
      [id, input.defaultCurrency ?? "USD", now]
    );
    return this.rowToModel(res.rows[0]);
  }

  async findById(businessId: string, ownerId?: string): Promise<Business> {
    const res = await query("SELECT * FROM businesses WHERE id = $1", [businessId]);
    if (!res.rows.length) throw new Error(`Business ${businessId} not found`);
    const biz = this.rowToModel(res.rows[0]);
    if (ownerId && biz.ownerId !== ownerId) {
      throw new Error("Access denied to this business");
    }
    return biz;
  }

  async update(businessId: string, input: BusinessInput, ownerId: string): Promise<Business> {
    const fields: string[] = [];
    const values: unknown[] = [businessId, ownerId];
    let i = 3;
    for (const [key, val] of Object.entries(input)) {
      if (key === "version") continue;
      const col = key;
      fields.push(`${col} = $${i++}`);
      values.push(val ?? null);
    }
    fields.push(`version = version + 1`);
    fields.push(`updated_at = NOW()`);
    const res = await query(
      `UPDATE businesses SET ${fields.join(", ")} WHERE id = $1 AND owner_id = $2 RETURNING *`,
      values
    );
    if (!res.rows.length) throw new Error("Business not found or access denied");
    return this.rowToModel(res.rows[0]);
  }

  async updateOptimistic(businessId: string, input: BusinessInput, expectedVersion: number, ownerId: string): Promise<Business> {
    const fields: string[] = [];
    const values: unknown[] = [businessId, ownerId, expectedVersion];
    let i = 4;
    for (const [key, val] of Object.entries(input)) {
      if (key === "version") continue;
      const col = key;
      fields.push(`${col} = $${i++}`);
      values.push(val ?? null);
    }
    fields.push(`version = version + 1`);
    fields.push(`updated_at = NOW()`);
    const res = await query(
      `UPDATE businesses SET ${fields.join(", ")} WHERE id = $1 AND owner_id = $2 AND version = $3 RETURNING *`,
      values
    );
    if (!res.rows.length) throw new Error("Business not found, access denied, or stale version (conflict)");
    return this.rowToModel(res.rows[0]);
  }

  private rowToModel(r: Record<string, unknown>): Business {
    return {
      id: r.id as string,
      version: Number(r.version ?? 1),
      ownerId: r.owner_id as string | undefined,
      name: r.name as string,
      legalName: r.legal_name as string | null,
      email: r.email as string | null,
      phone: r.phone as string | null,
      website: r.website as string | null,
      taxId: r.tax_id as string | null,
      registrationNumber: r.registration_number as string | null,
      address: {
        addressLine1: r.address_line_1 as string,
        addressLine2: r.address_line_2 as string | null,
        city: r.city as string,
        stateOrRegion: r.state_or_region as string,
        postalCode: r.postal_code as string,
        countryCode: r.country_code as string,
        taxId: r.tax_id as string | null,
      },
      countryCode: r.country_code as string,
      defaultCurrency: (r.default_currency as string) as Business["defaultCurrency"],
      logoUrl: r.logo_url as string | null,
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }
}

export const businessRepository = new BusinessRepository();
