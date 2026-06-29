"use client";

import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Home,
  MessageSquare,
  Mic,
  Plus,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface Space {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon?: string | null;
  groupId?: string | null;
}

interface SpaceGroup {
  id: string;
  name: string;
  icon?: string;
  spaces: Space[];
}

interface LeftSidebarProps {
  user: {
    id: string;
    name: string;
    role: string;
    tagline?: string | null;
    image?: string | null;
  };
  spaces: Space[];
  spaceGroups?: SpaceGroup[];
  currentSpaceSlug?: string;
}

export function SidebarContent({ user, spaces, spaceGroups, currentSpaceSlug }: LeftSidebarProps) {
  const config = useTenantConfig();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Get current space from URL search params (e.g., ?space=announcements)
  const activeSpaceSlug = searchParams.get("space") || currentSpaceSlug;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["start-here", "discussion", "resources"]),
  );
  const [showLinks, setShowLinks] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Fetch unread counts
  const fetchUnreadCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/spaces/unread");
      if (res.ok) {
        const counts = await res.json();
        setUnreadCounts(counts);
      }
    } catch (error) {
      console.error("Failed to fetch unread counts:", error);
    }
  }, []);

  // Mark space as viewed
  const markSpaceAsViewed = useCallback(async (spaceId: string) => {
    try {
      await fetch("/api/spaces/unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId }),
      });
      // Clear the count for this space
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[spaceId];
        return next;
      });
    } catch (error) {
      console.error("Failed to mark space as viewed:", error);
    }
  }, []);

  // Fetch unread counts on mount and periodically
  useEffect(() => {
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [fetchUnreadCounts]);

  // Mark current space as viewed when it changes
  useEffect(() => {
    if (activeSpaceSlug) {
      const space = spaces.find((s) => s.slug === activeSpaceSlug);
      if (space) {
        markSpaceAsViewed(space.id);
      }
    }
  }, [activeSpaceSlug, spaces, markSpaceAsViewed]);

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const isActive = (path: string) => pathname === path;
  const isSpaceActive = (slug: string) => activeSpaceSlug === slug;

  // Default space groups if none provided
  const defaultGroups: SpaceGroup[] = [
    {
      id: "start-here",
      name: "Start Here",
      icon: "📍",
      spaces: spaces.filter((s) =>
        ["announcements", "introductions", "start-here"].includes(s.slug),
      ),
    },
    {
      id: "discussion",
      name: "Discussion",
      icon: "💬",
      spaces: spaces.filter(
        (s) => !["announcements", "introductions", "start-here"].includes(s.slug),
      ),
    },
  ];

  const groups = spaceGroups && spaceGroups.length > 0 ? spaceGroups : defaultGroups;

  return (
    <>
      {/* Main Navigation */}
      <div className="p-3 border-b border-white/[0.06]">
        <nav className="space-y-0.5">
          <NavLink
            href="/community"
            icon={<Home className="w-5 h-5" />}
            label="Feed"
            active={isActive("/community") && !activeSpaceSlug}
          />
          <a
            href={config.discordCommunityInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[#A8A29E] hover:bg-white/[0.05] hover:text-white"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="flex-1">Chat</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#78716C]" />
          </a>
          <NavLink
            href="/community/learn"
            icon={<BookOpen className="w-5 h-5" />}
            label="Courses"
            active={pathname?.startsWith("/community/learn")}
          />
          <NavLink
            href="/community/events"
            icon={<Calendar className="w-5 h-5" />}
            label="Events"
            active={isActive("/community/events")}
          />
          <NavLink
            href="/my-talks"
            icon={<Mic className="w-5 h-5" />}
            label="My talks"
            active={pathname?.startsWith("/my-talks")}
          />
          <NavLink
            href="/community/members"
            icon={<Users className="w-5 h-5" />}
            label="Members"
            active={isActive("/community/members")}
          />
          <NavLink
            href="/community/leaderboard"
            icon={<Trophy className="w-5 h-5" />}
            label="Leaderboard"
            active={pathname?.startsWith("/community/leaderboard")}
          />
        </nav>
      </div>

      {/* Space Groups */}
      <div className="flex-1 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.id} className="mb-2">
            <div className="flex items-center justify-between px-2 py-2 text-sm font-medium text-[#A8A29E] hover:text-white transition-colors group">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {group.icon && <span className="text-base">{group.icon}</span>}
                <span>{group.name}</span>
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 text-[#78716C] hover:text-white transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="p-1 text-[#78716C]"
                >
                  {expandedGroups.has(group.id) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedGroups.has(group.id) && (
              <nav className="ml-2 space-y-0.5">
                {group.spaces.map((space) => {
                  const spaceUnread = unreadCounts[space.id] || 0;
                  return (
                    <TenantLink
                      key={space.id}
                      href={`/community?space=${space.slug}`}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                        isSpaceActive(space.slug)
                          ? "bg-white/[0.08] text-white font-medium"
                          : "text-[#A8A29E] hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      {space.icon ? (
                        <span className="text-base shrink-0">{space.icon}</span>
                      ) : (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: space.color || "#D4836A" }}
                        />
                      )}
                      <span className="flex-1">{space.name}</span>
                      {spaceUnread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#D4836A] text-white text-[10px] font-medium flex items-center justify-center">
                          {spaceUnread > 99 ? "99+" : spaceUnread}
                        </span>
                      )}
                    </TenantLink>
                  );
                })}
              </nav>
            )}
          </div>
        ))}

        {/* Links Section */}
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setShowLinks(!showLinks)}
            className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-[#78716C] hover:text-white transition-colors"
          >
            <span>Links</span>
            {showLinks ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {showLinks && (
            <nav className="ml-2 space-y-0.5">
              <ExternalLinkItem href="/community/guidelines" label="Community Guidelines" />
              <ExternalLinkItem href="https://claude.ai" label="Claude.ai" external />
              <ExternalLinkItem href="https://docs.anthropic.com" label="Documentation" external />
            </nav>
          )}
        </div>

        {/* Admin Link */}
        {user.role !== "member" && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <TenantLink
              href="/admin"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#D4836A] hover:bg-[#D4836A]/10 transition-colors"
            >
              <Shield className="w-5 h-5" />
              <span>Admin Dashboard</span>
            </TenantLink>
          </div>
        )}
      </div>
    </>
  );
}

export default function LeftSidebar(props: LeftSidebarProps) {
  return (
    <aside className="w-[280px] fixed left-0 top-14 bottom-0 bg-[#1C1917] border-r border-white/[0.06] overflow-y-auto hidden lg:flex flex-col">
      <SidebarContent {...props} />
    </aside>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <TenantLink
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
        active
          ? "bg-[#D4836A]/10 text-[#D4836A] font-medium"
          : "text-[#A8A29E] hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#D4836A] text-white text-xs font-medium flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </TenantLink>
  );
}

function ExternalLinkItem({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <TenantLink
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-[#A8A29E] hover:bg-white/[0.05] hover:text-white transition-colors"
    >
      <span>{label}</span>
      {external && <ExternalLink className="w-3.5 h-3.5 text-[#78716C]" />}
    </TenantLink>
  );
}
