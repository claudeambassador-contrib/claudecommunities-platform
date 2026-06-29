import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getRegionConfig } from "@/lib/region";
import { buildTenantHeaders, HOME_TENANT } from "@/lib/tenant-context";
import { resolveTenantByDomain, resolveTenantBySlug } from "@/lib/tenant-registry";
import { isFlatPlatformPath, parseTenantRequest } from "@/lib/tenant-resolve";

// Hosts that ARE the platform (apex + local + preview). Anything else is a
// custom domain pointing at a tenant. Override per-env with PLATFORM_HOSTS.
const PLATFORM_HOSTS = (
  process.env.PLATFORM_HOSTS ?? "claudecommunities.com,localhost,127.0.0.1,workers.dev"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Bases under which a single leading DNS label is a tenant slug
// (`acme.claudecommunities.com`, `acme.localhost` → tenant `acme`). A SUBSET of
// PLATFORM_HOSTS — deliberately excludes preview wildcards (`workers.dev`) and
// the bare IP, whose labels are deploy ids / not hostnames, not tenants.
const TENANT_SUBDOMAIN_BASES = (
  process.env.TENANT_SUBDOMAIN_BASES ?? "claudecommunities.com,localhost"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// A tenant whose registry row is `status="suspended"` (both custom-domain and
// subdomain resolution use this).
function suspendedResponse(): Response {
  return new NextResponse("This community is currently unavailable.", {
    status: 503,
    headers: { "retry-after": "3600", "cache-control": "no-store" },
  });
}

// Maintenance mode: flip via wrangler.
//   wrangler secret put MAINTENANCE_MODE        (then enter "true")
//   wrangler secret delete MAINTENANCE_MODE     (to turn off)
// Or set in wrangler.jsonc vars and redeploy.
//
// Bypass for testing while maintenance is on: set a MAINTENANCE_BYPASS_TOKEN
// secret, then visit any URL with ?bypass=<token>. The middleware sets an
// httpOnly cookie so the rest of the session goes through normally.
//   wrangler secret put MAINTENANCE_BYPASS_TOKEN --env staging
function maintenanceResponse(pathname: string): Response {
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/trpc/");
  if (isApi) {
    return new NextResponse(
      JSON.stringify({ error: "Service temporarily unavailable for maintenance." }),
      {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "retry-after": "600",
          "cache-control": "no-store",
        },
      },
    );
  }
  const { lang, communityName } = getRegionConfig();
  const html = `<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Maintenance &middot; ${communityName}</title>
<style>
  html,body{margin:0;padding:0;background:#1C1917;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:480px;text-align:center}
  .badge{width:80px;height:80px;border-radius:9999px;background:rgba(212,131,106,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:36px}
  h1{font-size:24px;font-weight:700;margin:0 0 12px}
  p{color:#A8A29E;line-height:1.5;margin:0 0 12px}
  .small{font-size:14px;color:#78716C;margin-top:24px}
</style></head>
<body><div class="wrap"><div class="card">
  <div class="badge">🛠️</div>
  <h1>We'll be right back</h1>
  <p>The site is down for scheduled maintenance.</p>
  <p>Sign-ups, logins, posts and submissions are temporarily unavailable.</p>
  <p class="small">Thanks for your patience.</p>
</div></div></body></html>`;
  return new NextResponse(html, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "retry-after": "600",
      "cache-control": "no-store",
    },
  });
}

// Routes that skip Clerk entirely - just pass through
const isStaticRoute = createRouteMatcher([
  "/",
  "/events",
  "/events/claude-impact-lab-melbourne(.*)",
  "/professionals",
  "/vibe-coders",
  "/cowork",
  "/courses(.*)",
  // Public marketing/content pages that must stay crawlable (in the sitemap).
  "/resources(.*)",
  "/for(.*)",
  // Tenant-authored CMS pages (Pages CMS) — reserved `/p/` prefix.
  "/p/(.*)",
  "/speak",
  "/offline",
  "/cities(.*)",
  "/merch",
  "/sitemap",
  "/sitemap.xml",
  "/robots.txt",
  "/.well-known/oauth-authorization-server(.*)",
  "/.well-known/oauth-protected-resource(.*)",
  "/mcp(.*)",
  "/oauth/register(.*)",
  "/api/email/(.*)",
  "/api/upload/mcp",
  "/api/files/(.*)",
  // Impact Lab portal — fully self-contained, has its own session auth.
  "/impact-lab(.*)",
  "/api/impact-lab(.*)",
  // Internal renderer pages reached by Cloudflare Browser Rendering with no
  // Clerk session — authenticated by an HMAC signature on the query string
  // (see `@/lib/slideRenderSign`). Without this bypass the puppeteer call
  // is redirected to Clerk's hosted account portal.
  "/internal/(.*)",
]);

// Routes that go through Clerk but don't require auth
const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  // Event detail pages render public content (SEO metadata, JSON-LD) but call
  // getCurrentUserWithPermissions, so they go through Clerk without requiring
  // auth. The /events/[slug]/resources page enforces sign-in itself.
  "/events(.*)",
  "/professionals",
  "/vibe-coders",
  "/cowork",
  "/courses(.*)",
  // Public marketing/content pages (also in the sitemap). `/community/guidelines`
  // and `/webinars/*` render public content but their layouts call getCurrentUser,
  // so they go through Clerk (public, not auth-gated) rather than skipping it.
  "/resources(.*)",
  "/community/guidelines",
  "/webinars(.*)",
  "/for(.*)",
  // Tenant-authored CMS pages (Pages CMS) — reserved `/p/` prefix.
  "/p/(.*)",
  "/speak",
  "/pricing",
  "/api/webhooks(.*)",
  "/api/email/(.*)",
  "/api/events",
  "/api/impact-lab-interest",
  "/offline",
  "/cities(.*)",
  "/merch",
  "/sitemap",
  "/sitemap.xml",
  "/robots.txt",
]);

// Routes that resolve their OWN tenant downstream, so middleware must NOT stamp
// a tenant header (it would mis-scope them): cron iterates ALL tenants, webhooks
// carry the tenant in the payload, MCP in the user token, internal slide-render
// in the HMAC-signed URL. All live under flat platform segments.
function isSelfTenantedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/mcp") ||
    pathname === "/mcp" ||
    pathname.startsWith("/mcp/") ||
    pathname.startsWith("/internal")
  );
}

const BYPASS_COOKIE = "maintenance_bypass";

// Crawl-critical and static paths that must NEVER receive the 503 maintenance
// page — robots/sitemap keep SEO crawlers honest, the rest are static/system
// assets. These bypass maintenance entirely and fall through to normal handling.
function bypassesMaintenance(pathname: string): boolean {
  return (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/sitemap" ||
    pathname === "/offline" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.endsWith(".webmanifest") ||
    // static file assets (belt-and-suspenders if the config matcher ever changes)
    /\.(?:html?|css|js|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|txt|xml|map)$/i.test(
      pathname,
    )
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; the middleware's sequential maintenance/auth/tenant/allowlist gates would carry the same score if extracted, so reducing it requires a real decomposition out of scope for a lint pass
export default clerkMiddleware(async (auth, request) => {
  // Maintenance kill-switch — short-circuits before Clerk so it works even if
  // Clerk/DB are misbehaving.
  if (process.env.MAINTENANCE_MODE === "true") {
    const { pathname } = request.nextUrl;

    // Crawl-critical & static paths bypass maintenance and return normally,
    // so a short downtime never corrupts robots.txt/sitemap.xml or assets.
    if (!bypassesMaintenance(pathname)) {
      const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN;
      const queryToken = request.nextUrl.searchParams.get("bypass");
      const cookieToken = request.cookies.get(BYPASS_COOKIE)?.value;

      // Query param sets the cookie so subsequent requests work without it.
      if (bypassToken && queryToken === bypassToken) {
        const url = request.nextUrl.clone();
        url.searchParams.delete("bypass");
        const res = NextResponse.redirect(url);
        res.cookies.set(BYPASS_COOKIE, bypassToken, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 8, // 8 hours
        });
        return res;
      }

      if (!bypassToken || cookieToken !== bypassToken) {
        return maintenanceResponse(pathname);
      }
    }
  }

  // ── Tenant resolution — the root of trust (docs/multi-tenancy-isolation-spec.md §1).
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const parsed = parseTenantRequest(host, pathname, {
    platformHosts: PLATFORM_HOSTS,
    tenantSubdomainBases: TENANT_SUBDOMAIN_BASES,
  });

  // Anti-bypass: the /t/* shape is ONLY produced by our own rewrite below; an
  // external request using it is trying to skip slug/host validation.
  if (parsed.kind === "reject-direct-t") {
    return new NextResponse("Not found", { status: 404 });
  }

  // Resolve the tenant slug. A platform host (apex/content) serves the deploy's
  // trusted HOME tenant; a custom domain or a tenant subdomain is resolved
  // against the registry (cached — the only pre-tenant DB read). `platform` and
  // `home` both map to HOME_TENANT; they differ only in flat-vs-rewrite below.
  //
  // `contentPath` is the path the app + the auth policy see: identical to
  // `pathname` for every host-based kind, but for path-prefix (`slug`) it's the
  // path with the leading `/<slug>` stripped. `tenantBase` is "" except for a
  // confirmed path-prefix tenant, where it's "/<slug>" (stamped downstream so
  // in-tenant links re-attach it).
  let tenantSlug = "";
  let contentPath = pathname;
  let tenantBase = "";
  // The platform plane: the apex (`claudecommunities.com`) is NOT a tenant — it
  // serves the public community directory + the platform console (top-level
  // `src/app/(platform)/…`). No tenant is stamped and the path is NEVER rewritten
  // under `/t/<slug>/`. Unknown subdomains / unknown first-path-segments resolve
  // here too (rather than leaking the old home tenant).
  let servePlatform = false;
  if (parsed.kind === "custom-domain") {
    const tenant = await resolveTenantByDomain(parsed.host);
    if (!tenant) return new NextResponse("Community not found", { status: 404 });
    if (tenant.status === "suspended") return suspendedResponse();
    tenantSlug = tenant.slug;
  } else if (parsed.kind === "subdomain") {
    // The subdomain label is a CANDIDATE — confirm it against the registry. An
    // unknown label (e.g. `www`, or a not-yet-provisioned slug) falls through to
    // the platform directory rather than 404.
    const tenant = await resolveTenantBySlug(parsed.slug);
    if (tenant?.status === "suspended") return suspendedResponse();
    if (tenant) tenantSlug = tenant.slug;
    else servePlatform = true;
  } else if (parsed.kind === "slug") {
    // Path-prefix: confirm the candidate. A MISS is served by the platform tree
    // (so `/blah` 404s as a platform page); only a real registered slug is
    // stripped + scoped. On a hit, the tenant lives in the URL path, so the base
    // is "/<slug>" and the app sees the path without it.
    const tenant = await resolveTenantBySlug(parsed.slug);
    if (tenant?.status === "suspended") return suspendedResponse();
    if (tenant) {
      tenantSlug = tenant.slug;
      tenantBase = `/${tenant.slug}`;
      contentPath = pathname.slice(tenantBase.length) || "/";
    } else {
      servePlatform = true;
    }
  } else if (parsed.kind === "home") {
    // Apex content path (`/`, `/admin`, …) → the platform plane, not a tenant.
    servePlatform = true;
  } else {
    // parsed.kind === "platform" → a FLAT platform route (api/auth/oauth/mcp/
    // metadata/…) served top-level on every host. Keep the HOME_TENANT stamp so
    // shared infra (login/signup/api fallbacks) still resolves a tenant.
    tenantSlug = HOME_TENANT;
  }

  // Platform plane: no tenant stamp, no rewrite. The directory is public; only
  // the console (`/admin…`) requires auth (its layout further gates super_admin).
  if (servePlatform) {
    if (pathname.startsWith("/admin")) await auth.protect();
    const headers = buildTenantHeaders(request.headers, {
      tenantSlug: "",
      tenantBase: "",
      selfTenanted: true, // strip inbound x-tenant-id, stamp NOTHING
    });
    return NextResponse.next({ request: { headers } });
  }

  // selfTenanted routes establish their OWN tenant downstream and must stay
  // fail-closed (NO stamp) — see isSelfTenantedPath. All are flat paths.
  const selfTenanted = isSelfTenantedPath(pathname);

  // A flat platform path (api/auth/oauth/mcp/metadata/…) is served by its
  // top-level handler on every host — stamped but NOT rewritten under /t/<slug>/.
  // `platform` kind is flat by definition; for a custom domain, test the path.
  // A `slug` request never reaches here flat (its first segment is the slug, not
  // a flat word — the resolver checks flat before slug), so it always rewrites.
  const flat = parsed.kind === "platform" || isFlatPlatformPath(pathname);

  // Auth gate — uniform + granular, on the CONTENT path. For host-based kinds
  // that's `pathname`; for path-prefix it's `pathname` with the `/<slug>`
  // stripped, so isStaticRoute/isPublicRoute (the SEO-tested policy) apply to
  // `/community/…`, not `/acme/community/…`. createRouteMatcher reads only
  // `req.nextUrl.pathname`, so a path shim gates the stripped path exactly —
  // while auth.protect() runs on the UNMUTATED request, so Clerk's post-login
  // returnBackUrl keeps the `/<slug>`. (The shim path is verified under
  // `wrangler dev`; vitest can't drive createRouteMatcher.)
  const gateReq =
    contentPath === pathname
      ? request
      : ({ nextUrl: { pathname: contentPath } } as unknown as typeof request);
  if (!isStaticRoute(gateReq) && !isPublicRoute(gateReq)) {
    await auth.protect();
  }

  // Forward headers with the inbound x-tenant-id / x-tenant-base ALWAYS stripped
  // (forgeable), and the trusted slug + base stamped only when NOT selfTenanted.
  // selfTenanted routes stay fail-closed — passing through with both removed.
  const headers = buildTenantHeaders(request.headers, { tenantSlug, tenantBase, selfTenanted });

  // selfTenanted: pass through (no stamp; it scopes itself downstream).
  if (selfTenanted) return NextResponse.next({ request: { headers } });

  // Flat platform path → serve top-level, no rewrite. Content path → rewrite into
  // the tenant subtree app/t/[tenant]/<rest>. `contentPath` already has any
  // path-prefix `/<slug>` removed, so the rewrite target is the same shape for
  // every kind.
  if (flat) return NextResponse.next({ request: { headers } });
  const url = request.nextUrl.clone();
  url.pathname = `/t/${tenantSlug}${contentPath === "/" ? "" : contentPath}`;
  return NextResponse.rewrite(url, { request: { headers } });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
