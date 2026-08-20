// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as tiersRepo from "@/modules/tiers/repositories/tiersRepository";
import { tierWriteInput } from "@/modules/tiers/schemas";
import type { TierInput, TierSummary, TierWrite } from "@/modules/tiers/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { toSafeSlug } from "@/shared/ids";

function validateInput(input: TierInput): Result<{ write: TierWrite }> {
  const parsed = tierWriteInput.safeParse(input);
  if (!parsed.success) {
    return err("bad_request", 400, parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { data } = parsed;
  const slug = toSafeSlug(data.slug ?? data.name);
  if (!slug) {
    return err("bad_request", 400, "Tier slug is required");
  }
  const features = (data.features ?? []).filter(Boolean);
  return ok({
    write: {
      color: data.color,
      description: data.description,
      features,
      isActive: data.isActive ?? true,
      name: data.name,
      order: data.order,
      price: data.price,
      slug,
      yearlyPrice: data.yearlyPrice,
    },
  });
}

export async function listTiers(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ tiers: TierSummary[] }>> {
  const perm = ensurePermission(actor, "tiers.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ tiers: await tiersRepo.listTiers(store) });
}

export async function listPublicTiers(
  store: TenantStore,
): Promise<Result<{ tiers: TierSummary[] }>> {
  const tiers = await tiersRepo.listTiers(store);
  return ok({ tiers: tiers.filter((tier) => tier.isActive) });
}

export async function createTier(
  store: TenantStore,
  actor: Actor,
  input: TierInput,
): Promise<Result<{ tier: TierSummary }>> {
  const perm = ensurePermission(actor, "tiers.edit");
  if (!perm.ok) {
    return perm;
  }
  const validated = validateInput(input);
  if (!validated.ok) {
    return validated;
  }
  return await tiersRepo.insertTier(store, validated.write);
}

export async function updateTier(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: TierInput,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "tiers.edit");
  if (!perm.ok) {
    return perm;
  }
  const validated = validateInput(input);
  if (!validated.ok) {
    return validated;
  }
  return await tiersRepo.updateTier(store, id, validated.write);
}

export async function removeTier(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "tiers.delete");
  if (!perm.ok) {
    return perm;
  }
  return await tiersRepo.deleteTier(store, id);
}
