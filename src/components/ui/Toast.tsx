"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastKind = "error" | "success" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional secondary detail, smaller text under the message. */
  detail?: string;
}

interface ToastContextValue {
  show: (toast: Omit<Toast, "id">) => void;
  error: (message: string, detail?: string) => void;
  success: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, ...toast }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      error: (message, detail) => show({ kind: "error", message, detail }),
      success: (message, detail) => show({ kind: "success", message, detail }),
      info: (message, detail) => show({ kind: "info", message, detail }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, []);

  const palette =
    toast.kind === "error"
      ? "border-red-500/40 bg-red-950/60 text-red-50"
      : toast.kind === "success"
        ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-50"
        : "border-[#444] bg-[#1f1f1f] text-gray-100";
  const Icon =
    toast.kind === "error" ? AlertCircle : toast.kind === "success" ? CheckCircle2 : Info;
  const iconColor =
    toast.kind === "error"
      ? "text-red-300"
      : toast.kind === "success"
        ? "text-emerald-300"
        : "text-[#E07A5F]";

  return (
    <div
      role="status"
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
      className={`pointer-events-auto min-w-[280px] max-w-md rounded-xl border shadow-xl backdrop-blur transform transition-all duration-200 ${palette} ${entered ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
    >
      <div className="p-3 flex items-start gap-2.5">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
        <div className="flex-1 min-w-0 text-sm">
          <div className="font-medium leading-snug">{toast.message}</div>
          {toast.detail && (
            <div className="text-xs opacity-80 mt-0.5 whitespace-pre-wrap">{toast.detail}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-current opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside a <ToastProvider>");
  }
  return ctx;
}
