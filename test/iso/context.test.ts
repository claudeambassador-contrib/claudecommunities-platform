import { describe, expect, it } from "vitest";
import { getAlsTenant, getTenantId, getTenantIdOrNull, runWithTenant } from "@/lib/tenant-context";

// The ALS path (cron/workflow/queue + withTenant) — testable in plain node.
describe("tenant-context — ALS resolution & fail-closed", () => {
  it("runWithTenant exposes the tenant to getTenantId", async () => {
    await runWithTenant("alpha", async () => {
      expect(await getTenantId()).toBe("alpha");
      expect(getAlsTenant()).toBe("alpha");
    });
  });

  it("nested runWithTenant: inner wins, outer restored (no bleed across switch)", async () => {
    await runWithTenant("alpha", async () => {
      expect(await getTenantId()).toBe("alpha");
      await runWithTenant("beta", async () => {
        expect(await getTenantId()).toBe("beta");
      });
      // back in alpha's scope — the inner scope did not leak
      expect(await getTenantId()).toBe("alpha");
    });
  });

  it("concurrent runWithTenant scopes stay isolated", async () => {
    const results = await Promise.all([
      runWithTenant("alpha", async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getTenantId();
      }),
      runWithTenant("beta", async () => getTenantId()),
    ]);
    expect(results).toEqual(["alpha", "beta"]);
  });

  it("getTenantId fails closed outside any scope (no ALS, no request header)", async () => {
    expect(getAlsTenant()).toBeUndefined();
    expect(await getTenantIdOrNull()).toBeNull();
    await expect(getTenantId()).rejects.toThrow(/No tenant in context/);
  });

  it("runWithTenant rejects an empty tenantId", () => {
    expect(() => runWithTenant("", async () => 1)).toThrow();
  });
});
