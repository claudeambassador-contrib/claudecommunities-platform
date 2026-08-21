import { auth, clerkClient } from "@clerk/tanstack-react-start/server";

import { createSessionService } from "@/modules/identity/services/sessionCore";
import type { ClerkProfile, SessionService } from "@/modules/identity/services/sessionCore";
import { isClerkServerConfigured } from "@/shared/auth/clerk";
import type { RegistryDb } from "@/shared/db/client";
import { getRegistryDb, openTenantStore, workerEnv } from "@/shared/db/env";
import type { Result } from "@/shared/http/errors";
import type { AuthContext, RouteContext, TenantContext } from "@/shared/http/routeContext";
import { ttlMemo } from "@/shared/ttlMemo";

// oxlint-disable-next-line oxc/no-barrel-file -- these pure helpers moved to sessionCore; re-exported here so existing importers of sessionService keep compiling unchanged
export {
  actorFromAuth,
  hasAnyAdminPermission,
  requirePermission,
} from "@/modules/identity/services/sessionCore";

/** 60s isolate cache: Clerk fetch + registry upsert per user, city row per slug. */
const sessionMemo = ttlMemo<AuthContext>(60_000);
const cityMemo = ttlMemo<TenantContext>(60_000);

let service: SessionService | undefined;

function prodService(): SessionService {
  service ??= createSessionService({
    cityMemo,
    async getProfile(userId) {
      try {
        const client = await clerkClient();
        return (await client.users.getUser(userId)) as unknown as ClerkProfile;
      } catch {
        return null;
      }
    },
    async getSessionUserId() {
      try {
        const session = await auth();
        return session.isAuthenticated && session.userId ? session.userId : null;
      } catch {
        return null;
      }
    },
    isConfigured: () => isClerkServerConfigured(workerEnv()),
    openTenantStore,
    sessionMemo,
  });
  return service;
}

export function syncSessionUser(db: RegistryDb): Promise<Result<{ auth: AuthContext }>> {
  return prodService().syncSessionUser(db);
}

export function buildCityRouteContext(citySlug: string): Promise<Result<{ ctx: RouteContext }>> {
  return prodService().buildCityRouteContext(getRegistryDb(), citySlug);
}
