import type {
  InvoiceTemplateDocument,
  InvoiceTemplateSettings,
} from "../../domain/schemas/invoice-template.js";
import { formatMoney } from "../../domain/value-objects/currency.js";
import type { CurrencyCode } from "../../domain/value-objects/currency.js";
import { Decimal } from "decimal.js";
import { formatAddress } from "../../domain/value-objects/address.js";
import type { Address } from "../../domain/value-objects/address.js";

export interface RenderableLineItem {
  description: string;
  quantity: Decimal.Value;
  unit?: string;
  unitPrice: Decimal.Value;
  discount?: Decimal.Value;
  discountType?: "fixed" | "percentage";
  taxRate: Decimal.Value;
  taxAmount: Decimal.Value;
  lineSubtotal: Decimal.Value;
  lineTotal: Decimal.Value;
  isTaxInclusive?: boolean;
}

export interface RenderableFee {
  description: string;
  amount: Decimal.Value;
  taxRate: Decimal.Value;
  taxAmount: Decimal.Value;
}

export interface RenderableTotals {
  subtotal: Decimal.Value;
  discountTotal: Decimal.Value;
  taxTotal: Decimal.Value;
  feeTotal: Decimal.Value;
  total: Decimal.Value;
  amountPaid: Decimal.Value;
  amountDue: Decimal.Value;
}

export interface RenderableBusiness {
  id: string;
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  address: Address;
  countryCode: string;
  defaultCurrency: CurrencyCode;
  logoUrl?: string | null;
}

export interface RenderableCustomer {
  id: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address: Address;
  countryCode?: string | null;
  notes?: string | null;
}

export interface RenderableInvoice {
  id: string;
  invoiceNumber: string | null;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: CurrencyCode;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  language?: string;
}

export interface RenderContext {
  business: RenderableBusiness;
  customer: RenderableCustomer | null;
  invoice: RenderableInvoice;
  lineItems: RenderableLineItem[];
  fees: RenderableFee[];
  totals: RenderableTotals;
  currency: CurrencyCode;
  locale?: string;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmt(v: Decimal.Value, currency: CurrencyCode, locale?: string): string {
  return formatMoney(v, currency, locale);
}

function fmtRate(v: Decimal.Value): string {
  if (!v) return "0.00%";
  return `${new Decimal(v).mul(100).toFixed(2)}%`;
}

function styleToString(style: Record<string, unknown> | undefined): string {
  if (!style) return "";
  return Object.entries(style)
    .map(([k, v]) => {
      if (v == null) return "";
      const camelToKebab = k.replace(/([A-Z])/g, "-$1").toLowerCase();
      return `${camelToKebab}: ${typeof v === "number" && !k.includes("zIndex") && !k.includes("opacity") ? `${v}px` : v}`;
    })
    .filter(Boolean)
    .join("; ");
}

function renderChildren(
  childIds: string[],
  doc: InvoiceTemplateDocument,
  ctx: RenderContext
): string {
  return childIds
    .map((id) => {
      const comp = doc.components[id];
      if (!comp) return "";
      return renderComponent(comp as any, doc, ctx);
    })
    .join("");
}

function renderComponent(comp: any, doc: InvoiceTemplateDocument, ctx: RenderContext): string {
  const styleStr = comp.style ? ` style="${escapeHtml(styleToString(comp.style))}"` : "";

  switch (comp.type) {
    case "text": {
      return `<div data-component="${comp.id}"${styleStr}>${escapeHtml(comp.props?.content ?? "")}</div>`;
    }

    case "image":
    case "logo": {
      const src = comp.props?.src ?? "";
      const alt = comp.props?.alt ?? "";
      const width = comp.props?.width ? ` width="${escapeHtml(comp.props.width.toString())}"` : "";
      const height = comp.props?.height ? ` height="${escapeHtml(comp.props.height.toString())}"` : "";
      return `<img data-component="${comp.id}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${width}${height}${styleStr} />`;
    }

    case "customerInfo": {
      const c = ctx.customer;
      if (!c) return `<div data-component="${comp.id}">No customer</div>`;
      const showName = comp.props?.showName;
      const showCompany = comp.props?.showCompany;
      const showEmail = comp.props?.showEmail;
      const showAddress = comp.props?.showAddress;
      const showPhone = comp.props?.showPhone;
      const label = comp.props?.label;

      let html = `<div data-component="${comp.id}">`;
      if (label) html += `<div class="label">${escapeHtml(label)}</div>`;
      html += '<div class="customer-info">';
      if (showName) html += `<div class="customer-name">${escapeHtml(c.name)}</div>`;
      if (showCompany && c.companyName) html += `<div class="customer-company">${escapeHtml(c.companyName)}</div>`;
      if (showEmail && c.email) html += `<div class="customer-email">${escapeHtml(c.email)}</div>`;
      if (showAddress && c.address) html += `<div class="customer-address">${formatAddress(c.address).replace(/\n/g, "<br>")}</div>`;
      if (showPhone && c.phone) html += `<div class="customer-phone">${escapeHtml(c.phone)}</div>`;
      html += "</div></div>";
      return `${html}${styleStr}`;
    }

    case "businessInfo": {
      const b = ctx.business;
      const showName = comp.props?.showName;
      const showEmail = comp.props?.showEmail;
      const showPhone = comp.props?.showPhone;
      const showWebsite = comp.props?.showWebsite;
      const showAddress = comp.props?.showAddress;
      const showLogo = comp.props?.showLogo;
      const label = comp.props?.label;

      let html = `<div data-component="${comp.id}">`;
      if (label) html += `<div class="label">${escapeHtml(label)}</div>`;

      if (showLogo && b.logoUrl) {
        html += `<img class="logo" src="${escapeHtml(b.logoUrl)}" alt="${escapeHtml(b.name)}" />`;
      }

      html += '<div class="business-info">';
      if (showName) html += `<div class="business-name">${escapeHtml(b.name)}</div>`;
      if (showEmail && b.email) html += `<div class="business-email">${escapeHtml(b.email)}</div>`;
      if (showPhone && b.phone) html += `<div class="business-phone">${escapeHtml(b.phone)}</div>`;
      if (showWebsite && b.website) html += `<div class="business-website">${escapeHtml(b.website)}</div>`;
      if (showAddress && b.address) html += `<div class="business-address">${formatAddress(b.address).replace(/\n/g, "<br>")}</div>`;
      html += "</div></div>";
      return `${html}`;
    }

    case "invoiceNumber": {
      const prefix = comp.props?.prefix ?? "";
      const label = comp.props?.label ?? "Invoice";
      const number = ctx.invoice.invoiceNumber ?? "";
      let html = `<div data-component="${comp.id}">`;
      if (label) html += `<div class="label">${escapeHtml(label)}</div>`;
      html += `<div class="invoice-number">${escapeHtml(prefix)}${escapeHtml(number)}</div>`;
      html += "</div>";
      return `${html}${styleStr}`;
    }

    case "date": {
      const dateType = comp.props?.dateType ?? "issue";
      const format = comp.props?.format ?? "default";
      const label = comp.props?.label;
      let rawDate: string | null = null;
      if (dateType === "issue") rawDate = ctx.invoice.issueDate;
      else if (dateType === "due") rawDate = ctx.invoice.dueDate;
      else rawDate = comp.props?.customValue ?? null;

      let formatted = rawDate ?? "";
      if (rawDate && format !== "default") {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          formatted = formatDate(d, format);
        }
      }

      let html = `<div data-component="${comp.id}">`;
      if (label) html += `<div class="label">${escapeHtml(label)}</div>`;
      html += `<div class="date-value">${escapeHtml(formatted)}</div>`;
      html += "</div>";
      return `${html}${styleStr}`;
    }

    case "lineItems": {
      const columns = comp.props?.columns ?? [];
      const showHeader = comp.props?.showHeader ?? true;
      const currency = comp.props?.currency ?? ctx.currency;

      let html = `<div data-component="${comp.id}"><table class="line-items"><thead>`;
      if (showHeader) {
        html += `<tr>${columns.filter((c: any) => c.visible).map((c: any) => `<th style="text-align:${c.align ?? "left"}">${escapeHtml(c.label)}</th>`).join("")}</tr>`;
      }
      html += `</thead><tbody>`;

      for (const item of ctx.lineItems) {
        html += `<tr>`;
        for (const col of columns) {
          if (!col.visible) continue;
          const val = formatLineItemValue(item, col.key, currency, ctx.locale);
          const align = col.align ?? "left";
          html += `<td style="text-align:${align}">${escapeHtml(val)}</td>`;
        }
        html += `</tr>`;
      }

      html += `</tbody></table></div>`;
      return `${html}${styleStr}`;
    }

    case "subtotal": {
      const label = comp.props?.label ?? "Subtotal";
      const currency = comp.props?.currency ?? ctx.currency;
      let html = `<div data-component="${comp.id}"><span class="label">${escapeHtml(label)}:</span>`;
      html += `<span class="value">${fmt(ctx.totals.subtotal, currency as CurrencyCode, ctx.locale)}</span></div>`;
      return `${html}${styleStr}`;
    }

    case "tax": {
      const label = comp.props?.label ?? "Tax";
      const currency = comp.props?.currency ?? ctx.currency;
      let html = `<div data-component="${comp.id}"><span class="label">${escapeHtml(label)}:</span>`;
      html += `<span class="value">${fmt(ctx.totals.taxTotal, currency as CurrencyCode, ctx.locale)}</span></div>`;
      return `${html}${styleStr}`;
    }

    case "discount": {
      const label = comp.props?.label ?? "Discount";
      const currency = comp.props?.currency ?? ctx.currency;
      let html = `<div data-component="${comp.id}"><span class="label">${escapeHtml(label)}:</span>`;
      html += `<span class="value">(${fmt(ctx.totals.discountTotal, currency as CurrencyCode, ctx.locale)})</span></div>`;
      return `${html}${styleStr}`;
    }

    case "fees": {
      const label = comp.props?.label ?? "Fees";
      const currency = comp.props?.currency ?? ctx.currency;
      let html = `<div data-component="${comp.id}"><span class="label">${escapeHtml(label)}:</span>`;
      html += `<span class="value">${fmt(ctx.totals.feeTotal, currency as CurrencyCode, ctx.locale)}</span></div>`;
      return `${html}${styleStr}`;
    }

    case "total": {
      const label = comp.props?.label ?? "Total";
      const currency = comp.props?.currency ?? ctx.currency;
      let html = `<div data-component="${comp.id}"><span class="label">${escapeHtml(label)}:</span>`;
      html += `<span class="value">${fmt(ctx.totals.total, currency as CurrencyCode, ctx.locale)}</span></div>`;
      return `${html}${styleStr}`;
    }

    case "amountDue": {
      const label = comp.props?.label ?? "Amount Due";
      const currency = comp.props?.currency ?? ctx.currency;
      let html = `<div data-component="${comp.id}"><span class="label">${escapeHtml(label)}:</span>`;
      html += `<span class="value">${fmt(ctx.totals.amountDue, currency as CurrencyCode, ctx.locale)}</span></div>`;
      return `${html}${styleStr}`;
    }

    case "paymentTerms": {
      const content = comp.props?.content ?? "";
      const label = comp.props?.label;
      let html = `<div data-component="${comp.id}">`;
      if (label) html += `<div class="label">${escapeHtml(label)}</div>`;
      html += `<div class="content">${escapeHtml(content)}</div></div>`;
      return `${html}${styleStr}`;
    }

    case "notes": {
      const content = comp.props?.content ?? "";
      const label = comp.props?.label;
      let html = `<div data-component="${comp.id}">`;
      if (label) html += `<div class="label">${escapeHtml(label)}</div>`;
      html += `<div class="content">${escapeHtml(content)}</div></div>`;
      return `${html}${styleStr}`;
    }

    case "terms": {
      const content = comp.props?.content ?? "";
      const label = comp.props?.label;
      let html = `<div data-component="${comp.id}">`;
      if (label) html += `<div class="label">${escapeHtml(label)}</div>`;
      html += `<div class="content">${escapeHtml(content)}</div></div>`;
      return `${html}${styleStr}`;
    }

    case "paymentInstructions": {
      const content = comp.props?.content ?? "";
      const label = comp.props?.label;
      let html = `<div data-component="${comp.id}">`;
      if (label) html += `<div class="label">${escapeHtml(label)}</div>`;
      html += `<div class="content">${escapeHtml(content)}</div></div>`;
      return `${html}${styleStr}`;
    }

    case "signature": {
      const label = comp.props?.label ?? "Signature";
      const placeholder = comp.props?.placeholder ?? "__________________________";
      const showDate = comp.props?.showDate ?? true;
      const showName = comp.props?.showName ?? true;

      let html = `<div data-component="${comp.id}"><div class="label">${escapeHtml(label)}</div>`;
      html += `<div class="signature">${escapeHtml(placeholder)}</div>`;
      if (showDate) {
        html += `<div class="signature-date">Date: ${new Date().toLocaleDateString(ctx.locale)}</div>`;
      }
      if (showName) {
        html += `<div class="signature-name">Name: </div>`;
      }
      html += `</div>`;
      return `${html}${styleStr}`;
    }

    case "customField": {
      const key = comp.props?.key ?? "";
      const label = comp.props?.label ?? key;
      const value = comp.props?.value ?? "";
      let html = `<div data-component="${comp.id}"><span class="label">${escapeHtml(label)}:</span>`;
      html += `<span class="value">${escapeHtml(value)}</span></div>`;
      return `${html}${styleStr}`;
    }

    case "spacer": {
      const height = comp.props?.height ?? 16;
      return `<div data-component="${comp.id}" style="height: ${typeof height === "number" ? `${height}px` : height};${styleStr ? ` ${styleToString(comp.style as any)}` : ""}}"></div>`;
    }

    case "divider": {
      const thickness = comp.props?.thickness ?? 1;
      const color = comp.props?.color ?? "#e2e8f0";
      const style = comp.props?.style ?? "solid";
      return `<hr data-component="${comp.id}" style="height:${thickness}px;border:${thickness}px ${style} ${color};${styleStr ? ` ${styleToString(comp.style as any)}` : ""}" />`;
    }

    case "section": {
      const childrenHtml = comp.children ? renderChildren(comp.children, doc, ctx) : "";
      const fullWidth = comp.props?.fullWidth !== false ? "width:100%" : "width:auto";
      return `<section data-component="${comp.id}" style="${fullWidth}${styleStr ? `;${styleToString(comp.style as any)}` : ""}">${childrenHtml}</section>`;
    }

    case "row": {
      const childrenHtml = comp.children ? renderChildren(comp.children, doc, ctx) : "";
      const flexDirection = "row";
      const columnGap = comp.props?.columnGap ?? 16;
      return `<div data-component="${comp.id}" class="row" style="display:flex;flex-direction:${flexDirection};gap:${typeof columnGap === "number" ? `${columnGap}px` : columnGap};${styleStr ? styleToString(comp.style as any) : ""}">${childrenHtml}</div>`;
    }

    case "column": {
      const childrenHtml = comp.children ? renderChildren(comp.children, doc, ctx) : "";
      return `<div data-component="${comp.id}" class="column" style="flex:${comp.props?.span ?? 1};${styleStr ? styleToString(comp.style as any) : ""}">${childrenHtml}</div>`;
    }

    default:
      return `<div data-component="${comp.id}">Unknown component: ${escapeHtml(comp.type)}</div>`;
  }
}

function formatLineItemValue(item: RenderableLineItem, key: string, currency: string, locale?: string): string {
  switch (key) {
    case "description":
      return item.description;
    case "quantity":
      return new Decimal(item.quantity).toFixed(2);
    case "unit":
      return item.unit ?? "";
    case "unitPrice":
    case "rate":
      return fmt(item.unitPrice, currency as CurrencyCode, locale);
    case "discount":
      return fmt(item.discount ?? 0, currency as CurrencyCode, locale);
    case "taxRate":
      return fmtRate(item.taxRate);
    case "taxAmount":
    case "tax":
      return fmt(item.taxAmount, currency as CurrencyCode, locale);
    case "lineSubtotal":
    case "subtotal":
      return fmt(item.lineSubtotal, currency as CurrencyCode, locale);
    case "lineTotal":
    case "amount":
      return fmt(item.lineTotal, currency as CurrencyCode, locale);
    case "hours":
      return new Decimal(item.quantity).toFixed(2);
    default:
      return "";
  }
}

function formatDate(d: Date, format: string): string {
  if (format === "short") return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (format === "long") return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return d.toISOString().slice(0, 10);
}

export class StructuredTemplateRenderer {
  render(doc: InvoiceTemplateDocument, ctx: RenderContext): string {
    const settings = doc.settings as InvoiceTemplateSettings;
    const styleTag = this.buildSettingsStyles(settings);

    const body = this.renderBody(doc, ctx);

    return `<!DOCTYPE html>
<html lang="${settings.locale ?? ctx.locale ?? "en-US"}">
<head>
  <meta charset="utf-8">
  <title>Invoice ${escapeHtml(ctx.invoice.invoiceNumber ?? "")}</title>
  <style>${styleTag}</style>
</head>
<body>
  ${body}
</body>
</html>`;
  }

  private renderBody(doc: InvoiceTemplateDocument, ctx: RenderContext): string {
    const rootSection = doc.sections[doc.rootSectionId] as Record<string, unknown> | undefined;
    if (!rootSection) return `<div class="error">Invalid document structure</div>`;

    const childIds = (rootSection.children as string[] | undefined) ?? [];
    return renderChildren(childIds, doc, ctx);
  }

  private buildSettingsStyles(settings: InvoiceTemplateSettings): string {
    const margins = settings.margins ?? { top: 40, right: 40, bottom: 40, left: 40 };
    return `
      body { font-family: ${settings.defaultFont ?? "system-ui, sans-serif"}; font-size: ${settings.defaultFontSize ?? 14}px; color: ${settings.defaultColor ?? "#1f2937"}; margin: 0; padding: 0; }
      .page { padding: ${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px; max-width: ${settings.pageSize === "A4" ? "8.27in" : settings.pageSize === "Letter" ? "8.5in" : "8.5in"}; margin: 0 auto; }
      .line-items { width: 100%; border-collapse: collapse; }
      .line-items th, .line-items td { padding: 8px 6px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
      .line-items th { color: #666; font-weight: 600; }
      .signature { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 32px; }
      .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; margin-bottom: 4px; }
      .row { display: flex; flex-direction: row; }
      .column { flex: 1; }
    `;
  }
}

export const structuredTemplateRenderer = new StructuredTemplateRenderer();
