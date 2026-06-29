"use client";

import { usePathname } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";

export default function AdminBreadcrumb() {
  const pathname = usePathname();

  // Get the segment after /admin/
  const segments = pathname
    .replace(/^\/admin\/?/, "")
    .split("/")
    .filter(Boolean);
  const currentPage = segments[0];

  if (!currentPage) {
    return <span className="text-sm text-white font-medium">Dashboard</span>;
  }

  const label = currentPage.charAt(0).toUpperCase() + currentPage.slice(1);

  return (
    <div className="flex items-center gap-2 text-sm">
      <TenantLink href="/admin" className="text-[#A8A29E] hover:text-white transition-colors">
        Admin
      </TenantLink>
      <span className="text-[#78716C]">/</span>
      <span className="text-white font-medium">{label}</span>
    </div>
  );
}
