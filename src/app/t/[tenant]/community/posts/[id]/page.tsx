export const dynamic = "force-dynamic";

import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import CommentSection from "@/components/CommentSection";
import PostCard from "@/components/PostCard";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

async function getPost(id: string) {
  const db = await getPrisma();
  const post = await db.post.findUnique({
    where: { id },
    include: {
      author: { include: { userBadges: { include: { badge: true } } } },
      space: true,
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post) return null;

  return {
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
      tagline: post.author.tagline,
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
  };
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    notFound();
  }

  const userId = user?.id || "";
  const userName = user?.name || "User";
  const userImage = user?.image || null;

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back Link */}
        <TenantLink
          href="/community"
          className="inline-flex items-center gap-2 text-[#A8A29E] hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </TenantLink>

        {/* Post */}
        <PostCard post={post} currentUserId={userId} />

        {/* Comments */}
        <div className="mt-6 bg-[#2D2926] rounded-2xl p-5 border border-white/[0.06]">
          <h3 className="font-semibold text-white mb-4">Comments ({post._count.comments})</h3>
          <CommentSection
            postId={post.id}
            currentUserId={userId}
            userName={userName}
            userImage={userImage}
          />
        </div>
      </div>
    </div>
  );
}
