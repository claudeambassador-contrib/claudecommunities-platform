import { redirect } from "next/navigation";
import { SpeakerSlideGenerator } from "@/components/slide-generator";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

export default async function AdminSlideGeneratorPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));
  if (!hasPermission(user, "tools.use"))
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Speaker Slide Generator</h1>
          <p className="text-[#78716C] text-sm">
            Design speaker introduction slides. State persists in this browser. Use the per-event
            generator inside the &quot;Prepare event&quot; modal for event-specific slides.
          </p>
        </div>
        <SpeakerSlideGenerator
          scope="global"
          defaultHeaderText="Claude Community AU"
          filenameSlug="speaker_slide"
        />
      </div>
    </div>
  );
}
