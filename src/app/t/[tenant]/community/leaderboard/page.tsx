export const dynamic = "force-dynamic";

import { Crown, Medal, Trophy, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RoleBadge } from "@/components/UserBadge";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantId } from "@/lib/tenant-context";

// Level configuration with icons, colors, and min points
const LEVEL_CONFIG = [
  { level: 1, name: "Community Ally", color: "#6B7280", icon: "🤝", minPoints: 0 },
  { level: 2, name: "Rising Star", color: "#CD7F32", icon: "⭐", minPoints: 100 },
  { level: 3, name: "Trailblazer", color: "#C0C0C0", icon: "🔥", minPoints: 300 },
  { level: 4, name: "Champion", color: "#FFD700", icon: "🏆", minPoints: 600 },
  { level: 5, name: "Leader", color: "#8B5CF6", icon: "👑", minPoints: 1000 },
  { level: 6, name: "Mentor", color: "#3B82F6", icon: "🎓", minPoints: 1500 },
  { level: 7, name: "Ambassador", color: "#14B8A6", icon: "🌟", minPoints: 2500 },
  { level: 8, name: "Legend", color: "#D4836A", icon: "💎", minPoints: 4000 },
  { level: 9, name: "Hero", color: "rainbow", icon: "🦸", minPoints: 6000 },
];

type TimePeriod = "all" | "month" | "week" | "today";

async function getLeaderboardData(period: TimePeriod, currentUserId: string) {
  const prisma = await getPrisma();
  const tenantId = await getTenantId();
  if (period === "all") {
    // All-time: use stored points. User is GLOBAL — restrict to this tenant's
    // members via the membership join (the chokepoint does not scope User).
    const users = await prisma.user.findMany({
      where: { isBanned: false, tenantMemberships: { some: { tenantId } } },
      select: {
        id: true,
        name: true,
        image: true,
        tagline: true,
        points: true,
        level: true,
        role: true,
      },
      orderBy: { points: "desc" },
      take: 100,
    });
    const currentUserRank = users.findIndex((u) => u.id === currentUserId) + 1;
    return { users, currentUserRank: currentUserRank > 0 ? currentUserRank : null };
  }

  // Calculate period start date
  const now = new Date();
  let since: Date;
  if (period === "today") {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "week") {
    since = new Date(now);
    since.setDate(now.getDate() - 7);
  } else {
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Get all non-banned MEMBERS of this tenant with their period activity. User
  // is GLOBAL, so both the list (membership join) AND every scoped-relation
  // count/select reached through it must carry `tenantId` — otherwise the
  // period score sums a user's activity across every tenant they belong to.
  const users = await prisma.user.findMany({
    where: { isBanned: false, tenantMemberships: { some: { tenantId } } },
    select: {
      id: true,
      name: true,
      image: true,
      tagline: true,
      points: true,
      level: true,
      role: true,
      _count: {
        select: {
          posts: { where: { createdAt: { gte: since }, tenantId } },
          comments: { where: { createdAt: { gte: since }, tenantId } },
          userBadges: { where: { awardedAt: { gte: since }, tenantId } },
          eventRsvps: { where: { createdAt: { gte: since }, status: "going", tenantId } },
        },
      },
      posts: {
        where: { createdAt: { gte: since }, tenantId },
        select: {
          _count: { select: { likes: true } },
        },
      },
    },
  });

  // Calculate period points: posts=10, comments=5, likes received=2, badges=20, RSVPs=25
  const scored = users
    .map((u) => {
      const likesReceived = u.posts.reduce((sum, p) => sum + p._count.likes, 0);
      const periodPoints =
        u._count.posts * 10 +
        u._count.comments * 5 +
        likesReceived * 2 +
        u._count.userBadges * 20 +
        u._count.eventRsvps * 25;
      return {
        id: u.id,
        name: u.name,
        image: u.image,
        tagline: u.tagline,
        points: periodPoints,
        level: u.level,
        role: u.role,
      };
    })
    .filter((u) => u.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 100);

  const currentUserRank = scored.findIndex((u) => u.id === currentUserId) + 1;
  return { users: scored, currentUserRank: currentUserRank > 0 ? currentUserRank : null };
}

function getLevelConfig(level: number) {
  return LEVEL_CONFIG.find((l) => l.level === level) || LEVEL_CONFIG[0];
}

function getNextLevelConfig(level: number) {
  return LEVEL_CONFIG.find((l) => l.level === level + 1);
}

function calculateProgress(points: number, currentLevel: number): number {
  const currentConfig = getLevelConfig(currentLevel);
  const nextConfig = getNextLevelConfig(currentLevel);

  if (!nextConfig) return 100; // Max level

  const pointsInLevel = points - currentConfig.minPoints;
  const pointsNeeded = nextConfig.minPoints - currentConfig.minPoints;

  return Math.min(100, Math.round((pointsInLevel / pointsNeeded) * 100));
}

function LevelBadge({ level, size = "md" }: { level: number; size?: "sm" | "md" | "lg" }) {
  const config = getLevelConfig(level);
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  const isRainbow = config.color === "rainbow";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${sizeClasses[size]} ${
        isRainbow
          ? "bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 text-white"
          : ""
      }`}
      style={!isRainbow ? { backgroundColor: `${config.color}20`, color: config.color } : {}}
    >
      <span>{config.icon}</span>
      <span>{config.name}</span>
    </span>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const params = await searchParams;
  const period = (params.period || "all") as TimePeriod;
  const currentUserId = user.id;

  const { users, currentUserRank } = await getLeaderboardData(period, currentUserId);

  const periods: { key: TimePeriod; label: string }[] = [
    { key: "all", label: "All Time" },
    { key: "month", label: "This Month" },
    { key: "week", label: "This Week" },
    { key: "today", label: "Today" },
  ];

  // How points are earned
  const pointsInfo = [
    { action: "Create a post", points: 10, icon: "📝" },
    { action: "Receive a like", points: 2, icon: "❤️" },
    { action: "Leave a comment", points: 5, icon: "💬" },
    { action: "Get a reply", points: 3, icon: "↩️" },
    { action: "Complete a course", points: 50, icon: "🎓" },
    { action: "Attend an event", points: 25, icon: "📅" },
    { action: "Earn a badge", points: 20, icon: "🏅" },
    { action: "Daily login streak", points: 5, icon: "🔥" },
  ];

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4836A] to-[#B66B54] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
              <p className="text-[#A8A29E]">Compete with fellow community members</p>
            </div>
          </div>
        </div>

        {/* Time Period Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {periods.map((p) => (
            <TenantLink
              key={p.key}
              href={`/community/leaderboard${p.key !== "all" ? `?period=${p.key}` : ""}`}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                period === p.key
                  ? "bg-[#D4836A] text-white"
                  : "bg-[#2D2926] text-[#A8A29E] hover:bg-[#3D3936] hover:text-white"
              }`}
            >
              {p.label}
            </TenantLink>
          ))}
        </div>

        {/* Current User Position Banner */}
        {currentUserRank && (
          <div className="bg-gradient-to-r from-[#D4836A]/20 to-transparent rounded-2xl p-5 mb-6 border border-[#D4836A]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#D4836A]/20 flex items-center justify-center text-[#D4836A] font-bold text-xl">
                  #{currentUserRank}
                </div>
                <div>
                  <p className="text-[#A8A29E] text-sm">Your Current Rank</p>
                  <p className="text-white font-semibold">
                    {currentUserRank <= 3
                      ? "Amazing! You're in the top 3!"
                      : currentUserRank <= 10
                        ? "Great job! Top 10!"
                        : currentUserRank <= 50
                          ? "Keep going! You're doing great!"
                          : "Every point counts!"}
                  </p>
                </div>
              </div>
              <TenantLink
                href={`/community/profile/${currentUserId}`}
                className="px-4 py-2 bg-[#D4836A] text-white rounded-xl text-sm font-medium hover:bg-[#C4735A] transition-colors"
              >
                View Profile
              </TenantLink>
            </div>
          </div>
        )}

        {/* Leaderboard List */}
        <div className="bg-gradient-to-br from-[#2D2926] to-[#252220] rounded-2xl border border-white/[0.06] overflow-hidden mb-8">
          {/* Top 3 Podium */}
          {users.length >= 3 && (
            <div className="p-6 border-b border-white/[0.06]">
              <div className="flex items-end justify-center gap-4">
                {/* 2nd Place */}
                <div className="flex flex-col items-center w-28">
                  <div className="relative mb-2">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#C0C0C0] to-[#A0A0A0] flex items-center justify-center text-white font-bold text-xl border-4 border-[#C0C0C0]/30">
                      {users[1].image ? (
                        <RemoteImage
                          src={users[1].image}
                          alt={users[1].name || ""}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        users[1].name?.[0]?.toUpperCase() || "?"
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#C0C0C0] flex items-center justify-center text-[#1C1917] font-bold text-sm">
                      2
                    </div>
                  </div>
                  <p className="text-white font-medium text-sm text-center truncate w-full">
                    {users[1].name}
                  </p>
                  {users[1].role?.toLowerCase() === "admin" && (
                    <div className="mt-1">
                      <RoleBadge roleName="admin" size="sm" />
                    </div>
                  )}
                  <p className="text-[#78716C] text-xs">{users[1].points.toLocaleString()} pts</p>
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center w-32">
                  <div className="relative mb-2">
                    <Crown className="w-8 h-8 text-[#FFD700] absolute -top-6 left-1/2 -translate-x-1/2" />
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center text-white font-bold text-2xl border-4 border-[#FFD700]/30 ring-4 ring-[#FFD700]/20">
                      {users[0].image ? (
                        <RemoteImage
                          src={users[0].image}
                          alt={users[0].name || ""}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        users[0].name?.[0]?.toUpperCase() || "?"
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#FFD700] flex items-center justify-center text-[#1C1917] font-bold text-base">
                      1
                    </div>
                  </div>
                  <p className="text-white font-semibold text-center truncate w-full">
                    {users[0].name}
                  </p>
                  {users[0].role?.toLowerCase() === "admin" && (
                    <div className="mt-1">
                      <RoleBadge roleName="admin" size="sm" />
                    </div>
                  )}
                  <p className="text-[#FFD700] text-sm font-medium">
                    {users[0].points.toLocaleString()} pts
                  </p>
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center w-28">
                  <div className="relative mb-2">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#CD7F32] to-[#8B4513] flex items-center justify-center text-white font-bold text-xl border-4 border-[#CD7F32]/30">
                      {users[2].image ? (
                        <RemoteImage
                          src={users[2].image}
                          alt={users[2].name || ""}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        users[2].name?.[0]?.toUpperCase() || "?"
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#CD7F32] flex items-center justify-center text-white font-bold text-sm">
                      3
                    </div>
                  </div>
                  <p className="text-white font-medium text-sm text-center truncate w-full">
                    {users[2].name}
                  </p>
                  {users[2].role?.toLowerCase() === "admin" && (
                    <div className="mt-1">
                      <RoleBadge roleName="admin" size="sm" />
                    </div>
                  )}
                  <p className="text-[#78716C] text-xs">{users[2].points.toLocaleString()} pts</p>
                </div>
              </div>
            </div>
          )}

          {/* Rest of the list */}
          <div className="divide-y divide-white/[0.06]">
            {users.slice(3).map((user, index) => {
              const rank = index + 4;
              const isCurrentUser = user.id === currentUserId;
              const progress = calculateProgress(user.points, user.level);
              const nextLevel = getNextLevelConfig(user.level);

              return (
                <TenantLink
                  key={user.id}
                  href={`/community/profile/${user.id}`}
                  className={`flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors ${
                    isCurrentUser ? "bg-[#D4836A]/10" : ""
                  }`}
                >
                  {/* Rank */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      isCurrentUser
                        ? "bg-[#D4836A]/20 text-[#D4836A]"
                        : "bg-white/[0.05] text-[#78716C]"
                    }`}
                  >
                    #{rank}
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3D3936] to-[#2D2926] flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                    {user.image ? (
                      <RemoteImage
                        src={user.image}
                        alt={user.name || ""}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.name?.[0]?.toUpperCase() || "?"
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-medium truncate ${isCurrentUser ? "text-[#D4836A]" : "text-white"}`}
                      >
                        {user.name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-[#A8A29E]">(You)</span>
                        )}
                      </span>
                      {user.role?.toLowerCase() === "admin" && (
                        <RoleBadge roleName="admin" size="sm" />
                      )}
                      <LevelBadge level={user.level} size="sm" />
                    </div>
                    {user.tagline && (
                      <p className="text-[#78716C] text-sm truncate mt-0.5">{user.tagline}</p>
                    )}
                    {/* Progress bar */}
                    {nextLevel && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-[#78716C] mb-1">
                          <span>Level {user.level}</span>
                          <span>
                            {progress}% to Level {user.level + 1}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/[0.1] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${progress}%`,
                              backgroundColor:
                                getLevelConfig(user.level).color === "rainbow"
                                  ? "#D4836A"
                                  : getLevelConfig(user.level).color,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Points */}
                  <div className="text-right shrink-0">
                    <div className="text-white font-semibold">{user.points.toLocaleString()}</div>
                    <div className="text-[#78716C] text-xs">points</div>
                  </div>
                </TenantLink>
              );
            })}
          </div>

          {users.length === 0 && (
            <div className="p-12 text-center">
              <Trophy className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
              <p className="text-[#A8A29E]">No leaderboard data yet</p>
              <p className="text-[#78716C] text-sm mt-1">Be the first to earn points!</p>
            </div>
          )}
        </div>

        {/* Level Guide */}
        <div className="bg-gradient-to-br from-[#2D2926] to-[#252220] rounded-2xl border border-white/[0.06] p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Medal className="w-5 h-5 text-[#D4836A]" />
            Level Guide
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LEVEL_CONFIG.map((level) => (
              <div
                key={level.level}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                    level.color === "rainbow"
                      ? "bg-gradient-to-br from-red-500 via-green-500 to-blue-500"
                      : ""
                  }`}
                  style={level.color !== "rainbow" ? { backgroundColor: `${level.color}20` } : {}}
                >
                  {level.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium text-sm ${level.color === "rainbow" ? "bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 text-transparent bg-clip-text" : ""}`}
                      style={level.color !== "rainbow" ? { color: level.color } : {}}
                    >
                      {level.name}
                    </span>
                  </div>
                  <p className="text-[#78716C] text-xs">
                    {level.minPoints.toLocaleString()}+ points
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How Points Are Earned */}
        <div className="bg-gradient-to-br from-[#2D2926] to-[#252220] rounded-2xl border border-white/[0.06] p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#D4836A]" />
            How to Earn Points
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pointsInfo.map((item) => (
              <div
                key={item.action}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[#A8A29E] text-sm">{item.action}</span>
                </div>
                <span className="text-[#D4836A] font-semibold">+{item.points}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
