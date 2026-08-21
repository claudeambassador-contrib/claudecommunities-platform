import { existsSync, readFileSync } from "node:fs";

import { defineConfig } from "@playwright/test";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    if (process.env[key]) {
      continue;
    }
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = JSON.parse(value) as string;
    }
    process.env[key] = value;
  }
}

loadEnvFile(new URL(".env.e2e", import.meta.url).pathname);
loadEnvFile(new URL(".env.local", import.meta.url).pathname);
process.env.CLERK_PUBLISHABLE_KEY ||= process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 180_000,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3001",
    ignoreHTTPSErrors: true,
    video: "on",
    viewport: { height: 720, width: 1280 },
  },
});
