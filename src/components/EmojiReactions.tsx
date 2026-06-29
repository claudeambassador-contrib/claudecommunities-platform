"use client";

import { SmilePlus } from "lucide-react";
import { useState } from "react";

const EMOJI_OPTIONS = [
  { emoji: "👍", name: "thumbsup" },
  { emoji: "❤️", name: "heart" },
  { emoji: "🔥", name: "fire" },
  { emoji: "👏", name: "clap" },
  { emoji: "🚀", name: "rocket" },
  { emoji: "💡", name: "bulb" },
];

interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface EmojiReactionsProps {
  postId: string;
  initialReactions?: Reaction[];
  disabled?: boolean;
}

export default function EmojiReactions({
  postId,
  initialReactions = [],
  disabled,
}: EmojiReactionsProps) {
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions);
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReaction = async (emoji: string) => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    setShowPicker(false);

    // Optimistic update
    const existingIndex = reactions.findIndex((r) => r.emoji === emoji);
    const newReactions = [...reactions];

    if (existingIndex >= 0) {
      if (newReactions[existingIndex].reacted) {
        // Remove reaction
        newReactions[existingIndex] = {
          ...newReactions[existingIndex],
          count: Math.max(0, newReactions[existingIndex].count - 1),
          reacted: false,
        };
        if (newReactions[existingIndex].count === 0) {
          newReactions.splice(existingIndex, 1);
        }
      } else {
        // Add reaction
        newReactions[existingIndex] = {
          ...newReactions[existingIndex],
          count: newReactions[existingIndex].count + 1,
          reacted: true,
        };
      }
    } else {
      // New reaction
      newReactions.push({ emoji, count: 1, reacted: true });
    }

    setReactions(newReactions);

    try {
      const res = await fetch(`/api/posts/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      if (!res.ok) {
        // Revert on error
        setReactions(reactions);
      }
    } catch {
      // Revert on error
      setReactions(reactions);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Existing Reactions */}
      {reactions.map((reaction) => (
        <button
          type="button"
          key={reaction.emoji}
          onClick={() => handleReaction(reaction.emoji)}
          disabled={disabled || isLoading}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm transition-all ${
            reaction.reacted
              ? "bg-[#D4836A]/20 border border-[#D4836A]/40 text-white"
              : "bg-white/[0.05] border border-white/[0.08] text-[#A8A29E] hover:bg-white/[0.08]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span>{reaction.emoji}</span>
          <span className="font-medium">{reaction.count}</span>
        </button>
      ))}

      {/* Add Reaction Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setShowPicker(!showPicker)}
          disabled={disabled}
          className={`p-2 rounded-full text-[#78716C] hover:text-white hover:bg-white/[0.05] transition-colors ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <SmilePlus className="w-5 h-5" />
        </button>

        {/* Emoji Picker */}
        {showPicker && (
          <>
            <button
              type="button"
              aria-label="Close emoji picker"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setShowPicker(false)}
            />
            <div className="absolute left-0 bottom-full mb-2 p-2 bg-[#2D2926] rounded-xl border border-white/[0.1] shadow-xl z-20 flex gap-1">
              {EMOJI_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.name}
                  onClick={() => handleReaction(option.emoji)}
                  className="p-2 hover:bg-white/[0.1] rounded-lg transition-colors text-xl"
                >
                  {option.emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
