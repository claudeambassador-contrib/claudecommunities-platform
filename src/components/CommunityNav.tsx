"use client";

import { useClerk } from "@clerk/nextjs";
import { ChevronLeft, LogOut, Menu, MessageSquare, Search, Shield, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { TenantLink, useTenantBase, useTenantRouter } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { Avatar } from "@/components/ui/Avatar";
import { tenantHref } from "@/lib/tenant-base";
import NotificationBell from "./NotificationBell";

interface CommunityNavProps {
  user:
    | {
        id?: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        role?: string | null;
      }
    | undefined;
  onMenuToggle?: () => void;
}

export default function CommunityNav({ user, onMenuToggle }: CommunityNavProps) {
  const config = useTenantConfig();
  const router = useTenantRouter();
  const { signOut } = useClerk();
  const base = useTenantBase();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/community/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearch(false);
      setSearchQuery("");
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1C1917]/95 backdrop-blur-md border-b border-white/[0.06] h-14">
      <div className="h-full px-3 sm:px-4 flex items-center justify-between max-w-[1800px] mx-auto">
        {/* Left: Logo + Back */}
        <div className="flex items-center gap-2 sm:gap-4">
          {onMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              className="lg:hidden p-2 text-[#78716C] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <TenantLink
            href="/community"
            className="flex items-center gap-2 text-white font-semibold"
          >
            <Image
              src="/images/claude-community-logo.svg"
              alt="Community"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            <span className="hidden sm:inline">Community</span>
          </TenantLink>
          <div className="hidden sm:block w-px h-6 bg-white/[0.1]" />
          <TenantLink
            href="/"
            className="hidden sm:flex items-center gap-1.5 text-[#78716C] hover:text-white text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to site</span>
          </TenantLink>
        </div>

        {/* Center: Search (desktop) */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <form onSubmit={handleSearch} className="w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts, members..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 focus:ring-1 focus:ring-[#D4836A]/30 transition-all"
            />
          </form>
        </div>

        {/* Right: Actions + User */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mobile Search Toggle */}
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="md:hidden p-2 text-[#78716C] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Chat - external link, hidden on mobile (shown in bottom nav) */}
          <a
            href={config.discordCommunityInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex p-2 text-[#78716C] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
          </a>

          {/* Notifications - hidden on mobile */}
          <div className="hidden sm:block">
            <NotificationBell />
          </div>

          {/* Admin Link */}
          {user?.role !== "member" && (
            <TenantLink
              href="/admin"
              className="p-2 text-[#D4836A] hover:bg-[#D4836A]/10 rounded-lg transition-colors"
              title="Admin Dashboard"
            >
              <Shield className="w-5 h-5" />
            </TenantLink>
          )}

          <div className="hidden sm:block w-px h-6 bg-white/[0.1] mx-1" />

          {/* User Avatar */}
          <TenantLink
            href={`/community/profile/${user?.id || ""}`}
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <Avatar
              src={user?.image}
              name={user?.name}
              className="w-8 h-8 rounded-full ring-2 ring-white/[0.1] overflow-hidden"
              fallbackClassName="bg-gradient-to-br from-[#D4836A] to-[#B66B54] text-white text-sm font-bold"
            />
            <div className="hidden sm:flex flex-col">
              <span className="text-sm text-[#A8A29E] leading-tight">{user?.name || "User"}</span>
              <span className="text-[10px] text-[#78716C] capitalize leading-tight">
                {user?.role || "member"}
              </span>
            </div>
          </TenantLink>

          {/* Sign out - hidden on mobile */}
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: tenantHref(base, "/") })}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#A8A29E] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {showSearch && (
        <div className="md:hidden absolute top-full left-0 right-0 p-4 bg-[#1C1917] border-b border-white/[0.06]">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts, members..."
              // biome-ignore lint/a11y/noAutofocus: focus the search input when the mobile search overlay opens
              autoFocus
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-[#78716C] focus:outline-none focus:border-[#D4836A]/50 focus:ring-1 focus:ring-[#D4836A]/30"
            />
            <button
              type="button"
              onClick={() => setShowSearch(false)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
