export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import InviteForm from "./InviteForm";

export default async function AdminInvitePage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));
  if (!hasPermission(user, "users.invite"))
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));

  // Fetch recently invited users
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let invitedUsers: Array<{
    id: string;
    name: string | null;
    email: string | null;
    hasSignedUp: boolean;
    createdAt: string;
  }> = [];

  try {
    const response = await fetch(`${baseUrl}/api/admin/invite`, {
      headers: {
        cookie: "", // SSR doesn't have cookies automatically
      },
      cache: "no-store",
    });
    if (response.ok) {
      const data = await response.json();
      invitedUsers = data.users || [];
    }
  } catch (_e) {
    // Silently fail, will show empty list
  }

  return (
    <div className="min-h-screen bg-[#1C1917]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Invite Form */}
        <InviteForm />

        {/* Recently Invited */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-4">Recently Invited</h2>
          <div className="bg-[#2D2926] rounded-xl border border-white/[0.06] overflow-hidden">
            {invitedUsers.length === 0 ? (
              <div className="p-8 text-center text-[#78716C]">No invites sent yet</div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {invitedUsers.map((invited) => (
                  <div key={invited.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{invited.name || "No name"}</p>
                      <p className="text-[#78716C] text-sm">{invited.email}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          invited.hasSignedUp
                            ? "bg-[#10B981]/20 text-[#10B981]"
                            : "bg-[#F59E0B]/20 text-[#F59E0B]"
                        }`}
                      >
                        {invited.hasSignedUp ? "Signed Up" : "Pending"}
                      </span>
                      <p className="text-[#78716C] text-xs mt-1">
                        {new Date(invited.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
