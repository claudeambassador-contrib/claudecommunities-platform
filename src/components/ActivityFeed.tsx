"use client";

import { Activity, Award, FileText, Heart, Loader2, MessageCircle, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { RoleBadge } from "./UserBadge";

interface ActivityUser {
  id: string;
  name: string | null;
  image: string | null;
  role?: string | null;
}

interface ActivityData {
  postId?: string;
  postTitle?: string;
  commentId?: string;
  badgeName?: string;
  spaceName?: string;
  [key: string]: unknown;
}

interface ActivityItem {
  id: string;
  type: string;
  data: ActivityData | null;
  createdAt: string;
  user: ActivityUser;
}

interface ActivityFeedProps {
  userId?: string;
  limit?: number;
  showHeader?: boolean;
}

export default function ActivityFeed({ userId, limit = 10, showHeader = true }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-fetch only when userId/limit change; fetchActivities is recreated each render and intentionally omitted to avoid a refetch loop
  useEffect(() => {
    fetchActivities();
  }, [userId, limit]);

  const fetchActivities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = userId
        ? `/api/activity?userId=${userId}&limit=${limit}`
        : `/api/activity?limit=${limit}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      } else {
        setError("Failed to load activity");
      }
    } catch (_err) {
      setError("Failed to load activity");
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "post_created":
        return FileText;
      case "comment_created":
        return MessageCircle;
      case "like_added":
        return Heart;
      case "user_joined":
        return UserPlus;
      case "badge_awarded":
        return Award;
      default:
        return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "post_created":
        return "#D4836A";
      case "comment_created":
        return "#10B981";
      case "like_added":
        return "#EF4444";
      case "user_joined":
        return "#8B5CF6";
      case "badge_awarded":
        return "#F59E0B";
      default:
        return "#78716C";
    }
  };

  const getActivityText = (activity: ActivityItem) => {
    const { type, data, user } = activity;
    const userName = user.name || "Someone";
    const isAdmin = user.role?.toLowerCase() === "admin";
    const nameEl = (
      <>
        <span className="font-medium text-white">{userName}</span>
        {isAdmin && (
          <span className="inline-block ml-1.5 align-middle">
            <RoleBadge roleName="admin" size="sm" />
          </span>
        )}
      </>
    );

    switch (type) {
      case "post_created":
        return (
          <>
            {nameEl}
            {" created a new post"}
            {data?.postTitle && (
              <>
                {": "}
                <TenantLink
                  href={`/community/posts/${data.postId}`}
                  className="text-[#D4836A] hover:underline"
                >
                  {data.postTitle}
                </TenantLink>
              </>
            )}
          </>
        );
      case "comment_created":
        return (
          <>
            {nameEl}
            {" commented on "}
            {data?.postId && (
              <TenantLink
                href={`/community/posts/${data.postId}`}
                className="text-[#D4836A] hover:underline"
              >
                a post
              </TenantLink>
            )}
          </>
        );
      case "like_added":
        return (
          <>
            {nameEl}
            {" liked "}
            {data?.postId && (
              <TenantLink
                href={`/community/posts/${data.postId}`}
                className="text-[#D4836A] hover:underline"
              >
                a post
              </TenantLink>
            )}
          </>
        );
      case "user_joined":
        return (
          <>
            {nameEl}
            {" joined the community"}
          </>
        );
      case "badge_awarded":
        return (
          <>
            {nameEl}
            {" earned the "}
            <span className="text-[#F59E0B]">{data?.badgeName}</span>
            {" badge"}
          </>
        );
      default:
        return (
          <>
            {nameEl}
            {" performed an action"}
          </>
        );
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-[#D4836A] animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-[#78716C]">{error}</div>;
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="w-12 h-12 text-[#78716C] mx-auto mb-3" />
        <p className="text-[#78716C]">No recent activity</p>
      </div>
    );
  }

  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-[#D4836A]" />
          <h3 className="font-semibold text-white">Recent Activity</h3>
        </div>
      )}
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          const color = getActivityColor(activity.type);

          return (
            <div key={activity.id} className="flex gap-3">
              {/* User Avatar */}
              <TenantLink href={`/community/profile/${activity.user.id}`}>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4836A] to-[#B66B54] flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {activity.user.name?.[0]?.toUpperCase() || "?"}
                </div>
              </TenantLink>

              {/* Activity Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#A8A29E] leading-relaxed">
                  {getActivityText(activity)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <Icon className="w-2.5 h-2.5" style={{ color }} />
                  </div>
                  <span className="text-xs text-[#78716C]">{getTimeAgo(activity.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
