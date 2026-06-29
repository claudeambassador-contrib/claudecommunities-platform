"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const isDestructive = variant === "destructive";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop click-to-dismiss; keyboard users dismiss via the Escape handler above
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop click-to-dismiss; keyboard users dismiss via the Escape handler above
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-[#1f1f1f] border border-[#333] rounded-xl w-full max-w-md shadow-xl"
      >
        <div className="p-5 flex items-start gap-3">
          {isDestructive && (
            <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
          )}
          <div className="min-w-0">
            <h3 id="confirm-dialog-title" className="text-white font-semibold">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{description}</p>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#333] flex justify-end gap-2 bg-[#1a1a1a] rounded-b-xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm text-gray-300 hover:bg-[#333] rounded-lg disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`px-3 py-1.5 text-sm text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50 ${
              isDestructive ? "bg-red-600 hover:bg-red-500" : "bg-[#E07A5F] hover:bg-[#c96a52]"
            }`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
