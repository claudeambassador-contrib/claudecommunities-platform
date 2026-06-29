import { describe, expect, it } from "vitest";
import { tenantHref } from "@/lib/tenant-base";

// tenantHref is the single choke point that re-attaches the path-prefix `/<slug>`
// to in-tenant links. The structural guard proves every link GOES THROUGH it;
// these prove it transforms correctly. The host-based case (base "") must be a
// pure identity so threading is a no-op for subdomain/custom-domain/home.
describe("tenantHref", () => {
  it("is the identity when base is '' (host-based tenancy — the common case)", () => {
    for (const h of ["/community/feed", "/", "/events", "https://x.com", "#top", "mailto:a@b.c"]) {
      expect(tenantHref("", h), h).toBe(h);
    }
  });

  it("prepends the base to a root-absolute in-tenant href", () => {
    expect(tenantHref("/acme", "/community/feed")).toBe("/acme/community/feed");
    expect(tenantHref("/acme", "/events/spring")).toBe("/acme/events/spring");
  });

  it("maps the tenant home '/' to the bare base (no trailing slash)", () => {
    expect(tenantHref("/acme", "/")).toBe("/acme");
  });

  it("never prefixes FLAT platform routes (host-level, must stay un-prefixed)", () => {
    for (const h of ["/api/events", "/login", "/sign-in", "/oauth/register", "/mcp", "/sitemap.xml", "/.well-known/x", "/pricing"]) {
      expect(tenantHref("/acme", h), h).toBe(h);
    }
  });

  it("leaves external / non-path hrefs alone", () => {
    for (const h of ["https://x.com/y", "//cdn.example.com/a", "mailto:a@b.c", "tel:+123", "#section", "?tab=2", "./rel", "../up"]) {
      expect(tenantHref("/acme", h), h).toBe(h);
    }
  });

  it("is idempotent — an already-prefixed href is not doubled", () => {
    expect(tenantHref("/acme", "/acme")).toBe("/acme");
    expect(tenantHref("/acme", "/acme/community")).toBe("/acme/community");
  });

  it("classifies flat vs content by the PATH only, ignoring ?query / #hash", () => {
    expect(tenantHref("/acme", "/community?error=unauthorized")).toBe("/acme/community?error=unauthorized");
    expect(tenantHref("/acme", "/login?redirect_url=/my-talks")).toBe("/login?redirect_url=/my-talks"); // flat
    expect(tenantHref("/acme", "/api/x?y=1")).toBe("/api/x?y=1"); // flat with query
  });
});
