import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { updateTenant } from "@/lib/services/tenants";

/**
 * Platform-console edit of a single community's registry row (name / custom
 * domain / status / directory visibility). Same global-super_admin gate as the
 * collection route — this is a cross-tenant platform power, not a per-tenant one.
 */
async function requirePlatformSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.isBanned || user.role !== SYSTEM_ROLES.SUPER_ADMIN) {
    return { error: NextResponse.json({ error: "Forbidden — super_admin only" }, { status: 403 }) };
  }
  return { user };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const gate = await requirePlatformSuperAdmin();
  if (gate.error) return gate.error;

  const { slug } = await params;

  let body: { name?: unknown; customDomain?: unknown; status?: unknown; listed?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input: {
    name?: string;
    customDomain?: string | null;
    status?: "active" | "suspended";
    listed?: boolean;
  } = {};
  if (typeof body.name === "string") input.name = body.name.trim();
  if (typeof body.customDomain === "string") input.customDomain = body.customDomain.trim() || null;
  else if (body.customDomain === null) input.customDomain = null;
  if (body.status === "active" || body.status === "suspended") input.status = body.status;
  if (typeof body.listed === "boolean") input.listed = body.listed;

  try {
    const tenant = await updateTenant(slug, input);
    return NextResponse.json({ ok: true, tenant });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isClientError = /invalid|taken|required/i.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: isClientError ? 400 : 500 });
  }
}
