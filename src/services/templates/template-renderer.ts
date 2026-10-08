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
    poNumber?: string | null;
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
       {{#if customer.phone}}<p class="muted">{{customer.phone}}</p>{{/if}}
       {{#if customer.taxId}}<p class="muted">Tax ID: {{customer.taxId}}</p>{{/if}}
     </div>
    <div style="text-align:right">
      <p class="muted">{{meta.localeKey}}</p>
      <p><span class="muted">Issue date:</span> {{invoice.issueDate}}</p>
      <p><span class="muted">Due date:</span> {{invoice.dueDate}}</p>
      {{#if invoice.poNumber}}<p><span class="muted">PO #:</span> {{invoice.poNumber}}</p>{{/if}}
       <p><span class="muted">Currency:</span> {{meta.code}}</p>
       {{#if invoice.terms}}<p><span class="muted">Payment Terms:</span> {{invoice.terms}}</p>{{/if}}
       <p><span class="muted">Status:</span> <span class="status">{{invoice.status}}</span></p>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>#</th><th>Description</th><th>SKU</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Tax</th><th style="text-align:right">Line total</th></tr>
     </thead>
     <tbody>
       {{#each lineItems}}
       <tr>
         <td>{{add @index 1}}</td><td>{{description}}</td>
         <td>{{catalogSku}}</td>
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
    {{#if invoice.notes}}
    <div class="footer" style="margin-top:24px">
      <h3 style="font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#666;">Notes</h3>
      <p>{{{nl2br invoice.notes}}}</p>
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
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; background: #f8fafc; }
    .container { max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); overflow: hidden; }
    .header-section { padding: 40px; border-bottom: 3px solid #e2e8f0; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
    .business-col { text-align: right; }
    .logo { max-height: 70px; max-width: 200px; object-contain; }
    h1 { margin: 0; font-size: 28px; color: #0f172a; font-weight: 700; }
    h2 { margin: 4px 0 0; font-size: 20px; color: #1e293b; font-weight: 600; }
    h3 { margin: 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
    .muted { color: #64748b; font-size: 13px; line-height: 1.5; }
    .tertiary { color: #94a3a5; font-size: 12px; line-height: 1.4; }
    .highlight { color: #2563eb; font-weight: 600; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 24px; }
    .meta-item { }
    .meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3a5; display: block; margin-bottom: 4px; }
    .meta-value { font-size: 15px; font-weight: 600; color: #0f172a; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .expiry-warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; color: #92400e; font-size: 13px; margin-top: 16px; }
    .disclaimer { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 20px; margin-top: 16px; font-size: 12px; color: #475569; line-height: 1.5; }
    .signature-line { border-top: 1px solid #cbd5e1; padding-top: 24px; margin-top: 24px; }
    .centered { text-align: center; }
    .section { padding: 40px; border-bottom: 1px solid #e2e8f0; }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-bottom: 16px; }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .items-table td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; line-height: 1.5; }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .align-top { vertical-align: top; }
    .totals-table { width: 100%; max-width: 360px; margin-left: auto; border-collapse: collapse; }
    .totals-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
    .totals-label { color: #64748b; font-weight: 500; }
    .totals-value { color: #0f172a; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
    .big-total-row td { font-weight: 700; font-size: 16px; }
    .big-total-label { color: #64748b; }
    .big-total-value { color: #2563eb; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
    .terms-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; }
    .terms-box ol, .terms-box ul { margin: 0; padding-left: 20px; }
    .terms-box li { margin-bottom: 6px; font-size: 13px; color: #334155; line-height: 1.5; }
    .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; }
    .notes-box p { margin: 0; font-size: 13px; color: #334155; line-height: 1.5; }
    .footer { padding: 24px 40px; background: #f8fafc; text-align: center; font-size: 12px; color: #94a3a5; }
  </style>
</head>
<body>
<div class="container">

  <!-- ========== HEADER SECTION ========== -->
  <div class="header-section">
    <div class="header-grid">
      <div class="business-col">
        {{#if business.logoUrl}}
        <img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}" />
        {{/if}}
        <div style="margin-top: 8px;">
          <h2 style="margin: 0; font-size: 20px; color: #0f172a; font-weight: 700;">{{business.name}}</h2>
          {{#if business.legalName}}<p class="muted">{{business.legalName}}</p>{{/if}}
          {{#if business.email}}<p class="muted">{{business.email}}</p>{{/if}}
          {{#if business.phone}}<p class="muted">{{business.phone}}</p>{{/if}}
          {{#if business.website}}<a href="{{#if (startswith business.website "http")}}{{business.website}}{{else}}https://{{business.website}}{{/if}}" class="muted">{{business.website}}</a>{{/if}}
          {{#if business.taxId}}<p class="tertiary">Tax ID: {{business.taxId}}</p>{{/if}}
          {{#if business.address}}
          <p class="muted" style="margin: 4px 0 0; white-space: pre-line;">
            {{business.address.addressLine1}}<br />
            {{#if business.address.addressLine2}}{{business.address.addressLine2}}<br />{{/if}}
            {{business.address.city}}, {{business.address.stateOrRegion}} {{business.address.postalCode}}<br />
            {{business.address.countryCode}}
          </p>
          {{/if}}
        </div>
      </div>

      <div class="business-col" style="text-align: right;">
        <h1 style="margin: 0;">Quote</h1>
        <div class="meta-grid" style="justify-items: end;">
          <div class="meta-item">
            <span class="meta-label">Quote #</span>
            <span class="meta-value">{{invoice.invoiceNumber}}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Quote Date</span>
            <span class="meta-value">{{invoice.issueDate}}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Expiration Date</span>
            <span class="meta-value">{{invoice.dueDate}}</span>
          </div>
          {{#if invoice.status}}
          <div class="meta-item">
            <span class="meta-label">Status</span>
            <span class="meta-value">
              <span class="badge" style="background: #f1f5f9; color: #475569;">{{invoice.status}}</span>
            </span>
          </div>
          {{/if}}
          {{#if invoice.poNumber}}
          <div class="meta-item">
            <span class="meta-label">P.O. Number</span>
            <span class="meta-value">{{invoice.poNumber}}</span>
          </div>
          {{/if}}
          <div class="meta-item">
            <span class="meta-label">Currency</span>
            <span class="meta-value">{{meta.code}}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Prepared For / Customer Details -->
    <div class="divider"></div>
    <h3 style="margin: 0 0 12px;">Prepared For</h3>
    {{#if customer}}
    <div class="meta-grid" style="grid-template-columns: 1fr;">
      <div class="meta-item">
        <span class="meta-label">Customer Name</span>
        <span class="meta-value">{{customer.name}}</span>
      </div>
      {{#if customer.companyName}}
      <div class="meta-item">
        <span class="meta-label">Company</span>
        <span class="meta-value">{{customer.companyName}}</span>
      </div>
      {{/if}}
      {{#if customer.email}}
      <div class="meta-item">
        <span class="meta-label">Email</span>
        <span class="meta-value highlight">{{customer.email}}</span>
      </div>
      {{/if}}
      {{#if customer.phone}}
      <div class="meta-item">
        <span class="meta-label">Phone</span>
        <span class="meta-value">{{customer.phone}}</span>
      </div>
      {{/if}}
      {{#if customer.taxId}}
      <div class="meta-item">
        <span class="meta-label">Tax ID</span>
        <span class="meta-value">{{customer.taxId}}</span>
      </div>
      {{/if}}
      {{#if customer.address}}
      <div class="meta-item">
        <span class="meta-label">Address</span>
        <span class="meta-value" style="white-space: pre-line; font-weight: 400; font-size: 13px; color: #475569;">
          {{customer.address.addressLine1}}<br />
          {{#if customer.address.addressLine2}}{{customer.address.addressLine2}}<br />{{/if}}
          {{customer.address.city}}, {{customer.address.stateOrRegion}} {{customer.address.postalCode}}<br />
          {{customer.address.countryCode}}
        </span>
      </div>
      {{/if}}
    </div>
    {{else}}
    <p class="muted" style="margin: 0;">No customer specified</p>
    {{/if}}

    <p style="margin-top: 24px; font-style: italic; color: #94a3a5;">This quote is valid until {{invoice.dueDate}}.</p>
  </div>

  <!-- ========== LINE ITEMS SECTION ========== -->
  <div class="section">
    <div class="section-title">Line Items</div>
    {{#if lineItems.length}}
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 45%;">Description</th>
          <th class="text-right" style="width: 10%;">Qty</th>
          <th class="text-right" style="width: 15%;">Unit Price</th>
          <th class="text-right" style="width: 10%;">Tax</th>
          <th class="text-right" style="width: 20%;">Line Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each lineItems}}
        <tr>
          <td class="align-top">
            {{description}}
            {{#if catalogName}}<span class="tertiary" style="display: block; margin-top: 2px;">{{catalogName}}</span>{{/if}}
            {{#if isTaxInclusive}}<span class="tertiary" style="display: block; margin-top: 2px;">(incl. tax)</span>{{/if}}
          </td>
          <td class="text-right align-top">{{quantity}} {{unit}}</td>
          <td class="text-right align-top">{{formatMoney unitPrice}}</td>
          <td class="text-right align-top">{{formatRate taxRate}}</td>
          <td class="text-right align-top">{{formatMoney lineTotal}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{else}}
    <div class="terms-box">
      <p style="margin: 0; color: #94a3a5; font-style: italic;">No line items added.</p>
    </div>
    {{/if}}
  </div>

  <!-- ========== FEES SECTION ========== -->
  {{#if fees.length}}
  <div class="section">
    <div class="section-title">Additional Fees</div>
    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Tax</th>
          <th class="text-right">Fee</th>
        </tr>
      </thead>
      <tbody>
        {{#each fees}}
        <tr>
          <td>{{description}}</td>
          <td class="text-right">{{formatMoney amount}}</td>
          <td class="text-right">{{formatRate taxRate}}</td>
          <td class="text-right">{{formatMoney (add amount (default 0 taxAmount))}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/if}}

  <!-- ========== FINANCIAL SUMMARY SECTION ========== -->
  <div class="section">
    <div class="section-title">Financial Summary</div>
    <table class="totals-table">
      <tr>
        <td class="totals-label">Subtotal</td>
        <td class="totals-value">{{formatMoney totals.subtotal}}</td>
      </tr>
      {{#if discountTotal}}
      <tr>
        <td class="totals-label">Discount</td>
        <td class="totals-value" style="color: #16a34a;">-{{formatMoney totals.discountTotal}}</td>
      </tr>
      {{/if}}
      {{#if taxTotal}}
      <tr>
        <td class="totals-label">Tax</td>
        <td class="totals-value">{{formatMoney totals.taxTotal}}</td>
      </tr>
      {{/if}}
      {{#if feeTotal}}
      <tr>
        <td class="totals-label">Fees</td>
        <td class="totals-value">{{formatMoney totals.feeTotal}}</td>
      </tr>
      {{/if}}
      <tr class="big-total-row">
        <td class="big-total-label">Estimated Total</td>
        <td class="big-total-value">{{formatMoney totals.total}}</td>
      </tr>
    </table>

    {{#if invoice.notes}}
    <div class="disclaimer">
      <strong>Note:</strong> This is a fixed-price estimate based on the scope described below. The final amount may vary if additional work is required beyond the specified scope.
    </div>
    {{/if}}
  </div>

  <!-- ========== TERMS AND CONDITIONS SECTION ========== -->
  <div class="section">
    <div class="section-title">Terms &amp; Conditions</div>

    <!-- Payment Terms -->
    <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Payment Terms</h3>
    {{#if invoice.terms}}
    <div class="terms-box">
      {{{nl2br invoice.terms}}}
    </div>
    {{else}}
    <div class="notes-box">
      <p style="margin: 0;">Payment terms and conditions will be specified here.</p>
    </div>
    {{/if}}

    <!-- Scope of Work / Project Terms -->
    {{#if invoice.notes}}
    <div style="margin-top: 24px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Scope of Work</h3>
      <div class="terms-box">
        {{{nl2br invoice.notes}}}
      </div>
    </div>
    {{/if}}

    <!-- Payment Instructions -->
    {{#if invoice.paymentInstructions}}
    <div style="margin-top: 24px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Payment Instructions</h3>
      <div class="terms-box">
        {{{nl2br invoice.paymentInstructions}}}
      </div>
    </div>
    {{/if}}

    <!-- Notes & Assumptions -->
    <div style="margin-top: 24px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Notes &amp; Assumptions</h3>
      <div class="notes-box">
        {{#if invoice.notes}}
        {{{nl2br invoice.notes}}}
        {{else}}
        <p style="margin: 0; color: #94a3a5; font-style: italic;">Add notes and assumptions relevant to this quote.</p>
        {{/if}}
      </div>
    </div>
  </div>

  <!-- ========== FOOTER ========== -->
  <div class="footer">
    <p style="margin: 0;">Quote #{{invoice.invoiceNumber}}. This quote expires on {{invoice.dueDate}}.</p>
    <p style="margin: 4px 0 0;">All rights reserved.</p>
  </div>

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
    poNumber?: string | null;
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
      poNumber: invoice.poNumber,
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
