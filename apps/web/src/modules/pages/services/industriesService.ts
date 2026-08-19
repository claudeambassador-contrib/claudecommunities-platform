import { BUILT_IN_INDUSTRIES, industrySlug } from "@/modules/pages/industries";
// biome-ignore lint/performance/noNamespaceImport: repository is the persistence boundary
import * as pagesRepo from "@/modules/pages/repositories/pagesRepository";
import {
  createContentPage,
  getContentPage,
  updateContentPage,
} from "@/modules/pages/services/pagesService";
import type { ContentPageDetail, PageStatus } from "@/modules/pages/types";
import type { Actor } from "@/shared/auth/actor";
import { ensurePermission } from "@/shared/auth/actor";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

export interface IndustrySummary {
  builtIn: boolean;
  custom: boolean;
  id: string | null;
  slug: string;
  status: PageStatus | "builtin";
  title: string;
}

export interface IndustryDetail {
  body: string;
  builtIn: boolean;
  id: string | null;
  slug: string;
  status: PageStatus | "builtin";
  title: string;
}

function pageSlugs(slug: string): string[] {
  return [slug, `for/${slug}`];
}

function richTextBody(page: ContentPageDetail): string {
  const block = page.blocks.find((item) => item.type === "richText");
  return block && "body" in block ? block.body : "";
}

async function findIndustryPage(
  store: TenantStore,
  slug: string,
): Promise<ContentPageDetail | null> {
  const pages = await pagesRepo.listContent(store);
  const match = pages.find((page) => pageSlugs(slug).includes(page.slug));
  if (!match) {
    return null;
  }
  const detail = await pagesRepo.getContentById(store, match.id);
  return detail.ok ? detail.page : null;
}

export async function listIndustries(
  store: TenantStore,
  actor: Actor,
): Promise<Result<{ industries: IndustrySummary[] }>> {
  const perm = ensurePermission(actor, "pages.view");
  if (!perm.ok) {
    return perm;
  }
  const pages = await pagesRepo.listContent(store);
  const bySlug = new Map<string, (typeof pages)[number]>();
  for (const page of pages) {
    const slug = industrySlug(page.slug);
    if (slug && slug !== "home") {
      bySlug.set(slug, page);
    }
  }
  const seen = new Set<string>();
  const industries: IndustrySummary[] = [];
  for (const builtIn of BUILT_IN_INDUSTRIES) {
    const page = bySlug.get(builtIn.slug);
    seen.add(builtIn.slug);
    industries.push({
      builtIn: true,
      custom: Boolean(page),
      id: page?.id ?? null,
      slug: builtIn.slug,
      status: page?.status ?? "builtin",
      title: page?.title ?? builtIn.title,
    });
  }
  for (const page of pages) {
    const slug = industrySlug(page.slug);
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    industries.push({
      builtIn: false,
      custom: true,
      id: page.id,
      slug,
      status: page.status,
      title: page.title,
    });
  }
  return ok({ industries });
}

export async function getIndustry(
  store: TenantStore,
  actor: Actor,
  slug: string,
): Promise<Result<{ industry: IndustryDetail }>> {
  const perm = ensurePermission(actor, "pages.view");
  if (!perm.ok) {
    return perm;
  }
  const normalized = industrySlug(slug);
  if (!normalized) {
    return err("bad_request", 400, "Slug is required");
  }
  const page = await findIndustryPage(store, normalized);
  const builtIn = BUILT_IN_INDUSTRIES.find((item) => item.slug === normalized);
  if (!(page || builtIn)) {
    return err("not_found", 404, "Industry not found");
  }
  return ok({
    industry: {
      body: page ? richTextBody(page) : (builtIn?.detail ?? ""),
      builtIn: Boolean(builtIn),
      id: page?.id ?? null,
      slug: normalized,
      status: page?.status ?? "builtin",
      title: page?.title ?? builtIn?.title ?? normalized,
    },
  });
}

export async function saveIndustry(
  store: TenantStore,
  actor: Actor,
  input: { body: string; slug: string; status?: PageStatus; title: string },
): Promise<Result<{ industry: IndustryDetail }>> {
  const perm = ensurePermission(actor, "pages.edit");
  if (!perm.ok) {
    return perm;
  }
  const slug = industrySlug(input.slug);
  if (!slug) {
    return err("bad_request", 400, "Slug is required");
  }
  const title = input.title.trim();
  if (!title) {
    return err("bad_request", 400, "Title is required");
  }
  const blocks = [
    {
      body: input.body.trim(),
      enabled: true,
      heading: title,
      id: newId("blk"),
      type: "richText" as const,
    },
  ];
  const existing = await findIndustryPage(store, slug);
  const payload = { blocks, slug, status: input.status ?? "published", title };
  const saved = existing
    ? await updateContentPage(store, actor, existing.id, payload)
    : await createContentPage(store, actor, payload);
  if (!saved.ok) {
    return saved;
  }
  const page = await getContentPage(store, actor, saved.page.id);
  if (!page.ok) {
    return page;
  }
  return ok({
    industry: {
      body: richTextBody(page.page),
      builtIn: BUILT_IN_INDUSTRIES.some((item) => item.slug === slug),
      id: page.page.id,
      slug,
      status: page.page.status,
      title: page.page.title,
    },
  });
}
