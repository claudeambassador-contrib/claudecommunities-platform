import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REGION } from "@/lib/region";
import { deleteTenant, tenantPurgeStatements } from "@/lib/services/tenants";
import { GLOBAL_MODELS, TENANT_SCOPED_MODELS } from "@/lib/tenant-models";

// `deleteTenant` runs raw `env.DB.batch()` (D1), unavailable in this harness, so
// we lock the two things that actually matter:
//   1. The purge statement list (pure) is COMPLETE and correctly shaped.
//   2. Executed against a real FK-enforcing SQLite DB it isolates correctly, and
//      the `defer_foreign_keys` PRAGMA is load-bearing — a RESTRICT FK
//      (Subscription.tierId → MembershipTier) trips without it.
// (2) mirrors how D1 runs the batch: one transaction, defer as the first stmt.

describe("tenantPurgeStatements (pure shape)", () => {
  const stmts = tenantPurgeStatements("acme");

  it("leads with the defer-FK PRAGMA so delete order is irrelevant", () => {
    expect(stmts[0]).toEqual({ sql: "PRAGMA defer_foreign_keys=ON" });
  });

  it("deletes every tenant-scoped table, filtered by the slug", () => {
    const deletedTables = new Set(
      stmts
        .map((s) => /DELETE FROM "(\w+)" WHERE "tenantId"/.exec(s.sql)?.[1])
        .filter((t): t is string => Boolean(t)),
    );
    for (const model of TENANT_SCOPED_MODELS) {
      expect(deletedTables.has(model)).toBe(true);
    }
    // every data statement is parameterized with the slug (no string interpolation)
    for (const s of stmts.filter((x) => x.sql.startsWith("DELETE"))) {
      expect(s.params).toEqual(["acme"]);
    }
  });

  it("never touches a GLOBAL table (User, suppression list, Impact Lab)", () => {
    const joined = stmts.map((s) => s.sql).join("\n");
    for (const model of GLOBAL_MODELS) {
      if (model === "Tenant" || model === "TenantSetting") continue; // registry, deleted by slug below
      expect(joined).not.toContain(`"${model}"`);
    }
  });

  it("ends by removing the settings then the registry row", () => {
    const last = stmts.slice(-2);
    expect(last[0]).toEqual({
      sql: 'DELETE FROM "TenantSetting" WHERE "tenantId" = ?',
      params: ["acme"],
    });
    expect(last[1]).toEqual({ sql: 'DELETE FROM "Tenant" WHERE "slug" = ?', params: ["acme"] });
  });
});

describe("deleteTenant guard", () => {
  it("refuses to delete this deployment's home-region community", async () => {
    await expect(deleteTenant(REGION)).rejects.toThrow(/home-region/);
  });
});

describe("purge against a real FK-enforcing SQLite DB", () => {
  let db: Database.Database;
  let file: string;
  let nextId = 0;

  /** Apply the purge as D1 does: one transaction, PRAGMA defer first. */
  function purgeInTransaction(slug: string) {
    const stmts = tenantPurgeStatements(slug);
    db.transaction(() => {
      for (const s of stmts) {
        if (s.params) db.prepare(s.sql).run(...(s.params as unknown[]));
        else db.exec(s.sql); // the PRAGMA
      }
    })();
  }

  function seedTenantWithRestrictChain(slug: string, userId: string) {
    const t = 1_700_000_000_000;
    db.prepare(
      'INSERT INTO "Tenant" ("id","slug","name","updatedAt") VALUES (?,?,?,?)',
    ).run(`ten-${slug}`, slug, slug.toUpperCase(), t);
    db.prepare(
      'INSERT INTO "TenantSetting" ("id","tenantId","updatedAt") VALUES (?,?,?)',
    ).run(`ts-${slug}`, slug, t);
    db.prepare(
      'INSERT INTO "MembershipTier" ("id","name","slug","updatedAt","tenantId") VALUES (?,?,?,?,?)',
    ).run(`mt-${slug}`, "Pro", "pro", t, slug);
    // Subscription.tierId → MembershipTier is ON DELETE RESTRICT: the tier must be
    // deleted in the SAME deferred transaction as the subscription or it throws.
    db.prepare(
      'INSERT INTO "Subscription" ("id","currentPeriodStart","currentPeriodEnd","updatedAt","userId","tierId","tenantId") VALUES (?,?,?,?,?,?,?)',
    ).run(`su-${slug}`, t, t, t, userId, `mt-${slug}`, slug);
  }

  function count(table: string, col: string, val: string): number {
    return (
      db.prepare(`SELECT COUNT(*) n FROM "${table}" WHERE "${col}" = ?`).get(val) as { n: number }
    ).n;
  }

  beforeEach(() => {
    const ddl = readFileSync(resolve(import.meta.dirname, ".schema.sql"), "utf-8");
    file = `/tmp/iso-deltenant-${process.pid}-${nextId++}.db`;
    db = new Database(file);
    db.exec(ddl);
    db.pragma("foreign_keys = ON");
    // A shared GLOBAL user that both tenants reference — must survive deletion.
    db.prepare('INSERT INTO "User" ("id","clerkId","updatedAt") VALUES (?,?,?)').run(
      "u-shared",
      "clerk_shared",
      1_700_000_000_000,
    );
    seedTenantWithRestrictChain("t-del", "u-shared");
    seedTenantWithRestrictChain("t-keep", "u-shared");
  });

  afterEach(() => {
    db.close();
    try {
      rmSync(file, { force: true });
    } catch {
      /* ignore */
    }
  });

  it("purges the target tenant entirely, leaving other tenants and global users intact", () => {
    purgeInTransaction("t-del");

    // target gone across registry + scoped tables
    expect(count("Tenant", "slug", "t-del")).toBe(0);
    expect(count("TenantSetting", "tenantId", "t-del")).toBe(0);
    expect(count("MembershipTier", "tenantId", "t-del")).toBe(0);
    expect(count("Subscription", "tenantId", "t-del")).toBe(0);

    // other tenant untouched
    expect(count("Tenant", "slug", "t-keep")).toBe(1);
    expect(count("MembershipTier", "tenantId", "t-keep")).toBe(1);
    expect(count("Subscription", "tenantId", "t-keep")).toBe(1);

    // global identity preserved
    expect(count("User", "id", "u-shared")).toBe(1);
  });

  it("would fail without defer: the RESTRICT FK trips on parent-first delete", () => {
    // Same parent-before-child order the purge uses, but no defer → RESTRICT bites.
    const noDefer = db.transaction(() => {
      db.prepare('DELETE FROM "MembershipTier" WHERE "tenantId" = ?').run("t-del");
      db.prepare('DELETE FROM "Subscription" WHERE "tenantId" = ?').run("t-del");
    });
    expect(() => noDefer()).toThrow(/FOREIGN KEY/i);
  });
});
