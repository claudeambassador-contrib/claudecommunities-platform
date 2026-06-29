"use client";

import { useCallback, useState } from "react";
import CommunityNav from "@/components/CommunityNav";
import LeftSidebar from "@/components/LeftSidebar";
import MobileBottomNavWrapper from "@/components/MobileBottomNavWrapper";
import MobileSidebarDrawer from "@/components/MobileSidebarDrawer";

interface CommunityLayoutClientProps {
  children: React.ReactNode;
  navUser: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
  sidebarUser: {
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
  spaceGroups: {
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
  currentUserId: string;
}

export default function CommunityLayoutClient({
  children,
  navUser,
  sidebarUser,
  spaces,
  spaceGroups,
  currentUserId,
}: CommunityLayoutClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const handleClose = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      <CommunityNav user={navUser} onMenuToggle={() => setDrawerOpen((prev) => !prev)} />
      <div className="flex pt-14">
        <LeftSidebar user={sidebarUser} spaces={spaces} spaceGroups={spaceGroups} />
        <MobileSidebarDrawer
          user={sidebarUser}
          spaces={spaces}
          spaceGroups={spaceGroups}
          open={drawerOpen}
          onClose={handleClose}
        />
        <main className="flex-1 min-w-0 lg:ml-[280px] min-h-screen pb-16 lg:pb-0">{children}</main>
      </div>
      <MobileBottomNavWrapper currentUserId={currentUserId} />
    </>
  );
}
