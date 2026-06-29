import { corsHeaders } from "@clerk/mcp-tools/server";

const CLERK_API = "https://api.clerk.com/v1/oauth_applications";

function clerkHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

function redirectUrisMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = (arr: string[]) => [...arr].sort();
  return sorted(a).every((uri, i) => uri === sorted(b)[i]);
}

function buildAppName(clientName: string | undefined, redirectUris: string[]): string {
  const base = clientName || "MCP Client";
  try {
    const slug = redirectUris[0]
      .replace(/^https?:\/\//, "")
      .replace(/[./]/g, "-")
      .replace(/-+$/, "");
    return `${base} (${slug})`;
  } catch {
    return base;
  }
}

async function findExistingApp(redirectUris: string[]): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${CLERK_API}?limit=100`, { headers: clerkHeaders() });
  if (!res.ok) return null;

  const { data } = await res.json();
  if (!Array.isArray(data)) return null;

  return (
    data.find(
      (app: Record<string, unknown>) =>
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
    client_name: oauthApp.name,
    redirect_uris: oauthApp.redirect_uris || redirectUris,
    grant_types: grantTypes || ["authorization_code"],
    response_types: responseTypes || ["code"],
    token_endpoint_auth_method: isPublic ? "none" : "client_secret_basic",
    client_id_issued_at: Math.floor((oauthApp.created_at as number) / 1000),
  };

  if (!isPublic && oauthApp.client_secret) {
    response.client_secret = oauthApp.client_secret;
    response.client_secret_expires_at = 0;
  }

  return response;
}

// RFC 7591 Dynamic Client Registration endpoint
// Proxies registration requests from MCP clients to Clerk's Backend API
// Deduplicates by redirect_uris to avoid creating duplicate apps
export async function POST(req: Request) {
  const body = await req.json();

  const {
    client_name,
    redirect_uris,
    grant_types,
    response_types,
    token_endpoint_auth_method,
    scope,
  } = body;

  if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
      { status: 400 },
    );
  }

  const isPublic = token_endpoint_auth_method === "none";

  try {
    // Check for existing app with same redirect_uris to avoid duplicates
    const existing = await findExistingApp(redirect_uris);
    if (existing) {
      const canReuse = isPublic || existing.client_secret;
      if (canReuse) {
        return Response.json(
          buildRfc7591Response(existing, redirect_uris, grant_types, response_types, isPublic),
          { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    const clerkResponse = await fetch(CLERK_API, {
      method: "POST",
      headers: clerkHeaders(),
      body: JSON.stringify({
        name: buildAppName(client_name, redirect_uris),
        redirect_uris,
        scopes: scope || "profile email",
        public: isPublic,
      }),
    });

    if (!clerkResponse.ok) {
      const error = await clerkResponse.text();
      return Response.json(
        { error: "invalid_client_metadata", error_description: error },
        { status: 400 },
      );
    }

    const oauthApp = await clerkResponse.json();

    return Response.json(
      buildRfc7591Response(oauthApp, redirect_uris, grant_types, response_types, isPublic),
      { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch {
    return Response.json(
      { error: "server_error", error_description: "Failed to register client" },
      { status: 500 },
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}
