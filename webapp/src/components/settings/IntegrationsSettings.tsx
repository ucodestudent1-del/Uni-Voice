import { useState } from "react";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "accounting" | "payment" | "crm" | "automation" | "other";
  connected: boolean;
  icon: string;
}

const integrations: Integration[] = [
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    description: "Sync invoices and customers to QuickBooks.",
    category: "accounting",
    connected: false,
    icon: "📊",
  },
  {
    id: "xero",
    name: "Xero",
    description: "Export invoices directly to Xero accounting.",
    category: "accounting",
    connected: false,
    icon: "📊",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Process online payments and manage payouts.",
    category: "payment",
    connected: false,
    icon: "💳",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Accept payments via PayPal.",
    category: "payment",
    connected: false,
    icon: "💳",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Sync customer records with HubSpot CRM.",
    category: "crm",
    connected: false,
    icon: "🤝",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Push customers and invoices to Salesforce.",
    category: "crm",
    connected: false,
    icon: "🤝",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect to 5,000+ apps via Zapier automations.",
    category: "automation",
    connected: false,
    icon: "⚡",
  },
  {
    id: "make",
    name: "Make (Integromat)",
    description: "Build automated workflows with Make.",
    category: "automation",
    connected: false,
    icon: "⚡",
  },
];

export default function IntegrationsSettings() {
  const [items, setItems] = useState(integrations);
  const [connecting, setConnecting] = useState<string | null>(null);

  const categories = ["accounting", "payment", "crm", "automation", "other"];
  const categoryLabels: Record<string, string> = {
    accounting: "Accounting",
    payment: "Payment",
    crm: "CRM",
    automation: "Automation",
    other: "Other",
  };

  async function connect(id: string) {
    setConnecting(id);
    try {
      const item = items.find((i) => i.id === id);
      if (item?.connected) {
        await new Promise<void>((resolve) => {
          const confirmed = window.confirm(`Disconnect ${item.name}?`);
          if (confirmed) {
            resolve();
          } else {
            resolve();
          }
        });
        if (window.confirm(`Disconnect ${item.name}?`)) {
          setItems(items.map((i) => (i.id === id ? { ...i, connected: false } : i)));
        }
      } else {
        setItems(items.map((i) => (i.id === id ? { ...i, connected: true } : i)));
      }
    } catch {
      // ignore
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Integrations</h2>
        <p className="text-sm text-secondary mt-1">
          Connect your business to accounting, payment, CRM, and automation services.
        </p>
      </div>

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat);
        if (catItems.length === 0) return null;
        return (
          <div key={cat} className="rounded-xl border border-color-subtle bg-surface p-6">
            <h3 className="text-md font-semibold text-primary mb-4">{categoryLabels[cat]}</h3>
            <div className="space-y-4">
              {catItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between py-3 border-b border-color-subtle last:border-0">
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h4 className="font-medium text-primary">{item.name}</h4>
                      <p className="text-sm text-secondary">{item.description}</p>
                    </div>
                  </div>
                  {item.connected ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium status-success-bg status-success-text">
                      Connected
                    </span>
                  ) : (
                    <button
                      onClick={() => connect(item.id)}
                      disabled={connecting === item.id}
                      className="rounded-lg border border-input-border px-3 py-1.5 text-sm font-medium text-secondary hover:bg-surface-alt disabled:opacity-50"
                    >
                      {connecting === item.id ? "Connecting…" : "Connect"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}




