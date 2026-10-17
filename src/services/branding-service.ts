import { query } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { type BrandingInput } from "../domain/schemas/branding.js";

export interface BrandingSettings {
  businessId: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string | null;
  logoUrl: string | null;
  logoWidthPx: number | null;
  logoHeightPx: number | null;
  invoiceTitle: string | null;
  invoiceSubtitle: string | null;
  footerText: string | null;
  showLogo: boolean;
  showPageNumbers: boolean;
  showQrCode: boolean;
  pdfPageSize: string;
  pdfMarginTopMm: number;
  pdfMarginRightMm: number;
  pdfMarginBottomMm: number;
  pdfMarginLeftMm: number;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_BRANDING: Omit<BrandingSettings, "businessId" | "createdAt" | "updatedAt"> = {
  primaryColor: "#2563eb",
  secondaryColor: "#64748b",
  fontFamily: null,
  logoUrl: null,
  logoWidthPx: null,
  logoHeightPx: null,
  invoiceTitle: null,
  invoiceSubtitle: null,
  footerText: null,
  showLogo: true,
  showPageNumbers: true,
  showQrCode: false,
  pdfPageSize: "A4",
  pdfMarginTopMm: 24,
  pdfMarginRightMm: 24,
  pdfMarginBottomMm: 24,
  pdfMarginLeftMm: 24,
};

export class BrandingService {
  async get(businessId: string): Promise<BrandingSettings> {
    const result = await query(
      `SELECT * FROM business_branding WHERE business_id = $1`,
      [businessId],
    );

    if (!result.rows.length) {
      return {
        businessId,
        ...DEFAULT_BRANDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const row = result.rows[0];
    return this.mapRow(row);
  }

  async update(businessId: string, input: BrandingInput): Promise<BrandingSettings> {
    const columns: string[] = ["business_id"];
    const valueParams: string[] = ["$1"];
    const setClauses: string[] = [];
    const values: unknown[] = [businessId];
    let paramIdx = 2;

    const inputValues: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input)) {
      if (val !== undefined) {
        inputValues[key] = val;
      }
    }

    const allFields = [
      { key: "primaryColor", col: "primary_color", default: DEFAULT_BRANDING.primaryColor },
      { key: "secondaryColor", col: "secondary_color", default: DEFAULT_BRANDING.secondaryColor },
      { key: "fontFamily", col: "font_family", default: null },
      { key: "logoUrl", col: "logo_url", default: null },
      { key: "logoWidthPx", col: "logo_width_px", default: null },
      { key: "logoHeightPx", col: "logo_height_px", default: null },
      { key: "invoiceTitle", col: "invoice_title", default: null },
      { key: "invoiceSubtitle", col: "invoice_subtitle", default: null },
      { key: "footerText", col: "footer_text", default: null },
      { key: "showLogo", col: "show_logo", default: true },
      { key: "showPageNumbers", col: "show_page_numbers", default: true },
      { key: "showQrCode", col: "show_qr_code", default: false },
      { key: "pdfPageSize", col: "pdf_page_size", default: DEFAULT_BRANDING.pdfPageSize },
      { key: "pdfMarginTopMm", col: "pdf_margin_top_mm", default: DEFAULT_BRANDING.pdfMarginTopMm },
      { key: "pdfMarginRightMm", col: "pdf_margin_right_mm", default: DEFAULT_BRANDING.pdfMarginRightMm },
      { key: "pdfMarginBottomMm", col: "pdf_margin_bottom_mm", default: DEFAULT_BRANDING.pdfMarginBottomMm },
      { key: "pdfMarginLeftMm", col: "pdf_margin_left_mm", default: DEFAULT_BRANDING.pdfMarginLeftMm },
    ];

    for (const { key, col, default: def } of allFields) {
      const val = inputValues[key] !== undefined ? inputValues[key] : def;
      columns.push(col);
      valueParams.push(`$${paramIdx++}`);
      values.push(val);
      setClauses.push(`${col} = $${paramIdx - 1}`);
    }

    columns.push("created_at", "updated_at");
    valueParams.push("NOW()", "NOW()");

    const insertCols = columns.join(", ");
    const insertVals = valueParams.join(", ");
    const upsertSet = [...setClauses, "updated_at = NOW()"].join(", ");

    await query(
      `INSERT INTO business_branding (${insertCols}) VALUES (${insertVals})
       ON CONFLICT (business_id) DO UPDATE SET ${upsertSet}
       RETURNING *`,
      values,
    );

    logger.info(`Updated branding for business ${businessId}`);
    return this.get(businessId);
  }

  async generatePreviewHtml(businessId: string, input?: BrandingInput): Promise<string> {
    const hasInput = input && Object.keys(input).length > 0;
    const branding = hasInput ? { ...DEFAULT_BRANDING, ...input } as BrandingSettings : await this.get(businessId);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    :root {
      --primary-color: ${branding.primaryColor};
      --secondary-color: ${branding.secondaryColor};
      ${branding.fontFamily ? `--font-family: ${branding.fontFamily};` : ""}
    }
    body {
      font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      color: #1e293b;
      margin: 0;
      padding: ${branding.pdfMarginTopMm}mm ${branding.pdfMarginRightMm}mm ${branding.pdfMarginBottomMm}mm ${branding.pdfMarginLeftMm}mm;
    }
    .border-primary { border-color: var(--primary-color); }
    .text-primary { color: var(--primary-color); }
    .bg-primary { background-color: var(--primary-color); }
    .border-secondary { border-color: var(--secondary-color); }
    .text-secondary { color: var(--secondary-color); }
  </style>
</head>
<body>
  <div class="border-b-2 border-primary pb-4 mb-6">
    <div class="flex items-center justify-between">
      ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="height: ${branding.logoHeightPx ?? 48}px; width: auto;" />` : '<div style="width: 48px; height: 48px;"></div>'}
      <div class="text-right">
        <h1 class="text-primary font-bold text-2xl">${branding.invoiceTitle ?? "Invoice"}</h1>
        ${branding.invoiceSubtitle ? `<p class="text-secondary text-sm">${branding.invoiceSubtitle}</p>` : ""}
      </div>
    </div>
  </div>
  <div class="mb-6">
    <p class="text-secondary">Branding preview for ${branding.businessId}</p>
    <p class="text-secondary mt-4">${branding.footerText ?? "Enter footer text to customize this section."}</p>
  </div>
  <div class="border-t border-secondary pt-4 text-xs text-secondary">
    ${branding.showPageNumbers ? '<span>Page 1</span>' : ""}
  </div>
</body>
</html>`;

    return html;
  }

  private mapRow(row: Record<string, unknown>): BrandingSettings {
    return {
      businessId: row.business_id as string,
      primaryColor: row.primary_color as string,
      secondaryColor: row.secondary_color as string,
      fontFamily: row.font_family as string | null,
      logoUrl: row.logo_url as string | null,
      logoWidthPx: row.logo_width_px ? Number(row.logo_width_px) : null,
      logoHeightPx: row.logo_height_px ? Number(row.logo_height_px) : null,
      invoiceTitle: row.invoice_title as string | null,
      invoiceSubtitle: row.invoice_subtitle as string | null,
      footerText: row.footer_text as string | null,
      showLogo: Boolean(row.show_logo),
      showPageNumbers: Boolean(row.show_page_numbers),
      showQrCode: Boolean(row.show_qr_code),
      pdfPageSize: row.pdf_page_size as string,
      pdfMarginTopMm: Number(row.pdf_margin_top_mm),
      pdfMarginRightMm: Number(row.pdf_margin_right_mm),
      pdfMarginBottomMm: Number(row.pdf_margin_bottom_mm),
      pdfMarginLeftMm: Number(row.pdf_margin_left_mm),
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}

export const brandingService = new BrandingService();
