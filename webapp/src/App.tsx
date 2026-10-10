import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ChunkErrorBoundary from "./components/ErrorBoundary";

const Landing = lazy(() => import("./pages/Landing"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const OnboardingWizard = lazy(() => import("./pages/OnboardingWizard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Products = lazy(() => import("./pages/Products"));
const Templates = lazy(() => import("./pages/Templates"));
const TemplateEditorPage = lazy(() => import("./pages/TemplateEditorPage"));
const Settings = lazy(() => import("./pages/Settings"));
const PublicInvoice = lazy(() => import("./pages/PublicInvoice"));
const Payments = lazy(() => import("./pages/Payments"));
const PaymentDetail = lazy(() => import("./pages/PaymentDetail"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const ReportSection = lazy(() => import("./pages/ReportSection"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Plans = lazy(() => import("./pages/Plans"));

const Invoices = lazy(() => import("./pages/Invoices"));
const Quotes = lazy(() => import("./pages/Quotes"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const InvoiceEditorPage = lazy(() => import("./pages/InvoiceEditorPage"));
const QuickInvoicePage = lazy(() => import("./pages/QuickInvoicePage"));
const QuoteCreationWizard = lazy(() => import("./components/QuoteCreationWizard"));
const PublicQuote = lazy(() => import("./pages/PublicQuote"));
const Projects = lazy(() => import("./pages/Projects"));
const Receipts = lazy(() => import("./pages/Receipts"));
const ReceiptDetail = lazy(() => import("./pages/ReceiptDetail"));
const ReminderAutomation = lazy(() => import("./pages/ReminderAutomation"));
const Reports = lazy(() => import("./pages/Reports"));

const Fallback = () => (
  <div className="flex items-center justify-center h-64 text-secondary">Loading…</div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen text-secondary">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function OnboardedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, onboarding, refreshOnboarding } = useAuth();
  const [attemptedFetch, setAttemptedFetch] = useState(false);
  const [fetchingOnboarding, setFetchingOnboarding] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !attemptedFetch && !onboarding) {
      setAttemptedFetch(true);
      setFetchingOnboarding(true);
      refreshOnboarding()
        .catch(() => {})
        .finally(() => setFetchingOnboarding(false));
    }
  }, [isAuthenticated, onboarding, attemptedFetch, refreshOnboarding]);

  if (isLoading || (isAuthenticated && onboarding === null && (fetchingOnboarding || !attemptedFetch)))
    return <div className="flex items-center justify-center h-screen text-secondary">Loading...</div>;
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
    <ChunkErrorBoundary>
    <Routes>
       <Route path="/" element={<Suspense fallback={<Fallback />}><Landing /></Suspense>} />
       <Route path="/pricing" element={<Suspense fallback={<Fallback />}><Pricing /></Suspense>} />
       <Route path="/login" element={<Suspense fallback={<Fallback />}><PublicOnly><Login /></PublicOnly></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<Fallback />}><PublicOnly><Register /></PublicOnly></Suspense>} />
      <Route path="/auth/callback" element={<Suspense fallback={<Fallback />}><PublicOnly><AuthCallback /></PublicOnly></Suspense>} />
        <Route path="/invoice/:token" element={<Suspense fallback={<Fallback />}><PublicInvoice /></Suspense>} />
        <Route path="/public/invoice/:token" element={<Suspense fallback={<Fallback />}><PublicInvoice /></Suspense>} />
        <Route path="/quote/:token" element={<Suspense fallback={<Fallback />}><PublicQuote /></Suspense>} />
        <Route path="/public/quote/:token" element={<Suspense fallback={<Fallback />}><PublicQuote /></Suspense>} />

      <Route path="/privacy" element={<Suspense fallback={<Fallback />}><Privacy /></Suspense>} />
      <Route path="/terms" element={<Suspense fallback={<Fallback />}><Terms /></Suspense>} />

      <Route path="/onboarding" element={<Suspense fallback={<Fallback />}><ProtectedRoute><OnboardingWizard /></ProtectedRoute></Suspense>} />

       <Route path="/app" element={<Suspense fallback={<Fallback />}><OnboardedRoute><Layout /></OnboardedRoute></Suspense>}>
         <Route index element={<Suspense fallback={<Fallback />}><Dashboard /></Suspense>} />
         <Route path="invoices" element={<Suspense fallback={<Fallback />}><Invoices /></Suspense>} />
          <Route path="invoices/new" element={<Suspense fallback={<Fallback />}><QuickInvoicePage /></Suspense>} />
          <Route path="invoices/:id" element={<Suspense fallback={<Fallback />}><InvoiceDetail /></Suspense>} />
           <Route path="invoices/:id/edit" element={<Suspense fallback={<Fallback />}><InvoiceEditorPage /></Suspense>} />
          <Route path="quotes" element={<Suspense fallback={<Fallback />}><Quotes /></Suspense>} />
          <Route path="quotes/new" element={<Suspense fallback={<Fallback />}><QuoteCreationWizard /></Suspense>} />
          <Route path="quotes/:id/edit" element={<Suspense fallback={<Fallback />}><QuoteCreationWizard /></Suspense>} />

         <Route path="customers" element={<Suspense fallback={<Fallback />}><Customers /></Suspense>} />
         <Route path="customers/:id" element={<Suspense fallback={<Fallback />}><CustomerDetail /></Suspense>} />
         <Route path="products" element={<Suspense fallback={<Fallback />}><Products /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={<Fallback />}><Payments /></Suspense>} />
          <Route path="payments/:id" element={<Suspense fallback={<Fallback />}><PaymentDetail /></Suspense>} />
         <Route path="templates" element={<Suspense fallback={<Fallback />}><Templates /></Suspense>} />
         <Route path="templates/new" element={<Suspense fallback={<Fallback />}><TemplateEditorPage /></Suspense>} />
          <Route path="templates/:id/edit" element={<Suspense fallback={<Fallback />}><TemplateEditorPage /></Suspense>} />
          <Route path="projects" element={<Suspense fallback={<Fallback />}><Projects /></Suspense>} />
          <Route path="projects/:id" element={<Suspense fallback={<Fallback />}><ProjectDetail /></Suspense>} />
          <Route path="receipts" element={<Suspense fallback={<Fallback />}><Receipts /></Suspense>} />
         <Route path="receipts/:id" element={<Suspense fallback={<Fallback />}><ReceiptDetail /></Suspense>} />
         <Route path="reports" element={<Suspense fallback={<Fallback />}><Reports /></Suspense>} />
         <Route path="report" element={<Suspense fallback={<Fallback />}><ReportSection /></Suspense>} />
          <Route path="reminders" element={<Suspense fallback={<Fallback />}><ReminderAutomation /></Suspense>} />
          <Route path="plans" element={<Suspense fallback={<Fallback />}><Plans /></Suspense>} />
         <Route path="settings">
           <Route index element={<Navigate to="/app/settings/business" replace />} />
           <Route path=":section" element={<Suspense fallback={<Fallback />}><Settings /></Suspense>} />
         </Route>
         <Route path="security" element={<Navigate to="/app/settings/security" replace />} />
       </Route>

       <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ChunkErrorBoundary>
  );
}
