import { query, getClient } from "../db/pool.js";
import type { InvoiceTemplate, InvoiceTemplateRevision } from "../domain/models/index.js";
import {
  InvoiceTemplateInputSchema,
  InvoiceTemplateUpdateSchema,
  InvoiceTemplateRevisionInputSchema,
} from "../domain/schemas/invoice-template.js";

export interface FindInvoiceTemplatesOptions {
  industry?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  lifecycle?: string | string[];
  limit?: number;
  offset?: number;
}

export interface InvoiceTemplateCreateInput {
  name: string;
  description?: string | null;
  industry?: string | null;
  schemaVersion?: string;
  document: Record<string, unknown>;
  htmlTemplate?: string | null;
  config?: Record<string, unknown>;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface InvoiceTemplateUpdateInput {
  name?: string;
  description?: string | null;
  industry?: string | null;
  schemaVersion?: string;
  document?: Record<string, unknown>;
  htmlTemplate?: string | null;
  config?: Record<string, unknown>;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface InvoiceTemplateRevisionInput {
  document?: Record<string, unknown>;
  htmlTemplate?: string | null;
  config?: Record<string, unknown>;
  changeSummary?: string | null;
}

export class InvoiceTemplateRepository {
  async create(
    businessId: string,
    input: InvoiceTemplateCreateInput,
    createdBy?: string | null
  ): Promise<InvoiceTemplate> {
    const parsed = InvoiceTemplateInputSchema.parse({
      ...input,
      document: this.normalizeDocument(input.document),
    });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await query(
      `INSERT INTO document_templates
         (id, business_id, name, description, industry, schema_version, revision, version,
          document, html_template, config, is_default, is_active, lifecycle, published_at,
          published_revision, created_at, updated_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$18)
        RETURNING *`,
      [
        id,
        businessId,
        parsed.name,
        parsed.description ?? null,
        parsed.industry ?? null,
        parsed.schemaVersion ?? "1.0",
        1,
        1,
        JSON.stringify(parsed.document),
        parsed.htmlTemplate ?? null,
        JSON.stringify(parsed.config ?? {}),
        parsed.isDefault ?? false,
        parsed.isActive ?? true,
        "draft",
        null,
        null,
        now,
        createdBy ?? null,
      ]
    );
    return this.rowToModel(res.rows[0]);
  }

  async findById(businessId: string, id: string): Promise<InvoiceTemplate> {
    const res = await query(
      "SELECT * FROM document_templates WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );
    if (!res.rows.length) throw new Error(`InvoiceTemplate ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async findMany(
    businessId: string,
    opts: FindInvoiceTemplatesOptions = {}
  ): Promise<InvoiceTemplate[]> {
    const { industry, isDefault, isActive, lifecycle, limit = 50, offset = 0 } = opts;
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
    if (lifecycle !== undefined) {
      if (Array.isArray(lifecycle)) {
        const placeholders = lifecycle.map(() => `$` + i++).join(", ");
        conditions.push(`lifecycle IN (${placeholders})`);
        vals.push(...lifecycle);
      } else {
        conditions.push(`lifecycle = $${i++}`);
        vals.push(lifecycle);
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

  async findDefault(businessId: string, opts?: { industry?: string }): Promise<InvoiceTemplate | null> {
    const vals: unknown[] = [businessId];
    let i = 2;
    let conditions = "business_id = $1 AND is_default = TRUE AND lifecycle = 'published'";

    if (opts?.industry) {
      conditions += ` AND industry = $${i++}`;
      vals.push(opts.industry);
    }

    const res = await query(
      `SELECT * FROM document_templates WHERE ${conditions} ORDER BY created_at DESC LIMIT 1`,
      vals
    );
    if (!res.rows.length) {
      const fallback = await query(
        "SELECT * FROM document_templates WHERE business_id = $1 AND is_default = TRUE AND lifecycle = 'published' ORDER BY created_at DESC LIMIT 1",
        [businessId]
      );
      if (!fallback.rows.length) return null;
      return this.rowToModel(fallback.rows[0]);
    }
    return this.rowToModel(res.rows[0]);
  }

  async findDefaultByIndustry(businessId: string, industry: string): Promise<InvoiceTemplate | null> {
    return this.findDefault(businessId, { industry });
  }

  async update(
    businessId: string,
    id: string,
    input: InvoiceTemplateUpdateInput,
    updatedBy?: string | null
  ): Promise<InvoiceTemplate> {
    const set: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (input.name !== undefined) {
      set.push(`name = $${i++}`);
      vals.push(input.name);
    }
    if (input.description !== undefined) {
      set.push(`description = $${i++}`);
      vals.push(input.description);
    }
    if (input.industry !== undefined) {
      set.push(`industry = $${i++}`);
      vals.push(input.industry);
    }
    if (input.schemaVersion !== undefined) {
      set.push(`schema_version = $${i++}`);
      vals.push(input.schemaVersion);
    }
    if ("document" in input && input.document !== undefined) {
      set.push(`document = $${i++}`);
      vals.push(JSON.stringify(input.document));
    }
    if (input.htmlTemplate !== undefined) {
      set.push(`html_template = $${i++}`);
      vals.push(input.htmlTemplate);
    }
    if (input.config !== undefined) {
      set.push(`config = $${i++}`);
      vals.push(JSON.stringify(input.config));
    }
    if (input.isDefault !== undefined) {
      set.push(`is_default = $${i++}`);
      vals.push(input.isDefault);
    }
    if (input.isActive !== undefined) {
      set.push(`is_active = $${i++}`);
      vals.push(input.isActive);
    }

    if (!set.length) {
      return this.findById(businessId, id);
    }

    vals.push(id, businessId);
    set.push("updated_at = NOW()");
    if (updatedBy) {
      set.push(`updated_by = $${i++}`);
      vals.push(updatedBy);
    }

    const res = await query(
      `UPDATE document_templates SET ${set.join(", ")}
       WHERE id = $${i++} AND business_id = $${i}
       RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new Error(`InvoiceTemplate ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const res = await query(
      "DELETE FROM document_templates WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );
    if (res.rowCount === 0) throw new Error(`InvoiceTemplate ${id} not found or access denied`);
  }

  async duplicate(
    businessId: string,
    id: string,
    createdBy?: string | null
  ): Promise<InvoiceTemplate> {
    const original = await this.findById(businessId, id);
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();

    const res = await query(
      `INSERT INTO document_templates
         (id, business_id, name, description, industry, schema_version, revision, version,
          document, html_template, config, is_default, is_active, lifecycle, published_at,
          published_revision, created_at, updated_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$18)
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
        original.htmlTemplate ?? null,
        JSON.stringify(original.config ?? {}),
        false,
        original.isActive,
        "draft",
        null,
        null,
        now,
        createdBy ?? original.createdBy ?? null,
      ]
    );
    return this.rowToModel(res.rows[0]);
  }

  async setDefault(businessId: string, id: string): Promise<InvoiceTemplate> {
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
        throw new Error(`InvoiceTemplate ${id} not found or access denied`);
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

  async publish(
    businessId: string,
    id: string,
    publishedBy?: string | null
  ): Promise<InvoiceTemplate> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        "SELECT * FROM document_templates WHERE id = $1 AND business_id = $2 FOR UPDATE",
        [id, businessId]
      );
      if (!existing.rows.length) {
        throw new Error(`InvoiceTemplate ${id} not found or access denied`);
      }

      const current = existing.rows[0];
      const newRevision = Number(current.revision) + 1;

      const revRes = await client.query(
        `INSERT INTO document_template_revisions
           (template_id, business_id, revision, schema_version, document, html_template, config, change_summary, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [
          id,
          businessId,
          1,
          current.schema_version,
          current.document,
          current.html_template,
          current.config,
          "Initial draft",
          current.created_by,
        ]
      );

      const res = await client.query(
        `UPDATE document_templates
         SET lifecycle = 'published',
             published_at = NOW(),
             published_revision = $3,
             revision = $4,
             version = version + 1,
             updated_at = NOW(),
             updated_by = $5
         WHERE id = $1 AND business_id = $2
         RETURNING *`,
        [id, businessId, newRevision, newRevision, publishedBy ?? null]
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

  async archive(businessId: string, id: string, archivedBy?: string | null): Promise<InvoiceTemplate> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        "SELECT * FROM document_templates WHERE id = $1 AND business_id = $2 FOR UPDATE",
        [id, businessId]
      );
      if (!existing.rows.length) {
        throw new Error(`InvoiceTemplate ${id} not found or access denied`);
      }

      const current = existing.rows[0];
      if (current.lifecycle === "archived") {
        await client.query("ROLLBACK");
        return this.rowToModel(current);
      }

      const oldDefault = current.is_default;

      const res = await client.query(
        `UPDATE document_templates
         SET lifecycle = 'archived',
             archived_at = NOW(),
             version = version + 1,
             updated_at = NOW(),
             updated_by = $3
         WHERE id = $1 AND business_id = $2
         RETURNING *`,
        [id, businessId, archivedBy ?? null]
      );

      if (oldDefault) {
        const existingDefault = await client.query(
          "SELECT id FROM document_templates WHERE business_id = $1 AND is_default = TRUE AND lifecycle = 'published' AND id != $2 LIMIT 1",
          [businessId, id]
        );
        if (!existingDefault.rows.length) {
          const firstPublished = await client.query(
            "SELECT id FROM document_templates WHERE business_id = $1 AND lifecycle = 'published' ORDER BY created_at LIMIT 1",
            [businessId]
          );
          if (firstPublished.rows.length) {
            await client.query(
              "UPDATE document_templates SET is_default = TRUE WHERE id = $1",
              [firstPublished.rows[0].id]
            );
          }
        }
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

  async unarchive(businessId: string, id: string, unarchivedBy?: string | null): Promise<InvoiceTemplate> {
    const res = await query(
      `UPDATE document_templates
       SET lifecycle = 'published',
           archived_at = NULL,
           published_at = COALESCE(published_at, NOW()),
           version = version + 1,
           updated_at = NOW(),
           updated_by = $3
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [id, businessId, unarchivedBy ?? null]
    );
    if (!res.rows.length) throw new Error(`InvoiceTemplate ${id} not found or access denied`);
    return this.rowToModel(res.rows[0]);
  }

  async createRevision(
    businessId: string,
    templateId: string,
    input: InvoiceTemplateRevisionInput,
    createdBy?: string | null
  ): Promise<InvoiceTemplateRevision> {
    const parsed = InvoiceTemplateRevisionInputSchema.parse(input);

    const template = await this.findById(businessId, templateId);
    const nextRevision = template.revision + 1;

    const client = await getClient();
    try {
      await client.query("BEGIN");

      const updateSet: string[] = [];
      const updateVals: unknown[] = [];
      let j = 1;

      if (parsed.document !== undefined) {
        updateSet.push(`document = $${j++}`);
        updateVals.push(JSON.stringify(this.normalizeDocument(parsed.document as Record<string, unknown>)));
      }
      if (parsed.htmlTemplate !== undefined) {
        updateSet.push(`html_template = $${j++}`);
        updateVals.push(parsed.htmlTemplate);
      }
      if (parsed.config !== undefined) {
        updateSet.push(`config = $${j++}`);
        updateVals.push(JSON.stringify(parsed.config));
      }

      updateSet.push(`revision = $${j++}`);
      updateVals.push(nextRevision);
      updateSet.push(`version = version + 1`);
      updateSet.push(`updated_at = NOW()`);
      updateSet.push(`updated_by = $${j++}`);
      updateVals.push(createdBy ?? null);

      if (updateSet.length > 0) {
        updateVals.push(templateId, businessId);
        await client.query(
          `UPDATE document_templates SET ${updateSet.join(", ")}
           WHERE id = $${j++} AND business_id = $${j}`,
          updateVals
        );
      }

      const revRes = await client.query(
        `INSERT INTO document_template_revisions
           (template_id, business_id, revision, schema_version, document, html_template, config, change_summary, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [
          templateId,
          businessId,
          nextRevision,
          template.schemaVersion,
          parsed.document !== undefined ? JSON.stringify(this.normalizeDocument(parsed.document as Record<string, unknown>)) : template.document,
          parsed.htmlTemplate !== undefined ? parsed.htmlTemplate : template.htmlTemplate,
          parsed.config !== undefined ? JSON.stringify(parsed.config) : JSON.stringify(template.config),
          parsed.changeSummary ?? null,
          createdBy ?? null,
        ]
      );

      await client.query("COMMIT");
      return this.rowToRevisionModel(revRes.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async findRevisions(businessId: string, templateId: string): Promise<InvoiceTemplateRevision[]> {
    await this.findById(businessId, templateId);

    const res = await query(
      `SELECT * FROM document_template_revisions
       WHERE template_id = $1 AND business_id = $2
       ORDER BY revision ASC`,
      [templateId, businessId]
    );
    return res.rows.map((r) => this.rowToRevisionModel(r));
  }

  async findRevision(businessId: string, templateId: string, revision: number): Promise<InvoiceTemplateRevision> {
    await this.findById(businessId, templateId);

    const res = await query(
      `SELECT * FROM document_template_revisions
       WHERE template_id = $1 AND business_id = $2 AND revision = $3`,
      [templateId, businessId, revision]
    );
    if (!res.rows.length) throw new Error(`Revision ${revision} not found for template ${templateId}`);
    return this.rowToRevisionModel(res.rows[0]);
  }

  async restoreRevision(
    businessId: string,
    templateId: string,
    revision: number,
    restoredBy?: string | null
  ): Promise<InvoiceTemplate> {
    const rev = await this.findRevision(businessId, templateId, revision);
    const current = await this.findById(businessId, templateId);

    const client = await getClient();
    try {
      await client.query("BEGIN");

      const newRevision = current.revision + 1;

      await client.query(
        `UPDATE document_templates
         SET document = $1,
             html_template = $2,
             config = $3,
             revision = $4,
             version = version + 1,
             updated_at = NOW(),
             updated_by = $5
         WHERE id = $6 AND business_id = $7`,
        [
          JSON.stringify(rev.document),
          rev.htmlTemplate ?? null,
          JSON.stringify(rev.config),
          newRevision,
          restoredBy ?? null,
          templateId,
          businessId,
        ]
      );

      await client.query(
        `INSERT INTO document_template_revisions
           (template_id, business_id, revision, schema_version, document, html_template, config, change_summary, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          templateId,
          businessId,
          newRevision,
          rev.schemaVersion,
          JSON.stringify(rev.document),
          rev.htmlTemplate ?? null,
          JSON.stringify(rev.config),
          `Restored from revision ${revision}`,
          restoredBy ?? null,
        ]
      );

      const res = await client.query(
        "SELECT * FROM document_templates WHERE id = $1 AND business_id = $2",
        [templateId, businessId]
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

  async findByIdWithRevisions(businessId: string, id: string): Promise<InvoiceTemplate & { revisions: InvoiceTemplateRevision[] }> {
    const template = await this.findById(businessId, id);
    const revisions = await this.findRevisions(businessId, id);
    return { ...template, revisions };
  }

  async recordTemplatePermission(
    businessId: string,
    templateId: string,
    userId: string,
    permission: "view" | "edit" | "publish" | "archive"
  ): Promise<void> {
    await query(
      `INSERT INTO invoice_template_permissions
         (business_id, template_id, user_id, permission, granted_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (template_id, user_id, permission) DO NOTHING`,
      [businessId, templateId, userId, permission]
    );
  }

  async getTemplatePermissions(businessId: string, templateId: string): Promise<{ userId: string; permission: string }[]> {
    await this.findById(businessId, templateId);
    const res = await query(
      `SELECT user_id, permission FROM invoice_template_permissions
       WHERE template_id = $1 AND business_id = $2`,
      [templateId, businessId]
    );
    return res.rows.map((r: any) => ({ userId: r.user_id, permission: r.permission }));
  }

  async checkPermission(businessId: string, templateId: string, userId: string, permission: string): Promise<boolean> {
    const res = await query(
      `SELECT 1 FROM invoice_template_permissions
       WHERE template_id = $1 AND business_id = $2 AND user_id = $3 AND permission = $4`,
      [templateId, businessId, userId, permission]
    );
    return res.rows.length > 0;
  }

  async recordUsage(businessId: string, templateId: string, invoiceId?: string | null): Promise<void> {
    await query(
      `INSERT INTO invoice_template_usage
         (business_id, template_id, invoice_id)
       VALUES ($1, $2, $3)`,
      [businessId, templateId, invoiceId ?? null]
    );
  }

  async countTemplateUsage(businessId: string, templateId: string): Promise<number> {
    const res = await query(
      `SELECT COUNT(*) as count FROM invoice_template_usage
       WHERE template_id = $1 AND business_id = $2`,
      [templateId, businessId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  private normalizeDocument(doc: Record<string, unknown>): Record<string, unknown> {
    const d = { ...doc };
    if (!d.settings) {
      d.settings = {
        pageSize: "A4",
        orientation: "portrait",
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
        defaultFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        defaultFontSize: 14,
        defaultColor: "#1f2937",
        currency: "USD",
        locale: "en-US",
      };
    }
    return d;
  }

  private rowToModel(r: Record<string, unknown>): InvoiceTemplate {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      description: r.description as string | null | undefined,
      industry: r.industry as string | null | undefined,
      schemaVersion: (r.schema_version as string) ?? "1.0",
      revision: Number(r.revision ?? 1),
      version: Number(r.version ?? 1),
      document: (r.document as Record<string, unknown>) ?? {},
      htmlTemplate: r.html_template as string | null | undefined,
      config: (r.config as Record<string, unknown>) ?? {},
      isDefault: Boolean(r.is_default),
      isActive: Boolean(r.is_active),
      lifecycle: (r.lifecycle as string) ?? "draft",
      publishedAt: r.published_at ? new Date(r.published_at as string) : null,
      archivedAt: r.archived_at ? new Date(r.archived_at as string) : null,
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
      createdBy: r.created_by as string | null | undefined,
      updatedBy: r.updated_by as string | null | undefined,
    };
  }

  private rowToRevisionModel(r: Record<string, unknown>): InvoiceTemplateRevision {
    return {
      id: r.id as string,
      templateId: r.template_id as string,
      businessId: r.business_id as string,
      revision: Number(r.revision),
      schemaVersion: (r.schema_version as string) ?? "1.0",
      document: (r.document as Record<string, unknown>) ?? {},
      htmlTemplate: r.html_template as string | null | undefined,
      config: (r.config as Record<string, unknown>) ?? {},
      changeSummary: r.change_summary as string | null | undefined,
      createdAt: new Date(r.created_at as string),
      createdBy: r.created_by as string | null | undefined,
    };
  }
}

export const invoiceTemplateRepository = new InvoiceTemplateRepository();
