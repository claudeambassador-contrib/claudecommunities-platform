/**
 * Clerk ↔ D1 role sync.
 *
 * A user's role lives in two places:
 *   - Clerk `publicMetadata.role`  — source of truth across systems
 *   - D1 `User.role`               — mirror for fast in-app permission checks
 *
 * All role changes inside this app go through `setUserRole`. Edits made
 * directly in the Clerk dashboard will NOT sync back to D1 — we don't run a
 * webhook for this. If a role drifts, re-save it through the admin UI.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { getPlatformPrisma } from "@/lib/prisma";

/**
 * Assign a role to a user. Updates Clerk first (because it's the
 * cross-system source of truth) and only mirrors to D1 on success — so a
 * Clerk failure doesn't leave the two stores out of sync.
 */
export async function setUserRole(params: {
  clerkId: string | null;
  userId: string;
  roleName: string;
}): Promise<void> {
  const { clerkId, userId, roleName } = params;

  if (clerkId) {
    const client = await clerkClient();
    await client.users.updateUser(clerkId, {
      publicMetadata: { role: roleName },
    });
  }

  // `User.role` is the GLOBAL Clerk mirror (a user's identity-level role), not
  // the per-tenant authz role (that lives on UserTenant) — so it's a global write.
  const platform = await getPlatformPrisma();
  await platform.user.update({
    where: { id: userId },
    data: { role: roleName },
  });
}
