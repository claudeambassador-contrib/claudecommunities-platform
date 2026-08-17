// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as slidesRepo from "@/modules/slides/repositories/slidesRepository";
import type {
  SlideGeneratorState,
  SlideStatePutResult,
  SlideStateWriteDeps,
  SlideStylePresetCreateBody,
  SlideStylePresetCreated,
  SlideStylePresetDetail,
  SlideStylePresetUpdateBody,
} from "@/modules/slides/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

const MAX_BODY_BYTES = 256 * 1024;

function validateScope(scope: string): Result<Record<string, never>> {
  if (typeof scope !== "string" || scope.length === 0 || scope.length > 200) {
    return err("bad_request", 400, "Invalid scope");
  }
  if (scope === "global") {
    return ok({});
  }
  if (scope.startsWith("event:") && scope.length > "event:".length) {
    return ok({});
  }
  return err("bad_request", 400, "Scope must be 'global' or 'event:<id>'");
}

function eventIdFromScope(scope: string): string | null {
  return scope.startsWith("event:") ? scope.slice("event:".length) : null;
}

function serializeBody(body: unknown): Result<{ dataJson: string }> {
  let dataJson: string;
  try {
    dataJson = JSON.stringify(body);
  } catch {
    return err("bad_request", 400, "Body is not JSON-serialisable");
  }
  if (dataJson.length > MAX_BODY_BYTES) {
    return err("bad_request", 400, `Body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  return ok({ dataJson });
}

function validatePresetName(name: string): Result<{ name: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    return err("bad_request", 400, "Name must be 1-80 chars");
  }
  return ok({ name: trimmed });
}

export async function getState(
  store: TenantStore,
  actor: Actor,
  scope: string,
): Promise<Result<{ state: SlideGeneratorState }>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  const scoped = validateScope(scope);
  if (!scoped.ok) {
    return scoped;
  }
  return ok({ state: await slidesRepo.getStateByScope(store, scope) });
}

export async function putState(
  store: TenantStore,
  actor: Actor,
  scope: string,
  data: unknown,
  deps: SlideStateWriteDeps = {},
): Promise<Result<SlideStatePutResult>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  const scoped = validateScope(scope);
  if (!scoped.ok) {
    return scoped;
  }
  const body = serializeBody(data);
  if (!body.ok) {
    return body;
  }
  const saved = await slidesRepo.upsertState(store, {
    dataJson: body.dataJson,
    eventId: eventIdFromScope(scope),
    scope,
  });
  if (!saved.ok) {
    return saved;
  }
  await deps.invalidateForScope?.(scope);
  return saved;
}

export async function listPresets(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ presets: SlideStylePresetDetail[] }>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  return ok({ presets: await slidesRepo.listPresets(store) });
}

export async function getPreset(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ preset: SlideStylePresetDetail }>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  return await slidesRepo.getPresetById(store, id);
}

export async function createPreset(
  store: TenantStore,
  actor: Actor,
  input: SlideStylePresetCreateBody,
): Promise<Result<{ preset: SlideStylePresetCreated }>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  const name = validatePresetName(input.name);
  if (!name.ok) {
    return name;
  }
  const body = serializeBody(input.data);
  if (!body.ok) {
    return body;
  }
  return await slidesRepo.insertPreset(store, name.name, body.dataJson);
}

export async function updatePreset(
  store: TenantStore,
  actor: Actor,
  id: string,
  patch: SlideStylePresetUpdateBody,
): Promise<Result<{ preset: SlideStylePresetCreated }>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  let nextName: string | undefined;
  if (patch.name !== undefined) {
    const clean = validatePresetName(patch.name);
    if (!clean.ok) {
      return clean;
    }
    ({ name: nextName } = clean);
  }
  let dataJson: string | undefined;
  if (patch.data !== undefined) {
    const body = serializeBody(patch.data);
    if (!body.ok) {
      return body;
    }
    ({ dataJson } = body);
  }
  return await slidesRepo.updatePresetById(store, id, nextName, dataJson);
}

export async function deletePreset(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "tools.use");
  if (!perm.ok) {
    return perm;
  }
  return await slidesRepo.deletePresetById(store, id);
}
