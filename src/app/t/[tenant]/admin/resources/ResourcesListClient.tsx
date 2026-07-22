"use client";

import { Loader2, Trash2, Video } from "lucide-react";
import { useState, useTransition } from "react";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import type { AdminResourceSummary } from "@/lib/services/resources";
import { deleteResourceAction } from "./actions";

function Row({
  item,
  onDeleted,
}: {
  item: AdminResourceSummary;
  onDeleted: (slug: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteResourceAction(item.slug);
      if (res.ok) onDeleted(item.slug);
      else setError(res.error);
    });
  }

  return (
    <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center gap-3">
        <Video className="w-5 h-5 text-[#78716C] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TenantLink
              href={`/admin/resources/${item.slug}`}
              className="text-base font-semibold text-white hover:text-[#D4836A] transition-colors truncate"
            >
              {item.title || item.slug}
            </TenantLink>
            {!item.isPublished && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-[#78716C]">
                Draft
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-[#78716C]">/resources/{item.slug}</span>
        </div>
        <Can permission="resources.delete">
          {confirming ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20"
              >
                {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm delete
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
              aria-label="Delete resource"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </Can>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

export default function ResourcesListClient({ resources }: { resources: AdminResourceSummary[] }) {
  const [items, setItems] = useState(resources);

  function onDeleted(slug: string) {
    setItems((prev) => prev.filter((it) => it.slug !== slug));
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-[#78716C]">No resources yet — add your first video.</p>
      ) : (
        items.map((item) => <Row key={item.slug} item={item} onDeleted={onDeleted} />)
      )}
    </div>
  );
}
