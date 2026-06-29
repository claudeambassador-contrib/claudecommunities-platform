"use client";

import { Eye, MoreHorizontal, Pin, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface Post {
  id: string;
  title: string | null;
  content: string;
  isPinned: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
  };
  space: {
    id: string;
    name: string;
    slug: string;
  };
  _count: {
    likes: number;
    comments: number;
  };
}

export default function AdminPostsPage() {
  const config = useTenantConfig();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional run-once on mount; fetchPosts is stable for the initial load
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/posts?limit=100");
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setPosts(posts.filter((p) => p.id !== postId));
        setActionMenu(null);
      } else {
        alert("Failed to delete post");
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post");
    }
  };

  const handleTogglePin = async (postId: string, currentlyPinned: boolean) => {
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !currentlyPinned }),
      });

      if (res.ok) {
        setPosts(posts.map((p) => (p.id === postId ? { ...p, isPinned: !currentlyPinned } : p)));
        setActionMenu(null);
      } else {
        alert("Failed to update post");
      }
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      alert("Failed to update post");
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      post.title?.toLowerCase().includes(searchLower) ||
      post.content.toLowerCase().includes(searchLower) ||
      post.author.name?.toLowerCase().includes(searchLower) ||
      post.space.name.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(config.lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#78716C]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts by title, content, author, or space..."
            className="w-full bg-[#2D2926] border border-white/[0.06] rounded-xl pl-12 pr-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
          />
        </div>

        {/* Posts Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#78716C]">No posts found.</p>
          </div>
        ) : (
          <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">Post</th>
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">
                    Author
                  </th>
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">
                    Space
                  </th>
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">
                    Stats
                  </th>
                  <th className="text-left px-5 py-4 text-sm font-semibold text-[#A8A29E]">Date</th>
                  <th className="text-right px-5 py-4 text-sm font-semibold text-[#A8A29E]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {post.isPinned && <Pin className="w-4 h-4 text-[#D4836A]" />}
                        <div>
                          {post.title && (
                            <p className="font-medium text-white truncate max-w-[200px]">
                              {post.title}
                            </p>
                          )}
                          <p className="text-sm text-[#A8A29E] truncate max-w-[200px]">
                            {post.content.substring(0, 50)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-white">{post.author.name || "Anonymous"}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-1 bg-[#D4836A]/10 text-[#D4836A] text-sm rounded-full">
                        {post.space.name}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[#A8A29E]">
                        {post._count.likes} likes, {post._count.comments} comments
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[#78716C]">{formatDate(post.createdAt)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => setActionMenu(actionMenu === post.id ? null : post.id)}
                          className="p-2 rounded-lg text-[#78716C] hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {actionMenu === post.id && (
                          <>
                            <button
                              type="button"
                              aria-label="Close menu"
                              className="fixed inset-0 z-10 cursor-default"
                              onClick={() => setActionMenu(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-40 bg-[#1C1917] rounded-lg border border-white/[0.1] shadow-xl z-20 overflow-hidden">
                              <TenantLink
                                href={`/community/posts/${post.id}`}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                                View Post
                              </TenantLink>
                              <Can permission="posts.edit">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePin(post.id, post.isPinned)}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                                >
                                  <Pin
                                    className={`w-4 h-4 ${post.isPinned ? "text-[#D4836A]" : ""}`}
                                  />
                                  {post.isPinned ? "Unpin Post" : "Pin Post"}
                                </button>
                              </Can>
                              <Can permission="posts.delete">
                                <button
                                  type="button"
                                  onClick={() => handleDelete(post.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </Can>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* View Post Modal */}
        {selectedPost && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#2D2926] rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    {selectedPost.title && (
                      <h2 className="text-xl font-bold text-white mb-2">{selectedPost.title}</h2>
                    )}
                    <p className="text-sm text-[#A8A29E]">
                      By {selectedPost.author.name} in {selectedPost.space.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPost(null)}
                    className="text-[#78716C] hover:text-white"
                  >
                    &times;
                  </button>
                </div>
                <p className="text-[#E7E5E4] whitespace-pre-wrap">{selectedPost.content}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
