#!/usr/bin/env node
/**
 * Generate apps/web/wrangler.jsonc from wrangler.template.jsonc.
 * Substitutes ${TOKEN} placeholders from process.env / .env.cfinfra.
 * For local defaults (no tokens), copies the template as-is when no ${} remain
 * after optional substitution (local database_ids are literals).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(ROOT, "..");
const templatePath = resolve(APP_ROOT, "wrangler.template.jsonc");
const outPath = resolve(APP_ROOT, "wrangler.jsonc");

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const i = t.indexOf("=");
    if (i === -1) {
      continue;
    }
    out[t.slice(0, i).trim()] = t
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...loadEnvFile(resolve(APP_ROOT, "../../.env.cfinfra")),
  ...loadEnvFile(resolve(APP_ROOT, ".env.local")),
  ...process.env,
};

let text = readFileSync(templatePath, "utf8");
const missing = [];
text = text.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => {
  const v = env[key];
  if (v === null || v === undefined || v === "") {
    missing.push(key);
    return `\${${key}}`;
  }
  return v;
});

if (missing.length > 0 && process.argv.includes("--strict")) {
  console.error(`Missing tokens: ${missing.join(", ")}`);
  process.exit(1);
}

writeFileSync(outPath, text);
console.log(`Wrote ${outPath}${missing.length ? ` (unresolved: ${missing.join(", ")})` : ""}`);
