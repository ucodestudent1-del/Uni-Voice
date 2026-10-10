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
  registrationNumber?: string | null;
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

export interface TemplatePaymentInstructions {
  methods?: TemplatePaymentMethod[];
  bankDetails?: string | null;
  paymentLink?: string | null;
  lateFeeType?: "none" | "fixed" | "percentage" | null;
  lateFeeValue?: string | null;
  lateFeePeriodDays?: number | null;
  taxExemption?: string | null;
  deliveryDetails?: string | null;
  warrantyInfo?: string | null;
  returnPolicy?: string | null;
  customFields?: TemplateCustomField[];
}

export interface TemplatePaymentMethod {
  type: "bank" | "card" | "paypal" | "stripe" | "custom";
  label: string;
  details?: string | null;
  url?: string | null;
  instructions?: string | null;
}

export interface TemplateCustomField {
  label: string;
  value: string;
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
    title?: string | null;
    depositType?: string | null;
    depositValue?: string | null;
    depositDueDate?: string | null;
    depositPaid?: boolean | null;
    isFinalized?: boolean;
    depositAmount?: string | null;
    projectId?: string | null;
    projectName?: string | null;
  };
  lineItems: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  paymentInstructions?: TemplatePaymentInstructions | null;
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

Handlebars.registerHelper("gt", (a: number, b: number): boolean => a > b);

Handlebars.registerHelper("eq", (a: unknown, b: unknown): boolean => a === b);

Handlebars.registerHelper("or", (...args: unknown[]): boolean => {
  const options = args[args.length - 1] as any;
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i]) return true;
  }
  return false;
});

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

Handlebars.registerHelper("formatDate", (iso: string | null | undefined, fmt?: string): string => {
  if (!iso) return "";
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, day] = iso.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(iso);
  }
  if (isNaN(d.getTime())) return iso ?? "";
  if (fmt === "long") {
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  if (fmt === "short") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
});

Handlebars.registerHelper("startswith", (str: string | null | undefined, prefix: string): boolean => {
  if (!str) return false;
  return str.startsWith(prefix);
});

Handlebars.registerHelper("default", function (fallback: unknown, value: unknown): unknown {
  return value ?? fallback;
});

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
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice {{invoice.invoiceNumber}}</title>
  <style>
    body { margin: 0; padding: 0; color: #1e293b; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; line-height: 1.5; }
    .page { max-width: 900px; margin: 0 auto; padding: 56px 40px; }
    /* ===== Design tokens ===== */
    :root {
      --color-bg: #ffffff;
      --color-surface: #f8fafc;
      --color-border: #e2e8f0;
      --color-border-strong: #cbd5e1;
      --color-text-primary: #0f172a;
      --color-text-secondary: #475569;
      --color-text-tertiary: #94a3a5;
      --color-brand: #2563eb;
      --color-brand-hover: #1d4ed8;
      --color-success: #065f46;
      --color-success-bg: #d1fae5;
      --color-warning: #92400e;
      --color-warning-bg: #fef3c7;
      --color-error: #991b1b;
      --color-error-bg: #fee2e2;
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-full: 20px;
    }
    /* ===== Layout ===== */
    .header-section { padding-bottom: 24px; border-bottom: 3px solid var(--color-brand); }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
    .business-col { text-align: right; }
    .logo { max-height: 80px; max-width: 240px; object-contain; }
    .section { padding: 32px 0; border-bottom: 1px solid var(--color-border); }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-tertiary); margin-bottom: 16px; }
    .divider { height: 1px; background: var(--color-border); margin: 32px 0; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    /* ===== Typography ===== */
    h1 { margin: 0; font-size: 28px; color: var(--color-text-primary); font-weight: 700; }
    h2 { margin: 4px 0 0; font-size: 20px; color: var(--color-text-primary); font-weight: 700; }
    h3 { margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); }
    .muted { color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
    .tertiary { color: var(--color-text-tertiary); font-size: 12px; line-height: 1.4; }
    .highlight { color: var(--color-brand); font-weight: 600; }
    /* ===== Meta grid ===== */
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 20px; }
    .meta-item {}
    .meta-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); display: block; margin-bottom: 4px; }
    .meta-value { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
    .meta-value-long { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); white-space: pre-wrap; word-break: break-word; }
    /* ===== Tables ===== */
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table th { background: var(--color-surface); padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); border-bottom: 2px solid var(--color-border); }
    .items-table td { padding: 14px 16px; border-bottom: 1px solid var(--color-border); font-size: 13px; line-height: 1.5; }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .align-top { vertical-align: top; }
    /* ===== Totals ===== */
    .totals-table { width: 100%; max-width: 380px; margin-left: auto; border-collapse: collapse; }
    .totals-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid var(--color-border); }
    .totals-label { color: var(--color-text-tertiary); font-weight: 500; }
    .totals-value { color: var(--color-text-primary); font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
    .big-total-row td { font-weight: 700; font-size: 16px; }
    .big-total-label { color: var(--color-text-tertiary); }
    .big-total-value { color: var(--color-brand); }
    .paid-amount { color: var(--color-success); font-weight: 600; }
    .balance-due { color: var(--color-brand); font-weight: 700; font-size: 18px; }
    /* ===== Status badges ===== */
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: var(--radius-full); font-size: 12px; font-weight: 600; }
    .status-draft { background: var(--color-warning-bg); color: var(--color-warning); }
    .status-sent { background: #dbeafe; color: var(--color-brand-hover); }
    .status-viewed { background: #dbeafe; color: var(--color-brand-hover); }
    .status-partially_paid { background: var(--color-warning-bg); color: var(--color-warning); }
    .status-paid { background: var(--color-success-bg); color: var(--color-success); }
    .status-overdue { background: var(--color-error-bg); color: var(--color-error); }
    .status-cancelled { background: #f1f5f9; color: var(--color-text-secondary); }
    .status-void { background: #f1f5f9; color: var(--color-text-secondary); }
    /* ===== Boxes ===== */
    .info-box { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px 20px; }
    .info-box ol, .info-box ul { margin: 0; padding-left: 20px; }
    .info-box li { margin-bottom: 6px; font-size: 13px; color: #334155; line-height: 1.5; }
    .info-box p { margin: 0 0 8px 0; font-size: 13px; color: #334155; line-height: 1.5; }
    .info-box p:last-child { margin-bottom: 0; }
    .payment-methods-list { list-style: none; margin: 0; padding: 0; }
    .payment-methods-list li { padding: 8px 0; border-bottom: 1px solid var(--color-border); font-size: 13px; line-height: 1.5; }
    .payment-methods-list li:last-child { border-bottom: none; }
    .custom-field-row td { padding: 6px 16px; font-size: 13px; }
    /* ===== QR / payment link ===== */
    .payment-cta { text-align: center; }
    .pay-btn { display: inline-block; margin-top: 12px; padding: 12px 32px; background: var(--color-brand); color: #ffffff; text-decoration: none; border-radius: var(--radius-md); font-size: 15px; font-weight: 600; }
    .pay-btn:hover { background: var(--color-brand-hover); }
    /* ===== Footer ===== */
    .footer { padding: 24px 0; font-size: 12px; color: var(--color-text-tertiary); border-top: 1px solid var(--color-border); }
    .footer p { margin: 0; }
    .footer p + p { margin-top: 4px; }
    .thank-you { font-size: 14px; font-weight: 500; color: var(--color-text-secondary); }
    @media (max-width: 600px) {
      .page { padding: 24px 16px; }
      .header-grid { grid-template-columns: 1fr; }
      .business-col { text-align: left; }
      .meta-grid { grid-template-columns: 1fr; }
      .totals-table { max-width: 100%; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ========== HEADER: Business info (left) + Invoice details (right) ========== -->
  <div class="header-section">
    <div class="header-grid">
      <!-- Business / seller info -->
      <div>
        {{#if business.logoUrl}}
        <img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}" />
        {{/if}}
        <div style="margin-top: 8px;">
          <h3 style="margin: 0; font-size: 18px; color: var(--color-text-primary); font-weight: 700;">{{business.name}}</h3>
          {{#if business.legalName}}<p class="muted">{{business.legalName}}</p>{{/if}}
          {{#if business.email}}<p class="muted">{{business.email}}</p>{{/if}}
          {{#if business.phone}}<p class="muted">{{business.phone}}</p>{{/if}}
          {{#if business.website}}
          <p class="muted">
            <a href="{{#if (startswith business.website "http")}}{{business.website}}{{else}}https://{{business.website}}{{/if}}" style="color: var(--color-brand); text-decoration: none;">{{business.website}}</a>
          </p>
          {{/if}}
          {{#if business.taxId}}<p class="tertiary">Tax ID: {{business.taxId}}</p>{{/if}}
          {{#if business.registrationNumber}}<p class="tertiary">Reg #: {{business.registrationNumber}}</p>{{/if}}
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

      <!-- Invoice metadata -->
      <div class="business-col">
        <h1>{{#if invoice.title}}{{invoice.title}}{{else}}Invoice{{/if}}</h1>
        <div class="meta-grid" style="justify-items: end;">
          <div class="meta-item">
            <span class="meta-label">Invoice #</span>
            <span class="meta-value">{{invoice.invoiceNumber}}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Status</span>
            <span class="meta-value">
              <span class="status-badge status-{{invoice.status}}">{{invoice.status}}</span>
            </span>
          </div>
          {{#if invoice.issueDate}}
          <div class="meta-item">
            <span class="meta-label">Issue Date</span>
            <span class="meta-value">{{formatDate invoice.issueDate}}</span>
          </div>
          {{/if}}
          {{#if invoice.dueDate}}
          <div class="meta-item">
            <span class="meta-label">Due Date</span>
            <span class="meta-value">{{formatDate invoice.dueDate}}</span>
          </div>
          {{/if}}
          {{#if invoice.poNumber}}
          <div class="meta-item">
            <span class="meta-label">P.O. Number</span>
            <span class="meta-value">{{invoice.poNumber}}</span>
          </div>
          {{/if}}
          {{#if invoice.projectName}}
          <div class="meta-item">
            <span class="meta-label">Project</span>
            <span class="meta-value">{{invoice.projectName}}</span>
          </div>
          {{/if}}
          <div class="meta-item">
            <span class="meta-label">Currency</span>
            <span class="meta-value">{{meta.code}}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ========== CUSTOM FIELDS (supplemental, top of body) ========== -->
  {{#if paymentInstructions.customFields}}
  {{#each paymentInstructions.customFields}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <table class="items-table">
      <tr>
        <th>{{label}}</th>
        <td class="meta-value-long">{{value}}</td>
      </tr>
    </table>
  </div>
  {{/each}}
  {{/if}}

  <!-- ========== BILL TO + SHIP TO ========== -->
  {{#if customer}}
  <div class="section">
    <div class="grid-2">
      <!-- Bill To -->
      <div>
        <h3 style="margin: 0 0 12px;">Bill To</h3>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Customer</span>
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
            <span class="meta-value meta-value-long">
              {{customer.address.addressLine1}}<br />
              {{#if customer.address.addressLine2}}{{customer.address.addressLine2}}<br />{{/if}}
              {{customer.address.city}}, {{customer.address.stateOrRegion}} {{customer.address.postalCode}}<br />
              {{customer.address.countryCode}}
            </span>
          </div>
          {{/if}}
        </div>
      </div>
      <!-- Ship To (if delivery details provided) -->
      {{#if paymentInstructions.deliveryDetails}}
      <div>
        <h3 style="margin: 0 0 12px;">Delivery Details</h3>
        <div class="info-box">
          <p class="meta-value-long">{{{nl2br paymentInstructions.deliveryDetails}}}</p>
        </div>
      </div>
      {{/if}}
    </div>
  </div>
  {{/if}}

  <!-- ========== LINE ITEMS ========== -->
  <div class="section">
    <div class="section-title">{{#if invoice.title}}Items{{else}}Line Items{{/if}}</div>
    {{#if lineItems.length}}
    <div class="items-table" style="overflow-x: auto;">
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 35%;">Description</th>
          <th style="width: 8%;" class="text-right">Qty</th>
          <th style="width: 12%;" class="text-right">Unit Price</th>
          <th style="width: 10%;" class="text-right">Discount</th>
          <th style="width: 10%;" class="text-right">Tax Rate</th>
          <th style="width: 15%;" class="text-right">Tax Amount</th>
          <th style="width: 15%;" class="text-right">Line Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each lineItems}}
        <tr>
          <td class="align-top">{{add @index 1}}</td>
          <td class="align-top">
            {{{nl2br description}}}
            {{#if catalogName}}<span class="tertiary" style="display: block; margin-top: 2px;">{{catalogName}}</span>{{/if}}
            {{#if catalogSku}}<span class="tertiary" style="display: block; margin-top: 2px;">SKU: {{catalogSku}}</span>{{/if}}
            {{#if isTaxInclusive}}<span class="tertiary" style="display: block; margin-top: 2px;">(incl. tax)</span>{{/if}}
          </td>
          <td class="text-right align-top">{{quantity}} {{unit}}</td>
          <td class="text-right align-top">{{formatMoney unitPrice}}</td>
          <td class="text-right align-top">
            {{#if discount}}-{{formatMoney discount}}{{/if}}
            {{^if discount}}—{{/if}}
          </td>
          <td class="text-right align-top">{{formatRate taxRate}}</td>
          <td class="text-right align-top">{{formatMoney taxAmount}}</td>
          <td class="text-right align-top">{{formatMoney lineTotal}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    </div>
    {{else}}
    <div class="info-box">
      <p style="margin: 0; color: var(--color-text-tertiary); font-style: italic;">No line items added.</p>
    </div>
    {{/if}}
  </div>

  <!-- ========== FEES ========== -->
  {{#if fees.length}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Additional Fees</div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50%;">Description</th>
          <th style="width: 20%;" class="text-right">Amount</th>
          <th style="width: 15%;" class="text-right">Tax Rate</th>
          <th style="width: 15%;" class="text-right">Tax</th>
          <th style="width: 15%;" class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each fees}}
        <tr>
          <td>{{description}}</td>
          <td class="text-right">{{formatMoney amount}}</td>
          <td class="text-right">{{formatRate taxRate}}</td>
          <td class="text-right">{{formatMoney taxAmount}}</td>
          <td class="text-right">{{formatMoney (add amount (default 0 taxAmount))}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/if}}

  <!-- ========== FINANCIAL SUMMARY ========== -->
  <div class="divider"></div>
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Financial Summary</div>
    <table class="totals-table">
      <tr>
        <td class="totals-label">Subtotal</td>
        <td class="totals-value">{{formatMoney totals.subtotal}}</td>
      </tr>
      {{#if totals.discountTotal}}
      <tr>
        <td class="totals-label">Discount</td>
        <td class="totals-value" style="color: var(--color-success);">−{{formatMoney totals.discountTotal}}</td>
      </tr>
      {{/if}}
      <tr>
        <td class="totals-label">Tax</td>
        <td class="totals-value">{{formatMoney totals.taxTotal}}</td>
      </tr>
      {{#if fees.length}}
      <tr>
        <td class="totals-label">Fees</td>
        <td class="totals-value">{{formatMoney totals.feeTotal}}</td>
      </tr>
      {{/if}}
      <tr class="big-total-row">
        <td class="big-total-label">Total</td>
        <td class="big-total-value">{{formatMoney totals.total}}</td>
      </tr>
      {{#if totals.amountPaid}}
      <tr>
        <td class="totals-label">Amount Paid</td>
        <td class="totals-value paid-amount">+{{formatMoney totals.amountPaid}}</td>
      </tr>
      {{/if}}
      <tr>
        <td class="totals-label balance-due-label">Balance Due</td>
        <td class="totals-value balance-due">{{formatMoney totals.amountDue}}</td>
      </tr>
    </table>
  </div>

  <!-- ========== PAYMENT INSTRUCTIONS ========== -->
  {{#if (or invoice.paymentInstructions paymentInstructions)}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Payment Instructions</div>
    <div class="info-box">
      <div class="grid-2" style="gap: 20px;">

        <!-- Left column: Methods, bank details, payment link -->
        <div>
          {{#if paymentInstructions.methods}}
          <div style="margin-bottom: 16px;">
            <span class="meta-label">Accepted Payment Methods</span>
            <ul class="payment-methods-list">
              {{#each paymentInstructions.methods}}
              <li>
                <strong>{{label}}</strong>
                {{#if details}}<br /><span class="tertiary">{{details}}</span>{{/if}}
                {{#if url}}<br /><a href="{{url}}" style="color: var(--color-brand); text-decoration: none;">Pay online</a>{{/if}}
                {{#if instructions}}<br /><span class="tertiary">{{instructions}}</span>{{/if}}
              </li>
              {{/each}}
            </ul>
          </div>
          {{/if}}

          {{#if paymentInstructions.bankDetails}}
          <div style="margin-bottom: 16px;">
            <span class="meta-label">Bank Details</span>
            <p class="muted" style="white-space: pre-line; margin: 0;">{{paymentInstructions.bankDetails}}</p>
          </div>
          {{/if}}

          {{#if paymentInstructions.paymentLink}}
          <div style="margin-top: 16px;" class="payment-cta">
            <span class="meta-label">Pay Online</span>
            <div>
              <a href="{{paymentInstructions.paymentLink}}" class="pay-btn">Pay Now</a>
            </div>
            <p class="tertiary" style="margin-top: 8px;">Or scan the QR code / click above to pay securely online.</p>
          </div>
          {{/if}}

          {{#if paymentInstructions.taxExemption}}
          <div style="margin-top: 16px;">
            <span class="meta-label">Tax Exemption</span>
            <p class="muted" style="white-space: pre-line; margin: 0;">{{paymentInstructions.taxExemption}}</p>
          </div>
          {{/if}}
        </div>

        <!-- Right column: Currency, late terms, warranty, returns -->
        <div>
          <div style="margin-bottom: 16px;">
            <span class="meta-label">Currency</span>
            <p class="muted" style="margin: 0;">{{meta.code}} ({{meta.name}})</p>
          </div>

          {{#if invoice.paymentInstructions}}
          <div style="margin-bottom: 16px;">
            <span class="meta-label">Additional Payment Info</span>
            <div class="muted" style="white-space: pre-line;">{{{nl2br invoice.paymentInstructions}}}</div>
          </div>
          {{/if}}

          {{#if paymentInstructions.lateFeeType}}
          {{#if (eq paymentInstructions.lateFeeType "fixed")}}
          <div style="margin-bottom: 16px;">
            <span class="meta-label">Late Fee</span>
            <p class="muted" style="margin: 0;">A fixed fee of {{formatMoney paymentInstructions.lateFeeValue}} will be applied to overdue balances.</p>
          </div>
          {{/if}}
          {{#if (eq paymentInstructions.lateFeeType "percentage")}}
          <div style="margin-bottom: 16px;">
            <span class="meta-label">Late Fee</span>
            <p class="muted" style="margin: 0;">An overdue balance will incur a late fee of {{paymentInstructions.lateFeeValue}}%.</p>
          </div>
          {{/if}}
          {{/if}}

          {{#if paymentInstructions.warrantyInfo}}
          <div style="margin-bottom: 16px;">
            <span class="meta-label">Warranty</span>
            <p class="muted" style="white-space: pre-line; margin: 0;">{{{nl2br paymentInstructions.warrantyInfo}}}</p>
          </div>
          {{/if}}

          {{#if paymentInstructions.returnPolicy}}
          <div style="margin-bottom: 16px;">
            <span class="meta-label">Return Policy</span>
            <p class="muted" style="white-space: pre-line; margin: 0;">{{{nl2br paymentInstructions.returnPolicy}}}</p>
          </div>
          {{/if}}
        </div>
      </div>
    </div>
  </div>
  {{/if}}

  <!-- ========== NOTES ========== -->
  {{#if invoice.notes}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Notes</div>
    <div class="info-box">
      {{{nl2br invoice.notes}}}
    </div>
  </div>
  {{/if}}

  <!-- ========== TERMS & CONDITIONS ========== -->
  {{#if invoice.terms}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Terms &amp; Conditions</div>
    <div class="info-box">
      {{{nl2br invoice.terms}}}
    </div>
  </div>
  {{/if}}

  <!-- ========== FOOTER ========== -->
  <div class="footer">
    {{#if invoice.isFinalized}}
    <p>Invoice #{{invoice.invoiceNumber}} — {{business.name}}</p>
    {{#if business.email}}<p>Contact: {{business.email}}</p>{{/if}}
    {{else}}
    <p>This is a draft invoice. Not yet finalized.</p>
    {{/if}}
    <p style="margin-top: 8px;" class="thank-you">Thank you for your business.</p>
  </div>

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
      {{#if invoice.depositAmount}}
      <tr class="deposit-row">
        <td class="totals-label">Deposit Required</td>
        <td class="totals-value" style="color: #2563eb;">{{formatMoney invoice.depositAmount}}</td>
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

    <!-- Structured Payment Methods -->
    {{#if paymentInstructions}}
    {{#if paymentInstructions.methods}}
    <div style="margin-top: 24px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Accepted Payment Methods</h3>
      {{#each paymentInstructions.methods}}
      <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #0f172a;">{{label}}</p>
        {{#if details}}<p style="margin: 0; font-size: 12px; color: #475569; white-space: pre-line;">{{details}}</p>{{/if}}
        {{#if url}}<p style="margin: 0; font-size: 12px; color: #2563eb;"><a href="{{url}}" style="color: #2563eb;">Pay online</a></p>{{/if}}
      </div>
      {{/each}}
    </div>
    {{/if}}

    {{#if paymentInstructions.bankDetails}}
    <div style="margin-top: 16px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Bank Details</h3>
      <div class="terms-box">
        <p style="margin: 0; white-space: pre-line;">{{paymentInstructions.bankDetails}}</p>
      </div>
    </div>
    {{/if}}

    {{#if paymentInstructions.lateFeeType}}
    <div style="margin-top: 16px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Late Payment Terms</h3>
      <div class="terms-box">
        {{#if (eq paymentInstructions.lateFeeType "fixed")}}
        <p style="margin: 0;">A fixed fee of {{formatMoney paymentInstructions.lateFeeValue}} will be applied to overdue balances.</p>
        {{/if}}
        {{#if (eq paymentInstructions.lateFeeType "percentage")}}
        <p style="margin: 0;">An overdue balance will incur a late fee of {{paymentInstructions.lateFeeValue}}%.</p>
        {{/if}}
      </div>
    </div>
    {{/if}}

    {{#if paymentInstructions.taxExemption}}
    <div style="margin-top: 16px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Tax Exemption</h3>
      <div class="terms-box">
        <p style="margin: 0; white-space: pre-line;">{{paymentInstructions.taxExemption}}</p>
      </div>
    </div>
    {{/if}}

    {{#if paymentInstructions.deliveryDetails}}
    <div style="margin-top: 16px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Delivery Details</h3>
      <div class="terms-box">
        <p style="margin: 0; white-space: pre-line;">{{paymentInstructions.deliveryDetails}}</p>
      </div>
    </div>
    {{/if}}

    {{#if paymentInstructions.warrantyInfo}}
    <div style="margin-top: 16px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Warranty</h3>
      <div class="terms-box">
        <p style="margin: 0; white-space: pre-line;">{{paymentInstructions.warrantyInfo}}</p>
      </div>
    </div>
    {{/if}}

    {{#if paymentInstructions.returnPolicy}}
    <div style="margin-top: 16px;">
      <h3 style="font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 12px;">Return Policy</h3>
      <div class="terms-box">
        <p style="margin: 0; white-space: pre-line;">{{paymentInstructions.returnPolicy}}</p>
      </div>
    </div>
    {{/if}}
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

  <!-- ========== ACCEPTANCE ========== -->
  {{#if invoice.isFinalized}}
  <div class="section">
    <div class="section-title">Acceptance</div>
    <div class="terms-box">
      <p style="margin: 0 0 12px; font-size: 13px; color: #334155; line-height: 1.5;">
        By signing below, you accept this quote and authorize work to begin.
      </p>
      <table style="width: 100%; margin-bottom: 16px;">
        <tr>
          <td style="width: 30%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;">
            <span style="font-size: 11px; color: #94a3a5;">Signature</span>
          </td>
          <td style="width: 30%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;">
            <span style="font-size: 11px; color: #94a3a5;">Print Name</span>
          </td>
          <td style="width: 40%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;">
            <span style="font-size: 11px; color: #94a3a5;">Date</span>
          </td>
        </tr>
      </table>
      <div style="display: flex gap: 12px; font-size: 13px; color: #334155;">
        <span style="display: inline-flex align-middle">Electronic acceptance</span>
      </div>
      <p style="margin-top: 8px; font-size: 12px; color: #94a3a5; line-height: 1.5;">
        This quote is valid until {{invoice.dueDate}}. A deposit is required to begin work unless otherwise agreed.
      </p>
    </div>
  </div>
  {{/if}}

  <!-- ========== FOOTER ========== -->
  <div class="footer">
    <p style="margin: 0;">Quote #{{invoice.invoiceNumber}}. This quote expires on {{invoice.dueDate}}.</p>
    <p style="margin: 4px 0 0;">All rights reserved.</p>
  </div>

</div>
</body>
</html>`;

export const MINIMAL_QUOTE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{invoice.language}}">
<head>
  <meta charset="utf-8">
  <title>Quote {{invoice.invoiceNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #1e293b; background: #ffffff; }
    .container { max-width: 900px; margin: 0 auto; padding: 56px 40px; }
    .header-section { padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
    .business-col { text-align: right; }
    .logo { max-height: 60px; max-width: 180px; object-contain; }
    h1 { margin: 0; font-size: 24px; color: #0f172a; font-weight: 700; }
    h2 { margin: 4px 0 0; font-size: 18px; color: #1e293b; font-weight: 600; }
    .muted { color: #64748b; font-size: 13px; line-height: 1.5; }
    .tertiary { color: #94a3a5; font-size: 12px; line-height: 1.4; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 20px; }
    .meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3a5; display: block; margin-bottom: 4px; }
    .meta-value { font-size: 15px; font-weight: 600; color: #0f172a; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
    .section { padding: 32px 0; border-bottom: 1px solid #e2e8f0; }
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
    .terms-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; }
    .terms-box ol, .terms-box ul { margin: 0; padding-left: 20px; }
    .terms-box li { margin-bottom: 6px; font-size: 13px; color: #334155; line-height: 1.5; }
    .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; }
    .notes-box p { margin: 0; font-size: 13px; color: #334155; line-height: 1.5; }
    .footer { padding: 24px 0; font-size: 12px; color: #94a3a5; border-top: 1px solid #e2e8f0; }
    .expiry-warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; color: #92400e; font-size: 13px; margin-top: 16px; }
    .signature-line { border-top: 1px solid #cbd5e1; padding-top: 24px; margin-top: 24px; }
  </style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div class="header-section">
    <div class="header-grid">
      <div>
        {{#if business.logoUrl}}
        <img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}" />
        {{/if}}
        <h2>{{business.name}}</h2>
        {{#if business.email}}<p class="muted">{{business.email}}</p>{{/if}}
        {{#if business.address.addressLine1}}
        <p class="muted" style="margin-top: 4px;">{{business.address.addressLine1}}<br />
          {{#if business.address.addressLine2}}{{business.address.addressLine2}}<br />{{/if}}
          {{business.address.city}}, {{business.address.stateOrRegion}} {{business.address.postalCode}}<br />
          {{business.address.countryCode}}
        </p>
        {{/if}}
      </div>
      <div class="business-col">
        <h1>Quotation</h1>
        <div class="meta-grid" style="justify-items: end;">
          <div class="meta-item"><span class="meta-label">Quote #</span><span class="meta-value">{{invoice.invoiceNumber}}</span></div>
          <div class="meta-item"><span class="meta-label">Date</span><span class="meta-value">{{invoice.issueDate}}</span></div>
          {{#if invoice.dueDate}}
          <div class="meta-item"><span class="meta-label">Valid Until</span><span class="meta-value">{{invoice.dueDate}}</span></div>
          {{/if}}
        </div>
      </div>
    </div>
  </div>

  <!-- Customer -->
  {{#if customer}}
  <div class="section">
    <div class="section-title">Prepared For</div>
    <p class="muted">{{customer.name}}</p>
    {{#if customer.companyName}}<p class="muted">{{customer.companyName}}</p>{{/if}}
    {{#if customer.email}}<p class="muted highlight">{{customer.email}}</p>{{/if}}
    {{#if customer.address.addressLine1}}
    <p class="muted" style="margin-top: 4px; white-space: pre-line;">
      {{customer.address.addressLine1}}<br />
      {{#if customer.address.addressLine2}}{{customer.address.addressLine2}}<br />{{/if}}
      {{customer.address.city}}, {{customer.address.stateOrRegion}} {{customer.address.postalCode}}<br />
      {{customer.address.countryCode}}
    </p>
    {{/if}}
  </div>
  {{/if}}

  <!-- Line Items -->
  <div class="section">
    <div class="section-title">Line Items</div>
    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Tax</th>
          <th class="text-right">Line Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each lineItems}}
        <tr>
          <td class="align-top">{{description}}</td>
          <td class="text-right align-top">{{quantity}} {{unit}}</td>
          <td class="text-right align-top">{{formatMoney unitPrice}}</td>
          <td class="text-right align-top">{{formatRate taxRate}}</td>
          <td class="text-right align-top">{{formatMoney lineTotal}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <!-- Totals -->
  <div class="divider"></div>
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <table class="totals-table">
      <tr><td class="totals-label">Subtotal</td><td class="totals-value">{{formatMoney totals.subtotal}}</td></tr>
      {{#if discountTotal}}<tr><td class="totals-label">Discount</td><td class="totals-value" style="color: #16a34a;">-{{formatMoney totals.discountTotal}}</td></tr>{{/if}}
      {{#if taxTotal}}<tr><td class="totals-label">Tax</td><td class="totals-value">{{formatMoney totals.taxTotal}}</td></tr>{{/if}}
      {{#if feeTotal}}<tr><td class="totals-label">Fees</td><td class="totals-value">{{formatMoney totals.feeTotal}}</td></tr>{{/if}}
      <tr class="big-total-row"><td class="big-total-label">Total Quoted</td><td class="big-total-value">{{formatMoney totals.total}}</td></tr>
    </table>
  </div>

  <!-- Terms -->
  {{#if invoice.terms}}
  <div class="section">
    <div class="section-title">Terms &amp; Conditions</div>
    <div class="terms-box">{{{nl2br invoice.terms}}}</div>
  </div>
  {{/if}}

  <!-- Notes -->
  {{#if invoice.notes}}
  <div class="section">
    <div class="section-title">Notes</div>
    <div class="notes-box">{{{nl2br invoice.notes}}}</div>
  </div>
  {{/if}}

  <!-- Acceptance -->
  {{#if invoice.isFinalized}}
  <div class="section">
    <div class="section-title">Acceptance</div>
    <div class="terms-box">
      <p style="margin: 0 0 12px;">By signing below, you accept this quotation.</p>
      <div class="signature-line">
        <table style="width: 100%;"><tr>
          <td style="width: 33%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;"><span style="font-size: 11px; color: #94a3a5;">Signature</span></td>
          <td style="width: 33%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;"><span style="font-size: 11px; color: #94a3a5;">Print Name</span></td>
          <td style="width: 34%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;"><span style="font-size: 11px; color: #94a3a5;">Date</span></td>
        </tr></table>
      </div>
      <p style="margin-top: 8px; font-size: 12px; color: #94a3a5;">This quote is valid until {{invoice.dueDate}}.</p>
    </div>
  </div>
  {{/if}}

  <!-- Footer -->
  <div class="footer">
    <p>Quote #{{invoice.invoiceNumber}}. All rights reserved.</p>
  </div>

</div>
</body>
</html>`;

export const MODERN_QUOTE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{invoice.language}}">
<head>
  <meta charset="utf-8">
  <title>Quote {{invoice.invoiceNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #1e293b; background: #ffffff; }
    .container { max-width: 900px; margin: 0 auto; padding: 56px 40px; }
    .accent { color: #2563eb; }
    .header-section { padding-bottom: 32px; border-bottom: 3px solid #e2e8f0; position: relative; }
    .header-section::after { content: "QUOTATION"; position: absolute; top: 0; right: 0; font-size: 80px; font-weight: 800; color: #f1f5f9; transform: rotate(20deg); }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
    .business-col { text-align: right; }
    .logo { max-height: 70px; max-width: 200px; object-contain; }
    h1 { margin: 0; font-size: 32px; color: #0f172a; font-weight: 800; letter-spacing: -0.02em; }
    h2 { margin: 4px 0 0; font-size: 20px; color: #1e293b; font-weight: 600; }
    .muted { color: #64748b; font-size: 13px; line-height: 1.5; }
    .tertiary { color: #94a3a5; font-size: 12px; line-height: 1.4; }
    .highlight { color: #2563eb; font-weight: 600; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px; }
    .meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3a5; display: block; margin-bottom: 4px; }
    .meta-value { font-size: 15px; font-weight: 700; color: #0f172a; }
    .accent-border { border-color: #2563eb; }
    .divider { height: 2px; background: #e2e8f0; margin: 24px 0; }
    .section { padding: 32px 0; border-bottom: 1px solid #e2e8f0; }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #2563eb; margin-bottom: 16px; }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table thead th { background: #f8fafc; padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .items-table td { padding: 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; line-height: 1.5; }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .align-top { vertical-align: top; }
    .items-table .desc-col { width: 45%; }
    .items-table .qty-col { width: 8%; }
    .items-table .price-col { width: 15%; }
    .items-table .tax-col { width: 12%; }
    .items-table .total-col { width: 20%; }
    .quote-total { width: 100%; max-width: 380px; margin-left: auto; }
    .quote-total td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
    .quote-total .label { color: #64748b; font-weight: 500; }
    .quote-total .value { color: #0f172a; font-weight: 600; text-align: right; }
    .grand-total-row td { font-weight: 800; font-size: 18px; border-top: 2px solid #2563eb; }
    .grand-total-label { color: #2563eb; }
    .grand-total-value { color: #2563eb; }
    .accent-box { background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px 24px; margin-top: 24px; }
    .accent-box h3 { margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #1d4ed8; }
    .accent-box p { margin: 0; font-size: 13px; color: #334155; line-height: 1.5; }
    .signature-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-top: 32px; }
    .signature-line { border-top: 1px solid #cbd5e1; margin-top: 24px; padding-top: 24px; }
    .footer { padding: 32px 0; text-align: center; font-size: 12px; color: #94a3a5; border-top: 1px solid #e2e8f0; }
    .quote-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #2563eb; color: #ffffff; }
  </style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div class="header-section">
    <div class="header-grid">
      <div>
        {{#if business.logoUrl}}
        <img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}" />
        {{/if}}
        <h2 style="margin-top: 8px;">{{business.name}}</h2>
        {{#if business.legalName}}<p class="muted">{{business.legalName}}</p>{{/if}}
        {{#if business.email}}<p class="muted">{{business.email}}</p>{{/if}}
        {{#if business.phone}}<p class="muted">{{business.phone}}</p>{{/if}}
        {{#if business.taxId}}<p class="tertiary">Tax ID: {{business.taxId}}</p>{{/if}}
      </div>
      <div class="business-col">
        <span class="quote-badge">QUOTATION</span>
        <h1 style="margin-top: 16px;">{{invoice.invoiceNumber}}</h1>
        <div class="meta-grid" style="justify-items: end; margin-top: 20px;">
          <div class="meta-item"><span class="meta-label">Issue Date</span><span class="meta-value">{{invoice.issueDate}}</span></div>
          {{#if invoice.dueDate}}
          <div class="meta-item"><span class="meta-label">Valid Until</span><span class="meta-value">{{invoice.dueDate}}</span></div>
          {{/if}}
          {{#if invoice.poNumber}}
          <div class="meta-item"><span class="meta-label">P.O. Number</span><span class="meta-value">{{invoice.poNumber}}</span></div>
          {{/if}}
          <div class="meta-item"><span class="meta-label">Currency</span><span class="meta-value accent">{{meta.code}}</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Customer -->
  {{#if customer}}
  <div class="section">
    <div class="section-title">Prepared For</div>
    <div class="meta-grid" style="grid-template-columns: 1fr;">
      <div class="meta-item"><span class="meta-label">Customer</span><span class="meta-value">{{customer.name}}</span></div>
      {{#if customer.companyName}}
      <div class="meta-item"><span class="meta-label">Company</span><span class="meta-value">{{customer.companyName}}</span></div>
      {{/if}}
      {{#if customer.email}}
      <div class="meta-item"><span class="meta-label">Email</span><span class="meta-value highlight">{{customer.email}}</span></div>
      {{/if}}
      {{#if customer.address.addressLine1}}
      <div class="meta-item"><span class="meta-label">Address</span>
        <span class="muted" style="font-weight: 400; white-space: pre-line;">
          {{customer.address.addressLine1}}<br />
          {{#if customer.address.addressLine2}}{{customer.address.addressLine2}}<br />{{/if}}
          {{customer.address.city}}, {{customer.address.stateOrRegion}} {{customer.address.postalCode}}<br />
          {{customer.address.countryCode}}
        </span>
      </div>
      {{/if}}
    </div>
  </div>
  {{/if}}

  <!-- Line Items -->
  <div class="section">
    <div class="section-title">Items</div>
    <table class="items-table">
      <thead>
        <tr>
          <th class="desc-col">Description</th>
          <th class="qty-col text-right">Qty</th>
          <th class="price-col text-right">Unit Price</th>
          <th class="tax-col text-right">Tax</th>
          <th class="total-col text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each lineItems}}
        <tr>
          <td class="align-top desc-col">{{description}}</td>
          <td class="text-right align-top">{{quantity}} {{unit}}</td>
          <td class="text-right align-top">{{formatMoney unitPrice}}</td>
          <td class="text-right align-top">{{formatRate taxRate}}</td>
          <td class="text-right align-top">{{formatMoney lineTotal}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <!-- Fees -->
  {{#if fees.length}}
  <div class="section">
    <div class="section-title">Additional Fees</div>
    <table class="items-table">
      <thead><tr><th>Description</th><th class="text-right">Amount</th><th class="text-right">Tax</th><th class="text-right">Total</th></tr></thead>
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

  <!-- Totals -->
  <div class="divider"></div>
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <table class="quote-total">
      <tr><td class="label">Subtotal</td><td class="value">{{formatMoney totals.subtotal}}</td></tr>
      {{#if discountTotal}}<tr><td class="label">Discount</td><td class="value" style="color: #16a34a;">-{{formatMoney totals.discountTotal}}</td></tr>{{/if}}
      {{#if taxTotal}}<tr><td class="label">Tax</td><td class="value">{{formatMoney totals.taxTotal}}</td></tr>{{/if}}
      {{#if feeTotal}}<tr><td class="label">Fees</td><td class="value">{{formatMoney totals.feeTotal}}</td></tr>{{/if}}
      <tr class="grand-total-row"><td class="grand-total-label">Total Quoted</td><td class="grand-total-value">{{formatMoney totals.total}}</td></tr>
    </table>

    {{#if invoice.depositAmount}}
    <div class="accent-box">
      <h3>Deposit Required</h3>
      <p>{{formatMoney invoice.depositAmount}}</p>
    </div>
    {{/if}}
  </div>

  <!-- Scope & Terms -->
  <div class="section">
    <div class="section-title">Terms</div>
    {{#if invoice.terms}}
    <div class="accent-box">{{{nl2br invoice.terms}}}</div>
    {{else}}
    <div class="accent-box"><p style="margin: 0; color: #94a3a5;">Payment terms and conditions will be specified here.</p></div>
    {{/if}}

    {{#if invoice.notes}}
    <div style="margin-top: 24px;">
      <div class="section-title">Scope of Work</div>
      <div class="accent-box">{{{nl2br invoice.notes}}}</div>
    </div>
    {{/if}}

    {{#if invoice.paymentInstructions}}
    <div style="margin-top: 24px;">
      <div class="section-title">Payment Instructions</div>
      <div class="accent-box">{{{nl2br invoice.paymentInstructions}}}</div>
    </div>
    {{/if}}
  </div>

  <!-- Acceptance -->
  {{#if invoice.isFinalized}}
  <div class="section">
    <div class="section-title">Acceptance</div>
    <div class="signature-box">
      <p style="margin: 0 0 12px; font-size: 13px; color: #334155;">By signing below, you accept this quotation and authorize work to begin.</p>
      <div class="signature-line">
        <table style="width: 100%;"><tr>
          <td style="width: 33%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;"><span style="font-size: 11px; color: #94a3a5;">Signature</span></td>
          <td style="width: 33%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;"><span style="font-size: 11px; color: #94a3a5;">Print Name</span></td>
          <td style="width: 34%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;"><span style="font-size: 11px; color: #94a3a5;">Date</span></td>
        </tr></table>
      </div>
      <p style="margin-top: 16px; font-size: 12px; color: #94a3a5; line-height: 1.5;">
        This quotation is valid until {{invoice.dueDate}}. A deposit may be required to begin work.
      </p>
    </div>
  </div>
  {{/if}}

  <!-- Footer -->
  <div class="footer">
    <p>Quote #{{invoice.invoiceNumber}} &middot; This quotation expires on {{invoice.dueDate}}.</p>
  </div>

</div>
</body>
</html>`;

export const CORPORATE_QUOTE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{invoice.language}}">
<head>
  <meta charset="utf-8">
  <title>Quote {{invoice.invoiceNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #1e293b; background: #ffffff; }
    .container { max-width: 960px; margin: 0 auto; padding: 72px 48px; }
    .header-section { padding-bottom: 32px; border-bottom: 3px solid #cbd5e1; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
    .business-col { text-align: right; }
    .logo { max-height: 70px; max-width: 220px; object-contain; }
    h1 { margin: 0; font-size: 28px; color: #0f172a; font-weight: 700; }
    h2 { margin: 4px 0 0; font-size: 18px; color: #475569; font-weight: 500; }
    .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
    .tertiary { color: #94a3a5; font-size: 12px; line-height: 1.4; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px; }
    .meta-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3a5; display: block; margin-bottom: 4px; }
    .meta-value { font-size: 14px; font-weight: 600; color: #0f172a; }
    .divider { height: 1px; background: #e2e8f0; margin: 28px 0; }
    .section { padding: 28px 0; border-bottom: 1px solid #e2e8f0; }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3a5; margin-bottom: 16px; }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .items-table td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; line-height: 1.6; }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .align-top { vertical-align: top; }
    .quote-total { width: 100%; max-width: 360px; margin-left: auto; border-collapse: collapse; }
    .quote-total td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
    .quote-total .label { color: #64748b; font-weight: 500; }
    .quote-total .value { color: #0f172a; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
    .grand-total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #0f172a; }
    .grand-total-label { color: #64748b; }
    .grand-total-value { color: #0f172a; }
    .terms-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 20px; }
    .terms-box ol, .terms-box ul { margin: 0; padding-left: 20px; }
    .terms-box li { margin-bottom: 6px; font-size: 13px; color: #334155; line-height: 1.5; }
    .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 20px; }
    .notes-box p { margin: 0; font-size: 13px; color: #334155; line-height: 1.5; }
    .footer { padding: 24px 0; font-size: 11px; color: #94a3a5; border-top: 1px solid #e2e8f0; }
    .expiry-warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px 14px; color: #92400e; font-size: 12px; margin-top: 16px; }
    .reference-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .signature-line { border-top: 1px solid #cbd5e1; padding-top: 32px; margin-top: 32px; }
  </style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div class="header-section">
    <div class="header-grid">
      <div>
        {{#if business.logoUrl}}
        <img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}" />
        {{/if}}
        <h2>{{business.name}}</h2>
        {{#if business.legalName}}<p class="muted">{{business.legalName}}</p>{{/if}}
        {{#if business.email}}<p class="muted">{{business.email}}</p>{{/if}}
        {{#if business.phone}}<p class="muted">{{business.phone}}</p>{{/if}}
        {{#if business.taxId}}<p class="tertiary">Tax ID: {{business.taxId}}</p>{{/if}}
        {{#if business.address.addressLine1}}
        <p class="muted" style="margin-top: 4px; white-space: pre-line;">
          {{business.address.addressLine1}}<br />
          {{#if business.address.addressLine2}}{{business.address.addressLine2}}<br />{{/if}}
          {{business.address.city}}, {{business.address.stateOrRegion}} {{business.address.postalCode}}<br />
          {{business.address.countryCode}}
        </p>
        {{/if}}
      </div>
      <div class="business-col">
        <h1>Quotation</h1>
        <div class="meta-grid" style="justify-items: end;">
          <div class="meta-item"><span class="meta-label">Quote #</span><span class="meta-value">{{invoice.invoiceNumber}}</span></div>
          <div class="meta-item"><span class="meta-label">Issue Date</span><span class="meta-value">{{invoice.issueDate}}</span></div>
          {{#if invoice.dueDate}}
          <div class="meta-item"><span class="meta-label">Valid Until</span><span class="meta-value">{{invoice.dueDate}}</span></div>
          {{/if}}
          {{#if invoice.poNumber}}
          <div class="meta-item"><span class="meta-label">P.O. Number</span><span class="meta-value">{{invoice.poNumber}}</span></div>
          {{/if}}
          <div class="meta-item"><span class="meta-label">Currency</span><span class="meta-value">{{meta.code}}</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Customer -->
  {{#if customer}}
  <div class="section">
    <div class="section-title">Bill To</div>
    <div class="reference-grid">
      <div class="meta-item"><span class="meta-label">Customer Name</span><span class="meta-value">{{customer.name}}</span></div>
      {{#if customer.companyName}}
      <div class="meta-item"><span class="meta-label">Company</span><span class="meta-value">{{customer.companyName}}</span></div>
      {{/if}}
      {{#if customer.email}}
      <div class="meta-item"><span class="meta-label">Email</span><span class="meta-value highlight">{{customer.email}}</span></div>
      {{/if}}
      {{#if customer.phone}}
      <div class="meta-item"><span class="meta-label">Phone</span><span class="meta-value">{{customer.phone}}</span></div>
      {{/if}}
      {{#if customer.address.addressLine1}}
      <div class="meta-item"><span class="meta-label">Address</span>
        <span class="muted" style="font-weight: 400; white-space: pre-line;">
          {{customer.address.addressLine1}}<br />
          {{#if customer.address.addressLine2}}{{customer.address.addressLine2}}<br />{{/if}}
          {{customer.address.city}}, {{customer.address.stateOrRegion}} {{customer.address.postalCode}}<br />
          {{customer.address.countryCode}}
        </span>
      </div>
      {{/if}}
    </div>
  </div>
  {{/if}}

  <!-- Line Items -->
  <div class="section">
    <div class="section-title">Line Items</div>
    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Tax</th>
          <th class="text-right">Line Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each lineItems}}
        <tr>
          <td class="align-top">{{add @index 1}}</td>
          <td class="align-top">{{description}}</td>
          <td class="text-right align-top">{{quantity}} {{unit}}</td>
          <td class="text-right align-top">{{formatMoney unitPrice}}</td>
          <td class="text-right align-top">{{formatRate taxRate}}</td>
          <td class="text-right align-top">{{formatMoney lineTotal}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <!-- Fees -->
  {{#if fees.length}}
  <div class="section">
    <div class="section-title">Additional Fees</div>
    <table class="items-table">
      <thead><tr><th>Description</th><th class="text-right">Amount</th><th class="text-right">Tax</th><th class="text-right">Total</th></tr></thead>
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

  <!-- Totals -->
  <div class="divider"></div>
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <table class="quote-total">
      <tr><td class="label">Subtotal</td><td class="value">{{formatMoney totals.subtotal}}</td></tr>
      {{#if discountTotal}}<tr><td class="label">Discount</td><td class="value" style="color: #16a34a;">-{{formatMoney totals.discountTotal}}</td></tr>{{/if}}
      {{#if taxTotal}}<tr><td class="label">Tax</td><td class="value">{{formatMoney totals.taxTotal}}</td></tr>{{/if}}
      {{#if feeTotal}}<tr><td class="label">Fees</td><td class="value">{{formatMoney totals.feeTotal}}</td></tr>{{/if}}
      {{#if invoice.depositAmount}}
      <tr><td class="label">Deposit Required</td><td class="value" style="color: #2563eb;">{{formatMoney invoice.depositAmount}}</td></tr>
      {{/if}}
      <tr class="grand-total-row"><td class="grand-total-label">Total Quoted</td><td class="grand-total-value">{{formatMoney totals.total}}</td></tr>
    </table>
  </div>

  <!-- Terms & Scope -->
  <div class="section">
    {{#if invoice.terms}}
    <div class="section-title">Terms &amp; Conditions</div>
    <div class="terms-box">{{{nl2br invoice.terms}}}</div>
    {{/if}}

    {{#if invoice.notes}}
    <div style="margin-top: 24px;">
      <div class="section-title">Scope of Work</div>
      <div class="terms-box">{{{nl2br invoice.notes}}}</div>
    </div>
    {{/if}}

    {{#if invoice.paymentInstructions}}
    <div style="margin-top: 24px;">
      <div class="section-title">Payment Instructions</div>
      <div class="terms-box">{{{nl2br invoice.paymentInstructions}}}</div>
    </div>
    {{/if}}
  </div>

  <!-- Acceptance -->
  {{#if invoice.isFinalized}}
  <div class="section">
    <div class="section-title">Acceptance</div>
    <div class="terms-box">
      <p style="margin: 0 0 12px; font-size: 13px; color: #334155;">By signing below, you accept this quotation.</p>
      <div class="signature-line">
        <table style="width: 100%;"><tr>
          <td style="width: 30%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;"><span style="font-size: 11px; color: #94a3a5;">Signature</span></td>
          <td style="width: 30%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;"><span style="font-size: 11px; color: #94a3a5;">Print Name</span></td>
          <td style="width: 40%; padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;"><span style="font-size: 11px; color: #94a3a5;">Date</span></td>
        </tr></table>
      </div>
      <p style="margin-top: 16px; font-size: 12px; color: #94a3a5; line-height: 1.5;">
        This quotation is valid until {{invoice.dueDate}}.
      </p>
    </div>
  </div>
  {{/if}}

  <!-- Footer -->
  <div class="footer">
    <p>Quotation #{{invoice.invoiceNumber}}. All rights reserved.</p>
    {{#if business.name}}<p style="margin-top: 4px;">{{business.name}} &middot; {{business.email}}</p>{{/if}}
  </div>

</div>
</body>
</html>`;

export const QUOTE_TEMPLATES: Record<string, string> = {
  default: DEFAULT_QUOTE_TEMPLATE,
  minimal: MINIMAL_QUOTE_TEMPLATE,
  modern: MODERN_QUOTE_TEMPLATE,
  corporate: CORPORATE_QUOTE_TEMPLATE,
};

Object.values(QUOTE_TEMPLATES).forEach((html) => {
  templateCache.set(html, Handlebars.compile(html, { noEscape: true }));
});

export class TemplateRenderer {
  private defaultTemplate: string;

  constructor(defaultTemplate?: string) {
    this.defaultTemplate = defaultTemplate ?? DEFAULT_INVOICE_TEMPLATE;
  }

  renderQuote(data: InvoiceTemplateData, templateHtml?: string): string {
    const templateName = data.config?.htmlTemplate as string | undefined;
    let templateSource: string = DEFAULT_QUOTE_TEMPLATE;
    if (templateName && QUOTE_TEMPLATES[templateName]) {
      templateSource = QUOTE_TEMPLATES[templateName];
    } else if (templateName) {
      templateSource = templateName;
    } else if (templateHtml) {
      templateSource = templateHtml;
    }
    const template = compileTemplate(templateSource);
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
    language?: string;
    title?: string | null;
    depositType?: string | null;
    depositValue?: string | null;
    depositDueDate?: string | null;
    depositPaid?: boolean | null;
    isFinalized?: boolean;
    depositAmount?: string | null;
    projectId?: string | null;
    projectName?: string | null;
  },
  business: TemplateBusiness,
  customer: TemplateCustomer | null,
  items: TemplateLineItem[],
  fees: TemplateFee[],
  totals: TemplateTotals,
  paymentInstructions?: TemplatePaymentInstructions | null,
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
      language: invoice.language ?? undefined,
      title: invoice.title ?? null,
      depositType: invoice.depositType ?? null,
      depositValue: invoice.depositValue ?? null,
      depositDueDate: invoice.depositDueDate ?? null,
      depositPaid: invoice.depositPaid ?? null,
      isFinalized: invoice.isFinalized ?? false,
      depositAmount: invoice.depositAmount ?? null,
      projectId: invoice.projectId ?? null,
      projectName: invoice.projectName ?? null,
    },
    lineItems: items,
    fees,
    totals,
    paymentInstructions: paymentInstructions ?? null,
    config,
  };
}
