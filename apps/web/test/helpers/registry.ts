import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { createRegistrySchema } from "@/shared/db/registrySchema";
import { registryStore } from "@/shared/db/registryStore";
import type { RegistryStore } from "@/shared/db/registryStore";

export function openMemoryRegistry(): RegistryStore {
  const sqlite = new Database(":memory:");
  const dir = resolve(import.meta.dirname, "../../drizzle/registry");
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(join(dir, file), "utf-8"));
  }
  return registryStore(drizzle(sqlite, { schema: createRegistrySchema() }) as never);
}
