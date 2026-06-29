/**
 * Cloudflare bindings accessor.
 *
 * Most code paths in this app run inside Next.js request handlers, where
 * `getCloudflareContext()` from `@opennextjs/cloudflare` works out of the
 * box — OpenNext's worker entry wraps every fetch in an AsyncLocalStorage
 * scope that exposes `env`, `ctx` and `cf`.
 *
 * Workflows (e.g. `SlideExportWorkflow`) don't go through that fetch path —
 * Cloudflare's Workflows runtime calls our `run(event, step)` method directly.
 * `getCloudflareContext()` therefore throws inside a workflow because the ALS
 * scope was never entered.
 *
 * This module bridges the gap with a second ALS that the workflow enters at
 * the top of `run()`. {@link getEnv} / {@link getEnvAsync} prefer the workflow
 * scope when present and fall back to OpenNext's context for normal request
 * handlers, so existing service code can call them unconditionally.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const workflowEnvALS = new AsyncLocalStorage<CloudflareEnv>();

/**
 * Run `fn` with `env` exposed to {@link getEnv} / {@link getEnvAsync}. Use
 * from a workflow's `run()` (or any other non-request entry point) to make
 * service modules that read bindings via {@link getEnv} just work.
 */
export function runWithEnv<T>(env: CloudflareEnv, fn: () => Promise<T>): Promise<T> {
  return workflowEnvALS.run(env, fn);
}

export function getEnv(): CloudflareEnv {
  const wfEnv = workflowEnvALS.getStore();
  if (wfEnv) return wfEnv;
  return getCloudflareContext().env;
}

export async function getEnvAsync(): Promise<CloudflareEnv> {
  const wfEnv = workflowEnvALS.getStore();
  if (wfEnv) return wfEnv;
  return (await getCloudflareContext({ async: true })).env;
}
