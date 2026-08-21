import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createMiddleware, createStart } from "@tanstack/react-start";

import { clerkKeysFromRecord, isClerkServerConfigured } from "./shared/auth/clerk";
import { maintenanceMiddleware } from "./shared/middleware/maintenance";
import { tenantRequestMiddleware } from "./shared/middleware/tenant";

const csrfMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => next());
const skipClerkMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) =>
  next(),
);

/** Clerk's built-in middleware enters keyless handshake mode when keys are
 *  missing, then 500s public pages. Only mount it when both keys exist.
 *  Do not import `cloudflare:workers` here — Vite's client graph cannot resolve it. */
function clerkRequestMiddleware() {
  if (!isClerkServerConfigured()) {
    return skipClerkMiddleware;
  }
  const keys = clerkKeysFromRecord();
  return clerkMiddleware({
    publishableKey: keys.publishable,
    secretKey: keys.secret,
  });
}

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    clerkRequestMiddleware(),
    maintenanceMiddleware,
    tenantRequestMiddleware,
  ],
}));
