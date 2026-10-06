import { describe, it, expect, beforeEach } from "vitest";
import { query } from "../src/db/pool.js";
import { invoiceService } from "../src/services/invoice-service.js";
import { invoiceAttachmentRepository } from "../src/repositories/invoice-attachment.repo.js";
import { truncateTestDb, createTestBusiness, createTestCustomer } from "./helpers/db.js";
import { StubSmsProvider, buildPaymentLinkSms } from "../src/services/sms/sms-service.js";
import { BusinessLogicError } from "../src/domain/errors.js";

describe("Invoice attachments", () => {
  let businessId: string;
  let userId: string;

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
    userId = biz.ownerId;
  }, 60000);

  it("persists attachments and returns them grouped by category", async () => {
    const invoiceId = await invoiceService.createDraft({ currency: "USD" }, businessId, userId);

    await invoiceService.setAttachments(
      businessId,
      invoiceId,
      [
        { name: "site.jpg", size: 1024, type: "image/jpeg", category: "before", dataUrl: "data:image/jpeg;base64,AAA" },
        { name: "done.jpg", size: 2048, type: "image/jpeg", category: "after", dataUrl: "data:image/jpeg;base64,BBB" },
        { name: "permit.pdf", size: 512, type: "application/pdf", category: "attachment", dataUrl: null },
      ],
      userId
    );

    const summary = await invoiceService.getInvoice(businessId, invoiceId);
    expect(summary.attachments).toHaveLength(3);
    expect(summary.attachments.filter((a) => a.category === "before")).toHaveLength(1);
    expect(summary.attachments.filter((a) => a.category === "after")).toHaveLength(1);
    expect(summary.attachments.filter((a) => a.category === "attachment")).toHaveLength(1);
    expect(summary.attachments[0].name).toBe("site.jpg");
    expect(summary.attachments[0].dataUrl).toBe("data:image/jpeg;base64,AAA");
    expect(summary.attachments[0].size).toBe(1024);
  });

  it("replaces the full attachment set on update", async () => {
    const invoiceId = await invoiceService.createDraft({ currency: "USD" }, businessId, userId);

    await invoiceService.setAttachments(
      businessId,
      invoiceId,
      [{ name: "old.jpg", size: 10, type: "image/jpeg", category: "before", dataUrl: null }],
      userId
    );
    await invoiceService.setAttachments(
      businessId,
      invoiceId,
      [{ name: "new.jpg", size: 20, type: "image/jpeg", category: "after", dataUrl: null }],
      userId
    );

    const rows = await invoiceAttachmentRepository.listByInvoice(businessId, invoiceId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("new.jpg");
    expect(rows[0].category).toBe("after");
  });

  it("rejects attachment changes on a finalized invoice", async () => {
    const customerId = await createTestCustomer(businessId, "Attachment Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          { description: "Service", quantity: 1, unit: "hour", unitPrice: 100, discount: 0, discountType: "fixed", taxRate: 0, isTaxInclusive: false },
        ],
      },
      businessId,
      userId
    );
    await invoiceService.setAttachments(
      businessId,
      invoiceId,
      [{ name: "draft.jpg", size: 10, type: "image/jpeg", category: "before", dataUrl: null }],
      userId
    );
    await invoiceService.finalize(businessId, invoiceId, userId);

    await expect(
      invoiceService.setAttachments(
        businessId,
        invoiceId,
        [{ name: "tamper.jpg", size: 10, type: "image/jpeg", category: "before", dataUrl: null }],
        userId
      )
    ).rejects.toBeInstanceOf(BusinessLogicError);

    // Original attachment survives the rejected mutation.
    const rows = await invoiceAttachmentRepository.listByInvoice(businessId, invoiceId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("draft.jpg");
  });

  it("captures attachment metadata in the finalize snapshot", async () => {
    const customerId = await createTestCustomer(businessId, "Snapshot Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          { description: "Service", quantity: 1, unit: "hour", unitPrice: 250, discount: 0, discountType: "fixed", taxRate: 0, isTaxInclusive: false },
        ],
      },
      businessId,
      userId
    );
    await invoiceService.setAttachments(
      businessId,
      invoiceId,
      [
        { name: "before.jpg", size: 100, type: "image/jpeg", category: "before", dataUrl: null },
        { name: "permit.pdf", size: 200, type: "application/pdf", category: "attachment", dataUrl: null },
      ],
      userId
    );
    await invoiceService.finalize(businessId, invoiceId, userId);

    const { rows } = await query(
      `SELECT snapshot FROM invoice_snapshots WHERE invoice_id = $1`,
      [invoiceId]
    );
    expect(rows).toHaveLength(1);
    const attachments = (rows[0].snapshot as any).attachments;
    expect(Array.isArray(attachments)).toBe(true);
    expect(attachments).toHaveLength(2);
    expect(attachments.map((a: any) => a.name).sort()).toEqual(["before.jpg", "permit.pdf"]);
    expect(attachments[0]).toHaveProperty("category");
    expect(attachments[0]).toHaveProperty("size");
    // Data URLs are intentionally excluded from the snapshot payload.
    expect(attachments[0]).not.toHaveProperty("dataUrl");
  });

  it("exposes attachments on the public invoice view", async () => {
    const customerId = await createTestCustomer(businessId, "Public Customer");
    const invoiceId = await invoiceService.createDraft(
      {
        customerId,
        currency: "USD",
        issueDate: new Date(),
        items: [
          { description: "Service", quantity: 1, unit: "hour", unitPrice: 150, discount: 0, discountType: "fixed", taxRate: 0, isTaxInclusive: false },
        ],
      },
      businessId,
      userId
    );
    await invoiceService.setAttachments(
      businessId,
      invoiceId,
      [{ name: "receipt.jpg", size: 300, type: "image/jpeg", category: "after", dataUrl: "data:image/jpeg;base64,CCC" }],
      userId
    );
    await invoiceService.finalize(businessId, invoiceId, userId);
    await query(`UPDATE invoices SET public_token = 'pub-token-${invoiceId}' WHERE id = $1`, [invoiceId]);

    const pub = await invoiceService.getPublicInvoice(`pub-token-${invoiceId}`);
    expect(pub.attachments).toHaveLength(1);
    expect(pub.attachments[0].name).toBe("receipt.jpg");
    expect(pub.attachments[0].category).toBe("after");
    expect(pub.attachments[0].dataUrl).toBe("data:image/jpeg;base64,CCC");
  });
});

describe("SMS service", () => {
  it("builds a payment-link SMS body", () => {
    const message = buildPaymentLinkSms({
      businessName: "Acme Plumbing",
      invoiceNumber: "INV-2026-000001",
      amountDue: "150.00",
      currency: "USD",
      paymentUrl: "https://app.example.com/invoice/abc123",
    });
    expect(message).toContain("Acme Plumbing");
    expect(message).toContain("INV-2026-000001");
    expect(message).toContain("USD 150.00");
    expect(message).toContain("https://app.example.com/invoice/abc123");
  });

  it("stub provider logs and reports sent", async () => {
    const provider = new StubSmsProvider();
    const result = await provider.send({ to: "+15551234567", message: "test" });
    expect(result.status).toBe("sent");
    expect(result.messageId).toContain("stub-sms");
  });
});
