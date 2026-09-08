import { query } from "../db/pool.js";
import type { Customer, Business } from "../domain/models/index.js";

export interface CustomerInput {
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateOrRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  defaultCurrency?: string | null;
  notes?: string | null;
}

export class CustomerRepository {
  async create(businessId: string, input: CustomerInput): Promise<Customer> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const fields = ["business_id", "name", "company_name", "email", "phone", "tax_id",
      "address_line_1", "address_line_2", "city", "state_or_region", "postal_code",
      "country_code", "default_currency", "notes", "created_at", "updated_at"];
    const vals = [businessId, input.name, input.companyName, input.email, input.phone, input.taxId,
      input.addressLine1, input.addressLine2, input.city, input.stateOrRegion, input.postalCode,
      input.countryCode, input.defaultCurrency, input.notes, now, now];
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
    const res = await query(
      `INSERT INTO customers (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      vals
    );
    return this.rowToModel(res.rows[0]);
  }

  async findMany(businessId: string, limit = 50, offset = 0): Promise<Customer[]> {
    const res = await query(
      `SELECT * FROM customers WHERE business_id = $1 ORDER BY name LIMIT $2 OFFSET $3`,
      [businessId, limit, offset]
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async findById(businessId: string, id: string): Promise<Customer> {
    const res = await query(`SELECT * FROM customers WHERE id = $1 AND business_id = $2`, [id, businessId]);
    if (!res.rows.length) throw new Error(`Customer ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async update(businessId: string, id: string, input: CustomerInput): Promise<Customer> {
    const set: string[] = [];
    const vals: unknown[] = [businessId, id];
    let i = 3;
    for (const [key, val] of Object.entries(input)) {
      set.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }
    set.push(`updated_at = NOW()`);
    const res = await query(
      `UPDATE customers SET ${set.join(", ")} WHERE id = $2 AND business_id = $1 RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new Error(`Customer ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const res = await query(`DELETE FROM customers WHERE id = $1 AND business_id = $2`, [id, businessId]);
    if (res.rowCount === 0) throw new Error(`Customer ${id} not found or access denied`);
  }

  private rowToModel(r: Record<string, unknown>): Customer {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      companyName: r.company_name as string | null,
      email: r.email as string | null,
      phone: r.phone as string | null,
      taxId: r.tax_id as string | null,
      address: {
        addressLine1: r.address_line_1 as string,
        addressLine2: r.address_line_2 as string | null,
        city: r.city as string,
        stateOrRegion: r.state_or_region as string,
        postalCode: r.postal_code as string,
        countryCode: r.country_code as string,
        taxId: r.tax_id as string | null,
      },
      countryCode: r.country_code as string | null,
      defaultCurrency: (r.default_currency as string | null) as Customer["defaultCurrency"],
      notes: r.notes as string | null,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }
}

export const customerRepository = new CustomerRepository();
