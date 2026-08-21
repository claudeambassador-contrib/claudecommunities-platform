import { describe, expect, it, vi } from "vitest";

import { err, ok } from "@/shared/http/errors";
import type { Result } from "@/shared/http/errors";

// guarded() calls loadCityPage internally; mock the module seam.
vi.mock(import("@/shared/http/cityPage"), () => ({
  loadCityPage: vi.fn(),
}));

import { loadCityPage } from "@/shared/http/cityPage";
import { guarded } from "@/shared/http/guarded";

const actor = {
  email: "a@b.c",
  id: "usr_1",
  isSuperAdmin: false,
  permissions: new Set(["courses.view"]) as unknown as ReadonlySet<never>,
};

function page(overrides: object = {}) {
  return ok({
    actor,
    auth: null,
    ctx: {} as never,
    registry: {} as never,
    store: {} as never,
    tenant: { slug: "sydney" } as never,
    ...overrides,
  });
}

describe(guarded, () => {
  it("denies when the page fails to load", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(err("not_found", 404) as never);
    const result = await guarded("sydney", null, async () => ok({ x: 1 }));
    expect(result).toStrictEqual({
      allowed: false,
      code: "not_found",
      reason: "That page or record doesn't exist.",
    });
  });

  it("denies unauthenticated (no actor)", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(page({ actor: null }) as never);
    const result = await guarded("sydney", null, async () => ok({ x: 1 }));
    expect(result).toStrictEqual({
      allowed: false,
      code: "unauthenticated",
      reason: "Sign in to continue.",
    });
  });

  it("denies a missing permission with code 'forbidden'", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(page() as never);
    const result = await guarded("sydney", "events.edit", async () => ok({ x: 1 }));
    expect(result).toStrictEqual({
      allowed: false,
      code: "forbidden",
      reason: "Missing permission: events.edit",
    });
  });

  it("maps a service error to denied", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(page() as never);
    const result = await guarded(
      "sydney",
      null,
      async () => err("invalid_input", 400) as Result<{ x: number }>,
    );
    expect(result).toStrictEqual({
      allowed: false,
      code: "invalid_input",
      reason: "That input couldn't be saved. Check the fields and try again.",
    });
  });

  it("returns the payload flattened with allowed: true", async () => {
    vi.mocked(loadCityPage).mockResolvedValue(page() as never);
    const result = await guarded("sydney", "courses.view", (p) => {
      expect(p.actor.id).toBe("usr_1");
      return Promise.resolve(ok({ courses: [1, 2] }));
    });
    expect(result).toStrictEqual({ allowed: true, courses: [1, 2] });
  });
});
