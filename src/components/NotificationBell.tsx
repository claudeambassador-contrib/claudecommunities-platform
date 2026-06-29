"use client";

import { AtSign, Award, Bell, Check, Heart, Mail, MessageSquare, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only polling setup; fetchers are stable and intentionally not re-subscribed
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchUnreadCount, 120000);
    return () => clearInterval(interval);
  }, []);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Use setTimeout to avoid the click that opened the menu from immediately closing it
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
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
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/notifications?limit=1&unread=true");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

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

  const getIcon = (type: string) => {
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          const opening = !isOpen;
          setIsOpen(opening);
          if (opening) {
            fetchNotifications();
            if (unreadCount > 0) markAllAsRead();
          }
        }}
        className="relative p-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/[0.05] transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#D4836A] text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#2D2926] rounded-xl border border-white/[0.1] shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-[#D4836A] hover:underline"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <TenantLink
                href="/community/settings/notifications"
                onClick={() => setIsOpen(false)}
                title="Notification settings"
                aria-label="Notification settings"
                className="text-[#A8A29E] hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
              </TenantLink>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center">
                <div className="w-6 h-6 border-2 border-[#D4836A] border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-[#78716C] mx-auto mb-2" />
                <p className="text-[#78716C] text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <TenantLink
                  key={notification.id}
                  href={notification.link || "#"}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-0 ${
                    !notification.isRead ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-medium truncate">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#D4836A] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#78716C] line-clamp-1 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-[#57534E] mt-1">
                        {getTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </TenantLink>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-white/[0.06]">
              <TenantLink
                href="/community/notifications"
                onClick={() => setIsOpen(false)}
                className="block text-center text-sm text-[#D4836A] hover:underline"
              >
                View all notifications
              </TenantLink>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
