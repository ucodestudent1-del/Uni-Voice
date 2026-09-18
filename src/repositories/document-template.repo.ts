import { query, getClient } from "../db/pool.js";
import type { DocumentTemplate } from "../domain/models/index.js";
import { DocumentTemplateInputSchema } from "../domain/schemas/document-template.js";

export interface FindManyOptions {
  industry?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  documentType?: string | string[];
  limit?: number;
  offset?: number;
}

export interface DocumentTemplateCreateInput {
  name: string;
  description?: string | null;
  industry?: string | null;
  schema_version?: string;
  document: Record<string, unknown>;
  html_template?: string;
  config?: Record<string, unknown>;
  is_default?: boolean;
  is_active?: boolean;
  document_type?: string;
}

export interface DocumentTemplateUpdateInput {
  name?: string;
  description?: string | null;
  industry?: string | null;
  schema_version?: string;
  document?: Record<string, unknown>;
  html_template?: string;
  config?: Record<string, unknown>;
  is_default?: boolean;
  is_active?: boolean;
  document_type?: string;
  revision?: number;
  version?: number;
}

export class DocumentTemplateRepository {
  async create(
    businessId: string,
    input: DocumentTemplateCreateInput,
    createdBy?: string
  ): Promise<DocumentTemplate> {
    const parsed = DocumentTemplateInputSchema.parse(input);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await query(
      `INSERT INTO document_templates
         (id, business_id, name, description, industry, schema_version, revision, version,
          document, html_template, config, is_default, is_active, document_type, created_at, updated_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
      [
        id,
        businessId,
        parsed.name,
        parsed.description ?? null,
        parsed.industry ?? null,
        parsed.schema_version ?? "1.0",
        1,
        1,
        JSON.stringify(parsed.document),
        parsed.html_template ?? "",
        JSON.stringify(parsed.config ?? {}),
        parsed.is_default ?? false,
        parsed.is_active ?? true,
        parsed.document_type ?? "invoice",
        now,
        now,
        createdBy ?? null,
      ]
    );
    return this.rowToModel(res.rows[0]);
  }

  async findById(businessId: string, id: string): Promise<DocumentTemplate> {
    const res = await query(
      "SELECT * FROM document_templates WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );
    if (!res.rows.length) throw new Error(`DocumentTemplate ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async findMany(
    businessId: string,
    opts: FindManyOptions = {}
  ): Promise<DocumentTemplate[]> {
    const { industry, isDefault, isActive, documentType, limit = 50, offset = 0 } = opts;
    const vals: unknown[] = [businessId];
    const conditions: string[] = ["business_id = $1"];
    let i = 2;

    if (industry !== undefined && industry !== null) {
      conditions.push(`industry = $${i++}`);
      vals.push(industry);
    }
    if (isDefault !== undefined) {
      conditions.push(`is_default = $${i++}`);
      vals.push(isDefault);
    }
    if (isActive !== undefined) {
      conditions.push(`is_active = $${i++}`);
      vals.push(isActive);
    }
    if (documentType !== undefined) {
      if (Array.isArray(documentType)) {
        const placeholders = documentType.map(() => `$` + i++).join(", ");
        conditions.push(`document_type IN (${placeholders})`);
        vals.push(...documentType);
      } else {
        conditions.push(`document_type = $${i++}`);
        vals.push(documentType);
      }
    }

    vals.push(Math.min(limit, 200), offset);
    const res = await query(
      `SELECT * FROM document_templates
       WHERE ${conditions.join(" AND ")}
       ORDER BY is_default DESC, created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      vals
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async findDefault(businessId: string): Promise<DocumentTemplate | null> {
    const res = await query(
      "SELECT * FROM document_templates WHERE business_id = $1 AND is_default = TRUE LIMIT 1",
      [businessId]
    );
    if (!res.rows.length) return null;
    return this.rowToModel(res.rows[0]);
  }

  async findDefaultByIndustry(
    businessId: string,
    industry: string
  ): Promise<DocumentTemplate | null> {
    const res = await query(
      `SELECT * FROM document_templates
       WHERE business_id = $1 AND is_default = TRUE AND industry = $2
       LIMIT 1`,
      [businessId, industry]
    );
    if (res.rows.length) return this.rowToModel(res.rows[0]);
    return this.findDefault(businessId);
  }

  async update(
    businessId: string,
    id: string,
    input: DocumentTemplateUpdateInput
  ): Promise<DocumentTemplate> {
    const set: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (input.name !== undefined) { set.push(`name = $${i++}`); vals.push(input.name); }
    if (input.description !== undefined) { set.push(`description = $${i++}`); vals.push(input.description); }
    if (input.industry !== undefined) { set.push(`industry = $${i++}`); vals.push(input.industry); }
    if (input.schema_version !== undefined) { set.push(`schema_version = $${i++}`); vals.push(input.schema_version); }
    if ("document" in input && input.document !== undefined) { set.push(`document = $${i++}`); vals.push(JSON.stringify(input.document)); }
    if (input.html_template !== undefined) { set.push(`html_template = $${i++}`); vals.push(input.html_template); }
    if (input.config !== undefined) { set.push(`config = $${i++}`); vals.push(JSON.stringify(input.config)); }
    if (input.is_default !== undefined) { set.push(`is_default = $${i++}`); vals.push(input.is_default); }
    if (input.is_active !== undefined) { set.push(`is_active = $${i++}`); vals.push(input.is_active); }
    if (input.document_type !== undefined) { set.push(`document_type = $${i++}`); vals.push(input.document_type); }
    if (input.revision !== undefined) { set.push(`revision = $${i++}`); vals.push(input.revision); }
    if (input.version !== undefined) { set.push(`version = $${i++}`); vals.push(input.version); }

    if (!set.length) {
      return this.findById(businessId, id);
    }

    vals.push(id, businessId);
    set.push("updated_at = NOW()");

    const res = await query(
      `UPDATE document_templates SET ${set.join(", ")}
       WHERE id = $${i++} AND business_id = $${i}
       RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new Error(`DocumentTemplate ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const res = await query(
      "DELETE FROM document_templates WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );
    if (res.rowCount === 0) throw new Error(`DocumentTemplate ${id} not found or access denied`);
  }

  async duplicate(
    businessId: string,
    id: string,
    createdBy?: string
  ): Promise<DocumentTemplate> {
    const original = await this.findById(businessId, id);
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();

    const res = await query(
      `INSERT INTO document_templates
         (id, business_id, name, description, industry, schema_version, revision, version,
          document, html_template, config, is_default, is_active, document_type, created_at, updated_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
      [
        newId,
        businessId,
        `${original.name} (Copy)`,
        original.description,
        original.industry,
        original.schemaVersion,
        original.revision + 1,
        original.version + 1,
        JSON.stringify(original.document),
        original.htmlTemplate ?? "",
        JSON.stringify(original.config),
        false,
        original.isActive,
        original.documentType ?? "invoice",
        now,
        now,
        createdBy ?? original.createdBy ?? null,
      ]
    );
    return this.rowToModel(res.rows[0]);
  }

  async setDefault(businessId: string, id: string): Promise<DocumentTemplate> {
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE document_templates SET is_default = FALSE WHERE business_id = $1 AND is_default = TRUE",
        [businessId]
      );
      const res = await client.query(
        "UPDATE document_templates SET is_default = TRUE, updated_at = NOW() WHERE id = $1 AND business_id = $2 RETURNING *",
        [id, businessId]
      );
      if (!res.rows.length) {
        throw new Error(`DocumentTemplate ${id} not found or access denied`);
      }
      await client.query("COMMIT");
      return this.rowToModel(res.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  private rowToModel(r: Record<string, unknown>): DocumentTemplate {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      description: r.description as string | null,
      industry: r.industry as string | null,
      schemaVersion: (r.schema_version as string) ?? "1.0",
      revision: Number(r.revision ?? 1),
      version: Number(r.version ?? 1),
      document: (r.document as Record<string, unknown>) ?? {},
      htmlTemplate: r.html_template as string | null ?? null,
      config: (r.config as Record<string, unknown>) ?? {},
      isDefault: Boolean(r.is_default),
      isActive: Boolean(r.is_active),
      documentType: (r.document_type as string) ?? "invoice",
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
      createdBy: r.created_by as string | null,
      updatedBy: r.updated_by as string | null,
    };
  }
}

export const documentTemplateRepository = new DocumentTemplateRepository();
