import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { runHomeTenantBootstrap } from "@/lib/services/tenants";

/**
 * POST /api/admin/tenant-bootstrap — one-time migration of this single-tenant
 * deployment into the tenant model: create the home-region Tenant + settings and
 * enrol EVERY existing user as a member (role preserved). Idempotent.
 *
 * The slug is FIXED to this deploy's home region (`NEXT_PUBLIC_REGION`), never
 * taken from the request — so it is impossible to run one region's backfill
 * against another region's D1 (which would mislabel that region's users).
 */
const HOME_SLUG = (process.env.NEXT_PUBLIC_REGION ?? "au").toLowerCase();
const HOME_NAME =
  HOME_SLUG === "nz" ? "Claude Community New Zealand" : "Claude Community Australia";

export async function POST(request: Request) {
  // Gate on the GLOBAL super_admin role directly, not a permission lookup: the
  // bootstrap runs before membership-based authz exists, so it must not depend
  // on per-tenant Role/permission data already being correct.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isBanned || user.role !== SYSTEM_ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden — super_admin only" }, { status: 403 });
  }

  let name = HOME_NAME;
  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body?.name === "string" && body.name.trim()) name = body.name.trim();
  } catch {
    // no / invalid body — use the default name
  }

  try {
    const result = await runHomeTenantBootstrap({ slug: HOME_SLUG, name });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
