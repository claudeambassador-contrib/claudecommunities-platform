import { describe, expect, it } from "vitest";
import {
  createSpeaker,
  createSpeakerFromSubmission,
  createTalkComment,
  createTalkSubmission,
  deleteSpeaker,
  deleteTalkComment,
  deleteTalkSubmission,
  getSpeaker,
  getTalk,
  listSpeakers,
  listTalkComments,
  listTalkSubmissions,
  listUserTalks,
  reorderSpeakers,
  setTalkDeleted,
  setTalkLocks,
  setTalkStatus,
  updateSpeaker,
  updateTalkContent,
} from "@/modules/talks/services/talksService";
import { isStorageUrl } from "@/modules/talks/validators";
import { adminActor, memberActor, openMemoryTenant } from "../helpers/tenant";

const START = "2026-09-01T09:00:00.000Z";

async function seedTalk(
  store = openMemoryTenant(),
  actor = memberActor(),
  input: {
    bio?: string;
    city?: string;
    description?: string;
    email?: string;
    name?: string;
    title?: string;
  } = {},
) {
  const created = await createTalkSubmission(store, actor, {
    bio: input.bio ?? "Builds things",
    city: input.city ?? "Sydney",
    description: input.description ?? "How we ship",
    email: input.email ?? "ada@example.com",
    name: input.name ?? "Ada",
    title: input.title ?? "Building with Claude",
  });
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error("talk seed failed");
  }
  return { store, talk: created.talk };
}

async function seedEvent(store = openMemoryTenant()) {
  const now = new Date();
  const id = "evt_meetup";
  await store.db.insert(store.tables.events).values({
    createdAt: now,
    eventType: "meetup",
    id,
    isOnline: false,
    orgId: store.orgId,
    rsvpEnabled: false,
    slug: "meetup-night",
    startsAt: new Date(START),
    status: "published",
    title: "Meetup Night",
    updatedAt: now,
  });
  return { event: { id }, store };
}

describe("talksService submissions", () => {
  it("creates a submission owned by the actor", async () => {
    const { talk } = await seedTalk();
    expect(talk.title).toBe("Building with Claude");
    expect(talk.name).toBe("Ada");
    expect(talk.email).toBe("ada@example.com");
    expect(talk.status).toBe("pending");
    expect(talk.userId).toBe("usr_member");
    expect(talk.contentLocked).toBe(false);
    expect(talk.deletedAt).toBeNull();
  });

  it("rejects create without name, email, or title", async () => {
    const store = openMemoryTenant();
    const noName = await createTalkSubmission(store, memberActor(), {
      email: "a@b.com",
      title: "Talk",
    });
    expect(noName.ok).toBe(false);

    const badEmail = await createTalkSubmission(store, memberActor(), {
      email: "not-an-email",
      name: "Ada",
      title: "Talk",
    });
    expect(badEmail.ok).toBe(false);

    const noTitle = await createTalkSubmission(store, memberActor(), {
      email: "a@b.com",
      name: "Ada",
    });
    expect(noTitle.ok).toBe(false);
  });

  it("lists only the current user's talks", async () => {
    const store = openMemoryTenant();
    await seedTalk(store, memberActor({ id: "usr_a" }), { title: "Mine" });
    await seedTalk(store, memberActor({ id: "usr_b" }), { title: "Theirs" });

    const mine = await listUserTalks(store, memberActor({ id: "usr_a" }));
    expect(mine.ok).toBe(true);
    if (!mine.ok) {
      return;
    }
    expect(mine.talks.map((t) => t.title)).toEqual(["Mine"]);
  });

  it("requires speakers.edit to list all submissions", async () => {
    const { store } = await seedTalk();
    const denied = await listTalkSubmissions(store, memberActor());
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const listed = await listTalkSubmissions(store, adminActor());
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.talks).toHaveLength(1);
  });

  it("lets the owner or an admin read a talk, but not another member", async () => {
    const { store, talk } = await seedTalk();
    const owner = await getTalk(store, memberActor(), talk.id);
    expect(owner.ok).toBe(true);

    const admin = await getTalk(store, adminActor(), talk.id);
    expect(admin.ok).toBe(true);

    const stranger = await getTalk(store, memberActor({ id: "usr_other" }), talk.id);
    expect(stranger.ok).toBe(false);
    if (!stranger.ok) {
      expect(stranger.error.status).toBe(403);
    }
  });

  it("lets the owner update content until an admin locks it", async () => {
    const { store, talk } = await seedTalk();
    const updated = await updateTalkContent(store, memberActor(), talk.id, {
      title: "Revised title",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.talk.title).toBe("Revised title");

    const locked = await setTalkLocks(store, adminActor(), talk.id, { contentLocked: true });
    expect(locked.ok).toBe(true);

    const blocked = await updateTalkContent(store, memberActor(), talk.id, { title: "Nope" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.status).toBe(403);
    }

    const adminEdit = await updateTalkContent(store, adminActor(), talk.id, {
      title: "Admin rewrite",
    });
    expect(adminEdit.ok).toBe(true);
    if (!adminEdit.ok) {
      return;
    }
    expect(adminEdit.talk.title).toBe("Admin rewrite");
  });

  it("rejects empty name or title on update", async () => {
    const { store, talk } = await seedTalk();
    const emptyName = await updateTalkContent(store, memberActor(), talk.id, { name: "  " });
    expect(emptyName.ok).toBe(false);
    const emptyTitle = await updateTalkContent(store, memberActor(), talk.id, { title: "" });
    expect(emptyTitle.ok).toBe(false);
  });

  it("lets an admin set pending, approved, or declined", async () => {
    const { store, talk } = await seedTalk();
    const denied = await setTalkStatus(store, memberActor(), talk.id, "approved");
    expect(denied.ok).toBe(false);

    const approved = await setTalkStatus(store, adminActor(), talk.id, "approved");
    expect(approved.ok).toBe(true);
    if (!approved.ok) {
      return;
    }
    expect(approved.talk.status).toBe("approved");

    const declined = await setTalkStatus(store, adminActor(), talk.id, "declined");
    expect(declined.ok).toBe(true);
    if (!declined.ok) {
      return;
    }
    expect(declined.talk.status).toBe("declined");
  });

  it("hides soft-deleted talks from the default admin list", async () => {
    const { store, talk } = await seedTalk();
    const denied = await setTalkDeleted(store, memberActor(), talk.id, true);
    expect(denied.ok).toBe(false);

    const removed = await setTalkDeleted(store, adminActor(), talk.id, true);
    expect(removed.ok).toBe(true);
    if (!removed.ok) {
      return;
    }
    expect(removed.talk.deletedAt).not.toBeNull();

    const hidden = await listTalkSubmissions(store, adminActor());
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) {
      return;
    }
    expect(hidden.talks).toEqual([]);

    const withDeleted = await listTalkSubmissions(store, adminActor(), { includeDeleted: true });
    expect(withDeleted.ok).toBe(true);
    if (!withDeleted.ok) {
      return;
    }
    expect(withDeleted.talks).toHaveLength(1);

    const restored = await setTalkDeleted(store, adminActor(), talk.id, false);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    expect(restored.talk.deletedAt).toBeNull();
  });

  it("lets the owner hard-delete a pending unlocked talk, but not after review", async () => {
    const { store, talk } = await seedTalk();
    const stranger = await deleteTalkSubmission(store, memberActor({ id: "usr_other" }), talk.id);
    expect(stranger.ok).toBe(false);

    await setTalkStatus(store, adminActor(), talk.id, "approved");
    const afterReview = await deleteTalkSubmission(store, memberActor(), talk.id);
    expect(afterReview.ok).toBe(false);

    const adminDelete = await deleteTalkSubmission(store, adminActor(), talk.id);
    expect(adminDelete.ok).toBe(true);

    const missing = await getTalk(store, adminActor(), talk.id);
    expect(missing.ok).toBe(false);
  });

  it("lets the owner hard-delete their own pending talk", async () => {
    const { store, talk } = await seedTalk();
    const removed = await deleteTalkSubmission(store, memberActor(), talk.id);
    expect(removed.ok).toBe(true);
    const fetched = await getTalk(store, memberActor(), talk.id);
    expect(fetched.ok).toBe(false);
  });
});

describe("talksService speakers", () => {
  it("creates a speaker on an event and lists them in order", async () => {
    const { store, event } = await seedEvent();
    const first = await createSpeaker(store, adminActor(), event.id, {
      name: "Ada",
      talkTitle: "Opening",
    });
    const second = await createSpeaker(store, adminActor(), event.id, {
      name: "Grace",
      talkTitle: "Closing",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!(first.ok && second.ok)) {
      return;
    }
    expect(first.speaker.order).toBe(0);
    expect(second.speaker.order).toBe(1);
    expect(first.speaker.eventId).toBe(event.id);

    const listed = await listSpeakers(store, adminActor(), event.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.speakers.map((s) => s.name)).toEqual(["Ada", "Grace"]);
  });

  it("rejects speaker create without speakers.edit, name, or a real event", async () => {
    const { store, event } = await seedEvent();
    const denied = await createSpeaker(store, memberActor(), event.id, { name: "Ada" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const noName = await createSpeaker(store, adminActor(), event.id, { name: "  " });
    expect(noName.ok).toBe(false);

    const missingEvent = await createSpeaker(store, adminActor(), "evt_missing", { name: "Ada" });
    expect(missingEvent.ok).toBe(false);
    if (!missingEvent.ok) {
      expect(missingEvent.error.status).toBe(404);
    }
  });

  it("rejects non-storage headshot and logo URLs", async () => {
    const { store, event } = await seedEvent();
    const bad = await createSpeaker(store, adminActor(), event.id, {
      headshotUrl: "https://evil.example/photo.jpg",
      name: "Ada",
    });
    expect(bad.ok).toBe(false);

    const okUrl = await createSpeaker(store, adminActor(), event.id, {
      headshotUrl: "/api/files/ada.png",
      name: "Ada",
    });
    expect(okUrl.ok).toBe(true);

    const previous = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
    expect(isStorageUrl("https://cdn.example.com/ada.png")).toBe(true);
    if (previous === undefined) {
      process.env.R2_PUBLIC_URL = undefined;
    } else {
      process.env.R2_PUBLIC_URL = previous;
    }
  });

  it("requires speakers.view to list or get a speaker", async () => {
    const { store, event } = await seedEvent();
    const created = await createSpeaker(store, adminActor(), event.id, { name: "Ada" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const listDenied = await listSpeakers(store, memberActor(), event.id);
    expect(listDenied.ok).toBe(false);

    const getDenied = await getSpeaker(store, memberActor(), created.speaker.id);
    expect(getDenied.ok).toBe(false);

    const fetched = await getSpeaker(store, adminActor(), created.speaker.id);
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) {
      return;
    }
    expect(fetched.speaker.name).toBe("Ada");
  });

  it("updates speaker fields and rejects an empty name", async () => {
    const { store, event } = await seedEvent();
    const created = await createSpeaker(store, adminActor(), event.id, { name: "Ada" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const updated = await updateSpeaker(store, adminActor(), created.speaker.id, {
      company: "Anthropic",
      talkTitle: "Keynote",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.speaker.company).toBe("Anthropic");
    expect(updated.speaker.talkTitle).toBe("Keynote");

    const empty = await updateSpeaker(store, adminActor(), created.speaker.id, { name: "" });
    expect(empty.ok).toBe(false);
  });

  it("deletes a speaker and requires speakers.delete", async () => {
    const { store, event } = await seedEvent();
    const created = await createSpeaker(store, adminActor(), event.id, { name: "Ada" });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const denied = await deleteSpeaker(store, memberActor(), created.speaker.id);
    expect(denied.ok).toBe(false);

    const removed = await deleteSpeaker(store, adminActor(), created.speaker.id);
    expect(removed.ok).toBe(true);
    const fetched = await getSpeaker(store, adminActor(), created.speaker.id);
    expect(fetched.ok).toBe(false);
  });

  it("reorders speakers for an event", async () => {
    const { store, event } = await seedEvent();
    const first = await createSpeaker(store, adminActor(), event.id, { name: "Ada" });
    const second = await createSpeaker(store, adminActor(), event.id, { name: "Grace" });
    expect(first.ok && second.ok).toBe(true);
    if (!(first.ok && second.ok)) {
      return;
    }

    const bad = await reorderSpeakers(store, adminActor(), event.id, [first.speaker.id]);
    expect(bad.ok).toBe(false);

    const reordered = await reorderSpeakers(store, adminActor(), event.id, [
      second.speaker.id,
      first.speaker.id,
    ]);
    expect(reordered.ok).toBe(true);

    const listed = await listSpeakers(store, adminActor(), event.id);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.speakers.map((s) => s.name)).toEqual(["Grace", "Ada"]);
  });

  it("promotes a talk submission into an event speaker", async () => {
    const { store, event } = await seedEvent();
    const { talk } = await seedTalk(store);
    const promoted = await createSpeakerFromSubmission(store, adminActor(), event.id, talk.id);
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) {
      return;
    }
    expect(promoted.speaker.name).toBe("Ada");
    expect(promoted.speaker.talkTitle).toBe("Building with Claude");
    expect(promoted.speaker.talkDescription).toBe("How we ship");
    expect(promoted.speaker.bio).toBe("Builds things");
    expect(promoted.speaker.submissionId).toBe(talk.id);
  });
});

describe("talksService comments", () => {
  it("lets the owner and admins thread comments and blocks outsiders", async () => {
    const { store, talk } = await seedTalk();
    const outsider = memberActor({ id: "usr_other" });
    const denied = await listTalkComments(store, outsider, talk.id);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const posted = await createTalkComment(store, memberActor(), talk.id, "Need a title tweak?");
    expect(posted.ok).toBe(true);
    if (!posted.ok) {
      return;
    }
    expect(posted.comment.authorId).toBe("usr_member");

    const listed = await listTalkComments(store, adminActor(), talk.id);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.comments.map((comment) => comment.content)).toEqual(["Need a title tweak?"]);
    }

    const strangerDelete = await deleteTalkComment(store, outsider, posted.comment.id);
    expect(strangerDelete.ok).toBe(false);
    const removed = await deleteTalkComment(store, memberActor(), posted.comment.id);
    expect(removed.ok).toBe(true);
  });

  it("blocks owner comments when the talk is content-locked", async () => {
    const { store, talk } = await seedTalk();
    const locked = await setTalkLocks(store, adminActor(), talk.id, { contentLocked: true });
    expect(locked.ok).toBe(true);
    const ownerPost = await createTalkComment(store, memberActor(), talk.id, "Still editing");
    expect(ownerPost.ok).toBe(false);
    if (!ownerPost.ok) {
      expect(ownerPost.error.status).toBe(403);
    }
    const adminPost = await createTalkComment(store, adminActor(), talk.id, "Admin follow-up");
    expect(adminPost.ok).toBe(true);
  });
});
