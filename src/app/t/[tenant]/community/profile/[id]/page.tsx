export const dynamic = "force-dynamic";

import {
  Calendar,
  ExternalLink,
  FileText,
  Globe,
  MapPin,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import PostCard from "@/components/PostCard";
import ProfileBadgesSection from "@/components/ProfileBadgesSection";
import ProfileConnectButton from "@/components/ProfileConnectButton";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { getCurrentUser } from "@/lib/auth";
import { cached } from "@/lib/cache";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";

// Social icons as simple components
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

async function getUser(id: string) {
  return cached(
    `profile:${id}`,
    async () => {
      const prisma = await getPrisma();
      const tenantId = await getTenantId();
      // User is GLOBAL. Resolve the profile ONLY if the user is a member of this
      // tenant (findFirst + membership join — a non-member 404s, no cross-tenant
      // profile peeking), and scope every relation reached THROUGH the user
      // (counts, badges, subscriptions) to this tenant.
      const user = await prisma.user.findFirst({
        where: { id, tenantMemberships: { some: { tenantId } } },
        include: {
          _count: {
            select: {
              posts: { where: { tenantId } },
              comments: { where: { tenantId } },
            },
          },
          userBadges: {
            where: { tenantId },
            include: { badge: true },
            orderBy: { awardedAt: "asc" },
          },
          subscriptions: {
            include: { tier: true },
            where: { status: "active", tenantId },
            take: 1,
          },
        },
      });

      if (!user) return null;

      return {
        id: user.id,
        name: user.name,
        image: user.image,
        coverImage: user.coverImage,
        bio: user.bio,
        tagline: user.tagline,
        location: user.location,
        website: user.website,
        twitter: user.twitter,
        linkedin: user.linkedin,
        github: user.github,
        role: user.role,
        points: user.points,
        level: user.level,
        createdAt: user.createdAt.toISOString(),
        _count: user._count,
        badges: user.userBadges.map((ub) => ({
          id: ub.badge.id,
          name: ub.badge.name,
          description: ub.badge.description,
          icon: ub.badge.icon,
          color: ub.badge.color,
        })),
        subscriptionTier: user.subscriptions[0]?.tier?.name || null,
      };
    },
    30,
  ); // Cache for 30 seconds
}

async function getUserPosts(userId: string) {
  return cached(
    `userPosts:${userId}`,
    async () => {
      const prisma = await getPrisma();
      const tenantId = await getTenantId();
      const posts = await prisma.post.findMany({
        // Post is auto-scoped; `author` is the GLOBAL User, so its userBadges
        // are filtered to this tenant explicitly (the include traverses User).
        where: { authorId: userId },
        include: {
          author: { include: { userBadges: { where: { tenantId }, include: { badge: true } } } },
          space: true,
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      return posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        isPinned: post.isPinned,
        createdAt: post.createdAt.toISOString(),
        author: {
          id: post.author.id,
          name: post.author.name,
          image: post.author.image,
          role: post.author.role,
          badges: post.author.userBadges.map((ub) => ({
            id: ub.badge.id,
            name: ub.badge.name,
            icon: ub.badge.icon,
            color: ub.badge.color,
          })),
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
    },
    30,
  ); // Cache for 30 seconds
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: presentational server component; complexity is driven by nested JSX conditionals, not branching logic
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const { id } = await params;
  const prisma = await getPrisma();
  const [profileUser, posts, connection, connectionsCount] = await Promise.all([
    getUser(id),
    getUserPosts(id),
    currentUser.id !== id
      ? prisma.connection.findFirst({
          where: {
            OR: [
              { requesterId: currentUser.id, receiverId: id },
              { requesterId: id, receiverId: currentUser.id },
            ],
          },
          select: { id: true, status: true, requesterId: true },
        })
      : null,
    prisma.connection.count({
      where: {
        status: "accepted",
        OR: [{ requesterId: id }, { receiverId: id }],
      },
    }),
  ]);

  if (!profileUser) {
    notFound();
  }

  const currentUserId = currentUser.id || "";
  const isOwnProfile = currentUserId === profileUser.id;
  const memberSince = new Date(profileUser.createdAt).toLocaleDateString(
    (await getTenantConfig()).lang,
    {
      month: "long",
      year: "numeric",
    },
  );

  const connectionStatus = !connection
    ? ("none" as const)
    : connection.status === "accepted"
      ? ("accepted" as const)
      : connection.requesterId === currentUserId
        ? ("pending" as const)
        : ("received" as const);

  const hasSocialLinks =
    profileUser.website || profileUser.twitter || profileUser.linkedin || profileUser.github;

  return (
    <div className="min-h-screen bg-[#1C1917]">
      {/* Cover Image */}
      <div className="relative h-32 md:h-40 bg-gradient-to-br from-[#D4836A]/30 via-[#2D2926] to-[#1C1917]">
        {profileUser.coverImage && (
          <RemoteImage
            src={profileUser.coverImage}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1C1917]/80 to-transparent" />
      </div>

      <div className="max-w-2xl mx-auto px-6">
        {/* Profile Card */}
        <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] mb-8 -mt-12 relative">
          <div className="p-6 pt-16">
            {/* Avatar - Positioned at top of card, overlapping */}
            <div className="absolute -top-10 left-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#D4836A] to-[#B66B54] flex items-center justify-center text-white text-3xl font-bold ring-4 ring-[#2D2926]">
                {profileUser.image ? (
                  <RemoteImage
                    src={profileUser.image}
                    alt={profileUser.name || ""}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  profileUser.name?.[0]?.toUpperCase() || "?"
                )}
              </div>
            </div>

            {/* Settings button - Top right */}
            {isOwnProfile && (
              <TenantLink
                href="/community/settings/profile"
                className="absolute top-4 right-4 p-2 text-[#78716C] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </TenantLink>
            )}

            {/* Name */}
            <h1 className="text-2xl font-bold text-white mb-1">
              {profileUser.name || "Anonymous"}
            </h1>

            {/* Profile Badges, Tagline, and Level Progress */}
            <div className="mt-4">
              <ProfileBadgesSection
                userId={profileUser.id}
                role={profileUser.role}
                tagline={profileUser.tagline}
                points={profileUser.points}
                level={profileUser.level}
                isOwnProfile={isOwnProfile}
                subscriptionTier={profileUser.subscriptionTier || undefined}
              />
            </div>

            {/* Achievement Badges */}
            {profileUser.badges.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <h3 className="text-sm font-medium text-[#78716C] mb-2">Achievements</h3>
                <div className="flex flex-wrap gap-2">
                  {profileUser.badges.map((badge) => (
                    <span
                      key={badge.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${badge.color}20`, color: badge.color || "#fff" }}
                      title={badge.description || badge.name}
                    >
                      <span>{badge.icon}</span>
                      {badge.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profileUser.bio && (
              <p className="text-[#A8A29E] mt-4 pt-4 border-t border-white/[0.06]">
                {profileUser.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-[#78716C] mt-4">
              {profileUser.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {profileUser.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Member since {memberSince}
              </span>
            </div>

            {/* Social Links */}
            {hasSocialLinks && (
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/[0.06]">
                {profileUser.website && (
                  <a
                    href={
                      profileUser.website.startsWith("http")
                        ? profileUser.website
                        : `https://${profileUser.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-sm text-[#A8A29E] hover:text-white transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    Website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {profileUser.twitter && (
                  <a
                    href={`https://twitter.com/${profileUser.twitter.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-sm text-[#A8A29E] hover:text-white transition-colors"
                  >
                    <TwitterIcon className="w-4 h-4" />@{profileUser.twitter.replace("@", "")}
                  </a>
                )}
                {profileUser.linkedin && (
                  <a
                    href={`https://linkedin.com/in/${profileUser.linkedin
                      .replace(/^https?:\/\//, "")
                      .replace(/^www\./, "")
                      .replace(/^linkedin\.com\/in\//, "")
                      .replace(/\/$/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-sm text-[#A8A29E] hover:text-white transition-colors"
                  >
                    <LinkedInIcon className="w-4 h-4" />
                    LinkedIn
                  </a>
                )}
                {profileUser.github && (
                  <a
                    href={`https://github.com/${profileUser.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-sm text-[#A8A29E] hover:text-white transition-colors"
                  >
                    <GitHubIcon className="w-4 h-4" />
                    {profileUser.github}
                  </a>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-6 mt-4 pt-4 border-t border-white/[0.06]">
              <div className="text-center">
                <span className="block text-xl font-bold text-white">
                  {profileUser._count.posts}
                </span>
                <span className="flex items-center gap-1 text-sm text-[#78716C]">
                  <FileText className="w-3.5 h-3.5" /> Posts
                </span>
              </div>
              <div className="text-center">
                <span className="block text-xl font-bold text-white">
                  {profileUser._count.comments}
                </span>
                <span className="flex items-center gap-1 text-sm text-[#78716C]">
                  <MessageSquare className="w-3.5 h-3.5" /> Comments
                </span>
              </div>
              {isOwnProfile ? (
                <TenantLink href="/community/connections" className="text-center group">
                  <span className="block text-xl font-bold text-white group-hover:text-[#D4836A] transition-colors">
                    {connectionsCount}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-[#78716C] group-hover:text-[#D4836A] transition-colors">
                    <Users className="w-3.5 h-3.5" /> Connections
                  </span>
                </TenantLink>
              ) : (
                <div className="text-center">
                  <span className="block text-xl font-bold text-white">{connectionsCount}</span>
                  <span className="flex items-center gap-1 text-sm text-[#78716C]">
                    <Users className="w-3.5 h-3.5" /> Connections
                  </span>
                </div>
              )}
            </div>

            {/* Connect Button (for other users only) */}
            {!isOwnProfile && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <ProfileConnectButton
                  profileUserId={profileUser.id}
                  initialStatus={connectionStatus}
                  connectionId={connection?.id}
                />
              </div>
            )}
          </div>
        </div>

        {/* User's Posts */}
        <h2 className="text-xl font-semibold text-white mb-4">
          {isOwnProfile ? "Your Posts" : `Posts by ${profileUser.name}`}
        </h2>

        {posts.length === 0 ? (
          <div className="bg-[#2D2926] rounded-2xl p-8 border border-white/[0.06] text-center mb-8">
            <p className="text-[#78716C]">
              {isOwnProfile ? "You haven't posted anything yet." : "No posts yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
