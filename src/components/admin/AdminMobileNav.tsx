"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Drawer from "@/components/ui/Drawer";
import type { Permission } from "@/lib/permissions";
import AdminNav from "./AdminNav";

interface AdminMobileNavProps {
  open: boolean;
  onClose: () => void;
  permissions: readonly Permission[];
}

export default function AdminMobileNav({ open, onClose, permissions }: AdminMobileNavProps) {
  const pathname = usePathname();

  // Auto-close on route change
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the intentional trigger — the effect re-runs to close the drawer whenever the route changes, even though pathname isn't read in the body
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <Drawer open={open} onClose={onClose} side="left">
      <AdminNav permissions={permissions} />
    </Drawer>
  );
}
