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
const DocumentConverterPage = lazy(() => import("./pages/DocumentConverterPage"));
const DocumentMaker = lazy(() => import("./pages/DocumentMaker"));
const AccountBilling = lazy(() => import("./pages/AccountBilling"));
const PublicInvoice = lazy(() => import("./pages/PublicInvoice"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const ProprietaryDashboard = lazy(() => import("./pages/ProprietaryDashboard"));
const ProprietaryDocuments = lazy(() => import("./pages/ProprietaryDocuments"));
const ProprietaryDocumentMaker = lazy(() => import("./pages/ProprietaryDocumentMaker"));
const ProprietaryDocumentWorkspace = lazy(() => import("./pages/ProprietaryDocumentWorkspace"));
const ProprietaryBranding = lazy(() => import("./pages/ProprietaryBranding"));
const ProprietaryReports = lazy(() => import("./pages/ProprietaryReports"));
const ProprietaryRecurringInvoices = lazy(() => import("./pages/ProprietaryRecurringInvoices"));
const ProprietaryEmailTemplates = lazy(() => import("./pages/ProprietaryEmailTemplates"));
const ProprietaryCustomerDetail = lazy(() => import("./pages/ProprietaryCustomerDetail"));
const ProprietaryCustomersList = lazy(() => import("./pages/ProprietaryCustomersList"));

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
const DocumentConverterPageWithBoundary = withErrorBoundary(DocumentConverterPage, "Convert Document");
const AccountBillingWithBoundary = withErrorBoundary(AccountBilling, "Account & Billing");
const PublicInvoiceWithBoundary = withErrorBoundary(PublicInvoice, "Invoice");
const PaymentSuccessWithBoundary = withErrorBoundary(PaymentSuccess, "Payment Success");
const PrivacyWithBoundary = withErrorBoundary(Privacy, "Privacy");
const TermsWithBoundary = withErrorBoundary(Terms, "Terms");
const ProprietaryDashboardWithBoundary = withErrorBoundary(ProprietaryDashboard, "Proprietary Dashboard");
const ProprietaryDocumentsWithBoundary = withErrorBoundary(ProprietaryDocuments, "Proprietary Documents");
const ProprietaryDocumentMakerInvoiceWithBoundary = withErrorBoundary(
  (p: { docType?: string }) => <ProprietaryDocumentMaker {...p} docType="invoice" />,
  "Proprietary Invoice Maker",
);
const ProprietaryDocumentMakerQuoteWithBoundary = withErrorBoundary(
  (p: { docType?: string }) => <ProprietaryDocumentMaker {...p} docType="quote" />,
  "Proprietary Quote Maker",
);
const ProprietaryDocumentWorkspaceWithBoundary = withErrorBoundary(ProprietaryDocumentWorkspace, "Proprietary Document Workspace");
const ProprietaryBrandingWithBoundary = withErrorBoundary(ProprietaryBranding, "Proprietary Branding");
const ProprietaryReportsWithBoundary = withErrorBoundary(ProprietaryReports, "Proprietary Reports");
const ProprietaryRecurringInvoicesWithBoundary = withErrorBoundary(ProprietaryRecurringInvoices, "Recurring Invoices");
const ProprietaryEmailTemplatesWithBoundary = withErrorBoundary(ProprietaryEmailTemplates, "Email Templates");
const ProprietaryCustomerDetailWithBoundary = withErrorBoundary(ProprietaryCustomerDetail, "Customer Detail");
const ProprietaryCustomersListWithBoundary = withErrorBoundary(ProprietaryCustomersList, "Customers");
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
const DocumentMakerInvoiceWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="invoice" />,
  "Invoice Maker",
);
const DocumentMakerQuoteWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="quote" />,
  "Quotation Maker",
);
const DocumentMakerCreditNoteWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="credit-note" />,
  "Credit Note Maker",
);
const DocumentMakerDebitNoteWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="debit-note" />,
  "Debit Note Maker",
);
const DocumentMakerPaymentVoucherWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="payment-voucher" />,
  "Payment Voucher Maker",
);
const DocumentMakerReceiptWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="receipt" />,
  "Receipt Maker",
);
const DocumentMakerPurchaseOrderWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="purchase-order" />,
  "Purchase Order Maker",
);
const DocumentWorkspaceRecurringInvoiceWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="recurring-invoice" />,
  "Recurring Invoice Workspace",
);
const DocumentWorkspaceDeliveryNoteWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="delivery-note" />,
  "Delivery Note Workspace",
);
const DocumentWorkspacePackingSlipWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="packing-slip" />,
  "Packing Slip Workspace",
);
const DocumentWorkspaceProFormaInvoiceWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="pro-forma-invoice" />,
  "Pro Forma Invoice Workspace",
);
const DocumentWorkspaceEstimateWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentWorkspace {...p} docType="estimate" />,
  "Estimate Workspace",
);
const DocumentMakerRecurringInvoiceWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="recurring-invoice" />,
  "Recurring Invoice Maker",
);
const DocumentMakerDeliveryNoteWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="delivery-note" />,
  "Delivery Note Maker",
);
const DocumentMakerPackingSlipWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="packing-slip" />,
  "Packing Slip Maker",
);
const DocumentMakerProFormaInvoiceWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="pro-forma-invoice" />,
  "Pro Forma Invoice Maker",
);
const DocumentMakerEstimateWithBoundary = withErrorBoundary(
  (p: { docType: string }) => <DocumentMaker {...p} docType="estimate" />,
  "Estimate Maker",
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

function AuthRequired({ children }: { children: React.ReactNode }) {
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
          <Route path="invoices/new" element={<DocumentMakerInvoiceWithBoundary docType="invoice" />} />
          <Route path="invoices/:id/edit" element={<DocumentWorkspaceInvoiceWithBoundary docType="invoice" />} />
          <Route path="credit-notes/new" element={<DocumentMakerCreditNoteWithBoundary docType="credit-note" />} />
          <Route path="credit-notes/:id/edit" element={<DocumentWorkspaceCreditNoteWithBoundary docType="credit-note" />} />
          <Route path="quotes/new" element={<DocumentMakerQuoteWithBoundary docType="quote" />} />
          <Route path="quotes/:id/edit" element={<DocumentWorkspaceQuoteWithBoundary docType="quote" />} />
          <Route path="debit-notes/new" element={<DocumentMakerDebitNoteWithBoundary docType="debit-note" />} />
          <Route path="debit-notes/:id/edit" element={<DocumentWorkspaceDebitNoteWithBoundary docType="debit-note" />} />
          <Route path="payment-vouchers/new" element={<DocumentMakerPaymentVoucherWithBoundary docType="payment-voucher" />} />
          <Route path="payment-vouchers/:id/edit" element={<DocumentWorkspacePaymentVoucherWithBoundary docType="payment-voucher" />} />
          <Route path="receipts/new" element={<DocumentMakerReceiptWithBoundary docType="receipt" />} />
          <Route path="receipts/:id/edit" element={<DocumentWorkspaceReceiptWithBoundary docType="receipt" />} />
          <Route path="purchase-orders/new" element={<DocumentMakerPurchaseOrderWithBoundary docType="purchase-order" />} />
          <Route path="purchase-orders/:id/edit" element={<DocumentWorkspacePurchaseOrderWithBoundary docType="purchase-order" />} />
          <Route path="recurring-invoices/new" element={<DocumentMakerRecurringInvoiceWithBoundary docType="recurring-invoice" />} />
          <Route path="recurring-invoices/:id/edit" element={<DocumentWorkspaceRecurringInvoiceWithBoundary docType="recurring-invoice" />} />
          <Route path="delivery-notes/new" element={<DocumentMakerDeliveryNoteWithBoundary docType="delivery-note" />} />
          <Route path="delivery-notes/:id/edit" element={<DocumentWorkspaceDeliveryNoteWithBoundary docType="delivery-note" />} />
          <Route path="packing-slips/new" element={<DocumentMakerPackingSlipWithBoundary docType="packing-slip" />} />
          <Route path="packing-slips/:id/edit" element={<DocumentWorkspacePackingSlipWithBoundary docType="packing-slip" />} />
          <Route path="pro-forma-invoices/new" element={<DocumentMakerProFormaInvoiceWithBoundary docType="pro-forma-invoice" />} />
          <Route path="pro-forma-invoices/:id/edit" element={<DocumentWorkspaceProFormaInvoiceWithBoundary docType="pro-forma-invoice" />} />
          <Route path="estimates/new" element={<DocumentMakerEstimateWithBoundary docType="estimate" />} />
          <Route path="estimates/:id/edit" element={<DocumentWorkspaceEstimateWithBoundary docType="estimate" />} />
          <Route path="templates" element={<TemplatesWithBoundary />} />
          <Route path="templates/new" element={<TemplateEditorPageWithBoundary />} />
          <Route path="templates/:id/edit" element={<TemplateEditorPageWithBoundary />} />
          <Route path="converter/:docType/:docId" element={<DocumentConverterPageWithBoundary />} />
        </Route>

        <Route path="/app/proprietary" element={<AuthRequired><Layout /></AuthRequired>} >
          <Route index element={<ProprietaryDashboardWithBoundary />} />
          <Route path="documents" element={<ProprietaryDocumentsWithBoundary />} />
          <Route path="invoices/new" element={<ProprietaryDocumentMakerInvoiceWithBoundary docType="invoice" />} />
          <Route path="invoices/:id/edit" element={<ProprietaryDocumentMakerInvoiceWithBoundary docType="invoice" />} />
          <Route path="invoices/:id" element={<ProprietaryDocumentWorkspaceWithBoundary />} />
          <Route path="quotes/new" element={<ProprietaryDocumentMakerQuoteWithBoundary docType="quote" />} />
          <Route path="quotes/:id/edit" element={<ProprietaryDocumentMakerQuoteWithBoundary docType="quote" />} />
          <Route path="quotes/:id" element={<ProprietaryDocumentWorkspaceWithBoundary />} />
          <Route path="branding" element={<ProprietaryBrandingWithBoundary />} />
          <Route path="reports" element={<ProprietaryReportsWithBoundary />} />
          <Route path="recurring-invoices" element={<ProprietaryRecurringInvoicesWithBoundary />} />
          <Route path="recurring-invoices/new" element={<ProprietaryRecurringInvoicesWithBoundary />} />
          <Route path="recurring-invoices/:id/edit" element={<ProprietaryRecurringInvoicesWithBoundary />} />
          <Route path="email-templates" element={<ProprietaryEmailTemplatesWithBoundary />} />
          <Route path="customers" element={<ProprietaryCustomersListWithBoundary />} />
          <Route path="customers/:id" element={<ProprietaryCustomerDetailWithBoundary />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ChunkErrorBoundary>
  );
}
