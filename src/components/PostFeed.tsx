"use client";

import { useState } from "react";
import PostCard from "./PostCard";

interface Post {
  id: string;
  title: string | null;
  content: string;
  isPinned: boolean;
  createdAt: string;
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
  isLiked?: boolean;
}

interface PostFeedProps {
  initialPosts: Post[];
  currentUserId?: string;
  spaceSlug?: string;
}

export default function PostFeed({ initialPosts, currentUserId }: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isLoading] = useState(false);

  const handleDelete = (postId: string) => {
    setPosts(posts.filter((p) => p.id !== postId));
  };

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78716C] text-lg">No posts yet. Be the first to share something!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="text-center py-4">
          <div className="w-6 h-6 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      )}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          onDelete={() => handleDelete(post.id)}
        />
      ))}
    </div>
  );
}

// Export a function to trigger refresh from parent
export function usePostFeedRefresh() {
  const [key, setKey] = useState(0);
  const refresh = () => setKey((k) => k + 1);
  return { key, refresh };
}
