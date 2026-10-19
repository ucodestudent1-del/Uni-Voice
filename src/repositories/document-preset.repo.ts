import { query, getClient } from "../db/pool.js";
import type { DocumentPreset } from "../domain/models/index.js";
import {
  DocumentPresetInputSchema,
  DocumentPresetUpdateSchema,
  type FindManyPresetOptions,
} from "../domain/schemas/document-preset.js";

export class DocumentPresetRepository {
  async create(
    businessId: string,
    input: {
      name: string;
      description?: string | null;
      documentType?: string;
      data: Record<string, unknown>;
      isDefault?: boolean;
      isActive?: boolean;
    },
    createdBy?: string
  ): Promise<DocumentPreset> {
    const parsed = DocumentPresetInputSchema.parse(input);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    if (parsed.isDefault) {
      await this.clearOtherDefaults(businessId, parsed.documentType, id);
    }

    const res = await query(
      `INSERT INTO document_presets
         (id, business_id, name, description, document_type, data, is_default, is_active, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$10)`,
      [
        id,
        businessId,
        parsed.name,
        parsed.description ?? null,
        parsed.documentType ?? "invoice",
        JSON.stringify(parsed.data),
        parsed.isDefault ?? false,
        parsed.isActive ?? true,
        createdBy ?? null,
        now,
      ]
    );
    return this.rowToModel(res.rows[0]);
  }

  async findById(businessId: string, id: string): Promise<DocumentPreset> {
    const res = await query(
      "SELECT * FROM document_presets WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );
    if (!res.rows.length) throw new Error(`DocumentPreset ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async findMany(
    businessId: string,
    opts: FindManyPresetOptions = {}
  ): Promise<DocumentPreset[]> {
    const { documentType, isDefault, isActive, limit = 50, offset = 0 } = opts;
    const vals: unknown[] = [businessId];
    const conditions: string[] = ["business_id = $1"];
    let i = 2;

    if (documentType !== undefined) {
      if (Array.isArray(documentType)) {
        const placeholders = documentType.map(() => `$${i++}`).join(", ");
        conditions.push(`document_type IN (${placeholders})`);
        vals.push(...documentType);
      } else {
        conditions.push(`document_type = $${i++}`);
        vals.push(documentType);
      }
    }
    if (isDefault !== undefined) {
      conditions.push(`is_default = $${i++}`);
      vals.push(isDefault);
    }
    if (isActive !== undefined) {
      conditions.push(`is_active = $${i++}`);
      vals.push(isActive);
    }

    vals.push(Math.min(limit, 200), offset);
    const res = await query(
      `SELECT * FROM document_presets
       WHERE ${conditions.join(" AND ")}
       ORDER BY is_default DESC, created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      vals
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async findDefault(businessId: string, documentType?: string): Promise<DocumentPreset | null> {
    let res;
    if (documentType) {
      res = await query(
        `SELECT * FROM document_presets
         WHERE business_id = $1 AND document_type = $2 AND is_default = TRUE AND is_active = TRUE
         LIMIT 1`,
        [businessId, documentType]
      );
    } else {
      res = await query(
        `SELECT * FROM document_presets
         WHERE business_id = $1 AND is_default = TRUE AND is_active = TRUE
         LIMIT 1`,
        [businessId]
      );
    }
    if (!res.rows.length) return null;
    return this.rowToModel(res.rows[0]);
  }

  async update(
    businessId: string,
    id: string,
    input: {
      name?: string;
      description?: string | null;
      documentType?: string;
      data?: Record<string, unknown>;
      isDefault?: boolean;
      isActive?: boolean;
    },
    updatedBy?: string
  ): Promise<DocumentPreset> {
    const parsed = DocumentPresetUpdateSchema.parse(input);
    const set: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (parsed.name !== undefined) { set.push(`name = $${i++}`); vals.push(parsed.name); }
    if ("description" in parsed && parsed.description !== undefined) { set.push(`description = $${i++}`); vals.push(parsed.description); }
    if (parsed.documentType !== undefined) { set.push(`document_type = $${i++}`); vals.push(parsed.documentType); }
    if (parsed.data !== undefined) { set.push(`data = $${i++}`); vals.push(JSON.stringify(parsed.data)); }
    if (parsed.isActive !== undefined) { set.push(`is_active = $${i++}`); vals.push(parsed.isActive); }

    if (parsed.isDefault === true) {
      await this.clearOtherDefaults(businessId, parsed.documentType ?? undefined, id);
    }

    if (parsed.isDefault !== undefined) {
      set.push(`is_default = $${i++}`);
      vals.push(parsed.isDefault);
    }

    if (!set.length) {
      return this.findById(businessId, id);
    }

    vals.push(updatedBy ?? null, id, businessId);
    const res = await query(
      `UPDATE document_presets
       SET ${set.join(", ")}, updated_by = $${i++}, updated_at = NOW()
       WHERE id = $${i - 2} AND business_id = $${i - 1}
       RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new Error(`DocumentPreset ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const res = await query(
      "DELETE FROM document_presets WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );
    if (res.rowCount === 0) throw new Error(`DocumentPreset ${id} not found or access denied`);
  }

  async setDefault(
    businessId: string,
    id: string,
    documentType?: string
  ): Promise<DocumentPreset> {
    const client = await getClient();
    try {
      await client.query("BEGIN");
      if (documentType) {
        await client.query(
          "UPDATE document_presets SET is_default = FALSE WHERE business_id = $1 AND document_type = $2 AND id != $3",
          [businessId, documentType, id]
        );
      } else {
        await client.query(
          "UPDATE document_presets SET is_default = FALSE WHERE business_id = $1 AND id != $2",
          [businessId, id]
        );
      }
      const res = await client.query(
        `UPDATE document_presets SET is_default = TRUE, updated_at = NOW()
         WHERE id = $1 AND business_id = $2
         RETURNING *`,
        [id, businessId]
      );
      if (!res.rows.length) throw new Error(`DocumentPreset ${id} not found or access denied`);
      await client.query("COMMIT");
      return this.rowToModel(res.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  private async clearOtherDefaults(businessId: string, documentType: string | undefined, excludeId: string): Promise<void> {
    if (documentType) {
      await query(
        "UPDATE document_presets SET is_default = FALSE WHERE business_id = $1 AND document_type = $2 AND id != $3",
        [businessId, documentType, excludeId]
      );
    } else {
      await query(
        "UPDATE document_presets SET is_default = FALSE WHERE business_id = $1 AND id != $2",
        [businessId, excludeId]
      );
    }
  }

  private rowToModel(r: Record<string, unknown>): DocumentPreset {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      description: r.description as string | null,
      documentType: (r.document_type as string) ?? "invoice",
      data: (r.data as Record<string, unknown>) ?? {},
      isDefault: Boolean(r.is_default),
      isActive: Boolean(r.is_active),
      createdBy: r.created_by as string | null,
      updatedBy: r.updated_by as string | null,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    };
  }
}

export const documentPresetRepository = new DocumentPresetRepository();
