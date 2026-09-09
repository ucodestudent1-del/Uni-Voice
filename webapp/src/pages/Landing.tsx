import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Section, SectionHeader } from "../components/ui/Section";
import PricingTable from "../components/ui/PricingTable";
import FeaturesSection from "../components/ui/FeaturesSection";
import FaqSection from "../components/ui/FaqSection";
import TemplateGallery from "../components/ui/TemplateGallery";
import { pricingTiers, pricingFeatures, faqs, templateModules } from "../data/landing";

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between h-16 py-4">
          <div className="text-xl font-bold text-slate-900">InvoiceFlow</div>
          <div className="hidden md:flex items-center gap-8">
            <Link to="#pricing" className="text-sm text-slate-600 hover:text-slate-900">Pricing</Link>
            <Link to="#templates" className="text-sm text-slate-600 hover:text-slate-900">Templates</Link>
            <Link to="#features" className="text-sm text-slate-600 hover:text-slate-900">Features</Link>
            <Link to="#faq" className="text-sm text-slate-600 hover:text-slate-900">FAQ</Link>
            <button onClick={() => navigate("/login")} className="text-sm text-slate-600 hover:text-slate-900">
              Login
            </button>
            <button
              onClick={() => navigate("/register")}
              className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Create Free Invoice
            </button>
          </div>
          <button
            onClick={() => navigate("/register")}
            className="inline-flex md:hidden items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Get Started
          </button>
        </nav>
      </header>

      {/* Hero */}
      <Section className="pt-12 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl leading-tight">
              Professional invoices without the accounting headache
            </h1>
            <p className="text-lg text-slate-600 max-w-lg">
              Create, send, and track invoices in seconds. Free plan includes everything you need to get started.
              Upgrade to Pro for automation that saves you hours every month.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={() => navigate("/register")}
                className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white hover:bg-primary-700 shadow-lg hover:shadow-xl transition-shadow"
              >
                Create Free Invoice
              </button>
              <span className="text-sm text-slate-500">No credit card required · Cancel anytime</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-primary-100/50 blur-3xl rounded-full" />
            <div className="relative bg-white border border-slate-200 rounded-2xl shadow-xl">
              <InvoicePreviewHero />
            </div>
          </div>
        </div>
      </Section>

      {/* Three-step */}
      <Section bg="slate-50" className="py-16">
        <SectionHeader
          title="Get paid in three simple steps"
          subtitle="From draft to paid — in under two minutes"
        />
        <div className="grid md:grid-cols-3 gap-10">
          <StepCard
            step={1}
            title="Create"
            description="Add your business details, select a customer, and fill in line items with automatic calculations."
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.25 4.5v5.25l4.5 2.25" />}
          />
          <StepCard
            step={2}
            title="Send"
            description="Review and send your professional invoice via email with a single click. Customers receive a secure link."
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3 9v6h12l-3-3M6 12l3 3-3-3z" />}
          />
          <StepCard
            step={3}
            title="Get Paid"
            description="Track views and payments in real time. Get automatic reminders so you never chase payments again."
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />}
          />
        </div>
      </Section>

      {/* Templates */}
      <Section id="templates" className="py-16">
        <SectionHeader
          title="Beautiful templates"
          subtitle="Choose from professionally designed templates for every business"
        />
        <TemplateGallery items={templateModules} className="mx-auto max-w-5xl" />
      </Section>

      {/* Pricing */}
      <Section id="pricing" bg="slate-50" className="py-16">
        <SectionHeader
          title="Simple, transparent pricing"
          subtitle="No per-invoice fees. No hidden costs. Cancel anytime."
        />
        <PricingTable
          tiers={pricingTiers}
          billingCycle="monthly"
          showBillingToggle
          subtitle="No per-invoice fees. No hidden costs."
          className="mx-auto max-w-7xl"
        />
      </Section>

      {/* Features */}
      <FeaturesSection
        id="features"
        title="Everything you need to get paid faster"
        subtitle="Built for professionals who want accurate numbers and fast workflows."
        features={pricingFeatures}
      />

      {/* FAQ */}
      <FaqSection id="faq" items={faqs} />

      {/* Final CTA */}
      <Section className="py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            {isAuthenticated ? "Continue to your dashboard" : "Ready to get started?"}
          </h2>
          <p className="text-slate-600 mb-8 max-w-lg mx-auto">
            {isAuthenticated
              ? "Go to your dashboard to manage invoices."
              : "Join over 10,000 businesses using InvoiceFlow to get paid faster."}
          </p>
          <button
            onClick={() => (isAuthenticated ? navigate("/app") : navigate("/register"))}
            className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white hover:bg-primary-700 shadow-lg hover:shadow-xl transition-shadow"
          >
            {isAuthenticated ? "Go to Dashboard" : "Create Your Free Invoice"}
          </button>
        </div>
      </Section>

      <footer className="border-t border-slate-200 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">© 2026 InvoiceFlow. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-sm text-slate-500 hover:text-slate-900">Privacy</Link>
              <Link to="/terms" className="text-sm text-slate-500 hover:text-slate-900">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ step, title, description, icon }: {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex text-center flex-col">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-0.5 rounded-full">
          Step {step}
        </span>
      </div>
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

function InvoicePreviewHero() {
  return (
    <div className="p-6 min-w-[320px]">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="font-bold text-slate-900">INVOICE #INV-2026-0001</h2>
          <p className="text-sm text-slate-500">Due: Sep 30, 2026</p>
        </div>
        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-800">
          Draft
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left font-medium">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2">Web Development Services</td>
            <td className="py-2 text-right">40.00</td>
            <td className="py-2 text-right">$125.00</td>
            <td className="py-2 text-right font-medium">$5,000.00</td>
          </tr>
          <tr>
            <td className="py-2">Stock photo license</td>
            <td className="py-2 text-right">1.00</td>
            <td className="py-2 text-right">$75.00</td>
            <td className="py-2 text-right font-medium">$75.00</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-4 space-y-1 text-right text-sm">
        <p className="text-slate-600">Subtotal <span className="text-slate-900 font-medium">$5,075.00</span></p>
        <p className="text-slate-600">Tax (10%) <span className="text-slate-900 font-medium">$507.50</span></p>
        <p className="text-lg font-bold text-slate-900">Total <span>$5,582.50</span></p>
      </div>
      <div className="mt-4 pt-4 border-t text-center">
        <p className="text-xs text-slate-400">Acme Design Studio · 555-0123 · hello@acme.design</p>
      </div>
    </div>
  );
}
