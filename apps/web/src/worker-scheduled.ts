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
  const { campaignWorkflowFromEnv } =
    await import("@/modules/email/services/emailCampaignsService");

  const registry = createRegistryDb(getD1Binding(env, "REGISTRY"));
  const cities = await registry.select().from(tenants).where(eq(tenants.status, "active"));
  const campaignWorkflow = campaignWorkflowFromEnv(env);

  for (const city of cities) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- isolate city failures
      await drainCity(env, city, campaignWorkflow);
    } catch (error) {
      console.error(`[cron] city ${city.slug} failed`, error);
    }
  }
}

async function drainCity(
  env: Record<string, unknown>,
  city: { d1Binding: string; orgId: string; slug: string },
  // oxlint-disable-next-line typescript/consistent-type-imports -- keep the dynamic import graph for cron
  campaignWorkflow: import("@/modules/email/types").CampaignWorkflow | undefined,
): Promise<void> {
  const { createTenantDb, getD1Binding } = await import("@/shared/db/client");
  const { tenantStore } = await import("@/shared/db/tenantStore");
  const { listDueScheduled, startCampaignSend } =
    await import("@/modules/email/services/emailCampaignsService");
  const { listDuePublishable } = await import("@/modules/social/services/socialService");
  const { publishStarterFromEnv } = await import("@/modules/social/services/publishStarter");

  const now = new Date();
  const store = tenantStore(createTenantDb(getD1Binding(env, city.d1Binding)), {
    binding: city.d1Binding,
    orgId: city.orgId,
  });

  const due = await listDuePublishable(store, now);
  const starter = publishStarterFromEnv(env);
  if (due.ok && starter) {
    for (const post of due.posts) {
      // oxlint-disable-next-line no-await-in-loop -- workflow create is per-post
      await starter.start({ d1Binding: city.d1Binding, orgId: city.orgId, postId: post.id });
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
    // oxlint-disable-next-line no-await-in-loop -- claim+start must stay sequential
    const started = await startCampaignSend(store, campaign.id, campaignWorkflow);
    if (!started.ok) {
      console.error(`[cron] campaign ${campaign.id} failed`, started.error);
    }
  }
}
