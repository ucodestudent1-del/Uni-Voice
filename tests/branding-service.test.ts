import { describe, it, expect, beforeEach } from "vitest";
import { brandingService } from "../src/services/branding-service.js";
import { truncateTestDb, createTestBusiness } from "./helpers/db.js";

describe("BrandingService", () => {
  let businessId: string;

  beforeEach(async () => {
    await truncateTestDb();
    const biz = await createTestBusiness();
    businessId = biz.id;
  });

  describe("get", () => {
    it("returns default branding when none exists", async () => {
      const branding = await brandingService.get(businessId);

      expect(branding.businessId).toBe(businessId);
      expect(branding.primaryColor).toBe("#2563eb");
      expect(branding.secondaryColor).toBe("#64748b");
      expect(branding.showLogo).toBe(true);
      expect(branding.showPageNumbers).toBe(true);
      expect(branding.showQrCode).toBe(false);
      expect(branding.pdfPageSize).toBe("A4");
    });
  });

  describe("update", () => {
    it("sets branding for a business", async () => {
      const updated = await brandingService.update(businessId, {
        primaryColor: "#ff0000",
        secondaryColor: "#00ff00",
        invoiceTitle: "Proforma Invoice",
        footerText: "Thank you for your business!",
      });

      expect(updated.primaryColor).toBe("#ff0000");
      expect(updated.secondaryColor).toBe("#00ff00");
      expect(updated.invoiceTitle).toBe("Proforma Invoice");
      expect(updated.footerText).toBe("Thank you for your business!");
    });

    it("persists branding across retrievals", async () => {
      await brandingService.update(businessId, {
        primaryColor: "#aabbcc",
        logoUrl: "https://example.com/logo.png",
        logoWidthPx: 200,
        logoHeightPx: 100,
      });

      const branding = await brandingService.get(businessId);

      expect(branding.primaryColor).toBe("#aabbcc");
      expect(branding.logoUrl).toBe("https://example.com/logo.png");
      expect(branding.logoWidthPx).toBe(200);
      expect(branding.logoHeightPx).toBe(100);
    });

    it("updates boolean settings", async () => {
      const updated = await brandingService.update(businessId, {
        showLogo: false,
        showPageNumbers: false,
        showQrCode: true,
      });

      expect(updated.showLogo).toBe(false);
      expect(updated.showPageNumbers).toBe(false);
      expect(updated.showQrCode).toBe(true);
    });

    it("updates PDF page size and margins", async () => {
      const updated = await brandingService.update(businessId, {
        pdfPageSize: "Letter",
        pdfMarginTopMm: 20,
        pdfMarginRightMm: 15,
        pdfMarginBottomMm: 20,
        pdfMarginLeftMm: 15,
      });

      expect(updated.pdfPageSize).toBe("Letter");
      expect(updated.pdfMarginTopMm).toBe(20);
      expect(updated.pdfMarginRightMm).toBe(15);
      expect(updated.pdfMarginBottomMm).toBe(20);
      expect(updated.pdfMarginLeftMm).toBe(15);
    });
  });

  describe("generatePreviewHtml", () => {
    it("generates HTML preview with overridden settings", async () => {
      const html = await brandingService.generatePreviewHtml(businessId, {
        primaryColor: "#ff0000",
        invoiceTitle: "Preview Invoice",
      });

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("--primary-color: #ff0000");
      expect(html).toContain("Preview Invoice");
    });

    it("uses stored branding when no override provided", async () => {
      await brandingService.update(businessId, {
        primaryColor: "#0000ff",
        invoiceTitle: "Stored Invoice",
      });

      const html = await brandingService.generatePreviewHtml(businessId, {});

      expect(html).toContain("--primary-color: #0000ff");
      expect(html).toContain("Stored Invoice");
    });
  });
});
