import { ClipboardList, PieChart, Presentation, QrCode } from "lucide-react";
import { redirect } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

export default async function ToolsPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));
  if (!hasPermission(user, "tools.use"))
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Tools</h1>
        <p className="text-[#78716C] text-sm mb-8">Utilities and helpers for event management</p>

        <div className="grid md:grid-cols-3 gap-4">
          <TenantLink
            href="/admin/tools/attendee-analytics"
            className="bg-[#2D2926] rounded-xl p-6 border border-white/[0.06] hover:border-[#7C6FCD]/30 transition-colors group"
          >
            <PieChart className="w-8 h-8 text-[#7C6FCD] mb-3" />
            <h3 className="text-lg font-semibold text-white group-hover:text-[#7C6FCD] transition-colors">
              Attendee Analytics - Luma
            </h3>
            <p className="text-[#78716C] text-sm mt-1">
              Analyse Luma CSV exports for attendee roles, topics, and insights
            </p>
          </TenantLink>

          <TenantLink
            href="/admin/tools/qr-generator"
            className="bg-[#2D2926] rounded-xl p-6 border border-white/[0.06] hover:border-[#10B981]/30 transition-colors group"
          >
            <QrCode className="w-8 h-8 text-[#10B981] mb-3" />
            <h3 className="text-lg font-semibold text-white group-hover:text-[#10B981] transition-colors">
              QR Code Generator
            </h3>
            <p className="text-[#78716C] text-sm mt-1">
              Generate QR codes for URLs, text, and contact info
            </p>
          </TenantLink>

          <TenantLink
            href="/admin/tools/attendance-planner"
            className="bg-[#2D2926] rounded-xl p-6 border border-white/[0.06] hover:border-[#E09820]/30 transition-colors group"
          >
            <ClipboardList className="w-8 h-8 text-[#E09820] mb-3" />
            <h3 className="text-lg font-semibold text-white group-hover:text-[#E09820] transition-colors">
              Attendance Planner
            </h3>
            <p className="text-[#78716C] text-sm mt-1">
              Cross-reference Luma exports to plan event attendance and shortlist candidates
            </p>
          </TenantLink>

          <TenantLink
            href="/admin/tools/slide-generator"
            className="bg-[#2D2926] rounded-xl p-6 border border-white/[0.06] hover:border-[#D4836A]/40 transition-colors group"
          >
            <Presentation className="w-8 h-8 text-[#D4836A] mb-3" />
            <h3 className="text-lg font-semibold text-white group-hover:text-[#D4836A] transition-colors">
              Speaker Slide Generator
            </h3>
            <p className="text-[#78716C] text-sm mt-1">
              Design and export speaker introduction slides — six layouts, custom fonts,
              drag-to-position
            </p>
          </TenantLink>
        </div>
      </div>
    </div>
  );
}
