"use client";

import { Bell, Home, MessageSquare, Plus, Search } from "lucide-react";
import { TenantLink } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";

interface MobileBottomNavProps {
  currentUserId: string;
  pathname: string;
}

export default function MobileBottomNav({ pathname }: MobileBottomNavProps) {
  const config = useTenantConfig();

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const navItems = [
    {
      href: "/community",
      icon: Home,
      label: "Home",
      isActive:
        pathname === "/community" ||
        (pathname.startsWith("/community") &&
          !pathname.includes("/search") &&
          !pathname.includes("/notifications")),
    },
    {
      href: "/community/search",
      icon: Search,
      label: "Search",
      isActive: isActive("/community/search"),
    },
    {
      href: "/community?compose=true",
      icon: Plus,
      label: "Post",
      isActive: false,
      isAddButton: true,
    },
    {
      href: config.discordCommunityInvite,
      icon: MessageSquare,
      label: "Chat",
      isActive: false,
      external: true,
    },
    {
      href: "/community/notifications",
      icon: Bell,
      label: "Alerts",
      isActive: isActive("/community/notifications"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[#1C1917]/95 backdrop-blur-md border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          if (item.isAddButton) {
            return (
              <TenantLink
                key={item.label}
                href={item.href}
                className="relative flex items-center justify-center -mt-4"
              >
                <div className="w-12 h-12 rounded-full bg-[#D4836A] flex items-center justify-center shadow-lg shadow-[#D4836A]/30 active:scale-95 transition-transform">
                  <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
              </TenantLink>
            );
          }

          const className =
            "relative flex flex-col items-center justify-center flex-1 h-full py-1.5 active:bg-white/[0.05] rounded-lg transition-colors";
          const content = (
            <>
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    item.isActive ? "text-[#D4836A]" : "text-[#78716C]"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] mt-0.5 transition-colors ${
                  item.isActive ? "text-[#D4836A] font-medium" : "text-[#78716C]"
                }`}
              >
                {item.label}
              </span>
            </>
          );

          if (item.external) {
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {content}
              </a>
            );
          }

          return (
            <TenantLink key={item.label} href={item.href} className={className}>
              {content}
            </TenantLink>
          );
        })}
      </div>
    </nav>
  );
}
