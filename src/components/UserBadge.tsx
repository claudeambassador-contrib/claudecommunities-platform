"use client";

import { Crown, Shield, Star, User } from "lucide-react";

// Role badge colors
const ROLE_COLORS: Record<string, string> = {
  admin: "#EF4444",
  moderator: "#3B82F6",
  pro: "#D4836A",
  member: "#78716C",
};

// Level badge colors (using Tailwind bg classes)
const LEVEL_COLORS: Record<number, string> = {
  1: "#64748b", // slate-500
  2: "#16a34a", // green-600
  3: "#2563eb", // blue-600
  4: "#9333ea", // purple-600
  5: "#eab308", // yellow-500
  6: "#f97316", // orange-500
  7: "#ef4444", // red-500
  8: "#ec4899", // pink-500
  9: "#a855f7", // gradient approximation
};

const LEVEL_NAMES: Record<number, string> = {
  1: "Newcomer",
  2: "Explorer",
  3: "Contributor",
  4: "Active Member",
  5: "Rising Star",
  6: "Community Builder",
  7: "Expert",
  8: "Champion",
  9: "Legend",
};

interface RoleBadgeProps {
  roleName: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export function RoleBadge({ roleName, size = "sm", showIcon = false }: RoleBadgeProps) {
  const normalizedRole = roleName.toLowerCase();
  const color = ROLE_COLORS[normalizedRole] || ROLE_COLORS.member;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  const getRoleIcon = () => {
    switch (normalizedRole) {
      case "admin":
        return <Crown className={iconSizes[size]} />;
      case "moderator":
        return <Shield className={iconSizes[size]} />;
      case "pro":
        return <Star className={iconSizes[size]} />;
      default:
        return <User className={iconSizes[size]} />;
    }
  };

  const displayRole = normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {showIcon && getRoleIcon()}
      {displayRole}
    </span>
  );
}

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

export function LevelBadge({ level, size = "sm", showName = false }: LevelBadgeProps) {
  const normalizedLevel = Math.min(Math.max(level, 1), 9);
  const color = LEVEL_COLORS[normalizedLevel];
  const name = LEVEL_NAMES[normalizedLevel];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  // Special gradient for level 9
  const isLegend = normalizedLevel === 9;
  const bgStyle = isLegend
    ? { background: "linear-gradient(to right, #facc15, #ec4899, #9333ea)" }
    : { backgroundColor: color };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold text-white ${sizeClasses[size]}`}
      style={bgStyle}
    >
      Lvl {normalizedLevel}
      {showName && <span className="hidden sm:inline">- {name}</span>}
    </span>
  );
}

interface SubscriptionBadgeProps {
  tier?: string;
  size?: "sm" | "md" | "lg";
}

export function SubscriptionBadge({ tier, size = "sm" }: SubscriptionBadgeProps) {
  if (!tier || tier.toLowerCase() === "free") return null;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  // Color based on tier name
  const tierColors: Record<string, string> = {
    pro: "#D4836A",
    premium: "#F59E0B",
    enterprise: "#8B5CF6",
  };

  const color = tierColors[tier.toLowerCase()] || "#D4836A";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      <Star className={size === "sm" ? "w-3 h-3" : size === "md" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      {tier}
    </span>
  );
}

interface UserBadgesProps {
  role: string;
  level: number;
  subscriptionTier?: string;
  size?: "sm" | "md" | "lg";
  showRoleIcon?: boolean;
  showLevelName?: boolean;
}

export default function UserBadges({
  role,
  level,
  subscriptionTier,
  size = "sm",
  showRoleIcon = false,
  showLevelName = false,
}: UserBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RoleBadge roleName={role} size={size} showIcon={showRoleIcon} />
      <LevelBadge level={level} size={size} showName={showLevelName} />
      <SubscriptionBadge tier={subscriptionTier} size={size} />
    </div>
  );
}

// Export constants for use in other components
export { LEVEL_COLORS, LEVEL_NAMES, ROLE_COLORS };
