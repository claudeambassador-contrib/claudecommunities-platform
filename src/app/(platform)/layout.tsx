import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { PLATFORM } from "@/lib/platform";

/**
 * Platform-plane chrome (the apex `claudecommunities.com`): the community
 * directory and any other non-tenant marketing pages. This is NOT a tenant —
 * it reads the build-time {@link PLATFORM} identity, never `getTenantConfig()`.
 * The platform console (`/admin`) nests its own layout below this.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isPlatformAdmin = user?.role === SYSTEM_ROLES.SUPER_ADMIN;

  return (
    <div className="min-h-screen flex flex-col bg-[#1C1917] text-white">
      <header className="border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <Image
              src={PLATFORM.logo}
              alt={PLATFORM.name}
              width={28}
              height={28}
              className="rounded"
            />
            <span>{PLATFORM.name}</span>
          </Link>
          {isPlatformAdmin && (
            <Link
              href="/admin"
              className="text-sm font-medium text-[#A8A29E] hover:text-white transition-colors"
            >
              Platform admin
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/[0.06] mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-[#78716C] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} {PLATFORM.name}
          </span>
          <a
            href={`mailto:${PLATFORM.supportEmail}`}
            className="hover:text-[#A8A29E] transition-colors"
          >
            {PLATFORM.supportEmail}
          </a>
        </div>
      </footer>
    </div>
  );
}
