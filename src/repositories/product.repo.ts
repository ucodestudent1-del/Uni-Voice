import { query } from "../db/pool.js";
import type { Product } from "../domain/models/index.js";

export interface ProductInput {
  name: string;
  description?: string | null;
  sku?: string | null;
  defaultUnitPrice?: string | number;
  defaultTaxRate?: string | number;
  unit?: string;
  defaultCurrency?: string;
}

export class ProductRepository {
  async create(businessId: string, input: ProductInput): Promise<Product> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await query(
      `INSERT INTO products (id, business_id, name, description, sku, default_unit_price, default_tax_rate, unit, default_currency, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
      [
        id, businessId, input.name, input.description, input.sku,
        input.defaultUnitPrice ?? 0, input.defaultTaxRate ?? 0,
        input.unit ?? "each", input.defaultCurrency ?? "USD", now,
      ]
    );
    return this.rowToModel(res.rows[0]);
  }

  async findMany(businessId: string, limit = 50, offset = 0): Promise<Product[]> {
    const res = await query(
      `SELECT * FROM products WHERE business_id = $1 ORDER BY name LIMIT $2 OFFSET $3`,
      [businessId, limit, offset]
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async findById(businessId: string, id: string): Promise<Product> {
    const res = await query(`SELECT * FROM products WHERE id = $1 AND business_id = $2`, [id, businessId]);
    if (!res.rows.length) throw new Error(`Product ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async update(businessId: string, id: string, input: ProductInput): Promise<Product> {
    const ALLOWED_COLUMNS = new Set([
      "name", "description", "sku", "default_unit_price", "default_tax_rate",
      "unit", "default_currency",
    ]);
    const set: string[] = [];
    const vals: unknown[] = [businessId, id];
    let i = 3;
    for (const [key, val] of Object.entries(input)) {
      if (!ALLOWED_COLUMNS.has(key)) continue;
      set.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }
    set.push(`updated_at = NOW()`);
    const res = await query(
      `UPDATE products SET ${set.join(", ")} WHERE id = $2 AND business_id = $1 RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new Error(`Product ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const res = await query(`DELETE FROM products WHERE id = $1 AND business_id = $2`, [id, businessId]);
    if (res.rowCount === 0) throw new Error(`Product ${id} not found or access denied`);
  }

  private rowToModel(r: Record<string, unknown>): Product {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      description: r.description as string | null,
      sku: r.sku as string | null,
      defaultUnitPrice: r.default_unit_price as string,
      defaultTaxRate: r.default_tax_rate as string,
      unit: r.unit as string,
      defaultCurrency: (r.default_currency as string) as Product["defaultCurrency"],
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }
}

export const productRepository = new ProductRepository();
