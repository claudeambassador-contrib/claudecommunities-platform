"use client";

import { CalendarDays, List, Plus, Settings as SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useToast } from "@/components/ui/Toast";
import type { SocialAccountSummary, SocialPostSummary } from "@/lib/social/types";
import { Can } from "../Can";
import { PostComposer } from "./PostComposer";
import { SocialCalendar } from "./SocialCalendar";
import { SocialList } from "./SocialList";

type Tab = "list" | "calendar";

interface Props {
  initialAccounts: SocialAccountSummary[];
  initialPosts: SocialPostSummary[];
  zernioDryRun?: boolean;
}

export function SocialDashboard({ initialAccounts, initialPosts, zernioDryRun }: Props) {
  const toast = useToast();
  const [accounts] = useState<SocialAccountSummary[]>(initialAccounts);
  const [posts, setPosts] = useState<SocialPostSummary[]>(initialPosts);
  const [tab, setTab] = useState<Tab>("list");
  const [showComposer, setShowComposer] = useState(false);
  const [editing, setEditing] = useState<SocialPostSummary | null>(null);

  const upcoming = useMemo(
    () => posts.filter((p) => ["draft", "scheduled", "publishing"].includes(p.status)),
    [posts],
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/social/posts?range=all&limit=200");
    if (res.ok) {
      const data = (await res.json()) as SocialPostSummary[];
      setPosts(data);
    }
  }, []);

  // Auto-refresh while the page is visible and there's a transient row to
  // watch (a post in 'publishing' is mid-workflow, a 'scheduled' post is
  // waiting on the cron). Without this, the user has to manually reload to
  // see a post transition out of 'publishing' once the workflow finishes.
  const hasTransientPosts = useMemo(
    () => posts.some((p) => p.status === "publishing" || p.status === "scheduled"),
    [posts],
  );
  useEffect(() => {
    if (!hasTransientPosts) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refresh();
      }
    };
    const interval = window.setInterval(tick, 10_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [hasTransientPosts, refresh]);

  const handleSaved = useCallback(
    async (action: "draft" | "scheduled" | "publish") => {
      const labels = {
        draft: "Draft saved",
        scheduled: "Post scheduled",
        // Publish is now async (PublishPostWorkflow). Status moves to
        // 'publishing' immediately; refresh shows the terminal state once
        // the workflow finishes.
        publish: "Publishing — refresh in a moment",
      };
      toast.success(labels[action]);
      setShowComposer(false);
      setEditing(null);
      await refresh();
    },
    [refresh, toast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/social/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Post deleted");
        await refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Delete failed");
      }
    },
    [refresh, toast],
  );

  const handlePublishNow = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/social/posts/${id}/publish`, { method: "POST" });
      if (res.ok) {
        toast.success("Publishing started");
        await refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Publish failed");
      }
    },
    [refresh, toast],
  );

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Social Scheduler</h1>
            <p className="text-[#78716C] text-sm mt-1">
              Schedule and publish posts to your connected social accounts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Can permission="social.manage">
              <TenantLink
                href="/admin/social/settings"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#A8A29E] border border-white/[0.06] hover:bg-white/[0.05] hover:text-white"
              >
                <SettingsIcon className="w-4 h-4" />
                Accounts
              </TenantLink>
            </Can>
            <Can permission="social.edit">
              <button
                type="button"
                disabled={accounts.length === 0}
                onClick={() => {
                  setEditing(null);
                  setShowComposer(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#D4836A] text-white hover:bg-[#C26F56] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                New post
              </button>
            </Can>
          </div>
        </div>

        {zernioDryRun && (
          <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100 flex items-center gap-2">
            <span className="font-semibold uppercase text-xs px-2 py-0.5 rounded bg-yellow-500/30">
              Dry run
            </span>
            <span>
              <code className="text-yellow-200">ZERNIO_DRY_RUN</code> is on — Zernio posts will save
              as drafts in your Zernio dashboard and won&apos;t reach LinkedIn. Direct LinkedIn
              posts are unaffected.
            </span>
          </div>
        )}

        {accounts.length === 0 && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            No social accounts connected.{" "}
            <TenantLink
              href="/admin/social/settings"
              className="underline underline-offset-2 hover:text-white"
            >
              Connect a LinkedIn page
            </TenantLink>{" "}
            to start scheduling posts.
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-white/[0.06]">
          <TabButton active={tab === "list"} onClick={() => setTab("list")}>
            <List className="w-4 h-4" />
            List
          </TabButton>
          <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")}>
            <CalendarDays className="w-4 h-4" />
            Calendar
          </TabButton>
        </div>

        {/* Body */}
        {tab === "list" ? (
          <SocialList
            posts={posts}
            onEdit={(p) => {
              setEditing(p);
              setShowComposer(true);
            }}
            onDelete={handleDelete}
            onPublishNow={handlePublishNow}
          />
        ) : (
          <SocialCalendar
            posts={upcoming}
            onSelect={(p) => {
              setEditing(p);
              setShowComposer(true);
            }}
          />
        )}
      </div>

      {showComposer && (
        <PostComposer
          accounts={accounts}
          existing={editing}
          onClose={() => {
            setShowComposer(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "text-white border-[#D4836A]"
          : "text-[#78716C] border-transparent hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
