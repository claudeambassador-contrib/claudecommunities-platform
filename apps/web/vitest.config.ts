import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "./src"),
  "@web": path.resolve(import.meta.dirname, "./src"),
};

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          environment: "node",
          include: ["test/**/*.test.ts"],
          name: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          environment: "happy-dom",
          include: ["test/**/*.test.tsx"],
          name: "dom",
          setupFiles: ["test/setup.dom.ts"],
        },
      },
    ],
  },
});
