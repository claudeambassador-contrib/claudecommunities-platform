import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

// ── Config ─────────────────────────────────────────────────────────────────

const schemaPath = resolve("prisma/schema.prisma");
const migrationsDir = resolve("migrations");
const snapshotPath = join(migrationsDir, ".last-schema.prisma");
const args = process.argv.slice(2);
const migrationName = args.find((a) => !a.startsWith("--")) || "migration";
const applyTarget = args.find((a) => a === "--local" || a === "--remote");
const isInit = migrationName === "init";

// ── Helpers ────────────────────────────────────────────────────────────────

function toSQLiteSchema(schema) {
  return schema.replace('provider = "postgresql"', 'provider = "sqlite"').replace(/@db\.Text/g, "");
}

function nextMigrationNumber() {
  if (!existsSync(migrationsDir)) return "0001";
  const existing = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => parseInt(f.split("_")[0], 10))
    .filter((n) => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return String(max + 1).padStart(4, "0");
}

function ensureMigrationsDir() {
  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true });
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

const original = readFileSync(schemaPath, "utf-8");
const sqliteSchema = toSQLiteSchema(original);

// Swap schema in-place so prisma.config.ts resolves correctly
writeFileSync(schemaPath, sqliteSchema);

try {
  ensureMigrationsDir();

  let fromFlag;
  let filename;

  if (isInit) {
    // Init: diff from empty → current schema, always writes 0001_init.sql
    fromFlag = "--from-empty";
    filename = "0001_init.sql";
  } else {
    // Incremental: diff from last snapshot → current schema
    if (!existsSync(snapshotPath)) {
      console.error('[d1-migrate] No schema snapshot found. Run "bun run d1:generate:init" first.');
      process.exit(1);
    }
    fromFlag = `--from-schema ${snapshotPath}`;
    const num = nextMigrationNumber();
    filename = `${num}_${migrationName.replace(/\s+/g, "_")}.sql`;
  }

  const outPath = join(migrationsDir, filename);

  console.log(`[d1-migrate] Generating migration: ${filename}`);
  console.log(`[d1-migrate] Diff source: ${isInit ? "empty database" : "last schema snapshot"}`);

  // Override DATABASE_URL so prisma.config.ts provides a SQLite-compatible URL
  const sql = execSync(
    `bunx prisma migrate diff ${fromFlag} --to-schema prisma/schema.prisma --script`,
    {
      encoding: "utf-8",
      env: { ...process.env, DATABASE_URL: "file:./d1.db" },
    },
  );

  if (!sql.trim() || sql.trim() === "-- This is an empty migration.") {
    console.log("[d1-migrate] No schema changes detected — skipping migration file creation");
  } else {
    writeFileSync(outPath, sql);
    console.log(`[d1-migrate] Written: ${outPath}`);

    const lines = sql.split("\n");
    const preview = lines.slice(0, 20).join("\n");
    console.log(`[d1-migrate] SQL preview (first 20 lines):\n${preview}`);
    if (lines.length > 20) {
      console.log(`  ... (${lines.length - 20} more lines)`);
    }
  }

  // Save current schema as snapshot for future incremental diffs
  writeFileSync(snapshotPath, sqliteSchema);
  console.log("[d1-migrate] Saved schema snapshot for future incremental diffs");

  // Optionally apply
  if (applyTarget) {
    console.log(`\n[d1-migrate] Applying migrations ${applyTarget}...`);
    execSync(`bunx wrangler d1 migrations apply DB ${applyTarget}`, {
      stdio: "inherit",
    });
    console.log("[d1-migrate] Migrations applied successfully");
  } else {
    console.log("\n[d1-migrate] To apply locally:    bun run local:d1:migrate");
    console.log("[d1-migrate] To apply to staging: bun run staging:d1:migrate");
    console.log("[d1-migrate] To apply to prod:    bun run production:d1:migrate");
  }
} finally {
  // Always restore original PostgreSQL schema
  writeFileSync(schemaPath, original);
  console.log("[d1-migrate] Restored original schema.prisma");
}
