"use client";

import { Smile } from "lucide-react";
import { useEffect, useState } from "react";

const EMOJI_OPTIONS = [
  { emoji: "👍", name: "thumbsup" },
  { emoji: "❤️", name: "heart" },
  { emoji: "😂", name: "laugh" },
];

interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface CommentReactionsProps {
  commentId: string;
  disabled?: boolean;
}

export default function CommentReactions({ commentId, disabled }: CommentReactionsProps) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchReactions is a stable closure; refetch only when commentId changes
  useEffect(() => {
    fetchReactions();
  }, [commentId]);

  const fetchReactions = async () => {
    try {
      const res = await fetch(`/api/comments/${commentId}/reactions`);
      if (res.ok) {
        const data = await res.json();
        setReactions(data.reactions);
      }
    } catch (error) {
      console.error("Failed to fetch reactions:", error);
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (disabled) return;

    // Optimistic update
    setReactions((prev) => {
      const existing = prev.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.reacted) {
          // Remove reaction
          const newCount = existing.count - 1;
          if (newCount === 0) {
            return prev.filter((r) => r.emoji !== emoji);
          }
          return prev.map((r) =>
            r.emoji === emoji ? { ...r, count: newCount, reacted: false } : r,
          );
        } else {
          // Add reaction
          return prev.map((r) =>
            r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r,
          );
        }
      } else {
        // New reaction
        return [...prev, { emoji, count: 1, reacted: true }];
      }
    });

    try {
      await fetch(`/api/comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
      fetchReactions(); // Revert on error
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {/* Existing reactions */}
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => toggleReaction(reaction.emoji)}
          disabled={disabled}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all ${
            reaction.reacted
              ? "bg-[#D4836A]/20 text-[#D4836A] hover:bg-[#D4836A]/30"
              : "bg-white/[0.05] text-[#A8A29E] hover:bg-white/[0.1]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span>{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      {!disabled && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="p-1 text-[#78716C] hover:text-[#D4836A] rounded-full hover:bg-white/[0.05] transition-colors"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          {showPicker && (
            <>
              <button
                type="button"
                aria-label="Close reaction picker"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setShowPicker(false)}
              />
              <div className="absolute left-0 bottom-full mb-1 bg-[#2D2926] rounded-lg border border-white/[0.1] shadow-xl z-20 p-1 flex gap-0.5">
                {EMOJI_OPTIONS.map(({ emoji }) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      toggleReaction(emoji);
                      setShowPicker(false);
                    }}
                    className="p-1.5 hover:bg-white/[0.1] rounded-md transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
