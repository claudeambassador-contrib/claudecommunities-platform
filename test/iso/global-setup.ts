import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Materialize the full schema as SQLite DDL once, for the isolation suite to
// build ephemeral test databases from. Uses the project's own migrate-diff
// path (DATABASE_URL makes prisma.config.ts resolve a SQLite-compatible URL).
export default function setup() {
  const sql = execSync(
    "./node_modules/.bin/prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
    { encoding: "utf-8", env: { ...process.env, DATABASE_URL: "file:./d1.db" } },
  );
  if (!sql.includes('CREATE TABLE "Tenant"')) {
    throw new Error("global-setup: schema DDL looks empty/wrong — aborting isolation suite.");
  }
  writeFileSync(resolve(import.meta.dirname, ".schema.sql"), sql);
}
