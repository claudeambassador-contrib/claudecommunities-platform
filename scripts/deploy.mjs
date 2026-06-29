#!/usr/bin/env node
/**
 * Cross-platform deploy driver (replaces the Unix-only
 * `set -a && . ./.env.X && … && rm -rf … && opennextjs-cloudflare deploy`
 * one-liners that broke on Windows). Loads a region env file, cleans the
 * build output, builds the Worker bundle, optionally preloads the cache, then
 * deploys to the given wrangler env.
 *
 * Usage:
 *   node scripts/deploy.mjs --env-file .env.staging --region au \
 *     --wrangler-env staging --preload staging:preload-cache
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";

// ── Args ─────────────────────────────────────────────────────────────────────

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const envFile = arg("env-file");
const region = arg("region");
const wranglerEnv = arg("wrangler-env");
const preload = arg("preload"); // optional package.json script name

if (!envFile || !region || !wranglerEnv) {
  console.error(
    "[deploy] Missing required args. Need --env-file, --region and --wrangler-env.",
  );
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a `KEY=value` env file into process.env (file values win, like `.` sourcing). */
function loadEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`[deploy] Env file not found: ${path}`);
    process.exit(1);
  }
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const stripped = line.startsWith("export ") ? line.slice(7) : line;
    const eq = stripped.indexOf("=");
    if (eq === -1) continue;
    const key = stripped.slice(0, eq).trim();
    let value = stripped.slice(eq + 1).trim();
    // Strip a single layer of matching surrounding quotes.
    if (value.length >= 2 && /^(".*"|'.*')$/.test(value)) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** Run a command, inheriting stdio and the (mutated) process env. Exits on failure. */
function run(cmd) {
  console.log(`[deploy] $ ${cmd}`);
  // shell:true so a plain command string runs under cmd.exe or /bin/sh alike.
  const res = spawnSync(cmd, { stdio: "inherit", shell: true, env: process.env });
  if (res.status !== 0) {
    console.error(`[deploy] Command failed (${res.status ?? "signal"}): ${cmd}`);
    process.exit(res.status ?? 1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

loadEnvFile(envFile);
process.env.NEXT_PUBLIC_REGION = region;
process.env.DEPLOY_TARGET = "cloudflare";

console.log(`▸ build region: ${region}`);

// Clean previous build output (cross-platform `rm -rf .open-next .next`).
for (const dir of [".open-next", ".next"]) {
  rmSync(dir, { recursive: true, force: true });
}

run("bun run build:cf");
if (preload) run(`bun run ${preload}`);
run(`bunx opennextjs-cloudflare deploy --env ${wranglerEnv}`);

console.log(`[deploy] Done → ${wranglerEnv}`);
