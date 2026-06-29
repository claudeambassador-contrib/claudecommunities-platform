"use client";

import {
  Calendar,
  Check,
  Clock,
  Loader2,
  MapPin,
  Search,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { Avatar } from "@/components/ui/Avatar";
import OnlineIndicator from "./OnlineIndicator";
import { RoleBadge } from "./UserBadge";

interface Member {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  tagline: string | null;
  location: string | null;
  role: string;
  points: number;
  level: number;
  isOnline: boolean;
  createdAt: string;
  _count: {
    posts: number;
  };
  badges?: { id: string; name: string; icon: string | null; color: string | null }[];
}

interface Connection {
  id: string;
  status: string;
  requesterId: string;
  receiverId: string;
}

interface CurrentUser {
  id: string;
  name: string | null;
  image: string | null;
  tagline: string | null;
  location: string | null;
  role: string;
  points: number;
  level: number;
  _count: { posts: number };
}

interface MemberTabCounts {
  recent: number;
  online: number;
  nearMe: number;
}

interface MemberGridProps {
  initialMembers: Member[];
  /** Filtered total for the "all" tab (excludes self + banned). */
  initialTotal: number;
  tabCounts: MemberTabCounts;
  currentUser: CurrentUser;
  currentUserId: string;
  initialConnections: Connection[];
}

type TabFilter = "all" | "near-me" | "online" | "recent" | "connections";

const LEVEL_NAMES: Record<number, string> = {
  1: "Newcomer",
  2: "Explorer",
  3: "Contributor",
  4: "Active Member",
  5: "Rising Star",
  6: "Community Builder",
  7: "Expert",
  8: "Champion",
  9: "Legend",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-slate-500",
  2: "bg-green-600",
  3: "bg-blue-600",
  4: "bg-purple-600",
  5: "bg-yellow-500",
  6: "bg-orange-500",
  7: "bg-red-500",
  8: "bg-pink-500",
  9: "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600",
};

export default function MemberGrid({
  initialMembers,
  initialTotal,
  tabCounts,
  currentUser,
  currentUserId,
  initialConnections,
}: MemberGridProps) {
  const config = useTenantConfig();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [total, setTotal] = useState(initialTotal);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [pendingConnections, setPendingConnections] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // How many rows are currently loaded — the next page's offset.
  const loadedCountRef = useRef(initialMembers.length);
  // Monotonic request id so stale responses (older search/tab) are discarded.
  const reqSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const firstRenderRef = useRef(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch a page from the server. `append` adds the next page; otherwise it
  // replaces the list (search/tab change). Sequenced + aborted so out-of-order
  // responses never clobber the current view.
  const fetchMembers = useCallback(async (tab: TabFilter, searchValue: string, append: boolean) => {
    const seq = ++reqSeqRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const offset = append ? loadedCountRef.current : 0;
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchValue.trim()) params.set("search", searchValue.trim());
      if (tab !== "all") params.set("tab", tab);
      if (offset > 0) params.set("offset", String(offset));

      const res = await fetch(`/api/members?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = (await res.json()) as { members: Member[]; total: number };

      // A newer query started while this was in flight — drop the result.
      if (seq !== reqSeqRef.current) return;

      setTotal(data.total);
      if (append) {
        setMembers((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev, ...data.members.filter((m) => !seen.has(m.id))];
          loadedCountRef.current = merged.length;
          return merged;
        });
      } else {
        loadedCountRef.current = data.members.length;
        setMembers(data.members);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Failed to load members:", err);
      }
    } finally {
      if (seq === reqSeqRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  // Debounce the search box into `debouncedSearch`.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Re-query whenever the tab or debounced search changes (skip first render —
  // the server already provided the initial "all" page).
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    fetchMembers(activeTab, debouncedSearch, false);
  }, [activeTab, debouncedSearch, fetchMembers]);

  // Get connection status for a member
  const getConnectionStatus = useCallback(
    (memberId: string): "none" | "pending" | "accepted" | "received" => {
      const connection = connections.find(
        (c) =>
          (c.requesterId === currentUserId && c.receiverId === memberId) ||
          (c.receiverId === currentUserId && c.requesterId === memberId),
      );
      if (!connection) return "none";
      if (connection.status === "accepted") return "accepted";
      if (connection.requesterId === currentUserId) return "pending";
      return "received";
    },
    [connections, currentUserId],
  );

  // Handle connection request
  const handleConnect = async (memberId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (pendingConnections.has(memberId)) return;

    setPendingConnections((prev) => new Set(prev).add(memberId));

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: memberId }),
      });

      if (res.ok) {
        const newConnection = await res.json();
        setConnections((prev) => [...prev, newConnection]);
      }
    } catch (error) {
      console.error("Failed to create connection:", error);
    } finally {
      setPendingConnections((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  // Set of accepted connection member IDs
  const connectedMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of connections) {
      if (c.status === "accepted") {
        const otherId = c.requesterId === currentUserId ? c.receiverId : c.requesterId;
        ids.add(otherId);
      }
    }
    return ids;
  }, [connections, currentUserId]);

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore && members.length < total) {
          fetchMembers(activeTab, debouncedSearch, true);
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);

    return () => observerRef.current?.disconnect();
  }, [activeTab, debouncedSearch, members.length, total, isLoading, isLoadingMore, fetchMembers]);

  const getMemberSince = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(config.lang, { month: "short", year: "numeric" });
  };

  const tabs = [
    { id: "all" as const, label: "All members", count: initialTotal },
    { id: "near-me" as const, label: "Near me", count: tabCounts.nearMe },
    { id: "online" as const, label: "Online now", count: tabCounts.online },
    { id: "recent" as const, label: "Recently joined", count: tabCounts.recent },
    { id: "connections" as const, label: "Connections", count: connectedMemberIds.size },
  ];

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[#D4836A] text-white"
                : "bg-[#2D2926] text-[#A8A29E] hover:text-white hover:bg-[#3D3936]"
            }`}
          >
            {tab.label}
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-white/10 text-[#78716C]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#78716C]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members by name, tagline, bio, or location..."
          className="w-full bg-[#2D2926] border border-white/[0.06] rounded-xl pl-12 pr-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 focus:ring-1 focus:ring-[#D4836A]/20 transition-all"
        />
      </div>

      {/* Your Profile Card */}
      {activeTab === "all" && !debouncedSearch && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[#78716C] mb-3">Your Profile</h3>
          <TenantLink
            href={`/community/profile/${currentUserId}`}
            className="flex items-center gap-4 p-4 bg-[#2D2926] rounded-xl border border-[#D4836A]/30 hover:border-[#D4836A]/50 transition-all"
          >
            <div className="relative flex-shrink-0">
              <Avatar
                src={currentUser.image}
                name={currentUser.name}
                alt={currentUser.name || "You"}
                className="w-14 h-14 rounded-full ring-2 ring-[#D4836A]/30"
                fallbackClassName="bg-[#D4836A] text-white text-xl font-bold"
              />
              <OnlineIndicator userId={currentUserId} size="lg" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-base flex items-center gap-2 flex-wrap">
                <span>
                  {currentUser.name || "Anonymous"}{" "}
                  <span className="text-[#D4836A] text-sm font-normal">(You)</span>
                </span>
                {currentUser.role?.toLowerCase() === "admin" && (
                  <RoleBadge roleName="admin" size="sm" />
                )}
              </h3>
              {currentUser.tagline && (
                <p className="text-[#A8A29E] text-sm truncate mt-0.5">{currentUser.tagline}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${
                    LEVEL_COLORS[currentUser.level] || LEVEL_COLORS[1]
                  }`}
                >
                  Lvl {currentUser.level}
                </span>
                <span className="flex items-center gap-1 text-xs text-[#D4836A]">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {currentUser.points.toLocaleString()} pts
                </span>
                <span className="text-xs text-[#78716C]">{currentUser._count.posts} posts</span>
              </div>
            </div>
            <div className="text-[#78716C] text-sm">View Profile →</div>
          </TenantLink>
        </div>
      )}

      {/* Results count */}
      <div className="mb-4 text-sm text-[#78716C]">
        Showing {members.length} of {total} members
      </div>

      {/* Grid */}
      {!isLoading && members.length === 0 ? (
        <div className="text-center py-16">
          {activeTab === "near-me" ? (
            <>
              <MapPin className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
              <p className="text-white font-medium mb-2">No members nearby</p>
              <p className="text-[#78716C] text-sm max-w-md mx-auto">
                {currentUser.location
                  ? "No other members share your location yet. Check back later or explore all members."
                  : "Add your location to your profile to find members near you."}
              </p>
              <TenantLink
                href={`/community/profile/${currentUserId}`}
                className="inline-block mt-4 px-4 py-2 bg-[#D4836A] hover:bg-[#c4735a] text-white text-sm font-medium rounded-xl transition-colors"
              >
                {currentUser.location ? "View All Members" : "Update Your Profile"}
              </TenantLink>
            </>
          ) : (
            <>
              <Users className="w-12 h-12 text-[#78716C] mx-auto mb-4" />
              <p className="text-[#78716C]">
                {debouncedSearch ? "No members match your search." : "No members found."}
              </p>
              {debouncedSearch && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-3 text-sm text-[#D4836A] hover:underline"
                >
                  Clear search
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {members.map((member) => {
              const connectionStatus = getConnectionStatus(member.id);
              const isPending = pendingConnections.has(member.id);

              return (
                <div
                  key={member.id}
                  className="bg-[#2D2926] rounded-2xl p-5 border border-white/[0.06] hover:border-[#D4836A]/30 hover:shadow-lg hover:shadow-black/20 transition-all duration-200 group flex flex-col"
                >
                  {/* Header with Avatar */}
                  <TenantLink
                    href={`/community/profile/${member.id}`}
                    className="flex items-start gap-3 mb-3"
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar
                        src={member.image}
                        name={member.name}
                        alt={member.name || "Member"}
                        className="w-14 h-14 rounded-full group-hover:ring-2 group-hover:ring-[#D4836A]/50 transition-all"
                        fallbackClassName="bg-[#D4836A] text-white text-xl font-bold"
                      />
                      <OnlineIndicator userId={member.id} size="lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-base truncate group-hover:text-[#D4836A] transition-colors">
                          {member.name || "Anonymous"}
                        </h3>
                        {member.role?.toLowerCase() === "admin" && (
                          <RoleBadge roleName="admin" size="sm" />
                        )}
                      </div>
                      {member.tagline && (
                        <p className="text-[#A8A29E] text-sm truncate mt-0.5">{member.tagline}</p>
                      )}
                    </div>
                  </TenantLink>

                  {/* User Badges */}
                  {member.badges && member.badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {member.badges.map((badge) => (
                        <span
                          key={badge.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${badge.color}20`,
                            color: badge.color || "#fff",
                          }}
                          title={badge.name}
                        >
                          <span>{badge.icon}</span>
                          {badge.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Level Badge and Points */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${
                        LEVEL_COLORS[member.level] || LEVEL_COLORS[1]
                      }`}
                    >
                      Lvl {member.level} - {LEVEL_NAMES[member.level] || "Newcomer"}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[#D4836A]">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {member.points.toLocaleString()}
                    </span>
                  </div>

                  {/* Bio snippet */}
                  {member.bio && (
                    <p className="text-[#78716C] text-sm line-clamp-2 mb-4 flex-1">{member.bio}</p>
                  )}

                  {/* Location and Joined Date */}
                  <div className="flex flex-wrap gap-3 text-xs text-[#78716C] mb-4">
                    {member.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {member.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Joined {getMemberSince(member.createdAt)}
                    </span>
                  </div>

                  {/* Connect Button */}
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    {connectionStatus === "none" && (
                      <button
                        type="button"
                        onClick={(e) => handleConnect(member.id, e)}
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D4836A] hover:bg-[#c4735a] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            Connect
                          </>
                        )}
                      </button>
                    )}
                    {connectionStatus === "pending" && (
                      <button
                        type="button"
                        disabled
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3D3936] text-[#A8A29E] text-sm font-medium rounded-xl cursor-not-allowed"
                      >
                        <Clock className="w-4 h-4" />
                        Pending
                      </button>
                    )}
                    {connectionStatus === "accepted" && (
                      <button
                        type="button"
                        disabled
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600/20 text-green-400 text-sm font-medium rounded-xl cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" />
                        Connected
                      </button>
                    )}
                    {connectionStatus === "received" && (
                      <TenantLink
                        href="/community/connections?tab=pending"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D4836A]/20 text-[#D4836A] text-sm font-medium rounded-xl hover:bg-[#D4836A]/30 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Respond to request
                      </TenantLink>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more trigger */}
          {members.length < total && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-[#78716C]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading more members...
                </div>
              ) : (
                <div className="text-[#78716C] text-sm">Scroll for more members</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
