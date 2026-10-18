import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ChunkErrorBoundary, { PageErrorBoundary } from "./components/ErrorBoundary";

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
const Payments = lazy(() => import("./pages/Payments"));
const PaymentDetail = lazy(() => import("./pages/PaymentDetail"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const ReportSection = lazy(() => import("./pages/ReportSection"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Plans = lazy(() => import("./pages/Plans"));
const Projects = lazy(() => import("./pages/Projects"));
const Receipts = lazy(() => import("./pages/Receipts"));
const ReceiptDetail = lazy(() => import("./pages/ReceiptDetail"));
const ReminderAutomation = lazy(() => import("./pages/ReminderAutomation"));
const Reports = lazy(() => import("./pages/Reports"));
const DocumentWorkspace = lazy(() => import("./pages/DocumentWorkspace"));
const Documents = lazy(() => import("./pages/Documents"));
const PublicInvoice = lazy(() => import("./pages/PublicInvoice"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));

const Fallback = () => (
  <div className="flex items-center justify-center h-64 text-secondary">
    Loading…
  </div>
);

function withErrorBoundary<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  name: string,
): React.ComponentType<React.PropsWithChildren<P>> {
  const wrapped: React.FC<P> = (props: P) => (
    <PageErrorBoundary pageName={name} key={name}>
      <Suspense fallback={<Fallback />}>
        <Component {...props} />
      </Suspense>
    </PageErrorBoundary>
  );
  wrapped.displayName = `WithErrorBoundary(${name})`;
  return wrapped;
}

const LandingWithBoundary = withErrorBoundary(Landing, "Landing");
const PricingWithBoundary = withErrorBoundary(Pricing, "Pricing");
const LoginWithBoundary = withErrorBoundary(Login, "Login");
const RegisterWithBoundary = withErrorBoundary(Register, "Register");
const AuthCallbackWithBoundary = withErrorBoundary(AuthCallback, "Auth Callback");
const DashboardWithBoundary = withErrorBoundary(Dashboard, "Dashboard");
const OnboardingWizardWithBoundary = withErrorBoundary(OnboardingWizard, "Onboarding");
const CustomersWithBoundary = withErrorBoundary(Customers, "Customers");
const CustomerDetailWithBoundary = withErrorBoundary(CustomerDetail, "Customer Detail");
const ProductsWithBoundary = withErrorBoundary(Products, "Products");
const TemplatesWithBoundary = withErrorBoundary(Templates, "Templates");
const TemplateEditorPageWithBoundary = withErrorBoundary(TemplateEditorPage, "Template Editor");
const SettingsWithBoundary = withErrorBoundary(Settings, "Settings");
const PaymentsWithBoundary = withErrorBoundary(Payments, "Payments");
const PaymentDetailWithBoundary = withErrorBoundary(PaymentDetail, "Payment Detail");
const ProjectDetailWithBoundary = withErrorBoundary(ProjectDetail, "Project Detail");
const ReportSectionWithBoundary = withErrorBoundary(ReportSection, "Report Section");
const PrivacyWithBoundary = withErrorBoundary(Privacy, "Privacy");
const TermsWithBoundary = withErrorBoundary(Terms, "Terms");
const PlansWithBoundary = withErrorBoundary(Plans, "Plans");
const ProjectsWithBoundary = withErrorBoundary(Projects, "Projects");
const ReceiptsWithBoundary = withErrorBoundary(Receipts, "Receipts");
const ReceiptDetailWithBoundary = withErrorBoundary(ReceiptDetail, "Receipt Detail");
const ReminderAutomationWithBoundary = withErrorBoundary(ReminderAutomation, "Reminder Automation");
const ReportsWithBoundary = withErrorBoundary(Reports, "Reports");
const DocumentsWithBoundary = withErrorBoundary(Documents, "Documents");
const PublicInvoiceWithBoundary = withErrorBoundary(PublicInvoice, "Invoice");
const PaymentSuccessWithBoundary = withErrorBoundary(PaymentSuccess, "Payment Success");
const DocumentWorkspaceInvoiceWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="invoice" />,
  "Invoice Workspace",
);
const DocumentWorkspaceCreditNoteWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="credit-note" />,
  "Credit Note Workspace",
);
const DocumentWorkspaceQuoteWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="quote" />,
  "Quote Workspace",
);
const DocumentWorkspaceDebitNoteWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="debit-note" />,
  "Debit Note Workspace",
);
const DocumentWorkspacePaymentVoucherWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="payment-voucher" />,
  "Payment Voucher Workspace",
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen text-secondary">
        Loading…
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function OnboardedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, onboarding, refreshOnboarding } =
    useAuth();
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

  if (
    isLoading ||
    (isAuthenticated &&
      onboarding === null &&
      (fetchingOnboarding || !attemptedFetch))
  )
    return (
      <div className="flex items-center justify-center h-screen text-secondary">
        Loading…
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (onboarding && !onboarding.isComplete)
    return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen text-secondary">
        Loading…
      </div>
    );
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ChunkErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingWithBoundary />} />
        <Route path="/pricing" element={<PricingWithBoundary />} />
        <Route path="/login" element={<PublicOnly><LoginWithBoundary /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterWithBoundary /></PublicOnly>} />
        <Route path="/auth/callback" element={<PublicOnly><AuthCallbackWithBoundary /></PublicOnly>} />

        <Route path="/privacy" element={<PrivacyWithBoundary />} />
        <Route path="/terms" element={<TermsWithBoundary />} />

        <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizardWithBoundary /></ProtectedRoute>} />

        <Route path="/invoice/:token" element={<PublicInvoiceWithBoundary />} />
        <Route path="/invoice/paid" element={<PublicOnly><PaymentSuccessWithBoundary /></PublicOnly>} />

          <Route
            path="/app"
            element={
              <OnboardedRoute>
                <Layout />
              </OnboardedRoute>
            }
          >
          <Route index element={<DashboardWithBoundary />} />
          <Route path="customers" element={<CustomersWithBoundary />} />
          <Route path="customers/:id" element={<CustomerDetailWithBoundary />} />
          <Route path="products" element={<ProductsWithBoundary />} />
          <Route path="payments" element={<PaymentsWithBoundary />} />
          <Route path="payments/:id" element={<PaymentDetailWithBoundary />} />
          <Route path="templates" element={<TemplatesWithBoundary />} />
          <Route path="templates/new" element={<TemplateEditorPageWithBoundary />} />
          <Route path="templates/:id/edit" element={<TemplateEditorPageWithBoundary />} />
          <Route path="projects" element={<ProjectsWithBoundary />} />
          <Route path="projects/:id" element={<ProjectDetailWithBoundary />} />
          <Route path="receipts" element={<ReceiptsWithBoundary />} />
          <Route path="receipts/:id" element={<ReceiptDetailWithBoundary />} />
           <Route path="documents" element={<DocumentsWithBoundary />} />
           <Route path="invoices/new" element={<DocumentWorkspaceInvoiceWithBoundary docType="invoice" />} />
           <Route path="invoices/:id/edit" element={<DocumentWorkspaceInvoiceWithBoundary docType="invoice" />} />
           <Route path="credit-notes/new" element={<DocumentWorkspaceCreditNoteWithBoundary docType="credit-note" />} />
           <Route path="credit-notes/:id/edit" element={<DocumentWorkspaceCreditNoteWithBoundary docType="credit-note" />} />
           <Route path="quotes/new" element={<DocumentWorkspaceQuoteWithBoundary docType="quote" />} />
           <Route path="quotes/:id/edit" element={<DocumentWorkspaceQuoteWithBoundary docType="quote" />} />
           <Route path="debit-notes/new" element={<DocumentWorkspaceDebitNoteWithBoundary docType="debit-note" />} />
           <Route path="debit-notes/:id/edit" element={<DocumentWorkspaceDebitNoteWithBoundary docType="debit-note" />} />
           <Route path="payment-vouchers/new" element={<DocumentWorkspacePaymentVoucherWithBoundary docType="payment-voucher" />} />
           <Route path="payment-vouchers/:id/edit" element={<DocumentWorkspacePaymentVoucherWithBoundary docType="payment-voucher" />} />
          <Route path="reports" element={<ReportsWithBoundary />} />
          <Route path="report" element={<ReportSectionWithBoundary />} />
          <Route path="reminders" element={<ReminderAutomationWithBoundary />} />
          <Route path="plans" element={<PlansWithBoundary />} />
          <Route path="settings">
            <Route index element={<Navigate to="/app/settings/business" replace />} />
            <Route path=":section" element={<SettingsWithBoundary />} />
          </Route>
          <Route path="security" element={<Navigate to="/app/settings/security" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ChunkErrorBoundary>
  );
}
