import { ReactNode } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

export default function LegalPage({ title, children }: LegalPageProps) {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-surface-alt text-inverse flex flex-col">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between h-16 py-4">
          <Link to="/" className="text-xl font-bold text-inverse">InvoiceFlow</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/privacy" className="text-sm text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary">Privacy</Link>
            <Link to="/terms" className="text-sm text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary">Terms</Link>
            <Link to="/login" className="text-sm text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary">Login</Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/register"
                className="inline-flex items-center rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
              >
                Create Free Invoice
              </Link>
            </div>
          </div>
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Link
              to="/register"
              className="inline-flex items-center rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 max-w-3xl">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-inverse md:text-4xl mb-8">{title}</h1>
          {children}
        </article>
      </main>

      <footer className="border-t border-color-subtle border-color py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-secondary text-tertiary">© {year} InvoiceFlow. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-sm text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary">Privacy</Link>
              <Link to="/terms" className="text-sm text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary">Terms</Link>
              <a href="mailto:support@invoiceflow.com" className="text-sm text-secondary text-tertiary hover:text-primary dark:hover:text-tertiary">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
