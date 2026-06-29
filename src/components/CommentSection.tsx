"use client";

import { Reply, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getTimeAgo } from "@/lib/format";
import CommentReactions from "./CommentReactions";
import MentionInput from "./MentionInput";
import MentionText from "./MentionText";
import { RoleBadge } from "./UserBadge";
import { Avatar } from "./ui/Avatar";
import { useToast } from "./ui/Toast";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    role?: string | null;
  };
  replies: Comment[];
}

interface CommentSectionProps {
  postId: string;
  currentUserId?: string;
  userName?: string;
  userImage?: string | null;
}

export default function CommentSection({
  postId,
  currentUserId,
  userName,
  userImage,
}: CommentSectionProps) {
  const toast = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);

  const handleMentionsChange = useCallback((userIds: string[]) => {
    setMentionedUserIds(userIds);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchComments is a stable closure; refetch only when postId changes
  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting || !currentUserId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          mentionedUserIds,
          parentId: replyingTo?.id || null,
        }),
      });

      if (res.ok) {
        const newComment = await res.json();

        if (replyingTo) {
          // Add reply to the parent comment
          setComments((prevComments) => addReplyToComment(prevComments, replyingTo.id, newComment));
        } else {
          // Add as root comment
          setComments([...comments, newComment]);
        }

        setContent("");
        setMentionedUserIds([]);
        setReplyingTo(null);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add comment");
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to add a reply to nested comments
  const addReplyToComment = (
    comments: Comment[],
    parentId: string,
    newComment: Comment,
  ): Comment[] => {
    return comments.map((comment) => {
      if (comment.id === parentId) {
        return { ...comment, replies: [...comment.replies, newComment] };
      }
      if (comment.replies.length > 0) {
        return { ...comment, replies: addReplyToComment(comment.replies, parentId, newComment) };
      }
      return comment;
    });
  };

  const handleReply = (commentId: string, authorName: string) => {
    setReplyingTo({ id: commentId, name: authorName });
    setContent(`@${authorName} `);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setContent("");
  };

  // Count total comments including replies
  const countComments = (comments: Comment[]): number => {
    return comments.reduce((count, comment) => {
      return count + 1 + countComments(comment.replies);
    }, 0);
  };

  const totalCount = countComments(comments);

  return (
    <div className="space-y-5">
      {/* Comment Form */}
      {currentUserId && (
        <form onSubmit={handleSubmit} className="space-y-2">
          {replyingTo && (
            <div className="flex items-center gap-2 text-sm text-[#78716C]">
              <Reply className="w-4 h-4" />
              <span>
                Replying to <span className="text-[#D4836A]">{replyingTo.name}</span>
              </span>
              <button
                type="button"
                onClick={cancelReply}
                className="ml-auto p-1 hover:bg-white/[0.05] rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <Avatar
              src={userImage}
              name={userName}
              className="w-9 h-9 rounded-full shrink-0"
              fallbackClassName="bg-[#D4836A] text-white text-sm font-bold"
            />
            <div className="flex-1 space-y-2">
              <MentionInput
                value={content}
                onChange={setContent}
                onMentionsChange={handleMentionsChange}
                placeholder={
                  replyingTo ? "Write a reply..." : "Write a comment... Use @ to mention"
                }
                multiline
                rows={3}
                className="w-full bg-[#1C1917] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-[#78716C] text-sm focus:outline-none focus:border-[#D4836A]/50 focus:ring-1 focus:ring-[#D4836A]/20 transition-all resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!content.trim() || isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#D4836A] text-white text-sm font-medium hover:bg-[#c4775f] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-200 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Sending..." : "Comment"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="text-center py-6">
          <div className="w-6 h-6 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : totalCount === 0 ? (
        <p className="text-[#78716C] text-sm text-center py-6">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onReply={handleReply}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentThreadProps {
  comment: Comment;
  currentUserId?: string;
  onReply: (commentId: string, authorName: string) => void;
  depth: number;
}

function CommentThread({ comment, currentUserId, onReply, depth }: CommentThreadProps) {
  const maxDepth = 3; // Maximum nesting level
  const isNested = depth > 0;

  return (
    <div className={`${isNested ? "ml-8 mt-3" : ""}`}>
      <div className="flex gap-3 group">
        {/* Left connector line for nested comments */}
        {isNested && (
          <div className="absolute -ml-4 w-4 h-4 border-l-2 border-b-2 border-white/[0.1] rounded-bl-lg" />
        )}
        <div className="relative">
          <TenantLink href={`/community/profile/${comment.author.id}`}>
            <Avatar
              src={comment.author.image}
              name={comment.author.name}
              className={`${isNested ? "w-7 h-7" : "w-9 h-9"} rounded-full hover:ring-2 hover:ring-[#D4836A]/50 hover:scale-105 transition-all duration-200`}
              fallbackClassName={`bg-[#D4836A]/80 text-white font-bold ${isNested ? "text-xs" : "text-sm"}`}
            />
          </TenantLink>
        </div>
        <div className="flex-1 pb-1">
          <div className="bg-[#1C1917] rounded-xl px-4 py-3 hover:bg-[#1C1917]/80 transition-colors duration-200">
            <div className="flex items-center gap-2 mb-1.5">
              <TenantLink
                href={`/community/profile/${comment.author.id}`}
                className="font-semibold text-sm text-white hover:text-[#D4836A] transition-colors"
              >
                {comment.author.name || "Anonymous"}
              </TenantLink>
              {comment.author.role?.toLowerCase() === "admin" && (
                <RoleBadge roleName="admin" size="sm" />
              )}
              <span className="text-xs text-[#78716C]">
                {getTimeAgo(comment.createdAt, "short")}
              </span>
            </div>
            <p className="text-[#E7E5E4] text-sm leading-relaxed">
              <MentionText content={comment.content} />
            </p>
            <div className="flex items-center gap-3 mt-2">
              <CommentReactions commentId={comment.id} disabled={!currentUserId} />
              {currentUserId && depth < maxDepth && (
                <button
                  type="button"
                  onClick={() => onReply(comment.id, comment.author.name || "Anonymous")}
                  className="flex items-center gap-1 text-xs text-[#78716C] hover:text-[#D4836A] transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Render replies */}
      {comment.replies.length > 0 && (
        <div className="relative">
          {/* Vertical line connecting to replies */}
          <div className="absolute left-4 top-0 bottom-4 w-px bg-white/[0.06]" />
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
