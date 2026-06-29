/**
 * Helper for non-service API routes that gate by permission.
 *
 * Service-layer-backed routes should use `requireSessionUser` +
 * `ensurePermission` (via _auth.ts) instead. This file exists for the
 * legacy admin/email/import/invite/sync routes that haven't been migrated
 * to the service layer yet (see PENDING_SERVICE_MIGRATION in eslint.config.mjs).
 *
 * Usage:
 *   const auth = await requirePermissionResponse("email.view");
 *   if (!auth.ok) return auth.response;
 *   const { user } = auth;
 */
import { NextResponse } from "next/server";
import { getCurrentUserWithPermissions } from "./auth";
import type { Permission } from "./permissions";

type AuthOk = {
  ok: true;
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUserWithPermissions>>>;
};
type AuthFail = { ok: false; response: NextResponse };

export async function requirePermissionResponse(
  permission: Permission,
): Promise<AuthOk | AuthFail> {
  const user = await getCurrentUserWithPermissions();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!user.permissions.includes(permission)) {
    return {
      ok: false,
      response: NextResponse.json({ error: `Missing permission: ${permission}` }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
