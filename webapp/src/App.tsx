import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import InvoiceEditorPage from "./pages/InvoiceEditorPage";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import Templates from "./pages/Templates";
import Plans from "./pages/Plans";
import Settings from "./pages/Settings";
import PublicInvoice from "./pages/PublicInvoice";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen text-slate-600">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen text-slate-600">Loading...</div>;
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
      <Route path="/pricing" element={<Plans />} />
      <Route path="/invoice/:token" element={<PublicInvoice />} />

      {/* Protected application routes */}
      <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<InvoiceEditorPage />} />
        <Route path="invoices/:id/edit" element={<InvoiceEditorPage />} />
        <Route path="invoices/:id" element={<InvoiceEditorPage />} />
        <Route path="customers" element={<Customers />} />
        <Route path="products" element={<Products />} />
         <Route path="templates" element={<Templates />} />
         <Route path="expenses" element={<Expenses />} />
         <Route path="reports" element={<Reports />} />
         <Route path="plans" element={<Plans />} />
         <Route path="settings" element={<Settings />} />
         <Route path="security" element={<Settings defaultTab="security" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
