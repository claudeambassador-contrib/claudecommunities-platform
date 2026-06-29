export const dynamic = "force-dynamic";

import { Award, FileText, MessageSquare, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { adminNavItems } from "@/components/admin/adminNavItems";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantId } from "@/lib/tenant-context";

/**
 * Per-section accent for the dashboard cards, mirroring the nav's grouping.
 * Full static class strings so Tailwind can detect them at build time.
 */
const sectionStyles: Record<string, { border: string; icon: string; title: string }> = {
  Members: {
    border: "hover:border-[#D4836A]/30",
    icon: "text-[#D4836A]",
    title: "group-hover:text-[#D4836A]",
  },
  Content: {
    border: "hover:border-[#10B981]/30",
    icon: "text-[#10B981]",
    title: "group-hover:text-[#10B981]",
  },
  Marketing: {
    border: "hover:border-[#F59E0B]/30",
    icon: "text-[#F59E0B]",
    title: "group-hover:text-[#F59E0B]",
  },
  Insights: {
    border: "hover:border-cyan-500/30",
    icon: "text-cyan-500",
    title: "group-hover:text-cyan-500",
  },
  System: {
    border: "hover:border-[#7C6FCD]/30",
    icon: "text-[#7C6FCD]",
    title: "group-hover:text-[#7C6FCD]",
  },
};
const defaultSectionStyle = {
  border: "hover:border-[#D4836A]/30",
  icon: "text-[#D4836A]",
  title: "group-hover:text-[#D4836A]",
};

async function getAdminStats() {
  const prisma = await getPrisma();
  const tenantId = await getTenantId();
  // User is GLOBAL — the chokepoint does not scope it; restrict to this
  // tenant's members explicitly. Post/Comment/Badge are tenant-scoped (auto).
  const [userCount, postCount, commentCount, badgeCount] = await Promise.all([
    prisma.user.count({ where: { tenantMemberships: { some: { tenantId } } } }),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.badge.count(),
  ]);
  return { userCount, postCount, commentCount, badgeCount };
}

async function getRecentUsers() {
  const prisma = await getPrisma();
  const tenantId = await getTenantId();
  return await prisma.user.findMany({
    where: { tenantMemberships: { some: { tenantId } } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

async function getRecentPosts() {
  const prisma = await getPrisma();
  return await prisma.post.findMany({
    select: {
      id: true,
      title: true,
      content: true,
      isPinned: true,
      createdAt: true,
      author: {
        select: { id: true, name: true },
      },
      space: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export default async function AdminPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }
  // Layout already enforces admin access, so just landing here is enough.

  const [stats, recentUsers, recentPosts] = await Promise.all([
    getAdminStats(),
    getRecentUsers(),
    getRecentPosts(),
  ]);

  // Dashboard cards mirror the nav: top-level items grouped by section, each
  // gated on its own view-permission (a parent's children don't unlock the
  // card the way the sidebar's group filter does).
  const cardItems = adminNavItems.filter(
    (item) => item.section && item.permission && hasPermission(user, item.permission),
  );
  const sections = [...new Set(cardItems.map((item) => item.section as string))];

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#D4836A]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#D4836A]" />
              </div>
              <span className="text-2xl font-bold text-white">{stats.userCount}</span>
            </div>
            <p className="text-[#78716C] text-sm">Total Users</p>
          </div>

          <div className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#10B981]/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#10B981]" />
              </div>
              <span className="text-2xl font-bold text-white">{stats.postCount}</span>
            </div>
            <p className="text-[#78716C] text-sm">Total Posts</p>
          </div>

          <div className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <span className="text-2xl font-bold text-white">{stats.commentCount}</span>
            </div>
            <p className="text-[#78716C] text-sm">Total Comments</p>
          </div>

          <div className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <Award className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <span className="text-2xl font-bold text-white">{stats.badgeCount}</span>
            </div>
            <p className="text-[#78716C] text-sm">Badges</p>
          </div>
        </div>

        {/* Quick Actions — derived from the admin nav, grouped by section */}
        {sections.map((section) => {
          const style = sectionStyles[section] ?? defaultSectionStyle;
          return (
            <div key={section} className="mb-8">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E] mb-3">
                {section}
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {cardItems
                  .filter((item) => item.section === section)
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <TenantLink
                        key={item.href}
                        href={item.href}
                        className={`bg-[#2D2926] rounded-xl p-6 border border-white/[0.06] ${style.border} transition-colors group`}
                      >
                        <Icon className={`w-8 h-8 ${style.icon} mb-3`} />
                        <h3
                          className={`text-lg font-semibold text-white transition-colors ${style.title}`}
                        >
                          {item.label}
                        </h3>
                        {item.description && (
                          <p className="text-[#78716C] text-sm mt-1">{item.description}</p>
                        )}
                      </TenantLink>
                    );
                  })}
              </div>
            </div>
          );
        })}

        {/* Recent Activity */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Users */}
          <div className="bg-[#2D2926] rounded-xl border border-white/[0.06]">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4836A]" />
                Recent Users
              </h3>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {recentUsers.map((user) => (
                <div key={user.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{user.name || "Unnamed"}</p>
                    <p className="text-[#78716C] text-sm">{user.email}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.role !== "member"
                        ? "bg-[#D4836A]/20 text-[#D4836A]"
                        : "bg-white/[0.05] text-[#78716C]"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Posts */}
          <div className="bg-[#2D2926] rounded-xl border border-white/[0.06]">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#10B981]" />
                Recent Posts
              </h3>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {recentPosts.map((post) => (
                <div key={post.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">
                        {post.title || post.content.substring(0, 50)}
                      </p>
                      <p className="text-[#78716C] text-sm">
                        by {post.author.name} in {post.space.name}
                      </p>
                    </div>
                    {post.isPinned && (
                      <span className="px-2 py-1 text-xs bg-[#D4836A]/20 text-[#D4836A] rounded-full shrink-0">
                        Pinned
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
