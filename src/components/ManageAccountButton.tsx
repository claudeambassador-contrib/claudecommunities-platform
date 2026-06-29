"use client";

import { useClerk } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";

export default function ManageAccountButton() {
  const { openUserProfile } = useClerk();

  return (
    <button
      type="button"
      onClick={() => openUserProfile()}
      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#2D2926] border border-[#D4836A]/40 text-white font-medium rounded-lg hover:bg-[#3a3431] hover:border-[#D4836A] transition-colors"
    >
      <ShieldCheck className="w-5 h-5 text-[#D4836A]" />
      Manage Authentication
    </button>
  );
}
