// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as pagesRepo from "@/modules/pages/repositories/pagesRepository";
import type {
  Block,
  ContentPageDetail,
  ContentPageInput,
  ContentPageSummary,
  PublishedPage,
} from "@/modules/pages/types";
import {
  validateContentBlocks,
  validateHomeBlocks,
  validateSlug,
  validateStatus,
  validateTitle,
} from "@/modules/pages/validators";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

export async function listContentPages(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ pages: ContentPageSummary[] }>> {
  const perm = ensurePermission(actor, "pages.view");
  if (!perm.ok) {
    return perm;
  }
  return ok({ pages: await pagesRepo.listContent(store) });
}

export async function getContentPage(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ page: ContentPageDetail }>> {
  const perm = ensurePermission(actor, "pages.view");
  if (!perm.ok) {
    return perm;
  }
  return await pagesRepo.getContentById(store, id);
}

export async function createContentPage(
  store: TenantStore,
  actor: Actor,
  input: ContentPageInput,
): Promise<Result<{ page: ContentPageSummary }>> {
  const perm = ensurePermission(actor, "pages.edit");
  if (!perm.ok) {
    return perm;
  }
  const slug = validateSlug(input.slug);
  if (!slug.ok) {
    return slug;
  }
  const title = validateTitle(input.title);
  if (!title.ok) {
    return title;
  }
  const blocks = validateContentBlocks(input.blocks);
  if (!blocks.ok) {
    return blocks;
  }
  const status = validateStatus(input.status);
  if (!status.ok) {
    return status;
  }
  if (await pagesRepo.findBySlug(store, slug.slug)) {
    return err("conflict", 409, "A page with this path already exists");
  }
  return await pagesRepo.insertContent(store, {
    blocks: blocks.blocks,
    slug: slug.slug,
    status: status.status,
    title: title.title,
  });
}

export async function updateContentPage(
  store: TenantStore,
  actor: Actor,
  id: string,
  input: ContentPageInput,
): Promise<Result<{ page: ContentPageSummary }>> {
  const perm = ensurePermission(actor, "pages.edit");
  if (!perm.ok) {
    return perm;
  }
  const slug = validateSlug(input.slug);
  if (!slug.ok) {
    return slug;
  }
  const title = validateTitle(input.title);
  if (!title.ok) {
    return title;
  }
  const blocks = validateContentBlocks(input.blocks);
  if (!blocks.ok) {
    return blocks;
  }
  if (input.status !== undefined) {
    const status = validateStatus(input.status);
    if (!status.ok) {
      return status;
    }
  }
  if (await pagesRepo.findBySlug(store, slug.slug, id)) {
    return err("conflict", 409, "A page with this path already exists");
  }
  return pagesRepo.updateContent(store, id, {
    blocks: blocks.blocks,
    slug: slug.slug,
    status: input.status,
    title: title.title,
  });
}

export async function deleteContentPage(
  store: TenantStore,
  actor: Actor,
  id: string,
): Promise<Result<{ success: true }>> {
  const perm = ensurePermission(actor, "pages.edit");
  if (!perm.ok) {
    return perm;
  }
  return await pagesRepo.deleteContent(store, id);
}

export async function saveHomeSections(
  store: TenantStore,
  actor: Actor,
  blocks: Block[],
): Promise<Result<{ blocks: Block[] }>> {
  const perm = ensurePermission(actor, "pages.edit");
  if (!perm.ok) {
    return perm;
  }
  const checked = validateHomeBlocks(blocks);
  if (!checked.ok) {
    return checked;
  }
  return ok({ blocks: await pagesRepo.upsertHome(store, checked.blocks) });
}

export async function getPublishedPage(
  store: TenantStore,
  slug: string,
): Promise<Result<{ page: PublishedPage | null }>> {
  return ok({ page: await pagesRepo.findPublishedBySlug(store, slug) });
}

/** Thin city-slug adapter for marketing routes that have not opened a TenantStore yet. */
export async function getPublishedPageForCity(
  citySlug: string,
  slug: string,
): Promise<Result<{ page: PublishedPage | null }>> {
  const { resolveCityContext } = await import("@/modules/tenants/services/resolveCityService");
  const city = await resolveCityContext(citySlug);
  if (!city.ok) {
    return city;
  }
  const { openTenantStore } = await import("@/shared/db/env");
  return getPublishedPage(openTenantStore(city.tenant), slug);
}
