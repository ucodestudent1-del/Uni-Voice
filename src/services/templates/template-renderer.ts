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
    {{#if business.logoUrl}}<img class="logo" src="{{business.logoUrl}}" alt="{{business.name}}">{{{{/if}}
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
  {{#if invoice.terms}}<p class="muted">{{{invoice.terms}}}</p>{{/if}}
</body>
</html>`;

Handlebars.registerHelper("add", (a: number, b: number) => a + b);

export class TemplateRenderer {
  private defaultTemplate: string;

  constructor(defaultTemplate?: string) {
    this.defaultTemplate = defaultTemplate ?? DEFAULT_INVOICE_TEMPLATE;
  }

  build(data: InvoiceTemplateData): any {
    return Handlebars.compile(data.config?.htmlTemplate as string | undefined ?? this.defaultTemplate, {
      noEscape: true,
    });
  }

  render(data: InvoiceTemplateData, templateHtml?: string): string {
    const template = Handlebars.compile(templateHtml ?? data.config?.htmlTemplate as string | undefined ?? this.defaultTemplate, {
      noEscape: true,
    });
    return template({
      ...data,
      formatMoney: (v: Decimal.Value) => fmt(v, data.invoice.currency),
      formatRate: fmtRate,
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
