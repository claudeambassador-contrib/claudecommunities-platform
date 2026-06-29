export const dynamic = "force-dynamic";

import {
  BookOpen,
  Calendar,
  Eye,
  FileText,
  Heart,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantId } from "@/lib/tenant-context";

async function getAnalytics() {
  const prisma = await getPrisma();
  const tenantId = await getTenantId();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    usersThisWeek,
    usersThisMonth,
    totalPosts,
    postsThisWeek,
    postsThisMonth,
    totalComments,
    commentsThisWeek,
    totalLikes,
    likesThisWeek,
    totalEvents,
    upcomingEvents,
    totalCourses,
    courseEnrollments,
    totalPageViews,
    pageViewsToday,
    recentActivity,
    topPosts,
    activeUsersRaw,
  ] = await Promise.all([
    // User is GLOBAL — restrict every count/list to this tenant's members.
    prisma.user.count({ where: { tenantMemberships: { some: { tenantId } } } }),
    prisma.user.count({
      where: { createdAt: { gte: thisWeek }, tenantMemberships: { some: { tenantId } } },
    }),
    prisma.user.count({
      where: { createdAt: { gte: thisMonth }, tenantMemberships: { some: { tenantId } } },
    }),
    prisma.post.count(),
    prisma.post.count({ where: { createdAt: { gte: thisWeek } } }),
    prisma.post.count({ where: { createdAt: { gte: thisMonth } } }),
    prisma.comment.count(),
    prisma.comment.count({ where: { createdAt: { gte: thisWeek } } }),
    prisma.like.count(),
    prisma.like.count({ where: { createdAt: { gte: thisWeek } } }),
    prisma.event.count(),
    prisma.event.count({ where: { startTime: { gte: now } } }),
    prisma.course.count({ where: { isPublished: true } }),
    prisma.courseEnrollment.count(),
    prisma.pageView.count(),
    prisma.pageView.count({ where: { createdAt: { gte: today } } }),
    prisma.activity.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.post.findMany({
      take: 5,
      orderBy: { likes: { _count: "desc" } },
      include: {
        author: { select: { name: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.user.findMany({
      where: { lastSeen: { gte: thisWeek }, tenantMemberships: { some: { tenantId } } },
      // Do NOT `orderBy: { posts: { _count } }` here: `User` is GLOBAL, so the
      // chokepoint can't scope that relation-count and the ranking would mix in
      // other tenants' posts — deciding WHICH of this tenant's members land in the
      // top 5 (spec §3 #24). Fetch active members with tenant-filtered counts and
      // rank in JS instead. `take: 100` caps the active-this-week candidate set.
      take: 100,
      include: {
        _count: {
          select: {
            posts: { where: { tenantId } },
            comments: { where: { tenantId } },
          },
        },
      },
    }),
  ]);

  // Rank the active members by their IN-TENANT post count (the orderBy above
  // would have ranked by global activity — see the note there) and take the top 5.
  const activeUsers = [...activeUsersRaw]
    .sort((a, b) => b._count.posts - a._count.posts)
    .slice(0, 5);

  // Calculate growth percentages
  const userGrowth = usersThisMonth > 0 ? Math.round((usersThisMonth / totalUsers) * 100) : 0;
  const postGrowth = postsThisMonth > 0 ? Math.round((postsThisMonth / totalPosts) * 100) : 0;

  return {
    users: {
      total: totalUsers,
      thisWeek: usersThisWeek,
      thisMonth: usersThisMonth,
      growth: userGrowth,
    },
    posts: {
      total: totalPosts,
      thisWeek: postsThisWeek,
      thisMonth: postsThisMonth,
      growth: postGrowth,
    },
    comments: { total: totalComments, thisWeek: commentsThisWeek },
    likes: { total: totalLikes, thisWeek: likesThisWeek },
    events: { total: totalEvents, upcoming: upcomingEvents },
    courses: { total: totalCourses, enrollments: courseEnrollments },
    pageViews: { total: totalPageViews, today: pageViewsToday },
    recentActivity,
    topPosts,
    activeUsers,
  };
}

export default async function AnalyticsPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));
  if (!hasPermission(user, "analytics.view"))
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));

  const analytics = await getAnalytics();

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Main Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            iconColor="text-[#D4836A]"
            iconBg="bg-[#D4836A]/20"
            label="Total Members"
            value={formatNumber(analytics.users.total)}
            change={`+${analytics.users.thisWeek} this week`}
          />
          <StatCard
            icon={<FileText className="w-5 h-5" />}
            iconColor="text-[#10B981]"
            iconBg="bg-[#10B981]/20"
            label="Total Posts"
            value={formatNumber(analytics.posts.total)}
            change={`+${analytics.posts.thisWeek} this week`}
          />
          <StatCard
            icon={<MessageSquare className="w-5 h-5" />}
            iconColor="text-[#8B5CF6]"
            iconBg="bg-[#8B5CF6]/20"
            label="Total Comments"
            value={formatNumber(analytics.comments.total)}
            change={`+${analytics.comments.thisWeek} this week`}
          />
          <StatCard
            icon={<Heart className="w-5 h-5" />}
            iconColor="text-pink-500"
            iconBg="bg-pink-500/20"
            label="Total Likes"
            value={formatNumber(analytics.likes.total)}
            change={`+${analytics.likes.thisWeek} this week`}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            iconColor="text-[#F59E0B]"
            iconBg="bg-[#F59E0B]/20"
            label="Events"
            value={analytics.events.total.toString()}
            change={`${analytics.events.upcoming} upcoming`}
          />
          <StatCard
            icon={<BookOpen className="w-5 h-5" />}
            iconColor="text-[#3B82F6]"
            iconBg="bg-[#3B82F6]/20"
            label="Courses"
            value={analytics.courses.total.toString()}
            change={`${analytics.courses.enrollments} enrollments`}
          />
          <StatCard
            icon={<Eye className="w-5 h-5" />}
            iconColor="text-cyan-500"
            iconBg="bg-cyan-500/20"
            label="Page Views"
            value={formatNumber(analytics.pageViews.total)}
            change={`${analytics.pageViews.today} today`}
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-500/20"
            label="Member Growth"
            value={`${analytics.users.growth}%`}
            change="this month"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Top Posts */}
          <div className="lg:col-span-2 bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#D4836A]" />
              Top Posts
            </h2>
            <div className="space-y-4">
              {analytics.topPosts.map((post, index) => (
                <div key={post.id} className="flex items-center gap-4">
                  <span className="w-6 h-6 rounded-full bg-white/[0.05] flex items-center justify-center text-xs text-[#78716C] font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">
                      {post.title || post.content.substring(0, 50)}
                    </p>
                    <p className="text-sm text-[#78716C]">by {post.author.name}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[#78716C]">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" />
                      {post._count.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {post._count.comments}
                    </span>
                  </div>
                </div>
              ))}
              {analytics.topPosts.length === 0 && (
                <p className="text-[#78716C] text-center py-4">No posts yet</p>
              )}
            </div>
          </div>

          {/* Active Users */}
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#8B5CF6]" />
              Most Active Users
            </h2>
            <div className="space-y-3">
              {analytics.activeUsers.map((user) => (
                <TenantLink
                  key={user.id}
                  href={`/community/profile/${user.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[#D4836A] flex items-center justify-center text-white font-bold text-sm">
                    {user.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{user.name || "Anonymous"}</p>
                    <p className="text-xs text-[#78716C]">
                      {user._count.posts} posts, {user._count.comments} comments
                    </p>
                  </div>
                </TenantLink>
              ))}
              {analytics.activeUsers.length === 0 && (
                <p className="text-[#78716C] text-center py-4">No active users</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6 bg-[#2D2926] rounded-2xl border border-white/[0.06] p-6">
          <h2 className="font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {analytics.recentActivity.map((activity) => {
              const data = activity.data ? JSON.parse(activity.data) : {};
              return (
                <div key={activity.id} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-[#D4836A]" />
                  <span className="text-white">{activity.user.name}</span>
                  <span className="text-[#78716C]">{formatActivityType(activity.type)}</span>
                  {data.postTitle && (
                    <span className="text-[#A8A29E] truncate">&quot;{data.postTitle}&quot;</span>
                  )}
                  <span className="text-[#57534E] ml-auto shrink-0">
                    {formatTimeAgo(activity.createdAt)}
                  </span>
                </div>
              );
            })}
            {analytics.recentActivity.length === 0 && (
              <p className="text-[#78716C] text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  change,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  change: string;
}) {
  return (
    <div className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06]">
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${iconColor}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-[#78716C]">{label}</p>
      <p className="text-xs text-[#57534E] mt-1">{change}</p>
    </div>
  );
}

function formatActivityType(type: string): string {
  switch (type) {
    case "post_created":
      return "created a post";
    case "comment_created":
      return "commented on";
    case "like_added":
      return "liked";
    case "course_enrolled":
      return "enrolled in";
    case "lesson_completed":
      return "completed";
    default:
      return type.replace(/_/g, " ");
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
