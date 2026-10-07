import Handlebars from "handlebars";
import type { Address } from "../../domain/value-objects/address.js";
import { formatMoney, getCurrencyMetadata, type CurrencyCode } from "../../domain/value-objects/currency.js";
import { Decimal } from "decimal.js";
import { env } from "../../config/index.js";

export interface TemplateLineItem {
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

export interface TemplateFee {
  description: string;
  amount: Decimal.Value;
  taxRate: Decimal.Value;
  taxAmount: Decimal.Value;
}

export interface TemplateTotals {
  subtotal: Decimal.Value;
  discountTotal: Decimal.Value;
  taxTotal: Decimal.Value;
  feeTotal: Decimal.Value;
  total: Decimal.Value;
  amountPaid: Decimal.Value;
  amountDue: Decimal.Value;
}

export interface TemplateBusiness {
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

export interface TemplateCustomer {
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

export interface InvoiceTemplateData {
  business: TemplateBusiness;
  customer: TemplateCustomer | null;
  invoice: {
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
  };
  lineItems: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  config: Record<string, unknown>;
}

export interface RenderOptions {
  currency: CurrencyCode;
  locale?: string;
}

function fmt(v: Decimal.Value | undefined, currency: CurrencyCode): string {
  return formatMoney(v ?? 0, currency);
}

function fmtRate(v: Decimal.Value | undefined): string {
  if (!v) return "0.00%";
  return `${new Decimal(v).mul(100).toFixed(2)}%`;
}

const templateCache = new Map<string, Handlebars.TemplateDelegate<any>>();

Handlebars.registerHelper("add", (a: number, b: number) => a + b);

Handlebars.registerHelper("nl2br", (str: string | null | undefined): string => {
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

Handlebars.registerHelper("formatMoney", function (v: Decimal.Value, options: any): string {
  const currency = options?.data?.root?.invoice?.currency ?? "USD";
  return fmt(v, currency as CurrencyCode);
});

Handlebars.registerHelper("formatRate", fmtRate);

function compileTemplate(templateHtml: string): Handlebars.TemplateDelegate<any> {
  let compiled = templateCache.get(templateHtml);
  if (!compiled) {
    compiled = Handlebars.compile(templateHtml, { noEscape: true });
    templateCache.set(templateHtml, compiled);
  }
  return compiled;
}

export const DEFAULT_INVOICE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{invoice.language}}">
<head>
  <meta charset="utf-8">
  <title>Invoice {{invoice.invoiceNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 32px; color: #222; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .logo { max-height: 60px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    th { color: #666; font-weight: 600; }
    .totals { margin-top: 16px; }
    .totals td { font-weight: 600; }
    .big-total { font-size: 20px; }
    .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .footer { margin-top: 32px; font-size: 12px; color: #888; }
    .badge { display:inline-block; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0 0 4px;">Invoice</h1>
      <h2 style="margin:0; font-size: 22px;">{{invoice.invoiceNumber}}</h2>
      {{#if invoice.notes}}<p class="muted">{{{invoice.notes}}}</p>{{/if}}
    </div>
     {{#if business.logoUrl}}<img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}">{{/if}}
    <div style="text-align:right">
      {{#if business.logoUrl}}{{else}}<h2 style="margin:0">{{business.name}}</h2>{{/if}}
      <p class="muted">{{business.email}}</p>
      <p class="muted">{{business.phone}}</p>
    </div>
  </div>

  <div class="grid">
    <div>
      <h3 style="margin:0 0 6px;font-size:13px; text-transform:uppercase; letter-spacing:.04em;">Bill To</h3>
      <p style="margin:0;font-weight:600">{{customer.name}}</p>
      {{#if customer.companyName}}<p class="muted">{{customer.companyName}}</p>{{/if}}
      {{#if customer.address}}
      <p class="muted" style="margin:0">
        {{customer.address.addressLine1}}<br>
        {{#if customer.address.addressLine2}}{{customer.address.addressLine2}}<br>{{/if}}
        {{customer.address.city}}, {{customer.address.stateOrRegion}} {{customer.address.postalCode}}<br>
        {{customer.address.countryCode}}
      </p>
      {{/if}}
      {{#if customer.email}}<p class="muted">{{customer.email}}</p>{{/if}}
    </div>
    <div style="text-align:right">
      <p class="muted">{{meta.localeKey}}</p>
      <p><span class="muted">Issue date:</span> {{invoice.issueDate}}</p>
      <p><span class="muted">Due date:</span> {{invoice.dueDate}}</p>
      <p><span class="muted">Currency:</span> {{meta.code}}</p>
      <p><span class="muted">Status:</span> <span class="status">{{invoice.status}}</span></p>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>#</th><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Tax</th><th style="text-align:right">Line total</th></tr>
    </thead>
    <tbody>
      {{#each lineItems}}
      <tr>
        <td>{{add @index 1}}</td><td>{{description}}</td>
        <td style="text-align:right">{{quantity}} {{unit}}</td>
        <td style="text-align:right">{{formatMoney unitPrice}}</td>
        <td style="text-align:right">{{formatRate taxRate}}</td>
        <td style="text-align:right">{{formatMoney lineTotal}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <table style="max-width:320px; margin-left:auto">
      <tr><td>Subtotal</td><td style="text-align:right">{{formatMoney totals.subtotal}}</td></tr>
      <tr><td>Discount</td><td style="text-align:right">({{formatMoney totals.discountTotal}})</td></tr>
      <tr><td>Tax</td><td style="text-align:right">{{formatMoney totals.taxTotal}}</td></tr>
      <tr><td>Fee</td><td style="text-align:right">{{formatMoney totals.feeTotal}}</td></tr>
      <tr class="big-total"><td>Total</td><td style="text-align:right">{{formatMoney totals.total}}</td></tr>
      <tr><td>Paid</td><td style="text-align:right">{{formatMoney totals.amountPaid}}</td></tr>
      <tr><td>Amount due</td><td style="text-align:right">{{formatMoney totals.amountDue}}</td></tr>
    </table>
  </div>

   {{#if invoice.paymentInstructions}}
   <div class="footer">
     <h3 style="font-size:13px">Payment instructions</h3>
     <p>{{{invoice.paymentInstructions}}}</p>
   </div>
   {{/if}}
   {{#if invoice.terms}}
   <div class="footer" style="margin-top:24px">
     <h3 style="font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#666;">Terms &amp; Conditions</h3>
     <div class="terms-content">{{{nl2br invoice.terms}}}</div>
   </div>
   {{/if}}
   <div class="footer" style="margin-top:24px; border-top:1px solid #e0e0e0; padding-top:12px;">
     <p class="muted">Invoice #{invoice.invoiceNumber}. All rights reserved.</p>
   </div>
</body>
</html>`;

templateCache.set(DEFAULT_INVOICE_TEMPLATE, Handlebars.compile(DEFAULT_INVOICE_TEMPLATE, { noEscape: true }));

export const DEFAULT_QUOTE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{invoice.language}}">
<head>
  <meta charset="utf-8">
  <title>Quote {{invoice.invoiceNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 32px; color: #222; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .logo { max-height: 60px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .muted { color: #666; font-size: 13px; }
    .tertiary { color: #999; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    th { color: #666; font-weight: 600; }
    .totals { margin-top: 16px; }
    .totals td { font-weight: 600; }
    .big-total { font-size: 20px; }
    .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .footer { margin-top: 32px; font-size: 12px; color: #888; }
    .badge { display:inline-block; }
    .expiry-warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 8px 12px; color: #92400e; font-size: 12px; margin-top: 8px; }
    .disclaimer { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-top: 16px; font-size: 12px; color: #475569; }
    .signature-line { border-top: 1px solid #999; padding-top: 24px; margin-top: 24px; }
    .centered { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0 0 4px;">Quote</h1>
      <h2 style="margin:0; font-size: 22px;">{{invoice.invoiceNumber}}</h2>
      {{#if invoice.notes}}<p class="muted">{{{invoice.notes}}}</p>{{/if}}
    </div>
    {{#if business.logoUrl}}<img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}">{{/if}}
    <div style="text-align:right">
      {{#if business.logoUrl}}{{else}}<h2 style="margin:0">{{business.name}}</h2>{{/if}}
      {{#if business.legalName}}<p class="muted">{{business.legalName}}</p>{{/if}}
      {{#if business.address}}
      <p class="muted" style="margin:0">
        {{business.address.addressLine1}}<br>
        {{#if business.address.addressLine2}}{{business.address.addressLine2}}<br>{{/if}}
        {{business.address.city}}, {{business.address.stateOrRegion}} {{business.address.postalCode}}<br>
        {{business.address.countryCode}}
      </p>
      {{/if}}
      {{#if business.email}}<p class="muted">{{business.email}}</p>{{/if}}
      {{#if business.phone}}<p class="muted">{{business.phone}}</p>{{/if}}
      {{#if business.website}}<p class="muted">{{business.website}}</p>{{/if}}
      {{#if business.taxId}}<p class="muted">Tax ID: {{business.taxId}}</p>{{/if}}
    </div>
  </div>

  <div class="grid">
    <div>
      <h3 style="margin:0 0 6px;font-size:13px; text-transform:uppercase; letter-spacing:.04em;">Prepared For</h3>
      {{#if customer}}
      <p style="margin:0;font-weight:600">{{customer.name}}</p>
      {{#if customer.companyName}}<p class="muted">{{customer.companyName}}</p>{{/if}}
      {{#if customer.address}}
      <p class="muted" style="margin:0">
        {{customer.address.addressLine1}}<br>
        {{#if customer.address.addressLine2}}{{customer.address.addressLine2}}<br>{{/if}}
        {{customer.address.city}}, {{customer.address.stateOrRegion}} {{customer.address.postalCode}}<br>
        {{customer.address.countryCode}}
      </p>
      {{/if}}
      {{#if customer.email}}<p class="muted">{{customer.email}}</p>{{/if}}
      {{#if customer.phone}}<p class="muted">{{customer.phone}}</p>{{/if}}
      {{else}}
      <p class="muted">No customer specified</p>
      {{/if}}
    </div>
    <div style="text-align:right">
      <p class="muted">Quote #</p>
      <p style="margin:0; font-size: 18px; font-weight: 600;">{{invoice.invoiceNumber}}</p>
      <p class="muted" style="margin-top:8px">Issue Date</p>
      <p style="margin:0">{{invoice.issueDate}}</p>
      <p class="muted" style="margin-top:8px">Valid Until</p>
      <p style="margin:0; font-weight: 600;">{{invoice.dueDate}}</p>
      {{#if invoice.status}}
      <p class="muted" style="margin-top:8px">Status</p>
      <p style="margin:0"><span class="status">{{invoice.status}}</span></p>
      {{/if}}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:50%">Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Tax</th>
        <th style="text-align:right">Line Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each lineItems}}
      <tr>
        <td>
          {{description}}
          {{#if isTaxInclusive}}<span class="tertiary"> (incl. tax)</span>{{/if}}
        </td>
        <td style="text-align:right">{{quantity}} {{unit}}</td>
        <td style="text-align:right">{{formatMoney unitPrice}}</td>
        <td style="text-align:right">{{formatRate taxRate}}</td>
        <td style="text-align:right">{{formatMoney lineTotal}}</td>
      </tr>
      {{/each}}
      {{#if lineItems.length}}
      {{#with totals}}
      <tr><td colspan="4" style="text-align:right; font-weight:600;">Subtotal</td><td style="text-align:right">{{formatMoney subtotal}}</td></tr>
      {{#if discountTotal}}
      <tr><td colspan="4" style="text-align:right">Discount</td><td style="text-align:right text-error-text">−{{formatMoney discountTotal}}</td></tr>
      {{/if}}
      <tr><td colspan="4" style="text-align:right; font-weight:600;">Tax</td><td style="text-align:right">{{formatMoney taxTotal}}</td></tr>
      {{#if feeTotal}}
      <tr><td colspan="4" style="text-align:right">Fees</td><td style="text-align:right">{{formatMoney feeTotal}}</td></tr>
      {{/if}}
      <tr class="big-total"><td colspan="4" style="text-align:right;">Estimated Total</td><td style="text-align:right">{{formatMoney total}}</td></tr>
      {{/with}}
      {{/if}}
    </tbody>
  </table>

  {{#if totals.total}}
  <div class="disclaimer">
    <strong>Note:</strong> This is a fixed-price estimate based on the scope described below.
    The final amount may vary if additional work is required beyond the specified scope.
  </div>
  {{/if}}

  {{#if invoice.terms}}
  <div class="footer" style="margin-top:24px">
    <h3 style="font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#666;">Terms &amp; Conditions</h3>
    <div class="terms-content">{{{nl2br invoice.terms}}}</div>
  </div>
  {{/if}}

  {{#if invoice.paymentInstructions}}
  <div class="footer" style="margin-top:24px">
    <h3 style="font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#666;">Payment Instructions</h3>
    <div class="payment-content">{{{nl2br invoice.paymentInstructions}}}</div>
  </div>
  {{/if}}

  <div class="footer" style="margin-top:24px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
    <p class="muted">Quote #{{invoice.invoiceNumber}}. This quote expires on {{invoice.dueDate}}.</p>
  </div>
</body>
</html>`;

templateCache.set(DEFAULT_QUOTE_TEMPLATE, Handlebars.compile(DEFAULT_QUOTE_TEMPLATE, { noEscape: true }));

export class TemplateRenderer {
  private defaultTemplate: string;

  constructor(defaultTemplate?: string) {
    this.defaultTemplate = defaultTemplate ?? DEFAULT_INVOICE_TEMPLATE;
  }

  renderQuote(data: InvoiceTemplateData, templateHtml?: string): string {
    const template = compileTemplate(
      templateHtml ?? (data.config?.htmlTemplate as string | undefined) ?? DEFAULT_QUOTE_TEMPLATE
    );
    return template({
      ...data,
      meta: getCurrencyMetadata(data.invoice.currency),
      appBaseUrl: env.APP_PUBLIC_BASE_URL,
    });
  }

  build(data: InvoiceTemplateData): any {
    return compileTemplate((data.config?.htmlTemplate as string | undefined) ?? this.defaultTemplate);
  }

  render(data: InvoiceTemplateData, templateHtml?: string): string {
    const template = compileTemplate(
      templateHtml ?? (data.config?.htmlTemplate as string | undefined) ?? this.defaultTemplate
    );
    return template({
      ...data,
      meta: getCurrencyMetadata(data.invoice.currency),
      appBaseUrl: env.APP_PUBLIC_BASE_URL,
    });
  }
}

export const templateRenderer = new TemplateRenderer();

export function buildTemplateData(
  invoice: {
    id: string;
    invoiceNumber: string | null;
    status: string;
    issueDate?: Date | null;
    dueDate?: Date | null;
    currency: CurrencyCode;
    notes?: string | null;
    terms?: string | null;
    paymentInstructions?: string | null;
  },
  business: TemplateBusiness,
  customer: TemplateCustomer | null,
  items: TemplateLineItem[],
  fees: TemplateFee[],
  totals: TemplateTotals,
  config: Record<string, unknown> = {}
): InvoiceTemplateData {
  return {
    business,
    customer,
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      issueDate: invoice.issueDate ? invoice.issueDate.toISOString().slice(0, 10) : null,
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
      currency: invoice.currency,
      notes: invoice.notes,
      terms: invoice.terms,
      paymentInstructions: invoice.paymentInstructions,
    },
    lineItems: items,
    fees,
    totals,
    config,
  };
}
