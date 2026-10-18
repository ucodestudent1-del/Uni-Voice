import Handlebars from "handlebars";
import QRCode from "qrcode";
import type { Address } from "../../domain/value-objects/address.js";
import { formatMoney, getCurrencyMetadata, type CurrencyCode } from "../../domain/value-objects/currency.js";
import { Decimal } from "decimal.js";
import { env } from "../../config/index.js";
import { query } from "../../db/pool.js";

export interface TemplateLineItem {
  description: string;
  quantity: Decimal.Value;
  unit: string;
  unitPrice: Decimal.Value;
  discount: Decimal.Value;
  taxRate: Decimal.Value;
  taxName?: string | null;
  taxAmount: Decimal.Value;
  lineSubtotal: Decimal.Value;
  lineTotal: Decimal.Value;
  isTaxInclusive: boolean;
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
  isOptional?: boolean;
}

export interface TemplateFee {
  description: string;
  amount: Decimal.Value;
  taxRate: Decimal.Value;
  taxName?: string | null;
  taxAmount: Decimal.Value;
}

export interface TaxBreakdownEntry {
  rate: Decimal.Value;
  name: string;
  taxableAmount: Decimal.Value;
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
  taxByRate?: TaxBreakdownEntry[];
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
  shippingAddress?: Address | null;
  paymentTerms?: number | null;
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
    paymentTerms?: string | null;
  };
  lineItems: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  paymentInstructions?: TemplatePaymentInstructions | null;
  config: Record<string, unknown>;
}

export interface CreditNoteTemplateData {
  business: TemplateBusiness;
  customer: TemplateCustomer | null;
  creditNote: {
    id: string;
    creditNoteNumber: string | null;
    status: string;
    issueDate: string | null;
    dueDate: string | null;
    currency: CurrencyCode;
    referenceInvoiceNumber: string | null;
    referenceInvoiceId: string | null;
    reason?: string | null;
    notes?: string | null;
    terms?: string | null;
    language?: string;
    isFinalized?: boolean;
    appliedTotal?: string | null;
    amountDue?: string | null;
  };
  lineItems: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  applications: Array<{
    invoiceId: string;
    invoiceNumber: string;
    amount: Decimal.Value;
    appliedAt: string;
  }>;
  config: Record<string, unknown>;
}

export interface QuoteTemplateData {
  business: TemplateBusiness;
  customer: TemplateCustomer | null;
  quote: {
    id: string;
    quoteNumber: string | null;
    status: string;
    issueDate: string | null;
    expiryDate: string | null;
    currency: CurrencyCode;
    notes?: string | null;
    terms?: string | null;
    scopeOfWork?: string | null;
    paymentInstructions?: string | null;
    language?: string;
    isFinalized?: boolean;
  };
  lineItems: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  config: Record<string, unknown>;
}

export interface DebitNoteTemplateData {
  business: TemplateBusiness;
  customer: TemplateCustomer | null;
  debitNote: {
    id: string;
    debitNoteNumber: string | null;
    status: string;
    issueDate: string | null;
    dueDate: string | null;
    currency: CurrencyCode;
    referenceInvoiceId: string | null;
    referenceInvoiceNumber: string | null;
    reason?: string | null;
    notes?: string | null;
    terms?: string | null;
    paymentInstructions?: string | null;
    language?: string;
    isFinalized?: boolean;
  };
  lineItems: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  config: Record<string, unknown>;
}

export interface PaymentVoucherTemplateData {
  business: TemplateBusiness;
  payee: TemplateCustomer | null;
  voucher: {
    id: string;
    paymentVoucherNumber: string | null;
    status: string;
    voucherDate: string | null;
    currency: CurrencyCode;
    payeeName: string | null;
    payeeEmail: string | null;
    payeePhone: string | null;
    referenceNumber: string | null;
    paymentMethod: string | null;
    paymentProvider: string | null;
    notes?: string | null;
    terms?: string | null;
    language?: string;
    isFinalized?: boolean;
  };
  lineItems: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  config: Record<string, unknown>;
}

export type DocumentTemplateData =
  | InvoiceTemplateData
  | CreditNoteTemplateData
  | QuoteTemplateData
  | DebitNoteTemplateData
  | PaymentVoucherTemplateData;

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

Handlebars.registerHelper("length", (arr: unknown[]): number => (arr ? arr.length : 0));

Handlebars.registerHelper("eq", (a: unknown, b: unknown): boolean => a === b);

Handlebars.registerHelper("or", (...args: unknown[]): boolean => {
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

Handlebars.registerHelper("formatRateWithName", function (v: Decimal.Value, name?: string | null): string {
  const rateStr = fmtRate(v);
  if (name) return `${rateStr} (${name})`;
  return rateStr;
});

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
    compiled = Handlebars.compile(templateHtml, { noEscape: false });
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
    .header-section { padding-bottom: 24px; border-bottom: 3px solid var(--color-brand); position: relative; }
    .header-section::after { content: "INVOICE"; position: absolute; top: 0; right: 0; font-size: 80px; font-weight: 800; color: #f1f5f9; transform: rotate(20deg); pointer-events: none; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; position: relative; z-index: 1; }
    .business-col { text-align: right; }
    .logo { max-height: 80px; max-width: 240px; object-contain; }
    .section { padding: 32px 0; border-bottom: 1px solid var(--color-border); }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-tertiary); margin-bottom: 16px; }
    .divider { height: 1px; background: var(--color-border); margin: 32px 0; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
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
    /* ===== Tax breakdown table ===== */
    .tax-table { width: 100%; max-width: 380px; margin-left: auto; border-collapse: collapse; }
    .tax-table td { padding: 6px 16px; font-size: 13px; border-bottom: 1px solid var(--color-border); }
    .tax-rate-cell { font-size: 12px; color: var(--color-text-tertiary); }
    /* ===== QR / payment link ===== */
    .payment-cta { text-align: center; }
    .pay-btn { display: inline-block; margin-top: 12px; padding: 12px 32px; background: var(--color-brand); color: #ffffff; text-decoration: none; border-radius: var(--radius-md); font-size: 15px; font-weight: 600; }
    .pay-btn:hover { background: var(--color-brand-hover); }
    /* ===== Remittance instructions ===== */
    .remittance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .remittance-box { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px; }
    .remittance-box h4 { margin: 0 0 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); }
    .remittance-box p { margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; white-space: pre-line; }
    .remittance-box p:last-child { margin-bottom: 0; }
    /* ===== Footer ===== */
    .footer { padding: 24px 0; font-size: 12px; color: var(--color-text-tertiary); border-top: 1px solid var(--color-border); }
    .footer p { margin: 0; }
    .footer p + p { margin-top: 4px; }
    .thank-you { font-size: 14px; font-weight: 500; color: var(--color-text-secondary); }
    @media (max-width: 600px) {
      .page { padding: 24px 16px; }
      .header-section::after { font-size: 40px; }
      .header-grid { grid-template-columns: 1fr; }
      .business-col { text-align: left; }
      .meta-grid { grid-template-columns: 1fr; }
      .totals-table { max-width: 100%; }
      .tax-table { max-width: 100%; }
      .remittance-grid { grid-template-columns: 1fr; }
    }
    @page {
      margin: 20mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 10px;
        color: var(--color-text-tertiary);
      }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ========== HEADER: Business info (left) + Invoice details (right) ========== -->
  <div class="header-section">
    <div class="header-grid" style="position: relative; z-index: 1;">
      <!-- Business / seller info -->
      <div>
        {{#if business.logoUrl}}
        <img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}" />
        {{/if}}
        <div style="margin-top: 8px;">
          <h3 style="margin: 0; font-size: 20px; color: var(--color-text-primary); font-weight: 700;">{{business.name}}</h3>
          {{#if business.legalName}}<p class="muted" style="margin: 2px 0 0;">{{business.legalName}}</p>{{/if}}
          {{#if business.email}}<p class="muted" style="margin: 2px 0 0;">{{business.email}}</p>{{/if}}
          {{#if business.phone}}<p class="muted" style="margin: 2px 0 0;">{{business.phone}}</p>{{/if}}
          {{#if business.website}}
          <p class="muted" style="margin: 2px 0 0;">
            <a href="{{#if (startswith business.website "http")}}{{business.website}}{{else}}https://{{business.website}}{{/if}}" style="color: var(--color-brand); text-decoration: none;">{{business.website}}</a>
          </p>
          {{/if}}
          {{#if business.taxId}}<p class="tertiary" style="margin: 2px 0 0;">Tax ID: {{business.taxId}}</p>{{/if}}
          {{#if business.registrationNumber}}<p class="tertiary" style="margin: 2px 0 0;">Reg #: {{business.registrationNumber}}</p>{{/if}}
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
          {{#if invoice.paymentTerms}}
          <div class="meta-item">
            <span class="meta-label">Payment Terms</span>
            <span class="meta-value">{{invoice.paymentTerms}}</span>
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

  <!-- ========== BILL TO ========== -->
  {{#if customer}}
  <div class="section">
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
      {{#if customer.shippingAddress}}
      <div class="meta-item">
        <span class="meta-label">Ship To</span>
        <span class="meta-value meta-value-long">
          {{customer.shippingAddress.addressLine1}}<br />
          {{#if customer.shippingAddress.addressLine2}}{{customer.shippingAddress.addressLine2}}<br />{{/if}}
          {{customer.shippingAddress.city}}, {{customer.shippingAddress.stateOrRegion}} {{customer.shippingAddress.postalCode}}<br />
          {{customer.shippingAddress.countryCode}}
        </span>
      </div>
      {{/if}}
      {{#if customer.notes}}
      <div class="meta-item">
        <span class="meta-label">Customer Notes</span>
        <span class="meta-value meta-value-long">{{customer.notes}}</span>
      </div>
      {{/if}}
    </div>
  </div>
  {{/if}}

  <!-- ========== LINE ITEMS ========== -->
  <div class="section">
    <div class="section-title">{{#if invoice.title}}Items{{else}}Line Items{{/if}}</div>
    {{#if lineItems.length}}
    <div style="overflow-x: auto;">
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 4%;">#</th>
          <th style="width: 32%;">Description</th>
          <th style="width: 7%;" class="text-right">Qty</th>
          <th style="width: 12%;" class="text-right">Unit Price</th>
          <th style="width: 9%;" class="text-right">Discount</th>
          <th style="width: 9%;" class="text-right">Tax</th>
          <th style="width: 10%;" class="text-right">Line Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each lineItems}}
        <tr>
          <td class="align-top">{{add @index 1}}</td>
          <td class="align-top">
            <div style="font-weight: 500; color: var(--color-text-primary);">{{description}}</div>
            {{#if catalogName}}<span class="tertiary" style="display: block; margin-top: 2px;">{{catalogName}}</span>{{/if}}
            {{#if catalogSku}}<span class="tertiary" style="display: block; margin-top: 2px;">SKU: {{catalogSku}}</span>{{/if}}
            {{#if taxName}}<span class="tertiary" style="display: block; margin-top: 2px;">{{taxName}}</span>{{/if}}
            {{#if isTaxInclusive}}<span class="tertiary" style="display: block; margin-top: 2px;">(tax included)</span>{{/if}}
          </td>
          <td class="text-right align-top">{{quantity}} {{unit}}</td>
          <td class="text-right align-top">{{formatMoney unitPrice}}</td>
          <td class="text-right align-top">
            {{#if discount}}-{{formatMoney discount}}{{else}}—{{/if}}
          </td>
          <td class="text-right align-top">{{formatRateWithName taxRate taxName}}</td>
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
          <th style="width: 40%;">Description</th>
          <th style="width: 15%;" class="text-right">Amount</th>
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
          <td class="text-right">{{formatRateWithName taxRate taxName}}</td>
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
    <div class="section-title">Summary</div>
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
      {{#if (gt (length totals.taxByRate) 0)}}
      <tr class="tax-breakdown-row">
        <td class="totals-label" colspan="2">
          <span style="display: block; margin-bottom: 4px;">Tax Breakdown</span>
          <table class="tax-table">
            <tbody>
              {{#each totals.taxByRate}}
              <tr>
                <td class="tax-rate-cell">{{formatRate rate}}{{#if name}} ({{name}}){{/if}}</td>
                <td class="text-right tax-rate-cell">{{formatMoney taxableAmount}}</td>
              </tr>
              <tr>
                <td class="tax-rate-cell">Tax</td>
                <td class="text-right tax-rate-cell">{{formatMoney taxAmount}}</td>
              </tr>
              {{/each}}
            </tbody>
          </table>
        </td>
      </tr>
      {{/if}}
      <tr>
        <td class="totals-label">Total Tax</td>
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

  <!-- ========== DEPOSIT DETAILS ========== -->
  {{#if invoice.depositAmount}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Deposit</div>
    <div class="info-box">
      <table class="totals-table" style="max-width: 100%;">
        <tr>
          <td class="totals-label">Deposit Required</td>
          <td class="totals-value" style="color: var(--color-brand);">{{formatMoney invoice.depositAmount}}</td>
        </tr>
        {{#if invoice.depositDueDate}}
        <tr>
          <td class="totals-label">Deposit Due Date</td>
          <td class="totals-value">{{formatDate invoice.depositDueDate}}</td>
        </tr>
        {{/if}}
        {{#if invoice.depositType}}
        <tr>
          <td class="totals-label">Deposit Type</td>
          <td class="totals-value">{{invoice.depositType}}</td>
        </tr>
        {{/if}}
      </table>
    </div>
  </div>
  {{/if}}

  <!-- ========== REMITTANCE INSTRUCTIONS ========== -->
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
            {{#if paymentQrCode}}
            <div style="margin-top: 12px; text-align: center;">
              <img src="{{paymentQrCode}}" alt="Payment QR Code" style="width: 120px; height: 120px;" />
              <p class="tertiary" style="margin-top: 4px;">Scan to pay</p>
            </div>
            {{/if}}
            <p class="tertiary" style="margin-top: 8px;">Or scan the QR code / click above to pay securely online.</p>
          </div>
          {{/if}}

          {{#if paymentInstructions.lateFeeType}}
          {{#if (eq paymentInstructions.lateFeeType "fixed")}}
          <div style="margin-top: 16px;">
            <span class="meta-label">Late Fee</span>
            <p class="muted" style="margin: 0;">A fixed fee of {{formatMoney paymentInstructions.lateFeeValue}} will be applied to overdue balances.</p>
            {{#if paymentInstructions.lateFeePeriodDays}}
            <p class="muted" style="margin: 4px 0 0; font-size: 12px;">Applies after {{paymentInstructions.lateFeePeriodDays}} days overdue.</p>
            {{/if}}
          </div>
          {{/if}}
          {{#if (eq paymentInstructions.lateFeeType "percentage")}}
          <div style="margin-top: 16px;">
            <span class="meta-label">Late Fee</span>
            <p class="muted" style="margin: 0;">An overdue balance will incur a late fee of {{paymentInstructions.lateFeeValue}}%.</p>
            {{#if paymentInstructions.lateFeePeriodDays}}
            <p class="muted" style="margin: 4px 0 0; font-size: 12px;">Applies after {{paymentInstructions.lateFeePeriodDays}} days overdue.</p>
            {{/if}}
          </div>
          {{/if}}
          {{/if}}

          {{#if paymentInstructions.taxExemption}}
          <div style="margin-top: 16px;">
            <span class="meta-label">Tax Exemption</span>
            <p class="muted" style="white-space: pre-line; margin: 0;">{{paymentInstructions.taxExemption}}</p>
          </div>
          {{/if}}
        </div>

        <!-- Right column: Remittance details, warranty, returns -->
        <div>
          <div class="remittance-grid">
            <div>
              <div class="remittance-box">
                <h4>Remittance</h4>
                {{#if business.name}}
                <p>{{business.name}}</p>
                {{/if}}
                {{#if business.email}}
                <p>Email: {{business.email}}</p>
                {{/if}}
                {{#if business.phone}}
                <p>Phone: {{business.phone}}</p>
                {{/if}}
                {{#if business.address}}
                <p>{{business.address.addressLine1}}<br />
                {{#if business.address.addressLine2}}{{business.address.addressLine2}}<br />{{/if}}
                {{business.address.city}}, {{business.address.stateOrRegion}} {{business.address.postalCode}}<br />
                {{business.address.countryCode}}</p>
                {{/if}}
              </div>
            </div>
            <div>
              {{#if paymentInstructions.warrantyInfo}}
              <div class="remittance-box">
                <h4>Warranty</h4>
                <p style="white-space: pre-line;">{{{nl2br paymentInstructions.warrantyInfo}}}</p>
              </div>
              {{/if}}
              {{#if paymentInstructions.returnPolicy}}
              <div class="remittance-box">
                <h4>Return Policy</h4>
                <p style="white-space: pre-line;">{{{nl2br paymentInstructions.returnPolicy}}}</p>
              </div>
              {{/if}}
            </div>
          </div>

          {{#if invoice.paymentInstructions}}
          <div style="margin-top: 16px;">
            <span class="meta-label">Additional Payment Info</span>
            <div class="muted" style="white-space: pre-line;">{{{nl2br invoice.paymentInstructions}}}</div>
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
      <div class="muted" style="white-space: pre-line;">{{{nl2br invoice.notes}}}</div>
    </div>
  </div>
  {{/if}}

  <!-- ========== TERMS & CONDITIONS ========== -->
  {{#if invoice.terms}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Terms &amp; Conditions</div>
    <div class="info-box">
      <div class="muted" style="white-space: pre-line;">{{{nl2br invoice.terms}}}</div>
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
    {{#if viewInvoiceUrl}}
    <p style="margin-top: 4px;">
      <a href="{{viewInvoiceUrl}}" style="color: var(--color-brand); text-decoration: none; font-size: 11px;">View invoice online</a>
    </p>
    {{/if}}
    <p style="margin-top: 8px;" class="thank-you">Thank you for your business.</p>
  </div>

</div>
</body>
</html>`;

templateCache.set(DEFAULT_INVOICE_TEMPLATE, Handlebars.compile(DEFAULT_INVOICE_TEMPLATE, { noEscape: false }));

export const DEFAULT_CREDIT_NOTE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{creditNote.language}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Credit Note {{creditNote.creditNoteNumber}}</title>
  <style>
    body { margin: 0; padding: 0; color: #1e293b; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; line-height: 1.5; }
    .page { max-width: 900px; margin: 0 auto; padding: 56px 40px; }
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
      --color-destructive: #dc2626;
      --color-destructive-bg: #fee2e2;
      --color-success: #065f46;
      --color-success-bg: #d1fae5;
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-full: 20px;
    }
    .header-section { padding-bottom: 24px; border-bottom: 3px solid #ef4444; position: relative; }
    .header-section::after { content: "CREDIT NOTE"; position: absolute; top: 0; right: 0; font-size: 80px; font-weight: 800; color: #ffebee; transform: rotate(20deg); pointer-events: none; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; position: relative; z-index: 1; }
    .business-col { text-align: right; }
    .logo { max-height: 80px; max-width: 240px; object-contain; }
    .section { padding: 32px 0; border-bottom: 1px solid var(--color-border); }
    .section:last-child { border-bottom: none; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-tertiary); margin-bottom: 16px; }
    .divider { height: 1px; background: var(--color-border); margin: 32px 0; }
    h1 { margin: 0; font-size: 28px; color: var(--color-text-primary); font-weight: 700; }
    h2 { margin: 4px 0 0; font-size: 20px; color: var(--color-text-primary); font-weight: 700; }
    h3 { margin: 0 0 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); }
    .muted { color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
    .tertiary { color: var(--color-text-tertiary); font-size: 12px; line-height: 1.4; }
    .highlight { color: var(--color-brand); font-weight: 600; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 20px; }
    .meta-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); display: block; margin-bottom: 4px; }
    .meta-value { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
    .meta-value-long { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); white-space: pre-wrap; word-break: break-word; }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table th { background: var(--color-surface); padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-tertiary); border-bottom: 2px solid var(--color-border); }
    .items-table td { padding: 14px 16px; border-bottom: 1px solid var(--color-border); font-size: 13px; line-height: 1.5; }
    .items-table tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .align-top { vertical-align: top; }
    .totals-table { width: 100%; max-width: 380px; margin-left: auto; border-collapse: collapse; }
    .totals-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid var(--color-border); }
    .totals-label { color: var(--color-text-tertiary); font-weight: 500; }
    .totals-value { color: var(--color-text-primary); font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
    .big-total-row td { font-weight: 700; font-size: 16px; }
    .big-total-label { color: var(--color-text-tertiary); }
    .credit-total-value { color: #ef4444; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: var(--radius-full); font-size: 12px; font-weight: 600; }
    .status-draft { background: var(--color-success-bg); color: var(--color-success); }
    .status-issued { background: #dbeafe; color: #1e40af; }
    .status-applied { background: var(--color-success-bg); color: var(--color-success); }
    .status-void { background: #f1f5f9; color: var(--color-text-secondary); }
    .info-box { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px 20px; }
    .credit-badge { display: inline-block; padding: 4px 12px; border-radius: var(--radius-full); font-size: 12px; font-weight: 600; background: #fee2e2; color: var(--color-destructive); }
    .reference-chip { display: inline-block; padding: 4px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-secondary); }
    .reason-box { background: #ffebee; border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 16px 20px; margin-top: 16px; }
    .reason-box p { margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.5; }
    .footer { padding: 24px 0; font-size: 12px; color: var(--color-text-tertiary); border-top: 1px solid var(--color-border); }
    .footer p { margin: 0; }
    .footer p + p { margin-top: 4px; }
    @media (max-width: 600px) {
      .page { padding: 24px 16px; }
      .header-section::after { font-size: 40px; }
      .header-grid { grid-template-columns: 1fr; }
      .business-col { text-align: left; }
      .meta-grid { grid-template-columns: 1fr; }
      .totals-table { max-width: 100%; }
    }
    @page {
      margin: 20mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 10px;
        color: var(--color-text-tertiary);
      }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header-section">
    <div class="header-grid">
      <div>
        {{#if business.logoUrl}}
        <img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}" />
        {{/if}}
        <div style="margin-top: 8px;">
          <h3 style="margin: 0; font-size: 20px; color: var(--color-text-primary); font-weight: 700;">{{business.name}}</h3>
          {{#if business.legalName}}<p class="muted">{{business.legalName}}</p>{{/if}}
          {{#if business.email}}<p class="muted">{{business.email}}</p>{{/if}}
          {{#if business.phone}}<p class="muted">{{business.phone}}</p>{{/if}}
          {{#if business.website}}
          <p class="muted">
            <a href="{{#if (startswith business.website "http")}}{{business.website}}{{else}}https://{{business.website}}{{/if}}" style="color: var(--color-brand); text-decoration: none;">{{business.website}}</a>
          </p>
          {{/if}}
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

      <div class="business-col">
        <h1>Credit Note</h1>
        <span class="credit-badge">CREDIT</span>
        <div class="meta-grid" style="justify-items: end; margin-top: 16px;">
          <div class="meta-item">
            <span class="meta-label">Credit Note #</span>
            <span class="meta-value">{{creditNote.creditNoteNumber}}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Status</span>
            <span class="meta-value">
              <span class="status-badge status-{{creditNote.status}}">{{creditNote.status}}</span>
            </span>
          </div>
          {{#if creditNote.issueDate}}
          <div class="meta-item">
            <span class="meta-label">Issue Date</span>
            <span class="meta-value">{{formatDate creditNote.issueDate}}</span>
          </div>
          {{/if}}
          {{#if creditNote.referenceInvoiceNumber}}
          <div class="meta-item">
            <span class="meta-label">Reference Invoice</span>
            <span class="meta-value">{{creditNote.referenceInvoiceNumber}}</span>
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

  <!-- Reason -->
  {{#if creditNote.reason}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <h3>Reason for Credit</h3>
    <div class="reason-box">
      <p>{{creditNote.reason}}</p>
    </div>
  </div>
  {{/if}}

  <!-- Bill To -->
  {{#if customer}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <h3>Bill To</h3>
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
  {{/if}}

  <!-- Line Items -->
  <div class="section">
    <div class="section-title">Credit Note Items</div>
    {{#if lineItems.length}}
    <div style="overflow-x: auto;">
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 4%;">#</th>
          <th style="width: 35%;">Description</th>
          <th class="text-right" style="width: 8%;">Qty</th>
          <th class="text-right" style="width: 14%;">Unit Price</th>
          <th class="text-right" style="width: 9%;">Tax</th>
          <th class="text-right" style="width: 14%;">Credit Amount</th>
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
    {{/if}}

  <!-- Fees -->
  {{#if fees.length}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Credit Note Fees</div>
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 49%;">Description</th>
          <th class="text-right" style="width: 17%;">Amount</th>
          <th class="text-right" style="width: 17%;">Tax</th>
          <th class="text-right" style="width: 17%;">Total</th>
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

  <!-- Totals -->
  <div class="divider"></div>
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Credit Summary</div>
    <table class="totals-table">
      <tr>
        <td class="totals-label">Subtotal</td>
        <td class="totals-value">{{formatMoney totals.subtotal}}</td>
      </tr>
      {{#if totals.discountTotal}}
      <tr>
        <td class="totals-label">Discount</td>
        <td class="totals-value" style="color: #16a34a;">−{{formatMoney totals.discountTotal}}</td>
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
        <td class="big-total-label">Total Credit</td>
        <td class="credit-total-value">−{{formatMoney totals.total}}</td>
      </tr>
      {{#if creditNote.appliedTotal}}
      <tr>
        <td class="totals-label">Amount Applied</td>
        <td class="totals-value" style="color: var(--color-success);">−{{formatMoney creditNote.appliedTotal}}</td>
      </tr>
      {{/if}}
      {{#if creditNote.amountDue}}
      <tr class="big-total-row">
        <td class="big-total-label" style="color: #ef4444;">Balance Remaining</td>
        <td class="credit-total-value">{{formatMoney creditNote.amountDue}}</td>
      </tr>
      {{/if}}
    </table>
  </div>

  <!-- Applications -->
  {{#if applications.length}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <div class="section-title">Applied To Invoices</div>
    <table class="items-table">
      <thead>
        <tr>
          <th>Invoice #</th>
          <th class="text-right">Amount Applied</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {{#each applications}}
        <tr>
          <td>{{invoiceNumber}}</td>
          <td class="text-right">{{formatMoney amount}}</td>
          <td>{{formatDate appliedAt}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/if}}

  <!-- Notes -->
  {{#if creditNote.notes}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <h3>Notes</h3>
    <div class="info-box">
      <div class="muted" style="white-space: pre-line;">{{{nl2br creditNote.notes}}}</div>
    </div>
  </div>
  {{/if}}

  <!-- Terms & Conditions -->
  {{#if creditNote.terms}}
  <div class="section" style="padding-top: 0; border-bottom: none;">
    <h3>Terms &amp; Conditions</h3>
    <div class="info-box">
      <div class="muted" style="white-space: pre-line;">{{{nl2br creditNote.terms}}}</div>
    </div>
  </div>
  {{/if}}

  <!-- Footer -->
  <div class="footer">
    <p>Credit Note #{{creditNote.creditNoteNumber}} — {{business.name}}</p>
    {{#if business.email}}<p>Contact: {{business.email}}</p>{{/if}}
    <p style="margin-top: 8px;">This credit note is issued against Invoice #{{creditNote.referenceInvoiceNumber}}.</p>
  </div>

</div>
</body>
  </html>`;

templateCache.set(DEFAULT_CREDIT_NOTE_TEMPLATE, Handlebars.compile(DEFAULT_CREDIT_NOTE_TEMPLATE, { noEscape: false }));

export const DEFAULT_QUOTE_TEMPLATE = `<!DOCTYPE html>
<html lang="{{quote.language}}">
<head>
  <meta charset="utf-8">
  <title>Quote {{quote.quoteNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 48px; color: #222; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .logo { max-height: 60px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    th { color: #666; font-weight: 600; }
    td.amount { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 16px; }
    .totals td { font-weight: 600; }
    .big-total { font-size: 20px; }
    .badge { display:inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-sent { background: #dbeafe; color: #1e40af; }
    .status-accepted { background: #dcfce7; color: #15803d; }
    .expiry-warning { color: #ea580c; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0 0 4px;">Quote</h1>
      <h2 style="margin:0; font-size: 22px;">{{quote.quoteNumber}}</h2>
      {{#if quote.expiryDate}}
      <p class="muted">Expires: {{formatDate quote.expiryDate}}</p>
      {{/if}}
    </div>
    <div style="text-align:right">
      <h2 style="margin:0">{{business.name}}</h2>
      <p class="muted">{{business.email}}</p>
      <p class="muted">{{business.phone}}</p>
    </div>
  </div>

  {{#if customer}}
  <table style="margin-bottom: 0;">
    <tr><td><span class="muted">Billed to</span></td>
        <td>{{customer.name}}{{#if customer.companyName}} ({{customer.companyName}}){{/if}}</td></tr>
    <tr><td></td><td>{{customer.email}}</td></tr>
    {{#if customer.addressLine1}}
    <tr><td></td><td>{{customer.addressLine1}}</td></tr>
    {{/if}}
    {{#if customer.addressLine2}}
    <tr><td></td><td>{{customer.addressLine2}}</td></tr>
    {{/if}}
    <tr><td></td><td>{{customer.city}}{{#if customer.stateOrRegion}}, {{customer.stateOrRegion}}{{/if}} {{customer.postalCode}}</td></tr>
  </table>
  {{/if}}

  <table>
    <tr>
      <th>#</th><th>Description</th><th style="text-align:right">Qty</th>
      <th style="text-align:right">Rate</th><th style="text-align:right">Tax</th>
      <th style="text-align:right">Amount</th>
    </tr>
    {{#each lineItems}}
    <tr>
      <td>{{@index}}</td><td>{{description}}</td>
      <td class="amount">{{quantity}}</td>
      <td class="amount">{{formatMoney unitPrice}}</td>
      <td class="amount">{{formatRate taxRate}}</td>
      <td class="amount">{{formatMoney lineTotal}}</td>
    </tr>
    {{/each}}
  </table>

  <div class="totals">
    <table style="max-width:320px; margin-left:auto">
      <tr><td>Subtotal</td><td class="amount">{{formatMoney totals.subtotal}}</td></tr>
      {{#if (gt totals.discountTotal 0)}}
      <tr><td>Discount</td><td class="amount">−{{formatMoney totals.discountTotal}}</td></tr>
      {{/if}}
      <tr><td>Tax</td><td class="amount">{{formatMoney totals.taxTotal}}</td></tr>
      {{#if (gt totals.feeTotal 0)}}
      <tr><td>Fees</td><td class="amount">{{formatMoney totals.feeTotal}}</td></tr>
      {{/if}}
      <tr class="big-total"><td>Total</td><td class="amount">{{formatMoney totals.total}}</td></tr>
    </table>
  </div>

  {{#if quote.scopeOfWork}}
  <div style="margin-top: 24px;">
    <h4 style="margin:0 0 8px; font-size: 14px; color: #666;">Scope of Work</h4>
    <div class="muted" style="white-space: pre-line;">{{{nl2br quote.scopeOfWork}}}</div>
  </div>
  {{/if}}

  {{#if quote.notes}}
  <p class="muted" style="margin-top: 24px;">{{quote.notes}}</p>
  {{/if}}
  {{#if quote.terms}}
  <p class="muted">{{quote.terms}}</p>
  {{/if}}

  <div class="footer" style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
    <p>Quote #{{quote.quoteNumber}} — {{business.name}}</p>
    {{#if business.email}}<p>Contact: {{business.email}}</p>{{/if}}
  </div>

</body>
  </html>`;

templateCache.set(DEFAULT_QUOTE_TEMPLATE, Handlebars.compile(DEFAULT_QUOTE_TEMPLATE, { noEscape: false }));

export class TemplateRenderer {
  private defaultTemplate: string;
  private defaultCreditNoteTemplate: string;
  private defaultQuoteTemplate: string;

  constructor(defaultTemplate?: string, defaultCreditNoteTemplate?: string, defaultQuoteTemplate?: string) {
    this.defaultTemplate = defaultTemplate ?? DEFAULT_INVOICE_TEMPLATE;
    this.defaultCreditNoteTemplate = defaultCreditNoteTemplate ?? DEFAULT_CREDIT_NOTE_TEMPLATE;
    this.defaultQuoteTemplate = defaultQuoteTemplate ?? DEFAULT_QUOTE_TEMPLATE;
  }

  build(data: InvoiceTemplateData): any {
    return compileTemplate((data.config?.htmlTemplate as string | undefined) ?? this.defaultTemplate);
  }

  buildCreditNote(data: CreditNoteTemplateData): any {
    return compileTemplate((data.config?.htmlTemplate as string | undefined) ?? this.defaultCreditNoteTemplate);
  }

  buildQuote(data: QuoteTemplateData): any {
    return compileTemplate((data.config?.htmlTemplate as string | undefined) ?? this.defaultQuoteTemplate);
  }

  async render(data: InvoiceTemplateData, templateHtml?: string): Promise<string> {
    const template = compileTemplate(
      templateHtml ?? (data.config?.htmlTemplate as string | undefined) ?? this.defaultTemplate
    );

    let paymentQrCode: string | null = null;
    if (data.paymentInstructions?.paymentLink) {
      try {
        paymentQrCode = await QRCode.toDataURL(data.paymentInstructions.paymentLink, { width: 150, margin: 1 });
      } catch {
        // QR generation failed, leave as null
      }
    }

    const viewInvoiceUrl = data.invoice.id ? `${env.APP_PUBLIC_BASE_URL}/invoices/${data.invoice.id}` : null;

    return template({
      ...data,
      meta: getCurrencyMetadata(data.invoice.currency),
      appBaseUrl: env.APP_PUBLIC_BASE_URL,
      paymentQrCode,
      viewInvoiceUrl,
    });
  }

  async renderCreditNote(data: CreditNoteTemplateData, templateHtml?: string): Promise<string> {
    const template = compileTemplate(
      templateHtml ?? (data.config?.htmlTemplate as string | undefined) ?? this.defaultCreditNoteTemplate
    );

    const viewCreditNoteUrl = data.creditNote.id
      ? `${env.APP_PUBLIC_BASE_URL}/credit-notes/${data.creditNote.id}`
      : null;

    return template({
      ...data,
      meta: getCurrencyMetadata(data.creditNote.currency),
      appBaseUrl: env.APP_PUBLIC_BASE_URL,
      viewCreditNoteUrl,
    });
  }

  async renderQuote(data: QuoteTemplateData, templateHtml?: string): Promise<string> {
    const template = compileTemplate(
      templateHtml ?? (data.config?.htmlTemplate as string | undefined) ?? this.defaultQuoteTemplate
    );

    const viewQuoteUrl = data.quote.id ? `${env.APP_PUBLIC_BASE_URL}/quotes/${data.quote.id}` : null;

    return template({
      ...data,
      meta: getCurrencyMetadata(data.quote.currency),
      appBaseUrl: env.APP_PUBLIC_BASE_URL,
      viewQuoteUrl,
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
    paymentTerms?: string | null;
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
      paymentTerms: invoice.paymentTerms ?? null,
    },
    lineItems: items,
    fees,
    totals,
    paymentInstructions: paymentInstructions ?? null,
    config,
  };
}

export function aggregateTaxBreakdown(
  items: TemplateLineItem[],
  fees: TemplateFee[],
  currency: CurrencyCode
): TaxBreakdownEntry[] {
  const groups = new Map<string, { rate: Decimal.Value; name: string; taxableAmount: Decimal; taxAmount: Decimal }>();

  for (const item of items) {
    const rate = new Decimal(item.taxRate ?? 0);
    if (rate.isZero()) continue;
    const key = `${rate.toFixed(4)}|${item.taxName ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.taxableAmount = existing.taxableAmount.plus(item.lineSubtotal ?? 0);
      existing.taxAmount = existing.taxAmount.plus(item.taxAmount ?? 0);
    } else {
      groups.set(key, {
        rate: rate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        name: item.taxName ?? "",
        taxableAmount: new Decimal(item.lineSubtotal ?? 0),
        taxAmount: new Decimal(item.taxAmount ?? 0),
      });
    }
  }

  for (const fee of fees) {
    const rate = new Decimal(fee.taxRate ?? 0);
    if (rate.isZero()) continue;
    const key = `${rate.toFixed(4)}|${fee.taxName ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.taxableAmount = existing.taxableAmount.plus(fee.amount ?? 0);
      existing.taxAmount = existing.taxAmount.plus(fee.taxAmount ?? 0);
    } else {
      groups.set(key, {
        rate: rate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        name: fee.taxName ?? "",
        taxableAmount: new Decimal(fee.amount ?? 0),
        taxAmount: new Decimal(fee.taxAmount ?? 0),
      });
    }
  }

  return Array.from(groups.values()).map((g) => ({
    rate: g.rate,
    name: g.name,
    taxableAmount: g.taxableAmount.toDecimalPlaces(getCurrencyMetadata(currency).decimalPlaces, Decimal.ROUND_HALF_UP),
    taxAmount: g.taxAmount.toDecimalPlaces(getCurrencyMetadata(currency).decimalPlaces, Decimal.ROUND_HALF_UP),
  }));
}

export interface BuildCreditNoteInput {
  id: string;
  creditNoteNumber: string | null;
  status: string;
  issueDate?: Date | null;
  currency: CurrencyCode;
  referenceInvoiceNumber: string | null;
  referenceInvoiceId: string | null;
  reason?: string | null;
  notes?: string | null;
  terms?: string | null;
  language?: string;
  isFinalized?: boolean;
  appliedTotal?: string | null;
  amountDue?: string | null;
}

export function buildCreditNoteData(
  creditNote: BuildCreditNoteInput,
  business: TemplateBusiness,
  customer: TemplateCustomer | null,
  items: TemplateLineItem[],
  fees: TemplateFee[],
  totals: TemplateTotals,
  applications: Array<{
    invoiceId: string;
    invoiceNumber: string;
    amount: Decimal.Value;
    appliedAt: string;
  }>,
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
      dueDate: null,
      currency: creditNote.currency,
      referenceInvoiceNumber: creditNote.referenceInvoiceNumber,
      referenceInvoiceId: creditNote.referenceInvoiceId,
      reason: creditNote.reason ?? null,
      notes: creditNote.notes ?? null,
      terms: creditNote.terms ?? null,
      language: creditNote.language ?? undefined,
      isFinalized: creditNote.isFinalized ?? false,
      appliedTotal: creditNote.appliedTotal ?? null,
      amountDue: creditNote.amountDue ?? null,
    },
    lineItems: items,
    fees,
    totals,
    applications,
    config,
  };
}

export interface BuildQuoteInput {
  id: string;
  quoteNumber: string | null;
  status: string;
  issueDate?: Date | null;
  expiryDate?: Date | null;
  currency: CurrencyCode;
  scopeOfWork?: string | null;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  language?: string;
  isFinalized?: boolean;
}

export function buildQuoteData(
  quote: BuildQuoteInput,
  business: TemplateBusiness,
  customer: TemplateCustomer | null,
  items: TemplateLineItem[],
  fees: TemplateFee[],
  totals: TemplateTotals,
  config: Record<string, unknown> = {}
): QuoteTemplateData {
  return {
    business,
    customer,
    quote: {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      issueDate: quote.issueDate ? quote.issueDate.toISOString().slice(0, 10) : null,
      expiryDate: quote.expiryDate ? quote.expiryDate.toISOString().slice(0, 10) : null,
      currency: quote.currency,
      scopeOfWork: quote.scopeOfWork ?? null,
      notes: quote.notes ?? null,
      terms: quote.terms ?? null,
      paymentInstructions: quote.paymentInstructions ?? null,
      language: quote.language ?? undefined,
      isFinalized: quote.isFinalized ?? false,
    },
    lineItems: items,
    fees,
    totals,
    config,
  };
}

// ============================================================================
// SHARED BUILDER INPUTS (for unified builder)
// ============================================================================

export interface UnifiedBuildInvoiceInput {
  business: TemplateBusiness;
  customer: TemplateCustomer | null;
  items: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  paymentInstructions?: TemplatePaymentInstructions | null;
  config?: Record<string, unknown>;
}

export interface UnifiedBuildCreditNoteInput {
  business: TemplateBusiness;
  customer: TemplateCustomer | null;
  items: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  applications: Array<{
    invoiceId: string;
    invoiceNumber: string;
    amount: Decimal.Value;
    appliedAt: string;
  }>;
  config?: Record<string, unknown>;
}

export interface BuildQuoteInputData {
  business: TemplateBusiness;
  customer: TemplateCustomer | null;
  items: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  config?: Record<string, unknown>;
}

export interface BuildDebitNoteInput {
  business: TemplateBusiness;
  customer: TemplateCustomer | null;
  debitNote: {
    id: string;
    debitNoteNumber: string | null;
    status: string;
    issueDate?: Date | null;
    dueDate?: Date | null;
    currency: CurrencyCode;
    referenceInvoiceId: string | null;
    referenceInvoiceNumber: string | null;
    reason?: string | null;
    notes?: string | null;
    terms?: string | null;
    paymentInstructions?: string | null;
    language?: string;
    isFinalized?: boolean;
  };
  items: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  config?: Record<string, unknown>;
}

export interface BuildPaymentVoucherInput {
  business: TemplateBusiness;
  payee: TemplateCustomer | null;
  voucher: {
    id: string;
    paymentVoucherNumber: string | null;
    status: string;
    voucherDate?: Date | null;
    currency: CurrencyCode;
    payeeName: string | null;
    payeeEmail: string | null;
    payeePhone: string | null;
    referenceNumber: string | null;
    paymentMethod: string | null;
    paymentProvider: string | null;
    notes?: string | null;
    terms?: string | null;
    language?: string;
    isFinalized?: boolean;
  };
  items: TemplateLineItem[];
  fees: TemplateFee[];
  totals: TemplateTotals;
  config?: Record<string, unknown>;
}

// ============================================================================
// UNIFIED BUILDER — single entry point for all document types
// ============================================================================

export type DocumentTypeKey = "invoice" | "credit-note" | "quote" | "debit-note" | "payment-voucher" | "receipt" | "purchase-order";

/**
 * Builds template data for any document type from a unified input object.
 * Each document type has its own input interface but shares common fields
 * (business, customer/payee, items, fees, totals).
 */
export function buildDocumentTemplateData(
  docType: DocumentTypeKey,
  input: UnifiedBuildInvoiceInput | UnifiedBuildCreditNoteInput | BuildQuoteInputData | BuildDebitNoteInput | BuildPaymentVoucherInput,
): DocumentTemplateData {
  switch (docType) {
    case "invoice": {
      const i = input as UnifiedBuildInvoiceInput;
      return {
        business: i.business,
        customer: i.customer,
        invoice: {
          id: "",
          invoiceNumber: null,
          status: "draft",
          issueDate: null,
          dueDate: null,
          currency: "USD",
          poNumber: null,
          notes: null,
          terms: null,
          paymentInstructions: null,
          language: undefined,
          title: null,
          depositType: null,
          depositValue: null,
          depositDueDate: null,
          depositPaid: null,
          isFinalized: false,
          depositAmount: null,
          projectId: null,
          projectName: null,
          paymentTerms: null,
        },
        lineItems: i.items,
        fees: i.fees,
        totals: i.totals,
        paymentInstructions: i.paymentInstructions ?? null,
        config: i.config ?? {},
      } as unknown as InvoiceTemplateData;
    }
    case "credit-note": {
      const i = input as UnifiedBuildCreditNoteInput;
      return {
        business: i.business,
        customer: i.customer,
        creditNote: {
          id: "",
          creditNoteNumber: null,
          status: "draft",
          issueDate: null,
          dueDate: null,
          currency: "USD",
          referenceInvoiceNumber: null,
          referenceInvoiceId: null,
          reason: null,
          notes: null,
          terms: null,
          language: undefined,
          isFinalized: false,
          appliedTotal: null,
          amountDue: null,
        },
        lineItems: i.items,
        fees: i.fees,
        totals: i.totals,
        applications: i.applications,
        config: i.config ?? {},
      } as unknown as CreditNoteTemplateData;
    }
    case "quote": {
      const i = input as BuildQuoteInputData;
      return {
        business: i.business,
        customer: i.customer,
        quote: {
          id: "",
          quoteNumber: null,
          status: "draft",
          issueDate: null,
          expiryDate: null,
          currency: "USD",
          scopeOfWork: null,
          notes: null,
          terms: null,
          paymentInstructions: null,
          language: undefined,
          isFinalized: false,
        },
        lineItems: i.items,
        fees: i.fees,
        totals: i.totals,
        config: i.config ?? {},
      } as QuoteTemplateData;
    }
    case "debit-note": {
      const i = input as BuildDebitNoteInput;
      return {
        business: i.business,
        customer: i.customer,
        debitNote: {
          id: i.debitNote.id,
          debitNoteNumber: i.debitNote.debitNoteNumber,
          status: i.debitNote.status,
          issueDate: i.debitNote.issueDate ? i.debitNote.issueDate.toISOString().slice(0, 10) : null,
          dueDate: i.debitNote.dueDate ? i.debitNote.dueDate.toISOString().slice(0, 10) : null,
          currency: i.debitNote.currency,
          referenceInvoiceId: i.debitNote.referenceInvoiceId,
          referenceInvoiceNumber: i.debitNote.referenceInvoiceNumber,
          reason: i.debitNote.reason ?? null,
          notes: i.debitNote.notes ?? null,
          terms: i.debitNote.terms ?? null,
          paymentInstructions: i.debitNote.paymentInstructions ?? null,
          language: i.debitNote.language ?? undefined,
          isFinalized: i.debitNote.isFinalized ?? false,
        },
        lineItems: i.items,
        fees: i.fees,
        totals: i.totals,
        config: i.config ?? {},
      } as unknown as DebitNoteTemplateData;
    }
    case "payment-voucher": {
      const i = input as BuildPaymentVoucherInput;
      return {
        business: i.business,
        payee: i.payee,
        voucher: {
          id: i.voucher.id,
          paymentVoucherNumber: i.voucher.paymentVoucherNumber,
          status: i.voucher.status,
          voucherDate: i.voucher.voucherDate ? i.voucher.voucherDate.toISOString().slice(0, 10) : null,
          currency: i.voucher.currency,
          payeeName: i.voucher.payeeName,
          payeeEmail: i.voucher.payeeEmail,
          payeePhone: i.voucher.payeePhone,
          referenceNumber: i.voucher.referenceNumber,
          paymentMethod: i.voucher.paymentMethod,
          paymentProvider: i.voucher.paymentProvider,
          notes: i.voucher.notes ?? null,
          terms: i.voucher.terms ?? null,
          language: i.voucher.language ?? undefined,
          isFinalized: i.voucher.isFinalized ?? false,
        },
        lineItems: i.items,
        fees: i.fees,
        totals: i.totals,
        config: i.config ?? {},
      } as unknown as PaymentVoucherTemplateData;
    }
    default:
      throw new Error(`Unknown document type: ${docType}`);
  }
}

// ============================================================================
// SHARED CUSTOMER SNAPSHOT — eliminates fetchCustomer() duplication
// ============================================================================

/**
 * Shared helper to fetch a customer as a `TemplateCustomer` snapshot from the DB.
 * Consolidates the previously duplicated `fetchCustomer()` logic found in
 * InvoiceService and QuoteService.
 */
export async function fetchCustomerSnapshot(
  businessId: string,
  customerId: string,
): Promise<TemplateCustomer | null> {
  const res = await query(
    `SELECT id, name, company_name, email, phone, tax_id,
            address_line_1, address_line_2, city, state_or_region, postal_code, country_code,
            default_currency, notes, payment_terms, shipping_address_id
     FROM customers WHERE id = $1 AND business_id = $2`,
    [customerId, businessId]
  );
  if (!res.rows.length) return null;
  const r = res.rows[0];
  const customer: TemplateCustomer = {
    id: r.id,
    name: r.name,
    companyName: r.company_name,
    email: r.email,
    phone: r.phone,
    taxId: r.tax_id,
    address: r.address_line_1 ? {
      addressLine1: r.address_line_1,
      addressLine2: r.address_line_2,
      city: r.city,
      stateOrRegion: r.state_or_region,
      postalCode: r.postal_code,
      countryCode: r.country_code,
    } : { addressLine1: "", addressLine2: null, city: "", stateOrRegion: "", postalCode: "", countryCode: "US" },
    countryCode: r.country_code,
    notes: r.notes,
    paymentTerms: r.payment_terms,
  };
  if (r.shipping_address_id) {
    const addrRes = await query(
      `SELECT address_line_1, address_line_2, city, state_or_region, postal_code, country_code
       FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
      [r.shipping_address_id, customerId]
    );
    if (addrRes.rows.length) {
      const a = addrRes.rows[0];
      customer.shippingAddress = {
        addressLine1: a.address_line_1,
        addressLine2: a.address_line_2,
        city: a.city,
        stateOrRegion: a.state_or_region,
        postalCode: a.postal_code,
        countryCode: a.country_code,
      };
    }
  }
  return customer;
}

// ============================================================================
// SHARED BUSINESS SNAPSHOT
// ============================================================================

/**
 * Shared helper to fetch a business as a `TemplateBusiness` snapshot.
 * Reduces boilerplate duplication across document services.
 */
export async function fetchBusinessSnapshot(businessId: string): Promise<TemplateBusiness> {
  const res = await query(
    `SELECT id, name, legal_name, email, phone, website, tax_id, registration_number,
            address_line_1, address_line_2, city, state_or_region, postal_code, country_code,
            default_currency, logo_url
     FROM businesses WHERE id = $1`,
    [businessId]
  );
  if (!res.rows.length) throw new Error("Business not found");
  const r = res.rows[0];
  return {
    id: r.id,
    name: r.name,
    legalName: r.legal_name,
    email: r.email,
    phone: r.phone,
    website: r.website,
    taxId: r.tax_id,
    registrationNumber: r.registration_number,
    address: {
      addressLine1: r.address_line_1 || "",
      addressLine2: r.address_line_2 || null,
      city: r.city || "",
      stateOrRegion: r.state_or_region || "",
      postalCode: r.postal_code || "",
      countryCode: r.country_code || "",
    },
    countryCode: r.country_code || "",
    defaultCurrency: r.default_currency || "USD",
    logoUrl: r.logo_url,
  };
}
