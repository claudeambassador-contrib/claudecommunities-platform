import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.CLERK_SECRET_KEY) {
    process.env.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
  }
  if (env.VITE_CLERK_PUBLISHABLE_KEY) {
    process.env.VITE_CLERK_PUBLISHABLE_KEY = env.VITE_CLERK_PUBLISHABLE_KEY;
  }

  return {
    plugins: [
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
    server: {
      port: 3001,
      watch: {
        ignored: ["**/e2e/**/artifacts/**", "**/test-results/**", "**/playwright-report/**"],
      },
    },
  };
});
