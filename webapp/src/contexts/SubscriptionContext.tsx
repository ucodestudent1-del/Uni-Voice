import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSubscription, getPlans, upgradeSubscription, downgradeSubscription, getFeatures } from "../api/client";
import { useAuth } from "./AuthContext";

interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  features?: any[];
}

interface SubscriptionContextType {
  plan: Plan | null;
  subscription: any;
  features: any[];
  loading: boolean;
  refresh: () => Promise<void>;
  upgrade: (planCode: string, billingCycle?: string) => Promise<void>;
  downgrade: (planCode: string) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { isAuthenticated, isLoading: authLoading } = useAuth();

  async function refresh() {
    try {
      const [subData, plansData, featuresData] = await Promise.all([
        getSubscription().catch(() => null),
        getPlans().catch(() => ({ plans: [] })),
        getFeatures().catch(() => ({ features: [], premium: [] })),
      ]);
      setSubscription(subData?.subscription ?? null);
      setPlan(subData?.plan ?? null);
      setFeatures(featuresData?.features ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    refresh();
  }, [isAuthenticated, authLoading]);

  const upgrade = async (planCode: string, billingCycle?: string) => {
    const data = await upgradeSubscription(planCode, billingCycle);
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
  };

  const downgrade = async (planCode: string) => {
    const data = await downgradeSubscription(planCode);
    await refresh();
  };

  return (
    <SubscriptionContext.Provider value={{ plan, subscription, features, loading, refresh, upgrade, downgrade }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error("useSubscription must be used within SubscriptionProvider");
  return context;
}
