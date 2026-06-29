"use client";

import { FileText, Loader2, Lock, MessageSquare, Mic, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface Talk {
  id: string;
  title: string;
  description: string | null;
  status: string;
  contentLocked: boolean;
  slidesLocked: boolean;
  slidesUrl: string | null;
  slidesFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusStyles: Record<string, string> = {
  pending: "bg-[#F59E0B]/15 text-[#F59E0B]",
  approved: "bg-[#10B981]/15 text-[#10B981]",
  declined: "bg-red-500/15 text-red-400",
};

export default function MyTalksList() {
  const config = useTenantConfig();
  const [talks, setTalks] = useState<Talk[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/talks");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { talks: Talk[] };
        if (!cancelled) setTalks(data.talks);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">My talks</h1>
          <p className="text-sm text-[#A8A29E]">
            Submissions you&apos;ve sent in. Edit, upload slides, or reply to admin comments.
          </p>
        </div>
        <TenantLink
          href="/speak"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] hover:bg-[#c4775f] text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New talk
        </TenantLink>
      </div>

      {error && <div className="p-4 bg-red-500/10 text-red-400 rounded-xl text-sm">{error}</div>}

      {talks === null && !error ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#A8A29E] animate-spin" />
        </div>
      ) : talks && talks.length === 0 ? (
        <div className="text-center py-16 bg-[#2D2926] rounded-xl border border-white/[0.06]">
          <Mic className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
          <p className="text-[#A8A29E] mb-4">You haven&apos;t submitted any talks yet.</p>
          <TenantLink
            href="/speak"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4836A] hover:bg-[#c4775f] text-white rounded-xl text-sm font-medium transition-colors"
          >
            Submit your first talk
          </TenantLink>
        </div>
      ) : talks ? (
        <div className="space-y-3">
          {talks.map((t) => (
            <TenantLink
              key={t.id}
              href={`/my-talks/${t.id}`}
              className="block bg-[#2D2926] rounded-xl border border-white/[0.06] hover:border-white/[0.16] p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="text-white font-medium text-base truncate">{t.title}</h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  {t.contentLocked && (
                    <span
                      title="Locked for editing"
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-[#78716C]/20 text-[#A8A29E]"
                    >
                      <Lock className="w-3 h-3" />
                      Locked
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[t.status] ?? statusStyles.pending}`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
              {t.description && (
                <p className="text-[#A8A29E] text-sm line-clamp-2 mb-3">{t.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-[#78716C]">
                <span>
                  Submitted{" "}
                  {new Date(t.createdAt).toLocaleDateString(config.lang, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {t.slidesUrl && (
                  <span className="inline-flex items-center gap-1 text-[#D4836A]">
                    <FileText className="w-3.5 h-3.5" />
                    Slides
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  View thread
                </span>
              </div>
            </TenantLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}
