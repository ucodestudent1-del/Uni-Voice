import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Section } from "../components/ui/Section";
import FeaturesSection from "../components/ui/FeaturesSection";
import FaqSection from "../components/ui/FaqSection";
import TemplateGallery from "../components/ui/TemplateGallery";
import ThemeToggle from "../components/ThemeToggle";
import { pricingFeatures, faqs, templateModules } from "../data/landing";
import { useMetaTags } from "../hooks/useMetaTags";
import { CreditCard, Send, Smartphone, BarChart3, CheckCircle } from "lucide-react";

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useMetaTags({
    title: "Professional Invoice Generator | InvoiceFlow",
    description: "Create, send, and track invoices in seconds. Free plan includes everything you need to get started. Upgrade to Pro for automation that saves you hours every month.",
  });

  return (
    <div className="min-h-screen bg-page text-primary">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between h-16 py-4">
          <div className="text-xl font-bold text-primary">InvoiceFlow</div>
          <div className="hidden md:flex items-center gap-8">
            <Link to="#templates" className="text-sm text-tertiary hover:text-primary transition-colors">Templates</Link>
            <Link to="#features" className="text-sm text-tertiary hover:text-primary transition-colors">Features</Link>
            <Link to="/pricing" className="text-sm text-tertiary hover:text-primary transition-colors">Pricing</Link>
            <Link to="#faq" className="text-sm text-tertiary hover:text-primary transition-colors">FAQ</Link>
            <button onClick={() => navigate("/login")} className="text-sm text-tertiary hover:text-primary transition-colors">
              Login
            </button>
            <button
              onClick={() => navigate("/register")}
              className="inline-flex items-center rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            >
              Create Free Invoice
            </button>
          </div>
          <div className="flex md:hidden items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => navigate("/register")}
              className="inline-flex items-center rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            >
              Get Started
            </button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <Section className="pt-16 pb-20">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-8">
            <h1 className="text-4xl font-bold text-primary sm:text-5xl lg:text-6xl leading-tight">
              Professional invoices without the accounting headache
            </h1>
            <p className="text-lg text-secondary max-w-lg leading-relaxed">
              Create, send, and track invoices in seconds — with automatic calculations, branded templates, and online payments built in.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={() => navigate("/register")}
                className="inline-flex items-center rounded-lg bg-primary-action px-6 py-3 text-base font-semibold text-on-primary hover:bg-primary-hover shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                Create Free Invoice
              </button>
              <span className="text-sm text-tertiary">No credit card required · Cancel anytime</span>
            </div>
          </div>
          <div className="lg:col-span-7 relative">
            <div className="absolute -inset-8 bg-primary-bg/30 blur-3xl rounded-full" />
            <div className="relative bg-surface border border-color rounded-2xl shadow-xl overflow-hidden">
              <InvoicePreviewHero />
            </div>
          </div>
        </div>
      </Section>

      {/* Value proposition */}
      <Section bg="slate-50" className="py-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-bg px-4 py-1.5 text-sm font-medium text-primary-brand mb-4">
            <CheckCircle className="h-4 w-4" />
            Simple, transparent pricing
          </div>
          <h2 className="text-3xl font-bold text-primary sm:text-4xl">
            Everything you need to get paid faster
          </h2>
          <p className="mt-4 text-lg text-secondary max-w-2xl mx-auto">
            One flat <span className="font-bold text-primary">$15/month</span> — no per-invoice fees, no hidden charges.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-8">
          <ValueCard
            icon={<Smartphone className="h-7 w-7 text-primary" />}
            title="Create in seconds"
            description="Fill in your details and line items. Calculations are automatic and always accurate."
          />
          <ValueCard
            icon={<Send className="h-7 w-7 text-primary" />}
            title="Send with confidence"
            description="Email invoices with a secure payment link. Customers can pay online in one click."
          />
          <ValueCard
            icon={<BarChart3 className="h-7 w-7 text-primary" />}
            title="Get paid faster"
            description="Real-time payment tracking, automatic reminders, and detailed analytics."
          />
        </div>
      </Section>

      {/* Templates */}
      <Section id="templates" className="py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-primary sm:text-4xl">
            Beautiful templates, professionally designed
          </h2>
          <p className="mt-4 text-lg text-secondary max-w-2xl mx-auto">
            Choose from premium templates that match your brand — customizable with your logo, colors, and fonts.
          </p>
        </div>
        <TemplateGallery items={templateModules} className="mx-auto max-w-5xl" />
      </Section>

      {/* Features */}
      <FeaturesSection
        id="features"
        title="Built for accuracy and speed"
        subtitle="Powerful features designed to eliminate busywork and prevent costly calculation errors."
        features={pricingFeatures}
      />

      {/* Pricing teaser */}
      <Section bg="slate-50" className="py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-primary sm:text-4xl">Simple, transparent pricing</h2>
          <p className="mt-4 text-lg text-secondary max-w-2xl mx-auto">
            One flat monthly rate of <span className="font-bold text-primary">$15/month</span>. No per-invoice fees. Cancel anytime.
          </p>
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            to="/pricing"
            className="inline-flex items-center rounded-lg bg-primary-action px-6 py-3 text-base font-semibold text-on-primary hover:bg-primary-hover shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          >
            View Full Pricing
          </Link>
        </div>
      </Section>

      {/* FAQ */}
      <FaqSection id="faq" items={faqs} />

      {/* Final CTA */}
      <Section className="py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-primary sm:text-4xl mb-4">
            {isAuthenticated ? "Continue to your dashboard" : "Ready to get started?"}
          </h2>
          <p className="text-secondary mb-8 max-w-lg mx-auto">
            {isAuthenticated
              ? "Go to your dashboard to manage invoices."
              : "Join over 10,000 businesses using InvoiceFlow to get paid faster."}
          </p>
          <button
            onClick={() => (isAuthenticated ? navigate("/app") : navigate("/register"))}
            className="inline-flex items-center rounded-lg bg-primary-action px-6 py-3 text-base font-semibold text-on-primary hover:bg-primary-hover shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          >
            {isAuthenticated ? "Go to Dashboard" : "Create Your Free Invoice"}
          </button>
        </div>
      </Section>

      <footer className="border-t border-color-subtle py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <p className="text-tertiary">© 2026 InvoiceFlow. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-sm text-tertiary hover:text-primary transition-colors">Privacy</Link>
              <Link to="/terms" className="text-sm text-tertiary hover:text-primary transition-colors">Terms</Link>
              <Link to="/pricing" className="text-sm text-tertiary hover:text-primary transition-colors">Pricing</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ValueCard({ icon, title, description }: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-bg text-primary">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-primary mb-2">{title}</h3>
      <p className="text-secondary max-w-xs">{description}</p>
    </div>
  );
}

function InvoicePreviewHero() {
  return (
    <div className="p-8 w-full">
      {/* Business info + status */}
      <div className="flex justify-between items-start mb-8 pb-6 border-b border-color-subtle">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-action/10 text-primary">
            <span className="text-xl font-bold text-primary">NF</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Nexus Design Studio</h2>
            <p className="text-sm text-secondary">hello@nexusdesign.co</p>
            <p className="text-sm text-tertiary">555-0123 · Portland, OR</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-3 py-1 text-xs font-medium text-info-text">
          <CheckCircle className="h-3 w-3" />
          Paid
        </span>
      </div>

      {/* Bill to + invoice details */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-2">Bill To</h3>
          <p className="text-base font-semibold text-primary">Sarah Chen</p>
          <p className="text-sm text-secondary">Acme Corp</p>
          <p className="text-sm text-tertiary">s.chen@acme.com</p>
          <p className="text-sm text-tertiary">San Francisco, CA</p>
        </div>
        <div className="text-right">
          <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-2">Invoice Details</h3>
          <div className="space-y-1 text-sm">
            <p><span className="text-tertiary">Invoice #:</span> <span className="text-primary font-medium">INV-2026-0001</span></p>
            <p><span className="text-tertiary">Issue date:</span> <span className="text-primary">Aug 15, 2026</span></p>
            <p><span className="text-tertiary">Due date:</span> <span className="text-primary">Sep 30, 2026</span></p>
            <p><span className="text-tertiary">Currency:</span> <span className="text-primary">USD</span></p>
          </div>
        </div>
      </div>

      {/* Line items */}
      <table className="w-full text-sm mb-8">
        <thead>
          <tr className="border-b border-color-subtle text-left font-medium">
            <th className="pb-3 text-xs font-semibold text-tertiary uppercase">Description</th>
            <th className="pb-3 text-right text-xs font-semibold text-tertiary uppercase">Qty</th>
            <th className="pb-3 text-right text-xs font-semibold text-tertiary uppercase">Rate</th>
            <th className="pb-3 text-right text-xs font-semibold text-tertiary uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-color-subtle">
            <td className="py-3 text-primary">Web Development Services</td>
            <td className="py-3 text-right font-tabular-nums">40.00</td>
            <td className="py-3 text-right font-tabular-nums text-secondary">$125.00</td>
            <td className="py-3 text-right font-medium font-tabular-nums text-primary">$5,000.00</td>
          </tr>
          <tr>
            <td className="py-3 text-primary">Stock photo license</td>
            <td className="py-3 text-right font-tabular-nums">1.00</td>
            <td className="py-3 text-right font-tabular-nums text-secondary">$75.00</td>
            <td className="py-3 text-right font-medium font-tabular-nums text-primary">$75.00</td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <table className="w-64 text-sm font-tabular-nums">
          <tbody>
            <tr>
              <td className="py-2 text-secondary">Subtotal</td>
              <td className="py-2 text-right text-primary">$5,075.00</td>
            </tr>
            <tr>
              <td className="py-2 text-secondary">Tax (10%)</td>
              <td className="py-2 text-right text-primary">$507.50</td>
            </tr>
            <tr className="border-t border-color-subtle pt-2">
              <td className="py-3 text-lg font-semibold text-primary">Total</td>
              <td className="py-3 text-right text-xl font-bold text-primary">$5,582.50</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment */}
      <div className="border-t border-color-subtle pt-6">
        <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary transition-colors">
          <CreditCard className="h-4 w-4" />
          Pay $5,582.50 now
        </button>
        <p className="mt-2 text-center text-xs text-tertiary">
          Secure online payment — no account required
        </p>
      </div>
    </div>
  );
}
