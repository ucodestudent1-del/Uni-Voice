import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import { getSubscription, getPlans, upgradeSubscription, downgradeSubscription, getFeatures, } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
const CACHE_TTL = 60 * 1000;
const subscriptionCache = new Map();
function getCachedSubscription(businessId) {
    if (!businessId)
        return null;
    const cached = subscriptionCache.get(businessId);
    if (!cached)
        return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) {
        subscriptionCache.delete(businessId);
        return null;
    }
    return cached;
}
function setCachedSubscription(businessId, data) {
    subscriptionCache.set(businessId, data);
}
export function clearSubscriptionCache(businessId) {
    if (businessId) {
        subscriptionCache.delete(businessId);
    }
    else {
        subscriptionCache.clear();
    }
}
const SubscriptionContext = createContext(undefined);
export function SubscriptionProvider({ children }) {
    const [plan, setPlan] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const { isAuthenticated, isLoading: authLoading, businessId } = useAuth();
    const isInitialLoad = useRef(true);
    const lastBusinessId = useRef(undefined);
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
        }
        catch (err) {
            console.error("Failed to load subscription:", err);
        }
        finally {
            setLoading(false);
            isInitialLoad.current = false;
        }
    }
    useEffect(() => {
        if (authLoading)
            return;
        if (!isAuthenticated) {
            setLoading(false);
            isInitialLoad.current = false;
            return;
        }
        if (!businessId) {
            setLoading(false);
            return;
        }
        if (isInitialLoad.current || businessId !== lastBusinessId.current) {
            lastBusinessId.current = businessId;
            isInitialLoad.current = false;
            void refresh();
        }
    }, [isAuthenticated, authLoading, businessId]);
    const upgrade = async (planCode) => {
        const data = await upgradeSubscription(planCode);
        if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
        }
    };
    const downgrade = async (planCode) => {
        await downgradeSubscription(planCode);
        clearSubscriptionCache(businessId);
        await refresh();
    };
    return (_jsx(SubscriptionContext.Provider, { value: { plan, subscription, features, loading, refresh, upgrade, downgrade }, children: children }));
}
export function useSubscription() {
    const context = useContext(SubscriptionContext);
    if (!context)
        throw new Error("useSubscription must be used within SubscriptionProvider");
    return context;
}
