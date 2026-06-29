"use client";

import {
  ArrowLeft,
  Clock,
  Loader2,
  MessageSquare,
  Search,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import OnlineIndicator from "@/components/OnlineIndicator";
import { TenantLink, useTenantRouter } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { RoleBadge } from "@/components/UserBadge";
import { Avatar } from "@/components/ui/Avatar";

interface User {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  location: string | null;
  role?: string | null;
}

interface Connection {
  id: string;
  status: string;
  requesterId: string;
  receiverId: string;
  createdAt: string;
  updatedAt: string;
  requesterName: string | null;
  requesterImage: string | null;
  requesterRole?: string | null;
  receiverName: string | null;
  receiverImage: string | null;
  receiverRole?: string | null;
}

type TabType = "connections" | "pending" | "sent" | "discover";

interface ConnectionsClientProps {
  currentUserId: string;
}

const VALID_TABS: TabType[] = ["connections", "pending", "sent", "discover"];

export default function ConnectionsClient({ currentUserId }: ConnectionsClientProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1C1917]" />}>
      <ConnectionsClientInner currentUserId={currentUserId} />
    </Suspense>
  );
}

function ConnectionsClientInner({ currentUserId }: ConnectionsClientProps) {
  const searchParams = useSearchParams();
  const router = useTenantRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab") as TabType;
  const [activeTab, setActiveTab] = useState<TabType>(
    VALID_TABS.includes(tabParam) ? tabParam : "connections",
  );

  // Sync tab when URL search params change (e.g. navigating from a notification)
  useEffect(() => {
    if (VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const switchTab = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "connections") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Connection[]>([]);
  const [pendingSent, setPendingSent] = useState<Connection[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch accepted connections
      const acceptedRes = await fetch("/api/connections?status=accepted");
      if (acceptedRes.ok) {
        const data = await acceptedRes.json();
        setConnections(data);
      }

      // Fetch pending received
      const pendingReceivedRes = await fetch("/api/connections?status=pending&type=received");
      if (pendingReceivedRes.ok) {
        const data = await pendingReceivedRes.json();
        setPendingReceived(data);
      }

      // Fetch pending sent
      const pendingSentRes = await fetch("/api/connections?status=pending&type=sent");
      if (pendingSentRes.ok) {
        const data = await pendingSentRes.json();
        setPendingSent(data);
      }
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuggestedUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users?limit=20");
      if (res.ok) {
        const users = await res.json();
        // Filter out users we're already connected with, have pending requests, or is the current user
        const connectedIds = new Set([
          currentUserId, // Filter out self
          ...connections.map((c) => c.requesterId),
          ...connections.map((c) => c.receiverId),
          ...pendingReceived.map((c) => c.requesterId),
          ...pendingSent.map((c) => c.receiverId),
        ]);
        setSuggestedUsers(users.filter((u: User) => !connectedIds.has(u.id)));
      }
    } catch (error) {
      console.error("Failed to fetch suggested users:", error);
    }
  }, [currentUserId, connections, pendingReceived, pendingSent]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    if (activeTab === "discover") {
      fetchSuggestedUsers();
    }
  }, [activeTab, fetchSuggestedUsers]);

  const handleAccept = async (connectionId: string) => {
    setActionLoading(connectionId);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      if (res.ok) {
        await fetchConnections();
      }
    } catch (error) {
      console.error("Failed to accept connection:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (connectionId: string) => {
    setActionLoading(connectionId);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (res.ok) {
        await fetchConnections();
      }
    } catch (error) {
      console.error("Failed to reject connection:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (connectionId: string) => {
    setActionLoading(connectionId);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchConnections();
      }
    } catch (error) {
      console.error("Failed to remove connection:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnect = async (receiverId: string) => {
    setActionLoading(receiverId);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId }),
      });
      if (res.ok) {
        await fetchConnections();
        await fetchSuggestedUsers();
      }
    } catch (error) {
      console.error("Failed to send connection request:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredConnections = connections.filter((conn) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      conn.requesterName?.toLowerCase().includes(searchLower) ||
      conn.receiverName?.toLowerCase().includes(searchLower)
    );
  });

  const filteredSuggested = suggestedUsers.filter((user) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.bio?.toLowerCase().includes(searchLower)
    );
  });

  const tabs = [
    {
      id: "connections" as const,
      label: "Connections",
      count: connections.length,
      icon: UserCheck,
    },
    { id: "pending" as const, label: "Pending", count: pendingReceived.length, icon: Clock },
    { id: "sent" as const, label: "Sent", count: pendingSent.length, icon: UserPlus },
    { id: "discover" as const, label: "Discover", icon: Users },
  ];

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="min-h-screen bg-[#1C1917]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1C1917] border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <TenantLink
            href="/community"
            className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#A8A29E]" />
          </TenantLink>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D4836A]" />
            <h1 className="text-xl font-semibold text-white">Connections</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-[#D4836A] text-white"
                  : "bg-[#2D2926] text-[#A8A29E] hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-[#D4836A]/20 text-[#D4836A]"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        {(activeTab === "connections" || activeTab === "discover") && (
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#78716C]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === "connections" ? "Search your connections..." : "Search for people..."
              }
              className="w-full bg-[#2D2926] border border-white/[0.06] rounded-xl pl-12 pr-4 py-3 text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 focus:ring-1 focus:ring-[#D4836A]/20 transition-all"
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#D4836A] animate-spin" />
          </div>
        ) : (
          <>
            {/* Connections Tab */}
            {activeTab === "connections" && (
              <div className="space-y-3">
                {filteredConnections.length === 0 ? (
                  <EmptyState
                    icon={UserCheck}
                    title="No connections yet"
                    description="Start connecting with other community members to grow your network."
                    actionLabel="Discover People"
                    onAction={() => switchTab("discover")}
                  />
                ) : (
                  filteredConnections.map((conn) => (
                    <ConnectionCard
                      key={conn.id}
                      connection={conn}
                      type="accepted"
                      currentUserId={currentUserId}
                      onRemove={() => handleRemove(conn.id)}
                      loading={actionLoading === conn.id}
                      timeAgo={getTimeAgo(conn.updatedAt)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Pending Received Tab */}
            {activeTab === "pending" && (
              <div className="space-y-3">
                {pendingReceived.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No pending requests"
                    description="You don't have any pending connection requests at the moment."
                  />
                ) : (
                  pendingReceived.map((conn) => (
                    <ConnectionCard
                      key={conn.id}
                      connection={conn}
                      type="received"
                      currentUserId={currentUserId}
                      onAccept={() => handleAccept(conn.id)}
                      onReject={() => handleReject(conn.id)}
                      loading={actionLoading === conn.id}
                      timeAgo={getTimeAgo(conn.createdAt)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Sent Requests Tab */}
            {activeTab === "sent" && (
              <div className="space-y-3">
                {pendingSent.length === 0 ? (
                  <EmptyState
                    icon={UserPlus}
                    title="No sent requests"
                    description="You haven't sent any connection requests yet."
                    actionLabel="Discover People"
                    onAction={() => switchTab("discover")}
                  />
                ) : (
                  pendingSent.map((conn) => (
                    <ConnectionCard
                      key={conn.id}
                      connection={conn}
                      type="sent"
                      currentUserId={currentUserId}
                      onRemove={() => handleRemove(conn.id)}
                      loading={actionLoading === conn.id}
                      timeAgo={getTimeAgo(conn.createdAt)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Discover Tab */}
            {activeTab === "discover" && (
              <div className="space-y-3">
                {filteredSuggested.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={search ? "No results found" : "No suggestions available"}
                    description={
                      search
                        ? "Try a different search term."
                        : "You're already connected with everyone!"
                    }
                  />
                ) : (
                  filteredSuggested.map((user) => (
                    <SuggestedUserCard
                      key={user.id}
                      user={user}
                      onConnect={() => handleConnect(user.id)}
                      loading={actionLoading === user.id}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ConnectionCardProps {
  connection: Connection;
  type: "accepted" | "received" | "sent";
  currentUserId: string;
  onAccept?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
  loading: boolean;
  timeAgo: string;
}

function ConnectionCard({
  connection,
  type,
  currentUserId,
  onAccept,
  onReject,
  onRemove,
  loading,
  timeAgo,
}: ConnectionCardProps) {
  const config = useTenantConfig();
  // Show the "other" user: for accepted, pick whichever isn't the current user
  const isRequester = connection.requesterId === currentUserId;
  const userId = isRequester ? connection.receiverId : connection.requesterId;
  const userName = isRequester ? connection.receiverName : connection.requesterName;
  const userImage = isRequester ? connection.receiverImage : connection.requesterImage;
  const userRole = isRequester ? connection.receiverRole : connection.requesterRole;

  return (
    <div className="bg-[#2D2926] rounded-xl p-4 border border-white/[0.06] hover:border-white/[0.1] transition-all">
      <div className="flex items-center gap-4">
        <TenantLink href={`/community/profile/${userId}`} className="relative shrink-0">
          <Avatar
            src={userImage}
            name={userName}
            className="w-12 h-12 rounded-full hover:ring-2 hover:ring-[#D4836A]/50 transition-all"
            fallbackClassName="bg-[#D4836A] text-white font-bold text-lg"
          />
          <OnlineIndicator userId={userId} size="md" />
        </TenantLink>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TenantLink
              href={`/community/profile/${userId}`}
              className="font-medium text-white hover:text-[#D4836A] transition-colors truncate"
            >
              {userName || "Anonymous"}
            </TenantLink>
            {userRole?.toLowerCase() === "admin" && <RoleBadge roleName="admin" size="sm" />}
          </div>
          <p className="text-sm text-[#78716C]">
            {type === "received" && "Wants to connect with you"}
            {type === "sent" && "Pending response"}
            {type === "accepted" && `Connected ${timeAgo}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {type === "accepted" && (
            <>
              <a
                href={config.discordCommunityInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[#A8A29E] hover:text-white transition-all"
                title="Send message"
              >
                <MessageSquare className="w-5 h-5" />
              </a>
              <button
                type="button"
                onClick={onRemove}
                disabled={loading}
                className="p-2 rounded-lg bg-white/[0.05] hover:bg-red-500/20 text-[#A8A29E] hover:text-red-400 transition-all disabled:opacity-50"
                title="Remove connection"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserX className="w-5 h-5" />
                )}
              </button>
            </>
          )}

          {type === "received" && (
            <>
              <button
                type="button"
                onClick={onAccept}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4836A] hover:bg-[#c47561] text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Accept
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={loading}
                className="p-2 rounded-lg bg-white/[0.05] hover:bg-red-500/20 text-[#A8A29E] hover:text-red-400 transition-all disabled:opacity-50"
                title="Decline"
              >
                <UserX className="w-5 h-5" />
              </button>
            </>
          )}

          {type === "sent" && (
            <button
              type="button"
              onClick={onRemove}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[#A8A29E] hover:text-white text-sm transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserX className="w-4 h-4" />
                  Cancel
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface SuggestedUserCardProps {
  user: User;
  onConnect: () => void;
  loading: boolean;
}

function SuggestedUserCard({ user, onConnect, loading }: SuggestedUserCardProps) {
  return (
    <div className="bg-[#2D2926] rounded-xl p-4 border border-white/[0.06] hover:border-white/[0.1] transition-all">
      <div className="flex items-center gap-4">
        <TenantLink href={`/community/profile/${user.id}`} className="relative shrink-0">
          <Avatar
            name={user.name}
            className="w-12 h-12 rounded-full hover:ring-2 hover:ring-[#D4836A]/50 transition-all"
            fallbackClassName="bg-[#D4836A] text-white font-bold text-lg"
          />
          <OnlineIndicator userId={user.id} size="md" />
        </TenantLink>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TenantLink
              href={`/community/profile/${user.id}`}
              className="font-medium text-white hover:text-[#D4836A] transition-colors truncate"
            >
              {user.name || "Anonymous"}
            </TenantLink>
            {user.role?.toLowerCase() === "admin" && <RoleBadge roleName="admin" size="sm" />}
          </div>
          {user.bio ? (
            <p className="text-sm text-[#78716C] line-clamp-1">{user.bio}</p>
          ) : user.location ? (
            <p className="text-sm text-[#78716C]">{user.location}</p>
          ) : (
            <p className="text-sm text-[#78716C]">Community member</p>
          )}
        </div>

        <button
          type="button"
          onClick={onConnect}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4836A] hover:bg-[#c47561] text-white text-sm font-medium transition-all disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Connect
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-full bg-[#2D2926] flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-[#78716C]" />
      </div>
      <h2 className="text-lg font-medium text-white mb-2">{title}</h2>
      <p className="text-[#78716C] text-sm max-w-xs mx-auto mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4836A] hover:bg-[#c47561] text-white text-sm font-medium transition-all"
        >
          <Users className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
