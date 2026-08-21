/**
 * Create (or reset) a Clerk test user and seed them as Sydney city owner.
 *
 * Usage: bun scripts/seed-e2e-admin.ts
 *
 * Writes E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD into apps/web/.env.e2e (gitignored).
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const APP = resolve(import.meta.dirname, "..");
const EMAIL = process.env.E2E_ADMIN_EMAIL?.trim() || "e2e.admin.sydney+clerk_test@example.com";
const CITY = process.env.E2E_CITY?.trim() || "sydney";

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const raw of readFileSync(path, "utf-8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const eq = line.indexOf("=");
    const key = line.slice(0, eq);
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = JSON.parse(value) as string;
    }
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

function upsertEnvFile(path: string, updates: Record<string, string>): void {
  const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
  const keys = new Set(Object.keys(updates));
  const lines = existing.split("\n");
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      return line;
    }
    const key = trimmed.slice(0, trimmed.indexOf("="));
    if (!keys.has(key)) {
      return line;
    }
    keys.delete(key);
    return `${key}=${updates[key]}`;
  });
  for (const key of keys) {
    next.push(`${key}=${updates[key]}`);
  }
  const text = `${next
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n")
    .trim()}\n`;
  writeFileSync(path, text);
}

async function clerkJson(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  return { body, ok: response.ok, status: response.status };
}

function clerkUserId(body: unknown): string | null {
  if (body && typeof body === "object" && "id" in body && typeof body.id === "string") {
    return body.id;
  }
  if (Array.isArray(body) && body[0] && typeof body[0] === "object" && "id" in body[0]) {
    const { id } = body[0] as { id: unknown };
    return typeof id === "string" ? id : null;
  }
  return null;
}

const local = loadEnvFile(resolve(APP, ".env.local"));
const secret = (process.env.CLERK_SECRET_KEY ?? local.CLERK_SECRET_KEY ?? "").trim();
if (!secret.startsWith("sk_test_")) {
  console.error("Need CLERK_SECRET_KEY (sk_test_) in apps/web/.env.local");
  process.exit(1);
}

const password =
  process.env.E2E_ADMIN_PASSWORD?.trim() || `E2e!${randomBytes(12).toString("base64url")}9`;

const created = await clerkJson(secret, "/users", {
  body: JSON.stringify({
    email_address: [EMAIL],
    first_name: "E2E",
    last_name: "Admin",
    password,
    skip_password_checks: true,
  }),
  method: "POST",
});

let userId = clerkUserId(created.body);
if (!created.ok) {
  const listed = await clerkJson(secret, `/users?email_address=${encodeURIComponent(EMAIL)}`);
  userId = clerkUserId(listed.body);
  if (!userId) {
    console.error(`Clerk create failed (${created.status}) and no existing user for that email.`);
    process.exit(1);
  }
  const reset = await clerkJson(secret, `/users/${userId}`, {
    body: JSON.stringify({ password, skip_password_checks: true }),
    method: "PATCH",
  });
  if (!reset.ok) {
    console.error(`Clerk password reset failed (${reset.status}).`);
    process.exit(1);
  }
}

upsertEnvFile(resolve(APP, ".env.e2e"), {
  BASE_URL: "http://localhost:3001",
  E2E_ADMIN_EMAIL: EMAIL,
  E2E_ADMIN_PASSWORD: password,
  E2E_EMAIL: EMAIL,
  E2E_PASSWORD: password,
  SEED_OWNER_EMAIL: EMAIL,
});

const seed = spawnSync("bun", ["scripts/seed-city.ts", CITY, "--email", EMAIL], {
  cwd: APP,
  encoding: "utf-8",
  stdio: "inherit",
});
if (seed.status !== 0) {
  process.exit(seed.status ?? 1);
}

console.log(`E2E admin ready: ${EMAIL} (clerk ${userId}) as ${CITY} owner`);
