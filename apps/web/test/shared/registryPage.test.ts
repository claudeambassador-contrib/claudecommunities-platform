import { describe, expect, it, vi } from "vitest";

import { err, ok } from "@/shared/http/errors";

// loadRegistryPage calls getRegistryStore/getRegistryDb and syncSessionUser;
// mock both module seams the same way guarded.test.ts mocks loadCityPage.
vi.mock(import("@/shared/db/env"), () => ({
  getRegistryDb: vi.fn(() => ({}) as never),
  getRegistryStore: vi.fn(() => ({ marker: "registry" }) as never),
}));
vi.mock(import("@/modules/identity/services/sessionService"), () => ({
  syncSessionUser: vi.fn(),
}));

import { syncSessionUser } from "@/modules/identity/services/sessionService";
import { getRegistryStore } from "@/shared/db/env";
import { loadRegistryPage } from "@/shared/http/registryPage";

const auth = {
  clerkUserId: "clerk_1",
  email: "a@b.c",
  isSuperAdmin: false,
  permissions: new Set() as unknown as ReadonlySet<never>,
  role: null,
  userId: "usr_1",
};

describe(loadRegistryPage, () => {
  it("returns auth: null when signed out", async () => {
    vi.mocked(syncSessionUser).mockResolvedValue(err("unauthenticated", 401) as never);
    const result = await loadRegistryPage();
    expect(result.auth).toBeNull();
    expect(result.registry).toBe(vi.mocked(getRegistryStore).mock.results[0]?.value);
  });

  it("returns the populated auth context when signed in", async () => {
    vi.mocked(syncSessionUser).mockResolvedValue(ok({ auth }) as never);
    const result = await loadRegistryPage();
    expect(result.auth).toStrictEqual(auth);
  });

  it("returns auth: null when the session sync reports banned", async () => {
    vi.mocked(syncSessionUser).mockResolvedValue(err("banned", 403) as never);
    const result = await loadRegistryPage();
    expect(result.auth).toBeNull();
  });
});
