// oxlint-disable-next-line import/namespace -- repository is the persistence boundary
import * as badgesRepo from "@/modules/badges/repositories/badgesRepository";
import type {
  AwardedBadge,
  BadgeDetail,
  BadgeInput,
  BadgeSummary,
  BadgeWrite,
} from "@/modules/badges/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";

function validateInput(input: BadgeInput): Result<{ write: BadgeWrite }> {
  const name = input.name.trim();
  if (!name) {
    return err("bad_request", 400, "Badge name is required");
  }
  return ok({
    write: {
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      name,
    },
  });
}

export async function listBadges(store: TenantStore): Promise<Result<{ badges: BadgeSummary[] }>> {
  return ok({ badges: await badgesRepo.listBadges(store) });
}

export async function getBadge(
  store: TenantStore,
  id: string,
): Promise<Result<{ badge: BadgeDetail }>> {
  const badge = await badgesRepo.findBadge(store, id);
  if (!badge) {
    return err("not_found", 404, "Badge not found");
  }
  return ok({ badge });
}

export async function createBadge(
  store: TenantStore,
  actor: Actor,
  input: BadgeInput,
): Promise<Result<{ badge: BadgeSummary }>> {
  const perm = ensurePermission(actor, "badges.edit");
  if (!perm.ok) {
    return perm;
  }
  const validated = validateInput(input);
  if (!validated.ok) {
    return validated;
  }
  return await badgesRepo.insertBadge(store, validated.write);
}

export async function updateBadge(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: BadgeInput,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "badges.edit");
  if (!perm.ok) {
    return perm;
  }
  const validated = validateInput(input);
  if (!validated.ok) {
    return validated;
  }
  return await badgesRepo.updateBadge(store, id, validated.write);
}

export async function removeBadge(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "badges.delete");
  if (!perm.ok) {
    return perm;
  }
  return await badgesRepo.deleteBadge(store, id);
}

export async function awardBadge(
  store: TenantStore,
  actor: Actor,
  badgeId: string,
  userId: string,
): Promise<Result<{ award: AwardedBadge }>> {
  const perm = ensurePermission(actor, "badges.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!userId.trim()) {
    return err("bad_request", 400, "userId is required");
  }
  return await badgesRepo.awardBadge(store, badgeId, userId.trim());
}

export async function revokeBadge(
  store: TenantStore,
  actor: Actor,
  badgeId: string,
  userId: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "badges.edit");
  if (!perm.ok) {
    return perm;
  }
  if (!userId.trim()) {
    return err("bad_request", 400, "userId is required");
  }
  return await badgesRepo.revokeBadge(store, badgeId, userId.trim());
}
