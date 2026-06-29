"use client";

import {
  Bug,
  Calendar,
  ExternalLink,
  Heart,
  MessageCircle,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { Avatar } from "@/components/ui/Avatar";
import { EventAttendance } from "./EventAttendance";
import { useOnlineStatus } from "./OnlineStatusProvider";

interface Member {
  id: string;
  name: string | null;
  image: string | null;
}

interface EventAttendee {
  id: string;
  name: string | null;
  image: string | null;
}

interface Event {
  id: string;
  slug: string | null;
  title: string;
  startTime: string;
  location: string | null;
  lumaUrl?: string | null;
  rsvpEnabled?: boolean;
  attendeeCount?: number;
  attendees?: EventAttendee[];
  isRsvped?: boolean;
}

interface TrendingPost {
  id: string;
  title: string | null;
  content: string;
  author: {
    id: string;
    name: string | null;
  };
  _count: {
    likes: number;
    comments: number;
  };
}

interface OnlineMember {
  id: string;
  name: string | null;
  image: string | null;
}

interface TopContributor {
  id: string;
  name: string | null;
  image: string | null;
  points: number;
}

interface RightSidebarProps {
  memberCount: number;
  recentMembers: Member[];
  upcomingEventCount: number;
  upcomingEvents?: Event[];
  trendingPosts?: TrendingPost[];
  onlineMembers?: OnlineMember[];
  topContributors?: TopContributor[];
  currentUserId?: string;
}

export default function RightSidebar({
  memberCount,
  recentMembers,
  upcomingEventCount,
  upcomingEvents = [],
  trendingPosts = [],
  onlineMembers = [],
  topContributors = [],
  currentUserId,
}: RightSidebarProps) {
  const { countryName, lang } = useTenantConfig();
  const [rsvpingEventId, setRsvpingEventId] = useState<string | null>(null);
  const [rsvpedEvents, setRsvpedEvents] = useState<Set<string>>(
    new Set(upcomingEvents.filter((e) => e.isRsvped).map((e) => e.id)),
  );
  const { onlineUserIds } = useOnlineStatus();

  const handleRsvp = async (eventId: string) => {
    if (!currentUserId) return;

    setRsvpingEventId(eventId);
    const isCurrentlyRsvped = rsvpedEvents.has(eventId);

    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isCurrentlyRsvped ? "not_going" : "going" }),
      });
      if (res.ok) {
        setRsvpedEvents((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(eventId)) {
            newSet.delete(eventId);
          } else {
            newSet.add(eventId);
          }
          return newSet;
        });
      }
    } catch (error) {
      console.error("Failed to RSVP:", error);
    } finally {
      setRsvpingEventId(null);
    }
  };

  const avatarColors = [
    "from-[#D4836A] to-[#B66B54]",
    "from-[#8B5CF6] to-[#7C3AED]",
    "from-[#10B981] to-[#059669]",
    "from-[#F59E0B] to-[#D97706]",
    "from-[#3B82F6] to-[#2563EB]",
    "from-[#EC4899] to-[#DB2777]",
  ];

  // Calculate online members count from context
  const actualOnlineCount = onlineUserIds.size;

  return (
    <aside className="w-[300px] fixed right-0 top-14 bottom-0 bg-[#1C1917] border-l border-white/[0.06] overflow-y-auto hidden xl:block">
      <div className="p-4 space-y-4">
        {/* About Community - Compact */}
        <div className="rounded-xl p-4 bg-gradient-to-br from-[#2D2926] to-[#252220] border border-white/[0.06]">
          <p className="text-[#A8A29E] text-sm leading-relaxed">
            {`Connect with Claude Code enthusiasts across ${countryName}.`} Share experiences, get
            help, and join local meetups.
          </p>
        </div>

        {/* Upcoming Events */}
        <div className="rounded-xl p-4 bg-[#2D2926] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#8B5CF6]" />
              <h3 className="font-medium text-white text-sm">Upcoming Events</h3>
            </div>
            {upcomingEventCount > 0 && (
              <span className="px-1.5 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs font-medium rounded-full">
                {upcomingEventCount}
              </span>
            )}
          </div>

          {/* Event Cards */}
          {upcomingEvents.length > 0 ? (
            <div className="space-y-2 mb-3">
              {upcomingEvents.slice(0, 2).map((event) => {
                const date = new Date(event.startTime);
                const day = date.getDate();
                const month = date.toLocaleDateString(lang, { month: "short" });
                const isRsvped = rsvpedEvents.has(event.id);
                const isRsvping = rsvpingEventId === event.id;

                return (
                  <div
                    key={event.id}
                    className="flex gap-2.5 p-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] text-[#8B5CF6] font-medium uppercase">
                        {month}
                      </span>
                      <span className="text-sm font-bold text-white leading-none">{day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <TenantLink href={`/events/${event.slug || event.id}`}>
                        <h4 className="text-sm font-medium text-white hover:text-[#8B5CF6] transition-colors line-clamp-1">
                          {event.title}
                        </h4>
                      </TenantLink>
                      <div className="flex items-center justify-between mt-1">
                        <EventAttendance event={event}>
                          <span className="text-xs text-[#78716C]">
                            {event.attendeeCount || 0} going
                          </span>
                        </EventAttendance>
                        {currentUserId && (
                          <button
                            type="button"
                            onClick={() => handleRsvp(event.id)}
                            disabled={isRsvping}
                            className={`ml-auto px-2 py-0.5 text-xs font-medium rounded transition-all ${
                              isRsvped
                                ? "bg-[#10B981]/20 text-[#10B981]"
                                : "bg-[#8B5CF6]/20 text-[#8B5CF6]"
                            }`}
                          >
                            {isRsvping ? "..." : isRsvped ? "Going" : "RSVP"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#78716C] text-center py-3">No upcoming events</p>
          )}

          <TenantLink
            href="/events"
            className="block text-center py-2 text-sm text-[#8B5CF6] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            See all events
          </TenantLink>
        </div>

        {/* Trending Posts */}
        {trendingPosts.length > 0 && (
          <div className="rounded-xl p-4 bg-[#2D2926] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="font-medium text-white text-sm">Trending</h3>
            </div>

            <div className="space-y-2">
              {trendingPosts.slice(0, 3).map((post, index) => (
                <TenantLink
                  key={post.id}
                  href={`/community/posts/${post.id}`}
                  className="flex gap-2 group"
                >
                  <span className="text-[#57534E] text-xs shrink-0 w-4">{index + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm text-[#E7E5E4] group-hover:text-[#D4836A] transition-colors line-clamp-1">
                      {post.title || post.content.slice(0, 50)}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-[#57534E] mt-0.5">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {post._count.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {post._count.comments}
                      </span>
                    </div>
                  </div>
                </TenantLink>
              ))}
            </div>
          </div>
        )}

        {/* Online Members */}
        {actualOnlineCount > 0 && (
          <div className="rounded-xl p-4 bg-[#2D2926] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse" />
                <h3 className="font-medium text-white text-sm">Online</h3>
              </div>
              <span className="text-[#10B981] text-sm">{actualOnlineCount}</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {onlineMembers
                .filter((m) => onlineUserIds.has(m.id))
                .slice(0, 8)
                .map((member, index) => (
                  <TenantLink
                    key={member.id}
                    href={`/community/profile/${member.id}`}
                    title={member.name || "Member"}
                  >
                    <Avatar
                      src={member.image}
                      name={member.name}
                      alt={member.name || "Member"}
                      className="w-8 h-8 rounded-full hover:scale-110 transition-transform"
                      imgClassName="ring-2 ring-[#10B981]/50"
                      fallbackClassName={`bg-gradient-to-br ${avatarColors[index % avatarColors.length]} text-white text-xs font-bold`}
                    />
                  </TenantLink>
                ))}
              {actualOnlineCount > 8 && (
                <div className="w-8 h-8 rounded-full bg-[#3D3936] flex items-center justify-center text-[#A8A29E] text-xs">
                  +{actualOnlineCount - 8}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Contributors */}
        {topContributors.length > 0 && (
          <div className="rounded-xl p-4 bg-[#2D2926] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="font-medium text-white text-sm">Top Contributors</h3>
            </div>

            <div className="space-y-2">
              {topContributors.slice(0, 3).map((contributor, index) => (
                <TenantLink
                  key={contributor.id}
                  href={`/community/profile/${contributor.id}`}
                  className="flex items-center gap-2.5 group"
                >
                  <span className="text-xs text-[#57534E] w-4">{index + 1}.</span>
                  <Avatar
                    src={contributor.image}
                    name={contributor.name}
                    alt={contributor.name || "Contributor"}
                    className="w-7 h-7 rounded-full"
                    fallbackClassName={`bg-gradient-to-br ${avatarColors[index % avatarColors.length]} text-white text-xs font-bold`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white group-hover:text-[#D4836A] transition-colors truncate">
                      {contributor.name || "Anonymous"}
                    </p>
                  </div>
                  <span className="text-xs text-[#F59E0B]">{contributor.points}</span>
                </TenantLink>
              ))}
            </div>

            <TenantLink
              href="/community/leaderboard"
              className="block text-center py-2 mt-2 text-sm text-[#F59E0B] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
            >
              View all
            </TenantLink>
          </div>
        )}

        {/* Members */}
        <div className="rounded-xl p-4 bg-[#2D2926] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D4836A]" />
              <h3 className="font-medium text-white text-sm">Members</h3>
            </div>
            <span className="text-[#D4836A] text-sm">{memberCount}</span>
          </div>

          <div className="flex -space-x-1.5 mb-3">
            {recentMembers.slice(0, 6).map((member, index) => (
              <TenantLink
                key={member.id}
                href={`/community/profile/${member.id}`}
                title={member.name || "Member"}
                className="relative hover:scale-110 hover:z-10 transition-transform"
              >
                <Avatar
                  src={member.image}
                  name={member.name}
                  alt={member.name || "Member"}
                  className="w-8 h-8 rounded-full border-2 border-[#2D2926]"
                  fallbackClassName={`bg-gradient-to-br ${avatarColors[index % avatarColors.length]} text-white text-xs font-bold`}
                />
              </TenantLink>
            ))}
            {memberCount > 6 && (
              <TenantLink
                href="/community/members"
                className="w-8 h-8 rounded-full bg-[#3D3936] flex items-center justify-center text-[#A8A29E] text-xs border-2 border-[#2D2926] hover:bg-[#4D4946] transition-colors"
              >
                +{memberCount - 6}
              </TenantLink>
            )}
          </div>

          <TenantLink
            href="/community/members"
            className="block text-center py-2 text-sm text-[#D4836A] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            View all
          </TenantLink>
        </div>

        {/* Quick Links - Compact */}
        <div className="px-1 space-y-1">
          <a
            href="https://github.com/anthropics/claude-code"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#78716C] hover:text-white rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Claude Code GitHub</span>
          </a>
          <a
            href="https://docs.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#78716C] hover:text-white rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Anthropic Docs</span>
          </a>
          <TenantLink
            href="/community/bug-report"
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#78716C] hover:text-red-400 rounded-lg transition-colors"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Found a Bug? Report it!</span>
          </TenantLink>
        </div>
      </div>
    </aside>
  );
}
