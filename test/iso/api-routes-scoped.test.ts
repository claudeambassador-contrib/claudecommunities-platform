import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// B8 isolation invariant — STRUCTURAL guard (the regression guard the
// chokepoint behavioural tests can't give): NO API route may import the
// UNSCOPED default `prisma` export from "@/lib/prisma".
//
// Why structural, not behavioural: a route handler reaches the DB via
// getPrisma(), which resolves the tenant from the middleware-stamped
// x-tenant-id header (request context) and needs getCloudflareContext().env.DB
// — neither exists in this Node/better-sqlite3 harness, so we can't invoke a
// real handler here. But the failure mode we must prevent is singular and
// statically visible: a route that calls `prisma.<model>.update({where:{id}})`
// on the UNSCOPED client, where `id` is an attacker-controlled URL param,
// reads/mutates ANOTHER tenant's row (cross-tenant IDOR) — invisible to tsc,
// `next build`, and the lint ratchet (which excludes src/app/api/**).
//
// The chokepoint's by-id scoping (a scoped client returns null / throws P2025
// for a foreign-tenant id) is proven in tenant-scope.test.ts. THIS test proves
// every route actually USES that scoped client. Together: a cross-tenant id can
// neither be read nor mutated through any API route.
//
// Allowed imports from "@/lib/prisma": the NAMED getPrisma (request-scoped),
// getPlatformPrisma (global/registry/Impact-Lab), and withTenant. Banned: the
// DEFAULT export (legacy unscoped client).

// Both surfaces the tenant-scope lint ratchet excludes (governed instead by the
// route/MCP service lockdown): API routes AND MCP tools. email/track slipped a
// dynamic unscoped import past the lint here; the symmetric risk lives under
// src/lib/mcp, so the guard scans both.
const SCAN_ROOTS = [
  resolve(import.meta.dirname, "../../src/app/api"),
  resolve(import.meta.dirname, "../../src/lib/mcp"),
];

// `@/lib/prisma` exports the unscoped client BOTH as default AND as the named
// `prisma` (prisma.ts: `export { prisma }; export default prisma;`). It can
// therefore be smuggled into a route THREE ways — all three are a leak and all
// three are matched here (the named/dynamic forms are exactly what a regex over
// only the default import once missed, in api/email/track/*):
const UNSCOPED_PRISMA_PATTERNS: Array<{ re: RegExp; label: string }> = [
  // 1. default:  import prisma from "@/lib/prisma"  /  import prisma, { x } from …
  { re: /import\s+prisma(\s*,\s*\{[^}]*\})?\s+from\s+["']@\/lib\/prisma["']/, label: "default import" },
  // 2. named:    import { …, prisma, … } from "@/lib/prisma"  (\bprisma\b is
  //    lowercase-only, so it never matches getPrisma/getPlatformPrisma).
  { re: /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s+["']@\/lib\/prisma["']/, label: "named { prisma } import" },
  // 3. dynamic:  const { prisma } = await import("@/lib/prisma")
  {
    re: /\{[^}]*\bprisma\b[^}]*\}\s*=\s*await\s+import\(\s*["']@\/lib\/prisma["']\s*\)/,
    label: "dynamic import destructuring prisma",
  },
];

function usesUnscopedPrisma(src: string): boolean {
  return UNSCOPED_PRISMA_PATTERNS.some((p) => p.re.test(src));
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("API routes + MCP tools never use the unscoped prisma client (B8 IDOR guard)", () => {
  const files = SCAN_ROOTS.flatMap(walkTsFiles);

  it("finds files to scan (guard against a broken glob)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no src/app/api/** or src/lib/mcp/** file imports the unscoped `prisma` (default, named, or dynamic)", () => {
    const offenders = files
      .filter((f) => usesUnscopedPrisma(readFileSync(f, "utf-8")))
      .map((f) => f.slice(f.indexOf("src/")));

    expect(
      offenders,
      `These files still import the UNSCOPED prisma client (cross-tenant IDOR risk). ` +
        `Switch to getPrisma() (request-context, header-scoped), getPlatformPrisma() (global), ` +
        `or runWithTenant(row.tenantId, …) (inbound webhooks/tokens):\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
