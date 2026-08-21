#!/usr/bin/env node
/**
 * Apply tenant migrations to local D1 bindings TENANT_SYDNEY + TENANT_MELBOURNE.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const APP = resolve(import.meta.dirname, "..");
const bindings = process.argv.slice(2);
const targets = bindings.length > 0 ? bindings : ["TENANT_SYDNEY", "TENANT_MELBOURNE"];

for (const binding of targets) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(binding)) {
    console.error(`Invalid binding: ${binding}`);
    process.exit(1);
  }
  console.log(`Applying tenant migrations to ${binding}...`);
  execFileSync(
    "bunx",
    ["wrangler", "d1", "migrations", "apply", binding, "--local", "--config", "wrangler.jsonc"],
    { cwd: APP, stdio: "inherit" },
  );
}
