"use client";

import { MessageCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import PostCard from "./PostCard";
import PostComposer from "./PostComposer";
import PostEditModal from "./PostEditModal";
import PostModal from "./PostModal";

interface CommentPreview {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

interface Post {
  id: string;
  title: string | null;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  isPinned: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    tagline?: string | null;
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
  isLiked?: boolean;
  pollId?: string | null;
  attachments?: Attachment[];
  commentsPreview?: CommentPreview[];
}

interface Space {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface CommunityFeedProps {
  initialPosts: Post[];
  spaces: Space[];
  currentUserId: string;
  userName: string;
  userImage?: string | null;
  spaceSlug?: string;
  isAdmin?: boolean;
}

export default function CommunityFeed({
  initialPosts,
  spaces,
  currentUserId,
  userName,
  userImage,
  spaceSlug,
  isAdmin = false,
}: CommunityFeedProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Update posts when initialPosts change (e.g., when navigating between spaces)
  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  const refreshPosts = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Add timestamp to bypass any caching
      const timestamp = Date.now();
      const baseUrl = spaceSlug ? `/api/posts?space=${spaceSlug}` : "/api/posts";
      const url = baseUrl.includes("?")
        ? `${baseUrl}&_t=${timestamp}`
        : `${baseUrl}?_t=${timestamp}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Failed to refresh posts:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [spaceSlug]);

  const handlePostCreated = () => {
    refreshPosts();
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(posts.filter((p) => p.id !== postId));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <PostComposer
        spaces={spaces}
        userName={userName}
        userImage={userImage}
        onPostCreated={handlePostCreated}
        defaultSpaceSlug={spaceSlug}
      />

      <div className="mt-8 space-y-5">
        {isRefreshing && (
          <div className="text-center py-6">
            <div className="w-6 h-6 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-[#2D2926] flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-[#78716C]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No posts yet</h3>
            <p className="text-[#A8A29E]">Be the first to share something with the community!</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={() => handlePostDeleted(post.id)}
              onEdit={() => setEditingPost(post)}
              onClick={() => setSelectedPost(post)}
            />
          ))
        )}
      </div>

      {/* Post Modal */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          currentUserId={currentUserId}
          userName={userName}
          userImage={userImage}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {/* Edit Modal */}
      {editingPost && (
        <PostEditModal
          post={editingPost}
          spaces={spaces}
          onClose={() => setEditingPost(null)}
          onSaved={refreshPosts}
        />
      )}
    </div>
  );
}
