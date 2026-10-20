import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ChunkErrorBoundary, { PageErrorBoundary } from "./components/ErrorBoundary";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const OnboardingWizard = lazy(() => import("./pages/OnboardingWizard"));
const Templates = lazy(() => import("./pages/Templates"));
const TemplateEditorPage = lazy(() => import("./pages/TemplateEditorPage"));
const DocumentWorkspace = lazy(() => import("./pages/DocumentWorkspace"));
const Documents = lazy(() => import("./pages/Documents"));
const CreateDocument = lazy(() => import("./pages/CreateDocumentFlow"));
const AccountBilling = lazy(() => import("./pages/AccountBilling"));
const PublicInvoice = lazy(() => import("./pages/PublicInvoice"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

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
const LoginWithBoundary = withErrorBoundary(Login, "Login");
const RegisterWithBoundary = withErrorBoundary(Register, "Register");
const AuthCallbackWithBoundary = withErrorBoundary(AuthCallback, "Auth Callback");
const DashboardWithBoundary = withErrorBoundary(Dashboard, "Dashboard");
const OnboardingWizardWithBoundary = withErrorBoundary(OnboardingWizard, "Onboarding");
const TemplatesWithBoundary = withErrorBoundary(Templates, "Templates");
const TemplateEditorPageWithBoundary = withErrorBoundary(TemplateEditorPage, "Template Editor");
const DocumentsWithBoundary = withErrorBoundary(Documents, "Documents");
const CreateDocumentWithBoundary = withErrorBoundary(CreateDocument, "Create Document");
const AccountBillingWithBoundary = withErrorBoundary(AccountBilling, "Account & Billing");
const PublicInvoiceWithBoundary = withErrorBoundary(PublicInvoice, "Invoice");
const PaymentSuccessWithBoundary = withErrorBoundary(PaymentSuccess, "Payment Success");
const PrivacyWithBoundary = withErrorBoundary(Privacy, "Privacy");
const TermsWithBoundary = withErrorBoundary(Terms, "Terms");
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
const DocumentWorkspaceReceiptWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="receipt" />,
  "Receipt Workspace",
);
const DocumentWorkspacePurchaseOrderWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="purchase-order" />,
  "Purchase Order Workspace",
);

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
        <Route path="/login" element={<PublicOnly><LoginWithBoundary /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterWithBoundary /></PublicOnly>} />
        <Route path="/auth/callback" element={<PublicOnly><AuthCallbackWithBoundary /></PublicOnly>} />
        <Route path="/privacy" element={<PrivacyWithBoundary />} />
        <Route path="/terms" element={<TermsWithBoundary />} />

        <Route path="/onboarding" element={<OnboardedRoute><OnboardingWizardWithBoundary /></OnboardedRoute>} />

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
          <Route path="create" element={<CreateDocumentWithBoundary />} />
          <Route path="account" element={<AccountBillingWithBoundary />} />
          <Route path="documents" element={<DocumentsWithBoundary />} />
          <Route path="documents/new" element={<Navigate to="/app/create" replace />} />
          <Route path="invoices/new" element={<Navigate to="/app/create?type=invoice" replace />} />
          <Route path="invoices/:id/edit" element={<DocumentWorkspaceInvoiceWithBoundary docType="invoice" />} />
          <Route path="credit-notes/new" element={<Navigate to="/app/create?type=credit-note" replace />} />
          <Route path="credit-notes/:id/edit" element={<DocumentWorkspaceCreditNoteWithBoundary docType="credit-note" />} />
          <Route path="quotes/new" element={<Navigate to="/app/create?type=quote" replace />} />
          <Route path="quotes/:id/edit" element={<DocumentWorkspaceQuoteWithBoundary docType="quote" />} />
          <Route path="debit-notes/new" element={<Navigate to="/app/create?type=debit-note" replace />} />
          <Route path="debit-notes/:id/edit" element={<DocumentWorkspaceDebitNoteWithBoundary docType="debit-note" />} />
          <Route path="payment-vouchers/new" element={<Navigate to="/app/create?type=payment-voucher" replace />} />
          <Route path="payment-vouchers/:id/edit" element={<DocumentWorkspacePaymentVoucherWithBoundary docType="payment-voucher" />} />
          <Route path="receipts/new" element={<Navigate to="/app/create?type=receipt" replace />} />
          <Route path="receipts/:id/edit" element={<DocumentWorkspaceReceiptWithBoundary docType="receipt" />} />
          <Route path="purchase-orders/new" element={<Navigate to="/app/create?type=purchase-order" replace />} />
          <Route path="purchase-orders/:id/edit" element={<DocumentWorkspacePurchaseOrderWithBoundary docType="purchase-order" />} />
          <Route path="templates" element={<TemplatesWithBoundary />} />
          <Route path="templates/new" element={<TemplateEditorPageWithBoundary />} />
          <Route path="templates/:id/edit" element={<TemplateEditorPageWithBoundary />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ChunkErrorBoundary>
  );
}
