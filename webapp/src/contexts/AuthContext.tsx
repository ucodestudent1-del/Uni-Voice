import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getMe, login as apiLogin, register as apiRegister, verifyTwoFactor as verifyTwoFactorApi } from "../api/client";

interface User {
  id: string;
  businessId?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  verifyTwoFactor: (email: string, code: string) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function validate() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await getMe();
        setUser(data.user);
      } catch {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    }
    validate();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const verifyTwoFactor = async (email: string, code: string) => {
    const data = await verifyTwoFactorApi(email, code);
    login(data.token, data.user as unknown as User);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, verifyTwoFactor, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
