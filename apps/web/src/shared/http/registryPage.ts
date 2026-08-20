import { syncSessionUser } from "@/modules/identity/services/sessionService";
import { getRegistryDb, getRegistryStore } from "@/shared/db/env";
import type { RegistryStore } from "@/shared/db/registryStore";
import type { AuthContext } from "@/shared/http/routeContext";

export interface RegistryPageContext {
  auth: AuthContext | null;
  registry: RegistryStore;
}

/**
 * Registry-plane entry point for routes that don't belong to a city
 * (`/`, `/pricing`, `/sitemap`, `/admin`, …). Session sync is best-effort
 * here — unauthenticated or banned both resolve to `auth: null` so public
 * pages still render; a page that needs an admin gate re-checks
 * `auth?.isSuperAdmin` / permissions itself after calling this.
 */
export async function loadRegistryPage(): Promise<RegistryPageContext> {
  const registry = getRegistryStore();
  const session = await syncSessionUser(getRegistryDb());
  return { auth: session.ok ? session.auth : null, registry };
}
