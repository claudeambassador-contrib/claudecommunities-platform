// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as tiersRepo from "@/modules/tiers/repositories/tiersRepository";
import type { TierInput, TierSummary, TierWrite } from "@/modules/tiers/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { toSafeSlug } from "@/shared/ids";

function parseNonNegative(value: unknown, field: string): Result<{ value: number }> {
  if (value === undefined || value === null || value === "") {
    return ok({ value: 0 });
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return err("bad_request", 400, `${field} must be a number ≥ 0`);
  }
  return ok({ value: parsed });
}

function parseOptionalNonNegative(value: unknown, field: string): Result<{ value: number | null }> {
  if (value === undefined || value === null || value === "") {
    return ok({ value: null });
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return err("bad_request", 400, `${field} must be a number ≥ 0`);
  }
  return ok({ value: parsed });
}

function validateInput(input: TierInput): Result<{ write: TierWrite }> {
  const name = input.name.trim();
  if (!name) {
    return err("bad_request", 400, "Tier name is required");
  }
  const slug = toSafeSlug(input.slug ?? name);
  if (!slug) {
    return err("bad_request", 400, "Tier slug is required");
  }
  const price = parseNonNegative(input.price, "price");
  if (!price.ok) {
    return price;
  }
  const yearlyPrice = parseOptionalNonNegative(input.yearlyPrice, "yearlyPrice");
  if (!yearlyPrice.ok) {
    return yearlyPrice;
  }
  if (input.features !== undefined && !Array.isArray(input.features)) {
    return err("bad_request", 400, "Features must be an array");
  }
  const features = (input.features ?? [])
    .map((feature) => (typeof feature === "string" ? feature.trim() : ""))
    .filter(Boolean);
  if (input.isActive !== undefined && typeof input.isActive !== "boolean") {
    return err("bad_request", 400, "isActive must be a boolean");
  }
  const order = input.order ?? 0;
  if (!Number.isInteger(order) || order < 0) {
    return err("bad_request", 400, "order must be an integer ≥ 0");
  }
  return ok({
    write: {
      color: input.color?.trim() || null,
      description: input.description?.trim() || null,
      features,
      isActive: input.isActive ?? true,
      name,
      order,
      price: price.value,
      slug,
      yearlyPrice: yearlyPrice.value,
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
