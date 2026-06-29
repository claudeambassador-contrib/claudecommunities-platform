"use client";

import { AlertCircle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { TenantLink, useTenantBase } from "@/components/TenantBaseProvider";
import { tenantHref } from "@/lib/tenant-base";

export default function AdminLogin() {
  const base = useTenantBase();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Enter the admin password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/impact-lab/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        // Hard navigation guarantees the new admin cookie is picked up by
        // the server-rendered admin page. router.refresh() was getting
        // swallowed silently on prod on at least one device.
        window.location.href = tenantHref(base, "/impact-lab/admin");
      } else {
        setError(data.error || "Login failed.");
      }
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-claude-coral" />
          <h1 className="mt-3 text-2xl font-semibold text-text-primary">Organiser sign in</h1>
          <p className="mt-1 text-sm text-text-muted">Impact Lab portal admin</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/10 bg-claude-dark-card/80 p-6"
        >
          <label
            htmlFor="admin-password"
            className="mb-1.5 block text-xs font-medium text-text-secondary"
          >
            Admin password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            // biome-ignore lint/a11y/noAutofocus: admin password is the only field on this screen
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-claude-dark px-4 py-3 text-text-primary focus:border-claude-coral focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-claude-coral px-4 py-3 text-sm font-semibold text-claude-dark transition hover:bg-claude-coral-light disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </button>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        <TenantLink
          href="/impact-lab"
          className="mt-5 flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-text-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the portal
        </TenantLink>
      </div>
    </div>
  );
}
