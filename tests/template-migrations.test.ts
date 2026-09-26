import { describe, it, expect } from "vitest";
import { templateMigrationEngine } from "../src/services/templates/migrations.js";
import { INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION } from "../src/domain/schemas/invoice-template.js";
import type { InvoiceTemplateDocument } from "../src/domain/schemas/invoice-template.js";

describe("TemplateMigrationEngine", () => {
  it("returns current version", () => {
    expect(templateMigrationEngine.currentVersion()).toBe(INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION);
  });

  it("returns supported versions", () => {
    const versions = templateMigrationEngine.listVersions();
    expect(versions).toContain("1.0");
  });

  it("returns empty migration path for same version", () => {
    const path = templateMigrationEngine.getMigrationPath("1.0", "1.0");
    expect(path).toHaveLength(0);
  });

  it("throws when no migration path exists", () => {
    expect(() => templateMigrationEngine.getMigrationPath("1.0", "2.0")).toThrow(
      "Cannot migrate template from 1.0 to 2.0"
    );
  });

  it("registers and uses migrations", async () => {
    const testMigration = {
      fromVersion: "1.0",
      toVersion: "1.1",
      migrate: (doc: InvoiceTemplateDocument) => ({
        ...doc,
        version: doc.version + 1,
        schemaVersion: "1.1",
        extraField: "added",
      }),
    };

    templateMigrationEngine.register(testMigration as any);

    const path = templateMigrationEngine.getMigrationPath("1.0", "1.1");
    expect(path).toHaveLength(1);
    expect(path[0].fromVersion).toBe("1.0");
    expect(path[0].toVersion).toBe("1.1");

    const doc = {
      id: "test",
      version: 1,
      name: "Test",
      businessId: "00000000-0000-0000-0000-000000000001",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      sections: {},
      rows: {},
      columns: {},
      components: {},
      rootSectionId: "root",
      settings: {
        pageSize: "A4",
        orientation: "portrait",
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        defaultFont: "test",
        defaultFontSize: 12,
        defaultColor: "#000",
        currency: "USD",
        locale: "en-US",
      },
    };

    const result = await templateMigrationEngine.migrate(
      doc as InvoiceTemplateDocument,
      "1.0",
      "1.1",
      "00000000-0000-0000-0000-000000000001",
      "template_1"
    );

    expect(result.migrations).toHaveLength(1);
    expect(result.document.schemaVersion).toBe("1.1");
    expect(result.document.version).toBe(2);
  });

  it("handles chained migrations", async () => {
    const m1 = {
      fromVersion: "1.0",
      toVersion: "1.1",
      migrate: (doc: InvoiceTemplateDocument) => ({ ...doc, step: 1 }),
    };
    const m2 = {
      fromVersion: "1.1",
      toVersion: "1.2",
      migrate: (doc: InvoiceTemplateDocument) => ({ ...doc, step: 2 }),
    };

    templateMigrationEngine.register(m1 as any);
    templateMigrationEngine.register(m2 as any);

    const path = templateMigrationEngine.getMigrationPath("1.0", "1.2");
    expect(path).toHaveLength(2);
  });

    it("does not register duplicate migrations", () => {
    const migration = {
      fromVersion: "9.0",
      toVersion: "9.1",
      migrate: (doc: InvoiceTemplateDocument) => doc,
    };
    templateMigrationEngine.register(migration as any);

    expect(() => {
      templateMigrationEngine.register(migration as any);
    }).not.toThrow();

    const path = templateMigrationEngine.getMigrationPath("9.0", "9.1");
    expect(path).toHaveLength(1);
  });
});
