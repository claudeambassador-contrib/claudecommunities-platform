"use client";

import { Clock, Loader2, UserCheck, UserPlus, UserX } from "lucide-react";
import { useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";

type ConnectionStatus = "none" | "pending" | "accepted" | "received";

interface ProfileConnectButtonProps {
  profileUserId: string;
  initialStatus: ConnectionStatus;
  connectionId?: string | null;
}

export default function ProfileConnectButton({
  profileUserId,
  initialStatus,
  connectionId: initialConnectionId,
}: ProfileConnectButtonProps) {
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [connectionId, setConnectionId] = useState(initialConnectionId);

  const handleConnect = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: profileUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        setConnectionId(data.id);
        setStatus("pending");
      }
    } catch (error) {
      console.error("Failed to send connection request:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (loading || !connectionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStatus("none");
        setConnectionId(null);
      }
    } catch (error) {
      console.error("Failed to remove connection:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "none") {
    return (
      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#D4836A] hover:bg-[#c4735a] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
      >
        {loading ? (
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
    );
  }

  if (status === "pending") {
    return (
      <button
        type="button"
        onClick={handleRemove}
        disabled={loading}
        className="group flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#3D3936] text-[#A8A29E] text-sm font-medium rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Clock className="w-4 h-4 group-hover:hidden" />
            <UserX className="w-4 h-4 hidden group-hover:block" />
            <span className="group-hover:hidden">Pending</span>
            <span className="hidden group-hover:inline">Cancel Request</span>
          </>
        )}
      </button>
    );
  }

  if (status === "accepted") {
    return (
      <button
        type="button"
        onClick={handleRemove}
        disabled={loading}
        className="group flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-600/20 text-green-400 text-sm font-medium rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <UserCheck className="w-4 h-4 group-hover:hidden" />
            <UserX className="w-4 h-4 hidden group-hover:block" />
            <span className="group-hover:hidden">Connected</span>
            <span className="hidden group-hover:inline">Disconnect</span>
          </>
        )}
      </button>
    );
  }

  // status === 'received'
  return (
    <TenantLink
      href="/community/connections?tab=pending"
      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#D4836A]/20 text-[#D4836A] text-sm font-medium rounded-xl hover:bg-[#D4836A]/30 transition-colors"
    >
      <UserPlus className="w-4 h-4" />
      Respond to request
    </TenantLink>
  );
}
