import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { insertMembership, insertUser } from "@/modules/identity/repositories/directoryRepository";
import { findEmailPreferences } from "@/modules/identity/repositories/emailPreferencesRepository";
import {
  actorFromClerkUserId,
  getEmailPreferences,
  getOwnProfile,
  importMembers,
  inviteMember,
  listCampaignRecipients,
  listDirectory,
  listEmailContacts,
  listInvites,
  listPublicAuthors,
  listUsers,
  parseMemberCsv,
  setMembershipRole,
  unsubscribeByEmail,
  updateEmailPreferences,
  updateOwnProfile,
} from "@/modules/identity/services/usersService";
import { EMAIL_PREF_DEFAULTS } from "@/modules/identity/types";

import { openMemoryRegistry } from "../helpers/registry";
import { adminActor, memberActor } from "../helpers/tenant";

const ORG = "org_test";

async function seedMember(
  store: ReturnType<typeof openMemoryRegistry>,
  input: { clerk: string; email: string; name: string; role?: "admin" | "member" },
) {
  const user = await insertUser(store, {
    clerkUserId: input.clerk,
    displayName: input.name,
    email: input.email,
  });
  await insertMembership(store, { orgId: ORG, role: input.role ?? "member", userId: user.id });
  return user;
}

describe("usersService", () => {
  it("lists org members for users.view and hides other orgs", async () => {
    const store = openMemoryRegistry();
    const ada = await seedMember(store, {
      clerk: "clk_ada",
      email: "ada@example.com",
      name: "Ada",
    });
    await seedMember(store, { clerk: "clk_al", email: "al@example.com", name: "Al" });
    const outsider = await insertUser(store, {
      clerkUserId: "clk_out",
      displayName: "Out",
      email: "out@example.com",
    });
    await insertMembership(store, { orgId: "org_other", userId: outsider.id });

    const denied = await listUsers(store, memberActor(), ORG);
    expect(denied.ok).toBeFalsy();
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const listed = await listUsers(store, adminActor(), ORG);
    expect(listed.ok).toBeTruthy();
    if (!listed.ok) {
      return;
    }
    expect(listed.users.map((u) => u.email).sort()).toStrictEqual([
      "ada@example.com",
      "al@example.com",
    ]);
    expect(listed.users.every((u) => u.id !== outsider.id)).toBeTruthy();

    const searched = await listUsers(store, adminActor(), ORG, { search: "ada" });
    expect(searched.ok).toBeTruthy();
    if (searched.ok) {
      expect(searched.users.map((u) => u.id)).toStrictEqual([ada.id]);
    }
  });

  it("returns the actor profile and 404s a missing user", async () => {
    const store = openMemoryRegistry();
    const user = await insertUser(store, {
      clerkUserId: "clk_me",
      displayName: "Me",
      email: "me@example.com",
      id: "usr_admin",
    });
    const profile = await getOwnProfile(store, adminActor({ id: user.id }));
    expect(profile.ok).toBeTruthy();
    if (profile.ok) {
      expect(profile.user.email).toBe("me@example.com");
      expect(profile.user.displayName).toBe("Me");
    }

    const missing = await getOwnProfile(store, adminActor({ id: "usr_gone" }));
    expect(missing.ok).toBeFalsy();
    if (!missing.ok) {
      expect(missing.error.status).toBe(404);
    }
  });

  it("returns public authors without emails and ignores unknown ids", async () => {
    const store = openMemoryRegistry();
    const ada = await insertUser(store, {
      clerkUserId: "clk_pub",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      imageUrl: "https://example.com/ada.png",
    });
    const { authors } = await listPublicAuthors(store, [ada.id, "usr_missing"]);
    expect(authors).toStrictEqual([
      { id: ada.id, imageUrl: "https://example.com/ada.png", name: "Ada Lovelace" },
    ]);
    const empty = await listPublicAuthors(store, []);
    expect(empty.authors).toStrictEqual([]);
  });

  it("updates the actor display name", async () => {
    const store = openMemoryRegistry();
    await insertUser(store, {
      clerkUserId: "clk_me2",
      displayName: "Old",
      email: "me2@example.com",
      id: "usr_admin",
    });
    const updated = await updateOwnProfile(store, adminActor({ id: "usr_admin" }), {
      displayName: "  New Name  ",
    });
    expect(updated.ok).toBeTruthy();
    if (updated.ok) {
      expect(updated.user.displayName).toBe("New Name");
    }
  });

  it("invites a new member and lists the pending invite", async () => {
    const store = openMemoryRegistry();
    const denied = await inviteMember(store, memberActor(), ORG, { email: "x@example.com" });
    expect(denied.ok).toBeFalsy();

    const invited = await inviteMember(store, adminActor(), ORG, {
      displayName: "Ada",
      email: "ada@example.com",
    });
    expect(invited.ok).toBeTruthy();
    if (!invited.ok) {
      return;
    }
    expect(invited.created).toBeTruthy();
    const listed = await listInvites(store, adminActor(), ORG);
    expect(listed.ok).toBeTruthy();
    if (listed.ok) {
      expect(listed.invites.map((row) => row.email)).toStrictEqual(["ada@example.com"]);
    }
  });

  it("imports a CSV of members and lists them as email contacts", async () => {
    const store = openMemoryRegistry();
    const rows = parseMemberCsv("email,name\nada@example.com,Ada\nbad-line\nal@example.com,Al");
    expect(rows).toStrictEqual([
      { displayName: "Ada", email: "ada@example.com" },
      { displayName: "Al", email: "al@example.com" },
    ]);
    const imported = await importMembers(store, adminActor(), ORG, rows);
    expect(imported.ok).toBeTruthy();
    if (!imported.ok) {
      return;
    }
    expect(imported.created).toBe(2);
    const contacts = await listEmailContacts(store, adminActor(), ORG);
    expect(contacts.ok).toBeTruthy();
    if (contacts.ok) {
      expect(contacts.users.map((user) => user.email).sort()).toStrictEqual([
        "ada@example.com",
        "al@example.com",
      ]);
    }
    const forbidden = await listEmailContacts(store, memberActor(), ORG);
    expect(forbidden.ok).toBeFalsy();
  });

  it("lists a city directory without emails and requires membership", async () => {
    const store = openMemoryRegistry();
    const ada = await seedMember(store, {
      clerk: "clk_dir",
      email: "dir@example.com",
      name: "Ada",
    });
    const outsider = await insertUser(store, {
      clerkUserId: "clk_out2",
      displayName: "Out",
      email: "out2@example.com",
    });
    await insertMembership(store, { orgId: "org_other", userId: outsider.id });

    const anon = await listDirectory(store, memberActor({ id: "" }), ORG);
    expect(anon.ok).toBeFalsy();
    if (!anon.ok) {
      expect(anon.error.status).toBe(401);
    }

    const foreign = await listDirectory(store, memberActor({ id: outsider.id }), ORG);
    expect(foreign.ok).toBeFalsy();
    if (!foreign.ok) {
      expect(foreign.error.status).toBe(403);
    }

    const listed = await listDirectory(store, memberActor({ id: ada.id }), ORG);
    expect(listed.ok).toBeTruthy();
    if (!listed.ok) {
      return;
    }
    expect(listed.users.map((user) => user.id)).toStrictEqual([ada.id]);
    expect(listed.users[0]).toMatchObject({ displayName: "Ada", id: ada.id });
    expect(listed.users[0]).not.toHaveProperty("email");
  });

  it("returns email preference defaults without inserting a row", async () => {
    const store = openMemoryRegistry();
    const user = await insertUser(store, {
      clerkUserId: "clk_prefs",
      displayName: "Pref",
      email: "pref@example.com",
    });
    const loaded = await getEmailPreferences(store, memberActor({ id: user.id }));
    expect(loaded.ok).toBeTruthy();
    if (loaded.ok) {
      expect(loaded.preferences).toStrictEqual(EMAIL_PREF_DEFAULTS);
    }
    await expect(findEmailPreferences(store, user.id)).resolves.toBeNull();
  });

  it("upserts then updates email preferences and ignores unknown keys", async () => {
    const store = openMemoryRegistry();
    const user = await insertUser(store, {
      clerkUserId: "clk_prefs2",
      displayName: "Pref",
      email: "pref2@example.com",
    });
    const actor = memberActor({ id: user.id });
    const created = await updateEmailPreferences(store, actor, {
      extra: "nope",
      likes: true,
    } as { extra: string; likes: boolean });
    expect(created.ok).toBeTruthy();
    if (!created.ok) {
      return;
    }
    expect(created.preferences).toStrictEqual({ ...EMAIL_PREF_DEFAULTS, likes: true });

    const updated = await updateEmailPreferences(store, actor, { mentions: false });
    expect(updated.ok).toBeTruthy();
    if (!updated.ok) {
      return;
    }
    expect(updated.preferences.likes).toBeTruthy();
    expect(updated.preferences.mentions).toBeFalsy();

    const loaded = await getEmailPreferences(store, actor);
    expect(loaded.ok).toBeTruthy();
    if (loaded.ok) {
      expect(loaded.preferences).toStrictEqual(updated.preferences);
    }
  });

  it("lists campaign recipients and drops unsubscribed addresses", async () => {
    const store = openMemoryRegistry();
    const ada = await seedMember(store, {
      clerk: "clk_rcpt",
      email: "rcpt@example.com",
      name: "Ada",
    });
    const al = await seedMember(store, {
      clerk: "clk_rcpt2",
      email: "rcpt2@example.com",
      name: "Al",
    });

    const before = await listCampaignRecipients(store, ORG);
    expect(before.map((row) => row.id).sort()).toStrictEqual([ada.id, al.id].sort());

    const missing = await unsubscribeByEmail(store, "nobody@example.com");
    expect(missing.ok).toBeFalsy();
    if (!missing.ok) {
      expect(missing.error.status).toBe(404);
    }

    const unsubscribed = await unsubscribeByEmail(store, "rcpt2@example.com");
    expect(unsubscribed.ok).toBeTruthy();
    if (unsubscribed.ok) {
      expect(unsubscribed.email).toBe("rcpt2@example.com");
    }
    const prefs = await findEmailPreferences(store, al.id);
    expect(prefs?.weeklyDigest).toBeFalsy();

    const after = await listCampaignRecipients(store, ORG);
    expect(after).toStrictEqual([{ email: "rcpt@example.com", id: ada.id }]);
  });

  it("sets a membership role and 404s unknown users or non-members", async () => {
    const store = openMemoryRegistry();
    const ada = await seedMember(store, {
      clerk: "clk_role",
      email: "role@example.com",
      name: "Ada",
    });
    const outsider = await insertUser(store, {
      clerkUserId: "clk_role_out",
      displayName: "Out",
      email: "role-out@example.com",
    });

    const unknown = await setMembershipRole(store, ORG, "usr_missing", "admin");
    expect(unknown.ok).toBeFalsy();
    if (!unknown.ok) {
      expect(unknown.error.status).toBe(404);
    }

    const nonMember = await setMembershipRole(store, ORG, outsider.id, "admin");
    expect(nonMember.ok).toBeFalsy();
    if (!nonMember.ok) {
      expect(nonMember.error.status).toBe(404);
    }

    const promoted = await setMembershipRole(store, ORG, ada.id, "admin");
    expect(promoted.ok).toBeTruthy();
    if (promoted.ok) {
      expect(promoted).toMatchObject({ id: ada.id, role: "admin" });
    }
    const listed = await listUsers(store, adminActor(), ORG);
    expect(listed.ok && listed.users.find((u) => u.id === ada.id)?.role).toBe("admin");
  });

  it("resolves an actor from a clerk user id and refuses banned users", async () => {
    const store = openMemoryRegistry();
    const ada = await seedMember(store, {
      clerk: "clk_actor",
      email: "actor@example.com",
      name: "Ada",
      role: "admin",
    });

    await expect(actorFromClerkUserId(store.db, "clk_unknown")).resolves.toBeNull();

    const actor = await actorFromClerkUserId(store.db, "clk_actor");
    expect(actor).not.toBeNull();
    expect(actor?.id).toBe(ada.id);
    expect(actor?.email).toBe("actor@example.com");
    expect(actor?.isSuperAdmin).toBeFalsy();
    expect(actor?.permissions.has("users.view")).toBeTruthy();
    expect(actor?.permissions.has("roles.edit")).toBeFalsy();

    await store.db
      .update(store.tables.users)
      .set({ isBanned: true })
      .where(eq(store.tables.users.id, ada.id));
    await expect(actorFromClerkUserId(store.db, "clk_actor")).resolves.toBeNull();
  });

  it("rejects unauthenticated email preference reads and writes", async () => {
    const store = openMemoryRegistry();
    const anon = memberActor({ id: "" });
    const loaded = await getEmailPreferences(store, anon);
    expect(loaded.ok).toBeFalsy();
    if (!loaded.ok) {
      expect(loaded.error.status).toBe(401);
    }
    const saved = await updateEmailPreferences(store, anon, { likes: true });
    expect(saved.ok).toBeFalsy();
    if (!saved.ok) {
      expect(saved.error.status).toBe(401);
    }
  });
});
