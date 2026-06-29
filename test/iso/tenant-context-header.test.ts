import { describe, expect, it, vi } from "vitest";

// Observe the request-header resolution path (defect #3): when middleware has
// stamped `x-tenant-id`, getTenantId() must RETURN it (not throw). The
// fail-closed-when-absent case lives in context.test.ts; here we mock
// next/headers so `headers().get("x-tenant-id")` yields a value, mirroring what
// the platform-plane HOME_TENANT stamp (and the tenant-route stamp) produce.
// Module mocks are isolated per test file, so this does not affect the
// fail-closed assertions elsewhere.
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-tenant-id", "au"]]),
}));

import { getTenantId, getTenantIdOrNull, runWithTenant } from "@/lib/tenant-context";

describe("tenant-context — stamped request header (defect #3)", () => {
  it("resolves the stamped tenant instead of failing closed", async () => {
    expect(await getTenantIdOrNull()).toBe("au");
    // The key property: a platform/apex request carrying the stamp does NOT throw.
    expect(await getTenantId()).toBe("au");
  });

  it("an explicit runWithTenant scope still overrides the header", async () => {
    await runWithTenant("beta", async () => {
      expect(await getTenantId()).toBe("beta");
    });
    // outside the scope again, the header is the source
    expect(await getTenantId()).toBe("au");
  });
});
