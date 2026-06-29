/**
 * Internal request-header names middleware stamps after resolving the tenant —
 * isolated in a DEPENDENCY-FREE module so both sides can import them safely:
 *   - the server trust boundary `tenant-context.ts` (which pulls in
 *     `node:async_hooks` for the ALS), and
 *   - the isomorphic link helper `tenant-base.ts` (bundled into the client
 *     `TenantBaseProvider`).
 * If `tenant-base` imported these from `tenant-context` instead, the client
 * bundle would drag in `node:async_hooks` and the build would fail.
 */

/** Trusted tenant slug. Forgeable → middleware strips inbound + re-stamps. */
export const TENANT_HEADER = "x-tenant-id";

/** Per-request link base ("" host-based, "/<slug>" path-prefix). Forgeable → stripped + re-stamped. */
export const TENANT_BASE_HEADER = "x-tenant-base";
