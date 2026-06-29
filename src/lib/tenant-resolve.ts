/**
 * Tenant resolution — the root of trust (`docs/multi-tenancy-isolation-spec.md`
 * §1). Decides, from the request URL/host ALONE, which tenant a request belongs
 * to. If this is wrong, every downstream scope is wrong, so the rules are
 * explicit and unit-tested:
 *
 *   1. Resolve from URL/host only — never from the Clerk JWT org claim.
 *   2. A path that already starts with `/t/` on ingress is REJECTED — that shape
 *      is only ever produced by middleware's internal rewrite, so an external
 *      request using it is trying to bypass host validation.
 *   3. A non-platform host is a custom domain → resolve the tenant via the registry.
 *   4. A `<label>.<base>` host, where `base` is a configured tenant-subdomain
 *      base, is that tenant → `subdomain` (a CANDIDATE; middleware confirms the
 *      label against the registry and maps a miss back to the home tenant).
 *   5. A FLAT platform first-segment (`api`, `oauth`, `mcp`, metadata, …) is a
 *      cross-tenant route served by a top-level handler — never rewritten.
 *   6. On a bare platform apex, a first path segment that is a valid tenant slug
 *      is path-prefix tenancy → `slug` (a CANDIDATE; middleware confirms it
 *      against the registry and re-serves a miss as home content).
 *   7. Otherwise (apex root or a non-slug content path) the request belongs to
 *      the deploy's HOME tenant → middleware rewrites it to `/t/<home>/…`.
 *
 * Host wins over path: a tenant subdomain (rule 4) is resolved before any path
 * inspection, so `acme.host/beta/x` is acme's content, never beta's. And the
 * flat check (rule 5) precedes the slug check, but they can't conflict — every
 * flat/reserved word fails `isValidTenantSlug`, so `/api`, `/events`, `/admin`
 * are never slug candidates. Precedence: reject-/t/ → custom-domain → subdomain
 * → platform(flat) → slug(path) → home.
 *
 * Path-prefix (rule 6) is the one model that needs every in-tenant link to carry
 * the `/<slug>` prefix (host-based models — custom domain, subdomain — don't,
 * since the host carries the tenant across navigation). That threading is
 * enforced by a structural test over `app/t/[tenant]/**`; see
 * `@/lib/tenant-base` and `tenant-links-threaded.test.ts`.
 *
 * This module is PURE (no DB). The async registry lookup + the rewrite/headers
 * live in `src/middleware.ts`, which consumes `parseTenantRequest`.
 */

/**
 * First-path-segments served by a top-level (flat) handler on EVERY host — the
 * cross-tenant platform plane: framework/data, auth, machine/integration, and
 * SEO/metadata routes. Middleware never rewrites these under `/t/<tenant>/`; on
 * a platform host they classify the request as `platform`, and on a tenant host
 * (custom domain) they're the rewrite-exemption. NARROW on purpose — distinct
 * from {@link RESERVED_SLUGS} (which stays broad for signup-slug validation).
 */
export const FLAT_PLATFORM_SEGMENTS: ReadonlySet<string> = new Set([
  // framework / data
  "api",
  "trpc",
  "_next",
  // auth (pages live at the apex; Clerk aliases included)
  "login",
  "signup",
  "sign-in",
  "sign-up",
  // machine / integration
  "mcp",
  "oauth",
  "internal", // HMAC-signed renderer routes
  // SEO / metadata / system
  "sitemap",
  "sitemap.xml",
  "robots",
  "robots.txt",
  "manifest",
  "manifest.webmanifest",
  "favicon.ico",
  ".well-known",
  "offline",
  // platform marketing (the SaaS product itself, not a tenant's content)
  "pricing",
]);

/**
 * First-path-segments that can never be a tenant SIGNUP slug. Broad superset of
 * {@link FLAT_PLATFORM_SEGMENTS} that ALSO reserves the moved content words
 * (`admin`, `events`, `community`, …) so nobody registers a slug that would
 * collide with a `/t/<slug>/<content>` path. Used ONLY by {@link isValidTenantSlug}
 * — routing uses `FLAT_PLATFORM_SEGMENTS`.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "t", // the internal rewrite prefix itself
  "api",
  "trpc",
  "_next",
  "admin",
  "start",
  "sign-in",
  "sign-up",
  "login",
  "signup",
  "sitemap",
  "sitemap.xml",
  "robots",
  "robots.txt",
  "manifest",
  "manifest.webmanifest",
  "favicon.ico",
  ".well-known",
  "offline",
  "internal", // HMAC-signed renderer routes
  "oauth",
  "mcp",
  // Platform marketing / shared content routes that live at the apex today.
  "pricing",
  "merch",
  "cities",
  "community",
  "events",
  "courses",
  "resources",
  "speak",
  "cowork",
  "webinars",
  "impact-lab",
  "for",
  "professionals",
  "vibe-coders",
]);

export type TenantRequest =
  | { kind: "reject-direct-t" } // external request to /t/* → 404
  | { kind: "platform" } // flat platform route (api/auth/oauth/mcp/metadata/…) → no rewrite
  | { kind: "home" } // platform host, content path → the deploy's HOME tenant (rewrite to /t/<home>/…)
  | { kind: "custom-domain"; host: string } // resolve tenant by customDomain (rewrite to /t/<slug>/…)
  | { kind: "subdomain"; slug: string } // <label>.<base> → tenant <label> (registry-confirmed; rewrite to /t/<label>/…)
  | { kind: "slug"; slug: string }; // host/<slug>/… path-prefix → tenant <slug> (registry-confirmed; strip + rewrite to /t/<slug>/…)

export interface ParseOptions {
  /**
   * Hosts that are the platform itself (apex + previews + local). A request to
   * any other host is treated as a custom domain. Hostnames only (no port);
   * a leading `*.` means "this host and any subdomain".
   */
  platformHosts: string[];
  /**
   * Bases under which a single leading DNS label is read as a tenant slug
   * (`acme.claudecommunities.com`, `acme.localhost` → tenant `acme`). A SUBSET
   * of platform hosts — deliberately excludes preview wildcards like
   * `workers.dev`, whose labels are deploy ids, not tenants. Omit/empty to
   * disable subdomain tenancy.
   */
  tenantSubdomainBases?: string[];
}

/** Strip a `:port` and lowercase a host header value. */
function normalizeHost(host: string): string {
  return host.replace(/:\d+$/, "").toLowerCase();
}

function isPlatformHost(host: string, platformHosts: string[]): boolean {
  const h = normalizeHost(host);
  return platformHosts.some((p) => {
    const base = p.toLowerCase().replace(/^\*\./, "");
    return h === base || h.endsWith(`.${base}`);
  });
}

/**
 * If `host` is `<label>.<base>` for some configured tenant-subdomain base, return
 * the single leading label as a candidate tenant slug. Returns null for the bare
 * base (`host === base` → not a subdomain, stays home), for deeper names
 * (`a.b.base` → label contains a dot), and for a label that isn't a valid slug.
 * The label is NOT registry-checked here (pure module) — middleware confirms it.
 */
function tenantSubdomainLabel(host: string, bases: string[] | undefined): string | null {
  if (!bases?.length) return null;
  const h = normalizeHost(host);
  for (const b of bases) {
    const base = b.toLowerCase().replace(/^\*\./, "");
    if (h === base || !h.endsWith(`.${base}`)) continue;
    const label = h.slice(0, h.length - base.length - 1);
    if (label && !label.includes(".") && isValidTenantSlug(label)) return label;
  }
  return null;
}

/** First path segment (decoded, lowercased), or "" for the apex. */
function firstSegment(pathname: string): string {
  const seg = pathname.replace(/^\/+/, "").split("/")[0] ?? "";
  try {
    return decodeURIComponent(seg).toLowerCase();
  } catch {
    return seg.toLowerCase();
  }
}

/**
 * Classify a request by host + pathname. PURE — the caller performs the registry
 * lookup for `custom-domain`/`slug` results and maps a miss to 404 (and
 * `status=suspended` to 503).
 */
export function parseTenantRequest(
  host: string,
  pathname: string,
  opts: ParseOptions,
): TenantRequest {
  // (2) An ingress path already under /t/ is an attempt to bypass resolution.
  const seg0 = firstSegment(pathname);
  if (seg0 === "t") return { kind: "reject-direct-t" };

  // (3) Non-platform host → custom domain (the tenant owns the whole path).
  if (host && !isPlatformHost(host, opts.platformHosts)) {
    return { kind: "custom-domain", host: normalizeHost(host) };
  }

  // (4) `<label>.<base>` on a tenant-subdomain base → that tenant. Host wins over
  // path and over the flat check below: `acme.host/api` is acme's API call (the
  // tenant is stamped; middleware applies the flat-path exemption for the
  // rewrite), never the platform's.
  const sub = tenantSubdomainLabel(host, opts.tenantSubdomainBases);
  if (sub) return { kind: "subdomain", slug: sub };

  // (5) A flat platform first-segment is served top-level on every host.
  if (FLAT_PLATFORM_SEGMENTS.has(seg0)) return { kind: "platform" };

  // (6) Path-prefix tenancy on a bare apex: a first segment that is a valid slug
  // is a CANDIDATE tenant (middleware confirms via the registry; a miss is
  // re-served as home content). Reached only after the flat check, and
  // isValidTenantSlug rejects every reserved/content word, so a real content
  // path (/events, /admin, /community) is never mistaken for a tenant.
  if (isValidTenantSlug(seg0)) return { kind: "slug", slug: seg0 };

  // (7) Apex root or any reserved/content path on a platform host → HOME tenant.
  return { kind: "home" };
}

/**
 * True when `pathname` is a flat platform route served by a top-level handler
 * (`/api/…`, `/login`, `/oauth/…`, metadata, …). Middleware uses this as the
 * rewrite-exemption inside a resolved-tenant request (`home`/`custom-domain`):
 * a flat path is tenant-STAMPED but NOT rewritten under `/t/<slug>/`, so e.g.
 * `claudecommunity.com.au/api/events` stays at `app/api/events` instead of
 * 404-ing at `/t/au/api/events`.
 */
export function isFlatPlatformPath(pathname: string): boolean {
  return FLAT_PLATFORM_SEGMENTS.has(firstSegment(pathname));
}

/**
 * Validate a candidate slug at signup time: lowercase alphanumeric + internal
 * hyphens, 2–39 chars, not reserved. Allows the existing 2-char region slugs
 * (`au`, `nz`).
 */
export function isValidTenantSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,37}[a-z0-9]$/.test(slug) && !RESERVED_SLUGS.has(slug);
}
