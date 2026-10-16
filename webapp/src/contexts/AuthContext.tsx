import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type {
  User,
  AuthContextType,
} from "@/types/app";
import {
  getMe,
  verifyTwoFactor as verifyTwoFactorApi,
  getOnboarding,
  completeOnboardingStep,
  finishOnboarding as finishOnboardingApi,
  logout as logoutApi,
} from "@/api/client";
import type { OnboardingProgress } from "@/types/api";
import { clearSubscriptionCache } from "@/contexts/SubscriptionContext";

export type { User, AuthContextType };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);

  async function loadOnboarding() {
    try {
      const data = await getOnboarding();
      setOnboarding(data);
    } catch {
      setOnboarding(null);
    }
  }

  const completeStep = useCallback(async (step: string) => {
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

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      try {
        const data = await getMe();
        if (!cancelled) {
          setUser(data.user);
          setOnboarding(data.onboarding ?? null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setOnboarding(null);
        }
      }
      if (!cancelled) setIsLoading(false);
    }
    validate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((newUser: User) => {
    setUser(newUser);
    setOnboarding(null);
    clearSubscriptionCache();
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setOnboarding(null);
    clearSubscriptionCache();
    try {
      await logoutApi();
    } catch {
      // ignore errors during logout
    }
  }, []);

  const verifyTwoFactor = useCallback(async (email: string, code: string) => {
    const data = await verifyTwoFactorApi(email, code);
    login(data.user as unknown as User);
  }, [login]);

  return (
    <AuthContext.Provider value={{ user, businessId: user?.businessId, login, logout, verifyTwoFactor, isAuthenticated: !!user, isLoading, onboarding, completeStep, skipOnboarding, refreshOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
