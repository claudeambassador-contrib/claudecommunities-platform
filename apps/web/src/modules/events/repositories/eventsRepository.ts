import { and, desc, eq } from "drizzle-orm";
import type { TenantStore } from "@/shared/db/tenantStore";
import type { EventRow } from "@/modules/events/schema.tenant";
import { newId } from "@/shared/ids";

export async function listPublished(store: TenantStore): Promise<EventRow[]> {
  const { events } = store.tables;
  return store.db
    .select()
    .from(events)
    .where(and(eq(events.orgId, store.orgId), eq(events.status, "published")))
    .orderBy(desc(events.startsAt));
}

export async function listAll(store: TenantStore): Promise<EventRow[]> {
  const { events } = store.tables;
  return store.db
    .select()
    .from(events)
    .where(eq(events.orgId, store.orgId))
    .orderBy(desc(events.startsAt));
}

export async function findBySlug(
  store: TenantStore,
  slug: string,
): Promise<EventRow | null> {
  const { events } = store.tables;
  const rows = await store.db
    .select()
    .from(events)
    .where(and(eq(events.orgId, store.orgId), eq(events.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

export async function insert(
  store: TenantStore,
  input: {
    slug: string;
    title: string;
    description?: string | null;
    location?: string | null;
    status?: "draft" | "published" | "cancelled";
    startsAt?: Date | null;
    endsAt?: Date | null;
  },
): Promise<EventRow> {
  const { events } = store.tables;
  const now = new Date();
  const id = newId("evt");
  await store.db.insert(events).values({
    id,
    orgId: store.orgId,
    slug: input.slug,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    coverUrl: null,
    status: input.status ?? "draft",
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const row = await findBySlug(store, input.slug);
  if (!row) throw new Error("insert event failed");
  return row;
}
