"use client";

import { ArrowLeft, ChevronDown, Shield } from "lucide-react";
import { usePathname } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { TenantLink } from "@/components/TenantBaseProvider";
import type { Permission } from "@/lib/permissions";
import { type AdminNavItem, adminNavItems, filterNavForPermissions } from "./adminNavItems";

function NavLink({ item, pathname }: { item: AdminNavItem; pathname: string }) {
  const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <TenantLink
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
        isActive
          ? "bg-[#D4836A]/10 text-[#D4836A]"
          : "text-[#A8A29E] hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <Icon className="w-4 h-4" />
      {item.label}
    </TenantLink>
  );
}

function NavGroup({ item, pathname }: { item: AdminNavItem; pathname: string }) {
  const isChildActive = item.children?.some((child) => pathname.startsWith(child.href)) ?? false;
  const [open, setOpen] = useState(isChildActive);
  const Icon = item.icon;

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isChildActive ? "text-[#D4836A]" : "text-[#A8A29E] hover:bg-white/[0.05] hover:text-white"
        }`}
      >
        <Icon className="w-4 h-4" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-4 mt-0.5">
          {item.children?.map((child) => (
            <NavLink key={child.href} item={child} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
      {label}
    </div>
  );
}

/**
 * The shared admin nav body — title, permission-filtered nav tree with static
 * section headers, and the "Back to Community" footer. `AdminSidebar` and
 * `AdminMobileNav` each wrap this in their own container (`<aside>` vs
 * `<Drawer>`).
 */
export default function AdminNav({ permissions }: { permissions: readonly Permission[] }) {
  const pathname = usePathname();
  const visibleNav = useMemo(
    () => filterNavForPermissions(adminNavItems, new Set(permissions)),
    [permissions],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Top */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 text-white font-semibold text-lg">
          <Shield className="w-5 h-5 text-[#D4836A]" />
          Admin
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {(() => {
          let lastSection: string | undefined;
          return visibleNav.map((item) => {
            const header =
              item.section != null && item.section !== lastSection ? (
                <SectionHeader label={item.section} />
              ) : null;
            lastSection = item.section ?? lastSection;
            return (
              <Fragment key={item.href}>
                {header}
                {item.children ? (
                  <NavGroup item={item} pathname={pathname} />
                ) : (
                  <NavLink item={item} pathname={pathname} />
                )}
              </Fragment>
            );
          });
        })()}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/[0.06]">
        <TenantLink
          href="/community"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#A8A29E] hover:bg-white/[0.05] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Community
        </TenantLink>
      </div>
    </div>
  );
}
