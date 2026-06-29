export const dynamic = "force-dynamic";

import { ArrowLeft, FileText, Search, Users } from "lucide-react";
import { redirect } from "next/navigation";
import PostCard from "@/components/PostCard";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantId } from "@/lib/tenant-context";

async function searchPosts(query: string) {
  const prisma = await getPrisma();
  const tenantId = await getTenantId();
  const posts = await prisma.post.findMany({
    where: {
      OR: [{ title: { contains: query } }, { content: { contains: query } }],
    },
    include: {
      // `author` is the GLOBAL User; its userBadges are NOT auto-scoped (the
      // include traverses a global model), so filter them to this tenant.
      author: { include: { userBadges: { where: { tenantId }, include: { badge: true } } } },
      space: true,
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    content: post.content,
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
}

async function searchMembers(query: string) {
  const prisma = await getPrisma();
  const tenantId = await getTenantId();
  return await prisma.user.findMany({
    where: {
      AND: [
        { OR: [{ name: { contains: query } }, { bio: { contains: query } }] },
        { tenantMemberships: { some: { tenantId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      role: true,
    },
    take: 10,
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const params = await searchParams;
  const query = params.q || "";
  const currentUserId = user.id || "";
  const base = await getTenantBase();

  const [posts, members] = await Promise.all([
    query ? searchPosts(query) : Promise.resolve([]),
    query ? searchMembers(query) : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back Link */}
        <TenantLink
          href="/community"
          className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </TenantLink>

        {/* Search Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Search className="w-6 h-6 text-[#D4836A]" />
            <h1 className="text-2xl font-bold text-white">
              {query ? `Search results for "${query}"` : "Search"}
            </h1>
          </div>

          {/* Search Input */}
          <form action={tenantHref(base, "/community/search")} method="GET" className="mt-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#78716C]" />
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Search posts and members..."
                // biome-ignore lint/a11y/noAutofocus: dedicated /search page; search input is the page's sole purpose
                autoFocus
                className="w-full pl-12 pr-4 py-3 bg-[#2D2926] border border-white/[0.06] rounded-xl text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 transition-colors"
              />
            </div>
          </form>

          {query && (
            <p className="text-[#78716C] mt-3">
              Found {posts.length} posts and {members.length} members
            </p>
          )}
        </div>

        {!query ? (
          <div className="bg-[#2D2926] rounded-2xl p-12 text-center border border-white/[0.06]">
            <Search className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
            <p className="text-[#78716C]">Enter a search term to find posts and members</p>
          </div>
        ) : (
          <>
            {/* Members Results */}
            {members.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-[#D4836A]" />
                  <h2 className="text-lg font-semibold text-white">Members</h2>
                </div>
                <div className="grid gap-3">
                  {members.map((member) => (
                    <TenantLink
                      key={member.id}
                      href={`/community/profile/${member.id}`}
                      className="flex items-center gap-4 p-4 bg-[#2D2926] rounded-xl border border-white/[0.06] hover:border-[#D4836A]/30 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4836A] to-[#B66B54] flex items-center justify-center text-white font-bold">
                        {member.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{member.name}</span>
                          {member.role !== "member" && (
                            <span className="px-2 py-0.5 bg-[#D4836A]/20 text-[#D4836A] text-xs font-semibold rounded-full">
                              Admin
                            </span>
                          )}
                        </div>
                        {member.bio && (
                          <p className="text-sm text-[#78716C] line-clamp-1">{member.bio}</p>
                        )}
                      </div>
                    </TenantLink>
                  ))}
                </div>
              </div>
            )}

            {/* Posts Results */}
            {posts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-[#D4836A]" />
                  <h2 className="text-lg font-semibold text-white">Posts</h2>
                </div>
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} currentUserId={currentUserId} />
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {posts.length === 0 && members.length === 0 && (
              <div className="bg-[#2D2926] rounded-2xl p-12 text-center border border-white/[0.06]">
                <Search className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
                <p className="text-[#78716C]">No results found for "{query}"</p>
                <p className="text-sm text-[#57534E] mt-2">Try different keywords</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
