import { corsHeaders, generateClerkProtectedResourceMetadata } from "@clerk/mcp-tools/server";

function getPublicOrigin(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return new URL(req.url).origin;
}

function handler(req: Request) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable");
  }
  const origin = getPublicOrigin(req);
  const metadata = generateClerkProtectedResourceMetadata({
    publishableKey,
    resourceUrl: origin,
  });
  // Point authorization_servers to our own origin so MCP clients fetch
  // auth server metadata from us (where we add registration_endpoint)
  metadata.authorization_servers = [origin];
  return Response.json(metadata, {
    headers: {
      "Cache-Control": "max-age=3600",
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function corsHandler() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export { corsHandler as OPTIONS, handler as GET };
