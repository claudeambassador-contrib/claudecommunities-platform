import { describe, expect, it } from "vitest";

import { publishStarterFromEnv } from "@/modules/social/services/publishStarter";
import {
  claimPostForPublish,
  listDuePublishable,
  markPublishFailed,
} from "@/modules/social/services/socialService";

import { openMemoryTenant } from "../helpers/tenant";

async function insertScheduledPost(store: ReturnType<typeof openMemoryTenant>, id: string) {
  const { socialPosts } = store.tables;
  const now = new Date();
  await store.db.insert(socialPosts).values({
    accountId: null,
    body: "hello world",
    createdAt: now,
    createdById: "usr_owner",
    errorMessage: null,
    externalId: null,
    externalUrl: null,
    id,
    mediaType: "none",
    mediaUrls: "[]",
    orgId: store.orgId,
    platform: "linkedin",
    publishAttempts: 0,
    publishedAt: null,
    scheduledAt: new Date(Date.now() - 60_000),
    status: "scheduled",
    updatedAt: now,
  } as never);
}

describe("publish seam", () => {
  it("listDuePublishable returns due scheduled posts without externalId", async () => {
    const store = openMemoryTenant();
    await insertScheduledPost(store, "post_1");
    const result = await listDuePublishable(store, new Date());
    expect(result.ok).toBeTruthy();
    if (result.ok) {
      expect(result.posts.map((p) => p.id)).toContain("post_1");
    }
  });

  it("claimPostForPublish claims a scheduled post", async () => {
    const store = openMemoryTenant();
    await insertScheduledPost(store, "post_1");
    const result = await claimPostForPublish(store, "post_1");
    expect(result.ok).toBeTruthy();
    if (result.ok) {
      expect(result.claimed).toBeTruthy();
    }
  });

  it("markPublishFailed writes status=failed with the message", async () => {
    const store = openMemoryTenant();
    await insertScheduledPost(store, "post_1");
    const result = await markPublishFailed(store, "post_1", "no connector");
    expect(result.ok).toBeTruthy();
    const { socialPosts } = store.tables;
    const rows = await store.db.select().from(socialPosts);
    expect(rows[0]?.status).toBe("failed");
    expect(rows[0]?.errorMessage).toBe("no connector");
  });

  it("publishStarterFromEnv returns undefined without a binding and a starter with one", async () => {
    expect(publishStarterFromEnv({})).toBeUndefined();
    const calls: unknown[] = [];
    const starter = publishStarterFromEnv({
      PUBLISH_POST: {
        create: (opts: unknown) => {
          calls.push(opts);
          return Promise.resolve();
        },
      },
    });
    expect(starter).toBeDefined();
    await starter?.start({ d1Binding: "TENANT_TEST", orgId: "org_test", postId: "p1" });
    expect(calls).toStrictEqual([
      { params: { d1Binding: "TENANT_TEST", orgId: "org_test", postId: "p1" } },
    ]);
  });
});
