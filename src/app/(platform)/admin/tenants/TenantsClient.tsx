"use client";

import {
  AlertCircle,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export interface TenantRow {
  slug: string;
  name: string;
  status: string;
  customDomain: string | null;
  listed: boolean;
  memberCount: number;
  createdAt: string;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,37}[a-z0-9]$/;

function TenantManageRow({
  tenant,
  onChange,
  onDelete,
}: {
  tenant: TenantRow;
  onChange: (next: TenantRow) => void;
  onDelete: (slug: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [name, setName] = useState(tenant.name);
  const [customDomain, setCustomDomain] = useState(tenant.customDomain ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.slug}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.ok) {
        onDelete(tenant.slug); // row unmounts — no need to reset local state
      } else {
        setError(data.error || "Delete failed");
        setBusy(false);
      }
    } catch {
      setError("Something went wrong");
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.tenant) {
        onChange({
          ...tenant,
          name: data.tenant.name,
          status: data.tenant.status,
          customDomain: data.tenant.customDomain ?? null,
          listed: data.tenant.listed,
        });
        setEditing(false);
      } else {
        setError(data.error || "Update failed");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Building2 className="w-5 h-5 text-[#78716C] shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-medium truncate">
              {tenant.name} <span className="text-[#78716C] font-normal">/{tenant.slug}</span>
            </p>
            <p className="text-[#78716C] text-sm truncate">
              {tenant.memberCount} member{tenant.memberCount === 1 ? "" : "s"}
              {tenant.customDomain ? ` · ${tenant.customDomain}` : ""}
              {!tenant.listed ? " · hidden" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
              tenant.status === "active"
                ? "bg-[#10B981]/20 text-[#10B981]"
                : "bg-[#F59E0B]/20 text-[#F59E0B]"
            }`}
          >
            {tenant.status}
          </span>
          <button
            type="button"
            title={tenant.listed ? "Hide from directory" : "Show in directory"}
            disabled={busy}
            onClick={() => patch({ listed: !tenant.listed })}
            className="p-2 rounded-lg text-[#A8A29E] hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            {tenant.listed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            type="button"
            title={tenant.status === "active" ? "Suspend" : "Reactivate"}
            disabled={busy}
            onClick={() => patch({ status: tenant.status === "active" ? "suspended" : "active" })}
            className="p-2 rounded-lg text-[#A8A29E] hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Edit"
            disabled={busy}
            onClick={() => setEditing((v) => !v)}
            className="p-2 rounded-lg text-[#A8A29E] hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Delete community"
            disabled={busy}
            onClick={() => {
              setConfirmingDelete((v) => !v);
              setConfirmText("");
              setError(null);
            }}
            className="p-2 rounded-lg text-[#A8A29E] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div className="mt-3 p-4 rounded-lg border border-red-500/30 bg-red-500/[0.06]">
          <div className="flex items-start gap-2 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Permanently delete “{tenant.name}”?</p>
              <p className="text-red-400/80 mt-1">
                This erases every post, event, member record, course, email and setting for{" "}
                <code className="text-red-300">/{tenant.slug}</code>. It cannot be undone. Uploaded
                files in storage are not removed.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <label
              htmlFor={`confirm-${tenant.slug}`}
              className="block text-xs text-[#A8A29E] mb-1.5"
            >
              Type <span className="text-red-300 font-mono">{tenant.slug}</span> to confirm
            </label>
            <input
              id={`confirm-${tenant.slug}`}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={tenant.slug}
              autoComplete="off"
              className="w-full sm:max-w-xs px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm placeholder-[#78716C] focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy || confirmText.trim() !== tenant.slug}
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirmingDelete(false);
                setConfirmText("");
              }}
              className="px-4 py-2 text-[#A8A29E] hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            className="px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
          />
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="Custom domain (optional)"
            className="px-3 py-2 bg-[#1C1917] border border-white/[0.06] rounded-lg text-white text-sm placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
          />
          <div className="sm:col-span-2 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patch({ name: name.trim(), customDomain: customDomain.trim() || null })
              }
              className="px-4 py-2 bg-[#D4836A] hover:bg-[#c4775f] disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-[#A8A29E] hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export default function TenantsClient({ initialTenants }: { initialTenants: TenantRow[] }) {
  const [tenants, setTenants] = useState<TenantRow[]>(initialTenants);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    if (!SLUG_RE.test(cleanSlug)) {
      setResult({
        type: "error",
        message: "Slug must be 2–39 chars: lowercase letters, digits, internal hyphens.",
      });
      return;
    }
    if (!ownerEmail.includes("@")) {
      setResult({ type: "error", message: "Please enter a valid owner email." });
      return;
    }

    setIsSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: cleanSlug,
          name: name.trim(),
          ownerEmail: ownerEmail.trim().toLowerCase(),
          customDomain: customDomain.trim().toLowerCase() || null,
        }),
      });
      const data = await response.json();
      if (response.ok && data.tenant) {
        const origin = window.location.origin;
        setResult({
          type: "success",
          message: `Community "${cleanSlug}" created — live at ${origin}/${cleanSlug}`,
        });
        setTenants((prev) => [
          {
            slug: data.tenant.slug,
            name: data.tenant.name,
            status: data.tenant.status,
            customDomain: data.tenant.customDomain ?? null,
            listed: data.tenant.listed ?? true,
            memberCount: 1,
            createdAt: data.tenant.createdAt ?? new Date().toISOString(),
          },
          ...prev,
        ]);
        setSlug("");
        setName("");
        setOwnerEmail("");
        setCustomDomain("");
      } else {
        setResult({ type: "error", message: data.error || "Failed to create community" });
      }
    } catch {
      setResult({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-6"
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-[#A8A29E] mb-2">
                Slug <span className="text-[#D4836A]">*</span>
              </label>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="new-zealand"
                required
                className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
              />
              <p className="text-xs text-[#78716C] mt-1">
                URL path — immutable. Reachable at /{slug.trim().toLowerCase() || "slug"}
              </p>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#A8A29E] mb-2">
                Display name <span className="text-[#D4836A]">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Claude Community New Zealand"
                required
                className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ownerEmail" className="block text-sm font-medium text-[#A8A29E] mb-2">
              Owner email <span className="text-[#D4836A]">*</span>
            </label>
            <input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@example.com"
              required
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
            <p className="text-xs text-[#78716C] mt-1">
              Gets super_admin of this community when they sign up with this email.
            </p>
          </div>

          <div>
            <label htmlFor="customDomain" className="block text-sm font-medium text-[#A8A29E] mb-2">
              Custom domain (optional)
            </label>
            <input
              id="customDomain"
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="claudecommunity.co.nz"
              className="w-full px-4 py-3 bg-[#1C1917] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
            />
            <p className="text-xs text-[#78716C] mt-1">
              Also add it to the Worker's custom domains in Cloudflare for it to resolve.
            </p>
          </div>

          {result && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                result.type === "success"
                  ? "bg-[#10B981]/10 text-[#10B981]"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {result.type === "success" ? (
                <CheckCircle className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <span className="text-sm">{result.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !slug || !name || !ownerEmail}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] disabled:bg-[#D4836A]/50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Create community
              </>
            )}
          </button>
        </div>
      </form>

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          All communities ({tenants.length})
        </h2>
        <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] overflow-hidden">
          {tenants.length === 0 ? (
            <div className="p-8 text-center text-[#78716C]">No communities yet</div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {tenants.map((t) => (
                <TenantManageRow
                  key={t.slug}
                  tenant={t}
                  onChange={(next) =>
                    setTenants((prev) => prev.map((x) => (x.slug === next.slug ? next : x)))
                  }
                  onDelete={(slug) => setTenants((prev) => prev.filter((x) => x.slug !== slug))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
