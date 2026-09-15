import type { InvoiceTemplateDocument } from "../../domain/schemas/invoice-template.js";
import {
  INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION,
  INVOICE_TEMPLATE_SCHEMA_VERSIONS,
} from "../../domain/schemas/invoice-template.js";
import { query } from "../../db/pool.js";
import { logger } from "../../utils/logger.js";

export interface TemplateMigration {
  fromVersion: string;
  toVersion: string;
  migrate: (document: InvoiceTemplateDocument) => InvoiceTemplateDocument;
}

export interface TemplateMigrationRecord {
  id: string;
  businessId: string;
  templateId: string;
  fromVersion: string;
  toVersion: string;
  migratedAt: Date;
  migratedBy: string | null;
  migrationData: Record<string, unknown> | null;
}

class TemplateMigrationEngine {
  private migrations: TemplateMigration[] = [];

  register(migration: TemplateMigration): void {
    if (this.migrations.some((m) => m.fromVersion === migration.fromVersion && m.toVersion === migration.toVersion)) {
      logger.warn(`Migration from ${migration.fromVersion} to ${migration.toVersion} already registered, skipping`);
      return;
    }
    this.migrations.push(migration);
    logger.info(`Registered template migration: ${migration.fromVersion} -> ${migration.toVersion}`);
  }

  listVersions(): string[] {
    return [...INVOICE_TEMPLATE_SCHEMA_VERSIONS];
  }

  currentVersion(): string {
    return INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION;
  }

  getMigrationPath(fromVersion: string, toVersion: string): TemplateMigration[] {
    if (fromVersion === toVersion) return [];

    const path: TemplateMigration[] = [];
    let current = fromVersion;

    const maxIterations = this.migrations.length + 10;
    let iter = 0;

    while (current !== toVersion && iter < maxIterations) {
      iter++;
      const migration = this.migrations.find((m) => m.fromVersion === current);
      if (!migration) {
        break;
      }
      path.push(migration);
      current = migration.toVersion;
    }

    if (current !== toVersion) {
      throw new Error(
        `Cannot migrate template from ${fromVersion} to ${toVersion}: no migration path found (stopped at ${current})`
      );
    }

    return path;
  }

  migrate(
    document: InvoiceTemplateDocument,
    fromVersion: string,
    toVersion: string,
    businessId: string,
    templateId: string,
    migratedBy?: string | null
  ): Promise<{ document: InvoiceTemplateDocument; migrations: TemplateMigration[] }> {
    if (fromVersion === toVersion) {
      return Promise.resolve({ document, migrations: [] });
    }

    const path = this.getMigrationPath(fromVersion, toVersion);
    let migrated: Record<string, unknown> = { ...document as unknown as Record<string, unknown> };

    for (const m of path) {
      migrated = m.migrate(migrated as unknown as InvoiceTemplateDocument) as unknown as Record<string, unknown>;
      migrated.version = (migrated.version as number | undefined) ?? 1 + 1;
    }

    this.recordMigration(
      businessId,
      templateId,
      fromVersion,
      toVersion,
      migratedBy ?? null,
      path.length
    ).catch((err) => {
      logger.error({ err, templateId, businessId }, "Failed to record template migration");
    });

    return Promise.resolve({
      document: migrated as InvoiceTemplateDocument,
      migrations: path,
    });
  }

  async ensureLatest(document: InvoiceTemplateDocument): Promise<InvoiceTemplateDocument> {
    const docVersion = (document as Record<string, unknown>).schemaVersion as string | undefined;
    if (!docVersion || docVersion === INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION) {
      return document;
    }
    const result = await this.migrate(
      document,
      docVersion,
      INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION,
      document.businessId,
      document.id
    );
    return result.document;
  }

  private async recordMigration(
    businessId: string,
    templateId: string,
    fromVersion: string,
    toVersion: string,
    migratedBy: string | null,
    steps: number
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO invoice_template_migrations
          (business_id, template_id, from_version, to_version, migrated_by, migration_data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          businessId,
          templateId,
          fromVersion,
          toVersion,
          migratedBy,
          JSON.stringify({ steps }),
        ]
      );
    } catch (err) {
      logger.error({ err }, "Failed to record template migration row");
    }
  }

  async getMigrationHistory(businessId: string, templateId?: string): Promise<TemplateMigrationRecord[]> {
    const vals: unknown[] = [businessId];
    let sql = `SELECT id, business_id, template_id, from_version, to_version, migrated_at, migrated_by, migration_data
               FROM invoice_template_migrations
               WHERE business_id = $1`;

    if (templateId) {
      vals.push(templateId);
      sql += ` AND template_id = $${vals.length}`;
    }

    sql += ` ORDER BY migrated_at DESC`;

    const res = await query(sql, vals);
    return res.rows.map((r: any) => ({
      id: r.id,
      businessId: r.business_id,
      templateId: r.template_id,
      fromVersion: r.from_version,
      toVersion: r.to_version,
      migratedAt: r.migrated_at,
      migratedBy: r.migrated_by,
      migrationData: r.migration_data,
    }));
  }
}

export const templateMigrationEngine = new TemplateMigrationEngine();
