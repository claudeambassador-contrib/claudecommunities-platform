"use client";

import { usePathname } from "next/navigation";
import MobileBottomNav from "./MobileBottomNav";

interface MobileBottomNavWrapperProps {
  currentUserId: string;
}

export default function MobileBottomNavWrapper({ currentUserId }: MobileBottomNavWrapperProps) {
  const pathname = usePathname();

  return <MobileBottomNav currentUserId={currentUserId} pathname={pathname} />;
}
