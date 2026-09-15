import { describe, it, expect, beforeEach } from "vitest";
import { invoiceTemplateRepository } from "../src/repositories/invoice-template.repo.js";
import { invoiceTemplateService } from "../src/services/templates/invoice-template-service.js";
import { resetTestDb, createTestBusiness } from "./helpers/db.js";

const BUSINESS_A = "00000000-0000-0000-0000-000000000001";
const BUSINESS_B = "00000000-0000-0000-0000-000000000002";
const USER_A = "11111111-1111-1111-1111-111111111111";

const sampleDocument = {
  id: "doc_1",
  version: 1,
  name: "Test Invoice",
  businessId: BUSINESS_A,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  sections: {
    "root_section": {
      id: "root_section",
      type: "section",
      props: { name: "Main", fullWidth: true },
      style: {},
      children: ["row_1"],
    },
  },
  rows: {
    "row_1": {
      id: "row_1",
      type: "row",
      props: { name: "Header", columns: 2, columnGap: 16, rowGap: 16 },
      style: {},
      children: ["col_1", "col_2"],
    },
  },
  columns: {
    "col_1": {
      id: "col_1",
      type: "column",
      props: { name: "Left", span: 6 },
      style: {},
      children: [],
    },
    "col_2": {
      id: "col_2",
      type: "column",
      props: { name: "Right", span: 6 },
      style: {},
      children: [],
    },
  },
  components: {},
  rootSectionId: "root_section",
  settings: {
    pageSize: "A4",
    orientation: "portrait",
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    defaultFont: "system-ui",
    defaultFontSize: 14,
    defaultColor: "#1f2937",
    currency: "USD",
    locale: "en-US",
  },
};

describe("InvoiceTemplateRepository (DB integration)", () => {
  beforeEach(async () => {
    await resetTestDb();
    await createTestBusiness({ id: BUSINESS_A, ownerId: USER_A });
    await createTestBusiness({ id: BUSINESS_B, ownerId: USER_A });
  });

  describe("create / findById", () => {
    it("creates a template with draft lifecycle by default", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "My Template",
        document: sampleDocument,
      }, USER_A);

      expect(created.id).toBeTruthy();
      expect(created.businessId).toBe(BUSINESS_A);
      expect(created.name).toBe("My Template");
      expect(created.revision).toBe(1);
      expect(created.version).toBe(1);
      expect(created.lifecycle).toBe("draft");
      expect(created.isDefault).toBe(false);
      expect(created.isActive).toBe(true);
      expect(created.publishedAt).toBeNull();
      expect(created.archivedAt).toBeNull();
    });

    it("retrieves a template by id", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Test Template",
        document: sampleDocument,
      }, USER_A);

      const found = await invoiceTemplateRepository.findById(BUSINESS_A, created.id);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe("Test Template");
    });

    it("throws when template does not exist", async () => {
      await expect(
        invoiceTemplateRepository.findById(BUSINESS_A, "00000000-0000-0000-0000-000000009999")
      ).rejects.toThrow("not found or access denied");
    });

    it("prevents tenant isolation (business A cannot see business B templates)", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_B, {
        name: "B Template",
        document: sampleDocument,
      }, USER_A);

      await expect(
        invoiceTemplateRepository.findById(BUSINESS_A, created.id)
      ).rejects.toThrow("not found or access denied");
    });
  });

  describe("findMany", () => {
    it("lists all templates for a business", async () => {
      await invoiceTemplateRepository.create(BUSINESS_A, { name: "T1", document: sampleDocument });
      await invoiceTemplateRepository.create(BUSINESS_A, { name: "T2", document: sampleDocument });

      const templates = await invoiceTemplateRepository.findMany(BUSINESS_A);
      expect(templates).toHaveLength(2);
    });

    it("filters by lifecycle", async () => {
      await invoiceTemplateRepository.create(BUSINESS_A, { name: "Draft", document: sampleDocument });
      const published = await invoiceTemplateRepository.create(BUSINESS_A, { name: "Pub", document: sampleDocument });
      await invoiceTemplateRepository.publish(BUSINESS_A, published.id, USER_A);

      const drafts = await invoiceTemplateRepository.findMany(BUSINESS_A, { lifecycle: "draft" });
      expect(drafts).toHaveLength(1);
      expect(drafts[0].lifecycle).toBe("draft");

      const publishedTemplates = await invoiceTemplateRepository.findMany(BUSINESS_A, { lifecycle: "published" });
      expect(publishedTemplates).toHaveLength(1);
      expect(publishedTemplates[0].lifecycle).toBe("published");

      const multi = await invoiceTemplateRepository.findMany(BUSINESS_A, { lifecycle: ["draft", "published"] });
      expect(multi).toHaveLength(2);
    });

    it("filters by industry", async () => {
      await invoiceTemplateRepository.create(BUSINESS_A, { name: "Retail", industry: "retail", document: sampleDocument });
      await invoiceTemplateRepository.create(BUSINESS_A, { name: "Legal", industry: "legal", document: sampleDocument });

      const retail = await invoiceTemplateRepository.findMany(BUSINESS_A, { industry: "retail" });
      expect(retail).toHaveLength(1);
      expect(retail[0].industry).toBe("retail");
    });

    it("only returns published templates in default lookup", async () => {
      await invoiceTemplateRepository.create(BUSINESS_A, { name: "Draft Default", document: sampleDocument, isDefault: true });
      const published = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Published Default",
        document: sampleDocument,
        isDefault: true,
      });
      await invoiceTemplateRepository.publish(BUSINESS_A, published.id, USER_A);

      const defaultTemplate = await invoiceTemplateRepository.findDefault(BUSINESS_A);
      expect(defaultTemplate).not.toBeNull();
      expect(defaultTemplate!.lifecycle).toBe("published");
    });
  });

  describe("publish lifecycle", () => {
    it("transitions template from draft to published", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Lifecycle Test",
        document: sampleDocument,
      }, USER_A);

      const published = await invoiceTemplateRepository.publish(BUSINESS_A, created.id, USER_A);
      expect(published.lifecycle).toBe("published");
      expect(published.publishedAt).not.toBeNull();
      expect(published.publishedRevision).toBe(1);
    });

    it("throws when publishing an archived template", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Archive Test",
        document: sampleDocument,
      }, USER_A);

      await invoiceTemplateRepository.archive(BUSINESS_A, created.id, USER_A);

      await expect(
        invoiceTemplateService.publish(BUSINESS_A, created.id, undefined, USER_A)
      ).rejects.toThrow("Cannot publish an archived template");
    });

    it("archives a published template", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Archive Test",
        document: sampleDocument,
      }, USER_A);

      await invoiceTemplateRepository.publish(BUSINESS_A, created.id, USER_A);
      const archived = await invoiceTemplateRepository.archive(BUSINESS_A, created.id, USER_A);
      expect(archived.lifecycle).toBe("archived");
      expect(archived.archivedAt).not.toBeNull();
    });

    it("cannot archive the default template", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Default Template",
        document: sampleDocument,
        isDefault: true,
      }, USER_A);

      await invoiceTemplateRepository.publish(BUSINESS_A, created.id, USER_A);

      await expect(
        invoiceTemplateService.archive(BUSINESS_A, created.id, USER_A)
      ).rejects.toThrow("Cannot archive the default template");
    });

    it("unarchives a template", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Unarchive Test",
        document: sampleDocument,
      }, USER_A);

      await invoiceTemplateRepository.publish(BUSINESS_A, created.id, USER_A);
      await invoiceTemplateRepository.archive(BUSINESS_A, created.id, USER_A);

      const unarchived = await invoiceTemplateRepository.unarchive(BUSINESS_A, created.id, USER_A);
      expect(unarchived.lifecycle).toBe("published");
      expect(unarchived.archivedAt).toBeNull();
    });
  });

  describe("revision management", () => {
    it("creates a revision with incremented revision number", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Revision Test",
        document: sampleDocument,
      }, USER_A);

      await invoiceTemplateRepository.publish(BUSINESS_A, created.id, USER_A);

      const newDoc = { ...sampleDocument, name: "Updated" };
      const rev = await invoiceTemplateRepository.createRevision(
        BUSINESS_A,
        created.id,
        { document: newDoc, changeSummary: "Updated name" },
        USER_A
      );

      expect(rev.revision).toBe(2);
      expect(rev.templateId).toBe(created.id);
      expect(rev.document).toEqual(newDoc);
      expect(rev.changeSummary).toBe("Updated name");
    });

    it("lists revisions in order", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Revision List Test",
        document: sampleDocument,
      }, USER_A);

      await invoiceTemplateRepository.publish(BUSINESS_A, created.id, USER_A);
      const newDoc = { ...sampleDocument, name: "Updated" };
      await invoiceTemplateRepository.createRevision(
        BUSINESS_A,
        created.id,
        { document: newDoc, changeSummary: "Updated" },
        USER_A
      );

      const revisions = await invoiceTemplateRepository.findRevisions(BUSINESS_A, created.id);
      expect(revisions).toHaveLength(2);
      expect(revisions[0].revision).toBe(1);
      expect(revisions[1].revision).toBe(2);
    });

    it("restores a previous revision", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Restore Test",
        document: sampleDocument,
      }, USER_A);

      await invoiceTemplateRepository.publish(BUSINESS_A, created.id, USER_A);
      const newDoc = { ...sampleDocument, name: "Modified Name" };
      await invoiceTemplateRepository.createRevision(
        BUSINESS_A,
        created.id,
        { document: newDoc, changeSummary: "Modified" },
        USER_A
      );

      const restored = await invoiceTemplateRepository.restoreRevision(BUSINESS_A, created.id, 1, USER_A);
      expect(restored.revision).toBe(2);
    });
  });

  describe("service layer", () => {
    it("create + get template flow works", async () => {
      const created = await invoiceTemplateService.create(
        BUSINESS_A,
        {
          name: "Service Template",
          document: sampleDocument,
        },
        USER_A
      );

      const found = await invoiceTemplateService.getTemplate(BUSINESS_A, created.id);
      expect(found.name).toBe("Service Template");
    });

    it("publish via service", async () => {
      const created = await invoiceTemplateService.create(
        BUSINESS_A,
        {
          name: "Publish Flow",
          document: sampleDocument,
        },
        USER_A
      );

      const published = await invoiceTemplateService.publish(BUSINESS_A, created.id, undefined, USER_A);
      expect(published.lifecycle).toBe("published");
    });

    it("archive via service", async () => {
      const created = await invoiceTemplateService.create(
        BUSINESS_A,
        {
          name: "Archive Flow",
          document: sampleDocument,
        },
        USER_A
      );

      await invoiceTemplateService.publish(BUSINESS_A, created.id, undefined, USER_A);

      const nonDefaultCreated = await invoiceTemplateService.create(
        BUSINESS_A,
        {
          name: "Another Template",
          document: sampleDocument,
        },
        USER_A
      );
      const nonDefault = await invoiceTemplateService.setDefault(BUSINESS_A, nonDefaultCreated.id);
      await invoiceTemplateService.publish(BUSINESS_A, nonDefault.id, undefined, USER_A);

      const archived = await invoiceTemplateService.archive(BUSINESS_A, created.id, USER_A);
      expect(archived.lifecycle).toBe("archived");
    });
  });

  describe("permissions", () => {
    it("records and retrieves permissions", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Perm Test",
        document: sampleDocument,
      }, USER_A);

      await invoiceTemplateRepository.recordTemplatePermission(BUSINESS_A, created.id, USER_A, "edit");
      const perms = await invoiceTemplateRepository.getTemplatePermissions(BUSINESS_A, created.id);
      expect(perms).toHaveLength(1);
      expect(perms[0].userId).toBe(USER_A);
      expect(perms[0].permission).toBe("edit");
    });

    it("checks permission", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Perm Check",
        document: sampleDocument,
      }, USER_A);

      await invoiceTemplateRepository.recordTemplatePermission(BUSINESS_A, created.id, USER_A, "publish");
      const hasPerm = await invoiceTemplateRepository.checkPermission(BUSINESS_A, created.id, USER_A, "publish");
      expect(hasPerm).toBe(true);

      const noPerm = await invoiceTemplateRepository.checkPermission(BUSINESS_A, created.id, USER_A, "archive");
      expect(noPerm).toBe(false);
    });
  });

  describe("usage tracking", () => {
    it("records and counts usage", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Usage Test",
        document: sampleDocument,
      }, USER_A);

      await invoiceTemplateRepository.recordUsage(BUSINESS_A, created.id);
      await invoiceTemplateRepository.recordUsage(BUSINESS_A, created.id, "invoice-123");
      const count = await invoiceTemplateRepository.countTemplateUsage(BUSINESS_A, created.id);
      expect(count).toBe(2);
    });
  });

  describe("duplicate", () => {
    it("creates a copy with draft lifecycle", async () => {
      const created = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "Original",
        industry: "retail",
        document: sampleDocument,
        config: { foo: "bar" },
      }, USER_A);

      const copy = await invoiceTemplateRepository.duplicate(BUSINESS_A, created.id, USER_A);
      expect(copy.id).not.toBe(created.id);
      expect(copy.name).toBe("Original (Copy)");
      expect(copy.lifecycle).toBe("draft");
      expect(copy.isDefault).toBe(false);
      expect(copy.industry).toBe("retail");
    });
  });

  describe("setDefault", () => {
    it("sets a template as default and clears previous defaults", async () => {
      const t1 = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "T1", document: sampleDocument, isDefault: true,
      }, USER_A);
      const t2 = await invoiceTemplateRepository.create(BUSINESS_A, {
        name: "T2", document: sampleDocument,
      }, USER_A);

      const updated = await invoiceTemplateRepository.setDefault(BUSINESS_A, t2.id);
      expect(updated.isDefault).toBe(true);

      const t1Refreshed = await invoiceTemplateRepository.findById(BUSINESS_A, t1.id);
      expect(t1Refreshed.isDefault).toBe(false);
    });
  });
});
