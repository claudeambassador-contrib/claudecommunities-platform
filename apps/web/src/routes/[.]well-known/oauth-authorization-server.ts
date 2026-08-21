import { corsHeaders, fetchClerkAuthorizationServerMetadata } from "@clerk/mcp-tools/server";
import { createFileRoute } from "@tanstack/react-router";

import { clerkKeysFromRecord } from "@/shared/auth/clerk";
import { workerEnv } from "@/shared/db/env";

function originOf(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export const Route = createFileRoute("/.well-known/oauth-authorization-server")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const publishableKey = clerkKeysFromRecord(workerEnv()).publishable;
        if (!publishableKey) {
          return Response.json({ error: "Clerk is not configured" }, { status: 503 });
        }
        const metadata = await fetchClerkAuthorizationServerMetadata({ publishableKey });
        if (!metadata.registration_endpoint) {
          metadata.registration_endpoint = `${originOf(request)}/oauth/register`;
        }
        return Response.json(metadata, {
          headers: {
            "Cache-Control": "max-age=3600",
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      },
      OPTIONS: () => new Response(null, { headers: corsHeaders, status: 200 }),
    },
  },
});
