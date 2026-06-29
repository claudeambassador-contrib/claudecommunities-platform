"use client";

import { CheckCircle2, Linkedin, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface CandidateAccount {
  externalId: string;
  displayName: string;
  accountType: "organization" | "person";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

type Step = "key" | "pick";

export function ZernioConnectDialog({ open, onClose, onConnected }: Props) {
  const toast = useToast();
  const [step, setStep] = useState<Step>("key");
  const [apiKey, setApiKey] = useState("");
  const [candidates, setCandidates] = useState<CandidateAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setStep("key");
      setApiKey("");
      setCandidates([]);
      setSelected(new Set());
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      toast.error("Paste your Zernio API key first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/social/accounts/zernio/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = (await res.json()) as { accounts?: CandidateAccount[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Validation failed");
      }
      const list = data.accounts ?? [];
      if (list.length === 0) {
        toast.error("That API key has no LinkedIn accounts in Zernio yet.");
        return;
      }
      setCandidates(list);
      // Default-select all so the common case (single account) is one click.
      setSelected(new Set(list.map((a) => a.externalId)));
      setStep("pick");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one account");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/social/accounts/zernio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          externalIds: Array.from(selected),
        }),
      });
      const data = (await res.json()) as { count?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Connect failed");
      toast.success(`Connected ${data.count} account${data.count === 1 ? "" : "s"}`);
      onConnected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close convenience; dialog has an explicit close button and Escape handler
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-close convenience; dialog has an explicit close button and Escape handler
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
      onClick={() => !busy && onClose()}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: onClick only stops backdrop propagation, no user-facing interaction */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only stops backdrop propagation, no user-facing interaction */}
      <div
        className="bg-[#1F1B17] border border-white/[0.08] rounded-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">Connect via Zernio</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1 text-[#78716C] hover:text-white disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {step === "key" ? (
            <>
              <label
                htmlFor="zernio-api-key"
                className="block text-xs font-medium uppercase tracking-wide text-[#78716C] mb-2"
              >
                Zernio API key
              </label>
              <input
                id="zernio-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk_…"
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg bg-[#2D2926] border border-white/[0.06] text-white text-sm placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 font-mono"
              />
              <p className="text-xs text-[#78716C] mt-2">
                Create at{" "}
                <a
                  href="https://zernio.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#7CB8F0] hover:underline"
                >
                  zernio.com → Settings → API Keys
                </a>
                . The key is stored as-is (single-tenant admin app).
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-[#78716C] mb-3">
                LinkedIn accounts in this Zernio key
              </p>
              <ul className="space-y-2">
                {candidates.map((c) => {
                  const checked = selected.has(c.externalId);
                  return (
                    <li key={c.externalId}>
                      <label
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? "border-[#D4836A] bg-[#D4836A]/10"
                            : "border-white/[0.06] hover:border-white/[0.12]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(c.externalId)}
                          className="sr-only"
                        />
                        <Linkedin className="w-4 h-4 text-[#7CB8F0]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{c.displayName}</p>
                          <p className="text-xs text-[#78716C]">{c.accountType}</p>
                        </div>
                        {checked && <CheckCircle2 className="w-5 h-5 text-[#D4836A]" />}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-white/[0.06] bg-[#1A1715]">
          {step === "pick" && (
            <button
              type="button"
              onClick={() => setStep("key")}
              disabled={busy}
              className="px-3 py-2 rounded-lg text-sm text-[#A8A29E] hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-sm text-[#A8A29E] hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>
          {step === "key" ? (
            <button
              type="button"
              onClick={handleValidate}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#D4836A] text-white hover:bg-[#C26F56] disabled:opacity-40"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy || selected.size === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#D4836A] text-white hover:bg-[#C26F56] disabled:opacity-40"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Connect {selected.size} {selected.size === 1 ? "account" : "accounts"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
