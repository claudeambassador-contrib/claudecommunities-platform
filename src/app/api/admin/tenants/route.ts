import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { listTenants, provisionTenantByEmail } from "@/lib/services/tenants";

/**
 * Platform tenant configurator API. Provisioning a tenant is a PLATFORM
 * superuser power — it writes the global registry plus another tenant's first
 * rows via the unscoped platform client — so it is gated on the caller's GLOBAL
 * `User.role === "super_admin"`, NOT a per-tenant permission. (A per-tenant
 * permission would leak to every tenant's admins, since system roles seed with
 * ALL_PERMISSIONS — a cross-tenant escalation.) Same gate as
 * `/api/admin/tenant-bootstrap`.
 */
async function requirePlatformSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.isBanned || user.role !== SYSTEM_ROLES.SUPER_ADMIN) {
    return { error: NextResponse.json({ error: "Forbidden — super_admin only" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const gate = await requirePlatformSuperAdmin();
  if (gate.error) return gate.error;
  return NextResponse.json({ tenants: await listTenants() });
}

export async function POST(request: Request) {
  const gate = await requirePlatformSuperAdmin();
  if (gate.error) return gate.error;

  let body: { slug?: unknown; name?: unknown; ownerEmail?: unknown; customDomain?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim() : "";
  const customDomain =
    typeof body.customDomain === "string" && body.customDomain.trim()
      ? body.customDomain.trim()
      : null;

  if (!slug || !name || !ownerEmail) {
    return NextResponse.json({ error: "slug, name and ownerEmail are required" }, { status: 400 });
  }

  try {
    const tenant = await provisionTenantByEmail({ slug, name, ownerEmail, customDomain });
    return NextResponse.json({ ok: true, tenant }, { status: 201 });
  } catch (err) {
    // Invalid/taken slug or domain are caller errors (400); anything else 500.
    const message = err instanceof Error ? err.message : String(err);
    const isClientError = /invalid|taken|required/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: isClientError ? 400 : 500 });
  }
}
