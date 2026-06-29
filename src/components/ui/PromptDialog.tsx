"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  inputType?: "text" | "datetime-local" | "number" | "email";
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}

export default function PromptDialog({
  open,
  title,
  description,
  label,
  initialValue,
  inputType = "text",
  placeholder,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onConfirm(value);
    } finally {
      setBusy(false);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop click-to-dismiss; keyboard users dismiss via the Escape handler above
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop click-to-dismiss; keyboard users dismiss via the Escape handler above
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <form
        onSubmit={submit}
        className="bg-[#1f1f1f] border border-[#333] rounded-xl w-full max-w-md shadow-xl"
      >
        <div className="p-5 space-y-3">
          <h3 className="text-white font-semibold">{title}</h3>
          {description && <p className="text-sm text-gray-400">{description}</p>}
          <div>
            <label htmlFor="prompt-dialog-input" className="block text-xs text-gray-400 mb-1">
              {label}
            </label>
            <input
              id="prompt-dialog-input"
              type={inputType}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              // biome-ignore lint/a11y/noAutofocus: focus the input when the prompt dialog opens
              autoFocus
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg p-2 text-sm text-white"
            />
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
            type="submit"
            disabled={busy}
            className="px-3 py-1.5 text-sm text-white bg-[#E07A5F] hover:bg-[#c96a52] rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
