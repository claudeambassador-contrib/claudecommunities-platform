/**
 * Cache-invalidation helpers for the slide-render service. Called from the
 * speaker, slide-generator, and event services after mutations that can
 * affect rendered PNG output.
 *
 * The slide-render cache is content-addressed in R2 — re-rendering a combo
 * after a change just writes a new key; the OLD key is what we need to
 * delete here, plus the DB row that pointed at it. Old R2 keys are only
 * deleted when no SlideRender row still references them (two combos can
 * share a key if their visual fingerprints collide).
 *
 * Best-effort: failures to delete R2 objects are logged, not thrown — the
 * mutation that triggered invalidation should not fail because of a stale
 * cache entry. Worst case is a few orphaned R2 objects.
 */
import { chunk } from "@/lib/chunk";
import { getPrisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage";

async function deleteRows(rows: { id: string; r2Key: string }[]): Promise<void> {
  if (rows.length === 0) return;
  // SlideRender is tenant-scoped. Callers run in request context (admin
  // mutations) or under the workflow's runWithTenant, so getPrisma() resolves.
  const db = await getPrisma();
  // An event can have many renders (speakers × slides), so chunk the delete to
  // stay under D1's hard limit of 100 bound parameters per query.
  const allIds = rows.map((r) => r.id);
  for (const ids of chunk(allIds, 90)) {
    await db.slideRender.deleteMany({ where: { id: { in: ids } } });
  }

  // Only delete each R2 key once, and only if no other row still references
  // it (two combos with identical content share a key).
  const uniqueKeys = Array.from(new Set(rows.map((r) => r.r2Key)));
  await Promise.all(
    uniqueKeys.map(async (key) => {
      const stillReferenced = await db.slideRender.findFirst({
        where: { r2Key: key },
        select: { id: true },
      });
      if (!stillReferenced) {
        await deleteObject(key).catch((err) => {
          console.error(`[slideRender] failed to delete R2 key ${key}`, err);
        });
      }
    }),
  );
}

export async function invalidateForSpeaker(speakerId: string): Promise<void> {
  const db = await getPrisma();
  const rows = await db.slideRender.findMany({
    where: { speakerId },
    select: { id: true, r2Key: true },
  });
  await deleteRows(rows);
}

export async function invalidateForEvent(eventId: string): Promise<void> {
  const db = await getPrisma();
  const rows = await db.slideRender.findMany({
    where: { eventId },
    select: { id: true, r2Key: true },
  });
  await deleteRows(rows);
}

/**
 * Called when the slide-generator state for an event scope is replaced. We
 * don't know which slideIds disappeared / changed without diffing, so the
 * simplest correct thing is to drop every cached render for the event;
 * re-render is on-demand anyway.
 */
export async function invalidateForEventScope(scope: string): Promise<void> {
  if (!scope.startsWith("event:")) return;
  const eventId = scope.slice("event:".length);
  if (!eventId) return;
  await invalidateForEvent(eventId);
}
