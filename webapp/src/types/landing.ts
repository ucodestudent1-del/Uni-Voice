import type { ReactNode } from "react";

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
  | "document-lock"
  | "shield-lock"
  | "globe-currency"
  | "clock-arrow"
  | "document-sparkle";

export const pricingFeatures: FeatureItem[] = [
  {
    title: "Real-time calculations",
    description: "Built on a deterministic calculation engine using integer minor units. No floating-point errors, ever.",
    icon: "calculator",
  },
  {
    title: "Secure public invoice pages",
    description: "Share invoices with customers via secure tokenized links. Track views and enable online payments.",
    icon: "document-lock",
  },
  {
    title: "Two-factor authentication",
    description: "Protect your account with TOTP authenticator apps and single-use recovery codes.",
    icon: "shield-lock",
  },
  {
    title: "Global & multi-currency",
    description: "Bill customers in 170+ currencies with automatic exchange-rate lookup.",
    icon: "globe-currency",
  },
  {
    title: "Smart automations",
    description: "Recurring invoices, scheduled sends, and automatic payment reminders save you hours each month.",
    icon: "clock-arrow",
  },
  {
    title: "Brandable templates",
    description: "Customizable, print-ready templates that match your brand — for invoices, quotes, and receipts.",
    icon: "document-sparkle",
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

export type { ReactNode };
