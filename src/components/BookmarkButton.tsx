"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";

interface BookmarkButtonProps {
  postId: string;
  disabled?: boolean;
  initialBookmarked?: boolean;
}

export default function BookmarkButton({
  postId,
  disabled = false,
  initialBookmarked,
}: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked ?? false);
  const [isLoading, setIsLoading] = useState(!initialBookmarked);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (initialBookmarked !== undefined) {
      setIsBookmarked(initialBookmarked);
      setIsLoading(false);
      return;
    }

    const checkBookmark = async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/bookmark`);
        if (res.ok) {
          const data = await res.json();
          setIsBookmarked(data.isBookmarked);
        }
      } catch (error) {
        console.error("Failed to check bookmark:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkBookmark();
  }, [postId, initialBookmarked]);

  const toggleBookmark = async () => {
    if (disabled || isLoading) return;

    // Trigger animation when bookmarking
    if (!isBookmarked) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    }

    // Optimistic update
    setIsBookmarked(!isBookmarked);

    try {
      const res = await fetch(`/api/posts/${postId}/bookmark`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setIsBookmarked(data.isBookmarked);
      } else {
        // Revert on error
        setIsBookmarked(isBookmarked);
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
      setIsBookmarked(isBookmarked);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleBookmark}
      disabled={disabled || isLoading}
      className={`p-2 rounded-lg transition-all duration-200 ${
        isBookmarked
          ? "text-[#D4836A] bg-[#D4836A]/10 hover:bg-[#D4836A]/15"
          : "text-[#78716C] hover:text-[#D4836A] hover:bg-white/[0.03]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      title={isBookmarked ? "Remove bookmark" : "Bookmark post"}
    >
      <Bookmark
        className={`w-5 h-5 transition-transform duration-300 ${
          isBookmarked ? "fill-current" : ""
        } ${isAnimating ? "scale-110" : ""}`}
      />
    </button>
  );
}
