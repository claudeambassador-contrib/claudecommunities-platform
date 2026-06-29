/**
 * MCP adapter helper — mirrors withService() for the MCP transport.
 * Wraps a tool handler so ServiceError thrown inside becomes the
 * standard MCP `isError: true` text result.
 */
import { HOME_TENANT, runWithTenant } from "@/lib/tenant-context";
import { isServiceError } from "./_errors";

type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
};

export function jsonResult(data: unknown): McpToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string): McpToolResult {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

export function withMcpService<Args>(
  handler: (args: Args, ctx: { authInfo: unknown }) => Promise<McpToolResult | unknown>,
): (args: Args, ctx: { authInfo: unknown }) => Promise<McpToolResult> {
  return async (args, ctx) => {
    try {
      // MCP carries no URL tenant → run every tool in the deploy's home tenant
      // (single-tenant interim). This gives both getDbUser's membership-based
      // permission check AND the tool's getPrisma() service calls a tenant to
      // resolve against (fail-closed if it can't).
      const out = await runWithTenant(HOME_TENANT, () => handler(args, ctx));
      if (out && typeof out === "object" && "content" in (out as object)) {
        return out as McpToolResult;
      }
      return jsonResult(out);
    } catch (err) {
      if (isServiceError(err)) {
        return errorResult(`${err.code}: ${err.message}`);
      }
      const msg = err instanceof Error ? err.message : String(err);
      return errorResult(msg);
    }
  };
}
