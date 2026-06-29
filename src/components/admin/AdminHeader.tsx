"use client";

import { Menu } from "lucide-react";
import AdminBreadcrumb from "./AdminBreadcrumb";

interface AdminHeaderProps {
  onMenuToggle?: () => void;
}

export default function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#1C1917]/95 backdrop-blur-md border-b border-white/[0.06] h-14 flex items-center px-4 gap-3">
      <button
        type="button"
        onClick={onMenuToggle}
        className="lg:hidden p-2 text-[#A8A29E] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <AdminBreadcrumb />
    </header>
  );
}
