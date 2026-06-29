import { redirect } from "next/navigation";
import QRCodeGenerator from "@/components/admin/QRCodeGenerator";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

export default async function QRGeneratorPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));
  if (!hasPermission(user, "tools.use"))
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">QR Code Generator</h1>
        <QRCodeGenerator />
      </div>
    </div>
  );
}
