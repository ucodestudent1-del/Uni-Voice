import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { getSubscription, getPlans, upgradeSubscription, downgradeSubscription, getFeatures } from "../api/client";
import { useAuth } from "./AuthContext";

interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  features?: any[];
}

interface SubscriptionCache {
  plan: Plan | null;
  subscription: any;
  features: any[];
  timestamp: number;
}

const CACHE_TTL = 60 * 1000;
const subscriptionCache = new Map<string, SubscriptionCache>();

function getCachedSubscription(businessId?: string): SubscriptionCache | null {
  if (!businessId) return null;
  const cached = subscriptionCache.get(businessId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    subscriptionCache.delete(businessId);
    return null;
  }
  return cached;
}

function setCachedSubscription(businessId: string, data: SubscriptionCache): void {
  subscriptionCache.set(businessId, data);
}

export function clearSubscriptionCache(businessId?: string): void {
  if (businessId) {
    subscriptionCache.delete(businessId);
  } else {
    subscriptionCache.clear();
  }
}

interface SubscriptionContextType {
  plan: Plan | null;
  subscription: any;
  features: any[];
  loading: boolean;
  refresh: () => Promise<void>;
  upgrade: (planCode: string) => Promise<void>;
  downgrade: (planCode: string) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { isAuthenticated, isLoading: authLoading, businessId } = useAuth();
  const isInitialLoad = useRef(true);

  async function refresh() {
    if (!businessId) {
      setPlan(null);
      setSubscription(null);
      setFeatures([]);
      setLoading(false);
      return;
    }

    const cached = getCachedSubscription(businessId);
    if (cached) {
      setPlan(cached.plan);
      setSubscription(cached.subscription);
      setFeatures(cached.features);
      setLoading(false);
      return;
    }

    try {
      const [subData, plansData, featuresData] = await Promise.all([
        getSubscription().catch(() => null),
        getPlans().catch(() => ({ plans: [] })),
        getFeatures().catch(() => ({ features: [], premium: [] })),
      ]);
      const planData = subData?.plan ?? null;
      const subData_ = subData?.subscription ?? null;
      const featureData = featuresData?.features ?? [];
      setSubscription(subData_);
      setPlan(planData);
      setFeatures(featureData);
      setCachedSubscription(businessId, {
        plan: planData,
        subscription: subData_,
        features: featureData,
        timestamp: Date.now(),
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      isInitialLoad.current = false;
      return;
    }
    if (isInitialLoad.current || !businessId) {
      isInitialLoad.current = false;
      void refresh();
    }
  }, [isAuthenticated, authLoading, businessId]);

  const upgrade = async (planCode: string) => {
    const data = await upgradeSubscription(planCode);
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
  };

  const downgrade = async (planCode: string) => {
    await downgradeSubscription(planCode);
    clearSubscriptionCache(businessId);
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
