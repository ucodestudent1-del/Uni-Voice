import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import OnboardingWizard from "./pages/OnboardingWizard";
import InvoiceDetail from "./pages/InvoiceDetail";
import InvoiceEditorPage from "./pages/InvoiceEditorPage";
import QuickInvoicePage from "./pages/QuickInvoicePage";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Products from "./pages/Products";
import Templates from "./pages/Templates";
import TemplateEditorPage from "./pages/TemplateEditorPage";
import Settings from "./pages/Settings";
import PublicInvoice from "./pages/PublicInvoice";
import Payments from "./pages/Payments";
import ProjectDetail from "./pages/ProjectDetail";
import QuoteDetail from "./pages/QuoteDetail";
import ReportSection from "./pages/ReportSection";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

// Lazy-loaded pages — these are only fetched when the user navigates to them.
// This keeps the initial JS bundle small and avoids loading code for sections
// the user never visits.
const Invoices = lazy(() => import("./pages/Invoices"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Projects = lazy(() => import("./pages/Projects"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Receipts = lazy(() => import("./pages/Receipts"));
const Reports = lazy(() => import("./pages/Reports"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen text-secondary">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function OnboardedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, onboarding } = useAuth();
  if (isLoading || (isAuthenticated && onboarding === null)) return <div className="flex items-center justify-center h-screen text-secondary">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (onboarding && !onboarding.isComplete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen text-secondary">Loading...</div>;
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public marketing routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/auth/callback" element={<PublicOnly><AuthCallback /></PublicOnly>} />
      <Route path="/invoice/:token" element={<PublicInvoice />} />

      {/* Legal pages (public) */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* Onboarding */}
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />

      {/* Protected application routes */}
      <Route path="/app" element={<OnboardedRoute><Layout /></OnboardedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="invoices" element={<Suspense fallback={<div className="flex items-center justify-center h-64 text-secondary">Loading…</div>}><Invoices /></Suspense>} />
        <Route path="invoices/new" element={<QuickInvoicePage />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="invoices/:id/edit" element={<InvoiceEditorPage />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="payments" element={<Payments />} />
          <Route path="templates" element={<Templates />} />
          <Route path="templates/new" element={<TemplateEditorPage />} />
          <Route path="templates/:id/edit" element={<TemplateEditorPage />} />
          <Route path="expenses" element={<Suspense fallback={<div className="flex items-center justify-center h-64 text-secondary">Loading…</div>}><Expenses /></Suspense>} />
          <Route path="projects" element={<Suspense fallback={<div className="flex items-center justify-center h-64 text-secondary">Loading…</div>}><Projects /></Suspense>} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="quotes" element={<Suspense fallback={<div className="flex items-center justify-center h-64 text-secondary">Loading…</div>}><Quotes /></Suspense>} />
          <Route path="quotes/new" element={<QuoteDetail />} />
          <Route path="quotes/:id" element={<QuoteDetail />} />
          <Route path="reports" element={<Suspense fallback={<div className="flex items-center justify-center h-64 text-secondary">Loading…</div>}><Reports /></Suspense>} />
          <Route path="report" element={<ReportSection />} />
          <Route path="receipts" element={<Suspense fallback={<div className="flex items-center justify-center h-64 text-secondary">Loading…</div>}><Receipts /></Suspense>} />
          <Route path="settings">
            <Route index element={<Navigate to="/app/settings/business" replace />} />
            <Route path=":section" element={<Settings />} />
          </Route>
          <Route path="security" element={<Navigate to="/app/settings/security" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}