import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
const MODULES = [
  "activity",
  "attendance",
  "badges",
  "cities",
  "community",
  "connections",
  "courses",
  "email",
  "events",
  "identity",
  "impact-lab",
  "notifications",
  "pages",
  "polls",
  "roles",
  "slides",
  "social",
  "system",
  "talks",
  "tenants",
  "tiers",
] as const;

const REPO_IMPORT_MESSAGE =
  "Cross-module repository import. Go through that module's service layer instead.";

const otherRepoPatterns = (own?: string) =>
  MODULES.filter((mod) => mod !== own).map((mod) => ({
    group: [`@/modules/${mod}/repositories/**`],
    message: REPO_IMPORT_MESSAGE,
  }));

const reactRules = Object.fromEntries(
  Object.entries(react.rules ?? {}).filter(([name]) => name !== "react/react-compiler"),
);

export default defineConfig({
  extends: [{ ...react, rules: reactRules }, core, tanstack],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "**/routeTree.gen.ts",
    "**/worker-configuration.d.ts",
    "**/drizzle/**/*.sql",
  ],
  jsPlugins: ["eslint-plugin-crap"],
  overrides: [
    {
      files: [
        "src/modules/**/repositories/**",
        "src/shared/db/**",
        "src/workflows/**",
        "src/worker-scheduled.ts",
        "src/server.ts",
        "test/**",
      ],
      rules: {
        "no-restricted-imports": "off",
      },
    },
    ...MODULES.map((mod) => ({
      files: [`src/modules/${mod}/**`],
      rules: {
        "no-restricted-imports": ["error", { patterns: otherRepoPatterns(mod) }],
      },
    })),
  ],
  rules: {
    "crap/crap": ["error", { lcovPath: "coverage/lcov.info", maxCrap: 8 }],
    // Style nits ultracite enables that Biome never enforced — keep the gate
    // focused on the previous contract plus module boundaries and CRAP.
    "class-methods-use-this": "off",
    "func-style": "off",
    "id-match": "off",
    "import/consistent-type-specifier-style": "off",
    "import/first": "off",
    "max-classes-per-file": "off",
    "no-inline-comments": "off",
    "no-restricted-imports": ["error", { patterns: otherRepoPatterns() }],
    "no-use-before-define": ["error", { functions: false }],
    "no-warning-comments": "off",
    "prefer-named-capture-group": "off",
    "react/function-component-definition": "off",
    "react/refs": "off",
    "require-unicode-regexp": "off",
    "sort-keys": "off",
    "sort-vars": "off",
    "unicorn/filename-case": "off",
    "unicorn/import-style": "off",
    "unicorn/no-array-sort": "off",
    "unicorn/no-object-as-default-parameter": "off",
    complexity: "off",
    "import/newline-after-import": "off",
    "no-empty-function": "off",
    "no-script-url": "off",
    "node/callback-return": "off",
    "promise/prefer-await-to-then": "off",
    "react/jsx-no-useless-fragment": "off",
    "react/no-object-type-as-default-prop": "off",
    "react/no-unescaped-entities": "off",
    "require-await": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/custom-error-definition": "off",
    "unicorn/no-array-for-each": "off",
    "unicorn/no-await-expression-member": "off",
    "unicorn/prefer-dom-node-append": "off",
    "unicorn/prefer-add-event-listener": "off",
    "unicorn/prefer-response-static-json": "off",
    "unicorn/prefer-ternary": "off",
  },
});
