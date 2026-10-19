import type { FeatureItem, FaqItem } from "@/types/landing";

export const pricingFeatures: FeatureItem[] = [
  {
    title: "Real-time calculations",
    description: "Built on a deterministic calculation engine using integer minor units. No floating-point errors, ever.",
    icon: "calculator",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Integer minor-unit math, never float</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Subtotal, tax, discount, fees computed instantly</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Automatic rounding to currency precision</li>
      </ul>
    ),
  },
  {
    title: "Multiple document types",
    description: "Create invoices, quotes, credit notes, debit notes, receipts, payment vouchers, and purchase orders — all with consistent branding and calculations.",
    icon: "file-text",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Invoices, quotes, credit & debit notes</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Receipts, payment vouchers, purchase orders</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Recurring invoices for subscriptions</li>
      </ul>
    ),
  },
  {
    title: "Secure public invoice pages",
    description: "Share invoices with customers via secure tokenized links. Track views and enable online payments.",
    icon: "document-lock",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Unique secure links per invoice</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Page-view tracking in real time</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Embedded card payments via Stripe</li>
      </ul>
    ),
  },
  {
    title: "Online payments & payouts",
    description: "Accept payments via Stripe with support for cards, ACH, and more. Track payments and reconcile automatically.",
    icon: "credit-card",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Stripe integration with card & ACH</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Real-time payment status tracking</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Payment history & reconciliation</li>
      </ul>
    ),
  },
  {
    title: "Smart automations",
    description: "Scheduled sends and automatic payment reminders save you hours each month.",
    icon: "clock-arrow",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Scheduled invoice sends</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Smart payment reminders</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Auto-followups for overdue invoices</li>
      </ul>
    ),
  },
  {
    title: "Recurring invoices",
    description: "Set up subscription-style billing with automatic invoice generation and scheduled delivery.",
    icon: "repeat",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Custom billing intervals</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Auto-generation of invoices</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Scheduled email delivery</li>
      </ul>
    ),
  },
  {
    title: "Reports & analytics",
    description: "Track revenue, taxes, client balances, and payment performance with detailed reports.",
    icon: "bar-chart",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Revenue, tax & client reports</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Aging & payment metrics</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Export to CSV / PDF</li>
      </ul>
    ),
  },
  {
    title: "AI-powered assistance",
    description: "Leverage AI to parse email conversations and auto-generate draft invoices with line items.",
    icon: "bot",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Email-to-invoice parsing</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Smart default line items</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Suggested invoice fields</li>
      </ul>
    ),
  },
  {
    title: "Brandable templates",
    description: "Customizable, print-ready templates that match your brand — for invoices and receipts.",
    icon: "document-sparkle",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Upload your logo & brand colors</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Print & PDF export</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Templates for invoices, receipts</li>
      </ul>
    ),
  },
  {
    title: "Two-factor authentication",
    description: "Protect your account with TOTP authenticator apps and single-use recovery codes.",
    icon: "shield-lock",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />TOTP support (Google Authenticator, Authy, etc.)</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Recovery codes for account access</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Role-based access control</li>
      </ul>
    ),
  },
  {
    title: "Global & multi-currency",
    description: "Bill customers in 170+ currencies with automatic exchange-rate lookup.",
    icon: "globe-currency",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />170+ supported currencies</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Automatic FX rate lookup</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Localized number & date formats</li>
      </ul>
    ),
  },
  {
    title: "Customer & project management",
    description: "Organize customers into groups and track time against projects — all linked to your invoices.",
    icon: "users",
    details: (
      <ul className="mt-2 space-y-1 text-sm text-tertiary">
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Customer groups & contacts</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Project time tracking</li>
        <li className="flex items-start gap-2"><span className="mt-0.5 h-1 w-1 rounded-full bg-success-text" aria-hidden="true" />Import customers from CSV</li>
      </ul>
    ),
  },
];

export const faqs: FaqItem[] = [
  {
    question: "Do you charge per invoice?",
    answer: "No. There are no per-invoice fees on any plan. You pay one flat monthly subscription and send as many invoices as you want.",
  },
  {
    question: "Can I cancel my subscription?",
    answer: "Yes, you can cancel anytime from your plan settings. Your data remains accessible through the end of the paid billing period.",
  },
  {
    question: "Is there a free trial?",
    answer: "The Free plan is available forever with no time limits. If you upgrade to Pro, you can try it free for 14 days, then pay only if you love it.",
  },
  {
    question: "How secure is my data?",
    answer: "All data is encrypted at rest and in transit using AES-256 and TLS 1.3. We offer two-factor authentication (TOTP + recovery codes) and role-based access control.",
  },
  {
    question: "Can I customize templates with my branding?",
    answer: "Yes. On Pro you can upload your logo, choose brand colors, and customize fonts for every document.",
  },
  {
    question: "What payment providers do you support?",
    answer: "We integrate with Stripe to accept card payments, ACH transfers, and more from customers worldwide.",
  },
];

export type { FeatureItem, FaqItem };
