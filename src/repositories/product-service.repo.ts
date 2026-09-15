import { query, getClient } from "../db/pool.js";
import { Decimal } from "decimal.js";
import type { ProductService, ProductServiceSnapshot } from "../domain/models/product-service.js";
import { NotFoundError, ConflictError } from "../domain/errors.js";
import { rowToDate } from "./helpers.js";

export interface CatalogFilter {
  search?: string;
  type?: "product" | "service";
  status?: "active" | "archived" | "draft";
  taxCategory?: string;
  hasSku?: boolean;
  sortBy?: "name" | "sku" | "unitPrice" | "createdAt";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface PagedProductServiceResult {
  data: ProductService[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductServiceCreateInput {
  type: "product" | "service";
  name: string;
  description?: string | null;
  sku?: string | null;
  unit?: string;
  unitPrice: Decimal.Value;
  taxCategory?: string | null;
  currency?: string;
  status?: "active" | "archived" | "draft";
  discountType?: "fixed" | "percentage";
  discountValue?: Decimal.Value;
}

export interface ProductServiceUpdateInput {
  type?: "product" | "service";
  name?: string;
  description?: string | null;
  sku?: string | null;
  unit?: string;
  unitPrice?: Decimal.Value;
  taxCategory?: string | null;
  currency?: string;
  discountType?: "fixed" | "percentage";
  discountValue?: Decimal.Value;
  version?: number;
}

export class ProductServiceRepository {
  async create(tenantId: string, input: ProductServiceCreateInput): Promise<ProductService> {
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await this.assertSkuUnique(client, tenantId, input.sku, undefined);

      const res = await client.query(
        `INSERT INTO products (
          id, business_id, product_type, name, description, sku, unit,
          default_unit_price, tax_category, default_currency, status,
          discount_type, discount_value, version, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
         RETURNING *`,
        [
          id,
          tenantId,
          input.type ?? "product",
          input.name,
          input.description ?? null,
          input.sku ?? null,
          input.unit ?? "each",
          String(input.unitPrice ?? 0),
          input.taxCategory ?? null,
          input.currency ?? "USD",
          input.status ?? "active",
          input.discountType ?? "percentage",
          String(input.discountValue ?? 0),
          1,
          now,
        ]
      );
      await client.query("COMMIT");
      return this.rowToModel(res.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async findMany(
    tenantId: string,
    opts: CatalogFilter = {}
  ): Promise<PagedProductServiceResult> {
    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [tenantId];
    let i = 2;

    if (opts.search) {
      conditions.push(`(name ILIKE $${i} OR (sku ILIKE $${i}))`);
      vals.push(`%${opts.search}%`);
      i++;
    }
    if (opts.type) {
      conditions.push(`product_type = $${i++}`);
      vals.push(opts.type);
    }
    if (opts.status) {
      conditions.push(`status = $${i++}`);
      vals.push(opts.status);
    }
    if (opts.taxCategory) {
      conditions.push(`tax_category = $${i++}`);
      vals.push(opts.taxCategory);
    }
    if (opts.hasSku) {
      conditions.push(opts.hasSku ? "sku IS NOT NULL AND sku != ''" : "sku IS NULL OR sku = ''");
    }

    const sortBy = opts.sortBy ?? "name";
    const sortOrder = opts.sortOrder ?? "asc";
    const sortMap: Record<string, string> = {
      name: "name",
      sku: "sku",
      unitPrice: "default_unit_price",
      createdAt: "created_at",
    };
    const sortCol = sortMap[sortBy] ?? "name";

    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;

    const countRes = await query(
      `SELECT COUNT(*) FROM products WHERE ${conditions.join(" AND ")}`,
      vals
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    const res = await query(
      `SELECT * FROM products
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${sortCol} ${sortOrder === "desc" ? "DESC" : "ASC"}
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    );

    return {
      data: res.rows.map((r) => this.rowToModel(r)),
      total,
      limit,
      offset,
    };
  }

  async findById(tenantId: string, id: string): Promise<ProductService> {
    const res = await query(
      `SELECT * FROM products WHERE id = $1 AND business_id = $2`,
      [id, tenantId]
    );
    if (!res.rows.length) throw new NotFoundError(`ProductService ${id} not found`);
    return this.rowToModel(res.rows[0]);
  }

  async findBySku(tenantId: string, sku: string): Promise<ProductService | null> {
    const res = await query(
      `SELECT * FROM products WHERE business_id = $1 AND sku = $2`,
      [tenantId, sku]
    );
    if (!res.rows.length) return null;
    return this.rowToModel(res.rows[0]);
  }

  async findForSelection(
    tenantId: string,
    opts: { search?: string; type?: "product" | "service"; onlyActive?: boolean; limit?: number; offset?: number }
  ): Promise<ProductService[]> {
    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [tenantId];
    let i = 2;

    if (opts.onlyActive !== false) {
      conditions.push(`status = $${i++}`);
      vals.push("active");
    }

    if (opts.search) {
      conditions.push(`(name ILIKE $${i} OR (sku ILIKE $${i}))`);
      vals.push(`%${opts.search}%`);
      i++;
    }
    if (opts.type) {
      conditions.push(`product_type = $${i++}`);
      vals.push(opts.type);
    }

    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;

    const res = await query(
      `SELECT * FROM products
       WHERE ${conditions.join(" AND ")}
       ORDER BY name ASC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async update(
    tenantId: string,
    id: string,
    input: ProductServiceUpdateInput,
    expectedVersion?: number
  ): Promise<ProductService> {
    const ALLOWED_COLUMNS = new Set([
      "name", "description", "sku", "unit", "default_unit_price",
      "tax_category", "default_currency", "discount_type", "discount_value",
      "product_type",
    ]);

    const set: string[] = [];
    const vals: unknown[] = [tenantId, id];
    let i = 3;

    for (const [key, val] of Object.entries(input)) {
      if (key === "version") continue;
      if (!ALLOWED_COLUMNS.has(key)) continue;
      set.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }

    if (input.sku) {
      await this.assertSkuUnique(null, tenantId, input.sku, id);
    }

    set.push(`version = version + 1`);
    set.push(`updated_at = NOW()`);

    let queryText = `UPDATE products SET ${set.join(", ")} WHERE id = $2 AND business_id = $1`;
    if (expectedVersion !== undefined) {
      queryText += ` AND version = $${i++}`;
      vals.push(expectedVersion);
    }
    queryText += ` RETURNING *`;

    if (expectedVersion !== undefined) {
      const res = await query(queryText, vals);
      if (!res.rows.length) throw new ConflictError(`ProductService ${id} not found or stale version`);
      return this.rowToModel(res.rows[0]);
    }

    const res = await query(queryText, vals);
    if (!res.rows.length) throw new NotFoundError(`ProductService ${id} not found`);
    return this.rowToModel(res.rows[0]);
  }

  async archive(tenantId: string, id: string): Promise<ProductService> {
    const res = await query(
      `UPDATE products SET status = 'archived', updated_at = NOW(), version = version + 1
       WHERE id = $1 AND business_id = $2 AND status = 'active'
       RETURNING *`,
      [id, tenantId]
    );
    if (!res.rows.length) throw new NotFoundError(`ProductService ${id} not found or already archived`);
    return this.rowToModel(res.rows[0]);
  }

  async restore(tenantId: string, id: string): Promise<ProductService> {
    const res = await query(
      `UPDATE products SET status = 'active', updated_at = NOW(), version = version + 1
       WHERE id = $1 AND business_id = $2 AND status = 'archived'
       RETURNING *`,
      [id, tenantId]
    );
    if (!res.rows.length) throw new NotFoundError(`ProductService ${id} not found or not archived`);
    return this.rowToModel(res.rows[0]);
  }

  async hardDelete(tenantId: string, id: string): Promise<void> {
    const res = await query(
      `DELETE FROM products WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, tenantId]
    );
    if (res.rowCount === 0) throw new NotFoundError(`ProductService ${id} not found`);
  }

  async countByStatus(tenantId: string): Promise<Record<string, number>> {
    const res = await query(
      `SELECT status, COUNT(*) FROM products WHERE business_id = $1 GROUP BY status`,
      [tenantId]
    );
    const counts: Record<string, number> = {};
    for (const r of res.rows) {
      counts[r.status as string] = Number(r.count);
    }
    return counts;
  }

  async createSnapshot(
    productId: string,
    tenantId: string,
    createdBy?: string
  ): Promise<ProductServiceSnapshot> {
    const product = await this.findById(tenantId, productId);

    const snapshotFields = {
      product_id: product.id,
      business_id: product.tenantId,
      name: product.name,
      description: product.description,
      sku: product.sku,
      unit: product.unit,
      unit_price: product.unitPrice,
      tax_category: product.taxCategory,
      tax_rate: product.defaultTaxRate,
      discount_type: product.discountType,
      discount_value: product.discountValue,
      currency: product.currency,
      product_type: product.type,
    };

    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256")
      .update(JSON.stringify(snapshotFields))
      .digest("hex");

    const res = await query(
      `INSERT INTO product_service_snapshots
         (product_id, business_id, name, description, sku, unit, unit_price,
          tax_category, tax_rate, discount_type, discount_value, currency,
          product_type, snapshot_hash, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        product.id, product.tenantId, product.name, product.description,
        product.sku, product.unit, product.unitPrice, product.taxCategory,
        product.defaultTaxRate, product.discountType, product.discountValue,
        product.currency, product.type, hash, createdBy ?? null,
      ]
    );

    const r = res.rows[0];
    return {
      productId: r.product_id as string,
      productType: r.product_type as ProductServiceSnapshot["productType"],
      name: r.name as string,
      description: r.description as string | null,
      sku: r.sku as string | null,
      unit: r.unit as string,
      unitPrice: r.unit_price as string,
      taxCategory: r.tax_category as string | null,
      taxRate: r.tax_rate as string,
      discountType: r.discount_type as "fixed" | "percentage",
      discountValue: r.discount_value as string,
      currency: r.currency as ProductServiceSnapshot["currency"],
    };
  }

  private async assertSkuUnique(
    client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> } | null,
    tenantId: string,
    sku: string | null | undefined,
    excludeId?: string | undefined
  ): Promise<void> {
    if (!sku || sku === "") return;

    const runner = (text: string, params?: unknown[]) =>
      client ? client.query(text, params) : query(text, params);

    const conditions = ["business_id = $1", "sku = $2"];
    const vals: unknown[] = [tenantId, sku];
    let i = 3;

    if (excludeId) {
      conditions.push(`id <> $${i++}`);
      vals.push(excludeId);
    }

    const res = await runner(
      `SELECT 1 FROM products WHERE ${conditions.join(" AND ")} LIMIT 1`,
      vals
    );
    if (res.rows.length) {
      throw new ConflictError(`SKU "${sku}" is already in use in this catalog`);
    }
  }

  private rowToModel(r: Record<string, unknown>): ProductService {
    return {
      id: r.id as string,
      tenantId: r.business_id as string,
      type: (r.product_type as string) as ProductService["type"],
      name: r.name as string,
      description: r.description as string | null,
      sku: r.sku as string | null,
      unit: r.unit as string,
      unitPrice: (new Decimal(r.default_unit_price as string ?? 0)).toFixed(6),
      defaultTaxRate: (new Decimal(r.default_tax_rate as string ?? 0)).toFixed(6),
      taxCategory: r.tax_category as string | null,
      currency: (r.default_currency as string) as ProductService["currency"],
      status: (r.status as string) as ProductService["status"],
      discountType: (r.discount_type as string) as "fixed" | "percentage",
      discountValue: (new Decimal(r.discount_value as string ?? 0)).toFixed(6),
      version: Number(r.version ?? 1),
      createdAt: rowToDate(r.created_at) || new Date(),
      updatedAt: rowToDate(r.updated_at) || new Date(),
    };
  }
}

export const productServiceRepository = new ProductServiceRepository();
