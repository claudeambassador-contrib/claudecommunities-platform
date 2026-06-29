import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { auth } from "@clerk/nextjs/server";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "@/lib/mcp/tools";
import { getActorPermissions, hasAnyAdminPermission } from "@/lib/permissions";
import { getPlatformPrisma } from "@/lib/prisma";
import { HOME_TENANT, runWithTenant } from "@/lib/tenant-context";

function getPublicOrigin(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return new URL(req.url).origin;
}

async function verifyToken(req: Request): Promise<AuthInfo | undefined> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return undefined;
  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return undefined;

  try {
    const authResult = await auth({ acceptsToken: "oauth_token" });
    return verifyClerkToken(authResult, token);
  } catch (e) {
    console.error("[MCP] Auth verification failed:", e);
    return undefined;
  }
}

async function handler(req: Request) {
  const authInfo = await verifyToken(req);

  if (!authInfo) {
    const origin = getPublicOrigin(req);
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
        },
      },
    );
  }

  // Look up user role to determine which admin tools to expose.
  // "Admin" here means "has at least one admin permission" — fine-grained
  // gating happens per-tool via requirePermission in mcp/tools.ts.
  const clerkId = (authInfo as { extra?: { userId?: string } })?.extra?.userId;
  let isAdmin = false;
  if (clerkId) {
    const db = await getPlatformPrisma();
    const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (user) {
      // MCP carries no URL tenant → resolve against the deploy's home tenant
      // (single-tenant interim, like the apex). Membership-based: a globally-
      // admin user who isn't a member here gets NO admin tools. Fail-closed if
      // the tenant can't resolve.
      const { permissions } = await runWithTenant(HOME_TENANT, () => getActorPermissions(user.id));
      isAdmin = hasAnyAdminPermission({ permissions });
    }
  }

  const server = new McpServer(
    { name: "claude-community", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } },
  );
  registerTools(server, { isAdmin });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  transport.onclose = () => {
    server.close().catch(() => {});
  };

  // Log outgoing messages from the server
  const origSend = transport.send.bind(transport);
  transport.send = async (message, options) => {
    // console.log("[MCP] Sending to client:", JSON.stringify(message, null, 2));
    return origSend(message, options);
  };

  // Log errors
  transport.onerror = (error) => {
    console.error("[MCP] Transport error:", error);
  };

  await server.connect(transport);
  // Scope ALL tool execution to the deploy's home tenant. /mcp is selfTenanted
  // (middleware strips x-tenant-id and stamps nothing), so without this every
  // tool's getDbUser/getActorPermissions/getPrisma would fail-closed throw. This
  // single route-level scope covers the bare-async handlers too — withMcpService's
  // own runWithTenant(HOME_TENANT) just nests as a no-op (single-tenant interim;
  // a future multi-tenant MCP resolves the caller's own tenant here).
  const response = await runWithTenant(HOME_TENANT, () =>
    transport.handleRequest(req, { authInfo }),
  );
  return response;
}

export { handler as GET, handler as POST };
