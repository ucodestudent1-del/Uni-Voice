import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getMe, login as apiLogin, register as apiRegister, verifyTwoFactor as verifyTwoFactorApi, getOnboarding, completeOnboardingStep, finishOnboarding as finishOnboardingApi } from "../api/client";
import type { OnboardingProgress } from "../types/api";
import { clearSubscriptionCache } from "./SubscriptionContext";

interface User {
  id: string;
  businessId?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  businessId: string | undefined;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  verifyTwoFactor: (email: string, code: string) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboarding: OnboardingProgress | null;
  completeStep: (step: string) => Promise<OnboardingProgress>;
  skipOnboarding: () => Promise<OnboardingProgress>;
  refreshOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        setToken(storedToken);
      } else {
        setIsLoading(false);
      }
    } catch {
      setToken(null);
      setIsLoading(false);
    }
  }, []);

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

  function safeRemoveToken() {
    try {
      localStorage.removeItem("token");
    } catch {
      // ignore localStorage errors (e.g., private browsing, quota exceeded)
    }
  }

  function safeSetToken(token: string) {
    try {
      localStorage.setItem("token", token);
    } catch {
      // ignore localStorage errors
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
      } catch {
        if (!cancelled) {
          safeRemoveToken();
          setToken(null);
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
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    safeSetToken(newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    safeRemoveToken();
    setToken(null);
    setUser(null);
    setOnboarding(null);
    clearSubscriptionCache();
  };

  const verifyTwoFactor = async (email: string, code: string) => {
    const data = await verifyTwoFactorApi(email, code);
    login(data.token, data.user as unknown as User);
  };

  return (
    <AuthContext.Provider value={{ user, businessId: user?.businessId, token, login, logout, verifyTwoFactor, isAuthenticated: !!user, isLoading, onboarding, completeStep, skipOnboarding, refreshOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
