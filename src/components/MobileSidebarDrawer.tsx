"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { SidebarContent } from "@/components/LeftSidebar";
import Drawer from "@/components/ui/Drawer";

interface MobileSidebarDrawerProps {
  user: {
    id: string;
    name: string;
    role: string;
    tagline?: string | null;
    image?: string | null;
  };
  spaces: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    icon?: string | null;
    groupId?: string | null;
  }[];
  spaceGroups?: {
    id: string;
    name: string;
    icon?: string;
    spaces: {
      id: string;
      name: string;
      slug: string;
      color: string | null;
      icon?: string | null;
    }[];
  }[];
  open: boolean;
  onClose: () => void;
}

export default function MobileSidebarDrawer({
  user,
  spaces,
  spaceGroups,
  open,
  onClose,
}: MobileSidebarDrawerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Auto-close on navigation
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname/searchParams are intentional deps — the drawer closes whenever the route changes.
  useEffect(() => {
    onClose();
  }, [pathname, searchParams, onClose]);

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="flex flex-col h-full pt-14 pb-16">
        <SidebarContent user={user} spaces={spaces} spaceGroups={spaceGroups} />
      </div>
    </Drawer>
  );
}
