import { verifyToken } from "@clerk/backend";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  findByClerkId,
  listMembershipsForUser,
} from "@/modules/identity/repositories/usersRepository";
import { actorFromAuth } from "@/modules/identity/services/sessionService";
import { callMcpTool, listMcpTools } from "@/modules/system/services/mcpService";
import type { McpArgs, McpDispatchContext } from "@/modules/system/types";
import { resolveCityContext } from "@/modules/tenants/services/resolveCityService";
import type { Actor } from "@/shared/auth/actor";
import { clerkKeysFromRecord } from "@/shared/auth/clerk";
import { permissionsForRole } from "@/shared/auth/permissions";
import { getRegistryDb, getRegistryStore, openTenantStore, workerEnv } from "@/shared/db/env";
import type { AuthContext } from "@/shared/http/routeContext";

export function publicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

function bestRole(roles: Array<string | null | undefined>): "owner" | "admin" | "member" | null {
  if (roles.includes("owner")) {
    return "owner";
  }
  if (roles.includes("admin")) {
    return "admin";
  }
  if (roles.includes("member")) {
    return "member";
  }
  return null;
}

export async function actorFromBearer(
  request: Request,
  env: Record<string, unknown>,
): Promise<Actor | null> {
  const token = bearerToken(request);
  if (!token) {
    return null;
  }
  const keys = clerkKeysFromRecord(env);
  if (!keys.secret) {
    return null;
  }
  try {
    const payload = await verifyToken(token, { secretKey: keys.secret });
    const clerkUserId = payload.sub;
    if (!clerkUserId) {
      return null;
    }
    const user = await findByClerkId(getRegistryDb(), clerkUserId);
    if (!user || user.isBanned) {
      return null;
    }
    const memberships = await listMembershipsForUser(getRegistryDb(), user.id);
    const role = user.isSuperAdmin ? "owner" : bestRole(memberships.map((row) => row.role));
    const authCtx: AuthContext = {
      clerkUserId: user.clerkUserId,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      permissions: permissionsForRole(role),
      role,
      userId: user.id,
    };
    return actorFromAuth(authCtx);
  } catch {
    return null;
  }
}

function unauthorized(request: Request): Response {
  const origin = publicOrigin(request);
  return new Response(
    JSON.stringify({
      error: { code: -32_001, message: "Unauthorized" },
      id: null,
      jsonrpc: "2.0",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
      },
      status: 401,
    },
  );
}

function dispatchContext(actor: Actor, request: Request): McpDispatchContext {
  return {
    actor,
    openRegistry: () => getRegistryStore(),
    openTenant: async (citySlug) => {
      const city = await resolveCityContext(citySlug);
      if (!city.ok) {
        throw new Error(city.error.message ?? "City not found");
      }
      return openTenantStore(city.tenant);
    },
    upload: {
      baseUrl: publicOrigin(request),
      token: bearerToken(request) ?? "",
    },
  };
}

type RegisterLoose = (
  name: string,
  config: { description: string; inputSchema: { additionalProperties: true; type: "object" } },
  cb: (
    args: McpArgs,
  ) => Promise<{ content: Array<{ text: string; type: "text" }>; isError?: boolean }>,
) => void;

function createMcpServer(ctx: McpDispatchContext): McpServer {
  const server = new McpServer(
    { name: "claudecommunities", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  const register = server.registerTool.bind(server) as RegisterLoose;
  for (const tool of listMcpTools()) {
    register(
      tool.name,
      {
        description: tool.description,
        inputSchema: { additionalProperties: true, type: "object" },
      },
      async (args) => {
        const result = await callMcpTool(tool.name, args, ctx);
        if (!result.ok) {
          return {
            content: [{ text: result.error.message ?? result.error.code, type: "text" }],
            isError: true,
          };
        }
        const { ok: _ok, ...body } = result;
        return { content: [{ text: JSON.stringify(body), type: "text" }] };
      },
    );
  }
  return server;
}

export async function handleMcpHttp(request: Request): Promise<Response> {
  const env = workerEnv();
  const actor = await actorFromBearer(request, env);
  if (!actor) {
    return unauthorized(request);
  }

  const server = createMcpServer(dispatchContext(actor, request));
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  transport.onclose = () => {
    server.close().catch(() => undefined);
  };
  await server.connect(transport);
  return transport.handleRequest(request);
}
