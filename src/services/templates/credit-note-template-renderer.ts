import Handlebars from "handlebars";
import type { Address } from "../../domain/value-objects/address.js";
import { formatMoney, getCurrencyMetadata, type CurrencyCode } from "../../domain/value-objects/currency.js";
import { Decimal } from "decimal.js";
import { env } from "../../config/index.js";

export interface CreditNoteTemplateLineItem {
  description: string;
  quantity: Decimal.Value;
  unit: string;
  unitPrice: Decimal.Value;
  discount: Decimal.Value;
  taxRate: Decimal.Value;
  taxAmount: Decimal.Value;
  lineSubtotal: Decimal.Value;
  lineTotal: Decimal.Value;
  isTaxInclusive: boolean;
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
}

export interface CreditNoteTemplateFee {
  description: string;
  amount: Decimal.Value;
  taxRate: Decimal.Value;
  taxAmount: Decimal.Value;
}

export interface CreditNoteTemplateTotals {
  subtotal: Decimal.Value;
  discountTotal: Decimal.Value;
  taxTotal: Decimal.Value;
  feeTotal: Decimal.Value;
  total: Decimal.Value;
  appliedTotal: Decimal.Value;
  amountDue: Decimal.Value;
}

export interface CreditNoteTemplateBusiness {
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

export interface CreditNoteTemplateCustomer {
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

export interface CreditNoteTemplateApplicationInfo {
  amount: Decimal.Value;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  appliedAt?: string | null;
}

export interface CreditNoteTemplateData {
  business: CreditNoteTemplateBusiness;
  customer: CreditNoteTemplateCustomer | null;
  creditNote: {
    id: string;
    creditNoteNumber: string | null;
    status: string;
    issueDate: string | null;
    currency: CurrencyCode;
    reason?: string | null;
    notes?: string | null;
    terms?: string | null;
    referenceInvoiceId?: string | null;
    referenceInvoiceNumber?: string | null;
    language?: string;
  };
  lineItems: CreditNoteTemplateLineItem[];
  fees: CreditNoteTemplateFee[];
  totals: CreditNoteTemplateTotals;
  applications: CreditNoteTemplateApplicationInfo[];
  config: Record<string, unknown>;
}

export interface CreditNoteRenderOptions {
  currency: CurrencyCode;
  locale?: string;
}

function fmt(v: Decimal.Value | undefined, currency: CurrencyCode): string {
  return formatMoney(v ?? 0, currency);
}

function fmtRate(v: Decimal.Value | undefined): string {
  if (!v || new Decimal(v).isZero()) return "0.00%";
  return `${new Decimal(v).mul(100).toFixed(2)}%`;
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const templateCache = new Map<string, Handlebars.TemplateDelegate<any>>();

Handlebars.registerHelper("cnAdd", (a: number, b: number) => a + b);

Handlebars.registerHelper("cnNl2br", (str: string | null | undefined): string => {
  if (!str) return "";
  const escaped = str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return paragraphs
    .map((p) => `<p>${p.trim().replace(/\n/g, "<br>")}</p>`)
    .join("");
});

Handlebars.registerHelper("cnFormatMoney", function (v: Decimal.Value, options: any): string {
  const currency = options?.data?.root?.creditNote?.currency ?? "USD";
  return fmt(v, currency as CurrencyCode);
});

Handlebars.registerHelper("cnFormatRate", fmtRate);

Handlebars.registerHelper("cnFormatDate", fmtDate);

Handlebars.registerHelper("cnFormatQty", function (v: Decimal.Value): string {
  const d = new Decimal(v ?? 0);
  const str = d.toFixed(6);
  if (str.endsWith(".000000")) return str.slice(0, -6);
  return str.replace(/\.?0+$/, "");
});

function compileTemplate(templateHtml: string): Handlebars.TemplateDelegate<any> {
  let compiled = templateCache.get(templateHtml);
  if (!compiled) {
    compiled = Handlebars.compile(templateHtml, { noEscape: true });
    templateCache.set(templateHtml, compiled);
  }
  return compiled;
}

export const DEFAULT_CREDIT_NOTE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{creditNote.language}}">
<head>
  <meta charset="utf-8">
  <title>Credit Note {{creditNote.creditNoteNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 32px; color: #222; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .logo { max-height: 60px; }
    h1 { margin: 0 0 4px; font-size: 24px; }
    h2 { margin: 0; font-size: 18px; }
    h3 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .muted { color: #666; font-size: 13px; }
    .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; margin: 0 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    th { color: #666; font-weight: 600; }
    .totals td { font-weight: 600; }
    .big-total { font-size: 20px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: #f3f4f6; color: #374151; }
    .footer { margin-top: 32px; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0; padding-top: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 500; }
    .reason-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px 16px; margin-top: 12px; }
    .zero-line { color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Credit Note</h1>
      <h2>{{creditNote.creditNoteNumber}}</h2>
      <span class="status-badge">{{creditNote.status}}</span>
    </div>
    {{#if business.logoUrl}}
    <img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}">
    {{else}}
    <div style="text-align:right">
      <h2 style="margin:0">{{business.name}}</h2>
    </div>
    {{/if}}
    {{#if business.logoUrl}}
    <div style="text-align:right">
      <h2 style="margin:0">{{business.name}}</h2>
    </div>
    {{/if}}
  </div>

  <div class="grid">
    <div>
      <h3>From</h3>
      <p style="margin:0;font-weight:600">{{business.name}}</p>
      {{#if business.legalName}}
      <p class="muted">{{business.legalName}}</p>
      {{/if}}
      {{#if business.address}}
      <p class="muted" style="margin:0">
        {{business.address.addressLine1}}<br>
        {{#if business.address.addressLine2}}{{business.address.addressLine2}}<br>{{/if}}
        {{business.address.city}}, {{business.address.stateOrRegion}} {{business.address.postalCode}}<br>
        {{business.address.countryCode}}
      </p>
      {{/if}}
      {{#if business.taxId}}
      <p class="muted">Tax ID: {{business.taxId}}</p>
      {{/if}}
      {{#if business.email}}
      <p class="muted">{{business.email}}</p>
      {{/if}}
      {{#if business.phone}}
      <p class="muted">{{business.phone}}</p>
      {{/if}}
      {{#if business.website}}
      <p class="muted">{{business.website}}</p>
      {{/if}}
    </div>
    <div style="text-align:right">
      <p class="muted">Currency: {{meta.code}}</p>
      <p><span class="muted">Issue date:</span> {{cnFormatDate creditNote.issueDate}}</p>
      {{#if creditNote.reason}}
      <div class="reason-box" style="text-align:left; margin-top:8px">
        <strong style="display:block; margin-bottom:4px">Reason:</strong>
        <span>{{creditNote.reason}}</span>
      </div>
      {{/if}}
      {{#if creditNote.referenceInvoiceNumber}}
      <p class="muted" style="margin-top:8px">Related Invoice: {{creditNote.referenceInvoiceNumber}}</p>
      {{/if}}
    </div>
  </div>

  {{#if customer}}
  <div style="margin-top:24px">
    <h3>Bill To</h3>
    <p style="margin:0;font-weight:600">{{customer.name}}</p>
    {{#if customer.companyName}}
    <p class="muted">{{customer.companyName}}</p>
    {{/if}}
    {{#if customer.address}}
    <p class="muted" style="margin:0">
      {{customer.address.addressLine1}}<br>
      {{#if customer.address.addressLine2}}{{customer.address.addressLine2}}<br>{{/if}}
      {{customer.address.city}}, {{customer.address.stateOrRegion}} {{customer.address.postalCode}}<br>
      {{customer.address.countryCode}}
    </p>
    {{/if}}
    {{#if customer.taxId}}
    <p class="muted">Tax ID: {{customer.taxId}}</p>
    {{/if}}
    {{#if customer.email}}
    <p class="muted">{{customer.email}}</p>
    {{/if}}
    {{#if customer.phone}}
    <p class="muted">{{customer.phone}}</p>
    {{/if}}
  </div>
  {{/if}}

  <table style="margin-top:24px">
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Discount</th>
        <th style="text-align:right">Tax</th>
        <th style="text-align:right">Line Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each lineItems}}
      <tr>
        <td>{{cnAdd @index 1}}</td>
        <td>{{description}}</td>
        <td style="text-align:right">{{cnFormatQty quantity}} {{unit}}</td>
        <td style="text-align:right">{{cnFormatMoney unitPrice}}</td>
        <td style="text-align:right">{{#if (cnGt discount 0)}}({{cnFormatMoney discount}}){{else}}—{{/if}}</td>
        <td style="text-align:right">{{cnFormatRate taxRate}}</td>
        <td style="text-align:right">{{cnFormatMoney lineTotal}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  {{#if fees.length}}
  <h3 style="margin-top:24px">Additional Fees</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right">Amount</th>
        <th style="text-align:right">Tax</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each fees}}
      <tr>
        <td>{{description}}</td>
        <td style="text-align:right">{{cnFormatMoney amount}}</td>
        <td style="text-align:right">{{cnFormatRate taxRate}}</td>
        <td style="text-align:right">{{cnFormatMoney (cnAddAmount amount taxAmount)}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{/if}}

  <div style="margin-top:24px">
    <table style="max-width:320px; margin-left:auto">
      <tbody>
        <tr><td>Subtotal</td><td style="text-align:right">{{cnFormatMoney totals.subtotal}}</td></tr>
        <tr><td>Discount</td><td style="text-align:right">({{cnFormatMoney totals.discountTotal}})</td></tr>
        <tr><td>Tax</td><td style="text-align:right">{{cnFormatMoney totals.taxTotal}}</td></tr>
        {{#if (cnGt totals.feeTotal 0)}}
        <tr><td>Fees</td><td style="text-align:right">{{cnFormatMoney totals.feeTotal}}</td></tr>
        {{/if}}
        <tr class="big-total"><td>Credit Note Total</td><td style="text-align:right">{{cnFormatMoney totals.total}}</td></tr>
        {{#if (cnGt totals.appliedTotal 0)}}
        <tr><td>Amount Applied</td><td style="text-align:right">({{cnFormatMoney totals.appliedTotal}})</td></tr>
        <tr class="big-total"><td>Amount Remaining</td><td style="text-align:right">{{cnFormatMoney totals.amountDue}}</td></tr>
        {{else}}
        <tr><td>Amount Applied</td><td style="text-align:right">—</td></tr>
        <tr class="big-total"><td>Amount Remaining</td><td style="text-align:right">{{cnFormatMoney totals.total}}</td></tr>
        {{/if}}
      </tbody>
    </table>
  </div>

  {{#if applications.length}}
  <div style="margin-top:24px">
    <h3 style="font-size:14px; margin:0 0 8px">Applied To Invoices</h3>
    <table>
      <thead>
        <tr>
          <th>Invoice</th>
          <th style="text-align:right">Amount Applied</th>
          <th style="text-align:right">Date</th>
        </tr>
      </thead>
      <tbody>
        {{#each applications}}
        <tr>
          <td>{{#if invoiceNumber}}{{invoiceNumber}}{{else}}{{invoiceId}}{{/if}}</td>
          <td style="text-align:right">{{cnFormatMoney amount}}</td>
          <td style="text-align:right">{{cnFormatDate appliedAt}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/if}}

  {{#if creditNote.notes}}
  <div style="margin-top:24px">
    <h3 style="font-size:13px; text-transform:uppercase; letter-spacing:0.04em; color:#666;">Notes</h3>
    <div class="muted">{{{cnNl2br creditNote.notes}}}</div>
  </div>
  {{/if}}

  {{#if creditNote.terms}}
  <div style="margin-top:24px">
    <h3 style="font-size:13px; text-transform:uppercase; letter-spacing:0.04em; color:#666;">Terms &amp; Conditions</h3>
    <div class="muted">{{{cnNl2br creditNote.terms}}}</div>
  </div>
  {{/if}}

  <div class="footer">
    <p class="muted">Credit Note #{{creditNote.creditNoteNumber}}. All rights reserved.</p>
    <p class="muted" style="margin-top:4px">Generated on {{cnFormatDate (cnNowString)}}</p>
  </div>
</body>
</html>`;

Handlebars.registerHelper("cnGt", function (a: unknown, b: unknown): boolean {
  try {
    return new Decimal(String(a ?? 0)).gt(new Decimal(String(b ?? 0)));
  } catch {
    return false;
  }
});

Handlebars.registerHelper("cnAddAmount", function (a: Decimal.Value, b: Decimal.Value): Decimal.Value {
  return new Decimal(a ?? 0).plus(new Decimal(b ?? 0));
});

Handlebars.registerHelper("cnNowString", function (): string {
  return new Date().toISOString();
});

templateCache.set(DEFAULT_CREDIT_NOTE_TEMPLATE, Handlebars.compile(DEFAULT_CREDIT_NOTE_TEMPLATE, { noEscape: true }));

export class CreditNoteTemplateRenderer {
  private defaultTemplate: string;

  constructor(defaultTemplate?: string) {
    this.defaultTemplate = defaultTemplate ?? DEFAULT_CREDIT_NOTE_TEMPLATE;
  }

  build(data: CreditNoteTemplateData): Handlebars.TemplateDelegate<any> {
    return compileTemplate(
      (data.config?.htmlTemplate as string | undefined) ?? this.defaultTemplate
    );
  }

  render(data: CreditNoteTemplateData, templateHtml?: string): string {
    const template = compileTemplate(
      templateHtml ?? (data.config?.htmlTemplate as string | undefined) ?? this.defaultTemplate
    );
    return template({
      ...data,
      meta: getCurrencyMetadata(data.creditNote.currency),
      appBaseUrl: env.APP_PUBLIC_BASE_URL,
    });
  }
}

export const creditNoteTemplateRenderer = new CreditNoteTemplateRenderer();

export function buildCreditNoteTemplateData(
  creditNote: {
    id: string;
    creditNoteNumber: string | null;
    status: string;
    issueDate?: Date | null;
    currency: CurrencyCode;
    reason?: string | null;
    notes?: string | null;
    terms?: string | null;
    referenceInvoiceId?: string | null;
    referenceInvoiceNumber?: string | null;
    language?: string;
  },
  business: CreditNoteTemplateBusiness,
  customer: CreditNoteTemplateCustomer | null,
  items: CreditNoteTemplateLineItem[],
  fees: CreditNoteTemplateFee[],
  totals: CreditNoteTemplateTotals,
  applications: CreditNoteTemplateApplicationInfo[],
  config: Record<string, unknown> = {}
): CreditNoteTemplateData {
  return {
    business,
    customer,
    creditNote: {
      id: creditNote.id,
      creditNoteNumber: creditNote.creditNoteNumber,
      status: creditNote.status,
      issueDate: creditNote.issueDate ? creditNote.issueDate.toISOString().slice(0, 10) : null,
      currency: creditNote.currency,
      reason: creditNote.reason,
      notes: creditNote.notes,
      terms: creditNote.terms,
      referenceInvoiceId: creditNote.referenceInvoiceId,
      referenceInvoiceNumber: creditNote.referenceInvoiceNumber,
      language: creditNote.language,
    },
    lineItems: items,
    fees,
    totals,
    applications,
    config,
  };
}
