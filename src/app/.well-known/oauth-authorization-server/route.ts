import { corsHeaders, fetchClerkAuthorizationServerMetadata } from "@clerk/mcp-tools/server";

function getPublicOrigin(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return new URL(req.url).origin;
}

async function handler(req: Request) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  const metadata = await fetchClerkAuthorizationServerMetadata({ publishableKey });
  const origin = getPublicOrigin(req);

  // Clerk doesn't advertise registration_endpoint in its metadata even when
  // DCR is enabled. Add it so MCP clients can discover it.
  if (!metadata.registration_endpoint) {
    metadata.registration_endpoint = `${origin}/oauth/register`;
  }

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
