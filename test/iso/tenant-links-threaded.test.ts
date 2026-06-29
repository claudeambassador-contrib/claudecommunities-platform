import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// PATH-PREFIX SAFETY GUARD (the completeness gate for the link sweep).
//
// Path-prefix tenancy (`host/<slug>/…`) renders the app under `/t/<slug>/` but
// the app emits ROOT-ABSOLUTE links (`/community/feed`). If a link doesn't
// re-attach the `/<slug>`, the next navigation resolves to the HOME tenant and
// the user is silently reading/writing the WRONG community — a tenant-confusion
// defect in the root of trust, the exact failure class multi-tenancy exists to
// prevent. (It's not an auth hole — membership still scopes — but "acts in the
// wrong tenant" is serious.)
//
// This guard proves every in-tenant navigation under `app/t/[tenant]/**` goes
// through the tenant-base primitives — `<TenantLink>` / `useTenantRouter()` /
// `tenantHref()` — which no-op in host-based tenancy (base "") and prefix in
// path-prefix tenancy. GREEN ⇔ path-prefix is safe to ship.
//
// The whole in-tenant nav surface is exactly three primitives (0 raw
// `<a href="/…">` exist — verified at sweep time): next/link, useRouter, and
// redirect("/…"). Each banned form has one deterministic tenant-safe rewrite.
// `tenantHref` no-ops external/flat/already-prefixed hrefs, so the rewrites are
// always safe — even for `/login` or `/api`.

// BOTH in-tenant render surfaces: the tenant pages AND the shared components
// they render (Navbar/Footer/sidebars/etc. live in src/components but render
// INSIDE the tenant tree, so a bare link there drops the tenant just the same —
// a gap the e2e smoke test caught that scanning only app/t/[tenant] missed).
const SCAN_ROOTS = [
  resolve(import.meta.dirname, "../../src/app/t/[tenant]"),
  resolve(import.meta.dirname, "../../src/components"),
];

// The ONE exemption: TenantBaseProvider.tsx IS the implementation of the
// primitives (it wraps next/link + useRouter to build TenantLink/useTenantRouter).
const EXEMPT = new Set([resolve(import.meta.dirname, "../../src/components/TenantBaseProvider.tsx")]);

const BANNED: Array<{ re: RegExp; label: string; fix: string }> = [
  {
    re: /from\s+["']next\/link["']/,
    label: "next/link import",
    fix: 'import { TenantLink } from "@/components/TenantBaseProvider" and use <TenantLink>',
  },
  {
    re: /\buseRouter\b/,
    label: "useRouter()",
    fix: "use useTenantRouter() from @/components/TenantBaseProvider",
  },
  {
    re: /\bredirect\(\s*["'`]\//,
    label: 'redirect("/…") to a root-absolute literal',
    fix: 'redirect(tenantHref(await getTenantBase(), "/…"))',
  },
  {
    re: /window\.location\.(?:href|assign|replace)\s*[=(]\s*["'`]\//,
    label: 'window.location → "/…" hard navigation',
    fix: 'window.location.href = tenantHref(useTenantBase(), "/…") (or useTenantRouter().push)',
  },
  {
    re: /<form\b[^>]*\saction=["'`]\//,
    label: '<form action="/…">',
    fix: 'action={tenantHref(base, "/…")}',
  },
  {
    re: /signOut\(\s*\{[^}]*redirectUrl:\s*["'`]\//,
    label: 'signOut({ redirectUrl: "/…" }) — signs out to the wrong tenant',
    fix: "redirectUrl: tenantHref(useTenantBase(), \"/…\")",
  },
  {
    re: /window\.location\.origin\}\//,
    label: "`${window.location.origin}/…` absolute URL (share links) drops the tenant path",
    fix: "`${window.location.origin}${tenantHref(base, `/…`)}`",
  },
];

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkTsx(full));
    else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("in-tenant links go through the tenant base (path-prefix safety)", () => {
  const files = SCAN_ROOTS.flatMap(walkTsx).filter((f) => !EXEMPT.has(f));

  it("finds files to scan (guard against a broken glob)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  for (const { re, label, fix } of BANNED) {
    it(`no in-tenant file (app/t/[tenant]/** or src/components/**) uses a bare ${label}`, () => {
      const offenders = files
        .filter((f) => re.test(readFileSync(f, "utf-8")))
        .map((f) => f.slice(f.indexOf("src/")));
      expect(
        offenders,
        `These files use a bare ${label}, which drops the tenant under path-prefix tenancy. Fix: ${fix}.\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    });
  }
});

// Positive control — proves the matchers catch the bad forms and pass the
// tenant-safe rewrites, independent of the directory scan (so the guard is still
// meaningful once the sweep makes the scan all-green).
describe("guard matchers (positive control)", () => {
  const [link, router, redir, winloc, form, signout, origin] = BANNED.map((b) => b.re);
  it("flags the bare forms", () => {
    expect(link.test('import Link from "next/link"')).toBe(true);
    expect(router.test("const r = useRouter();")).toBe(true);
    expect(redir.test('redirect("/community")')).toBe(true);
    expect(redir.test("redirect(`/events/${id}`)")).toBe(true);
    expect(winloc.test('window.location.href = "/my-talks"')).toBe(true);
    expect(winloc.test('window.location.replace("/login")')).toBe(true);
    expect(form.test('<form action="/community/search" method="GET">')).toBe(true);
    expect(signout.test('signOut({ redirectUrl: "/" })')).toBe(true);
    expect(origin.test("`${window.location.origin}/community/posts/${id}`")).toBe(true);
  });
  it("passes the tenant-safe rewrites", () => {
    expect(link.test('import { TenantLink } from "@/components/TenantBaseProvider"')).toBe(false);
    expect(router.test("const r = useTenantRouter();")).toBe(false);
    expect(redir.test('redirect(tenantHref(base, "/community"))')).toBe(false);
    expect(winloc.test('window.location.href = tenantHref(base, "/my-talks")')).toBe(false);
    expect(form.test("<form action={tenantHref(base, `/community/search`)} method=\"GET\">")).toBe(false);
    expect(signout.test("signOut({ redirectUrl: tenantHref(base, `/`) })")).toBe(false);
    expect(origin.test("`${window.location.origin}${tenantHref(base, `/community/posts/${id}`)}`")).toBe(false);
  });
});
