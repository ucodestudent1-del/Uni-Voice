import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import Toast, { type ToastProps, type ToastType } from "./Toast";

interface ToastContextValue {
  addToast: (toast: Omit<ToastProps, "id">) => string;
  removeToast: (id: string) => void;
  toast: (message: string, options?: { type?: ToastType; title?: string; duration?: number; actionLabel?: string; onAction?: () => void }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastProps, "id">) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => removeToast(id), (toast.duration ?? 5000) + 500);
    return id;
  }, [removeToast]);

  const toast = useCallback(
    (message: string, options?: { type?: ToastType; title?: string; duration?: number; actionLabel?: string; onAction?: () => void }) => {
      addToast({ message, ...options });
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toast }}>
      {children}
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </ToastContext.Provider>
  );
}
