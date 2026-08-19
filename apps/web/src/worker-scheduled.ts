/**
 * Cron every 15 minutes: for each active city, drain due social posts that
 * have no externalId (native-scheduled posts are excluded) and due email
 * campaigns.
 */
export async function handleScheduled(
  _event: ScheduledEvent,
  env: Record<string, unknown>,
  _ctx: ExecutionContext,
): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { createRegistryDb, getD1Binding } = await import("@/shared/db/client");
  const { tenants } = await import("@/modules/tenants/schema.registry");
  const { campaignWorkflowFromEnv } = await import(
    "@/modules/email/services/emailCampaignsService"
  );

  const registry = createRegistryDb(getD1Binding(env, "REGISTRY"));
  const cities = await registry.select().from(tenants).where(eq(tenants.status, "active"));
  const campaignWorkflow = campaignWorkflowFromEnv(env);

  for (const city of cities) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: isolate city failures
      await drainCity(env, city, campaignWorkflow);
    } catch (e) {
      console.error(`[cron] city ${city.slug} failed`, e);
    }
  }
}

async function drainCity(
  env: Record<string, unknown>,
  city: { d1Binding: string; orgId: string; slug: string },
  campaignWorkflow: import("@/modules/email/types").CampaignWorkflow | undefined,
): Promise<void> {
  const { and, eq, isNull, lte } = await import("drizzle-orm");
  const { createTenantDb, getD1Binding } = await import("@/shared/db/client");
  const { socialPosts } = await import("@/modules/social/schema.tenant");
  const { tenantStore } = await import("@/shared/db/tenantStore");
  const { listDueScheduled, startCampaignSend } = await import(
    "@/modules/email/services/emailCampaignsService"
  );

  const now = new Date();
  const store = tenantStore(createTenantDb(getD1Binding(env, city.d1Binding)), {
    binding: city.d1Binding,
    orgId: city.orgId,
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

  const wf = env.PUBLISH_POST as
    | { create: (opts: { params: unknown }) => Promise<unknown> }
    | undefined;
  for (const post of due) {
    if (wf?.create) {
      // biome-ignore lint/performance/noAwaitInLoops: workflow create is per-post
      await wf.create({
        params: {
          d1Binding: city.d1Binding,
          orgId: city.orgId,
          postId: post.id,
        },
      });
    }
  }

  if (!campaignWorkflow) {
    return;
  }
  const campaigns = await listDueScheduled(store, now);
  if (!campaigns.ok) {
    return;
  }
  for (const campaign of campaigns.campaigns) {
    // biome-ignore lint/performance/noAwaitInLoops: claim+start must stay sequential
    const started = await startCampaignSend(store, campaign.id, campaignWorkflow);
    if (!started.ok) {
      console.error(`[cron] campaign ${campaign.id} failed`, started.error);
    }
  }
}
