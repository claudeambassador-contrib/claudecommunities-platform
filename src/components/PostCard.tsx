"use client";

import {
  Download,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Play,
  Share2,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { TenantLink, useTenantBase } from "@/components/TenantBaseProvider";
import { formatFileSize, getTimeAgo } from "@/lib/format";
import { tenantHref } from "@/lib/tenant-base";
import { extractFirstUrl } from "@/lib/url-utils";
import BookmarkButton from "./BookmarkButton";
import EmojiReactions from "./EmojiReactions";
import LessonContent from "./LessonContent";
import LikeButton from "./LikeButton";
import LinkPreview from "./LinkPreview";
import MentionText from "./MentionText";
import OnlineIndicator from "./OnlineIndicator";
import PollDisplay from "./PollDisplay";
import { RoleBadge } from "./UserBadge";
import { Avatar } from "./ui/Avatar";
import ConfirmDialog from "./ui/ConfirmDialog";
import { getFileIcon } from "./ui/fileIcons";
import { RemoteImage } from "./ui/RemoteImage";
import { useToast } from "./ui/Toast";

interface CommentPreview {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    role?: string | null;
  };
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

interface Post {
  id: string;
  title: string | null;
  content: string;
  image?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  isPinned: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    tagline?: string | null;
    role?: string | null;
    badges?: { id: string; name: string; icon: string | null; color: string | null }[];
  };
  space: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  };
  _count: {
    likes: number;
    comments: number;
  };
  isLiked?: boolean;
  pollId?: string | null;
  attachments?: Attachment[];
  commentsPreview?: CommentPreview[];
}

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  isAdmin?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onClick?: () => void;
}

function truncateContent(
  content: string,
  maxLength: number = 280,
): { text: string; isTruncated: boolean } {
  if (content.length <= maxLength) {
    return { text: content, isTruncated: false };
  }
  const truncated = content.substring(0, maxLength).trim();
  const lastSpace = truncated.lastIndexOf(" ");
  return {
    text: lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated,
    isTruncated: true,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: presentational component with many conditional render branches; extraction risks behavior change
export default function PostCard({
  post,
  currentUserId,
  isAdmin = false,
  onDelete,
  onEdit,
  onClick,
}: PostCardProps) {
  const toast = useToast();
  const base = useTenantBase();
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isPinned, setIsPinned] = useState(post.isPinned);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isOwner = currentUserId === post.author.id;
  const canEdit = isOwner || isAdmin;
  const timeAgo = getTimeAgo(post.createdAt);
  const { text: truncatedContent, isTruncated } = truncateContent(post.content);
  const displayContent = isExpanded ? post.content : truncatedContent;
  const hasCoverImage = post.mediaUrl && post.mediaType === "image";
  const firstUrl = extractFirstUrl(post.content);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onDelete?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete post");
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
      setShowMenu(false);
    }
  };

  const handlePin = async () => {
    setIsPinning(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !isPinned }),
      });

      if (res.ok) {
        setIsPinned(!isPinned);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to pin post");
      }
    } catch (error) {
      console.error("Failed to pin post:", error);
      toast.error("Failed to pin post");
    } finally {
      setIsPinning(false);
      setShowMenu(false);
    }
  };

  const handleShare = async () => {
    const postUrl = `${window.location.origin}${tenantHref(base, `/community/posts/${post.id}`)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || "Check out this post",
          text: post.content.substring(0, 100),
          url: postUrl,
        });
      } catch (_err) {
        // User cancelled or share failed, fallback to clipboard
        copyToClipboard(postUrl);
      }
    } else {
      copyToClipboard(postUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard!");
  };

  return (
    <article
      className={`relative bg-[#2D2926] rounded-2xl border transition-all duration-300 group overflow-hidden ${
        isPinned
          ? "border-[#D4836A]/30 shadow-lg shadow-[#D4836A]/5 ring-1 ring-[#D4836A]/10"
          : "border-white/[0.06] hover:border-[#D4836A]/20 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
      }`}
    >
      {/* Cover Image */}
      {hasCoverImage && (
        // biome-ignore lint/a11y/useSemanticElements: wraps a <Link> in the non-onClick branch — a native <button> can't nest an anchor
        <div
          className="block cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            if (onClick) {
              e.preventDefault();
              onClick();
            }
          }}
          onKeyDown={(e) => {
            if (onClick && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onClick();
            }
          }}
        >
          {onClick ? (
            <div
              className="relative w-full bg-black flex items-center justify-center overflow-hidden"
              style={{ maxHeight: "500px" }}
            >
              <RemoteImage
                src={post.mediaUrl || ""}
                alt=""
                className="w-full h-auto max-h-[500px] object-contain transition-transform duration-500 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#2D2926] via-transparent to-transparent opacity-40" />
            </div>
          ) : (
            <TenantLink href={`/community/posts/${post.id}`} className="block">
              <div className="relative w-full h-48 sm:h-56 overflow-hidden">
                <RemoteImage
                  src={post.mediaUrl || ""}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2D2926] via-transparent to-transparent opacity-60" />
              </div>
            </TenantLink>
          )}
        </div>
      )}

      {/* Pinned Banner */}
      {isPinned && (
        <div
          className={`flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#D4836A]/15 to-transparent border-b border-[#D4836A]/10 ${hasCoverImage ? "" : "rounded-t-2xl"}`}
        >
          <Pin className="w-4 h-4 text-[#D4836A]" />
          <span className="text-sm font-medium text-[#D4836A]">Pinned post</span>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3.5">
            {/* Author Avatar */}
            <TenantLink href={`/community/profile/${post.author.id}`} className="relative shrink-0">
              <Avatar
                src={post.author.image}
                name={post.author.name}
                className="w-12 h-12 rounded-full hover:ring-[#D4836A]/50 transition-all duration-200 hover:scale-105"
                imgClassName="ring-2 ring-white/10"
                fallbackClassName="bg-gradient-to-br from-[#D4836A] to-[#B66B54] text-white font-bold text-lg hover:ring-2 shadow-lg shadow-black/20"
              />
              <OnlineIndicator userId={post.author.id} size="md" />
            </TenantLink>

            {/* Author Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <TenantLink
                  href={`/community/profile/${post.author.id}`}
                  className="font-semibold text-white hover:text-[#D4836A] transition-colors truncate"
                >
                  {post.author.name || "Anonymous"}
                </TenantLink>
                {post.author.role?.toLowerCase() === "admin" && (
                  <RoleBadge roleName="admin" size="sm" />
                )}
                {post.author.badges &&
                  post.author.badges.length > 0 &&
                  post.author.badges.map((badge) => (
                    <span
                      key={badge.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${badge.color}20`, color: badge.color || "#fff" }}
                      title={badge.name}
                    >
                      <span>{badge.icon}</span>
                      {badge.name}
                    </span>
                  ))}
              </div>

              {/* Tagline */}
              {post.author.tagline && (
                <p className="text-sm text-[#A8A29E] truncate max-w-[200px] sm:max-w-xs">
                  {post.author.tagline}
                </p>
              )}

              {/* Timestamp and Space Badge */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-[#78716C]">{timeAgo}</span>
                <span className="text-[#57534E]">in</span>
                <TenantLink
                  href={`/community?space=${post.space.slug}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    backgroundColor: `${post.space.color || "#D4836A"}15`,
                    color: post.space.color || "#D4836A",
                    border: `1px solid ${post.space.color || "#D4836A"}30`,
                  }}
                >
                  {post.space.name}
                </TenantLink>
              </div>
            </div>
          </div>

          {/* Menu */}
          {canEdit && (
            <div className="relative opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {showMenu && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-[#1C1917] rounded-xl border border-white/[0.1] shadow-xl z-20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onEdit?.();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handlePin}
                        disabled={isPinning}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#D4836A] hover:bg-[#D4836A]/10 transition-colors disabled:opacity-50"
                      >
                        <Pin className="w-4 h-4" />
                        {isPinning ? "..." : isPinned ? "Unpin" : "Pin post"}
                      </button>
                    )}
                    {(isOwner || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          setConfirmDelete(true);
                        }}
                        disabled={isDeleting}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="group/content">
          {/* biome-ignore lint/a11y/useSemanticElements: wraps a <Link> in the non-onClick branch — a native <button> can't nest an anchor */}
          <div
            className="block cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              if (onClick) {
                e.preventDefault();
                onClick();
              }
            }}
            onKeyDown={(e) => {
              if (onClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onClick();
              }
            }}
          >
            {onClick ? (
              post.title && (
                <h3 className="text-xl font-semibold text-white mb-2 group-hover/content:text-[#D4836A] transition-colors leading-tight">
                  {post.title}
                </h3>
              )
            ) : (
              <TenantLink href={`/community/posts/${post.id}`} className="block">
                {post.title && (
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover/content:text-[#D4836A] transition-colors leading-tight">
                    {post.title}
                  </h3>
                )}
              </TenantLink>
            )}
          </div>
          <div className="text-[#E7E5E4] leading-relaxed">
            <LessonContent content={displayContent} />
            {isTruncated && !isExpanded && (
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="text-[#D4836A] hover:text-[#E8A090] font-medium ml-1 transition-colors"
              >
                Read more
              </button>
            )}
          </div>

          {/* Link Preview */}
          {firstUrl && !hasCoverImage && <LinkPreview url={firstUrl} />}
        </div>

        {/* Media Preview (if not cover image) */}
        {post.mediaUrl && !hasCoverImage && (
          // biome-ignore lint/a11y/useSemanticElements: wraps a <Link> in the non-onClick branch — a native <button> can't nest an anchor
          <div
            className="block mt-4 cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              if (onClick) {
                e.preventDefault();
                e.stopPropagation();
                onClick();
              }
            }}
            onKeyDown={(e) => {
              if (onClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onClick();
              }
            }}
          >
            {onClick ? (
              <div className="relative rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
                {post.mediaType === "video" ? (
                  <div className="relative w-full">
                    <video
                      ref={videoRef}
                      src={`${post.mediaUrl || ""}#t=0.1`}
                      className="w-full max-h-[500px] object-contain bg-black"
                      preload="metadata"
                      playsInline
                      controls={isVideoPlaying}
                      onClick={(e) => e.stopPropagation()}
                      onPlay={() => setIsVideoPlaying(true)}
                      onPause={() => setIsVideoPlaying(false)}
                      onEnded={() => setIsVideoPlaying(false)}
                    >
                      <track kind="captions" srcLang="en" src="" default />
                    </video>
                    {!isVideoPlaying && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (videoRef.current) {
                            videoRef.current.play();
                            setIsVideoPlaying(true);
                          }
                        }}
                        className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                      >
                        <div className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-xl">
                          <Play className="w-8 h-8 text-[#1C1917] ml-1" fill="currentColor" />
                        </div>
                      </button>
                    )}
                  </div>
                ) : (
                  <RemoteImage
                    src={post.mediaUrl || ""}
                    alt=""
                    className="w-full max-h-[500px] object-contain"
                  />
                )}
              </div>
            ) : (
              <TenantLink href={`/community/posts/${post.id}`} className="block">
                <div className="relative rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
                  {post.mediaType === "video" ? (
                    <video
                      src={`${post.mediaUrl || ""}#t=0.1`}
                      className="w-full max-h-[500px] object-contain bg-black"
                      controls
                      preload="metadata"
                      playsInline
                    >
                      <track kind="captions" srcLang="en" src="" default />
                    </video>
                  ) : (
                    <RemoteImage
                      src={post.mediaUrl || ""}
                      alt=""
                      className="w-full max-h-[500px] object-contain"
                    />
                  )}
                </div>
              </TenantLink>
            )}
          </div>
        )}

        {/* Poll */}
        {post.pollId && (
          <div className="mt-4">
            <PollDisplay pollId={post.pollId} disabled={!currentUserId} />
          </div>
        )}

        {/* Attachments */}
        {post.attachments && post.attachments.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-[#78716C] mb-2">
              <Paperclip className="w-4 h-4" />
              <span>
                {post.attachments.length} attachment{post.attachments.length > 1 ? "s" : ""}
              </span>
            </div>
            {post.attachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.type);
              return (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  download={attachment.name}
                  className="flex items-center gap-3 p-3 bg-[#1C1917] rounded-lg border border-white/[0.06] hover:border-[#D4836A]/30 transition-colors group/att"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#2D2926] flex items-center justify-center shrink-0">
                    <FileIcon className="w-5 h-5 text-[#D4836A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate group-hover/att:text-[#D4836A] transition-colors">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-[#78716C]">{formatFileSize(attachment.size)}</p>
                  </div>
                  <Download className="w-4 h-4 text-[#78716C] group-hover/att:text-[#D4836A] transition-colors" />
                </a>
              );
            })}
          </div>
        )}

        {/* Emoji Reactions */}
        <div className="mt-4">
          <EmojiReactions postId={post.id} disabled={!currentUserId} />
        </div>

        {/* Comments Preview */}
        {post.commentsPreview && post.commentsPreview.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
            {post.commentsPreview.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3">
                <TenantLink href={`/community/profile/${comment.author.id}`} className="shrink-0">
                  <Avatar
                    src={comment.author.image}
                    name={comment.author.name}
                    className="w-8 h-8 rounded-full"
                    fallbackClassName="bg-gradient-to-br from-[#78716C] to-[#57534E] text-white text-sm font-medium"
                  />
                </TenantLink>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <TenantLink
                      href={`/community/profile/${comment.author.id}`}
                      className="font-medium text-white text-sm hover:text-[#D4836A] transition-colors"
                    >
                      {comment.author.name || "Anonymous"}
                    </TenantLink>
                    {comment.author.role?.toLowerCase() === "admin" && (
                      <RoleBadge roleName="admin" size="sm" />
                    )}
                    <span className="text-xs text-[#78716C]">{getTimeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[#A8A29E] line-clamp-2 mt-0.5">
                    <MentionText content={comment.content} />
                  </p>
                </div>
              </div>
            ))}
            {post._count.comments > 2 &&
              (onClick ? (
                <button
                  type="button"
                  onClick={onClick}
                  className="block text-sm text-[#D4836A] hover:text-[#E8A090] font-medium transition-colors"
                >
                  View all {post._count.comments} comments
                </button>
              ) : (
                <TenantLink
                  href={`/community/posts/${post.id}`}
                  className="block text-sm text-[#D4836A] hover:text-[#E8A090] font-medium transition-colors"
                >
                  View all {post._count.comments} comments
                </TenantLink>
              ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-1">
            <LikeButton
              postId={post.id}
              initialLiked={post.isLiked || false}
              initialCount={post._count.likes}
              disabled={!currentUserId}
            />
            {onClick ? (
              <button
                type="button"
                onClick={onClick}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#78716C] hover:text-[#D4836A] hover:bg-white/[0.03] rounded-lg transition-all duration-200"
              >
                <MessageCircle className="w-[18px] h-[18px]" />
                <span className="font-medium">{post._count.comments}</span>
              </button>
            ) : (
              <TenantLink
                href={`/community/posts/${post.id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#78716C] hover:text-[#D4836A] hover:bg-white/[0.03] rounded-lg transition-all duration-200"
              >
                <MessageCircle className="w-[18px] h-[18px]" />
                <span className="font-medium">{post._count.comments}</span>
              </TenantLink>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[#78716C] hover:text-[#D4836A] hover:bg-white/[0.03] rounded-lg transition-all duration-200"
              title="Share post"
            >
              <Share2 className="w-[18px] h-[18px]" />
            </button>
          </div>
          <BookmarkButton postId={post.id} disabled={!currentUserId} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post?"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}
