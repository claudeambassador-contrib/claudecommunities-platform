"use client";

import { AtSign, Award, Bell, Check, Heart, Mail, MessageSquare, Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function getIcon(type: string) {
  switch (type) {
    case "mention":
      return <AtSign className="w-4 h-4 text-[#D4836A]" />;
    case "reply":
    case "comment":
      return <MessageSquare className="w-4 h-4 text-[#8B5CF6]" />;
    case "like":
      return <Heart className="w-4 h-4 text-pink-500" />;
    case "badge":
      return <Award className="w-4 h-4 text-[#F59E0B]" />;
    case "message":
      return <Mail className="w-4 h-4 text-[#10B981]" />;
    default:
      return <Bell className="w-4 h-4 text-[#A8A29E]" />;
  }
}

function getTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (res.ok) {
        setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Notifications</h1>
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-sm text-[#D4836A] hover:underline"
            >
              <Check className="w-4 h-4" />
              Mark all read
            </button>
          )}
          <TenantLink
            href="/community/settings/notifications"
            title="Notification settings"
            aria-label="Notification settings"
            className="flex items-center gap-1.5 text-sm text-[#A8A29E] hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </TenantLink>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center">
          <Bell className="w-12 h-12 text-[#78716C] mx-auto mb-3" />
          <p className="text-[#78716C]">No notifications yet</p>
        </div>
      ) : (
        <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] divide-y divide-white/[0.06] overflow-hidden">
          {notifications.map((notification) => (
            <TenantLink
              key={notification.id}
              href={notification.link || "#"}
              className={`block px-4 py-3.5 hover:bg-white/[0.03] transition-colors ${
                !notification.isRead ? "bg-white/[0.02]" : ""
              }`}
            >
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium truncate">{notification.title}</p>
                    {!notification.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#D4836A] shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-[#A8A29E] line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                  <p className="text-xs text-[#57534E] mt-1">
                    {getTimeAgo(notification.createdAt)}
                  </p>
                </div>
              </div>
            </TenantLink>
          ))}
        </div>
      )}
    </div>
  );
}
