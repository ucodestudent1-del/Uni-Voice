import { z } from "zod";

export const BrandingInputSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
  fontFamily: z.string().max(255).nullish(),
  logoUrl: z.string().url("Must be a valid URL").nullish(),
  logoWidthPx: z.number().int().positive().nullish(),
  logoHeightPx: z.number().int().positive().nullish(),
  invoiceTitle: z.string().max(255).nullish(),
  invoiceSubtitle: z.string().max(255).nullish(),
  footerText: z.string().nullish(),
  showLogo: z.boolean().optional(),
  showPageNumbers: z.boolean().optional(),
  showQrCode: z.boolean().optional(),
  pdfPageSize: z.enum(["A4", "Letter", "Legal", "Tabloid"]).optional(),
  pdfMarginTopMm: z.coerce.number().min(0).optional(),
  pdfMarginRightMm: z.coerce.number().min(0).optional(),
  pdfMarginBottomMm: z.coerce.number().min(0).optional(),
  pdfMarginLeftMm: z.coerce.number().min(0).optional(),
});

export type BrandingInput = z.infer<typeof BrandingInputSchema>;
