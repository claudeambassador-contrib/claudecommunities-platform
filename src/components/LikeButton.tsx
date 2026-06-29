"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

interface LikeButtonProps {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  disabled?: boolean;
}

export default function LikeButton({
  postId,
  initialLiked,
  initialCount,
  disabled,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = async () => {
    if (disabled || isLoading) return;

    // Trigger animation
    if (!liked) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    }

    // Optimistic update
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
      });

      if (!res.ok) {
        // Revert on error
        setLiked(liked);
        setCount(count);
      }
    } catch (error) {
      // Revert on error
      setLiked(liked);
      setCount(count);
      console.error("Failed to toggle like:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
        liked
          ? "text-red-500 hover:bg-red-500/10"
          : "text-[#78716C] hover:text-red-500 hover:bg-white/[0.03]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <Heart
        className={`w-[18px] h-[18px] transition-transform duration-300 ${
          liked ? "fill-current" : ""
        } ${isAnimating ? "scale-125" : ""}`}
      />
      <span className="font-medium">{count}</span>
    </button>
  );
}
