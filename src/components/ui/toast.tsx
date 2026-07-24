"use client";

/**
 * Système de toasts global — remplace les alert() natifs.
 *
 * Usage :
 *   const toast = useToast();
 *   toast.success("Contrat enregistré");
 *   toast.error(getErrorMessage(e));
 *
 * Le ToastProvider est monté dans les layouts (dashboard, pilotage, platform).
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast doit être utilisé sous <ToastProvider>");
  }
  return ctx;
}

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
      // Les erreurs restent plus longtemps à l'écran
      setTimeout(() => dismiss(id), type === "error" ? 7000 : 4000);
    },
    [dismiss]
  );

  const apiRef = useRef<ToastApi>({
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  });
  // push est stable (useCallback deps stables) : l'API l'est aussi
  apiRef.current.success = (m) => push("success", m);
  apiRef.current.error = (m) => push("error", m);
  apiRef.current.info = (m) => push("info", m);

  return (
    <ToastContext.Provider value={apiRef.current}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-slide-up ${STYLES[t.type]}`}
            >
              <Icon size={18} className="mt-0.5 flex-shrink-0" />
              <p className="flex-1 text-sm leading-snug">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                title="Fermer"
                className="flex-shrink-0 opacity-50 transition-opacity hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
