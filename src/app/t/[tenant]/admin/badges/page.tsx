"use client";

import { Award, Loader2, Pencil, Plus, Search, Trash2, UserMinus, Users, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Can, useCan } from "@/components/admin/Can";
import { useTenantRouter } from "@/components/TenantBaseProvider";
import { Avatar } from "@/components/ui/Avatar";

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  createdAt: string;
  userCount: number;
}

interface BadgeUser {
  id: string;
  name: string | null;
  image: string | null;
  awardedAt: string;
}

interface BadgeDetail extends Badge {
  users: BadgeUser[];
}

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  badges: { id: string; name: string }[];
}

const EMOJI_OPTIONS = [
  "",
  "🏆",
  "🌟",
  "💎",
  "🔥",
  "⚡",
  "🎯",
  "🎨",
  "🚀",
  "💡",
  "🛡️",
  "👑",
  "🎖️",
  "🏅",
  "💪",
  "🎓",
];
const COLOR_OPTIONS = [
  "#D4836A",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#EC4899",
  "#14B8A6",
];

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: page component combines badge CRUD, badge-side and user-side award flows, and three modals; splitting would require threading the shared state/handlers across many child props with no behavioral gain.
export default function AdminBadgesPage() {
  const router = useTenantRouter();
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get("user");
  const can = useCan();
  const canAward = can("badges.edit");

  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#D4836A");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manage Users modal state (badge-side)
  const [managingBadge, setManagingBadge] = useState<BadgeDetail | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [awarding, setAwarding] = useState<string | null>(null);

  // User-side view state
  const [targetUser, setTargetUser] = useState<UserInfo | null>(null);
  const [userBadgeIds, setUserBadgeIds] = useState<Set<string>>(new Set());
  const [userViewLoading, setUserViewLoading] = useState(false);
  const [togglingBadge, setTogglingBadge] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchBadges is a stable mount-only loader; rerunning on every render would refetch unnecessarily.
  useEffect(() => {
    fetchBadges();
  }, []);

  // Handle ?user= param
  // biome-ignore lint/correctness/useExhaustiveDependencies: effect intentionally keyed on userIdParam/badges.length only; loadUserView is reconstructed each render and adding it would loop.
  useEffect(() => {
    if (userIdParam && badges.length > 0) {
      loadUserView(userIdParam);
    }
  }, [userIdParam, badges.length]);

  const fetchBadges = async () => {
    try {
      const res = await fetch("/api/admin/badges");
      if (res.ok) {
        const data = await res.json();
        setBadges(data);
      } else if (res.status === 403) {
        router.push("/community");
      }
    } catch (error) {
      console.error("Failed to fetch badges:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const mapApiUsers = (data: unknown[]): UserInfo[] => {
    return (data || []).map((raw) => {
      const u = raw as {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
        userBadges?: { badge: { id: string; name: string } }[];
      };
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image || null,
        badges: (u.userBadges || []).map((ub) => ub.badge),
      };
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mapApiUsers is a pure local mapper with no reactive inputs; omitting it keeps this callback stable.
  const fetchAllUsers = useCallback(async () => {
    if (allUsers.length > 0) return;
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        const raw = data.users || data;
        setAllUsers(mapApiUsers(raw));
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setUsersLoading(false);
    }
  }, [allUsers.length]);

  const loadUserView = async (userId: string) => {
    setUserViewLoading(true);
    try {
      // Fetch all users if not loaded
      let users = allUsers;
      if (users.length === 0) {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const data = await res.json();
          const raw = data.users || data;
          users = mapApiUsers(raw);
          setAllUsers(users);
        }
      }

      const user = users.find((u) => u.id === userId);
      if (user) {
        setTargetUser(user);
        setUserBadgeIds(new Set(user.badges?.map((b) => b.id) || []));
      }
    } catch (error) {
      console.error("Failed to load user view:", error);
    } finally {
      setUserViewLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, icon, color }),
      });

      if (res.ok) {
        const newBadge = await res.json();
        setBadges([newBadge, ...badges]);
        resetForm();
        setShowCreateModal(false);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create badge");
      }
    } catch (error) {
      console.error("Failed to create badge:", error);
      alert("Failed to create badge");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBadge || !name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/badges/${editingBadge.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, icon, color }),
      });

      if (res.ok) {
        setBadges(
          badges.map((b) =>
            b.id === editingBadge.id ? { ...b, name, description, icon, color } : b,
          ),
        );
        resetForm();
        setEditingBadge(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update badge");
      }
    } catch (error) {
      console.error("Failed to update badge:", error);
      alert("Failed to update badge");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (badge: Badge) => {
    if (!confirm(`Are you sure you want to delete the "${badge.name}" badge?`)) return;

    try {
      const res = await fetch(`/api/admin/badges/${badge.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setBadges(badges.filter((b) => b.id !== badge.id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete badge");
      }
    } catch (error) {
      console.error("Failed to delete badge:", error);
      alert("Failed to delete badge");
    }
  };

  const openEditModal = (badge: Badge) => {
    setEditingBadge(badge);
    setName(badge.name);
    setDescription(badge.description || "");
    setIcon(badge.icon || "");
    setColor(badge.color || "#D4836A");
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setIcon("");
    setColor("#D4836A");
  };

  // Badge-side: open manage users modal
  const openManageUsers = async (badge: Badge) => {
    setManageLoading(true);
    setManagingBadge({ ...badge, users: [] });
    setUserSearch("");
    try {
      const [badgeRes] = await Promise.all([
        fetch(`/api/admin/badges/${badge.id}`),
        fetchAllUsers(),
      ]);
      if (badgeRes.ok) {
        const data = await badgeRes.json();
        setManagingBadge(data);
      }
    } catch (error) {
      console.error("Failed to load badge details:", error);
    } finally {
      setManageLoading(false);
    }
  };

  // Award badge to user (badge-side modal)
  const handleAward = async (userId: string, badgeId: string) => {
    setAwarding(userId);
    try {
      const res = await fetch(`/api/admin/badges/${badgeId}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        const user = allUsers.find((u) => u.id === userId);
        if (managingBadge) {
          setManagingBadge({
            ...managingBadge,
            users: [
              ...managingBadge.users,
              {
                id: userId,
                name: user?.name || null,
                image: user?.image || null,
                awardedAt: new Date().toISOString(),
              },
            ],
          });
        }
        setBadges(badges.map((b) => (b.id === badgeId ? { ...b, userCount: b.userCount + 1 } : b)));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to award badge");
      }
    } catch (error) {
      console.error("Failed to award badge:", error);
    } finally {
      setAwarding(null);
    }
  };

  // Revoke badge from user (badge-side modal)
  const handleRevoke = async (userId: string, badgeId: string) => {
    setAwarding(userId);
    try {
      const res = await fetch(`/api/admin/badges/${badgeId}/award`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        if (managingBadge) {
          setManagingBadge({
            ...managingBadge,
            users: managingBadge.users.filter((u) => u.id !== userId),
          });
        }
        setBadges(
          badges.map((b) =>
            b.id === badgeId ? { ...b, userCount: Math.max(0, b.userCount - 1) } : b,
          ),
        );
      } else {
        const data = await res.json();
        alert(data.error || "Failed to revoke badge");
      }
    } catch (error) {
      console.error("Failed to revoke badge:", error);
    } finally {
      setAwarding(null);
    }
  };

  // User-side: toggle badge on/off
  const handleToggleBadge = async (badgeId: string) => {
    if (!targetUser || togglingBadge) return;
    setTogglingBadge(badgeId);

    const isAwarded = userBadgeIds.has(badgeId);

    try {
      const res = await fetch(`/api/admin/badges/${badgeId}/award`, {
        method: isAwarded ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUser.id }),
      });

      if (res.ok) {
        setUserBadgeIds((prev) => {
          const next = new Set(prev);
          if (isAwarded) {
            next.delete(badgeId);
          } else {
            next.add(badgeId);
          }
          return next;
        });
        setBadges(
          badges.map((b) =>
            b.id === badgeId ? { ...b, userCount: b.userCount + (isAwarded ? -1 : 1) } : b,
          ),
        );
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update badge");
      }
    } catch (error) {
      console.error("Failed to toggle badge:", error);
    } finally {
      setTogglingBadge(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1C1917] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D4836A] animate-spin" />
      </div>
    );
  }

  // User-side view: manage badges for a specific user
  if (userIdParam && targetUser) {
    return (
      <div className="min-h-screen bg-[#1C1917]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* User Info */}
          <div className="flex items-center gap-4 p-5 bg-[#2D2926] rounded-xl border border-white/[0.06] mb-8">
            <Avatar
              src={targetUser.image}
              name={targetUser.name}
              alt={targetUser.name || ""}
              className="w-14 h-14 rounded-full"
              fallbackClassName="bg-[#D4836A] text-white text-xl font-bold"
            />
            <div>
              <h2 className="text-lg font-semibold text-white">{targetUser.name || "Anonymous"}</h2>
              {targetUser.email && <p className="text-sm text-[#78716C]">{targetUser.email}</p>}
            </div>
          </div>

          {/* Badge Toggle Grid */}
          {badges.length === 0 ? (
            <div className="bg-[#2D2926] rounded-xl p-12 text-center border border-white/[0.06]">
              <Award className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No badges yet</h3>
              <p className="text-[#78716C] mb-4">Create badges first before awarding them</p>
              <button
                type="button"
                onClick={() => router.push("/admin/badges")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Manage Badges
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {badges.map((badge) => {
                const isAwarded = userBadgeIds.has(badge.id);
                const isToggling = togglingBadge === badge.id;

                return (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => handleToggleBadge(badge.id)}
                    disabled={isToggling || !canAward}
                    className={`text-left p-5 rounded-xl border transition-all ${
                      isAwarded
                        ? "bg-[#2D2926] border-[#D4836A]/50 ring-1 ring-[#D4836A]/20"
                        : "bg-[#2D2926] border-white/[0.06] hover:border-white/[0.12] opacity-60 hover:opacity-100"
                    } disabled:cursor-wait disabled:hover:border-white/[0.06]`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${badge.color}20` }}
                      >
                        {badge.icon || (
                          <Award className="w-6 h-6" style={{ color: badge.color || "#D4836A" }} />
                        )}
                      </div>
                      {isToggling ? (
                        <Loader2 className="w-5 h-5 text-[#D4836A] animate-spin" />
                      ) : isAwarded ? (
                        <span className="text-xs font-medium text-[#D4836A] bg-[#D4836A]/10 px-2 py-1 rounded-full">
                          Awarded
                        </span>
                      ) : canAward ? (
                        <span className="text-xs font-medium text-[#78716C]">Click to award</span>
                      ) : null}
                    </div>
                    <h3 className="font-semibold text-white mb-1">{badge.name}</h3>
                    {badge.description && (
                      <p className="text-[#78716C] text-sm line-clamp-2">{badge.description}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show loading for user view
  if (userIdParam && userViewLoading) {
    return (
      <div className="min-h-screen bg-[#1C1917] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D4836A] animate-spin" />
      </div>
    );
  }

  // Default: badge listing view
  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Actions */}
        <Can permission="badges.edit">
          <div className="flex items-center justify-end mb-8">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Badge
            </button>
          </div>
        </Can>

        {/* Badges Grid */}
        {badges.length === 0 ? (
          <div className="bg-[#2D2926] rounded-xl p-12 text-center border border-white/[0.06]">
            <Award className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No badges yet</h3>
            <p className="text-[#78716C] mb-6">
              Create your first badge to award to community members
            </p>
            <Can permission="badges.edit">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Badge
              </button>
            </Can>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="bg-[#2D2926] rounded-xl p-5 border border-white/[0.06] hover:border-white/[0.12] transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${badge.color}20` }}
                  >
                    {badge.icon || (
                      <Award className="w-6 h-6" style={{ color: badge.color || "#D4836A" }} />
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Can permission="badges.edit">
                      <button
                        type="button"
                        onClick={() => openManageUsers(badge)}
                        className="p-2 text-[#78716C] hover:text-[#D4836A] hover:bg-[#D4836A]/10 rounded-lg transition-colors"
                        title="Manage Users"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(badge)}
                        className="p-2 text-[#78716C] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </Can>
                    <Can permission="badges.delete">
                      <button
                        type="button"
                        onClick={() => handleDelete(badge)}
                        className="p-2 text-[#78716C] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Can>
                  </div>
                </div>
                <h3 className="font-semibold text-white mb-1">{badge.name}</h3>
                {badge.description && (
                  <p className="text-[#78716C] text-sm mb-3 line-clamp-2">{badge.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-[#78716C]">
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    {badge.userCount} user{badge.userCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingBadge) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setShowCreateModal(false);
              setEditingBadge(null);
              resetForm();
            }}
          />
          <div className="relative bg-[#2D2926] rounded-2xl border border-white/[0.1] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/[0.06]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {editingBadge ? "Edit Badge" : "Create Badge"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingBadge(null);
                    resetForm();
                  }}
                  className="p-2 text-[#78716C] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={editingBadge ? handleUpdate : handleCreate} className="p-6 space-y-5">
              {/* Preview */}
              <div className="flex items-center gap-4 p-4 bg-[#1C1917] rounded-xl">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
                  style={{ backgroundColor: `${color}20` }}
                >
                  {icon || <Award className="w-7 h-7" style={{ color }} />}
                </div>
                <div>
                  <p className="font-semibold text-white">{name || "Badge Name"}</p>
                  <p className="text-[#78716C] text-sm">{description || "Badge description"}</p>
                </div>
              </div>

              {/* Name */}
              <div>
                <label
                  htmlFor="badge-name"
                  className="block text-sm font-medium text-[#A8A29E] mb-2"
                >
                  Name
                </label>
                <input
                  id="badge-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Community Pioneer"
                  className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="badge-description"
                  className="block text-sm font-medium text-[#A8A29E] mb-2"
                >
                  Description
                </label>
                <input
                  id="badge-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Awarded to early community members"
                  className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                />
              </div>

              {/* Icon */}
              <fieldset className="border-0 p-0 m-0">
                <legend className="block text-sm font-medium text-[#A8A29E] mb-2">
                  Icon (Emoji)
                </legend>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIcon(emoji)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-colors ${
                        icon === emoji
                          ? "bg-[#D4836A]/20 ring-2 ring-[#D4836A]"
                          : "bg-[#1C1917] hover:bg-white/[0.05]"
                      }`}
                    >
                      {emoji || <Award className="w-5 h-5 text-[#78716C]" />}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Color */}
              <fieldset className="border-0 p-0 m-0">
                <legend className="block text-sm font-medium text-[#A8A29E] mb-2">Color</legend>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#2D2926]" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </fieldset>

              {/* Submit */}
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="w-full py-3 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {editingBadge ? "Updating..." : "Creating..."}
                  </>
                ) : editingBadge ? (
                  "Update Badge"
                ) : (
                  "Create Badge"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Manage Users Modal (badge-side) */}
      {managingBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setManagingBadge(null)}
          />
          <div className="relative bg-[#2D2926] rounded-2xl border border-white/[0.1] w-full max-w-lg overflow-hidden shadow-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${managingBadge.color}20` }}
                  >
                    {managingBadge.icon || (
                      <Award
                        className="w-5 h-5"
                        style={{ color: managingBadge.color || "#D4836A" }}
                      />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{managingBadge.name}</h2>
                    <p className="text-sm text-[#78716C]">Manage awarded users</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManagingBadge(null)}
                  className="p-2 text-[#78716C] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {manageLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#D4836A] animate-spin" />
                </div>
              ) : (
                <>
                  {/* Currently awarded users */}
                  {managingBadge.users.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-[#A8A29E] mb-3">
                        Awarded ({managingBadge.users.length})
                      </h3>
                      <div className="space-y-2">
                        {managingBadge.users.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-3 bg-[#1C1917] rounded-xl"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={u.image}
                                name={u.name}
                                alt={u.name || ""}
                                className="w-8 h-8 rounded-full"
                                fallbackClassName="bg-[#D4836A] text-white text-sm font-bold"
                              />
                              <span className="text-white text-sm">{u.name || "Anonymous"}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRevoke(u.id, managingBadge.id)}
                              disabled={awarding === u.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {awarding === u.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserMinus className="w-3.5 h-3.5" />
                              )}
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search users to award */}
                  <div>
                    <h3 className="text-sm font-medium text-[#A8A29E] mb-3">Award to user</h3>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search users by name or email..."
                        className="w-full bg-[#1C1917] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50"
                      />
                    </div>
                    {usersLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-[#78716C] animate-spin" />
                      </div>
                    ) : userSearch.trim() ? (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {allUsers
                          .filter((u) => {
                            const search = userSearch.toLowerCase();
                            const nameMatch = u.name?.toLowerCase().includes(search);
                            const emailMatch = u.email?.toLowerCase().includes(search);
                            return nameMatch || emailMatch;
                          })
                          .filter((u) => !managingBadge.users.some((bu) => bu.id === u.id))
                          .slice(0, 10)
                          .map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center justify-between p-3 bg-[#1C1917] rounded-xl hover:bg-white/[0.03] transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar
                                  src={u.image}
                                  name={u.name}
                                  alt={u.name || ""}
                                  className="w-8 h-8 rounded-full"
                                  fallbackClassName="bg-[#78716C] text-white text-sm font-bold"
                                />
                                <div>
                                  <span className="text-white text-sm">
                                    {u.name || "Anonymous"}
                                  </span>
                                  {u.email && <p className="text-xs text-[#78716C]">{u.email}</p>}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAward(u.id, managingBadge.id)}
                                disabled={awarding === u.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#D4836A] bg-[#D4836A]/10 hover:bg-[#D4836A]/20 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {awarding === u.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5" />
                                )}
                                Award
                              </button>
                            </div>
                          ))}
                        {allUsers.filter((u) => {
                          const search = userSearch.toLowerCase();
                          return (
                            (u.name?.toLowerCase().includes(search) ||
                              u.email?.toLowerCase().includes(search)) &&
                            !managingBadge.users.some((bu) => bu.id === u.id)
                          );
                        }).length === 0 && (
                          <p className="text-sm text-[#78716C] text-center py-4">
                            No matching users found
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-[#78716C] text-center py-4">
                        Type to search for users
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
