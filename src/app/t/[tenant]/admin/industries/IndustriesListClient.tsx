"use client";

import { Building2, Check, Copy, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import type { AdminIndustrySummary } from "@/lib/services/industries";
import { deleteIndustryAction } from "./actions";

function CopyPath({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const href = `/for/${slug}`;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(href).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-white transition-colors"
      title="Copy the path to paste into a footer link"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="font-mono">{href}</span>
    </button>
  );
}

function Row({
  item,
  onReverted,
}: {
  item: AdminIndustrySummary;
  onReverted: (slug: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Deleting a custom row that overrides a built-in REVERTS to the built-in;
  // deleting a net-new custom row removes it entirely.
  const revertsToBuiltIn = item.custom && item.builtIn;

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteIndustryAction(item.slug);
      if (res.ok) onReverted(item.slug);
      else setError(res.error);
    });
  }

  return (
    <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center gap-3">
        <Building2 className="w-5 h-5 text-[#78716C] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TenantLink
              href={`/admin/industries/${item.slug}`}
              className="text-base font-semibold text-white hover:text-[#D4836A] transition-colors truncate"
            >
              {item.name || item.slug}
            </TenantLink>
            <span
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                item.custom ? "bg-[#D4836A]/15 text-[#D4836A]" : "bg-white/[0.06] text-[#78716C]"
              }`}
            >
              {item.custom ? (item.builtIn ? "Customized" : "Custom") : "Built-in"}
            </span>
          </div>
          <CopyPath slug={item.slug} />
        </div>
        {item.custom && (
          <Can permission="pages.edit">
            {confirming ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20"
                >
                  {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {revertsToBuiltIn ? "Revert to built-in" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-[#A8A29E] hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="p-1.5 rounded-lg text-[#78716C] hover:text-red-400 shrink-0"
                aria-label={revertsToBuiltIn ? "Revert to built-in" : "Delete industry page"}
              >
                {revertsToBuiltIn ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </Can>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

export default function IndustriesListClient({
  industries,
}: {
  industries: AdminIndustrySummary[];
}) {
  const [items, setItems] = useState(industries);

  // A revert (delete of a customized built-in) flips it back to non-custom in
  // place; a delete of a net-new custom row removes it from the list.
  function onReverted(slug: string) {
    setItems((prev) =>
      prev.flatMap((it) => {
        if (it.slug !== slug) return [it];
        return it.builtIn ? [{ ...it, custom: false }] : [];
      }),
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Row key={item.slug} item={item} onReverted={onReverted} />
      ))}
    </div>
  );
}
