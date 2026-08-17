import { createMiddleware } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

/**
 * Maintenance kill-switch — mirrors the Next middleware behaviour.
 * Toggle via Worker secret MAINTENANCE_MODE; bypass with ?bypass=<token>.
 */
export const maintenanceMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    const mode = String((env as { MAINTENANCE_MODE?: string }).MAINTENANCE_MODE ?? "false");
    if (mode !== "true" && mode !== "1") {
      return next();
    }

    const url = new URL(request.url);
    const token = url.searchParams.get("bypass");
    const expected = (env as { MAINTENANCE_BYPASS_TOKEN?: string }).MAINTENANCE_BYPASS_TOKEN;
    if (expected && token && token === expected) {
      return next();
    }

    // Allow health checks through while in maintenance.
    if (url.pathname === "/api/health") {
      return next();
    }

    return new Response(
      `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
        <h1>We'll be right back</h1>
        <p>Claude Communities is undergoing maintenance.</p>
      </body></html>`,
      {
        status: 503,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "retry-after": "300",
        },
      },
    );
  },
);
