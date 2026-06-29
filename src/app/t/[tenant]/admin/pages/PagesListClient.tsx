"use client";

import { Check, Copy, FileText, Folder, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import type { ContentPageSummary } from "@/lib/services/pages";
import { deletePage } from "./actions";

/** Group pages by their parent folder (the path minus its last segment). */
function groupByFolder(
  pages: ContentPageSummary[],
): { folder: string; pages: ContentPageSummary[] }[] {
  const groups = new Map<string, ContentPageSummary[]>();
  for (const page of pages) {
    const segments = page.path.split("/");
    const folder = segments.length > 1 ? segments.slice(0, -1).join("/") : "";
    const list = groups.get(folder) ?? [];
    list.push(page);
    groups.set(folder, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, list]) => ({ folder, pages: list }));
}

function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const href = `/p/${path}`;
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

function PageRow({
  page,
  onDeleted,
}: {
  page: ContentPageSummary;
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deletePage(page.id);
      if (res.ok) onDeleted(page.id);
      else setError(res.error);
    });
  }

  return (
    <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-[#78716C] shrink-0" />
        <div className="flex-1 min-w-0">
          <TenantLink
            href={`/admin/pages/${page.id}`}
            className="text-base font-semibold text-white hover:text-[#D4836A] transition-colors block truncate"
          >
            {page.title}
          </TenantLink>
          <CopyPathButton path={page.path} />
        </div>
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
              aria-label="Delete page"
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

export default function PagesListClient({ pages }: { pages: ContentPageSummary[] }) {
  const [items, setItems] = useState(pages);

  if (items.length === 0) {
    return (
      <p className="text-sm text-[#78716C] py-8 text-center border border-dashed border-white/[0.08] rounded-xl">
        No custom pages yet. Create one to add an About, FAQ, or any other page.
      </p>
    );
  }

  const groups = groupByFolder(items);
  return (
    <div className="space-y-6">
      {groups.map(({ folder, pages: groupPages }) => (
        <div key={folder || "__root__"} className="space-y-3">
          {folder && (
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#78716C]">
              <Folder className="w-3.5 h-3.5" />
              {folder}
            </div>
          )}
          {groupPages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              onDeleted={(id) => setItems((prev) => prev.filter((p) => p.id !== id))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
