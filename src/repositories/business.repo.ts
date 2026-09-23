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

  
  async getSettings(businessId: string): Promise<{
    paymentProvider: string | null;
    remindersEnabled: boolean;
    overdueReminderDays: number;
  }> {
    const res = await query(
      `SELECT payment_provider, reminders_enabled, overdue_reminder_days
       FROM business_settings WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { paymentProvider: null, remindersEnabled: true, overdueReminderDays: 7 };
    }
    const row = res.rows[0];
    return {
      paymentProvider: row.payment_provider ?? null,
      remindersEnabled: row.reminders_enabled ?? true,
      overdueReminderDays: Number(row.overdue_reminder_days ?? 7),
    };
  }

  async getDefaultTerms(businessId: string): Promise<{ defaultTerms: string | null; defaultNotes: string | null }> {
    const res = await query(
      `SELECT default_terms, default_notes FROM business_settings WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { defaultTerms: null, defaultNotes: null };
    }
    const row = res.rows[0];
    return {
      defaultTerms: (row.default_terms as string | null) ?? null,
      defaultNotes: (row.default_notes as string | null) ?? null,
    };
  }

  async getReminderSettings(businessId: string): Promise<{
    enabled: boolean;
    beforeDue: Array<{ id: string; offsetDays: number; maxSends: number; enabled: boolean }>;
    afterDue: Array<{ id: string; offsetDays: number; maxSends: number; enabled: boolean }>;
  }> {
    const res = await query(
      `SELECT reminders_enabled, reminders_before_due, reminders_after_due
       FROM business_settings WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { enabled: true, beforeDue: [], afterDue: [] };
    }
    const row = res.rows[0];
    const parseRules = (value: unknown) => {
      if (!Array.isArray(value)) return [];
      return value.filter((rule): rule is { id: string; offsetDays: number; maxSends: number; enabled: boolean } => {
        if (!rule || typeof rule !== "object") return false;
        const candidate = rule as Record<string, unknown>;
        return typeof candidate.id === "string"
          && typeof candidate.offsetDays === "number"
          && typeof candidate.maxSends === "number"
          && typeof candidate.enabled === "boolean";
      });
    };
    return {
      enabled: row.reminders_enabled ?? true,
      beforeDue: parseRules(row.reminders_before_due),
      afterDue: parseRules(row.reminders_after_due),
    };
  }

  async listReminderEnabledBusinesses(): Promise<string[]> {
    const res = await query(
      `SELECT business_id FROM business_settings
       WHERE reminders_enabled = TRUE
       AND (jsonb_array_length(COALESCE(reminders_before_due, '[]'::jsonb)) > 0
         OR jsonb_array_length(COALESCE(reminders_after_due, '[]'::jsonb)) > 0)`
    );
    return res.rows.map((row) => row.business_id as string);
  }

  async updateReminderSettings(businessId: string, input: {
    enabled?: boolean;
    beforeDue?: Array<{ id: string; offsetDays: number; maxSends: number; enabled: boolean }>;
    afterDue?: Array<{ id: string; offsetDays: number; maxSends: number; enabled: boolean }>;
  }): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [businessId];
    let i = 2;

    if (input.enabled !== undefined) {
      updates.push(`reminders_enabled = $${i++}`);
      values.push(input.enabled);
    }
    if (input.beforeDue !== undefined) {
      updates.push(`reminders_before_due = $${i++}::jsonb`);
      values.push(JSON.stringify(input.beforeDue));
    }
    if (input.afterDue !== undefined) {
      updates.push(`reminders_after_due = $${i++}::jsonb`);
      values.push(JSON.stringify(input.afterDue));
    }
    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);
    await query(
      `UPDATE business_settings SET ${updates.join(", ")} WHERE business_id = $1`,
      values
    );
  }

  async getReminderRulesForBusiness(businessId: string): Promise<{
    beforeDue: Array<{ id: string; offsetDays: number; maxSends: number; enabled: boolean }>;
    afterDue: Array<{ id: string; offsetDays: number; maxSends: number; enabled: boolean }>;
  }> {
    const res = await query(
      `SELECT reminders_before_due, reminders_after_due
       FROM business_settings WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { beforeDue: [], afterDue: [] };
    }
    const row = res.rows[0];
    const parseRules = (value: unknown) => {
      if (!Array.isArray(value)) return [];
      return value.filter((rule): rule is { id: string; offsetDays: number; maxSends: number; enabled: boolean } => {
        if (!rule || typeof rule !== "object") return false;
        const candidate = rule as Record<string, unknown>;
        return typeof candidate.id === "string"
          && typeof candidate.offsetDays === "number"
          && typeof candidate.maxSends === "number"
          && typeof candidate.enabled === "boolean";
      });
    };
    return {
      beforeDue: parseRules(row.reminders_before_due),
      afterDue: parseRules(row.reminders_after_due),
    };
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
