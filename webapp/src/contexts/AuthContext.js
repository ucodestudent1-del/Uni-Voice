import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMe, verifyTwoFactor as verifyTwoFactorApi, getOnboarding, completeOnboardingStep, finishOnboarding as finishOnboardingApi, } from "@/api/client";
import { clearSubscriptionCache } from "@/contexts/SubscriptionContext";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [onboarding, setOnboarding] = useState(null);
    useEffect(() => {
        try {
            const storedToken = localStorage.getItem("token");
            if (storedToken) {
                setToken(storedToken);
            }
            else {
                setIsLoading(false);
            }
        }
        catch {
            setToken(null);
            setIsLoading(false);
        }
    }, []);
    async function loadOnboarding() {
        try {
            const data = await getOnboarding();
            setOnboarding(data);
        }
        catch {
            setOnboarding(null);
        }
    }
    const completeStep = useCallback(async (step) => {
        const data = await completeOnboardingStep(step);
        setOnboarding(data.progress);
        return data.progress;
    }, []);
    const refreshOnboarding = useCallback(async () => {
        await loadOnboarding();
    }, []);
    const skipOnboarding = useCallback(async () => {
        const data = await finishOnboardingApi();
        setOnboarding(data);
        return data;
    }, []);
    function safeRemoveToken() {
        try {
            localStorage.removeItem("token");
        }
        catch {
            console.warn("Failed to remove token from localStorage");
        }
    }
    function safeSetToken(token) {
        try {
            localStorage.setItem("token", token);
        }
        catch {
            console.warn("Failed to set token in localStorage");
        }
    }
    useEffect(() => {
        let cancelled = false;
        async function validate() {
            if (!token) {
                setIsLoading(false);
                return;
            }
            try {
                const data = await getMe();
                if (!cancelled) {
                    setUser(data.user);
                    setOnboarding(data.onboarding ?? null);
                }
            }
            catch {
                if (!cancelled) {
                    safeRemoveToken();
                    setToken(null);
                    setUser(null);
                    setOnboarding(null);
                }
            }
            if (!cancelled)
                setIsLoading(false);
        }
        validate();
        return () => {
            cancelled = true;
        };
    }, [token]);
    const login = useCallback((newToken, newUser) => {
        safeSetToken(newToken);
        setToken(newToken);
        setUser(newUser);
        setOnboarding(null);
        clearSubscriptionCache();
    }, []);
    const logout = useCallback(() => {
        safeRemoveToken();
        setToken(null);
        setUser(null);
        setOnboarding(null);
        clearSubscriptionCache();
    }, []);
    const verifyTwoFactor = useCallback(async (email, code) => {
        const data = await verifyTwoFactorApi(email, code);
        login(data.token, data.user);
    }, [login]);
    return (_jsx(AuthContext.Provider, { value: { user, businessId: user?.businessId, token, login, logout, verifyTwoFactor, isAuthenticated: !!user, isLoading, onboarding, completeStep, skipOnboarding, refreshOnboarding }, children: children }));
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context)
        throw new Error("useAuth must be used within AuthProvider");
    return context;
}
