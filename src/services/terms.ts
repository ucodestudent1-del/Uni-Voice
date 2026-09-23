/**
 * Default SaaS payment & legal terms applied to invoices when no custom
 * terms are supplied by the business.
 *
 * These cover the core requirements for a SaaS invoice:
 *  1. Payment is due within the period specified on the invoice.
 *  2. Overdue balances may incur interest / late fees (where permitted).
 *  3. Customer is responsible for applicable taxes unless exempt.
 *  4. Payments are non-refundable except as required by law.
 *  5. Disputes must be raised in writing within 30 days.
 *  6. Usage is subject to the company's Terms of Service (linked).
 *  7. Governing law of the specified jurisdiction.
 *  8. Billing inquiries directed to the designated billing contact.
 *
 * The values below are intentionally generic. Each business can override the
 * default terms through `business_settings.default_terms`, or provide
 * per-invoice terms at draft creation time.
 *
 * `TERMS_PLACEHOLDERS` holds tokens that may appear inside the rendered text.
 * They are resolved from business/invoice context at render time. Keeping them
 * as named placeholders (rather than hard-coded values) lets the terms stay
 * configurable per-business.
 */

export interface TermsContext {
  jurisdiction?: string;
  tosUrl?: string;
  billingEmail?: string;
}

/** Plain-text default payment & legal terms. */
export const DEFAULT_INVOICE_TERMS_TEMPLATE = `Payment Terms
Payment is due within the period specified on the invoice.

Late Payment
Overdue balances may accrue interest at the maximum rate permitted by applicable law, plus a reasonable late fee, to the fullest extent permitted by law.

Taxes
The customer is responsible for all applicable taxes, duties, and governmental charges, except for taxes based on our income. If we are required to collect or remit taxes, they will be added to the invoice; a valid exemption certificate is required to avoid taxation.

Refund Policy
All payments are non-refundable except as required by applicable law or as set forth in our applicable refund policy (available at: {{tosUrl}}).

Dispute Resolution
Any disputes regarding an invoice must be submitted in writing within 30 days of the invoice date. Failure to dispute within this period constitutes acceptance of the invoice as correct.

Terms of Service
Use of the SaaS platform and related services is subject to our Terms of Service and any applicable subscription agreement. The full Terms of Service are available at: {{tosUrl}}.

Governing Law
This agreement and all invoices are governed by the laws of {{jurisdiction}}, without regard to conflict of law principles.

Contact
Direct all billing inquiries to: {{billingEmail}}`;

/**
 * The default jurisdiction used when the business has not specified one.
 * This is intentionally generic so it can be overridden per-business.
 */
export const DEFAULT_JURISDICTION = "the State of Delaware, USA";

/**
 * Default billing contact email used when the business has not configured one.
 */
export const DEFAULT_BILLING_EMAIL = "billing@example.com";

/**
 * Default Terms of Service URL used when the business has not configured one.
 */
export const DEFAULT_TOS_URL = "https://www.example.com/terms";

export interface ResolvedTerms {
  plainText: string;
  html: string;
}

const BLOCK_TAGS: Record<string, string> = {
  "Payment Terms": "h4",
  "Late Payment": "h4",
  Taxes: "h4",
  "Refund Policy": "h4",
  "Dispute Resolution": "h4",
  "Terms of Service": "h4",
  "Governing Law": "h4",
  Contact: "h4",
};

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Resolves the template tokens (`{{tosUrl}}`, `{{jurisdiction}}`, `{{billingEmail}}`)
 * inside DEFAULT_INVOICE_TERMS_TEMPLATE using the provided context.
 */
export function renderDefaultTerms(context: TermsContext = {}): ResolvedTerms {
  const tosUrl = context.tosUrl ?? DEFAULT_TOS_URL;
  const jurisdiction = context.jurisdiction ?? DEFAULT_JURISDICTION;
  const billingEmail = context.billingEmail ?? DEFAULT_BILLING_EMAIL;

  const plainText = DEFAULT_INVOICE_TERMS_TEMPLATE
    .replace(/\{\{tosUrl\}\}/g, tosUrl)
    .replace(/\{\{jurisdiction\}\}/g, jurisdiction)
    .replace(/\{\{billingEmail\}\}/g, billingEmail);

  const html = plainTextToHtml(plainText);

  return { plainText, html };
}

/**
 * Converts the structured plain-text terms into minimal HTML.
 *
 * The terms template is organised as a sequence of "blocks": a heading line
 * followed by one or more body paragraph(s). A new block starts whenever a
 * heading line (matching one of the known header names) is encountered.
 */
function plainTextToHtml(text: string): string {
  const lines = text.split("\n").map((l) => l.trim());
  const blocks: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    if (!line) {
      continue;
    }
    const heading = BLOCK_TAGS[line];
    if (heading) {
      if (current) blocks.push(current);
      current = { heading: line, body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      current = { heading: "", body: [line] };
    }
  }
  if (current) blocks.push(current);

  const parts = blocks.map((b) => {
    const label = BLOCK_TAGS[b.heading];
    const tag = label ?? "p";
    const body = b.body.filter(Boolean);
    const bodyHtml = body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    if (b.heading && tag === "h4") {
      return `<h4>${escapeHtml(b.heading)}</h4>${bodyHtml}`;
    }
    return `<p>${escapeHtml(b.heading ?? "")}</p>${bodyHtml}`;
  });

  return parts.join("");
}

/**
 * Returns the default invoice terms for a business, falling back to the
 * generic SaaS default when the business has not configured custom terms.
 *
 * `inputTerms` takes precedence (per-invoice override), then business
 * `defaultTerms`, then the built-in SaaS default rendered with the provided
 * context.
 */
export function resolveInvoiceTerms(
  inputTerms?: string | null,
  businessDefaultTerms?: string | null,
  context: TermsContext = {}
): ResolvedTerms | null {
  if (inputTerms && inputTerms.trim()) {
    return {
      plainText: inputTerms,
      html: escapeHtml(inputTerms),
    };
  }
  if (businessDefaultTerms && businessDefaultTerms.trim()) {
    return {
      plainText: businessDefaultTerms,
      html: escapeHtml(businessDefaultTerms),
    };
  }
  return renderDefaultTerms(context);
}
