import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SYSTEM_ROLES } from "@/lib/permissions";

/**
 * Platform console — cross-tenant administration (provisioning + managing every
 * community). Gated on the GLOBAL `User.role === "super_admin"`, NOT a per-tenant
 * permission: this plane is not scoped to any tenant. (Middleware already
 * `auth.protect()`s `/admin` on the platform host; this re-checks the role.)
 */
export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isBanned || user.role !== SYSTEM_ROLES.SUPER_ADMIN) redirect("/");

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Building2 className="w-5 h-5 text-[#D4836A]" />
            Platform console
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[#A8A29E] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Directory
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
