"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

interface OnlineStatusContextType {
  onlineUserIds: Set<string>;
  isOnline: (userId: string) => boolean;
}

const OnlineStatusContext = createContext<OnlineStatusContextType>({
  onlineUserIds: new Set(),
  isOnline: () => false,
});

export function useOnlineStatus() {
  return useContext(OnlineStatusContext);
}

interface OnlineStatusProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
}

export function OnlineStatusProvider({ children, isAuthenticated }: OnlineStatusProviderProps) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // Send heartbeat to update lastSeen
  const sendHeartbeat = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await fetch("/api/users/online", { method: "POST" });
    } catch (error) {
      console.error("Failed to send heartbeat:", error);
    }
  }, [isAuthenticated]);

  // Fetch online users
  const fetchOnlineUsers = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch("/api/users/online");
      if (res.ok) {
        const data = await res.json();
        setOnlineUserIds(new Set(data.onlineUserIds));
      }
    } catch (error) {
      console.error("Failed to fetch online users:", error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial heartbeat and fetch
    sendHeartbeat();
    fetchOnlineUsers();

    // Set up intervals
    const heartbeatInterval = setInterval(sendHeartbeat, 300000); // Every 5 minutes
    const fetchInterval = setInterval(fetchOnlineUsers, 300000); // Every 5 minutes

    // Also send heartbeat on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
        fetchOnlineUsers();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(fetchInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, sendHeartbeat, fetchOnlineUsers]);

  const isOnline = useCallback(
    (userId: string) => {
      return onlineUserIds.has(userId);
    },
    [onlineUserIds],
  );

  return (
    <OnlineStatusContext.Provider value={{ onlineUserIds, isOnline }}>
      {children}
    </OnlineStatusContext.Provider>
  );
}
