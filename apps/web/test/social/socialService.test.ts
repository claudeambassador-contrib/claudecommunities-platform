import { describe, expect, it } from "vitest";
import {
  connectAccount,
  createPost,
  deletePost,
  disconnectAccount,
  getPost,
  listAccounts,
  listPosts,
  publishDueScheduled,
  publishExisting,
  reconcileDelegatedScheduled,
  resetStuckPublishing,
  updatePost,
} from "@/modules/social/services/socialService";
import type { SocialConnector } from "@/modules/social/types";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

const FUTURE = "2026-12-01T09:00:00.000Z";

function testConnector(overrides: Partial<SocialConnector> = {}): SocialConnector {
  return {
    capabilities: { maxTextLength: 100 },
    deleteRemote: ({ externalId }) => {
      deleted.push(externalId);
      return Promise.resolve();
    },
    id: "zernio",
    publish: ({ content }) => {
      published.push(content);
      return Promise.resolve({
        externalId: `ext_${published.length}`,
        externalUrl: "https://example.com/p/1",
      });
    },
    supportsNativeScheduling: true,
    updateRemote: () => Promise.resolve(),
    ...overrides,
  };
}

const published: string[] = [];
const deleted: string[] = [];

function resetFakes(): void {
  published.length = 0;
  deleted.length = 0;
}

async function seededAccount() {
  resetFakes();
  const store = openMemoryTenant();
  const connected = await connectAccount(store, adminActor(), {
    connector: "zernio",
    displayName: "Claude AU",
    externalId: "org_li",
    platform: "linkedin",
  });
  expect(connected.ok).toBe(true);
  if (!connected.ok) {
    throw new Error("connect failed");
  }
  return { account: connected.account, store };
}

describe("social accounts", () => {
  it("connects and lists accounts for managers only", async () => {
    const store = openMemoryTenant();
    const denied = await connectAccount(store, memberActor(), {
      connector: "zernio",
      displayName: "Nope",
      externalId: "x",
      platform: "linkedin",
    });
    expect(denied.ok).toBe(false);

    const connected = await connectAccount(store, adminActor(), {
      connector: "zernio",
      displayName: "Claude AU",
      externalId: "org_li",
      platform: "linkedin",
    });
    expect(connected.ok).toBe(true);
    const listed = await listAccounts(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.accounts).toHaveLength(1);
    expect(listed.accounts[0]?.displayName).toBe("Claude AU");

    const hidden = await listAccounts(store, memberActor());
    expect(hidden.ok).toBe(false);
  });

  it("disconnects an account", async () => {
    const { account, store } = await seededAccount();
    const removed = await disconnectAccount(store, adminActor(), account.id);
    expect(removed.ok).toBe(true);
    const listed = await listAccounts(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.accounts).toHaveLength(0);
  });
});

describe("social posts", () => {
  it("creates a draft and lists it", async () => {
    const { account, store } = await seededAccount();
    const created = await createPost(store, adminActor(), {
      accountId: account.id,
      content: "Hello community",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.post.status).toBe("draft");
    expect(created.post.content).toBe("Hello community");
    expect(created.post.account.displayName).toBe("Claude AU");

    const listed = await listPosts(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.posts).toHaveLength(1);
  });

  it("rejects empty content, over-limit text, and non-storage media", async () => {
    const { account, store } = await seededAccount();
    const empty = await createPost(store, adminActor(), {
      accountId: account.id,
      content: "",
    });
    expect(empty.ok).toBe(false);

    const long = await createPost(
      store,
      adminActor(),
      { accountId: account.id, content: "x".repeat(101) },
      { connector: testConnector() },
    );
    expect(long.ok).toBe(false);

    const media = await createPost(
      store,
      adminActor(),
      {
        accountId: account.id,
        content: "pic",
        mediaType: "image",
        mediaUrls: ["https://evil.example/x.png"],
      },
      { connector: testConnector() },
    );
    expect(media.ok).toBe(false);
  });

  it("schedules a future post and publishes immediately when asked", async () => {
    const { account, store } = await seededAccount();
    const scheduled = await createPost(store, adminActor(), {
      accountId: account.id,
      action: "scheduled",
      content: "Later",
      scheduledAt: FUTURE,
    });
    expect(scheduled.ok).toBe(true);
    if (!scheduled.ok) {
      return;
    }
    expect(scheduled.post.status).toBe("scheduled");

    const publishedNow = await createPost(
      store,
      adminActor(),
      { accountId: account.id, action: "publish", content: "Now" },
      { connector: testConnector() },
    );
    expect(publishedNow.ok).toBe(true);
    if (!publishedNow.ok) {
      return;
    }
    expect(publishedNow.post.status).toBe("published");
    expect(publishedNow.post.externalUrl).toBe("https://example.com/p/1");
    expect(published).toEqual(["Now"]);
  });

  it("does not edit a published post and deletes a delegated schedule remotely first", async () => {
    const { account, store } = await seededAccount();
    const created = await createPost(
      store,
      adminActor(),
      { accountId: account.id, action: "publish", content: "Live" },
      { connector: testConnector() },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const edited = await updatePost(store, adminActor(), created.post.id, { content: "Nope" });
    expect(edited.ok).toBe(false);

    const delegated = await createPost(store, adminActor(), {
      accountId: account.id,
      action: "scheduled",
      content: "Zernio later",
      scheduledAt: FUTURE,
    });
    expect(delegated.ok).toBe(true);
    if (!delegated.ok) {
      return;
    }
    const handed = await publishExisting(store, delegated.post.id, {
      connector: testConnector({
        publish: () =>
          Promise.resolve({ externalId: "z_99", externalUrl: "https://example.com/z" }),
      }),
    });
    expect(handed.ok).toBe(true);
    if (!handed.ok) {
      return;
    }
    expect(handed.post.status).toBe("scheduled");
    expect(handed.post.externalId).toBe("z_99");

    const removed = await deletePost(store, adminActor(), handed.post.id, {
      connector: testConnector(),
    });
    expect(removed.ok).toBe(true);
    expect(deleted).toEqual(["z_99"]);
    const gone = await getPost(store, adminActor(), handed.post.id);
    expect(gone.ok).toBe(false);
  });

  it("drains due scheduled posts and reconciles delegated ones", async () => {
    const { account, store } = await seededAccount();
    const due = await createPost(store, adminActor(), {
      accountId: account.id,
      action: "scheduled",
      content: "Due",
      scheduledAt: FUTURE,
    });
    expect(due.ok).toBe(true);
    if (!due.ok) {
      return;
    }

    const drained = await publishDueScheduled(store, new Date("2027-01-01T00:00:00.000Z"), {
      connector: testConnector({ supportsNativeScheduling: false }),
    });
    expect(drained.ok).toBe(true);
    if (!drained.ok) {
      return;
    }
    expect(drained.dispatched).toEqual([due.post.id]);
    const loaded = await getPost(store, adminActor(), due.post.id);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    expect(loaded.post.status).toBe("published");

    const delegated = await createPost(store, adminActor(), {
      accountId: account.id,
      action: "scheduled",
      content: "Remote",
      scheduledAt: FUTURE,
    });
    expect(delegated.ok).toBe(true);
    if (!delegated.ok) {
      return;
    }
    await publishExisting(store, delegated.post.id, {
      connector: testConnector({
        publish: () =>
          Promise.resolve({ externalId: "z_due", externalUrl: "https://example.com/z" }),
      }),
    });
    const reconciled = await reconcileDelegatedScheduled(
      store,
      new Date("2027-01-01T00:00:00.000Z"),
    );
    expect(reconciled.ok).toBe(true);
    if (!reconciled.ok) {
      return;
    }
    expect(reconciled.count).toBe(1);
  });

  it("resets rows stuck in publishing", async () => {
    const { account, store } = await seededAccount();
    const created = await createPost(store, adminActor(), {
      accountId: account.id,
      content: "Stuck",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await publishExisting(store, created.post.id, {
      workflow: { start: () => Promise.resolve({ workflowId: "wf_stuck" }) },
    });
    const reset = await resetStuckPublishing(store, 0);
    expect(reset.ok).toBe(true);
    if (!reset.ok) {
      return;
    }
    expect(reset.count).toBeGreaterThanOrEqual(1);
  });

  it("claims a post once so a second publish does not fire", async () => {
    const { account, store } = await seededAccount();
    const created = await createPost(store, adminActor(), {
      accountId: account.id,
      content: "Once",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const starts: number[] = [];
    const first = await publishExisting(store, created.post.id, {
      workflow: {
        start: ({ attempt, postId }) => {
          starts.push(attempt);
          expect(postId).toBe(created.post.id);
          return Promise.resolve({ workflowId: `wf_${attempt}` });
        },
      },
    });
    expect(first.ok).toBe(true);
    const second = await publishExisting(store, created.post.id, {
      workflow: {
        start: ({ attempt }) => {
          starts.push(attempt);
          return Promise.resolve({ workflowId: `wf_${attempt}` });
        },
      },
    });
    expect(second.ok).toBe(true);
    expect(starts).toEqual([1]);
  });

  it("hands a draft-to-scheduled update to a native connector", async () => {
    const { account, store } = await seededAccount();
    const created = await createPost(store, adminActor(), {
      accountId: account.id,
      content: "Composer",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const scheduled = await updatePost(
      store,
      adminActor(),
      created.post.id,
      { scheduledAt: FUTURE, status: "scheduled" },
      { connector: testConnector() },
    );
    expect(scheduled.ok).toBe(true);
    if (!scheduled.ok) {
      return;
    }
    expect(scheduled.post.status).toBe("scheduled");
    expect(scheduled.post.externalId).toBe("ext_1");
  });

  it("reconnects the same account instead of duplicating it", async () => {
    const store = openMemoryTenant();
    await connectAccount(store, adminActor(), {
      connector: "zernio",
      displayName: "Old",
      externalId: "org_li",
      platform: "linkedin",
    });
    const again = await connectAccount(store, adminActor(), {
      connector: "zernio",
      displayName: "New",
      externalId: "org_li",
      platform: "linkedin",
    });
    expect(again.ok).toBe(true);
    const listed = await listAccounts(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.accounts).toHaveLength(1);
    expect(listed.accounts[0]?.displayName).toBe("New");
  });

  it("rejects member create", async () => {
    const { account, store } = await seededAccount();
    const denied = await createPost(store, memberActor(), {
      accountId: account.id,
      content: "Nope",
    });
    expect(denied.ok).toBe(false);
  });

  it("requires social.publish (not just social.edit) to create with action publish", async () => {
    const { account, store } = await seededAccount();
    const editorOnly = adminActor({
      permissions: new Set(["social.edit", "social.view"]),
    });
    const draft = await createPost(store, editorOnly, {
      accountId: account.id,
      content: "Draft is fine",
    });
    expect(draft.ok).toBe(true);

    const denied = await createPost(
      store,
      editorOnly,
      { accountId: account.id, action: "publish", content: "Not allowed" },
      { connector: testConnector() },
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }
  });
});
