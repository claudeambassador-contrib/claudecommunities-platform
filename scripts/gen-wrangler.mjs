#!/usr/bin/env node
/**
 * Generate `wrangler.jsonc` from `wrangler.template.jsonc`.
 *
 * Wrangler config files do NOT support env-var interpolation, yet every
 * deployment needs its own identity values baked into the file (account id,
 * worker name, D1 database ids, R2 bucket names, routes, public URLs). So we
 * commit a template full of `${TOKEN}` placeholders and substitute them here,
 * at deploy time, from the environment.
 *
 * Where the values come from:
 *   - Cloudflare Workers Builds: dashboard "Variables & Secrets" (process.env).
 *   - Local / manual deploys: a gitignored `.env.cfinfra` passed via
 *     `--env-file` (see `.env.cfinfra.example` for the full key list).
 *
 * The generated `wrangler.jsonc` is gitignored — it is a build artifact, never
 * committed. `main` carries only the template, so no account/resource specifics
 * live in the public repo.
 *
 * This is a PURE TEXT substitution (no JSON parse) so the template's comments,
 * tabs and formatting survive byte-for-byte. Substituting the current committed
 * values reproduces the previous `wrangler.jsonc` exactly.
 *
 * Resolution order for token values:
 *   1. --infra-file <path>  (explicit; the file must exist)
 *   2. ./.env.cfinfra       (auto-loaded when present — local/manual deploys)
 *   3. process.env          (Cloudflare Workers Builds dashboard vars)
 * Any token still unset after that is reported and the run fails (exit 1).
 *
 * NB: the flag is `--infra-file`, NOT `--env-file` — Node 20.6+ treats
 * `--env-file` as its own startup flag and aborts cryptically on a missing file.
 *
 * Usage:
 *   node scripts/gen-wrangler.mjs                       # .env.cfinfra or process.env
 *   node scripts/gen-wrangler.mjs --infra-file .env.cfinfra
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Resolve template/output relative to this script's location (repo root =
// the parent of scripts/), so it works regardless of the caller's cwd.
const TEMPLATE_PATH = fileURLToPath(new URL("../wrangler.template.jsonc", import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

/** Parse a `KEY=value` env file into process.env (file values win). */
function loadEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`[gen-wrangler] Env file not found: ${path}`);
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

// Default infra file (repo root), auto-loaded for local/manual runs. On
// Cloudflare Workers Builds it is absent and values come from process.env.
const DEFAULT_INFRA_PATH = fileURLToPath(new URL("../.env.cfinfra", import.meta.url));

const infraFile = arg("infra-file");
if (infraFile) {
  loadEnvFile(infraFile); // explicit path — must exist (loadEnvFile exits if not)
} else if (existsSync(DEFAULT_INFRA_PATH)) {
  loadEnvFile(DEFAULT_INFRA_PATH); // local convenience
}
// else: rely on process.env (dashboard vars); the missing-token check below
// fails loudly if neither source provided a value.

const template = readFileSync(TEMPLATE_PATH, "utf8");

// Collect every distinct token referenced by the template so we can report ALL
// missing ones at once (a one-at-a-time failure makes dashboard setup tedious).
const referenced = [...new Set([...template.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]))];
const missing = referenced.filter((k) => process.env[k] == null || process.env[k] === "");
if (missing.length > 0) {
  console.error(
    `[gen-wrangler] Missing required value(s) for ${missing.length} token(s):\n` +
      missing.map((k) => `  - ${k}`).join("\n") +
      `\n\nSet these as Workers Builds variables (per connected environment) or in` +
      ` your --env-file. See .env.cfinfra.example for the full list.`,
  );
  process.exit(1);
}

const out = template.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key]);
writeFileSync(OUTPUT_PATH, out);
console.log(`[gen-wrangler] wrote wrangler.jsonc (${referenced.length} tokens substituted)`);
