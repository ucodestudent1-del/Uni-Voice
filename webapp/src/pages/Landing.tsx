import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

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
            <button
              onClick={() => navigate("/login")}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
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

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
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
      </section>

      {/* Three-Step */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-slate-50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">Get paid in three simple steps</h2>
          <p className="text-slate-600 mt-2">From draft to paid — in under two minutes</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <StepCard
            step={1}
            title="Create"
            description="Add your business details, select a customer, and fill in line items with automatic calculations."
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.25 4.5v5.25l4.5 2.25" />
            }
          />
          <StepCard
            step={2}
            title="Send"
            description="Review and send your professional invoice via email with a single click. Customers receive a secure link."
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3 9v6h12l-3-3M6 12l3 3-3-3z" />
            }
          />
          <StepCard
            step={3}
            title="Get Paid"
            description="Track views and payments in real time. Get automatic reminders so you never chase payments again."
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
            }
          />
        </div>
      </section>

      {/* Template Gallery */}
      <section id="templates" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">Beautiful templates</h2>
          <p className="text-slate-600 mt-2">Choose from professionally designed templates for every business</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <TemplateCard name="Classic" description="Clean and professional for consulting and services" color="slate" />
          <TemplateCard name="Modern" description="Bold contemporary design for creative agencies" color="primary" />
          <TemplateCard name="Minimal" description="Ultra-clean with ample whitespace" color="teal" />
        </div>
      </section>

      {/* Pricing Preview (inline) */}
      <section id="pricing" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-slate-50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">Simple, transparent pricing</h2>
          <p className="text-slate-600 mt-2">No per-invoice fees. No hidden costs.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <PlanCard
            name="Free"
            description="Make professional invoices"
            price={0}
            period="month"
            features={["Up to 5 invoices per month", "5 customers", "Basic templates", "PDF download", "Multiple currencies"]}
            cta="Get Started"
            ctaLink="/register"
          />
          <PlanCard
            name="Pro"
            description="Automate your invoicing"
            price={19}
            period="month"
            features={["Unlimited invoices", "Unlimited customers", "Custom branding", "Premium templates", "Recurring invoices", "Automated reminders", "Payment links", "CSV/Excel export"]}
            cta="Start free trial"
            ctaLink="/register"
            highlighted={true}
            saveText="Save 29% with annual billing"
          />
          <PlanCard
            name="Business"
            description="Manage your billing and financial workflow"
            price={49}
            period="month"
            features={["Everything in Pro", "Quotes & estimates", "Purchase orders", "Receipts", "Credit notes", "Revenue dashboards", "API access", "Multiple businesses"]}
            cta="Contact sales"
            ctaLink="/register"
            beta
          />
        </div>
      </section>

      {/* Benefits */}
      <section id="features" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <BenefitItem
            title="Real-time calculations"
            description="Built on a deterministic calculation engine using integer minor units. No floating-point errors, ever."
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m1 0v6m-3-3l3-3M9 7l3 3m0 0l-3 3m3-3l-3 3" />
            }
          />
          <BenefitItem
            title="Secure public invoice pages"
            description="Share invoices with customers via secure tokenized links. Track views and enable online payments."
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m2 0a2 2 0 11-4 0 2 2 0 014 0zm3 6a3 3 0 11-6 0 3 3 0 016 0z" />
            }
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-slate-50">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">Frequently asked questions</h2>
        </div>
        <div className="max-w-3xl mx-auto space-y-4">
          <FaqItem
            question="Do you charge per invoice?"
            answer="No. There are no per-invoice fees on any plan. You pay a flat monthly or annual subscription."
          />
          <FaqItem
            question="Can I cancel my subscription?"
            answer="Yes, you can cancel anytime. Your data remains accessible through the end of your billing period."
          />
          <FaqItem
            question="Is there a free trial?"
            answer="The Free plan is available forever with no limits on time. Try Pro free for 14 days."
          />
          <FaqItem
            question="Do you offer discounts for annual billing?"
            answer="Yes, save up to 29% on Pro and Business with annual billing."
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            {isAuthenticated ? "Continue to your dashboard" : "Ready to get started?"}
          </h2>
          <p className="text-slate-600 mb-8 max-w-lg mx-auto">
            {isAuthenticated
              ? "Go to your dashboard to manage invoices."
              : "Join over 10,000 businesses using InvoiceFlow to get paid faster."
            }
          </p>
          <button
            onClick={() => isAuthenticated ? navigate("/app") : navigate("/register")}
            className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white hover:bg-primary-700 shadow-lg hover:shadow-xl transition-shadow"
          >
            {isAuthenticated ? "Go to Dashboard" : "Create Your Free Invoice"}
          </button>
        </div>
      </section>

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
  icon: JSX.Element;
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

function TemplateCard({ name, description, color }: { name: string; description: string; color: string }) {
  const colorMap: Record<string, string> = {
    slate: "border-slate-300",
    primary: "border-primary-500",
    teal: "border-teal-500",
  };
  return (
    <div className={`rounded-xl border-2 ${colorMap[color] ?? "border-slate-200"} bg-white p-4 shadow-sm transition-transform hover:scale-105`}>
      <div className="aspect-video bg-slate-50 rounded-lg mb-3 flex items-center justify-center text-slate-400">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m2 0a2 2 0 11-4 0 2 2 0 014 0zm3 6a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <h4 className="font-semibold text-slate-900">{name}</h4>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}

function PlanCard({
  name, description, price, period, features, cta, ctaLink, highlighted, saveText, beta,
}: {
  name: string;
  description: string;
  price: number;
  period: string;
  features: string[];
  cta: string;
  ctaLink: string;
  highlighted?: boolean;
  saveText?: string;
  beta?: boolean;
}) {
  const isHighlighted = highlighted;
  return (
    <div
      className={`rounded-xl border bg-white p-6 shadow-sm ${
        isHighlighted
          ? "border-2 border-primary-500 shadow-xl relative"
          : "border-slate-200"
      }`}
    >
      {isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white">
            Most Popular
          </span>
        </div>
      )}
      {beta && (
        <div className="absolute -top-3 right-4">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            Beta
          </span>
        </div>
      )}
      <h3 className="text-xl font-bold text-slate-900">{name}</h3>
      <p className="text-sm text-slate-600 mt-1">{description}</p>
      <div className="mt-4">
        <span className="text-4xl font-bold text-slate-900">${price}</span>
        <span className="text-slate-500">/{period}</span>
      </div>
      {saveText && <p className="text-xs text-slate-500 mt-1">{saveText}</p>}
      <ul className="mt-5 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start">
            <svg className="h-5 w-5 text-green-400 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-slate-600">{f}</span>
          </li>
        ))}
      </ul>
      <Link
        to={ctaLink}
        className={`mt-6 block text-center rounded-lg px-4 py-2 text-sm font-medium ${
          isHighlighted
            ? "bg-primary-600 text-white hover:bg-primary-700"
            : "text-primary-600 hover:bg-primary-50"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function BenefitItem({ title, description, icon }: { title: string; description: string; icon: JSX.Element }) {
  return (
    <div className="space-y-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-5 bg-white">
      <h4 className="font-semibold text-slate-900">{question}</h4>
      <p className="mt-2 text-sm text-slate-600">{answer}</p>
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
