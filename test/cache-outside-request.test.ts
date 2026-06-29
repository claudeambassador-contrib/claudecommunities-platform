import { cache } from "react";
import { describe, expect, it } from "vitest";

// getTenantConfig() is wrapped in React `cache()` for per-request memoization.
// It's called not only from RSC/route handlers (which HAVE a request scope) but
// also from the campaign-send Workflow runtime and MCP handlers, which do NOT.
// The load-bearing contract we depend on there: cache() must DEGRADE (run the
// fn, skip memoization) outside a request scope — never throw. If a React
// upgrade changed this to throw, every getTenantConfig() in the workflow would
// fail. This pins that contract.
describe("React cache() outside a request scope (workflow / MCP runtime)", () => {
  it("runs the function and does not throw", async () => {
    let runs = 0;
    const f = cache(async () => {
      runs++;
      return 42;
    });
    await expect(f()).resolves.toBe(42);
    await expect(f()).resolves.toBe(42);
    // We rely ONLY on "does not throw" — memoization is a bonus when present.
    expect(runs).toBeGreaterThanOrEqual(1);
  });
});
