import { createMiddleware } from "@tanstack/react-start";

/**
 * Tenant resolution root-of-trust: URL/host only — never Clerk org claim.
 * Stamps request context for downstream loaders; actual DB open happens in services.
 *
 * Precedence: custom hostname → /{slug}/… path → none (platform apex).
 */
export const tenantRequestMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    const url = new URL(request.url);
    const pathSlug = pathTenantSlug(url.pathname);
    const hostSlug = hostTenantSlug(url.hostname);

    const result = await next({
      context: {
        tenantSlugHint: pathSlug ?? hostSlug ?? null,
        requestHost: url.hostname,
      },
    });
    return result;
  },
);

const RESERVED = new Set([
  "admin",
  "api",
  "login",
  "signup",
  "sign-in",
  "sign-up",
  "mcp",
  "oauth",
  "pricing",
  "assets",
  "_server",
  ".well-known",
]);

function pathTenantSlug(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg || RESERVED.has(seg) || seg.startsWith(".")) return null;
  return seg.toLowerCase();
}

function hostTenantSlug(hostname: string): string | null {
  // city.claudecommunities.com → city; localhost / workers.dev → null
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return null;
  if (hostname.endsWith(".workers.dev")) return null;
  const parts = hostname.split(".");
  if (parts.length < 3) return null;
  const sub = parts[0]?.toLowerCase();
  if (!sub || sub === "www" || sub === "app") return null;
  return sub;
}
