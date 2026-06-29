import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { d, freshDb, scoped, seedTenant, seedUser } from "./helpers";

/**
 * B3a — the social-posts cron drain isolation invariant.
 *
 * The drain (`publishDueScheduled` / `reconcileDelegatedScheduled` /
 * `resetStuckPublishing`) runs OFF-request (the Worker cron, no tenant). It
 * scans for due posts across ALL tenants on the unscoped PLATFORM client, then
 * publishes each one under `runWithTenant(row.tenantId)` so the per-row CAS
 * claim + workflow payload bind to the right community.
 *
 * The app drain calls `getPlatformPrisma` / `getPrisma` / `runWithTenant`, which
 * need a CloudflareEnv we don't have in vitest — so these tests exercise the
 * exact clients those resolve to (the base client = platform, `scoped()` = the
 * per-tenant chokepoint) and lock the split the drain depends on:
 *   1. the cross-tenant scan REQUIRES the unscoped client (a scoped one can't
 *      see other tenants' rows), and
 *   2. a scoped publish-claim can ONLY ever match the in-tenant row — so a drain
 *      that forgot `runWithTenant(row.tenantId)` (or used the wrong tenant)
 *      no-ops rather than reaching across tenants.
 *
 * The workflow `run()` ALS wiring (`inScope` in publish-post.ts) can't run here
 * — no Workflows binding — and is verified structurally, not in this suite.
 */
async function seedDuePost(base: PrismaClient, tenant: string, userId: string) {
  const account = await scoped(base, tenant).socialAccount.create({
    data: d({
      platform: "linkedin",
      externalId: `ext_${tenant}`,
      displayName: `${tenant} account`,
      accessToken: "token",
      createdById: userId,
    }),
  });
  // scoped create → validateScalarFks confirms accountId is in-tenant, then the
  // chokepoint stamps tenantId. scheduledAt in the past = "due".
  return scoped(base, tenant).socialPost.create({
    data: d({
      accountId: account.id,
      platform: "linkedin",
      content: `hello from ${tenant}`,
      status: "scheduled",
      scheduledAt: new Date(Date.now() - 60_000),
      createdById: userId,
    }),
  });
}

describe("B3a social-posts drain isolation", () => {
  let db: ReturnType<typeof freshDb>;
  beforeEach(() => {
    db = freshDb();
  });
  afterEach(() => db.cleanup());

  it("platform scan sees every tenant's due posts; a scoped read sees only its own", async () => {
    const { base } = db;
    await seedUser(base, "uA", "a@example.com");
    await seedUser(base, "uB", "b@example.com");
    await seedTenant(base, "ta", "uA");
    await seedTenant(base, "tb", "uB");
    const pA = await seedDuePost(base, "ta", "uA");
    const pB = await seedDuePost(base, "tb", "uB");

    // The cron's cross-tenant SELECT runs on the unscoped platform client.
    const scan = await base.socialPost.findMany({
      where: { status: "scheduled", externalId: null },
      select: { id: true, tenantId: true },
    });
    expect(scan.map((r) => r.id).sort()).toEqual([pA.id, pB.id].sort());
    expect(new Set(scan.map((r) => r.tenantId))).toEqual(new Set(["ta", "tb"]));

    // A per-tenant scoped read sees only its own — which is exactly why the
    // scan above MUST be unscoped: a scoped client could never drain the rest.
    const onlyA = await scoped(base, "ta").socialPost.findMany({ where: { status: "scheduled" } });
    expect(onlyA.map((r) => r.id)).toEqual([pA.id]);
  });

  it("a scoped publish-claim only matches the in-tenant row (per-row runWithTenant is load-bearing)", async () => {
    const { base } = db;
    await seedUser(base, "uA", "a@example.com");
    await seedUser(base, "uB", "b@example.com");
    await seedTenant(base, "ta", "uA");
    await seedTenant(base, "tb", "uB");
    const pB = await seedDuePost(base, "tb", "uB");

    // publishExisting's atomic CAS claim, run under the WRONG tenant (ta). The
    // chokepoint injects tenantId:"ta", so it can't match tb's post: the claim
    // silently no-ops and never touches another tenant's row.
    const wrong = await scoped(base, "ta").socialPost.updateMany({
      where: { id: pB.id, status: { in: ["draft", "scheduled", "failed"] }, externalId: null },
      data: { status: "publishing" },
    });
    expect(wrong.count).toBe(0);
    const afterWrong = await base.socialPost.findUnique({
      where: { id: pB.id },
      select: { status: true },
    });
    expect(afterWrong?.status).toBe("scheduled");

    // The drain wraps the claim in runWithTenant(row.tenantId) = "tb" — which
    // matches, exactly once.
    const right = await scoped(base, "tb").socialPost.updateMany({
      where: { id: pB.id, status: { in: ["draft", "scheduled", "failed"] }, externalId: null },
      data: { status: "publishing" },
    });
    expect(right.count).toBe(1);
    const afterRight = await base.socialPost.findUnique({
      where: { id: pB.id },
      select: { status: true },
    });
    expect(afterRight?.status).toBe("publishing");
  });
});
