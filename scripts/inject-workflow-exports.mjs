#!/usr/bin/env node
/**
 * Post-build hook for `opennextjs-cloudflare build`.
 *
 * OpenNext owns `.open-next/worker.js` and regenerates it every build, so
 * we can't edit it once and check it in. That file is also the bundle
 * entry Cloudflare reads for:
 *  - the `[[workflows]]` `class_name` lookups (the workflow classes MUST
 *    be exported from the deployed Worker script, but OpenNext only
 *    exports its own internal Durable Objects)
 *  - the `scheduled` handler invoked by `triggers.crons` (OpenNext only
 *    sets up a `fetch` handler)
 *
 * This script patches the generated worker.js after the OpenNext build
 * finishes and before wrangler picks it up for deploy:
 *  1. Appends `export { ClassName } from "..."` lines so wrangler's
 *     esbuild bundles each workflow source into the final Worker.
 *  2. Adds an `import { handleScheduled } from "../src/worker-scheduled"`
 *     and injects an `async scheduled(...)` method into the default
 *     export object so Cloudflare cron triggers reach our code.
 *
 * Idempotent: re-running on an already-patched file skips entries that
 * are already present (cheap "did I add this?" check).
 *
 * Add a new workflow by:
 *  1. Creating src/workflows/<name>.ts with a `WorkflowEntrypoint` subclass.
 *  2. Adding the binding to wrangler.jsonc (default + per-env blocks).
 *  3. Appending an entry to WORKFLOWS below.
 */
import fs from "node:fs";
import path from "node:path";

const WORKER_PATH = path.resolve(".open-next/worker.js");

// Paths are relative to .open-next/worker.js → ../src/... from the project
// root. Wrangler's esbuild resolves .ts and follows the rest of the import
// graph from there.
const WORKFLOWS = [
  { name: "SlideExportWorkflow", source: "../src/workflows/slide-export" },
  { name: "PublishPostWorkflow", source: "../src/workflows/publish-post" },
  { name: "CampaignSendWorkflow", source: "../src/workflows/campaign-send" },
];

const SCHEDULED_IMPORT_SOURCE = "../src/worker-scheduled";
const SCHEDULED_IMPORT_LINE = `import { handleScheduled } from "${SCHEDULED_IMPORT_SOURCE}";`;
// Injected as the last method inside the `export default { ... }` object.
// OpenNext indents the existing fetch method with 4 spaces; match it so
// the patched file stays readable when debugging the deployed bundle.
const SCHEDULED_METHOD = `    async scheduled(controller, env, ctx) {
        return handleScheduled(controller, env, ctx);
    },
`;

if (!fs.existsSync(WORKER_PATH)) {
  console.error(`[inject-worker] missing worker bundle at ${WORKER_PATH}`);
  console.error("[inject-worker] run `opennextjs-cloudflare build` first");
  process.exit(1);
}

let patched = fs.readFileSync(WORKER_PATH, "utf-8");
const appended = [];
const skipped = [];

// ── Workflow re-exports ──────────────────────────────────────────────────
for (const wf of WORKFLOWS) {
  if (patched.includes(wf.name)) {
    skipped.push(wf.name);
    continue;
  }
  patched += `
// Injected by scripts/inject-workflow-exports.mjs after \`opennextjs-cloudflare build\`.
// Wrangler bundles this source into the worker so the [[workflows]] binding
// in wrangler.jsonc can find the class.
export { ${wf.name} } from "${wf.source}";
`;
  appended.push(wf.name);
}

// ── Scheduled handler ────────────────────────────────────────────────────
if (patched.includes("handleScheduled")) {
  skipped.push("scheduled handler");
} else {
  // Inject the method as the last entry of the default-export object. The
  // OpenNext-generated file ends that object with a `\n};` at column 0; the
  // method is added right before it. The import sits directly above the
  // default export so it doesn't get sandwiched between an existing
  // `@ts-expect-error` directive and the import it was annotating.
  const defaultStart = patched.indexOf("export default {");
  if (defaultStart === -1) {
    console.error("[inject-worker] could not locate `export default {` to inject scheduled handler");
    process.exit(1);
  }
  patched =
    patched.slice(0, defaultStart) +
    SCHEDULED_IMPORT_LINE +
    "\n" +
    patched.slice(defaultStart);
  // Search forward for the closing `\n};` of the default export object.
  // Inside the object methods only ever close with `});` or `},` followed
  // by deeper indentation, so the first `\n};` is the object close.
  const closeIdx = patched.indexOf("\n};", defaultStart);
  if (closeIdx === -1) {
    console.error("[inject-worker] could not locate closing `};` of default export");
    process.exit(1);
  }
  // closeIdx points to the newline; insert after the newline so the method
  // sits indented inside the object, before the closing brace.
  patched = patched.slice(0, closeIdx + 1) + SCHEDULED_METHOD + patched.slice(closeIdx + 1);
  appended.push("scheduled handler");
}

if (appended.length === 0) {
  console.log("[inject-worker] worker.js already patched, skipping");
  process.exit(0);
}

fs.writeFileSync(WORKER_PATH, patched);
for (const name of appended) {
  console.log(`[inject-worker] appended ${name}`);
}
if (skipped.length > 0) {
  console.log(`[inject-worker] already present: ${skipped.join(", ")}`);
}
