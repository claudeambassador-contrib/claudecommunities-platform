import { describe, expect, it } from "vitest";
import {
  FLAT_PLATFORM_SEGMENTS,
  isFlatPlatformPath,
  isValidTenantSlug,
  parseTenantRequest,
  RESERVED_SLUGS,
} from "@/lib/tenant-resolve";

const opts = {
  platformHosts: ["claudecommunities.com", "localhost", "*.workers.dev"],
  // Tenant-subdomain bases are a SUBSET of platform hosts — workers.dev is
  // deliberately absent so preview labels (pr-123) stay home, not tenants.
  tenantSubdomainBases: ["claudecommunities.com", "localhost"],
};
const parse = (host: string, path: string) => parseTenantRequest(host, path, opts);

// THE CONTRACT (post /t/[tenant] move): a platform host serves the deploy's HOME
// tenant for content paths and a flat top-level handler for the platform plane;
// real tenants arrive on their own (custom) domains. Slug-in-path tenancy is
// intentionally NOT resolved (only AU is live).
describe("tenant-resolve — root of trust (§1)", () => {
  it("apex host + root → the HOME tenant (rewritten to /t/<home>/)", () => {
    expect(parse("claudecommunities.com", "/")).toEqual({ kind: "home" });
  });

  it("apex host + a RESERVED/content path → home (reserved words are never slug candidates)", () => {
    // These dirs moved under app/t/[tenant]/; on a platform host they are the
    // home tenant's content, served via the home rewrite. They're all reserved,
    // so path-prefix (rule 6) never claims them. (`/acme/spaces`, a NON-reserved
    // first segment, is now a slug candidate — covered in the path-prefix block.)
    for (const p of ["/events", "/community/guidelines", "/admin", "/courses/intro"]) {
      expect(parse("claudecommunities.com", p), p).toEqual({ kind: "home" });
    }
  });

  it("apex host + a FLAT platform segment → platform (served top-level, no rewrite)", () => {
    for (const r of ["api", "sitemap.xml", ".well-known", "pricing", "login", "oauth", "mcp", "internal"]) {
      expect(parse("claudecommunities.com", `/${r}/x`).kind, r).toBe("platform");
    }
  });

  it("MOVED content words are NOT flat platform segments (else they'd 404 on the home host)", () => {
    for (const w of ["admin", "events", "community", "courses", "cities", "merch", "for"]) {
      expect(FLAT_PLATFORM_SEGMENTS.has(w), w).toBe(false);
    }
  });

  it("rejects a direct external request to /t/* (anti-bypass)", () => {
    expect(parse("claudecommunities.com", "/t/victim/spaces")).toEqual({ kind: "reject-direct-t" });
  });

  it("a non-platform host is a custom domain (whole path owned by the tenant)", () => {
    expect(parse("community.acme.com", "/spaces")).toEqual({ kind: "custom-domain", host: "community.acme.com" });
  });

  it("a custom domain stays custom-domain even for flat paths (exemption is middleware's job)", () => {
    // parse returns custom-domain; middleware then uses isFlatPlatformPath to
    // serve /api flat (stamp, no rewrite) instead of rewriting to /t/<slug>/api.
    expect(parse("claudecommunity.com.au", "/api/events")).toEqual({
      kind: "custom-domain",
      host: "claudecommunity.com.au",
    });
  });

  it("platform host matching ignores port and is case-insensitive", () => {
    expect(parse("ClaudeCommunities.com:8787", "/events")).toEqual({ kind: "home" });
    expect(parse("localhost:3000", "/events")).toEqual({ kind: "home" });
  });

  it("subdomain wildcard host counts as platform (preview deploys → home tenant)", () => {
    expect(parse("pr-123.workers.dev", "/events")).toEqual({ kind: "home" });
  });

  it("custom domain still rejects direct /t/*", () => {
    expect(parse("community.acme.com", "/t/other")).toEqual({ kind: "reject-direct-t" });
  });
});

// Subdomain tenancy: `<label>.<base>` for a configured tenant-subdomain base
// resolves to tenant `<label>` (a CANDIDATE — middleware confirms it against the
// registry and maps a miss back to the home tenant). Host wins over path.
describe("tenant-resolve — subdomain tenancy (host-based, no link threading)", () => {
  it("a tenant label under a configured base → subdomain", () => {
    expect(parse("acme.claudecommunities.com", "/community")).toEqual({ kind: "subdomain", slug: "acme" });
    expect(parse("acme.localhost:3000", "/events")).toEqual({ kind: "subdomain", slug: "acme" });
  });

  it("host wins over path: a flat path on a subdomain is still that tenant (middleware applies the flat exemption)", () => {
    // NOT platform/home — the API call belongs to acme; if this resolved to
    // platform→HOME_TENANT, acme's API calls would be scoped to the home tenant.
    expect(parse("acme.claudecommunities.com", "/api/events")).toEqual({ kind: "subdomain", slug: "acme" });
  });

  it("the bare base is NOT a subdomain (apex stays home)", () => {
    expect(parse("claudecommunities.com", "/events")).toEqual({ kind: "home" });
    expect(parse("localhost:3000", "/events")).toEqual({ kind: "home" });
  });

  it("a non-tenant label is still a CANDIDATE (middleware maps the registry miss to home)", () => {
    // `www` is a valid slug shape, so parse returns it; middleware's
    // resolveTenantBySlug miss → HOME_TENANT keeps www.<base> on the home site.
    expect(parse("www.claudecommunities.com", "/")).toEqual({ kind: "subdomain", slug: "www" });
  });

  it("a deeper name (a.b.<base>) is NOT a single-label subdomain → home", () => {
    expect(parse("a.b.claudecommunities.com", "/events")).toEqual({ kind: "home" });
  });

  it("a preview wildcard host is NOT a tenant subdomain (workers.dev absent from bases) → home", () => {
    // THE regression guard: if workers.dev leaked into the subdomain bases,
    // every preview deploy would silently become a tenant named after its label.
    expect(parse("pr-123.workers.dev", "/events")).toEqual({ kind: "home" });
  });

  it("a reserved label is rejected as a subdomain slug → home (not a candidate)", () => {
    // `api`/`admin` fail isValidTenantSlug, so they never read as a tenant label.
    expect(parse("api.claudecommunities.com", "/x")).toEqual({ kind: "home" });
  });
});

// Path-prefix tenancy: `host/<slug>/…` on a bare platform apex resolves to tenant
// `<slug>` (a CANDIDATE — middleware confirms via the registry and re-serves a
// miss as home content). Reserved/content words are never slugs; host wins over
// path.
describe("tenant-resolve — path-prefix (slug) tenancy", () => {
  it("a non-reserved first segment on the apex → slug candidate", () => {
    expect(parse("claudecommunities.com", "/acme/community")).toEqual({ kind: "slug", slug: "acme" });
    expect(parse("claudecommunities.com", "/acme")).toEqual({ kind: "slug", slug: "acme" });
    expect(parse("localhost:3000", "/acme/events/spring")).toEqual({ kind: "slug", slug: "acme" });
  });

  it("a RESERVED/content first segment is NOT a slug → home", () => {
    for (const p of ["/events", "/community/feed", "/admin", "/courses", "/merch", "/for/pros"]) {
      expect(parse("claudecommunities.com", p), p).toEqual({ kind: "home" });
    }
  });

  it("a FLAT platform segment still wins over slug (checked first) → platform", () => {
    for (const p of ["/api/x", "/login", "/oauth/y", "/mcp", "/sitemap.xml", "/pricing"]) {
      expect(parse("claudecommunities.com", p).kind, p).toBe("platform");
    }
  });

  it("HOST WINS over path: a tenant subdomain ignores a slug-shaped first segment", () => {
    // acme.<base>/beta/x is acme's content path /beta/x, NEVER tenant beta.
    expect(parse("acme.claudecommunities.com", "/beta/x")).toEqual({ kind: "subdomain", slug: "acme" });
  });

  it("HOST WINS over path: a custom domain ignores a slug-shaped first segment", () => {
    expect(parse("community.acme.com", "/beta/x")).toEqual({ kind: "custom-domain", host: "community.acme.com" });
  });

  it("the apex root itself is home, not a slug", () => {
    expect(parse("claudecommunities.com", "/")).toEqual({ kind: "home" });
  });
});

describe("isFlatPlatformPath — the rewrite-exemption (flat vs tenant content)", () => {
  it("flat platform paths are exempt from the /t/<slug>/ rewrite", () => {
    for (const p of ["/api/events", "/login", "/oauth/register", "/mcp", "/internal/slide-render/x", "/sitemap.xml", "/.well-known/x", "/pricing"]) {
      expect(isFlatPlatformPath(p), p).toBe(true);
    }
  });
  it("tenant content paths are NOT exempt (they get rewritten)", () => {
    for (const p of ["/", "/events", "/community/guidelines", "/community/feed", "/admin", "/courses/intro"]) {
      expect(isFlatPlatformPath(p), p).toBe(false);
    }
  });
});

describe("isValidTenantSlug", () => {
  it("accepts url-safe slugs incl. the existing 2-char region slugs", () => {
    for (const s of ["au", "nz", "acme", "acme-co", "a1b2", "claude-au"]) expect(isValidTenantSlug(s), s).toBe(true);
  });
  it("rejects reserved, too-short, or malformed slugs", () => {
    for (const s of ["api", "admin", "t", "a", "-acme", "acme-", "Acme", "a b", "x".repeat(50)]) {
      expect(isValidTenantSlug(s), s).toBe(false);
    }
  });
  it("every reserved slug is rejected as a tenant slug", () => {
    for (const r of RESERVED_SLUGS) expect(isValidTenantSlug(r), r).toBe(false);
  });
});
