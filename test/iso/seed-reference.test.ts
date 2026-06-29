import { describe, expect, it } from "vitest";
import { buildReferenceSeedSql } from "../../scripts/seed-reference";

// Reference data (Spaces + LeaderboardLevels) is tenant-scoped post-0021. The
// legacy scripts/seed.sql broke two ways on a fresh DB: tenantId='' (invisible)
// and `ON CONFLICT (level)` (the UNIQUE(level) it targeted is gone). Lock the
// fix so neither regresses.
describe("buildReferenceSeedSql", () => {
  const sql = buildReferenceSeedSql("Platform");

  it("scopes every row to the (lowercased) tenant", () => {
    // The tenantId is the 2nd VALUES column on all 6 spaces + 9 levels: `, 'platform',`.
    expect(sql.match(/, 'platform',/g)?.length).toBe(15);
    expect(sql).not.toContain("'Platform'"); // lowercased
  });

  it("seeds all 6 default spaces and 9 levels", () => {
    expect(sql.match(/INSERT OR IGNORE INTO "Space"/g)?.length).toBe(6);
    expect(sql.match(/INSERT OR IGNORE INTO "LeaderboardLevel"/g)?.length).toBe(9);
  });

  it("never uses the broken pre-0021 ON CONFLICT (level) upsert", () => {
    expect(sql).not.toMatch(/ON CONFLICT/i);
  });

  it("includes tenantId in both insert column lists (composite-unique safe)", () => {
    expect(sql).toContain(`"Space" ("id","tenantId"`);
    expect(sql).toContain(`"LeaderboardLevel" ("id","tenantId"`);
  });
});
