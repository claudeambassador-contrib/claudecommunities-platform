import { describe, expect, it } from "vitest";
import {
  createComment,
  createPost,
  createSpace,
  deletePost,
  listComments,
  listFeed,
  listPostReactions,
  listSpaces,
  markSpaceViewed,
  setPostPin,
  togglePostBookmark,
  togglePostReaction,
  unreadCounts,
  updatePost,
} from "@/modules/community/services/communityService";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

async function seedSpace() {
  const store = openMemoryTenant();
  const space = await createSpace(store, adminActor(), { name: "General" });
  expect(space.ok).toBe(true);
  if (!space.ok) {
    throw new Error("space seed failed");
  }
  return { space: space.space, store };
}

describe("community feed", () => {
  it("creates a post and lists it in the feed", async () => {
    const { store, space } = await seedSpace();
    const created = await createPost(store, memberActor(), {
      content: "Hello city",
      spaceId: space.id,
      title: "Intro",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.post.content).toBe("Hello city");
    expect(created.post.space?.slug).toBe("general");

    const feed = await listFeed(store);
    expect(feed.ok).toBe(true);
    if (!feed.ok) {
      return;
    }
    expect(feed.posts).toHaveLength(1);
    expect(feed.posts[0]?.title).toBe("Intro");
  });

  it("rejects empty content and a missing space", async () => {
    const { store, space } = await seedSpace();
    const empty = await createPost(store, memberActor(), { content: "   ", spaceId: space.id });
    expect(empty.ok).toBe(false);
    const missing = await createPost(store, memberActor(), {
      content: "hi",
      spaceId: "spc_missing",
    });
    expect(missing.ok).toBe(false);
  });

  it("lets the author update and an admin pin, but not a stranger delete", async () => {
    const { store, space } = await seedSpace();
    const created = await createPost(store, memberActor(), {
      content: "Draft",
      spaceId: space.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const updated = await updatePost(store, memberActor(), created.post.id, { content: "Live" });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.post.content).toBe("Live");

    const pinned = await setPostPin(store, adminActor(), created.post.id, true);
    expect(pinned.ok).toBe(true);

    const denied = await deletePost(store, memberActor({ id: "usr_other" }), created.post.id);
    expect(denied.ok).toBe(false);

    const removed = await deletePost(store, memberActor(), created.post.id);
    expect(removed.ok).toBe(true);
  });
});

describe("comments, reactions, bookmarks", () => {
  it("nests replies under a parent comment", async () => {
    const { store, space } = await seedSpace();
    const post = await createPost(store, memberActor(), { content: "Thread", spaceId: space.id });
    expect(post.ok).toBe(true);
    if (!post.ok) {
      return;
    }
    const parent = await createComment(store, memberActor(), {
      content: "Top",
      postId: post.post.id,
    });
    expect(parent.ok).toBe(true);
    if (!parent.ok) {
      return;
    }
    const reply = await createComment(store, memberActor({ id: "usr_b" }), {
      content: "Reply",
      parentId: parent.comment.id,
      postId: post.post.id,
    });
    expect(reply.ok).toBe(true);

    const tree = await listComments(store, post.post.id);
    expect(tree.ok).toBe(true);
    if (!tree.ok) {
      return;
    }
    expect(tree.comments).toHaveLength(1);
    expect(tree.comments[0]?.replies[0]?.content).toBe("Reply");
  });

  it("toggles a post reaction and bookmark", async () => {
    const { store, space } = await seedSpace();
    const post = await createPost(store, memberActor(), { content: "React", spaceId: space.id });
    expect(post.ok).toBe(true);
    if (!post.ok) {
      return;
    }

    const on = await togglePostReaction(store, memberActor(), post.post.id, "🔥");
    expect(on.ok).toBe(true);
    if (!on.ok) {
      return;
    }
    expect(on.reacted).toBe(true);
    const listed = await listPostReactions(store, post.post.id, memberActor().id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.reactions).toEqual([{ count: 1, emoji: "🔥", reacted: true }]);

    const off = await togglePostReaction(store, memberActor(), post.post.id, "🔥");
    expect(off.ok).toBe(true);
    if (!off.ok) {
      return;
    }
    expect(off.reacted).toBe(false);

    const bookmarked = await togglePostBookmark(store, memberActor(), post.post.id);
    expect(bookmarked.ok).toBe(true);
    if (!bookmarked.ok) {
      return;
    }
    expect(bookmarked.isBookmarked).toBe(true);
  });
});

describe("spaces", () => {
  it("lists spaces and tracks unread posts until viewed", async () => {
    const { store, space } = await seedSpace();
    const spaces = await listSpaces(store);
    expect(spaces.ok).toBe(true);
    if (!spaces.ok) {
      return;
    }
    expect(spaces.spaces[0]?.name).toBe("General");

    await createPost(store, memberActor({ id: "usr_author" }), {
      content: "New",
      spaceId: space.id,
    });
    const unread = await unreadCounts(store, memberActor());
    expect(unread.ok).toBe(true);
    if (!unread.ok) {
      return;
    }
    expect(unread.counts[space.id]).toBe(1);

    await markSpaceViewed(store, memberActor(), space.id);
    const after = await unreadCounts(store, memberActor());
    expect(after.ok).toBe(true);
    if (!after.ok) {
      return;
    }
    expect(after.counts[space.id]).toBeUndefined();
  });
});
