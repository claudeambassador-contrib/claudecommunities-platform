export const dynamic = "force-dynamic";

import { listTenants } from "@/lib/services/tenants";
import TenantsClient from "./TenantsClient";

/**
 * Platform tenant configurator. The page-level super_admin gate lives in the
 * console layout; the API (`/api/admin/tenants`) re-checks the same global role.
 */
export default async function PlatformTenantsPage() {
  const tenants = (await listTenants()).map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">Communities</h1>
        <p className="text-sm text-[#78716C] mt-1">
          Create and manage every community on this platform. A new community is live the instant it
          is created — reachable at <code className="text-[#A8A29E]">/&lt;slug&gt;</code>. The owner
          email receives super_admin when they sign up with it.
        </p>
      </header>
      <TenantsClient initialTenants={tenants} />
    </div>
  );
}
