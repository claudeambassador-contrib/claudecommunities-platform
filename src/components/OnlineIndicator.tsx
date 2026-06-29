"use client";

import { useOnlineStatus } from "./OnlineStatusProvider";

interface OnlineIndicatorProps {
  userId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function OnlineIndicator({
  userId,
  size = "md",
  className = "",
}: OnlineIndicatorProps) {
  const { isOnline } = useOnlineStatus();

  if (!isOnline(userId)) return null;

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  return (
    <span
      className={`absolute bottom-0 right-0 ${sizeClasses[size]} bg-green-500 rounded-full border-2 border-[#2D2926] ${className}`}
      title="Online"
    />
  );
}
