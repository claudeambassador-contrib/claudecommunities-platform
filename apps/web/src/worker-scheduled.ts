/**
 * Cron every 15 minutes: for each active city, drain due social posts that
 * have no externalId (native-scheduled posts are excluded).
 */
export async function handleScheduled(
  _event: ScheduledEvent,
  env: Record<string, unknown>,
  _ctx: ExecutionContext,
): Promise<void> {
  const { and, eq, isNull, lte } = await import("drizzle-orm");
  const { createRegistryDb, createTenantDb, getD1Binding } = await import("@/shared/db/client");
  const { tenants } = await import("@/modules/tenants/schema.registry");
  const { socialPosts } = await import("@/modules/social/schema.tenant");
  const { tenantStore } = await import("@/shared/db/tenantStore");

  const registry = createRegistryDb(getD1Binding(env, "REGISTRY"));
  const cities = await registry.select().from(tenants).where(eq(tenants.status, "active"));

  const now = new Date();

  for (const city of cities) {
    try {
      const d1 = getD1Binding(env, city.d1Binding);
      const store = tenantStore(createTenantDb(d1), {
        orgId: city.orgId,
        binding: city.d1Binding,
      });
      const due = await store.db
        .select()
        .from(socialPosts)
        .where(
          and(
            eq(socialPosts.orgId, store.orgId),
            eq(socialPosts.status, "scheduled"),
            isNull(socialPosts.externalId),
            lte(socialPosts.scheduledAt, now),
          ),
        )
        .limit(25);

      for (const post of due) {
        const wf = env.PUBLISH_POST as
          | { create: (opts: { params: unknown }) => Promise<unknown> }
          | undefined;
        if (wf?.create) {
          await wf.create({
            params: {
              postId: post.id,
              orgId: city.orgId,
              d1Binding: city.d1Binding,
            },
          });
        }
      }
    } catch (e) {
      console.error(`[cron] city ${city.slug} failed`, e);
    }
  }
}
