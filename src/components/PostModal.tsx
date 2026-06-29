"use client";

import { MessageCircle, Play, Share2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { TenantLink, useTenantBase } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { getTimeAgo } from "@/lib/format";
import { tenantHref } from "@/lib/tenant-base";
import { extractFirstUrl } from "@/lib/url-utils";
import BookmarkButton from "./BookmarkButton";
import CommentSection from "./CommentSection";
import EmojiReactions from "./EmojiReactions";
import LessonContent from "./LessonContent";
import LikeButton from "./LikeButton";
import LinkPreview from "./LinkPreview";

interface Post {
  id: string;
  title: string | null;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  isPinned: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    tagline?: string | null;
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
}

interface PostModalProps {
  post: Post;
  currentUserId?: string;
  userName?: string;
  userImage?: string | null;
  onClose: () => void;
}

export default function PostModal({
  post,
  currentUserId,
  userName,
  userImage,
  onClose,
}: PostModalProps) {
  const base = useTenantBase();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasMedia = post.mediaUrl && (post.mediaType === "image" || post.mediaType === "video");
  const firstUrl = extractFirstUrl(post.content);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handlePlayVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsVideoPlaying(true);
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
        copyToClipboard(postUrl);
      }
    } else {
      copyToClipboard(postUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Modal Content */}
      <div className="relative z-10 flex w-full max-w-6xl h-[90vh] mx-4">
        {/* Media Section (left side on desktop) */}
        {hasMedia && (
          <div className="hidden md:flex flex-1 items-center justify-center bg-black rounded-l-2xl overflow-hidden">
            {post.mediaType === "video" ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={post.mediaUrl || ""}
                  className="max-w-full max-h-full object-contain"
                  controls={isVideoPlaying}
                  onEnded={() => setIsVideoPlaying(false)}
                  onPause={() => setIsVideoPlaying(false)}
                  onPlay={() => setIsVideoPlaying(true)}
                >
                  <track kind="captions" srcLang="en" src="" default />
                </video>
                {!isVideoPlaying && (
                  <button
                    type="button"
                    onClick={handlePlayVideo}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
                  >
                    <div className="w-20 h-20 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center transition-colors shadow-2xl">
                      <Play className="w-10 h-10 text-[#1C1917] ml-1" fill="currentColor" />
                    </div>
                  </button>
                )}
              </div>
            ) : (
              <RemoteImage
                src={post.mediaUrl || ""}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        )}

        {/* Content Section (right side on desktop, full on mobile) */}
        <div
          className={`flex flex-col bg-[#1C1917] overflow-hidden ${hasMedia ? "md:w-[400px] md:rounded-r-2xl" : "w-full max-w-2xl mx-auto rounded-2xl"}`}
        >
          {/* Mobile Media */}
          {hasMedia && (
            <div className="md:hidden w-full max-h-[40vh] bg-black overflow-hidden">
              {post.mediaType === "video" ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    src={post.mediaUrl || ""}
                    className="max-w-full max-h-full object-contain"
                    controls
                    playsInline
                  >
                    <track kind="captions" srcLang="en" src="" default />
                  </video>
                </div>
              ) : (
                <RemoteImage
                  src={post.mediaUrl || ""}
                  alt=""
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          )}

          {/* Post Header */}
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <TenantLink href={`/community/profile/${post.author.id}`} onClick={onClose}>
                {post.author.image ? (
                  <Image
                    src={post.author.image}
                    alt={post.author.name || ""}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4836A] to-[#B66B54] flex items-center justify-center text-white font-bold">
                    {post.author.name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </TenantLink>
              <div className="flex-1 min-w-0">
                <TenantLink
                  href={`/community/profile/${post.author.id}`}
                  onClick={onClose}
                  className="font-semibold text-white hover:text-[#D4836A] transition-colors block truncate"
                >
                  {post.author.name || "Anonymous"}
                </TenantLink>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[#78716C]">{getTimeAgo(post.createdAt, "short")}</span>
                  <span className="text-[#57534E]">•</span>
                  <TenantLink
                    href={`/community?space=${post.space.slug}`}
                    onClick={onClose}
                    className="text-[#A8A29E] hover:text-white transition-colors truncate"
                  >
                    {post.space.name}
                  </TenantLink>
                </div>
              </div>
            </div>
          </div>

          {/* Post Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              {post.title && (
                <h2 className="text-xl font-semibold text-white mb-2">{post.title}</h2>
              )}
              <div className="text-[#E7E5E4] leading-relaxed">
                <LessonContent content={post.content} />
              </div>

              {/* Link Preview */}
              {firstUrl && <LinkPreview url={firstUrl} />}

              {/* Reactions */}
              <div className="mt-4">
                <EmojiReactions postId={post.id} disabled={!currentUserId} />
              </div>
            </div>

            {/* Comments Section */}
            <div className="p-4 border-t border-white/[0.06]">
              <h3 className="font-semibold text-white mb-4">Comments ({post._count.comments})</h3>
              <CommentSection
                postId={post.id}
                currentUserId={currentUserId || ""}
                userName={userName || "User"}
                userImage={userImage}
              />
            </div>
          </div>

          {/* Actions Footer */}
          <div className="p-4 border-t border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-1">
              <LikeButton
                postId={post.id}
                initialLiked={post.isLiked || false}
                initialCount={post._count.likes}
                disabled={!currentUserId}
              />
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#78716C]"
              >
                <MessageCircle className="w-[18px] h-[18px]" />
                <span className="font-medium">{post._count.comments}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#78716C] hover:text-[#D4836A] transition-colors"
              >
                <Share2 className="w-[18px] h-[18px]" />
              </button>
            </div>
            <BookmarkButton postId={post.id} disabled={!currentUserId} />
          </div>
        </div>
      </div>

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#2D2926] text-white text-sm rounded-lg shadow-xl border border-white/[0.1] z-50">
          Link copied to clipboard!
        </div>
      )}
    </div>
  );
}
