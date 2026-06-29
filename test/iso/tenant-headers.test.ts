import { describe, expect, it } from "vitest";
import { buildTenantHeaders, TENANT_BASE_HEADER, TENANT_HEADER } from "@/lib/tenant-context";

// THE TRUST BOUNDARY (the one part of the middleware flow that has no other
// coverage). `x-tenant-id` is forgeable — a request can set it directly — so
// middleware MUST strip the inbound value before stamping the trusted,
// server-resolved tenant. The dangerous case is a selfTenanted route
// (cron/webhooks/MCP/internal): it gets NO stamp and is meant to be fail-closed,
// so a forged header that survived would let an unwrapped handler read
// `x-tenant-id: victim` and silently scope to the attacker instead of throwing.
describe("buildTenantHeaders — forged x-tenant-id is always stripped", () => {
  it("strips the forged inbound header and stamps the trusted slug (tenant route)", () => {
    const inbound = new Headers({ [TENANT_HEADER]: "victim", "x-other": "keep" });
    const out = buildTenantHeaders(inbound, { tenantSlug: "au", selfTenanted: false });
    expect(out.get(TENANT_HEADER)).toBe("au"); // the trusted slug, never the forged one
    expect(out.get("x-other")).toBe("keep"); // unrelated headers pass through
  });

  it("strips the forged header and leaves NO stamp on a selfTenanted route (fail-closed)", () => {
    const inbound = new Headers({ [TENANT_HEADER]: "victim" });
    const out = buildTenantHeaders(inbound, { tenantSlug: "au", selfTenanted: true });
    // No header at all → getTenantIdOrNull() is null → getTenantId() throws, unless
    // the handler established its own scope (runWithTenant / HMAC URL / user token).
    expect(out.get(TENANT_HEADER)).toBeNull();
  });

  it("returns a fresh Headers and never mutates the inbound request headers", () => {
    const inbound = new Headers({ [TENANT_HEADER]: "victim" });
    buildTenantHeaders(inbound, { tenantSlug: "au", selfTenanted: false });
    expect(inbound.get(TENANT_HEADER)).toBe("victim"); // original left untouched
  });

  // x-tenant-base is the path-prefix link base — equally forgeable. A request
  // that forged `x-tenant-base: /victim` could otherwise make the app emit links
  // into another tenant's path space, so it's stripped on the same boundary.
  it("strips a forged x-tenant-base and stamps the trusted base (tenant route)", () => {
    const inbound = new Headers({ [TENANT_BASE_HEADER]: "/victim" });
    const out = buildTenantHeaders(inbound, { tenantSlug: "acme", tenantBase: "/acme", selfTenanted: false });
    expect(out.get(TENANT_BASE_HEADER)).toBe("/acme"); // trusted base, never the forged one
  });

  it("defaults the base to '' (host-based tenancy) and leaves none on a selfTenanted route", () => {
    const hostBased = buildTenantHeaders(new Headers({ [TENANT_BASE_HEADER]: "/victim" }), {
      tenantSlug: "au",
      selfTenanted: false,
    });
    expect(hostBased.get(TENANT_BASE_HEADER)).toBe(""); // omitted base → "", forged value gone
    const self = buildTenantHeaders(new Headers({ [TENANT_BASE_HEADER]: "/victim" }), {
      tenantSlug: "au",
      tenantBase: "/au",
      selfTenanted: true,
    });
    expect(self.get(TENANT_BASE_HEADER)).toBeNull(); // fail-closed: no stamp at all
  });
});
