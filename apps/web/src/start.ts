import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createMiddleware, createStart } from "@tanstack/react-start";
import { maintenanceMiddleware } from "./shared/middleware/maintenance";
import { tenantRequestMiddleware } from "./shared/middleware/tenant";

const csrfMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    clerkMiddleware(),
    maintenanceMiddleware,
    tenantRequestMiddleware,
  ],
}));
