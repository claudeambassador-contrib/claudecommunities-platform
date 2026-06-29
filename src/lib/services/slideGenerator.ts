/**
 * Speaker slide generator persistence.
 *
 * Two surfaces:
 *  - `SlideGeneratorState` — per-scope working state (template + speakers +
 *    seededIds). Scope is `"global"` for the admin tool, `"event:<id>"` for
 *    the per-event tab.
 *  - `SlideStylePreset` — named, reusable visual style (template fields only,
 *    no speakers). Lets an admin save the current look and apply it later to
 *    any event.
 *
 * Bodies are stored as opaque JSON strings — the component owns the shape, so
 * the service intentionally does not validate inner fields beyond a safe-size
 * cap. This keeps schema migrations off the critical path when the template
 * shape evolves.
 */
import { getPrisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant-context";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";
import { invalidateForEventScope } from "./slideRenderInvalidation";

// Generous cap — a typical template + 30 speakers serialises well under 50 KB.
const MAX_BODY_BYTES = 256 * 1024;

function validateScope(scope: string): void {
  if (typeof scope !== "string" || scope.length === 0 || scope.length > 200) {
    throw new ServiceError("bad_request", "Invalid scope");
  }
  if (scope === "global") return;
  if (scope.startsWith("event:") && scope.length > "event:".length) return;
  throw new ServiceError("bad_request", "Scope must be 'global' or 'event:<id>'");
}

function validateJsonBody(body: unknown): string {
  let serialised: string;
  try {
    serialised = JSON.stringify(body);
  } catch {
    throw new ServiceError("bad_request", "Body is not JSON-serialisable");
  }
  if (serialised.length > MAX_BODY_BYTES) {
    throw new ServiceError("bad_request", `Body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  return serialised;
}

function parseJson<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt row — treat as "no state" so the UI can recover by saving fresh.
    return null as unknown as T;
  }
}

export async function getState(actor: ActorLike, scope: string) {
  ensurePermission(actor, "tools.use");
  validateScope(scope);
  const db = await getPrisma();
  const row = await db.slideGeneratorState.findFirst({ where: { scope } });
  if (!row) return { scope, data: null, updatedAt: null };
  return {
    scope: row.scope,
    data: parseJson(row.data),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Internal-only lookup used by the signed render pipeline. Callers (the
 * slide-render service and the signed render page) authenticate via a
 * different mechanism (HMAC signature) so the actor check is intentionally
 * absent. Do not export through any API surface.
 */
export async function getStateInternal(scope: string) {
  validateScope(scope);
  const db = await getPrisma();
  const row = await db.slideGeneratorState.findFirst({ where: { scope } });
  if (!row) return null;
  return {
    scope: row.scope,
    data: parseJson(row.data),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function putState(actor: ActorLike, scope: string, data: unknown) {
  ensurePermission(actor, "tools.use");
  validateScope(scope);
  const serialised = validateJsonBody(data);
  const db = await getPrisma();
  const row = await db.slideGeneratorState.upsert({
    where: { tenantId_scope: { tenantId: await getTenantId(), scope } },
    create: { scope, data: serialised },
    update: { data: serialised },
  });
  await invalidateForEventScope(scope);
  return { scope: row.scope, updatedAt: row.updatedAt.toISOString() };
}

export async function listPresets(actor: ActorLike) {
  ensurePermission(actor, "tools.use");
  const db = await getPrisma();
  const rows = await db.slideStylePreset.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    data: parseJson(r.data),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getPreset(actor: ActorLike, id: string) {
  ensurePermission(actor, "tools.use");
  const db = await getPrisma();
  const row = await db.slideStylePreset.findUnique({ where: { id } });
  if (!row) throw new ServiceError("not_found", "Preset not found");
  return {
    id: row.id,
    name: row.name,
    data: parseJson(row.data),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validatePresetName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new ServiceError("bad_request", "Name must be 1-80 chars");
  }
  return trimmed;
}

export async function createPreset(actor: ActorLike, name: string, data: unknown) {
  ensurePermission(actor, "tools.use");
  const cleanName = validatePresetName(name);
  const serialised = validateJsonBody(data);
  const db = await getPrisma();
  try {
    const row = await db.slideStylePreset.create({
      data: { name: cleanName, data: serialised },
    });
    return { id: row.id, name: row.name };
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      throw new ServiceError("conflict", `A preset named "${cleanName}" already exists`);
    }
    throw err;
  }
}

export async function updatePreset(
  actor: ActorLike,
  id: string,
  patch: { name?: string; data?: unknown },
) {
  ensurePermission(actor, "tools.use");
  const db = await getPrisma();
  const existing = await db.slideStylePreset.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("not_found", "Preset not found");
  const update: { name?: string; data?: string } = {};
  if (patch.name !== undefined) update.name = validatePresetName(patch.name);
  if (patch.data !== undefined) update.data = validateJsonBody(patch.data);
  if (Object.keys(update).length === 0) return { id, name: existing.name };
  try {
    const row = await db.slideStylePreset.update({ where: { id }, data: update });
    return { id: row.id, name: row.name };
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      throw new ServiceError("conflict", `A preset named "${update.name}" already exists`);
    }
    throw err;
  }
}

export async function deletePreset(actor: ActorLike, id: string) {
  ensurePermission(actor, "tools.use");
  const db = await getPrisma();
  await db.slideStylePreset.delete({ where: { id } }).catch(() => {
    throw new ServiceError("not_found", "Preset not found");
  });
  return { success: true };
}
