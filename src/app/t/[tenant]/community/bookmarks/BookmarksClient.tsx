"use client";

import { ArrowLeft, Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import PostCard from "@/components/PostCard";
import { TenantLink } from "@/components/TenantBaseProvider";

interface Post {
  id: string;
  title: string | null;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  isPinned: boolean;
  createdAt: string;
  bookmarkedAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
  space: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  };
  _count: {
    likes: number;
    comments: number;
  };
  isBookmarked: boolean;
}

interface BookmarksClientProps {
  userId: string;
  userName: string;
}

export default function BookmarksClient({ userId }: BookmarksClientProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchBookmarks runs once on mount; intentionally not re-run on every render
  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch("/api/bookmarks");
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Failed to fetch bookmarks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(posts.filter((p) => p.id !== postId));
  };

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <TenantLink
            href="/community"
            className="inline-flex items-center gap-2 text-[#78716C] hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Community
          </TenantLink>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#D4836A]/20 flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-[#D4836A]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Saved Posts</h1>
              <p className="text-[#78716C] text-sm">
                {posts.length} {posts.length === 1 ? "post" : "posts"} saved
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#2D2926] rounded-2xl p-6 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-11 h-11 rounded-full bg-white/[0.1]"></div>
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-white/[0.1] rounded w-1/4"></div>
                    <div className="h-4 bg-white/[0.1] rounded w-3/4"></div>
                    <div className="h-4 bg-white/[0.1] rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-[#2D2926] flex items-center justify-center mx-auto mb-4">
              <Bookmark className="w-8 h-8 text-[#78716C]" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No saved posts yet</h2>
            <p className="text-[#78716C] mb-6">
              Click the bookmark icon on any post to save it for later
            </p>
            <TenantLink
              href="/community"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4836A] text-white font-medium hover:bg-[#c4775f] transition-colors"
            >
              Browse Posts
            </TenantLink>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={userId}
                onDelete={() => handlePostDeleted(post.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
