"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  Linkedin,
  Send,
  Trash2,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { RemoteImage } from "@/components/ui/RemoteImage";
import type { SocialMediaType, SocialPlatform, SocialPostSummary } from "@/lib/social/types";
import { Can } from "../Can";

interface Props {
  posts: SocialPostSummary[];
  onEdit: (post: SocialPostSummary) => void;
  onDelete: (id: string) => void;
  onPublishNow: (id: string) => void;
}

type Filter = "upcoming" | "past" | "all";

export function SocialList({ posts, onEdit, onDelete, onPublishNow }: Props) {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [confirmingDelete, setConfirmingDelete] = useState<SocialPostSummary | null>(null);

  const filtered = useMemo(() => {
    if (filter === "upcoming") {
      return posts.filter((p) => ["draft", "scheduled", "publishing"].includes(p.status));
    }
    if (filter === "past") {
      return posts.filter((p) => ["published", "failed", "cancelled"].includes(p.status));
    }
    return posts;
  }, [posts, filter]);

  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        <FilterChip active={filter === "upcoming"} onClick={() => setFilter("upcoming")}>
          Upcoming
        </FilterChip>
        <FilterChip active={filter === "past"} onClick={() => setFilter("past")}>
          Past
        </FilterChip>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        <span className="ml-3 text-xs text-[#78716C]">{filtered.length} posts</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#2D2926] p-12 text-center">
          <p className="text-[#78716C] text-sm">No posts to show.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              onEdit={onEdit}
              onDeleteRequest={() => setConfirmingDelete(post)}
              onPublishNow={onPublishNow}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmingDelete}
        title="Delete this post?"
        description={
          confirmingDelete?.status === "published"
            ? "This only removes the post from the scheduler. The already-published version on the platform stays live."
            : "This removes the scheduled post permanently."
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (confirmingDelete) onDelete(confirmingDelete.id);
          setConfirmingDelete(null);
        }}
        onCancel={() => setConfirmingDelete(null)}
      />
    </div>
  );
}

function FilterChip({
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
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? "bg-[#D4836A]/15 text-[#D4836A] border border-[#D4836A]/30"
          : "text-[#78716C] hover:text-white border border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

function PostRow({
  post,
  onEdit,
  onDeleteRequest,
  onPublishNow,
}: {
  post: SocialPostSummary;
  onEdit: (post: SocialPostSummary) => void;
  onDeleteRequest: () => void;
  onPublishNow: (id: string) => void;
}) {
  const canEdit =
    post.status === "draft" || post.status === "scheduled" || post.status === "failed";
  const canPublishNow =
    post.status === "draft" || post.status === "scheduled" || post.status === "failed";

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#2D2926] hover:border-white/[0.1] transition-colors">
      {/* Media thumbnail */}
      <div className="w-16 h-16 rounded-lg bg-[#1C1917] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
        {post.mediaUrls[0] && post.mediaType !== "document" && post.mediaType !== "video" ? (
          <RemoteImage src={post.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <MediaIcon mediaType={post.mediaType} />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <PlatformBadge platform={post.platform} />
          <span className="text-xs text-[#78716C] truncate">{post.account.displayName}</span>
          {post.account.connector === "zernio" && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/[0.05] text-[#A8A29E]">
              via Zernio
            </span>
          )}
          <StatusBadge status={post.status} />
        </div>
        <p className="text-sm text-white whitespace-pre-wrap line-clamp-3">{post.content}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-[#78716C]">
          <ScheduleLine post={post} />
          {post.mediaUrls.length > 0 && (
            <span className="flex items-center gap-1">
              <MediaIcon mediaType={post.mediaType} small />
              {post.mediaUrls.length} {post.mediaUrls.length === 1 ? "file" : "files"}
            </span>
          )}
          {post.errorMessage && (
            <span className="flex items-center gap-1 text-red-300" title={post.errorMessage}>
              <AlertCircle className="w-3 h-3" />
              {post.errorMessage.slice(0, 60)}
              {post.errorMessage.length > 60 ? "…" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {post.externalUrl && (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-[#78716C] hover:bg-white/[0.05] hover:text-white"
            title="View on platform"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        {canPublishNow && (
          <Can permission="social.publish">
            <button
              type="button"
              onClick={() => onPublishNow(post.id)}
              className="p-2 rounded-lg text-[#78716C] hover:bg-white/[0.05] hover:text-white"
              title="Publish now"
            >
              <Send className="w-4 h-4" />
            </button>
          </Can>
        )}
        {canEdit && (
          <Can permission="social.edit">
            <button
              type="button"
              onClick={() => onEdit(post)}
              className="p-2 rounded-lg text-[#78716C] hover:bg-white/[0.05] hover:text-white"
              title="Edit"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </Can>
        )}
        <Can permission="social.edit">
          <button
            type="button"
            onClick={onDeleteRequest}
            className="p-2 rounded-lg text-[#78716C] hover:bg-red-500/10 hover:text-red-300"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </Can>
      </div>
    </div>
  );
}

function ScheduleLine({ post }: { post: SocialPostSummary }) {
  const { lang } = useTenantConfig();
  const ts = post.publishedAt ?? post.scheduledAt ?? post.createdAt;
  const label =
    post.status === "published"
      ? "Published"
      : post.status === "scheduled"
        ? "Scheduled for"
        : post.status === "draft"
          ? "Draft"
          : post.status === "failed"
            ? "Failed at"
            : post.status;
  return (
    <span className="flex items-center gap-1">
      <Clock className="w-3 h-3" />
      {label} {formatDate(ts, lang)}
    </span>
  );
}

function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  if (platform === "linkedin") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-[#0a66c2]/15 text-[#7CB8F0] border border-[#0a66c2]/30">
        <Linkedin className="w-3 h-3" />
        LinkedIn
      </span>
    );
  }
  return null;
}

function StatusBadge({ status }: { status: SocialPostSummary["status"] }) {
  const map: Record<
    SocialPostSummary["status"],
    { label: string; cls: string; icon?: React.ReactNode }
  > = {
    draft: { label: "Draft", cls: "bg-white/[0.05] text-[#A8A29E]" },
    scheduled: { label: "Scheduled", cls: "bg-[#D4836A]/15 text-[#D4836A]" },
    publishing: {
      label: "Publishing",
      cls: "bg-yellow-500/15 text-yellow-200",
    },
    published: {
      label: "Published",
      cls: "bg-emerald-500/15 text-emerald-300",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    failed: {
      label: "Failed",
      cls: "bg-red-500/15 text-red-300",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    cancelled: { label: "Cancelled", cls: "bg-white/[0.05] text-[#78716C]" },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  );
}

function MediaIcon({ mediaType, small }: { mediaType: SocialMediaType; small?: boolean }) {
  const size = small ? "w-3 h-3" : "w-6 h-6";
  const cls = `${size} text-[#78716C]`;
  switch (mediaType) {
    case "image":
      return <ImageIcon className={cls} />;
    case "multi_image":
      return <Layers className={cls} />;
    case "video":
      return <Video className={cls} />;
    case "document":
      return <FileText className={cls} />;
    default:
      return <ImageIcon className={cls} />;
  }
}
