"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { Menu, MessageSquare, Shield, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TenantLink, useTenantBase } from "@/components/TenantBaseProvider";
import { useTenantConfig } from "@/components/TenantConfigProvider";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { tenantHref } from "@/lib/tenant-base";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const config = useTenantConfig();
  const { countryName, merchEnabled } = config;
  const pathname = usePathname();
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const base = useTenantBase();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch actual role from database
  useEffect(() => {
    if (isSignedIn) {
      fetch("/api/me")
        .then((res) => res.json())
        .then((data) => {
          if (data.user?.role !== "member") {
            setIsAdmin(true);
          }
        })
        .catch(() => {});
    }
  }, [isSignedIn]);

  const navLinkClass = (path: string) => {
    const isActive = pathname === path;
    return `text-[0.9375rem] whitespace-nowrap transition-all duration-300 relative ${isActive ? "text-[#FAF9F6]" : "text-[#A8A29E] hover:text-[#FAF9F6]"}`;
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1C1917]/95 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between h-[72px]">
        <TenantLink
          href="/"
          className="flex shrink-0 items-center gap-3 font-semibold text-lg text-[#FAF9F6] hover:text-[#D4836A] transition-all duration-300"
        >
          <RemoteImage
            src="/icons/favicon.png"
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded"
          />
          <span className="whitespace-nowrap">{`Claude Code Meetups ${countryName}`}</span>
        </TenantLink>

        <div className="hidden lg:flex items-center gap-5">
          <TenantLink href="/" className={navLinkClass("/")}>
            Home
            {isActive("/") && (
              <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#D4836A] rounded" />
            )}
          </TenantLink>
          <TenantLink href="/events" className={navLinkClass("/events")}>
            Find an Event
            {isActive("/events") && (
              <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#D4836A] rounded" />
            )}
          </TenantLink>
          <TenantLink href="/resources" className={navLinkClass("/resources")}>
            Resources
            {isActive("/resources") && (
              <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#D4836A] rounded" />
            )}
          </TenantLink>
          <TenantLink href="/speak" className={navLinkClass("/speak")}>
            Speak
            {isActive("/speak") && (
              <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#D4836A] rounded" />
            )}
          </TenantLink>
          {merchEnabled && (
            <TenantLink href="/merch" className={navLinkClass("/merch")}>
              Merch
              {isActive("/merch") && (
                <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#D4836A] rounded" />
              )}
            </TenantLink>
          )}

          {isSignedIn ? (
            <>
              <TenantLink
                href="/community"
                className={
                  pathname.startsWith("/community")
                    ? "text-[0.9375rem] whitespace-nowrap text-[#FAF9F6] relative"
                    : "text-[0.9375rem] whitespace-nowrap text-[#A8A29E] hover:text-[#FAF9F6] relative"
                }
              >
                Community
                {pathname.startsWith("/community") && (
                  <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#D4836A] rounded" />
                )}
              </TenantLink>

              {/* Quick Actions */}
              <div className="flex items-center gap-1 ml-2">
                <a
                  href={config.discordCommunityInvite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-[#A8A29E] hover:text-white hover:bg-white/[0.08] transition-all"
                  title="Join our Discord"
                >
                  <MessageSquare className="w-5 h-5" />
                </a>
                <NotificationBell />
              </div>

              {/* Admin Link */}
              {isAdmin && (
                <TenantLink
                  href="/admin"
                  className="p-2 rounded-lg text-[#D4836A] hover:bg-[#D4836A]/10 transition-all"
                  title="Admin Dashboard"
                >
                  <Shield className="w-5 h-5" />
                </TenantLink>
              )}

              {/* User Avatar & Sign Out */}
              <div className="flex items-center gap-3">
                <TenantLink href="/community/profile" className="relative group">
                  {user?.imageUrl ? (
                    <RemoteImage
                      src={user.imageUrl}
                      alt={user.firstName || "Profile"}
                      className="w-9 h-9 rounded-full object-cover border-2 border-transparent group-hover:border-[#D4836A] transition-all"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#D4836A] flex items-center justify-center text-white font-medium">
                      {user?.firstName?.[0] || "?"}
                    </div>
                  )}
                </TenantLink>
                <button
                  type="button"
                  onClick={() => signOut({ redirectUrl: tenantHref(base, "/") })}
                  className="bg-[#D4836A] text-[#1C1917] px-5 py-2.5 rounded-xl font-semibold hover:bg-[#E09880] hover:-translate-y-0.5 transition-all duration-300"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <TenantLink
              href="/login"
              className="bg-[#D4836A] text-[#1C1917] px-5 py-2.5 rounded-xl font-semibold hover:bg-[#E09880] hover:-translate-y-0.5 transition-all duration-300"
            >
              Community Login
            </TenantLink>
          )}
        </div>

        <button
          type="button"
          className="lg:hidden flex flex-col gap-[5px] p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="w-6 h-6 text-[#FAF9F6]" />
          ) : (
            <Menu className="w-6 h-6 text-[#FAF9F6]" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-[72px] left-0 right-0 bg-[#1C1917] border-b border-white/[0.08] p-6 flex flex-col gap-4">
          <TenantLink
            href="/"
            className="text-[#A8A29E] hover:text-[#FAF9F6]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Home
          </TenantLink>
          <TenantLink
            href="/events"
            className="text-[#A8A29E] hover:text-[#FAF9F6]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Find an Event
          </TenantLink>
          <TenantLink
            href="/resources"
            className="text-[#A8A29E] hover:text-[#FAF9F6]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Resources
          </TenantLink>
          <TenantLink
            href="/speak"
            className="text-[#A8A29E] hover:text-[#FAF9F6]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Speak
          </TenantLink>
          {merchEnabled && (
            <TenantLink
              href="/merch"
              className="text-[#A8A29E] hover:text-[#FAF9F6]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Merch
            </TenantLink>
          )}
          {isSignedIn ? (
            <>
              <TenantLink
                href="/community"
                className="text-[#A8A29E] hover:text-[#FAF9F6]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Community
              </TenantLink>
              <div className="flex items-center gap-3 pt-2 border-t border-white/[0.08]">
                <TenantLink href="/community/profile" onClick={() => setMobileMenuOpen(false)}>
                  {user?.imageUrl ? (
                    <RemoteImage
                      src={user.imageUrl}
                      alt={user.firstName || "Profile"}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#D4836A] flex items-center justify-center text-white font-medium">
                      {user?.firstName?.[0] || "?"}
                    </div>
                  )}
                </TenantLink>
                <div className="flex-1">
                  <p className="text-white font-medium">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <button
                    type="button"
                    onClick={() => signOut({ redirectUrl: tenantHref(base, "/") })}
                    className="text-[#A8A29E] text-sm hover:text-[#D4836A]"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          ) : (
            <TenantLink
              href="/login"
              className="bg-[#D4836A] text-[#1C1917] px-5 py-2.5 rounded-xl font-semibold text-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              Community Login
            </TenantLink>
          )}
        </div>
      )}
    </nav>
  );
}
