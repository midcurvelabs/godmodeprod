"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (opts: { type: ToastType; message: string; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const STRIPE_COLORS = {
  success: "border-l-success",
  error: "border-l-error",
  info: "border-l-accent",
} as const;

const ICON_COLORS = {
  success: "text-success",
  error: "text-error",
  info: "text-accent",
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type, message, duration = 4000 }: { type: ToastType; message: string; duration?: number }) => {
      const id = crypto.randomUUID();
      setToasts((prev) => {
        const next = [...prev, { id, type, message }];
        return next.slice(-3); // max 3 visible
      });
      setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 bg-bg-elevated border border-border border-l-[3px] ${STRIPE_COLORS[t.type]} rounded-lg px-4 py-3 shadow-lg animate-slide-in min-w-[280px] max-w-[380px]`}
            >
              <Icon size={16} className={`mt-0.5 shrink-0 ${ICON_COLORS[t.type]}`} />
              <p className="text-sm text-text-primary flex-1">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
