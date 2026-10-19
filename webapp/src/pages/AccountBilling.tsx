import BillingSubscriptionSettings from "@/components/settings/BillingSubscriptionSettings";
import { useMetaTags } from "@/hooks/useMetaTags";
import { PageHeader } from "@/components/ui";

export default function AccountBilling() {
  useMetaTags({
    title: "Account & Billing — DocForge",
    description: "View your current plan, usage, payment method, billing history, and manage your subscription.",
    noIndex: true,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account & Billing"
        breadcrumbs={[
          { label: "Home", to: "/app" },
          { label: "Account & Billing" },
        ]}
      />

      <BillingSubscriptionSettings />
    </div>
  );
}
