"use client";

import { useCallback, useState } from "react";
import type { Permission } from "@/lib/permissions";
import AdminHeader from "./AdminHeader";
import AdminMobileNav from "./AdminMobileNav";
import AdminSidebar from "./AdminSidebar";
import { PermissionsProvider } from "./Can";

interface AdminShellProps {
  children: React.ReactNode;
  permissions: readonly Permission[];
}

export default function AdminShell({ children, permissions }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleClose = useCallback(() => setDrawerOpen(false), []);

  return (
    <PermissionsProvider permissions={permissions}>
      <div className="min-h-screen bg-[#1C1917]">
        <AdminSidebar permissions={permissions} />
        <AdminMobileNav open={drawerOpen} onClose={handleClose} permissions={permissions} />
        <div className="lg:ml-[240px] flex flex-col min-h-screen">
          <AdminHeader onMenuToggle={() => setDrawerOpen(true)} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </PermissionsProvider>
  );
}
