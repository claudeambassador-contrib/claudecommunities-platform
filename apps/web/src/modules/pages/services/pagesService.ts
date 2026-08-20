import type { z } from "zod";
import { DEFAULT_HOME_SECTIONS } from "@/modules/pages/homeDefaults";
// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as pagesRepo from "@/modules/pages/repositories/pagesRepository";
import {
  contentBlocksInput,
  homeBlocksInput,
  pageSlugInput,
  pageStatusCreateInput,
  pageStatusPatchInput,
  pageTitleInput,
} from "@/modules/pages/schemas";
import type {
  Block,
  ContentPageDetail,
  ContentPageInput,
  ContentPageSummary,
  PublishedPage,
} from "@/modules/pages/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";

function badInput<T>(parsed: z.SafeParseError<T>): Result<never> {
  return err("bad_request", 400, parsed.error.issues[0]?.message ?? "Invalid input");
}

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
  const slug = pageSlugInput.safeParse(input.slug);
  if (!slug.success) {
    return badInput(slug);
  }
  const title = pageTitleInput.safeParse(input.title);
  if (!title.success) {
    return badInput(title);
  }
  const blocks = contentBlocksInput.safeParse(input.blocks);
  if (!blocks.success) {
    return badInput(blocks);
  }
  const status = pageStatusCreateInput.safeParse(input.status);
  if (!status.success) {
    return badInput(status);
  }
  if (await pagesRepo.findBySlug(store, slug.data)) {
    return err("conflict", 409, "A page with this path already exists");
  }
  return await pagesRepo.insertContent(store, {
    blocks: blocks.data as Block[],
    slug: slug.data,
    status: status.data,
    title: title.data,
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
  const slug = pageSlugInput.safeParse(input.slug);
  if (!slug.success) {
    return badInput(slug);
  }
  const title = pageTitleInput.safeParse(input.title);
  if (!title.success) {
    return badInput(title);
  }
  const blocks = contentBlocksInput.safeParse(input.blocks);
  if (!blocks.success) {
    return badInput(blocks);
  }
  const status = pageStatusPatchInput.safeParse(input.status);
  if (!status.success) {
    return badInput(status);
  }
  if (await pagesRepo.findBySlug(store, slug.data, id)) {
    return err("conflict", 409, "A page with this path already exists");
  }
  return pagesRepo.updateContent(store, id, {
    blocks: blocks.data as Block[],
    slug: slug.data,
    status: status.data,
    title: title.data,
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
  const checked = homeBlocksInput.safeParse(blocks);
  if (!checked.success) {
    return badInput(checked);
  }
  return await pagesRepo.upsertHome(store, checked.data as Block[]);
}

export async function getPublishedPage(
  store: TenantStore,
  slug: string,
): Promise<Result<{ page: PublishedPage | null }>> {
  return ok({ page: await pagesRepo.findPublishedBySlug(store, slug) });
}

export async function listPublishedPages(
  store: TenantStore,
): Promise<Result<{ pages: ContentPageSummary[] }>> {
  return ok({ pages: await pagesRepo.listPublishedContent(store) });
}

/** Published home blocks, or the code defaults when no row / empty body exists. */
export async function getHomeSections(store: TenantStore): Promise<Result<{ blocks: Block[] }>> {
  const published = await getPublishedPage(store, "home");
  if (!published.ok) {
    return published;
  }
  const blocks = published.page?.blocks ?? [];
  return ok({ blocks: blocks.length > 0 ? blocks : DEFAULT_HOME_SECTIONS });
}
