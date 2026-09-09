import { query } from "../db/pool.js";
import type { Template } from "../domain/models/index.js";

export interface TemplateInput {
  name: string;
  htmlTemplate: string;
  config?: Record<string, unknown>;
  isDefault?: boolean;
}

export class TemplateRepository {
  async create(businessId: string, input: TemplateInput): Promise<Template> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await query(
      `INSERT INTO templates (id, business_id, name, is_default, config, html_template, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
      [id, businessId, input.name, input.isDefault ?? false, JSON.stringify(input.config ?? {}), input.htmlTemplate, now]
    );
    return this.rowToModel(res.rows[0]);
  }

  async findById(businessId: string, id: string): Promise<Template> {
    const res = await query("SELECT * FROM templates WHERE id = $1 AND business_id = $2", [id, businessId]);
    if (!res.rows.length) throw new Error(`Template ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async findMany(businessId: string, limit = 50, offset = 0): Promise<Template[]> {
    const res = await query(
      "SELECT * FROM templates WHERE business_id = $1 ORDER BY is_default DESC, created_at DESC LIMIT $2 OFFSET $3",
      [businessId, limit, offset]
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async findDefault(businessId: string): Promise<Template | null> {
    const res = await query(
      "SELECT * FROM templates WHERE business_id = $1 AND is_default = TRUE LIMIT 1",
      [businessId]
    );
    if (!res.rows.length) return null;
    return this.rowToModel(res.rows[0]);
  }

  async update(businessId: string, id: string, input: Partial<TemplateInput>): Promise<Template> {
    const set: string[] = [];
    const vals: unknown[] = [id, businessId];
    let i = 3;
    if (input.name !== undefined) { set.push(`name = $${i++}`); vals.push(input.name); }
    if (input.htmlTemplate !== undefined) { set.push(`html_template = $${i++}`); vals.push(input.htmlTemplate); }
    if (input.config !== undefined) { set.push(`config = $${i++}`); vals.push(JSON.stringify(input.config)); }
    if (input.isDefault !== undefined) { set.push(`is_default = $${i++}`); vals.push(input.isDefault); }
    set.push("updated_at = NOW()");
    const res = await query(
      `UPDATE templates SET ${set.join(", ")} WHERE id = $1 AND business_id = $2 RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new Error(`Template ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const res = await query("DELETE FROM templates WHERE id = $1 AND business_id = $2", [id, businessId]);
    if (res.rowCount === 0) throw new Error(`Template ${id} not found or access denied`);
  }

  private rowToModel(r: Record<string, unknown>): Template {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      isDefault: Boolean(r.is_default),
      config: (r.config as Record<string, unknown>) ?? {},
      htmlTemplate: r.html_template as string,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }
}

export const templateRepository = new TemplateRepository();
