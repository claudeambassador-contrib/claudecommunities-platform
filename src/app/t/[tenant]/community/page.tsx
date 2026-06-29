export const dynamic = "force-dynamic";

import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import CommunityBanner from "@/components/CommunityBanner";
import CommunityFeed from "@/components/CommunityFeed";
import OnboardingCheck from "@/components/OnboardingCheck";
import RightSidebar from "@/components/RightSidebar";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/revalidate";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantId } from "@/lib/tenant-context";

// Global (non-personalized) widgets are cached cross-request via the OpenNext
// incremental cache (R2). On a hit these skip the Prisma D1 query + WASM client
// build entirely. Counts/trending carry tags so writes invalidate them
// on-demand (see src/lib/revalidate.ts); the rest rely on the time window.
//
// MULTI-TENANT: every widget is keyed by `tenantId` (both in the cache key
// parts AND via an explicit getPrisma(tenantId)) so (a) tenant A's cached widget
// can never be served to tenant B, and (b) the query still resolves a tenant on
// background revalidation, when no request context exists (spec §3 #9/#10).
function getSpaces(tenantId: string) {
  return unstable_cache(
    async () => {
      const db = await getPrisma(tenantId);
      return db.space.findMany({
        orderBy: { order: "asc" },
        include: { group: true },
      });
    },
    ["community:spaces", tenantId],
    { revalidate: 300 },
  )();
}

function getMemberStats(tenantId: string) {
  return unstable_cache(
    async () => {
      // Count inline with the explicit-tenant client — NOT the getMemberCount()
      // service, whose context-based getPrisma() would throw on background
      // revalidation (no request scope). User is GLOBAL → membership join.
      const db = await getPrisma(tenantId);
      const memberWhere = { tenantMemberships: { some: { tenantId } } };
      const [members, count] = await Promise.all([
        db.user.findMany({
          where: memberWhere,
          select: { id: true, name: true, image: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        db.user.count({ where: { isBanned: false, ...memberWhere } }),
      ]);
      return { members, count };
    },
    ["community:memberStats", tenantId],
    { revalidate: 60 },
  )();
}

async function getUpcomingEvents(userId?: string) {
  const db = await getPrisma();
  const events = await db.event.findMany({
    where: { isActive: true, startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    take: 3,
    include: {
      rsvps: {
        where: { status: "going" },
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
        take: 5,
      },
      _count: {
        select: { rsvps: true },
      },
    },
  });

  // Batch fetch user RSVPs for all events at once (fixes N+1 query)
  const eventIds = events.map((e) => e.id);
  const userRsvps = userId
    ? await db.eventRSVP.findMany({
        where: {
          userId,
          eventId: { in: eventIds },
        },
        select: { eventId: true },
      })
    : [];
  const rsvpedEventIds = new Set(userRsvps.map((r) => r.eventId));

  return events.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    startTime: e.startTime.toISOString(),
    location: e.location,
    lumaUrl: e.lumaUrl,
    rsvpEnabled: e.rsvpEnabled,
    attendeeCount: e._count.rsvps,
    attendees: e.rsvps.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      image: r.user.image,
    })),
    isRsvped: rsvpedEventIds.has(e.id),
  }));
}

function getUpcomingEventCount(tenantId: string) {
  return unstable_cache(
    async () => {
      const db = await getPrisma(tenantId);
      return db.event.count({
        where: { isActive: true, startTime: { gte: new Date() } },
      });
    },
    ["community:upcomingEventCount", tenantId],
    { revalidate: 120, tags: [CACHE_TAGS.events] },
  )();
}

function getPostCount(tenantId: string) {
  return unstable_cache(
    async () => {
      const db = await getPrisma(tenantId);
      return db.post.count();
    },
    ["community:postCount", tenantId],
    { revalidate: 60, tags: [CACHE_TAGS.posts] },
  )();
}

function getTrendingPosts(tenantId: string) {
  return unstable_cache(
    async () => {
      // Get posts from the last 7 days, sorted by engagement (likes + comments)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const db = await getPrisma(tenantId);
      const posts = await db.post.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
        include: {
          author: {
            select: { id: true, name: true },
          },
          _count: {
            select: { likes: true, comments: true },
          },
        },
        orderBy: [{ likes: { _count: "desc" } }],
        take: 5,
      });

      // Sort by total engagement and take top 5
      return posts
        .map((post) => ({
          id: post.id,
          title: post.title,
          content: post.content,
          author: post.author,
          _count: post._count,
          engagement: post._count.likes + post._count.comments,
        }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5);
    },
    ["community:trendingPosts", tenantId],
    { revalidate: 120, tags: [CACHE_TAGS.posts] },
  )();
}

function getOnlineMembers(tenantId: string) {
  return unstable_cache(
    async () => {
      // Get members who were seen in the last 5 minutes. Date.now() is frozen at
      // cache-fill time; with a 30s window the drift is bounded by the TTL.
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // User is GLOBAL — restrict to this tenant's online members.
      const db = await getPrisma(tenantId);
      return db.user.findMany({
        where: {
          lastSeen: { gte: fiveMinutesAgo },
          tenantMemberships: { some: { tenantId } },
        },
        select: {
          id: true,
          name: true,
          image: true,
        },
        take: 20,
      });
    },
    ["community:onlineMembers", tenantId],
    { revalidate: 30 },
  )();
}

function getTopContributors(tenantId: string) {
  return unstable_cache(
    async () => {
      // Get top contributors by points, scoped to this tenant's members.
      const db = await getPrisma(tenantId);
      return db.user.findMany({
        where: {
          points: { gt: 0 },
          tenantMemberships: { some: { tenantId } },
        },
        select: {
          id: true,
          name: true,
          image: true,
          points: true,
        },
        orderBy: {
          points: "desc",
        },
        take: 5,
      });
    },
    ["community:topContributors", tenantId],
    { revalidate: 120 },
  )();
}

async function getPosts(spaceSlug?: string) {
  const where = spaceSlug ? { space: { slug: spaceSlug } } : {};

  const db = await getPrisma();
  const posts = await db.post.findMany({
    where,
    include: {
      author: true,
      space: true,
      poll: true,
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    content: post.content,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
    isPinned: post.isPinned,
    createdAt: post.createdAt.toISOString(),
    pollId: post.poll?.id || null,
    author: {
      id: post.author.id,
      name: post.author.name,
      image: post.author.image,
      role: post.author.role,
    },
    space: {
      id: post.space.id,
      name: post.space.name,
      slug: post.space.slug,
      color: post.space.color,
    },
    _count: {
      likes: post._count.likes,
      comments: post._count.comments,
    },
  }));
}

async function getSpaceBySlug(slug: string) {
  const db = await getPrisma();
  return await db.space.findFirst({ where: { slug } });
}

async function getUserOnboardingStatus(userId: string) {
  const db = await getPrisma();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isOnboarded: true },
  });
  return user?.isOnboarded ?? false;
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const params = await searchParams;
  const spaceSlug = params.space;
  const userId = user.id;

  const db = await getPrisma();
  const tenantId = await getTenantId();
  const [
    spaces,
    posts,
    memberStats,
    upcomingEventCount,
    postCount,
    upcomingEvents,
    currentSpace,
    isOnboarded,
    trendingPosts,
    onlineMembers,
    topContributors,
    connectionsCount,
  ] = await Promise.all([
    getSpaces(tenantId),
    getPosts(spaceSlug),
    getMemberStats(tenantId),
    getUpcomingEventCount(tenantId),
    getPostCount(tenantId),
    getUpcomingEvents(userId),
    spaceSlug ? getSpaceBySlug(spaceSlug) : Promise.resolve(null),
    getUserOnboardingStatus(userId),
    getTrendingPosts(tenantId),
    getOnlineMembers(tenantId),
    getTopContributors(tenantId),
    db.connection.count({
      where: {
        status: "accepted",
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
    }),
  ]);
  const userName = user.name || "User";
  const userRole = user.role || "member";
  const userImage = user.image || null;

  const spacesForComposer = spaces.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    color: s.color,
  }));

  return (
    <div className="min-h-screen bg-[#1C1917]">
      {/* Onboarding Modal */}
      <OnboardingCheck userName={userName} userId={userId} isOnboarded={isOnboarded} />

      {/* Main Content */}
      <div className="xl:mr-[300px]">
        {/* Community Banner - only show on main feed */}
        {!spaceSlug && (
          <CommunityBanner
            memberCount={memberStats.count}
            postCount={postCount}
            eventCount={upcomingEventCount}
            connectionsCount={connectionsCount}
          />
        )}
        {/* Space Header */}
        {currentSpace && (
          <div className="border-b border-white/[0.06] px-6 py-4">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentSpace.color || "#D4836A" }}
              />
              <h1 className="text-xl font-semibold text-white">{currentSpace.name}</h1>
            </div>
          </div>
        )}
        <CommunityFeed
          initialPosts={posts}
          spaces={spacesForComposer}
          currentUserId={userId}
          userName={userName}
          userImage={userImage}
          spaceSlug={spaceSlug}
          isAdmin={userRole === "admin"}
        />
      </div>

      {/* Right Sidebar */}
      <RightSidebar
        memberCount={memberStats.count}
        recentMembers={memberStats.members}
        upcomingEventCount={upcomingEventCount}
        upcomingEvents={upcomingEvents}
        trendingPosts={trendingPosts}
        onlineMembers={onlineMembers}
        topContributors={topContributors}
        currentUserId={userId}
      />
    </div>
  );
}
