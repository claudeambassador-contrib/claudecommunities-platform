"use client";

import type { Permission } from "@/lib/permissions";
import AdminNav from "./AdminNav";

interface AdminSidebarProps {
  permissions: readonly Permission[];
}

export default function AdminSidebar({ permissions }: AdminSidebarProps) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-[#1C1917] border-r border-white/[0.06] hidden lg:block z-40">
      <AdminNav permissions={permissions} />
    </aside>
  );
}
