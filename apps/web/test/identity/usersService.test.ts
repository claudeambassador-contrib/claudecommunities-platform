import { describe, expect, it } from "vitest";
import { insertMembership, insertUser } from "@/modules/identity/repositories/directoryRepository";
import { getOwnProfile, listUsers } from "@/modules/identity/services/usersService";
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
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.status).toBe(403);
    }

    const listed = await listUsers(store, adminActor(), ORG);
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(listed.users.map((u) => u.email).sort()).toEqual(["ada@example.com", "al@example.com"]);
    expect(listed.users.every((u) => u.id !== outsider.id)).toBe(true);

    const searched = await listUsers(store, adminActor(), ORG, { search: "ada" });
    expect(searched.ok).toBe(true);
    if (searched.ok) {
      expect(searched.users.map((u) => u.id)).toEqual([ada.id]);
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
    expect(profile.ok).toBe(true);
    if (profile.ok) {
      expect(profile.user.email).toBe("me@example.com");
      expect(profile.user.displayName).toBe("Me");
    }

    const missing = await getOwnProfile(store, adminActor({ id: "usr_gone" }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.status).toBe(404);
    }
  });
});
