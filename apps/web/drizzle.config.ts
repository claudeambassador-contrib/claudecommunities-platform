import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shared/db/registrySchema.ts",
  out: "./drizzle/registry",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.REGISTRY_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
});
