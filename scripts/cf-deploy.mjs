#!/usr/bin/env bun
/**
 * Cloudflare Workers-Build deploy command with retry.
 *
 * `opennextjs-cloudflare deploy` populates the remote R2 incremental cache as
 * part of the deploy, and that step intermittently fails on the CF build runner
 * with a transient control-plane flake ("Premature close" / "Invalid response
 * body" while checking whether the cache bucket exists). The deploy is
 * otherwise unchanged — re-running it almost always succeeds. This wrapper
 * retries the same command a few times so a single flake doesn't fail the build
 * (previously worked around by pushing empty "re-trigger" commits by hand).
 *
 * Used as the CF deploy command via the package.json scripts
 * `staging:deploy:cf` / `production:deploy:cf`. Unlike `scripts/deploy.mjs`
 * (the local driver), this does NOT load an env file or rebuild — CF injects
 * env vars from the dashboard and the build command has already produced the
 * `.open-next` output.
 *
 * Usage:
 *   node scripts/cf-deploy.mjs --env staging
 */
import { spawnSync } from "node:child_process";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const wranglerEnv = arg("env");
if (!wranglerEnv) {
  console.error("[cf-deploy] Missing required --env <staging|production|…>.");
  process.exit(1);
}

const ATTEMPTS = 3;
const DELAY_MS = 15_000;
const cmd = `bunx opennextjs-cloudflare deploy --env ${wranglerEnv}`;

function sleep(ms) {
  // Block synchronously so the loop stays simple and stdio inheritance works.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  console.log(`[cf-deploy] Attempt ${attempt}/${ATTEMPTS}: ${cmd}`);
  const res = spawnSync(cmd, { stdio: "inherit", shell: true, env: process.env });
  if (res.status === 0) process.exit(0);

  if (attempt < ATTEMPTS) {
    console.error(
      `[cf-deploy] Deploy failed (${res.status ?? "signal"}). Likely a transient R2 cache flake — retrying in ${DELAY_MS / 1000}s…`,
    );
    sleep(DELAY_MS);
  } else {
    console.error(`[cf-deploy] Deploy failed after ${ATTEMPTS} attempts. Giving up.`);
    process.exit(res.status ?? 1);
  }
}
