import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Node-based isolation suite: exercises the REAL generated Prisma client + the
// REAL tenantScope chokepoint against an ephemeral better-sqlite3 DB built from
// the actual schema. The chokepoint is adapter-agnostic, so testing it in Node
// validates the same code path the Workers/D1 client runs.
export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/iso/global-setup.ts"],
    include: ["test/**/*.test.ts"],
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
});
