import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import SettingsSidebar from "../components/settings/SettingsSidebar";
import GeneralSettings from "../components/settings/GeneralSettings";
import BusinessProfileSettings from "../components/settings/BusinessProfileSettings";
import InvoicingSettings from "../components/settings/InvoicingSettings";
import PaymentsSettings from "../components/settings/PaymentsSettings";
import TaxesSettings from "../components/settings/TaxesSettings";
import NotificationsSettings from "../components/settings/NotificationsSettings";
import TemplatesSettings from "../components/settings/TemplatesSettings";
import TeamPermissionsSettings from "../components/settings/TeamPermissionsSettings";
import IntegrationsSettings from "../components/settings/IntegrationsSettings";
import SecuritySettings from "../components/settings/SecuritySettings";
import BillingSubscriptionSettings from "../components/settings/BillingSubscriptionSettings";
import ThemeSettings from "../components/settings/ThemeSettings";
import FeatureGate from "../components/FeatureGate";
import type { SettingsNavItem, SettingsSection } from "../types/settings";

export type SettingsTab =
  | "general"
  | "business"
  | "invoicing"
  | "payments"
  | "taxes"
  | "notifications"
  | "templates"
  | "team"
  | "integrations"
  | "security"
  | "billing"
  | "account"
  | "theme";

function IconGeneral(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" strokeWidth="2" />
      <path strokeWidth="2" d="M12 1v6m0 10v6m9-9h-6m-6 0H3" />
    </svg>
  );
}
function IconBusiness(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14" />
      <path strokeWidth="2" d="M9 7h6M9 11h6" />
      <circle cx="12" cy="17" r="2" />
    </svg>
  );
}
function IconInvoicing(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M9 12h6M9 16h6M9 8h6" />
      <path strokeWidth="2" d="M5 6h14M5 18h14a2 2 0 002-2V8a2 2 0 00-2-2H7a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
function IconPayments(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M3 10h18M5 14h14M9 18h6" />
      <path strokeWidth="2" d="M7 6h10a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2z" />
    </svg>
  );
}
function IconTaxes(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M12 8c-2.21 0-4-.18-4-.82A4 4 0 004 11.24V16a4 4 0 004 4h8a4 4 0 004-4v-4.76a4.25 4.25 0 00-3.38-4.16C16.61 7.18 13.21 8 12 8z" />
      <path strokeWidth="2" d="M12 12v4" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}
function IconNotifications(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M18 8A6 6 0 006 8c0 1.66-.67 3.15-1.76 4.24L3 15v3h18v-3l-1.24-2.76C18.67 11.15 18 9.57 18 8z" />
      <path strokeWidth="2" d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
function IconTemplates(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function IconTeam(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 01-4-4 4 4 0 014-4h2" />
      <path strokeWidth="2" d="M9 11a4 4 0 100-8 4 4 0 010 8z" />
      <path strokeWidth="2" d="M21 15l-2-2" />
      <path strokeWidth="2" d="M17 19l-2-2" />
    </svg>
  );
}
function IconIntegrations(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M12 5v14m9-7H3" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
    </svg>
  );
}
function IconSecurity(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path strokeWidth="2" d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IconBilling(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M3 8a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path strokeWidth="2" d="M8 6V4a4 4 0 018 0v2" />
      <circle cx="12" cy="14" r="2" />
    </svg>
  );
}
function IconAccount(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M20 21V8a4 4 0 00-3-3.86" />
      <path strokeWidth="2" d="M4 14l9-9 9 9" />
      <circle cx="12" cy="17" r="4" />
    </svg>
  );
}
function IconTheme(): React.ReactNode {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" d="M12 3v1m0 16v1M5.6 5.6l.7.7m11.4 11.4.7.7M3 12h1m16 0h1M5.6 18.4l.7-.7m11.4-11.4.7-.7" />
      <path strokeWidth="2" d="M12 7a5 5 0 110 10 5 5 0 010-10z" />
    </svg>
  );
}

const mainNavItems: SettingsNavItem[] = [
  { id: "general", label: "General", icon: <IconGeneral />, description: "App preferences and defaults" },
  { id: "business", label: "Business Profile", icon: <IconBusiness />, description: "Name, logo, address, tax details" },
  { id: "invoicing", label: "Invoicing", icon: <IconInvoicing />, description: "Numbering, terms, due dates, defaults" },
  { id: "payments", label: "Payments", icon: <IconPayments />, description: "Providers, methods, instructions" },
  { id: "taxes", label: "Taxes", icon: <IconTaxes />, description: "Tax rates and default behavior" },
  { id: "notifications", label: "Notifications", icon: <IconNotifications />, description: "Email alerts and reminders" },
  { id: "templates", label: "Templates", icon: <IconTemplates />, description: "Invoice design and layouts" },
  { id: "team", label: "Team & Permissions", icon: <IconTeam />, description: "Team members and access" },
  { id: "integrations", label: "Integrations", icon: <IconIntegrations />, description: "Accounting, CRM, automation" },
  { id: "security", label: "Security", icon: <IconSecurity />, description: "Password, 2FA, sessions" },
  { id: "billing", label: "Billing & Subscription", icon: <IconBilling />, description: "Plan, usage, invoices" },
  { id: "theme", label: "Appearance", icon: <IconTheme />, description: "Dark mode, preferences" },
];

const accountNavItems: SettingsNavItem[] = [
  { id: "account", label: "Account", icon: <IconAccount />, description: "Profile details" },
];

const mainSections: SettingsSection[] = [{ id: "main", items: mainNavItems }];
const accountSection: SettingsSection = { id: "account", items: accountNavItems };

export default function Settings() {
  const { section } = useParams();
  const navigate = useNavigate();
  const activeSection = (section ?? "business") as SettingsTab;

  useEffect(() => {
    if (!section) {
      navigate("/app/settings/business", { replace: true });
    }
  }, [section, navigate]);

  function renderContent(): React.ReactNode {
    switch (activeSection) {
      case "general":
        return <GeneralSettings />;
      case "business":
        return <BusinessProfileSettings />;
      case "invoicing":
        return <InvoicingSettings />;
      case "payments":
        return <PaymentsSettings />;
      case "taxes":
        return (
          <FeatureGate feature="tax.multiple_rates">
            <TaxesSettings />
          </FeatureGate>
        );
      case "notifications":
        return <NotificationsSettings />;
      case "templates":
        return <TemplatesSettings />;
      case "team":
        return (
          <FeatureGate feature="business.multiple">
            <TeamPermissionsSettings />
          </FeatureGate>
        );
      case "integrations":
        return (
          <FeatureGate feature="api.access">
            <IntegrationsSettings />
          </FeatureGate>
        );
      case "security":
        return <SecuritySettings />;
      case "billing":
        return <BillingSubscriptionSettings />;
      case "account":
        return <GeneralSettings />;
      case "theme":
        return <ThemeSettings />;
      default:
        return (
          <div className="text-sm text-tertiary">
            Select a section from the sidebar to get started.
          </div>
        );
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 bg-page">
      <aside className="w-64 flex-shrink-0 border-r border-color bg-surface overflow-y-auto">
        <div className="px-6 py-4 border-b border-color">
          <h1 className="text-xl font-bold text-primary">Settings</h1>
        </div>
        <SettingsSidebar sections={mainSections} accountSection={accountSection} />
      </aside>
      <main className="flex-1 overflow-y-auto p-8 min-w-0">
        <div className="max-w-4xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
