import { and, asc, eq, ne } from "drizzle-orm";
import type {
  Block,
  ContentPageDetail,
  ContentPageSummary,
  PageStatus,
  PublishedPage,
} from "@/modules/pages/types";
import type { TenantStore } from "@/shared/db/tenantStore";
import { err, ok, type Result } from "@/shared/http/errors";
import { newId } from "@/shared/ids";

export const HOME_SLUG = "home";

type PageRow = TenantStore["tables"]["pages"]["$inferSelect"];

function first<T>(rows: T[]): T | undefined {
  const [row] = rows;
  return row;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseBlocks(raw: string): Block[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  let arr: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (isObj(parsed) && Array.isArray(parsed.blocks)) {
    arr = parsed.blocks;
  }
  if (!arr) {
    return [];
  }
  return arr.filter(
    (item): item is Block =>
      isObj(item) && typeof item.id === "string" && typeof item.type === "string",
  );
}

function encodeBlocks(blocks: Block[]): string {
  return JSON.stringify({ blocks });
}

function toSummary(row: PageRow): ContentPageSummary {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: row.title,
  };
}

function toDetail(row: PageRow): ContentPageDetail {
  return { ...toSummary(row), blocks: parseBlocks(row.bodyJson) };
}

function toPublished(row: PageRow): PublishedPage {
  return {
    blocks: parseBlocks(row.bodyJson),
    id: row.id,
    slug: row.slug,
    title: row.title,
  };
}

async function pageById(store: TenantStore, id: string): Promise<PageRow | null> {
  const { pages } = store.tables;
  const rows = await store.db
    .select()
    .from(pages)
    .where(and(eq(pages.orgId, store.orgId), eq(pages.id, id)))
    .limit(1);
  return first(rows) ?? null;
}

export async function findBySlug(
  store: TenantStore,
  slug: string,
  ignoreId?: string,
): Promise<{ id: string } | null> {
  const { pages } = store.tables;
  const rows = await store.db
    .select()
    .from(pages)
    .where(and(eq(pages.orgId, store.orgId), eq(pages.slug, slug)))
    .limit(1);
  const row = first(rows);
  if (!row || row.id === ignoreId) {
    return null;
  }
  return { id: row.id };
}

export async function listContent(store: TenantStore): Promise<ContentPageSummary[]> {
  const { pages } = store.tables;
  const rows = await store.db
    .select()
    .from(pages)
    .where(and(eq(pages.orgId, store.orgId), ne(pages.slug, HOME_SLUG)))
    .orderBy(asc(pages.slug));
  return rows.map(toSummary);
}

export async function getContentById(
  store: TenantStore,
  id: string,
): Promise<Result<{ page: ContentPageDetail }>> {
  const row = await pageById(store, id);
  if (!row || row.slug === HOME_SLUG) {
    return err("not_found", 404, "Page not found");
  }
  return ok({ page: toDetail(row) });
}

const UNIQUE_CONSTRAINT = /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i;

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return UNIQUE_CONSTRAINT.test(message);
}

export async function insertContent(
  store: TenantStore,
  input: { blocks: Block[]; slug: string; status: PageStatus; title: string },
): Promise<Result<{ page: ContentPageSummary }>> {
  const { pages } = store.tables;
  const now = new Date();
  const id = newId("pg");
  try {
    await store.db.insert(pages).values({
      bodyJson: encodeBlocks(input.blocks),
      createdAt: now,
      id,
      orgId: store.orgId,
      slug: input.slug,
      status: input.status,
      title: input.title,
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return err("conflict", 409, "A page with this path already exists");
    }
    throw error;
  }
  return ok({ page: { id, slug: input.slug, status: input.status, title: input.title } });
}

export async function updateContent(
  store: TenantStore,
  id: string,
  input: { blocks: Block[]; slug: string; status?: PageStatus; title: string },
): Promise<Result<{ page: ContentPageSummary }>> {
  const current = await pageById(store, id);
  if (!current || current.slug === HOME_SLUG) {
    return err("not_found", 404, "Page not found");
  }
  const { pages } = store.tables;
  const status = input.status ?? current.status;
  await store.db
    .update(pages)
    .set({
      bodyJson: encodeBlocks(input.blocks),
      slug: input.slug,
      status,
      title: input.title,
      updatedAt: new Date(),
    })
    .where(and(eq(pages.orgId, store.orgId), eq(pages.id, id)));
  return ok({ page: { id, slug: input.slug, status, title: input.title } });
}

export async function deleteContent(
  store: TenantStore,
  id: string,
): Promise<Result<{ success: true }>> {
  const current = await pageById(store, id);
  if (!current || current.slug === HOME_SLUG) {
    return err("not_found", 404, "Page not found");
  }
  const { pages } = store.tables;
  await store.db.delete(pages).where(and(eq(pages.orgId, store.orgId), eq(pages.id, id)));
  return ok({ success: true });
}

export async function upsertHome(store: TenantStore, blocks: Block[]): Promise<Block[]> {
  const existing = await findBySlug(store, HOME_SLUG);
  const { pages } = store.tables;
  const now = new Date();
  const bodyJson = encodeBlocks(blocks);
  if (existing) {
    await store.db
      .update(pages)
      .set({ bodyJson, status: "published", title: "Home", updatedAt: now })
      .where(and(eq(pages.orgId, store.orgId), eq(pages.id, existing.id)));
    return blocks;
  }
  await store.db.insert(pages).values({
    bodyJson,
    createdAt: now,
    id: newId("pg"),
    orgId: store.orgId,
    slug: HOME_SLUG,
    status: "published",
    title: "Home",
    updatedAt: now,
  });
  return blocks;
}

export async function findPublishedBySlug(
  store: TenantStore,
  slug: string,
): Promise<PublishedPage | null> {
  const { pages } = store.tables;
  const rows = await store.db
    .select()
    .from(pages)
    .where(and(eq(pages.orgId, store.orgId), eq(pages.slug, slug), eq(pages.status, "published")))
    .limit(1);
  const row = first(rows);
  return row ? toPublished(row) : null;
}
