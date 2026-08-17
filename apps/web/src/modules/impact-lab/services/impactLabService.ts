import { ok, type Result } from "@/shared/http/errors";
import { getRegistryDb } from "@/shared/db/env";
import { impactLabInterests, impactLabSponsors } from "@/modules/impact-lab/schema.registry";
import { newId } from "@/shared/ids";

/** Impact Lab is global — lives on REGISTRY, not city D1. */
export async function listSponsors(): Promise<
  Result<{ sponsors: { id: string; name: string; website: string | null }[] }>
> {
  const db = getRegistryDb();
  const rows = await db.select().from(impactLabSponsors);
  return ok({
    sponsors: rows.map((r) => ({ id: r.id, name: r.name, website: r.website })),
  });
}

export async function registerInterest(input: {
  email: string;
  name?: string;
}): Promise<Result<{ id: string }>> {
  const db = getRegistryDb();
  const id = newId("ili");
  await db.insert(impactLabInterests).values({
    id,
    email: input.email.toLowerCase(),
    name: input.name ?? null,
    orgId: null,
    createdAt: new Date(),
  });
  return ok({ id });
}

export async function countInterests(): Promise<Result<{ count: number }>> {
  const db = getRegistryDb();
  const rows = await db.select().from(impactLabInterests);
  return ok({ count: rows.length });
}
