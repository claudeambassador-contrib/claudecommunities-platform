import { corsHeaders } from "@clerk/mcp-tools/server";
import { createFileRoute } from "@tanstack/react-router";
import { clerkKeysFromRecord } from "@/shared/auth/clerk";

const CLERK_API = "https://api.clerk.com/v1/oauth_applications";
const PROTOCOL = /^https?:\/\//;
const NON_SLUG = /[./]/g;
const TRAILING_DASH = /-+$/;

function clerkHeaders(secret: string) {
  return {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
}

function redirectUrisMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sorted = (arr: string[]) => [...arr].sort();
  return sorted(a).every((uri, i) => uri === sorted(b)[i]);
}

function buildAppName(clientName: string | undefined, redirectUris: string[]): string {
  const base = clientName || "MCP Client";
  const slug = (redirectUris[0] ?? "")
    .replace(PROTOCOL, "")
    .replace(NON_SLUG, "-")
    .replace(TRAILING_DASH, "");
  return slug ? `${base} (${slug})` : base;
}

async function findExistingApp(
  secret: string,
  redirectUris: string[],
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${CLERK_API}?limit=100`, { headers: clerkHeaders(secret) });
  if (!res.ok) {
    return null;
  }
  const body = (await res.json()) as { data?: Record<string, unknown>[] };
  if (!Array.isArray(body.data)) {
    return null;
  }
  return (
    body.data.find(
      (app) =>
        Array.isArray(app.redirect_uris) &&
        redirectUrisMatch(app.redirect_uris as string[], redirectUris),
    ) ?? null
  );
}

function buildRfc7591Response(
  oauthApp: Record<string, unknown>,
  redirectUris: string[],
  grantTypes: string[] | undefined,
  responseTypes: string[] | undefined,
  isPublic: boolean,
): Record<string, unknown> {
  const response: Record<string, unknown> = {
    client_id: oauthApp.client_id,
    client_id_issued_at: Math.floor(Number(oauthApp.created_at ?? Date.now()) / 1000),
    client_name: oauthApp.name,
    grant_types: grantTypes || ["authorization_code"],
    redirect_uris: oauthApp.redirect_uris || redirectUris,
    response_types: responseTypes || ["code"],
    token_endpoint_auth_method: isPublic ? "none" : "client_secret_basic",
  };
  if (!isPublic && oauthApp.client_secret) {
    response.client_secret = oauthApp.client_secret;
    response.client_secret_expires_at = 0;
  }
  return response;
}

export const Route = createFileRoute("/oauth/register")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { headers: corsHeaders, status: 200 }),
      POST: async ({ request }) => {
        const { workerEnv } = await import("@/shared/db/env");
        const { secret } = clerkKeysFromRecord(workerEnv());
        if (!secret) {
          return Response.json(
            { error: "server_error", error_description: "Clerk is not configured" },
            { status: 503 },
          );
        }
        const body = (await request.json()) as {
          client_name?: string;
          grant_types?: string[];
          redirect_uris?: string[];
          response_types?: string[];
          scope?: string;
          token_endpoint_auth_method?: string;
        };
        const redirectUris = body.redirect_uris;
        if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
          return Response.json(
            { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
            { status: 400 },
          );
        }
        const isPublic = body.token_endpoint_auth_method === "none";
        try {
          const existing = await findExistingApp(secret, redirectUris);
          if (existing && (isPublic || existing.client_secret)) {
            return Response.json(
              buildRfc7591Response(
                existing,
                redirectUris,
                body.grant_types,
                body.response_types,
                isPublic,
              ),
              { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 201 },
            );
          }
          const clerkResponse = await fetch(CLERK_API, {
            body: JSON.stringify({
              name: buildAppName(body.client_name, redirectUris),
              public: isPublic,
              redirect_uris: redirectUris,
              scopes: body.scope || "profile email",
            }),
            headers: clerkHeaders(secret),
            method: "POST",
          });
          if (!clerkResponse.ok) {
            return Response.json(
              {
                error: "invalid_client_metadata",
                error_description: await clerkResponse.text(),
              },
              { status: 400 },
            );
          }
          const oauthApp = (await clerkResponse.json()) as Record<string, unknown>;
          return Response.json(
            buildRfc7591Response(
              oauthApp,
              redirectUris,
              body.grant_types,
              body.response_types,
              isPublic,
            ),
            { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 201 },
          );
        } catch {
          return Response.json(
            { error: "server_error", error_description: "Failed to register client" },
            { status: 500 },
          );
        }
      },
    },
  },
});
