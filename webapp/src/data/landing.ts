import type { ReactNode } from "react";

export interface PricingTier {
  id: string;
  name: string;
  description: string;
  price: { monthly: number; yearly: number };
  currency: string;
  features: string[];
  cta?: string;
  ctaLink?: string;
  highlighted?: boolean;
  badge?: string;
  beta?: boolean;
  betaLink?: string;
  saveText?: string;
}

export interface FeatureItem {
  title: string;
  description: string;
  icon: FeatureIcon;
  imageOnRight?: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface TemplateModule {
  id: string;
  name: string;
  description: string;
  color: "slate" | "primary" | "teal" | "amber";
}

export type FeatureIcon =
  | "calculator"
  | "shield"
  | "globe"
  | "lightning"
  | "template"
  | "bell"
  | "qr"
  | "lock";

const USD = "USD" as const;

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    description: "Make professional invoices",
    price: { monthly: 0, yearly: 0 },
    currency: USD,
    features: [
      "Up to 5 invoices per month",
      "5 customers",
      "Basic templates",
      "PDF generation & download",
      "Multiple currencies",
      "Basic customization",
    ],
    cta: "Get Started",
    ctaLink: "/register",
  },
  {
    id: "pro",
    name: "Pro",
    description: "Automate your invoicing",
    price: { monthly: 19, yearly: 190 },
    currency: USD,
    features: [
      "Unlimited invoices",
      "Unlimited customers",
      "Custom branding (logo, colors, fonts)",
      "Premium templates",
      "Recurring invoices",
      "Scheduled invoices",
      "Automated payment reminders",
      "Payment links",
      "CSV/Excel exports",
    ],
    cta: "Start free trial",
    ctaLink: "/register",
    highlighted: true,
    badge: "Most Popular",
    saveText: "Save 29% with annual billing",
  },
  {
    id: "business",
    name: "Business",
    description: "Manage your billing and financial workflow",
    price: { monthly: 49, yearly: 490 },
    currency: USD,
    features: [
      "Everything in Pro",
      "Quotes & estimates",
      "Purchase orders & receipts",
      "Credit notes & refunds",
      "Revenue dashboards",
      "Advanced reports",
      "API access",
      "Multiple businesses/brands",
    ],
    cta: "Contact sales",
    ctaLink: "/register",
    beta: true,
  },
];

export const pricingFeatures: FeatureItem[] = [
  {
    title: "Real-time calculations",
    description: "Built on a deterministic calculation engine using integer minor units. No floating-point errors, ever.",
    icon: "calculator",
  },
  {
    title: "Secure public invoice pages",
    description: "Share invoices with customers via secure tokenized links. Track views and enable online payments.",
    icon: "shield",
  },
  {
    title: "Two-factor authentication",
    description: "Protect your account with TOTP authenticator apps and single-use recovery codes.",
    icon: "shield",
  },
  {
    title: "Global & multi-currency",
    description: "Bill customers in 170+ currencies with automatic exchange-rate lookup.",
    icon: "globe",
  },
  {
    title: "Smart automations",
    description: "Recurring invoices, scheduled sends, and automatic payment reminders save you hours each month.",
    icon: "bell",
  },
  {
    title: "Brandable templates",
    description: "Customizable, print-ready templates that match your brand — for invoices, quotes, and receipts.",
    icon: "template",
  },
];

export const faqs: FaqItem[] = [
  {
    question: "Do you charge per invoice?",
    answer: "No. There are no per-invoice fees on any plan. You pay one flat monthly or annual subscription and send as many invoices as you want.",
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
    question: "Do you offer discounts for annual billing?",
    answer: "Yes — save up to 29% on Pro and Business when you pay annually.",
  },
  {
    question: "How secure is my data?",
    answer: "All data is encrypted at rest and in transit using AES-256 and TLS 1.3. We offer two-factor authentication (TOTP + recovery codes) and role-based access control.",
  },
  {
    question: "Can I customize templates with my branding?",
    answer: "Yes. On Pro or Business you can upload your logo, choose brand colors, and customize fonts for every document.",
  },
];

export const templateModules: TemplateModule[] = [
  { id: "classic", name: "Classic", description: "Clean and professional for consulting and services", color: "slate" },
  { id: "modern", name: "Modern", description: "Bold contemporary design for creative agencies", color: "primary" },
  { id: "minimal", name: "Minimal", description: "Ultra-clean with ample whitespace", color: "slate" },
  { id: "elegant", name: "Elegant", description: "Sophisticated serif typography for premium brands", color: "teal" },
  { id: "compact", name: "Compact", description: "Space-efficient layout for detailed line items", color: "amber" },
];

export interface PricingTierDisplay extends PricingTier {
  saveText?: string;
}
